# TrackerLens — Permission Justifications

## Summary
TrackerLens uses the minimum permissions required to perform privacy auditing. No permission is requested speculatively.

| Permission | Feature | Why Required | Why Narrower Is Insufficient |
|---|---|---|---|
| `tabs` | Privacy scoring, badge updates, popup display | To read the active tab's URL so auditing is associated with the correct domain. Also used to update the badge per-tab via `tabId`. | `activeTab` is only granted on user gesture (click). We need the URL on every page navigation to record visits continuously, not just when the popup is opened. |
| `webRequest` | Tracker detection | To observe all outbound network requests and match their URLs against the local tracker domain list. This is entirely read-only. | `declarativeNetRequest` can block/redirect but cannot enumerate URLs for auditing/reporting. We need to read URLs, not block them. |
| `alarms` | Data retention | To schedule a background cleanup task that deletes data older than the user-configured retention period (default: 30 days). | `setTimeout` and `setInterval` do not survive MV3 service worker suspension. `chrome.alarms` is the only reliable timer in MV3. |
| `host_permissions: <all_urls>` | Content script injection, fingerprinting detection | Required to inject the `fp_main.js` (MAIN world) and `page_observer.js` content scripts on all pages the user visits, so fingerprinting API access and consent banners can be detected. | Without `<all_urls>`, content scripts can only be injected on specific listed domains, making extension-wide privacy auditing impossible. |

## Permissions Removed
- `webNavigation`: Previously present. Removed in favor of `tabs.onUpdated`, which is sufficient for detecting page navigation without the broader `webNavigation` permission scope.

## Permissions NOT Requested
- `cookies`: Not requested. Cookie detection is performed via `webRequest` response headers (`Set-Cookie`) only, which is sufficient and does not require cookie read access.
- `storage`: Not requested as a named permission. IndexedDB does not require a permission declaration. `chrome.storage.session` is available without declaring `storage`.
- `history`: Not requested. TrackerLens maintains its own visit history in IndexedDB.
- `browsingData`: Not requested. Users clear data via the extension UI, which deletes from IndexedDB.
