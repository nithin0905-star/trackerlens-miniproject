# TrackerLens — Browser Privacy & Fingerprinting Exposure Auditor

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](manifest.json)
[![Manifest V3](https://img.shields.io/badge/MV3-Manifest%20V3-green)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

TrackerLens is a browser extension that gives you a transparent, real-time view of what third-party trackers, fingerprinting indicators, cookies, and consent patterns are observable on every website you visit — all privately, locally, and without sending a single byte to any server.

## What It Does

| Feature | Description |
|---------|-------------|
| 🔍 Tracker Detection | Matches outgoing network requests against a locally bundled tracker domain database |
| 🧬 Fingerprinting Indicators | Monitors access to Canvas, WebGL, AudioContext APIs with confidence levels |
| 🍪 Cookie Analysis | Classifies cookie metadata from Set-Cookie headers (never reads values) |
| ⚠️ Consent Dark Patterns | Detects manipulative consent banner design indicators |
| 📊 Privacy Score | Transparent 0–100 rule-based score with full explanation |
| 📋 History | Browse, filter, sort, and export your complete audit history |
| 📈 Weekly Summary | Per-day charts and aggregated privacy statistics |
| 🛡 Trusted Sites | Mark sites to suppress badge alerts while still auditing them |
| ⚙️ Settings | Configurable scoring weights and data retention |

## What It Does NOT Do

- ❌ Block ads or trackers
- ❌ Modify or intercept web traffic
- ❌ Send any data to external servers
- ❌ Guarantee detection of all fingerprinting
- ❌ Provide legal compliance advice

## Quick Start

### Install from Chrome Web Store
*(Link will be available after listing approval)*

### Install for Development (Unpacked)

1. Clone or download this repository
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `dist/` directory (or the project root for development)
6. Browse any website — TrackerLens starts monitoring automatically

## Architecture

```
manifest.json (MV3)
│
├── background/
│   ├── service_worker.js        Entry point, startup orchestration
│   ├── request_monitor.js       webRequest observer, tracker/cookie detection
│   └── message_router.js        Message handler for popup/content scripts
│
├── content/
│   ├── fingerprint/fp_main.js   MAIN world: API interception (Canvas, WebGL, Audio)
│   ├── bridge.js                ISOLATED world: message relay + input validation
│   └── page_observer.js         DOM observer: consent banner detection
│
├── detection/
│   ├── tracker_detector.js      Domain matching, first/third-party classification
│   ├── cookie_detector.js       Cookie classification from Set-Cookie headers
│   ├── fingerprint_detector.js  FP signal evaluation
│   └── consent_detector.js      Consent signal evaluation
│
├── scoring/
│   ├── score_engine.js          Main scoring function with explanations
│   ├── score_rules.js           Rule definitions and point values
│   └── severity.js              Score → severity level mapping
│
├── storage/
│   ├── indexeddb.js             DB schema, migrations, connection management
│   ├── repositories.js          All data access layer (CRUD operations)
│   └── defaults.js              Default settings
│
├── popup/                       Extension popup
├── options/                     Settings page
├── history/                     Audit history view
├── summary/                     Weekly summary dashboard
├── report/                      Export utilities
├── shared/                      Shared config, CSS design system, logger
├── data/tracker_domains.json    Bundled tracker database
└── fonts/                       Locally bundled Inter & JetBrains Mono fonts
```

## Privacy

All data stays on your device. See [PRIVACY.md](PRIVACY.md) for the complete policy.

## Security

See [SECURITY.md](SECURITY.md) for the security model.

## Build

```bash
# Build the production dist/ directory
node build.js

# The dist/ directory contains the production extension
# Load dist/ as an unpacked extension for testing
```

## Permissions

| Permission | Reason |
|-----------|--------|
| `tabs` | Read active tab URL for auditing |
| `webRequest` | Observe network requests (read-only, never modifies) |
| `storage` | Persist tab state across service worker restarts |
| `alarms` | Schedule periodic data retention cleanup |
| `<all_urls>` | Allow webRequest to operate across all websites |

See [docs/chrome-store/permission-justifications.txt](docs/chrome-store/permission-justifications.txt) for detailed justifications.

## Limitations

- Fingerprinting detection reports API **access indicators** — not confirmed fingerprinting
- Canvas is used legitimately by games, charts, and UI renderers; detection is conservative
- Consent banner detection uses heuristics and may not catch all patterns
- Tracker database is curated — not every tracker domain is included
- Cannot inspect `chrome://`, `about:`, and other restricted browser pages

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 109+ | ✅ Primary target |
| Edge (Chromium) | ✅ Compatible |
| Brave | ✅ Compatible |
| Firefox | ❌ Not supported (different extension API) |

## License

[MIT](LICENSE) — see LICENSE file.
