/**
 * TrackerLens — Data Exporter (Phase 4)
 * Exports all local data as JSON or CSV download.
 * Purely client-side — no network requests made.
 */
import {
  serializeVisit, serializeTracker, serializeFingerprint,
  serializeCookie, serializeConsentEvent, toCSV,
} from './serializers.js';

/**
 * Triggers a file download in the browser.
 */
function triggerDownload(content, filename, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports all TrackerLens data as a structured JSON file.
 * Includes all Phase 4 required fields: generatedAt, domain, score, risk,
 * trackers, fingerprints, cookies, consentEvents.
 * @param {Object} rawData — returned from handleExportData in message_router
 */
export function exportAsJSON(rawData) {
  const payload = {
    _meta: {
      exportedBy:  'TrackerLens',
      generatedAt: new Date().toISOString(),
      version:     rawData.version ?? '2',
      totalDomains: rawData.domains?.length ?? rawData.summary?.totalDomains ?? 0,
      totalVisits:  rawData.summary?.totalVisits ?? rawData.visits?.length ?? 0,
    },
    domains:      rawData.domains ?? [],
    visits:       (rawData.rawVisits ?? rawData.visits ?? []).map(serializeVisit),
    trackers:     (rawData.trackers     ?? []).map(serializeTracker),
    fingerprints: (rawData.fingerprints ?? []).map(serializeFingerprint),
    cookies:      (rawData.cookies      ?? []).map(serializeCookie),
    consentEvents:(rawData.consent      ?? []).map(serializeConsentEvent),
    dailyStats:   rawData.dailyStats    ?? [],
  };

  const json = JSON.stringify(payload, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(json, `trackerlens-export-${date}.json`, 'application/json');
}

/**
 * Exports visits as CSV.
 * Accepts either raw visit records or the flat CSV row objects from handleExportCSV.
 * @param {Object[]} visits
 */
export function exportVisitsCSV(visits) {
  if (!visits || visits.length === 0) return;

  // If the rows already have generatedAt/risk (flat CSV format), use directly
  const rows = visits[0]?.generatedAt !== undefined
    ? visits
    : visits.map(serializeVisit).map(v => ({
        generatedAt: new Date().toISOString(),
        domain:      v.domain,
        score:       v.score,
        risk:        v.riskLevel,
        isTrusted:   v.isTrusted,
        isDemo:      v.isDemo,
        timestamp:   v.timestamp,
        date:        v.date,
      }));

  const csv  = toCSV(rows);
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(csv, `trackerlens-visits-${date}.csv`, 'text/csv');
}

/**
 * Imports settings from a JSON string.
 * Returns the parsed settings object or throws.
 * @param {string} jsonString
 * @returns {Object}
 */
export function importSettings(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (typeof parsed !== 'object' || Array.isArray(parsed) || !parsed) {
    throw new Error('Invalid settings format: expected a JSON object.');
  }
  const source = parsed.settings || parsed;
  const ALLOWED_KEYS = [
    'scoringEnabled', 'weightTrackers', 'weightFingerprinting', 'weightCookies', 'weightConsent',
    'showRiskBadge', 'showTrackerCount', 'showFpCount', 'showCookieCount', 'showExplanations',
    'retentionDays', 'autoDeleteOld', 'trackerListEnabled', 'notifyHighRisk', 'devMode',
  ];
  const safe = {};
  for (const key of ALLOWED_KEYS) {
    if (key in source) safe[key] = source[key];
  }
  if (Object.keys(safe).length === 0) {
    throw new Error('No valid TrackerLens settings found in this file.');
  }
  return safe;
}
