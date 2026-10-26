# Store Permission Justification

When submitting TrackerLens to the Chrome Web Store, use the following justifications to explain exactly why each permission is necessary.

| Permission | Reason | Feature | Why a narrower permission is insufficient |
| :--- | :--- | :--- | :--- |
| `tabs` | To read the URL of the active tab. | Privacy Scoring & History Tracking | The extension must know the `url` of the current tab to associate tracking events and fingerprinting scripts with the correct site. Without this, we cannot build a per-domain history or score. |
| `webRequest` | To passively observe network traffic for third-party trackers. | Tracker Detection | We must inspect the URLs of outbound requests to match them against our local database of known advertising/analytics domains. `webRequest` is strictly read-only; we do not intercept or block. |
| `alarms` | To trigger background cleanup tasks. | Data Retention | We must periodically prune old data from IndexedDB (e.g., after 30 days) to prevent infinite storage growth. `setTimeout` cannot be used reliably in Manifest V3 service workers. |
| `<all_urls>` | To inject the content script (`page_observer.js`, `fp_main.js`). | Fingerprinting Detection | To detect Canvas or Audio API fingerprinting, we must inject a script that monitors API access on the webpages the user visits. Because users browse arbitrarily, we require access to all HTTP/HTTPS URLs. |

**Permissions Removed in Phase 5:**
- `webNavigation`: We removed this broad permission in favor of narrower `chrome.tabs.onUpdated` listeners to minimize our security footprint.
