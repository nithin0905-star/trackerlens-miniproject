/**
 * TrackerLens — Score Rules (Phase 4)
 * Flat per-rule points with hard category caps.
 * All caps sum to 100 so no extra normalisation is needed.
 *
 * Rule points and caps are defined here so they can be
 * overridden by user-configurable weights in settings.
 */

// ─── Third-Party Trackers (cap: 40) ──────────────────────────────────────────

export const TRACKER_RULES = {
  /** Points awarded per unique tracker domain, by category */
  points: {
    analytics:        4,
    advertising:      7,
    social:           6,
    session_recording:8,
    fingerprinting:   8,
    cdn:              1,
    unknown:          3,
  },
  /** Hard cap for this category */
  cap: 40,
};

/** Human-readable explanation for each tracker category */
export const TRACKER_EXPLANATIONS = {
  analytics:        'Analytics script: likely records site behaviour (+4)',
  advertising:      'Advertising script: possible ad targeting detected (+7)',
  social:           'Social widget: may link your identity across sites (+6)',
  session_recording:'Session recording: possible mouse/keyboard activity capture (+8)',
  fingerprinting:   'Fingerprinting script: possible cookie-less identification (+8)',
  cdn:              'Content delivery network: low privacy risk (+1)',
  unknown:          'Unknown script category (+3)',
};

// ─── Fingerprinting (cap: 30) ─────────────────────────────────────────────────

export const FINGERPRINT_RULES = {
  /** Points per fingerprinting API signal detected */
  signals: {
    canvas:              10,
    audioContext:         8,
    webgl:                7,
    fonts:                6,
    webRTC:               5,
    battery:              4,
    navigatorPlugins:     4,
    hardwareConcurrency:  3,
    deviceMemory:         3,
    screenResolution:     3,
    timezone:             3,
    doNotTrack:           2,
    navigatorVendor:      2,
  },
  /** Hard cap for fingerprinting category */
  cap: 30,
};

/** Human-readable explanations per fingerprint signal */
export const FINGERPRINT_EXPLANATIONS = {
  canvas:             'Canvas indicator: possible GPU identification (+10)',
  audioContext:       'AudioContext indicator: possible hardware fingerprinting (+8)',
  webgl:              'WebGL indicator: possible GPU fingerprinting (+7)',
  fonts:              'Font enumeration: likely listing installed fonts (+6)',
  webRTC:             'WebRTC usage: could reveal real IP address (+5)',
  battery:            'Battery API: may track charge level (+4)',
  navigatorPlugins:   'Plugin enumeration: likely listing browser plugins (+4)',
  hardwareConcurrency:'Hardware concurrency: reading CPU core count (+3)',
  deviceMemory:       'Device memory: reading available RAM (+3)',
  screenResolution:   'Screen resolution: reading display dimensions (+3)',
  timezone:           'Timezone detection: reading local timezone (+3)',
  doNotTrack:         'Do Not Track probe: checking DNT setting (+2)',
  navigatorVendor:    'Navigator vendor: reading browser vendor string (+2)',
};

// ─── Cookies (cap: 20) ────────────────────────────────────────────────────────

export const COOKIE_RULES = {
  trackingCookiePoints:   4,   // per tracking cookie
  thirdPartyCookiePoints: 3,   // per 3rd-party cookie (non-tracking)
  missingSecurePoints:    2,   // per cookie lacking Secure flag
  missingSameSitePoints:  2,   // per cookie lacking SameSite attribute
  cap:                   20,
};

export const COOKIE_EXPLANATIONS = {
  tracking:    'Persistent cookie: potential cross-site tracking identifier (+4)',
  thirdParty:  'Third-party cookie: set by a domain other than the current site (+3)',
  noSecure:    'Cookie missing Secure flag: could be sent over unencrypted connections (+2)',
  noSameSite:  'Cookie missing SameSite attribute: potential cross-site exposure (+2)',
};

// ─── Consent (cap: 10) ───────────────────────────────────────────────────────

export const CONSENT_RULES = {
  darkPatternPoints:       6,   // per dark pattern detected
  legitimateConsentBonus: -3,   // deduction for clear, fair opt-out
  cap:                    10,
};

export const CONSENT_EXPLANATIONS = {
  darkPattern:      'Consent UI indicator: possible dark pattern detected (+6)',
  legitimateOptOut: 'Consent indicator: site provides a potential way to refuse (-3)',
};

// ─── Trusted Site ─────────────────────────────────────────────────────────────

/**
 * Trusted sites are STILL scored and audited.
 * Trust only suppresses badge alerts in the UI.
 * This constant is kept for documentation purposes.
 */
export const TRUSTED_SITE_SUPPRESSES_BADGE = true;

// ─── Max possible raw score (= sum of caps) ───────────────────────────────────

export const MAX_SCORE = 100; // caps: 40 + 30 + 20 + 10 = 100
