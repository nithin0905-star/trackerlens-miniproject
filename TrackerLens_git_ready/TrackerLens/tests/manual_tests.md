# TrackerLens Manual Tests

Follow these steps to manually verify extension reliability and behavior across supported browsers (Chrome, Edge, Brave).

## 1. Installation & Permissions
1. Load unpacked extension from `dist/`.
2. Verify it only requests: `tabs`, `webRequest`, `alarms`. (NO `webNavigation` or `unsafe-eval`).
3. Pin the extension to the toolbar.

## 2. Basic Tracker & FP Detection
1. Visit `https://cnn.com` or `https://theverge.com`.
2. Observe the badge update from grey to a risk color (e.g., Red).
3. Click the popup. Verify:
   - Score is displayed.
   - Breakdown bars correctly visualize counts.
   - "Why this score?" shows positive/negative points.

## 3. Trusted Sites
1. Visit a high-tracking site.
2. Click the "Add to trusted sites" shield icon.
3. Reload the page.
4. Verify the badge is now Green, but the score in the popup is still accurately calculated and displayed.

## 4. Service Worker Reliability & Suspension
1. Go to `chrome://serviceworker-internals` and click `Stop` for TrackerLens.
2. Alternatively, use DevTools -> Application -> Service Workers -> Stop.
3. Open a new tab and visit a site.
4. The service worker should wake up, restore session state from `chrome.storage.session`, and correctly record the visit without throwing unhandled exceptions.

## 5. Privacy UI Wording
1. Verify NO use of the word "Malicious".
2. Ensure descriptions say "Likely tracking indicator", "Possible FP signal", etc.

## 6. Accessibility & Keyboard Nav
1. Open the popup.
2. Press `Tab`. Focus should ring through: History, Summary, Settings, Dev(if enabled), Trust button, Explain button.
3. Press `Enter` on the Explain button. The panel should expand.
4. Use a screen reader (VoiceOver/Narrator) and ensure it reads "Score X out of 100", "Add to trusted sites", etc.

## 7. Build Integrity
1. Run `node build.js`.
2. Inspect `dist/`. Ensure `demo_data.js`, `mock_data.js`, `tests/` are NOT present.
3. Zip `dist/` and load it into a clean browser profile to ensure no missing dependencies.
