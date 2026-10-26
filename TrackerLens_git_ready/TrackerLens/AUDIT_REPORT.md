# TrackerLens — Full Project Audit Report
**Generated:** 2026-08-14  
**Auditor:** Release Engineer  
**Version under audit:** 0.5.0 RC

---

## A. Architecture Findings

- **Service Worker (MV3):** Correctly uses ES module service worker. Event-driven, restarts gracefully using `chrome.storage.session` to persist `tabState`. ✅
- **Message Router:** Central, validation-based routing is excellent security design. ✅
- **Detection Pipeline:** Clear separation: `fp_main.js` (MAIN world) → `bridge.js` (ISOLATED, relay) → `message_router.js` (SW). ✅
- **Scoring Engine:** Transparent, rule-based, capped per category. Each point traces to a rule. ✅
- **Storage:** Well-modularized IndexedDB repositories. ✅
- **Build:** `build.js` correctly excludes demo/mock data and test files from `dist/`. ✅
- **External Fonts (Google Fonts CDN):** ALL CSS files import fonts from `fonts.googleapis.com` via `@import url(...)`. This is an **external network request made by the extension's own UI pages**. ✅ (not executable JS, but disclosed)
- **Favicon Service:** `popup.js` uses `https://www.google.com/s2/favicons?...` — sends domain name to Google servers. This is a PRIVACY issue.

---

## B. Bugs Found

### B1 — CRITICAL: `FINGERPRINT_RULES.maxFingerprintScore` is undefined
- **File:** `detection/fingerprint_detector.js` lines 52–53
- **Bug:** `FINGERPRINT_RULES.maxFingerprintScore` is never defined in `score_rules.js`. The exported `FINGERPRINT_RULES` object has no `maxFingerprintScore` property. This evaluates to `undefined`, causing `Math.min(rawScore, undefined)` → `NaN`, and `rawScore / undefined` → `NaN`. The resulting `riskLevel` from `scoreToSeverity(NaN)` will always return `SEVERITY.LOW` (since `NaN < anything` is false, falling through all conditionals). This means fingerprinting risk is always incorrectly reported as "Low" at the record storage level. The **score engine itself is correct** — it ignores the stored `riskLevel` and re-evaluates from signals — but the per-record risk level and the score stored inside the fingerprint record are wrong.
- **Severity:** HIGH

### B2 — HIGH: `scoreToSeverity` treats score=0 as `SEVERITY.LOW` (not `SEVERITY.NONE`)
- **File:** `scoring/severity.js` lines 15–21
- **Bug:** When `score = 0`, `scoreToSeverity` returns `SEVERITY.LOW` because `0 < 21` is true. The `SEVERITY.NONE` level is never returned by this function. The UI has a `RISK.none` configuration but the engine can never produce it, causing the badge to always show "Low Risk" for pages with zero detected signals (e.g., simple sites).
- **Fix:** Add an explicit `if (score === 0) return SEVERITY.NONE;` guard.
- **Severity:** HIGH

### B3 — HIGH: Favicon leaks domain name to Google
- **File:** `popup/popup.js` line 348
- **Bug:** `https://www.google.com/s2/favicons?sz=16&domain=${domain}` sends every audited domain name to Google's servers. This contradicts "zero data leaves the device."
- **Fix:** Use a bundled fallback icon, or show a generic placeholder and document this as a disclosed feature.
- **Severity:** HIGH (Privacy)

### B4 — MEDIUM: `handleFpSignals` merges fingerprint records incorrectly
- **File:** `background/message_router.js` lines 450–461
- **Bug:** When merging existing fingerprint records, the code does `await FingerprintsRepo.add({ ...fpRecord, ...merged })`. Since `add()` does not specify a key, it creates a NEW record rather than updating the existing one. The old record is never deleted, resulting in duplicate fingerprint records for the same visit.
- **Fix:** Use `FingerprintsRepo.put()` (which uses `put` not `add`) with the existing record's `id`.
- **Severity:** MEDIUM

