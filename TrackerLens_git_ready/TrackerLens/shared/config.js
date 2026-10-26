/**
 * TrackerLens — Shared Configuration
 * Single source of truth for feature flags and constants.
 * Importable by both service worker modules and popup/options scripts.
 */

/** @type {boolean} Set to false before shipping to production */
export const DEV_MODE = false;

export const DB_NAME    = 'trackerLensDB';
export const DB_VERSION = 3;  // bumped for Phase 5: schema migration placeholder

export const APP_VERSION = '1.0.1';

/** Extension-internal message types */
export const MSG = {
  // Popup → SW
  GET_TAB_REPORT:       'GET_TAB_REPORT',
  GET_SETTINGS:         'GET_SETTINGS',
  SAVE_SETTINGS:        'SAVE_SETTINGS',
  GET_HISTORY:          'GET_HISTORY',
  GET_DAILY_STATS:      'GET_DAILY_STATS',
  GET_WEEKLY_SUMMARY:   'GET_WEEKLY_SUMMARY',
  RESET_DATA:           'RESET_DATA',
  EXPORT_DATA:          'EXPORT_DATA',
  EXPORT_CSV:           'EXPORT_CSV',
  LOAD_DEMO:            'LOAD_DEMO',
  TOGGLE_TRUSTED:       'TOGGLE_TRUSTED',
  GET_TRUSTED_SITES:    'GET_TRUSTED_SITES',
  GET_SCORE_EXPLANATION:'GET_SCORE_EXPLANATION',

  // SW → Popup (async push)
  TAB_UPDATED:          'TAB_UPDATED',

  // Content → SW
  FP_SIGNALS:           'FP_SIGNALS',
  PAGE_SIGNALS:         'PAGE_SIGNALS',

  // Generic
  PING:                 'PING',
  PONG:                 'PONG',
  ERROR:                'ERROR',
};

/** Risk severity levels — 5-tier per Phase 4 spec */
export const SEVERITY = {
  NONE:      'none',
  LOW:       'low',
  MODERATE:  'moderate',
  HIGH:      'high',
  VERY_HIGH: 'very_high',
  CRITICAL:  'critical',
};

/**
 * Score thresholds → severity
 * 0–20: Low  | 21–40: Moderate | 41–60: High | 61–80: Very High | 81–100: Critical
 */
export const SCORE_THRESHOLDS = {
  LOW:       21,   // 0–20  → low
  MODERATE:  41,   // 21–40 → moderate
  HIGH:      61,   // 41–60 → high
  VERY_HIGH: 81,   // 61–80 → very_high
  CRITICAL:  101,  // 81–100 → critical
};
