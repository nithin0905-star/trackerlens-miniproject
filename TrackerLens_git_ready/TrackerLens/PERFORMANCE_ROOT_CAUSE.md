# TrackerLens Performance & Stability Root Cause Analysis

Based on automated profiling, codebase audits, and the reported symptoms, the following components are responsible for the performance degradation and page breakage.

### 1. Network Monitoring (`tracker_detector.js`)
- **Observed Issue**: High CPU usage and frame drops during heavy network activity (e.g., initial page load of ad-heavy sites).
- **Root Cause**: `extractDomain` is called for every single network request. It uses `new URL()` inside a `try/catch` block. Creating URL objects is notoriously slow and causes significant garbage collection overhead when thousands of requests fire in a short window.
- **Fix**: Replace `new URL()` with a fast, regex-based or string manipulation domain extractor that doesn't instantiate heavy objects. Cache/memoize recently extracted URLs.

### 2. Fingerprinting Hooks (`fp_main.js`)
- **Observed Issue**: Severe slowdowns and potential breakage on WebGL-heavy sites (games, maps), canvas-heavy sites, or SPAs.
- **Root Cause**: WebGL `getParameter` and Canvas methods can be called thousands of times per second in render loops (e.g., `requestAnimationFrame`). The current hook intercepts *every* call, logs a signal, pushes timestamps to an array, and creates/resets a `setTimeout` (debouncing). This destroys render performance. Additionally, redefining `Navigator.prototype.hardwareConcurrency` can break sites that seal the `Navigator` prototype.
- **Fix**: 
  - Add a fast-path counter in the hook. If an API is called rapidly >100 times, assume it's a game/render loop and stop recording signals to prevent overhead.
  - Avoid creating timers or arrays inside high-frequency hooks.
  - Remove the `hardwareConcurrency` hook or wrap it in a strict `try/catch` without breaking standard getters.

### 3. Consent Detector (`page_observer.js`)
- **Observed Issue**: "Jank" or stuttering when scrolling dynamic pages (like Twitter/Reddit) or SPAs.
- **Root Cause**: The `MutationObserver` triggers on *any* DOM change. Even though it's debounced to 1 second, when it does run, it executes a massively expensive `document.querySelectorAll` looking for `[class*="cookie"]`, `[id*="gdpr"]`, etc., across the *entire* DOM. 
- **Fix**: 
  - If a consent banner is found, **disconnect the observer immediately**. Sites rarely spawn multiple different consent banners.
  - Do not use wildcard `[class*="..."]` across the whole document. Inspect only newly added nodes from the mutation records if possible, or use a more efficient query.

### 4. Messaging & DB Writes (`message_router.js`)
- **Observed Issue**: High background CPU and IndexedDB disk I/O.
- **Root Cause**: `handleFpSignals` receives a message every 1 second (due to the debounce in `fp_main.js`) if fingerprinting is happening. For every message, it performs an immediate `await FingerprintsRepo.put(merged)` to IndexedDB and a `DailyStatsRepo.increment()`.
- **Fix**: Move Fingerprint signals into the in-memory `tabState` (just like we do for network trackers). Only write them to IndexedDB when the session syncs or finalizes. Batch all stats increments.

### 5. Content Script Initialization Timing
- **Observed Issue**: Extension adds overhead during the critical rendering path.
- **Root Cause**: Scripts inject and begin observing mutations immediately, competing for CPU resources while the browser is trying to paint the first frame.
- **Fix**: Move `page_observer.js` execution to strictly `document_idle` or introduce a slight delay before initializing heavy DOM scans.
