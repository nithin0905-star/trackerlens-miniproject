# TrackerLens — Privacy Policy

TrackerLens is designed from the ground up to respect your privacy.

## Summary

**All data stays on your device. Nothing is transmitted to any external server. Ever.**

---

## What Data Is Accessed

### 1. URLs of Visited Websites
- **Why**: To identify which website is being audited and associate privacy audit records with the correct domain.
- **How it's used**: The URL is parsed to extract the domain name. The full URL is stored locally for audit purposes.
- **What is NOT done**: URLs are never transmitted to external servers.

### 2. Network Request Metadata
- **Why**: To detect third-party tracker domains and classify observable cookie metadata.
- **What is observed**: Request URLs and Set-Cookie response headers (name, attributes — never values).
- **What is NOT observed**: Request/response bodies, POST data, form submissions, passwords, session tokens, or cookie values.

### 3. Fingerprinting API Access Indicators
- **Why**: To detect when privacy-sensitive browser APIs (Canvas, WebGL, AudioContext) are accessed during a page visit.
- **What is recorded**: Which API was accessed, how many times, and a confidence level. No image data, audio output, or rendering content is captured.

### 4. Consent Banner Observations
- **Why**: To detect potential consent dark patterns in cookie banners.
- **What is observed**: Presence, absence, and visual properties of consent-related DOM elements. No page text content or personal data is read.

---

## What Data Is Stored

All data is stored exclusively in the browser's local IndexedDB database (`trackerLensDB`).

| Store | Contents | Purpose |
|-------|----------|---------|
| `visits` | Domain, URL, score, risk level, timestamp | Visit audit record |
| `trackers` | Tracker domain, company, category, purpose | Tracker detection results |
| `fingerprints` | API name, indicator, confidence, count | Fingerprinting signal records |
| `cookies` | Cookie name (no value), attributes, category | Cookie audit results |
| `consentEvents` | Banner presence, dark pattern types | Consent analysis results |
| `settings` | User preferences | Configuration |
| `trustedSites` | Domain list | User-defined trusted sites |
| `dailyStats` | Aggregated daily counters | History statistics |
| `weeklyStats` | Aggregated weekly counters | Summary dashboard |

`chrome.storage.session` is used to maintain ephemeral tab tracking state across service worker restarts. This data is not persisted across browser sessions.

---

## What Data Is NOT Stored

TrackerLens never stores:
- Cookie values, session tokens, or authentication data
- Web page content or text
- Form inputs, passwords, or personal information
- Screenshots or visual content
- Geolocation data
- User identity information

---

## Data Retention

- Default retention period: **30 days**
- Configurable: 1–365 days via Settings → Storage & Export
- Auto-cleanup runs every 12 hours via a background alarm
- Manual deletion available at any time via Settings → Reset History

---

## Data Export & Deletion

You can, at any time:
- **Export** all data as JSON or CSV from Settings → Storage & Export
- **Delete** visit history from Settings → Reset History
- **Factory Reset** all data and settings from Settings → Factory Reset

---

## External Network Requests

TrackerLens makes **no outbound network requests** from the extension itself.

All resources loaded by the extension are bundled within the extension package:
- Tracker domain database (`data/tracker_domains.json`) — loaded from the extension bundle
- Fonts (`fonts/*.ttf`) — loaded from the extension bundle
- Icons — loaded from the extension bundle

No CDN. No external APIs. No analytics endpoints. No error reporting.

---

## Third-Party Data Sharing

TrackerLens shares **no data** with:
- The extension developer
- Analytics services
- Advertising networks
- Any third party

---

## Remote Code

TrackerLens does **not** execute remotely hosted code. All JavaScript is bundled within the extension and served from `chrome-extension://` origin. `eval()` and `new Function()` are not used.

---

## Permissions

| Permission | Purpose | Data accessed |
|-----------|---------|---------------|
| `tabs` | Read active tab URL | Current tab URL only |
| `webRequest` | Observe network requests (read-only) | Request URLs, Set-Cookie headers |
| `storage` | Persist tab state across SW restarts | Ephemeral tab state (session only) |
| `alarms` | Schedule retention cleanup | None (triggers local cleanup only) |
| `<all_urls>` | Allow webRequest to monitor all sites | Required for webRequest — no data transmitted |

---

## Changes to This Policy

This policy reflects the implementation of TrackerLens v1.0.0. Future versions will update this document if data handling changes. The policy will always match the actual implementation.

---

*Last updated: August 2026*
