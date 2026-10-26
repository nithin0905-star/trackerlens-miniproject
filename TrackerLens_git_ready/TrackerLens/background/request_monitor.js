/**
 * TrackerLens — Request Monitor
 * Listens to webRequest events and records tracker/cookie observations.
 * Never blocks or modifies requests.
 */
import { detectTracker, isThirdParty, initTrackerDetector } from '../detection/tracker_detector.js';
import { auditResponseCookies } from '../detection/cookie_detector.js';
import { TrackersRepo, CookiesRepo, DailyStatsRepo, VisitsRepo, FingerprintsRepo, ConsentRepo } from '../storage/repositories.js';
import { log } from '../shared/logger.js';
import { rescoreVisit } from './service_worker.js';

// ─── In-memory tab state ──────────────────────────────────────────────────────

/**
 * Per-tab state keyed by tabId.
 * Maps: tabId → { visitId, pageUrl, domain, trackerDomains: Set, startedAt, totalRequests, thirdPartyRequests, trackerRequests, trackers: Map, resourceTypes: Object }
 */
const tabState = new Map();

// Debounced session save
let syncTimeout = null;
function requestSync() {
  if (!chrome.storage?.session) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const serialized = {};
      for (const [id, state] of tabState.entries()) {
        serialized[id] = {
          ...state,
          trackerDomains: Array.from(state.trackerDomains),
          trackers: Array.from(state.trackers.entries())
        };
      }
      await chrome.storage.session.set({ tabState: serialized });
    } catch (e) {
      log.error('Failed to sync state to session:', e);
    }
  }, 1000);
}

export async function loadStateFromSession() {
  if (!chrome.storage?.session) return;
  try {
    const data = await chrome.storage.session.get('tabState');
    if (data.tabState) {
      for (const [idStr, state] of Object.entries(data.tabState)) {
        state.trackerDomains = new Set(state.trackerDomains || []);
        state.trackers = new Map(state.trackers || []);
        tabState.set(Number(idStr), state);
      }
      log.info(`Restored ${tabState.size} tab states from session.`);
    }
  } catch (e) {
    log.error('Failed to load state from session:', e);
  }
}

/**
 * Finalizes a tab session by saving aggregated network stats to the visit record.
 * @param {Object} state 
 */
export async function finalizeSession(state) {
  if (!state || !state.visitId) return;

  try {
    const visit = await VisitsRepo.get(state.visitId);
    if (visit) {
      visit.totalRequests = state.totalRequests;
      visit.thirdPartyRequests = state.thirdPartyRequests;
      visit.trackerRequests = state.trackerRequests;
      visit.resourceTypes = state.resourceTypes;
      await VisitsRepo.put(visit);
      
      // Batch write trackers and cookies (Phase 5 Performance)
      if (state.pendingTrackers.length > 0) {
        await TrackersRepo.batchAdd(state.pendingTrackers).catch((e) => log.error('Batch add trackers failed', e));
        await DailyStatsRepo.increment({ trackers: state.pendingTrackers.length }).catch(() => {});
      }
      if (state.pendingCookies.length > 0) {
        await CookiesRepo.batchAdd(state.pendingCookies).catch((e) => log.error('Batch add cookies failed', e));
        await DailyStatsRepo.increment({ cookies: state.pendingCookies.length }).catch(() => {});
      }
      if (state.pendingFingerprints?.length > 0) {
        await FingerprintsRepo.batchAdd(state.pendingFingerprints).catch(e => log.error('Batch add FPs failed', e));
        const totalFpCount = state.pendingFingerprints.reduce((acc, f) => acc + (f.signalCount || 0), 0);
        if (totalFpCount > 0) await DailyStatsRepo.increment({ fingerprints: totalFpCount }).catch(() => {});
      }
      if (state.pendingConsent?.length > 0) {
        await ConsentRepo.batchAdd(state.pendingConsent).catch(e => log.error('Batch add Consent failed', e));
        const totalConsent = state.pendingConsent.reduce((acc, c) => acc + (c.patterns?.length || 0), 0);
        if (totalConsent > 0) await DailyStatsRepo.increment({ consentWarnings: totalConsent }).catch(() => {});
      }
      
      // Clear queues
      state.pendingTrackers = [];
      state.pendingCookies = [];
      state.pendingFingerprints = [];
      state.pendingConsent = [];

      log.debug(`Finalized session for ${state.domain} (totalReqs: ${state.totalRequests}, trackers: ${state.pendingTrackers.length})`);
      requestSync();
    }
  } catch (err) {
    log.error('Failed to finalize session:', err);
  }
}