### B5 — MEDIUM: `recoverTabStates` creates new visit records on every startup
- **File:** `background/service_worker.js` lines 71–99
- **Bug:** When the service worker restarts and tabs are already open, `recoverTabStates()` creates new blank visit records for each open tab, even if those tabs were already being tracked in the previous session (their state was restored from `chrome.storage.session` via `loadStateFromSession()`). The `if (getTabState(tab.id)) continue;` guard only prevents duplicate state entries but not duplicate DB records, since `loadStateFromSession()` restores the in-memory state but `recoverTabStates` creates new DB entries for tabs that already had restored state.
- **Severity:** MEDIUM

### B6 — LOW: `build.js` excludes `.md` files but `data/tracker_domains.json` is a data file correctly included
- **File:** `build.js`
- Note: The exclusion of `.md` files is correct. JSON files in `data/` are included. No bug here.

### B7 — LOW: `page_observer.js` — `_lastMutationTime` throttle logic is incorrect
- **File:** `content/page_observer.js` line 169
- **Bug:** The comparison `if (now - _lastMutationTime < 500) return;` drops mutations that occur too fast, but `_lastMutationTime` is only updated at initialization (`Date.now()`), never inside the observer callback. So the 500ms cooldown only triggers for the very first second after page load.
- **Fix:** Update `_lastMutationTime = now;` inside the observer when a mutation passes the throttle.
- **Severity:** LOW (Performance)

---

## C. Missing Features

- **C1 — Dev Panel in Production Build:** The `⚙ Dev` button in the popup nav is visible to end users. It should be hidden unless `DEV_MODE = true`. Even though the panel itself is `hidden`, the button is visible and confusing.
- **C2 — No `options_page` `<all_urls>` notice:** The `web_accessible_resources` allows `<all_urls>` to access extension resources. This is broader than strictly required.
- **C3 — `hasLegitimateOptOut` field never sent from `page_observer.js`:** The consent detector checks for `hasLegitimateOptOut` in signals but this field is never set or dispatched from `page_observer.js`. It's dead code on the receiver side.

---

## D. Security Issues

