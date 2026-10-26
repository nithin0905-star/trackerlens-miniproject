/**
 * TrackerLens — Data Serializers (Phase 4)
 * Transforms raw DB records into export-friendly formats.
 */

export function serializeVisit(visit) {
  return {
    id:        visit.id,
    domain:    visit.domain,
    url:       visit.url,
    score:     visit.score ?? 0,
    risk:      visit.riskLevel ?? 'none',
    riskLevel: visit.riskLevel ?? 'none',
    isTrusted: visit.isTrusted ?? false,
    isDemo:    visit.isDemo   ?? false,
    timestamp: visit.timestamp,
    date:      visit.timestamp ? new Date(visit.timestamp).toISOString() : '',
  };
}

export function serializeTracker(tracker) {
  return {
    id:          tracker.id,
    visitId:     tracker.visitId,
    domain:      tracker.domain,
    trackerName: tracker.trackerName,
    category:    tracker.category,
    requestUrl:  tracker.requestUrl,
    timestamp:   tracker.timestamp,
    date:        tracker.timestamp ? new Date(tracker.timestamp).toISOString() : '',
    isDemo:      tracker.isDemo ?? false,
  };
}

export function serializeFingerprint(fp) {
  return {
    id:              fp.id,
    visitId:         fp.visitId,
    domain:          fp.domain,
    signals:         (fp.signals ?? []).map(s => typeof s === 'string' ? s : s.api ?? s),
    signalCount:     fp.signalCount ?? 0,
    highRiskSignals: fp.highRiskSignals ?? [],
    riskLevel:       fp.riskLevel ?? 'none',
    timestamp:       fp.timestamp,
    date:            fp.timestamp ? new Date(fp.timestamp).toISOString() : '',
    isDemo:          fp.isDemo ?? false,
  };
}

export function serializeCookie(cookie) {
  return {
    id:          cookie.id,
    visitId:     cookie.visitId,
    domain:      cookie.domain,
    name:        cookie.name,
    category:    cookie.category,
    thirdParty:  cookie.thirdParty,
    httpOnly:    cookie.httpOnly,
    secure:      cookie.secure,
    sameSite:    cookie.sameSite,
    timestamp:   cookie.timestamp,
    date:        cookie.timestamp ? new Date(cookie.timestamp).toISOString() : '',
    isDemo:      cookie.isDemo ?? false,
  };
}

/**
 * Serializes a consent event record.
 * @param {Object} event
 * @returns {Object}
 */
export function serializeConsentEvent(event) {
  return {
    id:                 event.id,
    visitId:            event.visitId,
    domain:             event.domain,
    hasBanner:          event.hasBanner ?? false,
    isDarkPattern:      event.isDarkPattern ?? false,
    hasLegitimateOptOut: event.hasLegitimateOptOut ?? false,
    patterns:           (event.patterns ?? []).map(p => ({
      type:       p.type,
      confidence: p.confidence,
      reason:     p.reason,
    })),
    timestamp: event.timestamp,
    date:      event.timestamp ? new Date(event.timestamp).toISOString() : '',
    isDemo:    event.isDemo ?? false,
  };
}

/**
 * Converts an array of objects to CSV string.
 * @param {Object[]} records
 * @returns {string}
 */
export function toCSV(records) {
  if (!records || records.length === 0) return '';

  const headers = Object.keys(records[0]);
  const rows = records.map(r =>
    headers.map(h => {
      const val = r[h];
      if (Array.isArray(val)) return `"${val.join('|')}"`;
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