export function setTabVisit(tabId, visitId, pageUrl) {
  // Finalize existing session if any
  const existingState = tabState.get(tabId);
  if (existingState && existingState.visitId !== visitId) {
    finalizeSession(existingState);
  }

  let domain = '';
  try { domain = new URL(pageUrl).hostname; } catch { /* ignore */ }
  
  tabState.set(tabId, { 
    visitId, 
    pageUrl, 
    domain, 
    trackerDomains: new Set(),
    startedAt: Date.now(),
    totalRequests: 0,
    thirdPartyRequests: 0,
    trackerRequests: 0,
    trackers: new Map(), // domain -> tracker info
    resourceTypes: {},
    pendingTrackers: [], // queue for batch write
    pendingCookies: [],   // queue for batch write
    pendingFingerprints: [],
    pendingConsent: []

  });
  log.debug(`Tab ${tabId} visit set: ${domain} (visitId=${visitId})`);
  requestSync();
}

export function clearTabState(tabId) {
  const state = tabState.get(tabId);
  if (state) finalizeSession(state);
  tabState.delete(tabId);
  requestSync();
}

export function getTabState(tabId) {
  return tabState.get(tabId) ?? null;
}

// ─── webRequest listener ──────────────────────────────────────────────────────

/**
 * Registers the webRequest.onCompleted listener.
 * Called once from service_worker.js startup.
 */
export function startRequestMonitor() {
  if (!chrome.webRequest?.onCompleted) {
    log.warn('webRequest API not available — request monitoring disabled.');
    return;
  }

  chrome.webRequest.onCompleted.addListener(
    handleRequestCompleted,
    { urls: ['<all_urls>'] },
    ['responseHeaders', 'extraHeaders']
  );

  // We should also listen to onBeforeRequest to get all requests regardless of completion status
  // but the prompt specifies using webRequest-compatible observation mechanism. 
  // onCompleted is fine, as it gives response headers too.

  log.info('Request monitor started.');
}

/**
 * Handles a completed web request.
 * Checks for tracker domains and audits Set-Cookie headers.
 * @param {chrome.webRequest.WebResponseCacheDetails} details
 */
async function handleRequestCompleted(details) {
  // Ignore extension-internal requests and non-HTTP
  if (details.url.startsWith('chrome-extension://')) return;
  if (!details.url.startsWith('http'))               return;

  const { tabId, url: requestUrl, responseHeaders = [], type: resourceType, method } = details;
  const state = tabState.get(tabId);
  if (!state) return; // Tab not being tracked

  const { visitId, pageUrl } = state;

  // Update session metrics
  state.totalRequests++;
  
  const resTypeStr = resourceType || 'other';
  state.resourceTypes[resTypeStr] = (state.resourceTypes[resTypeStr] || 0) + 1;

  const is3p = isThirdParty(requestUrl, pageUrl);
  if (is3p) {
    state.thirdPartyRequests++;
  }

  // ── Tracker Detection ────────────────────────────────────────────────────────
  const trackerInfo = detectTracker(requestUrl);

  if (trackerInfo.isTracker && is3p) {
    state.trackerRequests++;

    // Deduplicate: only record each tracker domain once per visit
    if (!state.trackerDomains.has(trackerInfo.domain)) {
      state.trackerDomains.add(trackerInfo.domain);
      state.trackers.set(trackerInfo.domain, trackerInfo);

      state.pendingTrackers.push({
        visitId,
        domain:      trackerInfo.domain,
        company:     trackerInfo.company,
        category:    trackerInfo.category,
        purpose:     trackerInfo.purpose,
        severity:    trackerInfo.severity,
        requestUrl,
        method,
        resourceType,
        isDemo:      false,
      });
      log.debug(`Tracker queued: ${trackerInfo.company || trackerInfo.domain} (${trackerInfo.category})`);
    }
  }

  // ── Cookie Audit ─────────────────────────────────────────────────────────────
  const cookieRecords = auditResponseCookies(responseHeaders, requestUrl, pageUrl);

  for (const c of cookieRecords) {
    state.pendingCookies.push({ ...c, visitId, isDemo: false });
  }
  
  requestSync();
}
