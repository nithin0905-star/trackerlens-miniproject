/**
 * TrackerLens — Service Worker (Entry Point) — Phase 4
 * Initialises all subsystems on extension startup.
 * MV3 service worker: stateless across restarts, event-driven.
 *
 * TRUSTED SITE SEMANTICS (Phase 4):
 *   Trusted sites are STILL scored and audited.
 *   Trust only suppresses the badge alert color — score is always shown.
 */
import { openDB }                  from '../storage/indexeddb.js';
import {
  SettingsRepo, VisitsRepo, TrackersRepo, FingerprintsRepo,
  CookiesRepo, ConsentRepo, DailyStatsRepo, WeeklyStatsRepo,
  TrustedSitesRepo,
} from '../storage/repositories.js';
import { DEFAULT_SETTINGS }        from '../storage/defaults.js';
import { initTrackerDetector }     from '../detection/tracker_detector.js';
import { startRequestMonitor, setTabVisit, clearTabState, getTabState, loadStateFromSession, finalizeSession } from './request_monitor.js';
import { startMessageRouter }      from './message_router.js';
import { DEV_MODE, APP_VERSION }   from '../shared/config.js';
import { log }                     from '../shared/logger.js';
import { computeScore }            from '../scoring/score_engine.js';

// ─── Startup ──────────────────────────────────────────────────────────────────

// Guard flag: ensure startup() is idempotent across multiple event sources
let _started = false;

async function startup() {
  // MV3 service workers can restart; only fully initialize once per SW lifetime
  if (_started) {
    // On re-wakeup: recover state from session storage only
    await loadStateFromSession().catch(() => {});
    return;
  }
  _started = true;

  log.info(`TrackerLens v${APP_VERSION} service worker starting… (DEV_MODE=${DEV_MODE})`);

  try {
    // 1. Open IndexedDB (creates/migrates schema)
    await openDB();
    log.info('IndexedDB ready.');

    // 2. Seed default settings if not already present
    await seedDefaultSettings();

    // 3. Load tracker domain list
    await initTrackerDetector();

    // 4. Start request monitor
    startRequestMonitor();

    // 5. Start message router
    startMessageRouter();

    // 6. Register navigation listeners
    registerNavigationListeners();

    // 7. Register tab lifecycle listeners
    registerTabListeners();

    // 8. Register retention cron
    registerRetentionCron();

    // 9. Set extension icon badge to ready state
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

    // 10. Recover tab state for existing tabs (Phase 5 Reliability)
    await loadStateFromSession();
    await recoverTabStates();

    log.info('TrackerLens startup complete.');
  } catch (err) {
    log.error('Fatal startup error:', err);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

async function recoverTabStates() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.url || !tab.id) continue;
      if (getTabState(tab.id)) continue;
      
      try {
        const domain = new URL(tab.url).hostname;
        const isTrusted = await TrustedSitesRepo.has(domain);
        const visitId = await VisitsRepo.add({
          domain,
          url: tab.url,
          timestamp: Date.now(),
          riskLevel: 'none',
          score: 0,
          isTrusted,
          isDemo: false,
        });
        setTabVisit(tab.id, visitId, tab.url);
      } catch (e) {
        // ignore invalid urls
      }
    }
    log.info(`Recovered state for ${tabs.length} tabs.`);
  } catch (err) {
    log.error('Failed to recover tab states:', err);
  }
}

// ─── Default Settings Seeding ─────────────────────────────────────────────────

async function seedDefaultSettings() {
  const existing = await SettingsRepo.asMap();
  const missing  = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in existing)) {
      missing[key] = value;
    }
  }

  if (Object.keys(missing).length > 0) {
    await SettingsRepo.bulkSet(missing);
    log.info(`Seeded ${Object.keys(missing).length} default settings.`);
  }
}

// ─── Retention Cron ───────────────────────────────────────────────────────────

function registerRetentionCron() {
  // Avoid creating duplicate alarms if called multiple times
  chrome.alarms.get('retention-cron', (existing) => {
    if (!existing) {
      chrome.alarms.create('retention-cron', { periodInMinutes: 60 * 12 });
    }
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'retention-cron') {
      runRetentionCleanup();
    }
  });
  runRetentionCleanup();
}

async function runRetentionCleanup() {
  try {
    const settings = await SettingsRepo.asMap();
    if (settings.autoDeleteOld === false) return;

    const days       = settings.retentionDays || 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    log.info(`Running retention cleanup for records older than ${days} days...`);

    await Promise.all([
      VisitsRepo.deleteOlderThan(cutoffTime),
      TrackersRepo.deleteOlderThan(cutoffTime),
      FingerprintsRepo.deleteOlderThan(cutoffTime),
      CookiesRepo.deleteOlderThan(cutoffTime),
      ConsentRepo.deleteOlderThan(cutoffTime),
    ]);

    log.info('Retention cleanup completed.');
  } catch (err) {
    log.error('Retention cleanup failed:', err);
  }
}

// ─── Navigation Listeners ─────────────────────────────────────────────────────