- **D1 — MEDIUM: Favicons disclose browsed domains to Google** (see B3)
- **D2 — LOW: `data/tracker_domains.json` in `web_accessible_resources`:** This makes the tracker DB readable by any webpage. Not a direct security risk (it's just a list of tracker domains), but it's unnecessary exposure.
- **D3 — RESOLVED: No `eval()`, no `new Function()`, no remote JS.** ✅

---

## E. Privacy Issues

- **E1 — HIGH: Favicon service (Google s2/favicons) discloses domain** (see B3)
- **E2 — MEDIUM: Google Fonts CDN requests:** Every UI page (`popup.html`, `options.html`, etc.) loads fonts from `fonts.googleapis.com`. These are CSS-only requests (no JS execution), but the requests do disclose that the extension's UI is open to Google's CDN. The extension should bundle fonts locally or accept using system fonts.
- **E3 — RESOLVED: No external analytics, no telemetry, no WebSocket.** ✅

---

## F. Manifest/Permission Issues

- **F1 — LOW: `web_accessible_resources` too broad:** Resources like `data/*` and `report/*` accessible from `<all_urls>`. Should scope to the extension's own pages.
- **F2 — RESOLVED:** `webNavigation` was correctly removed. ✅
- **F3 — OK:** `tabs`, `webRequest`, `alarms`, `<all_urls>` host permission are all justified and minimal. ✅

---

## G. MV3 Issues

- **G1 — LOW: `startup()` called immediately AND via `onInstalled`/`onStartup`:** Line 317 calls `startup()` directly in the module scope. This runs on every service worker activation (which happens frequently in MV3). The `onInstalled` and `onStartup` listeners also call `startup()`. This causes `startup()` to be called twice on install and on browser startup. While most operations are idempotent, the `registerRetentionCron` creates duplicate alarm listeners.
- **Fix:** Remove the direct `startup()` call on line 317. The `onInstalled` and `onStartup` listeners are sufficient. For dev reloads, rely on `onInstalled`.
- **Severity:** MEDIUM

---

## H. Browser Compatibility

- Chrome Stable: Primary target. All APIs used (`chrome.storage.session`, `chrome.alarms`, `chrome.webRequest`, `webRequest.responseHeaders`) are available.
- Edge: Compatible (Chromium-based).
- Brave: Compatible (Chromium-based).
- Firefox: **NOT COMPATIBLE.** Firefox requires `browser.*` namespace, not `chrome.*`, for many APIs. No polyfill is present. Do not claim Firefox compatibility.

---

## I. UX/UI Problems

- **I1 — Dev Panel button visible in production** (see C1)
- **I2 — Score of 0 shows "Low Risk"** (see B2): On clean pages the badge incorrectly shows "Low Risk" instead of "No Risk Detected."
- **I3 — No fallback for favicon** (see B3): If `onerror` fires, the favicon `src` is set to `''`, showing a broken image icon in some browsers.
- **I4 — `scoreHeading` h1 is hidden:** `<h1 class="score-heading" id="scoreHeading" style="display:none">` — hiding the page's `<h1>` is an accessibility concern. Use `aria-label` on the section instead.

---

## J. Performance Problems

- **J1 — `handleGetHistory` in message router fires N parallel DB reads:** For each visit in history, it fires 3 parallel IndexedDB queries. For 100 visits that's 300 transactions. This is acceptable for ≤100 visits but could lag for large datasets.
- **J2 — Session sync debounce (1000ms) fires on every request:** `requestSync()` is called inside `handleRequestCompleted()` for every web request. The 1000ms debounce is reasonable. ✅

---

## K. Accessibility Problems

- **K1 — Score of 0 read as "Low Risk" by screen readers** (see B2)
- **K2 — `score-heading` h1 hidden:** Affects screen readers (see I4)
- **K3 — Emoji used as functional icons:** Emojis like `🛡`, `🎯` are used as semantic indicators. These are correctly marked `aria-hidden="true"` where decorative. ✅

---

## L. Chrome Web Store Risks

- **L1 — Favicon request to Google:** Must be disclosed in privacy policy. Could be flagged during review.
- **L2 — Google Fonts CDN:** Must be disclosed. Not executable JS so typically acceptable, but requires disclosure.
- **L3 — `<all_urls>` host permission:** Fully justified for content script injection, but reviewers will scrutinize. The permission justification doc must be thorough.
- **L4 — Dev Panel in production:** May confuse reviewers. Hide it.

---

## M. Documentation Gaps

- **M1 — No `docs/` directory exists.** All documentation is at root level only.
- **M2 — `README.md` is very minimal** (1111 bytes). Needs installation instructions, feature list, and screenshot guidance.
- **M3 — `CHANGELOG.md` is minimal** (1046 bytes).

---

## N. Release Blockers

| # | Issue | Severity | Status |
|---|---|---|---|
| N1 | `maxFingerprintScore` undefined → NaN in FP record | HIGH | **MUST FIX** |
| N2 | `scoreToSeverity(0)` returns LOW not NONE | HIGH | **MUST FIX** |
| N3 | Favicon service leaks domain to Google | HIGH | **MUST FIX** |
| N4 | `startup()` called 2-3× on service worker activation | MEDIUM | **MUST FIX** |
| N5 | FP record merge creates duplicates | MEDIUM | **MUST FIX** |
| N6 | Dev Panel button visible in production | MEDIUM | **MUST FIX** |
| N7 | `_lastMutationTime` never updated in observer | LOW | **SHOULD FIX** |

---

## O. Non-Blocking Improvements

- Bundle Inter font locally instead of Google Fonts CDN
- Scope `web_accessible_resources` to extension pages only
- Add `docs/` directory with architecture, testing, compatibility docs
- Remove `hasLegitimateOptOut` dead code from `page_observer.js`
- `recoverTabStates` deduplication improvement
