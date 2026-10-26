/**
 * TrackerLens — Message Router (Phase 4)
 * Routes messages between popup/content-scripts and the service worker.
 * All handlers are async. Returns { success, data } or { success: false, error }.
 */
import {
  VisitsRepo, TrackersRepo, FingerprintsRepo, CookiesRepo,
  ConsentRepo, SettingsRepo, TrustedSitesRepo, DailyStatsRepo,
  WeeklyStatsRepo, clearAllData, factoryReset,
} from '../storage/repositories.js';
import { DEFAULT_SETTINGS } from '../storage/defaults.js';
import { computeScore }     from '../scoring/score_engine.js';
import { evaluateFingerprintSignals } from '../detection/fingerprint_detector.js';
import { evaluateConsentSignals }     from '../detection/consent_detector.js';
import { getTabState, setTabVisit }   from './request_monitor.js';
import { MSG }              from '../shared/config.js';
import { log }              from '../shared/logger.js';
import { DEV_MODE }         from '../shared/config.js';

// ─── Handler Registry ─────────────────────────────────────────────────────────

const handlers = {
  [MSG.PING]:                handlePing,
  [MSG.GET_TAB_REPORT]:      handleGetTabReport,
  [MSG.GET_SETTINGS]:        handleGetSettings,
  [MSG.SAVE_SETTINGS]:       handleSaveSettings,
  [MSG.GET_HISTORY]:         handleGetHistory,
  [MSG.GET_DAILY_STATS]:     handleGetDailyStats,
  [MSG.GET_WEEKLY_SUMMARY]:  handleGetWeeklySummary,
  [MSG.RESET_DATA]:          handleResetData,
  [MSG.EXPORT_DATA]:         handleExportData,
  [MSG.EXPORT_CSV]:          handleExportCSV,
  [MSG.LOAD_DEMO]:           handleLoadDemo,
  [MSG.TOGGLE_TRUSTED]:      handleToggleTrusted,
  [MSG.GET_TRUSTED_SITES]:   handleGetTrustedSites,
  [MSG.GET_SCORE_EXPLANATION]: handleGetScoreExplanation,
  [MSG.FP_SIGNALS]:          handleFpSignals,
  [MSG.PAGE_SIGNALS]:        handlePageSignals,
};

export function startMessageRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Phase 5: Security audit - Verify sender is our own extension
    if (sender.id !== chrome.runtime.id) {
      log.warn(`Rejecting message from untrusted sender: ${sender.id}`);
      return false;
    }

    // If it's a content script (HTTP/S), it must have a valid tab context
    if (sender.url && sender.url.startsWith('http') && !sender.tab) {
      log.warn(`Rejecting message from invalid content script context: ${sender.url}`);
      return false;
    }

    if (!message || typeof message !== 'object') {
      log.warn('Rejecting non-object message payload.');
      return false;
    }

    const type    = message?.type;
    const handler = handlers[type];

    if (!handler) {
      log.warn(`Unknown message type: ${type}`);
      sendResponse({ success: false, error: `Unknown message type: ${type}` });
      return false;
    }

    handler(message, sender)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        log.error(`Handler error for ${type}:`, err);
        sendResponse({ success: false, error: err?.message ?? String(err) });
      });

    return true;
  });

  log.info('Message router started.');
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handlePing() {
  return { pong: true, timestamp: Date.now() };
}

/**
 * Returns the full privacy report for the active tab,
 * including score explanations.
 */