function registerNavigationListeners() {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.url || !tab.url.startsWith('http')) return;

    // Simulate onCommitted when URL changes
    if (changeInfo.url) {
      const url = changeInfo.url;
      let domain;
      try { domain = new URL(url).hostname; }
      catch { return; }

      // PHASE 4: trusted status is recorded but does NOT skip auditing
      const isTrusted = await TrustedSitesRepo.has(domain);

      try {
        const visitId = await VisitsRepo.add({
          domain,
          url,
          timestamp: Date.now(),
          riskLevel: 'none',
          score:     0,
          isTrusted,
          isDemo:    false,
        });

        setTabVisit(tabId, visitId, url);
        await DailyStatsRepo.increment({ visits: 1 }).catch(() => {});
        await WeeklyStatsRepo.increment({ sites: 1 }).catch(() => {});

        // Show neutral badge initially
        updateBadge(tabId, 0, 'none', isTrusted);

        log.debug(`Navigation committed: ${domain} (visitId=${visitId}, trusted=${isTrusted})`);
      } catch (err) {
        log.error('Failed to record visit:', err);
      }
    }

    // Simulate onCompleted
    if (changeInfo.status === 'complete') {
      const state = getTabState(tabId);
      if (!state) return;

      // Re-score after brief delay to allow request data to settle
      setTimeout(() => rescoreVisit(tabId), 1500);
      setTimeout(() => rescoreVisit(tabId), 6000);
    }
  });
}

// ─── Tab Lifecycle ────────────────────────────────────────────────────────────

function registerTabListeners() {
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabState(tabId);
  });

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const state = getTabState(activeInfo.tabId);
    if (state) {
      const visits = await VisitsRepo.byDomain(state.domain ?? '');
      if (visits.length > 0) {
        visits.sort((a, b) => b.timestamp - a.timestamp);
        const v = visits[0];
        updateBadge(activeInfo.tabId, v.score ?? 0, v.riskLevel ?? 'none', v.isTrusted ?? false);
      }
    }
  });
}

// ─── Rescore ──────────────────────────────────────────────────────────────────

export async function rescoreVisit(tabId) {
  try {
    const state = getTabState(tabId);
    if (!state) return;

    // Write queued observations so the stored score reflects them
    await finalizeSession(state);

    const [trackers, fps, cookies, consent, settings] = await Promise.all([
      TrackersRepo.byVisit(state.visitId),
      FingerprintsRepo.byVisit(state.visitId),
      CookiesRepo.byVisit(state.visitId),
      ConsentRepo.byVisit(state.visitId),
      SettingsRepo.asMap(),
    ]);

    const isTrusted = await TrustedSitesRepo.has(state.domain ?? '');
    const fpSignals = fps.flatMap(f => f.signals ?? []);

    // PHASE 4: trusted sites are still scored
    const { score, severity } = computeScore(
      { trackers, fingerprintSignals: fpSignals, cookies, consentEvents: consent, isTrusted },
      { ...DEFAULT_SETTINGS, ...settings },
    );

    // Update visit record
    const visits = await VisitsRepo.byDomain(state.domain ?? '');
    if (visits.length > 0) {
      visits.sort((a, b) => b.timestamp - a.timestamp);
      const v = visits[0];
      await VisitsRepo.put({ ...v, score, riskLevel: severity, isTrusted });
    }

    // Increment weekly stats with this score
    const consentWarnings = consent.filter(
      e => e.isDarkPattern || (e.patterns && e.patterns.length > 0)
    ).length;

    await WeeklyStatsRepo.increment({
      uniqueTrackers:       trackers.length,
      fingerprintingEvents: fpSignals.length,
      consentWarnings,
      totalScore:           score,
      scoredVisits:         1,
      score,  // for high/low tracking
    }).catch(() => {});

    await DailyStatsRepo.increment({
      totalScore:   score,
      scoredVisits: 1,
      consentWarnings,
    }).catch(() => {});

    updateBadge(tabId, score, severity, isTrusted);
  } catch (err) {
    log.error('Rescore failed:', err);
  }
}

// ─── Badge Utilities ──────────────────────────────────────────────────────────

/**
 * Updates the extension badge.
 * For trusted sites: shows score but uses a muted color (suppresses alert).
 */
function updateBadge(tabId, score, severity, isTrusted = false) {
  const alertColors = {
    none:      '#6b7280',
    low:       '#10b981',
    moderate:  '#f59e0b',
    high:      '#ef4444',
    very_high: '#dc2626',
    critical:  '#7c3aed',
  };

  // Trusted sites: always show neutral/green badge regardless of score
  const color = isTrusted
    ? '#10b981'
    : (alertColors[severity] ?? alertColors.none);

  const text = score > 0 ? String(score) : '';

  chrome.action.setBadgeText({ text, tabId }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color, tabId }).catch(() => {});
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(startup);
  chrome.runtime.onStartup?.addListener(startup);

  // Run immediately for dev reloads (when onInstalled/onStartup may not fire).
  // The _started guard ensures it only fully initializes once.
  startup();
}
