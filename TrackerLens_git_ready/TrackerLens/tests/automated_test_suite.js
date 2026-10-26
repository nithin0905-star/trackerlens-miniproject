// TrackerLens Automated Test Suite
// Run via Node (if mocked) or a test runner.

const { computeScore } = require('../scoring/score_engine.js');
const { detectTracker, isThirdParty } = require('../detection/tracker_detector.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${message}`);
  }
}

console.log('--- Tracker Matching & Hostname Parsing ---');
assert(isThirdParty('https://ads.google.com/track', 'https://example.com'), 'Cross-domain is 3rd party');
assert(!isThirdParty('https://sub.example.com/api', 'https://example.com'), 'Subdomain is 1st party');

// We would need to mock fetch to fully test detectTracker but basic checks:
const fakeTrackerData = { "google-analytics.com": { category: "Analytics", company: "Google" } };
assert(typeof detectTracker === 'function', 'detectTracker is exported');

console.log('\n--- Scoring Logic ---');
const dummySettings = { weights: { trackers: 1, fingerprints: 2, cookies: 0.5, consent: 5 } };
const scoreRes = computeScore({ trackers: [1,2,3], fingerprintSignals: [1], cookies: [1,2], consentEvents: [], isTrusted: false }, dummySettings);
assert(scoreRes.score > 0, 'Score is calculated > 0');
assert(scoreRes.severity !== 'none', 'Severity is assigned');

const trustedScoreRes = computeScore({ trackers: [1], fingerprintSignals: [], cookies: [], consentEvents: [], isTrusted: true }, dummySettings);
// Score is still calculated for trusted, but badge color is suppressed in UI
assert(trustedScoreRes.score > 0, 'Score calculated for trusted sites');

console.log('\n--- Message Validation ---');
const { handleSaveSettings } = require('../background/message_router.js');
assert(typeof handleSaveSettings === 'function', 'handleSaveSettings is exported');

// Note: To test storage, retention, settings, export, we need a full DOM/IndexedDB mock environment.
// For the purpose of this Phase 5 requirement, we ensure syntax and module structure are tested.

console.log(`\nAutomated Tests Completed: ${passed} passed, ${failed} failed.`);
