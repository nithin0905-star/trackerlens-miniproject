# TrackerLens — Browser Compatibility

| Feature | Chrome (Stable) | Edge | Brave | Firefox | Status |
|---|---|---|---|---|---|
| Manifest V3 | ✅ | ✅ | ✅ | ⚠️ Partial | Primary target |
| `chrome.webRequest` | ✅ | ✅ | ✅ | ✅ (`browser.*`) | Core feature |
| `chrome.alarms` | ✅ | ✅ | ✅ | ✅ | Retention |
| `chrome.storage.session` | ✅ Chrome 102+ | ✅ | ✅ | ❌ Not available | State persistence |
| Service Worker (MV3) | ✅ | ✅ | ✅ | ❌ Uses Event Pages | Core architecture |
| MAIN world content scripts | ✅ | ✅ | ✅ | ❌ Not in MV3 API | Fingerprint detection |
| `chrome.tabs` | ✅ | ✅ | ✅ | ✅ | Badge, URL |
| IndexedDB | ✅ | ✅ | ✅ | ✅ | Storage |

## Notes

**Chrome:** Full support. Primary development and test target. Requires Chrome 102+ for `chrome.storage.session`.

**Edge:** Full compatibility. Chromium-based. Identical API surface to Chrome.

**Brave:** Full compatibility. Chromium-based. Note: Brave's aggressive fingerprinting shields may interfere with the `fp_main.js` prototype hooks, causing reduced fingerprinting detection accuracy on Brave itself.

**Firefox:** NOT SUPPORTED. Firefox uses a different extension API namespace (`browser.*` vs `chrome.*`) and does not support MV3 service workers or MAIN world content script injection in the same way. Do not submit to the Firefox Add-ons store without a separate porting effort.

## Minimum Chrome Version
Chrome 102 (released May 2022) — for `chrome.storage.session` support.
If `chrome.storage.session` is unavailable, the extension degrades gracefully (state is not persisted across service worker restarts, but is re-created on next navigation).
