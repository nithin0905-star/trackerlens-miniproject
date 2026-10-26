/**
 * TrackerLens — Fingerprint Detector (Service-Worker Side)
 * Receives signals sent by the in-page fp_observer.js content script,
 * evaluates their severity, and prepares storage records.
 */
import { log } from '../shared/logger.js';
import { FINGERPRINT_RULES } from '../scoring/score_rules.js';
import { scoreToSeverity } from '../scoring/severity.js';

/**
 * Signal risk weights (mirrors score_rules.js for reference).
 * Signals above this threshold are flagged as high-risk individually.
 */
const HIGH_RISK_SIGNAL_THRESHOLD = 8;

/**
 * Evaluates an array of fingerprint signals and returns a structured report.
 *
 * @param {string[]} signals       — signal names (e.g. ['canvas', 'webgl'])
 * @param {string}   domain
 * @param {number}   visitId
 * @returns {{
 *   domain: string,
 *   visitId: number,
 *   signals: Object[],
 *   signalCount: number,
 *   highRiskSignals: string[],
 *   rawScore: number,
 *   riskLevel: string,
 *   timestamp: number
 * }}
 */
export function evaluateFingerprintSignals(signals, domain, visitId) {
  let rawScore = 0;
  const highRiskSignals = [];
  const processedSignals = [];

  for (const sig of signals) {
    // Add point mapping based on confidence
    let points = 1;
    if (sig.confidence === 'medium') points = 5;
    if (sig.confidence === 'high') points = 10;
    
    rawScore += points;
    if (points >= HIGH_RISK_SIGNAL_THRESHOLD) {
      highRiskSignals.push(sig.api);
    }
    
    processedSignals.push(sig);
  }

  // Cap the raw score at the fingerprinting category cap (30 pts)
  rawScore = Math.min(rawScore, FINGERPRINT_RULES.cap);
  // Normalize to 0–100 for per-record risk level storage
  const normalized = FINGERPRINT_RULES.cap > 0 ? (rawScore / FINGERPRINT_RULES.cap) * 100 : 0;
  const riskLevel  = rawScore === 0 ? 'none' : scoreToSeverity(Math.round(normalized));

  log.debug('FP signals evaluated:', { domain, signals: processedSignals, rawScore, riskLevel });

  return {
    domain,
    visitId: visitId ?? 0,
    signals:         processedSignals,
    signalCount:     processedSignals.length,
    highRiskSignals,
    rawScore,
    riskLevel,
    timestamp: Date.now(),
  };
}

/**
 * Returns a human-readable explanation for a given signal name.
 * @param {string} signal
 * @returns {string}
 */
export function signalExplanation(signal) {
  const descriptions = {
    canvas:              'Canvas fingerprinting — renders off-screen graphics to create a unique device signature.',
    webgl:               'WebGL fingerprinting — probes GPU characteristics to identify your hardware.',
    audioContext:        'Audio fingerprinting — measures AudioContext processing quirks unique to your device.',
    navigatorVendor:     'Reads browser vendor string — used in combination with other signals.',
    navigatorPlugins:    'Reads installed browser plugins — a common fingerprinting vector.',
    screenResolution:    'Reads screen resolution and color depth.',
    timezone:            'Reads your local timezone — used to narrow geographic location.',
    fonts:               'Font enumeration — detects which fonts are installed on your device.',
    battery:             'Battery API — reads battery level and charging state for fingerprinting.',
    hardwareConcurrency: 'Reads CPU core count — used to fingerprint hardware configuration.',
    deviceMemory:        'Reads device RAM amount — used to fingerprint hardware configuration.',
    webRTC:              'WebRTC IP leak — may reveal your real IP address even through a VPN.',
    doNotTrack:          'Reads Do Not Track setting — ironically used to fingerprint your browser.',
  };
  return descriptions[signal] ?? `${signal} — privacy-sensitive API access detected.`;
}
