# TrackerLens — Chrome Web Store Compliance Checklist

Last verified: 2026-08-14

## Single Purpose
- [x] Extension has a single, clearly described purpose: **Privacy auditing of websites**
- [x] No advertising features
- [x] No unrelated functionality

## Manifest V3
- [x] `manifest_version: 3`
- [x] No background pages; uses service worker
- [x] No `remote_code` or remote scripts
- [x] CSP enforced: `script-src 'self'; object-src 'none';`
- [x] No `'unsafe-eval'`

## Minimum Permissions
- [x] Permissions reviewed and documented (see `docs/permissions.md`)
- [x] `webNavigation` removed (was unnecessary)
- [x] No `history`, `downloads`, `bookmarks`, `cookies` permissions
- [x] `tabs` justified
- [x] `webRequest` justified (read-only)
- [x] `alarms` justified
- [x] `<all_urls>` host permission justified for content script injection

## User Data
- [x] No user data transmitted externally
- [x] No analytics SDK
- [x] No telemetry
- [x] All data stored in IndexedDB (local)
- [x] Privacy policy accurately describes data handling
- [x] Users can delete all data from Options page
- [x] Automatic retention (30 days, configurable)
- [x] **No cookie values stored or displayed**

## External Requests Made by the Extension
- [x] **Fonts bundled locally:** Previously loaded from Google Fonts CDN; now fully self-hosted. No external network requests made by the UI.
- [x] **No remote executable code** of any kind
- [x] **Favicon service REMOVED:** Previously used Google's `s2/favicons` API (which leaked domain names). Removed and replaced with local icon.

## Remote Code
- [x] No `eval()`
- [x] No `new Function()`
- [x] No external `<script>` tags
- [x] No dynamically loaded JS from remote sources

## Functionality
- [x] Extension works as described
- [x] Core features tested: tracker detection, fingerprint detection, cookie analysis, consent detection, scoring, history, export
- [x] No broken features or placeholder UI

## Store Description Accuracy
- [x] Does NOT claim to "block all trackers"
- [x] Does NOT claim to "detect all fingerprinting"
- [x] Does NOT claim to "guarantee privacy"
- [x] Uses accurate language: "audits," "detects indicators," "explains," "rule-based score"
- [x] Category: Privacy

## Privacy Policy
- [x] PRIVACY.md accurately matches implementation
- [x] Explains what data is accessed, why, what is stored, and what leaves the device

## Outstanding Disclosure Items
- [x] **None:** All external assets (Google Fonts, Google Favicons) have been fully removed and replaced with local bundled assets. The extension is 100% self-contained.