async function handleGetTabReport(message) {
  const { tabId, url } = message;

  if (!url) return buildEmptyReport(url, tabId);

  let domain;
  try { domain = new URL(url).hostname; }
  catch { return buildEmptyReport(url, tabId); }

  const visits = await VisitsRepo.byDomain(domain);
  if (visits.length === 0) return buildEmptyReport(url, tabId);

  visits.sort((a, b) => b.timestamp - a.timestamp);
  const visit = visits[0];

  const [trackers, fps, cookies, consent, settings] = await Promise.all([
    TrackersRepo.byVisit(visit.id),
    FingerprintsRepo.byVisit(visit.id),
    CookiesRepo.byVisit(visit.id),
    ConsentRepo.byVisit(visit.id),
    SettingsRepo.asMap(),
  ]);

  const isTrusted  = await TrustedSitesRepo.has(domain);
  const fpSignals  = fps.flatMap(f => f.signals ?? []);
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

  // PHASE 4: always compute score; isTrusted only affects UI
  const { score, severity, breakdown, explanations } = computeScore(
    { trackers, fingerprintSignals: fpSignals, cookies, consentEvents: consent, isTrusted },
    mergedSettings,
  );

  return {
    domain,
    url,
    visitId:         visit.id,
    timestamp:       visit.timestamp,
    score,
    severity,
    breakdown,
    explanations,
    isTrusted,
    isDemo:          visit.isDemo ?? false,
    totalRequests:   visit.totalRequests ?? 0,
    thirdPartyRequests: visit.thirdPartyRequests ?? 0,
    trackerRequests: visit.trackerRequests ?? 0,
    trackerCount:    trackers.length,
    trackers:        trackers.slice(0, 20),
    fpCount:         fpSignals.length,
    fpSignals,
    cookieCount:     cookies.length,
    cookies:         cookies.slice(0, 30),
    consentEvents:   consent,
  };
}

function buildEmptyReport(url, tabId) {
  const domain = url
    ? (() => { try { return new URL(url).hostname; } catch { return url; } })()
    : '';
  return {
    domain,
    url:             url ?? '',
    visitId:         null,
    score:           0,
    severity:        'none',
    breakdown:       { trackers: 0, fingerprinting: 0, cookies: 0, consent: 0 },
    explanations:    [],
    isTrusted:       false,
    isDemo:          false,
    totalRequests:   0,
    thirdPartyRequests: 0,
    trackerRequests: 0,
    trackerCount:    0,
    trackers:        [],
    fpCount:         0,
    fpSignals:       [],
    cookieCount:     0,
    cookies:         [],
    consentEvents:   [],
  };
}

async function handleGetSettings() {
  const stored = await SettingsRepo.asMap();
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function handleSaveSettings(message) {
  const { settings } = message;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Invalid settings payload: must be an object');
  }
  // Sanitize setting keys and values (basic validation)
  const safeSettings = {};
  for (const [k, v] of Object.entries(settings)) {
    if (typeof k === 'string' && k.length < 50) {
      safeSettings[k] = v;
    }
  }
  await SettingsRepo.bulkSet(safeSettings);
  return { saved: true };
}

async function handleGetHistory(message) {
  const rawLimit = message?.limit;
  const limit = (typeof rawLimit === 'number' && rawLimit > 0 && rawLimit <= 1000) ? rawLimit : 100;
  const visits = await VisitsRepo.recent(limit);

  const enriched = await Promise.all(visits.map(async (v) => {
    const [trackers, fps, cookies] = await Promise.all([
      TrackersRepo.byVisit(v.id),
      FingerprintsRepo.byVisit(v.id),
      CookiesRepo.byVisit(v.id),
    ]);
    return {
      ...v,
      trackerCount: trackers.length,
      fpCount:      fps.flatMap(f => f.signals ?? []).length,
      cookieCount:  cookies.length,
    };
  }));

  return enriched;
}

async function handleGetDailyStats() {
  return DailyStatsRepo.getToday();
}

/**
 * Computes weekly summary from the last 7 days of dailyStats
 * plus this week's WeeklyStats record.
 */
