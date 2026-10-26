# Changelog

All notable changes to TrackerLens are documented here.

## [1.0.1] — 2026-10-12

### Fixed (found during end-to-end testing in Chrome)
- **Fingerprinting signals were dropped:** `bridge.js` required a `timestamps` array that `fp_main.js` never sends, so every Canvas/WebGL/AudioContext signal was filtered out. `timestamps` is now optional.
- **Fingerprinting scored 0 points:** `fp_main.js` reports `Canvas`, `WebGL` and `AudioContext`, but `FINGERPRINT_RULES.signals` uses `canvas`, `webgl` and `audioContext`. Added an API-name map in `score_engine.js`.
- **Cookies were never observed:** Chrome hides `Set-Cookie` response headers from `webRequest` unless `extraHeaders` is requested. Added `extraHeaders` to the `onCompleted` listener.
- **History always showed score 0:** observations are queued and only written on navigation, but the visit was rescored before that. `rescoreVisit()` now writes the queue first and runs again after 6 seconds.
- **Session-recording trackers scored as unknown:** category `session-recording` is normalised to the rule key `session_recording`.
- **Popup listed every fingerprint signal as "Unknown API Access":** the list read `f.type`, but signals carry `api` and `indicator`. The popup now shows, for example, "Canvas API Access — Text drawn and extracted (toDataURL)".
- **DEMO badge and Dev button always visible:** class rules with `display: flex` overrode the `hidden` attribute. Added `[hidden] { display: none !important; }` to `shared/design.css`.

### Added
- `tests/score_engine.test.js` — 16 checks for severity bands, category points and caps, fingerprint API names, cookies, consent and trusted sites. Run with `node --experimental-default-type=module tests/score_engine.test.js`.

## [1.0.0] — 2026-08-14

### 🎉 Initial Public Release

### Fixed — Critical
- **FP NaN bug:** `FINGERPRINT_RULES.maxFingerprintScore` was undefined in `fingerprint_detector.js`. This caused `NaN` to propagate through all fingerprinting record risk calculations. Fixed to use `FINGERPRINT_RULES.cap` (30) which is the correct exported constant.
- **Score of 0 = "Low Risk" bug:** `scoreToSeverity(0)` returned `SEVERITY.LOW` instead of `SEVERITY.NONE` because `0 < 21` is `true`. Fixed with an explicit `score === 0` guard returning `SEVERITY.NONE`.
- **Privacy: favicon leaked domains to Google:** The popup fetched favicons via `https://www.google.com/s2/favicons?domain=...`, sending every audited domain name to Google's servers. Removed and replaced with the extension's own bundled icon.
- **Privacy: self-hosted fonts:** Inter and JetBrains Mono fonts were previously loaded via Google Fonts CDN. They are now fully bundled within the extension (`fonts/`), eliminating all external network requests from the extension's UI.

### Fixed — High/Medium
- **FP record merge created duplicates:** `handleFpSignals` merged fingerprint records using `add()` (auto-increment ID), creating new records every time signals arrived instead of updating the existing record. Fixed to use `put()` with the preserved record `id`.
- **`startup()` duplicate initialization:** The service worker called `startup()` directly in module scope AND via `onInstalled`/`onStartup` event listeners, causing 2-3× initialization on extension install/browser restart, including duplicate alarm listener registrations. Fixed with a `_started` guard flag.
- **`registerRetentionCron` duplicate alarms:** `chrome.alarms.create()` was called without checking if the alarm already existed. Fixed to check via `chrome.alarms.get()` first.
- **MutationObserver throttle never updated:** `_lastMutationTime` in `page_observer.js` was initialized once and never updated inside the observer, making the 500ms throttle inactive after the first second. Fixed.

### Added
- `FingerprintsRepo.put()` method in repositories.js (required for the merge fix)
- `docs/` directory:
  - `docs/permissions.md` — per-permission technical justification
  - `docs/chrome-web-store-compliance.md` — CWS policy compliance checklist
  - `docs/detection-limitations.md` — precise scope of what is and isn't detected
  - `docs/browser-compatibility.md` — browser support matrix

### Changed
- Version: `0.5.0` → `1.0.0`
- PRIVACY.md: Updated to confirm the extension is 100% self-contained with no external requests (fonts and favicons are now local)
- `web_accessible_resources` split into two entries for clarity (HTML pages vs. data/icons)

### Not Changed
- Detection algorithms (tracker domain matching, FP API hooks, cookie header parsing, consent DOM scanning) are unchanged from RC
- Scoring rules and category caps are unchanged
- All data remains local (IndexedDB only)
- Manifest V3, no remote code, no eval, no telemetry

---

## [0.5.0] — 2026-08-14

Release Candidate. All Phase 1–5 features implemented:
- Tracker detection via `webRequest` + domain list
- Fingerprinting detection via MAIN-world content script hooks
- Cookie audit via response header parsing
- Consent banner + dark pattern detection
- 5-tier risk scoring (0–100) with per-rule explanation
- Weekly report, daily stats, history view
- JSON/CSV export
- Trusted sites
- IndexedDB persistence with schema migration
- MV3-compliant service worker with session state recovery
