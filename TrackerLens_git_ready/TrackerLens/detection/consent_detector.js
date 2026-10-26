/**
 * TrackerLens — Consent Detector (Service-Worker Side)
 * Evaluates consent-related signals sent from the page_observer content script.
 */
import { log } from '../shared/logger.js';

/**
 * Dark-pattern signal types that indicate manipulative consent UX.
 */
export const DARK_PATTERNS = {
  PRE_TICKED_OPT_IN:      'preTicked',       // Checkboxes pre-selected for tracking
  HIDDEN_REJECT_BUTTON:    'hiddenReject',    // Reject/decline buried or missing
  CONFUSING_LANGUAGE:      'confusingLang',   // "OK" means consent, "cancel" means something else
  CONSENT_WALL:            'consentWall',     // Content gated behind consent
  FORCED_INTERACTION:      'forcedAction',    // Must interact before accessing page
};

/**
 * Evaluates consent signals from the page observer.
 * @param {Object} signals
 * @param {boolean} signals.hasBanner
 * @param {boolean} signals.hasRejectButton
 * @param {boolean} signals.hasAcceptButton
 * @param {boolean} signals.preTickedOptIn
 * @param {boolean} signals.hiddenReject
 * @param {boolean} signals.consentWall
 * @param {string}  domain
 * @param {number}  visitId
 * @returns {Object}  consent event record
 */
export function evaluateConsentSignals(signals, domain, visitId) {
  const { detected = false, patterns = [], hasLegitimateOptOut = false } = signals;

  const isDarkPattern = patterns.length > 0;
  const legitimateOptOut = hasLegitimateOptOut || (detected && !isDarkPattern && Boolean(signals.hasRejectButton));
  
  // Flatten patterns for DB
  const darkPatterns = patterns.map(p => p.type);

  log.debug('Consent signals:', { domain, detected, patterns, isDarkPattern, hasLegitimateOptOut: legitimateOptOut });

  return {
    domain,
    visitId: visitId ?? 0,
    hasBanner: detected,
    hasLegitimateOptOut: legitimateOptOut,
    darkPatterns,
    patterns, // store full objects (type, reason, confidence)
    isDarkPattern,
    timestamp: Date.now(),
  };
}