async function handleGetWeeklySummary() {
  const [weekStats, last7Days, recentVisits] = await Promise.all([
    WeeklyStatsRepo.getThisWeek(),
    DailyStatsRepo.lastNDays(7),
    VisitsRepo.sinceTimestamp(Date.now() - 7 * 24 * 60 * 60 * 1000),
  ]);

  // Aggregate from dailyStats (more fine-grained, available even without weeklyStats)
  const totals = last7Days.reduce((acc, day) => ({
    visits:           acc.visits           + (day.visits           ?? 0),
    trackers:         acc.trackers         + (day.trackers         ?? 0),
    fingerprints:     acc.fingerprints     + (day.fingerprints     ?? 0),
    cookies:          acc.cookies          + (day.cookies          ?? 0),
    consentWarnings:  acc.consentWarnings  + (day.consentWarnings  ?? 0),
    trackingRequests: acc.trackingRequests + (day.trackingRequests ?? 0),
    totalScore:       acc.totalScore       + (day.totalScore       ?? 0),
    scoredVisits:     acc.scoredVisits     + (day.scoredVisits     ?? 0),
  }), {
    visits: 0, trackers: 0, fingerprints: 0, cookies: 0,
    consentWarnings: 0, trackingRequests: 0, totalScore: 0, scoredVisits: 0,
  });

  // High/low score from recent visits
  const scores = recentVisits.map(v => v.score ?? 0).filter(s => s > 0);
  const highScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowScore  = scores.length > 0 ? Math.min(...scores) : 0;
  const avgScore  = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Per-day breakdown for chart (oldest to newest)
  const chartData = [...last7Days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      date:    d.date,
      visits:  d.visits ?? 0,
      score:   d.scoredVisits > 0
        ? Math.round((d.totalScore ?? 0) / d.scoredVisits)
        : 0,
      trackers: d.trackers ?? 0,
    }));

  return {
    sitesVisited:       totals.visits,
    avgScore,
    highScore,
    lowScore,
    uniqueTrackers:     weekStats?.uniqueTrackers ?? totals.trackers,
    fingerprintingEvents: totals.fingerprints,
    trackingRequests:   totals.trackingRequests,
    consentWarnings:    totals.consentWarnings,
    chartData,
  };
}

async function handleResetData(message) {
  if (message?.full) {
    await factoryReset();
    return { cleared: 'all' };
  }
  await clearAllData();
  return { cleared: 'data' };
}

/**
 * Export all data as structured JSON with all required Phase 4 fields.
 */
