/**
 * TrackerLens — Score Engine (Phase 4)
 *
 * Transparent scoring: every point must map to a rule.
 * Returns explanations[] so the UI can answer "Why is this site 72?".
 *
 * Category caps (sum = 100):
 *   Third-Party Trackers:  40
 *   Fingerprinting:        30
 *   Cookies:               20
 *   Consent:               10
 */
import {
  TRACKER_RULES,
  TRACKER_EXPLANATIONS,
  FINGERPRINT_RULES,
  FINGERPRINT_EXPLANATIONS,
  COOKIE_RULES,
  COOKIE_EXPLANATIONS,
  CONSENT_RULES,
  CONSENT_EXPLANATIONS,
} from './score_rules.js';
import { scoreToSeverity } from './severity.js';
import { log } from '../shared/logger.js';

/** Maps API names reported by fp_main.js to the keys used in FINGERPRINT_RULES */
const FP_API_KEYS = { Canvas: 'canvas', WebGL: 'webgl', AudioContext: 'audioContext' };

// ─── Sub-scorers ──────────────────────────────────────────────────────────────

/**
 * Score tracker records and produce explanations.
 * @param {Object[]} trackers
 * @param {number}   capOverride   — from user weight settings (0-100)
 * @returns {{ raw: number, explanations: Object[] }}
 */
function scoreTrackers(trackers, capOverride) {
  const cap = capOverride ?? TRACKER_RULES.cap;
  if (!trackers || trackers.length === 0) return { raw: 0, explanations: [] };

  const explanations = [];
  let raw = 0;

  for (const t of trackers) {
    const cat = (t.category ?? 'unknown').replace(/-/g, '_');
    const pts = TRACKER_RULES.points[cat] ?? TRACKER_RULES.points.unknown;
    const name = t.company || t.trackerName || t.domain || 'Unknown';
    raw += pts;
    explanations.push({
      category: 'trackers',
      rule: cat,
      label: name,
      domain: t.domain,
      points: pts,
      description: TRACKER_EXPLANATIONS[cat] ?? `Tracker (${cat}) +${pts}`,
    });
  }

  const capped = Math.min(raw, cap);
  const cappedOff = raw - capped;

  // If we hit the cap, annotate the last explanation
  if (cappedOff > 0) {
    explanations.push({
      category: 'trackers',
      rule: 'cap',
      label: 'Category cap reached',
      points: -cappedOff,
      description: `Tracker score capped at ${cap} (${cappedOff} pts removed)`,
    });
  }

  return { raw: capped, explanations };
}

/**
 * Score fingerprint signals and produce explanations.
 * @param {string[]|Object[]} signals — can be string names or {api, indicator, count} objects
 * @param {number} capOverride
 * @returns {{ raw: number, explanations: Object[] }}
 */
function scoreFingerprinting(signals, capOverride) {
  const cap = capOverride ?? FINGERPRINT_RULES.cap;
  if (!signals || signals.length === 0) return { raw: 0, explanations: [] };

  const explanations = [];
  let raw = 0;

  // Deduplicate signals by api name
  const seen = new Set();
  for (const sig of signals) {
    const apiName = typeof sig === 'string' ? sig : (sig.api ?? sig);
    if (seen.has(apiName)) continue;
    seen.add(apiName);

    const ruleKey = FP_API_KEYS[apiName] ?? apiName;
    const pts = FINGERPRINT_RULES.signals[ruleKey] ?? 0;
    if (pts === 0) continue;
    raw += pts;
    explanations.push({
      category: 'fingerprinting',
      rule: apiName,
      label: `${apiName} API`,
      points: pts,
      description: FINGERPRINT_EXPLANATIONS[ruleKey] ?? `${apiName} fingerprinting signal (+${pts})`,
    });
  }

  const capped = Math.min(raw, cap);
  const cappedOff = raw - capped;

  if (cappedOff > 0) {
    explanations.push({
      category: 'fingerprinting',
      rule: 'cap',
      label: 'Category cap reached',
      points: -cappedOff,
      description: `Fingerprinting score capped at ${cap} (${cappedOff} pts removed)`,
    });
  }

  return { raw: capped, explanations };
}

/**
 * Score cookie records and produce explanations.
 * @param {Object[]} cookies
 * @param {number}   capOverride
 * @returns {{ raw: number, explanations: Object[] }}
 */
function scoreCookies(cookies, capOverride) {
  const cap = capOverride ?? COOKIE_RULES.cap;
  if (!cookies || cookies.length === 0) return { raw: 0, explanations: [] };

  const explanations = [];
  let raw = 0;

  for (const c of cookies) {
    if (c.category === 'tracking') {
      raw += COOKIE_RULES.trackingCookiePoints;
      explanations.push({
        category: 'cookies',
        rule: 'tracking',
        label: c.name || 'Tracking cookie',
        domain: c.domain,
        points: COOKIE_RULES.trackingCookiePoints,
        description: COOKIE_EXPLANATIONS.tracking,
      });
    } else if (c.thirdParty) {
      raw += COOKIE_RULES.thirdPartyCookiePoints;
      explanations.push({
        category: 'cookies',
        rule: 'thirdParty',
        label: c.name || '3rd-party cookie',
        domain: c.domain,
        points: COOKIE_RULES.thirdPartyCookiePoints,
        description: COOKIE_EXPLANATIONS.thirdParty,
      });
    }
    if (!c.secure) {
      raw += COOKIE_RULES.missingSecurePoints;
      explanations.push({
        category: 'cookies',
        rule: 'noSecure',
        label: c.name || 'Cookie',
        domain: c.domain,
        points: COOKIE_RULES.missingSecurePoints,
        description: COOKIE_EXPLANATIONS.noSecure,
      });
    }
    if (!c.sameSite) {
      raw += COOKIE_RULES.missingSameSitePoints;
      explanations.push({
        category: 'cookies',
        rule: 'noSameSite',
        label: c.name || 'Cookie',
        domain: c.domain,
        points: COOKIE_RULES.missingSameSitePoints,
        description: COOKIE_EXPLANATIONS.noSameSite,
      });
    }
  }

  const capped = Math.min(raw, cap);
  const cappedOff = raw - capped;
  if (cappedOff > 0) {
    explanations.push({
      category: 'cookies',
      rule: 'cap',
      label: 'Category cap reached',
      points: -cappedOff,
      description: `Cookie score capped at ${cap} (${cappedOff} pts removed)`,
    });
  }

  return { raw: capped, explanations };
}

