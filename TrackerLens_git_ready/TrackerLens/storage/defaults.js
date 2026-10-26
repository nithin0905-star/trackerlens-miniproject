/**
 * TrackerLens — Default Settings (Phase 4)
 * Returned when a key has never been set.
 * All four weights must sum to 100.
 */
export const DEFAULT_SETTINGS = {
  // Scoring weights (must sum to 100)
  scoringEnabled:       true,
  weightTrackers:       40,
  weightFingerprinting: 30,
  weightCookies:        20,
  weightConsent:        10,

  // Display
  showRiskBadge:     true,
  showTrackerCount:  true,
  showFpCount:       true,
  showCookieCount:   true,
  showExplanations:  true,

  // Data
  retentionDays:    30,
  autoDeleteOld:    true,

  // Tracker list
  trackerListEnabled: true,

  // Trusted sites — suppress badge alerts but still audit
  trustedSuppressAlerts: true,

  // Notifications
  notifyHighRisk: false,

  // Dev
  devMode: true,
};
