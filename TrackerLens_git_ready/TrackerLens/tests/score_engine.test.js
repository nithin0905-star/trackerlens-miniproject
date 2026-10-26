import { computeScore } from '../scoring/score_engine.js';
import { scoreToSeverity } from '../scoring/severity.js';
import { classifyCookie } from '../detection/cookie_detector.js';

let passed = 0;
let failed = 0;
function assertEqual(actual, expected, name) {
  if (actual === expected) { console.log(`✅ PASS: ${name}`); passed++; }
  else { console.error(`❌ FAIL: ${name} (Expected: "${expected}", Got: "${actual}")`); failed++; }
}

console.log('--- Running TrackerLens Scoring Tests ---');

// Severity bands
assertEqual(scoreToSeverity(0), 'none', 'scoreToSeverity: 0 is "none", not "low"');
assertEqual(scoreToSeverity(15), 'low', 'scoreToSeverity: 15 is low');
assertEqual(scoreToSeverity(35), 'moderate', 'scoreToSeverity: 35 is moderate');
assertEqual(scoreToSeverity(55), 'high', 'scoreToSeverity: 55 is high');
assertEqual(scoreToSeverity(75), 'very_high', 'scoreToSeverity: 75 is very high');
assertEqual(scoreToSeverity(95), 'critical', 'scoreToSeverity: 95 is critical');

// Empty page
assertEqual(computeScore({}).score, 0, 'computeScore: no evidence gives 0');

// Tracker points and cap
const trackers = [{ category: 'analytics' }, { category: 'advertising' }, { category: 'session-recording' }];
assertEqual(computeScore({ trackers }).breakdown.trackers, 19, 'Trackers: 4 + 7 + 8 (hyphenated category) = 19');
const many = Array.from({ length: 10 }, () => ({ category: 'advertising' }));
assertEqual(computeScore({ trackers: many }).breakdown.trackers, 40, 'Trackers: capped at 40');

// Fingerprinting API names as sent by fp_main.js
const fp = [{ api: 'Canvas' }, { api: 'WebGL' }, { api: 'AudioContext' }, { api: 'Canvas' }];
assertEqual(computeScore({ fingerprintSignals: fp }).breakdown.fingerprinting, 25, 'Fingerprinting: Canvas 10 + WebGL 7 + Audio 8, duplicates ignored');

// Cookies
const cookies = [{ category: 'tracking', secure: false, sameSite: null }];
assertEqual(computeScore({ cookies }).breakdown.cookies, 8, 'Cookies: tracking 4 + no Secure 2 + no SameSite 2 = 8');
assertEqual(classifyCookie('_ga', true, false, 400), 'tracking', 'classifyCookie: _ga is tracking');
assertEqual(classifyCookie('theme', false, true, 0), 'functional', 'classifyCookie: first-party session cookie is functional');

// Consent
const consentEvents = [{ patterns: [{ type: 'no_reject' }, { type: 'prechecked_consent' }] }];
assertEqual(computeScore({ consentEvents }).breakdown.consent, 10, 'Consent: two dark patterns capped at 10');

// Trusted sites are still scored
assertEqual(computeScore({ trackers, isTrusted: true }).score, 19, 'Trusted site keeps its score');

// Custom weights act as category caps
assertEqual(computeScore({ trackers: many }, { weightTrackers: 20 }).breakdown.trackers, 20, 'Custom tracker weight 20 caps trackers at 20');

console.log(`\nTests Complete: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) process.exit(1);