/**
 * Score consent events and produce explanations.
 * @param {Object[]} consentEvents
 * @param {number}   capOverride
 * @returns {{ raw: number, explanations: Object[] }}
 */
function scoreConsent(consentEvents, capOverride) {
  const cap = capOverride ?? CONSENT_RULES.cap;
  if (!consentEvents || consentEvents.length === 0) return { raw: 0, explanations: [] };

  const explanations = [];
  let raw = 0;

  for (const e of consentEvents) {
    if (e.isDarkPattern || (e.patterns && e.patterns.length > 0)) {
      const patterns = e.patterns || [{ type: 'unknown dark pattern' }];
      for (const p of patterns) {
        raw += CONSENT_RULES.darkPatternPoints;
        explanations.push({
          category: 'consent',
          rule: 'darkPattern',
          label: p.type || 'Dark pattern',
          points: CONSENT_RULES.darkPatternPoints,
          description: `${CONSENT_EXPLANATIONS.darkPattern} — ${p.reason || p.type || 'manipulative design'}`,
        });
      }
    }
    if (e.hasLegitimateOptOut) {
      raw += CONSENT_RULES.legitimateConsentBonus; // negative
      explanations.push({
        category: 'consent',
        rule: 'legitimateOptOut',
        label: 'Clear opt-out provided',
        points: CONSENT_RULES.legitimateConsentBonus,
        description: CONSENT_EXPLANATIONS.legitimateOptOut,
      });
    }
  }

  const capped = Math.max(0, Math.min(raw, cap));
  return { raw: capped, explanations };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main scoring function.
 *
 * Trusted sites are STILL scored — trust only suppresses alerts.
 *
 * @param {Object} signals
 * @param {Object[]}  signals.trackers
 * @param {string[]|Object[]} signals.fingerprintSignals
 * @param {Object[]}  signals.cookies
 * @param {Object[]}  signals.consentEvents
 * @param {boolean}   signals.isTrusted   — affects badge only, not score
 * @param {Object}    weightOverrides      — optional user weight settings
 *
 * @returns {{
 *   score: number,
 *   severity: string,
 *   isTrusted: boolean,
 *   breakdown: { trackers: number, fingerprinting: number, cookies: number, consent: number },
 *   explanations: Object[],
 * }}
 */
export function computeScore(signals, weightOverrides = {}) {
  const {
    trackers          = [],
    fingerprintSignals = [],
    cookies           = [],
    consentEvents     = [],
    isTrusted         = false,
  } = signals;

  // Use user-configured category caps (weights map to caps since they sum to 100)
  const capT  = weightOverrides.weightTrackers       ?? 40;
  const capFP = weightOverrides.weightFingerprinting ?? 30;
  const capC  = weightOverrides.weightCookies        ?? 20;
  const capCo = weightOverrides.weightConsent        ?? 10;

  const tResult  = scoreTrackers(trackers, capT);
  const fpResult = scoreFingerprinting(fingerprintSignals, capFP);
  const cResult  = scoreCookies(cookies, capC);
  const coResult = scoreConsent(consentEvents, capCo);

  const rawScore = tResult.raw + fpResult.raw + cResult.raw + coResult.raw;
  const score    = Math.max(0, Math.min(100, Math.round(rawScore)));
  const severity = scoreToSeverity(score);

  // Merge all explanations (filter out cap annotations for cleaner display)
  const explanations = [
    ...tResult.explanations,
    ...fpResult.explanations,
    ...cResult.explanations,
    ...coResult.explanations,
  ].filter(e => e.rule !== 'cap');

  log.debug('Score breakdown:', {
    trackerRaw: tResult.raw, fpRaw: fpResult.raw,
    cookieRaw: cResult.raw, consentRaw: coResult.raw,
    score, severity, isTrusted,
  });

  return {
    score,
    severity,
    isTrusted,
    breakdown: {
      trackers:       tResult.raw,
      fingerprinting: fpResult.raw,
      cookies:        cResult.raw,
      consent:        coResult.raw,
    },
    explanations,
  };
}

/**
 * Convenience: score a single visit record's associated data.
 * Accepts already-fetched arrays from repositories.
 */
export function scoreVisit(trackers, fingerprintRecord, cookies, consentEvents, isTrusted, settings) {
  const fingerprintSignals = fingerprintRecord?.signals ?? [];
  return computeScore(
    { trackers, fingerprintSignals, cookies, consentEvents, isTrusted },
    settings,
  );
}
