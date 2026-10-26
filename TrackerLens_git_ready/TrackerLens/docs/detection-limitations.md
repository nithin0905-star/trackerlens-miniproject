# TrackerLens — Detection Limitations

> **Important:** TrackerLens is a privacy *auditing* and *educational* tool. It detects *indicators* of privacy-relevant behaviors. It does not block tracking, and its detections have inherent limitations.

## Tracker Detection

**What it does:**
- Matches the hostname of outbound network requests against a curated list of ~100 known tracker domains.
- Uses suffix matching (e.g., `sub.google-analytics.com` matches `google-analytics.com`).
- Records each unique tracker domain once per visit (deduplication).

**Limitations:**
- **CNAME cloaking:** If a tracker disguises itself as a first-party subdomain via DNS CNAME (e.g., `metrics.example.com` → `google-analytics.com`), TrackerLens cannot detect this — Chrome's `webRequest` API only exposes the requested URL hostname, not the resolved IP.
- **Tracker list coverage:** Only trackers present in the bundled `tracker_domains.json` are detected. New or obscure trackers will not be identified.
- **First-party trackers:** Scripts hosted on the same domain as the page are not matched (by design — they are "first-party").
- **Script execution content:** We do not execute or read tracker scripts — we only match their domain.

## Fingerprinting Detection

**What it does:**
- Hooks native JavaScript API prototypes in the page's MAIN world (Canvas, WebGL, AudioContext, Navigator.hardwareConcurrency).
- Classifies access as LOW/MEDIUM/HIGH confidence based on which APIs are used and how.
- Example: `fillText` + `toDataURL` on a Canvas = HIGH confidence fingerprinting pattern.

**Limitations:**
- **False positives:** Many legitimate uses of Canvas (charts, games, image editing) will trigger detection. TrackerLens does NOT claim a page "is fingerprinting you." It reports "possible fingerprinting indicator."
- **Not exhaustive:** We hook the most common FP vectors. Less common signals (CSS fingerprinting, timing attacks, HSTS supercookies) are not detected.
- **Prototype override:** If a page overrides the same methods before our script runs, our hooks may not fire. However, `fp_main.js` runs at `document_start`.
- **iframes:** Content script injection is limited to the top-level frame (`all_frames: false`). Trackers in cross-origin iframes will be caught by `webRequest` (domain matching) but not by our JS API hooks.

## Cookie Analysis

**What it does:**
- Parses `Set-Cookie` response headers observed via `webRequest.onCompleted`.
- Classifies cookies by name pattern (tracking cookies like `_ga`, `fbp`, etc.), third-party status, Secure flag, SameSite attribute.

**Limitations:**
- **HttpOnly cookies:** We can see that an HttpOnly cookie exists (from the header), but cannot read its value.
- **JavaScript-set cookies:** Cookies set via `document.cookie` are NOT captured (we only see network response headers).
- **SameSite default behavior:** Browser-inferred SameSite defaults are not always reflected in the header, so some cookies may be miscategorized.
- **Cookie values NOT stored:** We deliberately do not store cookie values — only metadata (name, domain, flags, category).

## Consent / Dark Pattern Detection

**What it does:**
- Uses a DOM observer to look for elements with CSS classes/IDs containing "cookie", "consent", "gdpr".
- Checks for: pre-checked checkboxes, accept-only buttons, hidden reject buttons, visual emphasis asymmetry.

**Limitations:**
- **Conservative by design:** The consent detector will miss many banners that use non-standard markup.
- **Language limited:** Keyword matching is English-centric.
- **False positives possible:** Not every matched element is a consent banner.
- **Does NOT determine legal compliance:** The term "dark pattern" is used in the technical/UX sense only, not a legal definition.

## Privacy Score

- The score is a **rule-based heuristic**, not an objective measurement of privacy risk.
- It reflects what TrackerLens can *observe*, not what is actually happening (e.g., a tracker behind CNAME cloaking would not be counted).
- The score is **deterministic and transparent** — every point maps to a specific detected signal.