async function handleExportData() {
  const [visits, trackers, fingerprints, cookies, consent, stats] = await Promise.all([
    VisitsRepo.all(),
    TrackersRepo.all(),
    FingerprintsRepo.all(),
    CookiesRepo.all(),
    ConsentRepo.all(),
    DailyStatsRepo.all(),
  ]);

  // Build per-domain structured records
  const domainMap = new Map();
  for (const v of visits) {
    if (!domainMap.has(v.domain)) {
      domainMap.set(v.domain, {
        domain:       v.domain,
        score:        v.score ?? 0,
        risk:         v.riskLevel ?? 'none',
        isTrusted:    v.isTrusted ?? false,
        lastVisit:    v.timestamp,
        trackers:     [],
        fingerprints: [],
        cookies:      [],
        consentEvents:[],
      });
    }
    const entry = domainMap.get(v.domain);
    if (v.score > entry.score) {
      entry.score = v.score;
      entry.risk  = v.riskLevel;
    }
    entry.lastVisit = Math.max(entry.lastVisit, v.timestamp);
  }

  // Attach sub-data
  for (const t of trackers) {
    const entry = domainMap.get(t.domain);
    if (entry) entry.trackers.push({ name: t.trackerName, category: t.category, domain: t.domain });
  }
  for (const fp of fingerprints) {
    const entry = domainMap.get(fp.domain);
    if (entry) entry.fingerprints.push(...(fp.signals ?? []));
  }
  for (const c of cookies) {
    const entry = domainMap.get(c.domain);
    if (entry) entry.cookies.push({ name: c.name, category: c.category, thirdParty: c.thirdParty });
  }
  for (const ce of consent) {
    const entry = domainMap.get(ce.domain);
    if (entry && ce.patterns?.length > 0) {
      entry.consentEvents.push(...ce.patterns);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    version:     '2',
    summary: {
      totalDomains:  domainMap.size,
      totalVisits:   visits.length,
      totalTrackers: trackers.length,
    },
    domains: Array.from(domainMap.values()),
    rawVisits:  visits,
    dailyStats: stats,
  };
}

/**
 * Export visits as CSV-compatible array of flat objects.
 */
async function handleExportCSV() {
  const visits = await VisitsRepo.all();
  return visits.map(v => ({
    generatedAt: new Date().toISOString(),
    domain:      v.domain,
    url:         v.url,
    score:       v.score ?? 0,
    risk:        v.riskLevel ?? 'none',
    isTrusted:   v.isTrusted ?? false,
    isDemo:      v.isDemo ?? false,
    timestamp:   v.timestamp,
    date:        v.timestamp ? new Date(v.timestamp).toISOString() : '',
  }));
}

async function handleLoadDemo() {
  if (DEV_MODE) {
    try {
      const { injectDemoData } = await import('./demo_data.js');
      await injectDemoData();
      return { injected: true };
    } catch (e) {
      log.error('Demo data module not found.', e);
    }
  }
  return { injected: false };
}

/**
 * Toggle a domain in the trusted sites list.
 * Returns { isTrusted: boolean }.
 */
export async function handleToggleTrusted(message) {
  const { domain } = message;
  if (!domain || typeof domain !== 'string' || domain.length > 255) {
    throw new Error('Invalid domain parameter');
  }
  const isTrusted = await TrustedSitesRepo.toggle(domain);
  log.info(`Trusted toggle: ${domain} → ${isTrusted}`);
  return { domain, isTrusted };
}

/**
 * Returns all trusted domains.
 */
export async function handleGetTrustedSites() {
  const records = await TrustedSitesRepo.all();
  return (records || []).map(r => r.domain);
}

/**
 * Returns score explanations for a domain (from most recent visit).
 */
async function handleGetScoreExplanation(message) {
  const { domain } = message;
  if (!domain) throw new Error('domain is required');

  const visits = await VisitsRepo.byDomain(domain);
  if (visits.length === 0) return { explanations: [], score: 0 };

  visits.sort((a, b) => b.timestamp - a.timestamp);
  const visit = visits[0];

  const [trackers, fps, cookies, consent, settings] = await Promise.all([
    TrackersRepo.byVisit(visit.id),
    FingerprintsRepo.byVisit(visit.id),
    CookiesRepo.byVisit(visit.id),
    ConsentRepo.byVisit(visit.id),
    SettingsRepo.asMap(),
  ]);

  const isTrusted = await TrustedSitesRepo.has(domain);
  const fpSignals = fps.flatMap(f => f.signals ?? []);
  const result    = computeScore(
    { trackers, fingerprintSignals: fpSignals, cookies, consentEvents: consent, isTrusted },
    { ...DEFAULT_SETTINGS, ...settings },
  );

  return { ...result, domain };
}

// ─── Content Script Handlers ──────────────────────────────────────────────────

export async function handleFpSignals(message, sender) {
  const { signals } = message;
  const tabId  = sender?.tab?.id;

  if (!tabId || !signals || !Array.isArray(signals)) return { recorded: false };

  const state = getTabState(tabId);
  if (!state) return { recorded: false };

  const fpRecord = evaluateFingerprintSignals(signals, state.domain, state.visitId);

  // Initialize pending array if needed
  if (!state.pendingFingerprints) state.pendingFingerprints = [];
  
  // Merge into in-memory pending array to avoid constant IndexedDB writes
  let existing = state.pendingFingerprints.find(f => f.domain === state.domain);
  if (existing) {
    const sigMap = new Map();
    (existing.signals ?? []).forEach(s => sigMap.set(`${s.api}:${s.indicator}`, s));
    fpRecord.signals.forEach(s => sigMap.set(`${s.api}:${s.indicator}`, s));
    existing.signals = Array.from(sigMap.values());
    existing.signalCount = existing.signals.length;
    existing.highRiskSignals = existing.signals
      .filter(s => s.confidence === 'high')
      .map(s => s.api);
    existing.timestamp = Date.now();
  } else {
    state.pendingFingerprints.push({ ...fpRecord, isDemo: false });
  }

  return { recorded: true };
}

export async function handlePageSignals(message, sender) {
  const { signals } = message;
  const tabId = sender?.tab?.id;

  if (!tabId || !signals) return { recorded: false };

  const state = getTabState(tabId);
  if (!state) return { recorded: false };

  const consentRecord = evaluateConsentSignals(signals, state.domain, state.visitId);

  // Initialize pending array if needed
  if (!state.pendingConsent) state.pendingConsent = [];
  
  // Push to in-memory queue to be batched later
  state.pendingConsent.push({ ...consentRecord, isDemo: false });

  return { recorded: true };
}
