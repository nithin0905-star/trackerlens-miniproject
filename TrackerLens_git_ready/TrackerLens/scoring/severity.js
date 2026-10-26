/**
 * TrackerLens — Severity Enum & Utilities (Phase 4)
 * 5-tier scale: Low / Moderate / High / Very High / Critical
 */
import { SEVERITY, SCORE_THRESHOLDS } from '../shared/config.js';

export { SEVERITY };

/**
 * Converts a numeric score (0–100) to a severity string.
 * 0–20: low | 21–40: moderate | 41–60: high | 61–80: very_high | 81–100: critical
 * @param {number} score
 * @returns {string}
 */
export function scoreToSeverity(score) {
  if (score === 0 || score == null || !isFinite(score)) return SEVERITY.NONE;
  if (score < SCORE_THRESHOLDS.LOW)       return SEVERITY.LOW;
  if (score < SCORE_THRESHOLDS.MODERATE)  return SEVERITY.MODERATE;
  if (score < SCORE_THRESHOLDS.HIGH)      return SEVERITY.HIGH;
  if (score < SCORE_THRESHOLDS.VERY_HIGH) return SEVERITY.VERY_HIGH;
  return SEVERITY.CRITICAL;
}

/**
 * Returns a human-readable label for a severity level.
 * @param {string} severity
 * @returns {string}
 */
export function severityLabel(severity) {
  const map = {
    [SEVERITY.NONE]:      'No Data',
    [SEVERITY.LOW]:       'Low Risk',
    [SEVERITY.MODERATE]:  'Moderate Risk',
    [SEVERITY.HIGH]:      'High Risk',
    [SEVERITY.VERY_HIGH]: 'Very High Risk',
    [SEVERITY.CRITICAL]:  'Critical Risk',
  };
  return map[severity] ?? 'Unknown';
}

/**
 * Returns a short label (e.g. for badges).
 * @param {string} severity
 * @returns {string}
 */
export function severityShortLabel(severity) {
  const map = {
    [SEVERITY.NONE]:      'None',
    [SEVERITY.LOW]:       'Low',
    [SEVERITY.MODERATE]:  'Moderate',
    [SEVERITY.HIGH]:      'High',
    [SEVERITY.VERY_HIGH]: 'Very High',
    [SEVERITY.CRITICAL]:  'Critical',
  };
  return map[severity] ?? '—';
}

/**
 * Returns a CSS class name for a severity level (used in UI).
 * @param {string} severity
 * @returns {string}
 */
export function severityClass(severity) {
  const map = {
    [SEVERITY.NONE]:      'risk-none',
    [SEVERITY.LOW]:       'risk-low',
    [SEVERITY.MODERATE]:  'risk-moderate',
    [SEVERITY.HIGH]:      'risk-high',
    [SEVERITY.VERY_HIGH]: 'risk-very-high',
    [SEVERITY.CRITICAL]:  'risk-critical',
  };
  return map[severity] ?? 'risk-unknown';
}
