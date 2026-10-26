# Chrome Web Store Listing: TrackerLens

## Store Name
**TrackerLens — Browser Privacy & Fingerprinting Exposure Auditor**

## Short Description
Transparently audit the websites you visit for third-party trackers, deceptive consent patterns, and fingerprinting scripts.

## Detailed Description
TrackerLens is a privacy auditing tool that helps you understand exactly how websites track your behavior. It acts as your personal privacy inspector, providing you with a clear, rule-based privacy score for every site you visit. 

Unlike other tools that just block content silently, TrackerLens *explains* what is happening under the hood. It detects hidden tracking requests, exposes browser fingerprinting attempts, flags deceptive cookie consent banners, and gives you a transparent breakdown of why a site received its score.

**Key Features:**
- **Comprehensive Privacy Score:** Every site gets a score from 0-100 based on its privacy practices.
- **Tracker Detection:** Audits network requests to detect known third-party advertising and analytics trackers.
- **Fingerprinting Alerts:** Detects when scripts try to covertly identify your device using Canvas, Audio, or User-Agent APIs.
- **Consent UI Analysis:** Flags deceptive dark patterns in cookie banners.
- **Detailed Explanations:** Explains exactly why a site gained or lost points in a transparent, easy-to-understand panel.
- **Rich History & Weekly Summaries:** View your exposure over time with detailed charts and statistics.

**100% Local & Private:**
TrackerLens was built from the ground up for absolute privacy.
- It does **not** collect your data.
- It does **not** send any browsing history to external servers.
- It does **not** contain analytics SDKs.
All auditing is performed locally on your machine, and your history is stored exclusively in your browser.

*Note: TrackerLens is an auditing and educational tool. It detects and explains tracking indicators but is not designed to block all tracking or guarantee total privacy.*

## Support Information
Please read our [Privacy Policy](PRIVACY.md) and [Security Policy](SECURITY.md) for more details. If you have questions, please reach out via our support channel or consult the FAQ.

## FAQ
**Q: Does TrackerLens block ads?**
A: No. TrackerLens is an *auditor*. It detects and explains tracking indicators so you can make informed decisions, but it does not aggressively block content like an ad-blocker.

**Q: Where is my data stored?**
A: Exclusively on your device. We use your browser's local IndexedDB. TrackerLens makes zero outbound network requests with your data.

**Q: Can I delete my history?**
A: Yes. You can clear your data or perform a full factory reset at any time from the extension's Options page. Data is also automatically purged after 30 days.

## Screenshots Checklist
Please capture the following screenshots directly from the extension to accompany your listing:
1. **The Popup (High Risk):** Capture the popup on a heavily tracked site (e.g., cnn.com), showing a low score, red badge, and the breakdown bars.
2. **The Explanation Panel:** Capture the popup with the "Why this score?" accordion expanded, showing the positive/negative points.
3. **The History View:** Capture the `history.html` page showing the list of recently visited domains and their risk levels.
4. **The Weekly Summary:** Capture the `summary.html` page showing the charts, daily scores, and top metrics.
5. **The Options Page:** Capture the settings page where users can adjust their custom scoring weights.
