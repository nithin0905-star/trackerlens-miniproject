# Security Policy

TrackerLens is designed with strict security principles to protect your browsing environment.

## Defense-in-Depth

1. **Zero Remote Execution:** The extension strictly forbids `eval()` and `new Function()`. Content Security Policy (`script-src 'self'`) is enforced.
2. **Strict Message Validation:** All messages sent between the webpage (content scripts) and the background service worker are structurally validated to prevent injection or corruption.
3. **Safe DOM Modification:** UI components utilize `textContent` or `DOMParser` to prevent Cross-Site Scripting (XSS). `innerHTML` is banned.
4. **Isolated Execution:** Core detection logic resides in isolated content scripts. The minimal MAIN world script exists solely to monitor native API access (like Canvas or Audio API) and cannot access extension secrets.
5. **Local Network Calls:** The extension uses `fetch()` only to load bundled local JSON data. It makes zero outbound network requests.

## Scope
The scope of this security policy covers the TrackerLens browser extension. Vulnerabilities that allow a webpage to escape the content script sandbox, read the extension's database, or bypass local protections are considered in-scope.

## Vulnerability Reporting Process
If you believe you have found a security vulnerability in TrackerLens, please report it to us immediately. 
We ask that you do not disclose it publicly until we have had a chance to investigate and patch the issue.

**Security Contact:** `[security@trackerlens.example.com]` (Placeholder)

Please include the following information in your report:
- A detailed description of the vulnerability.
- Steps to reproduce the issue.
- Potential impact.

## Responsible Disclosure Guidance
- We pledge to acknowledge your report within 48 hours.
- We will provide an estimated timeline for the fix.
- We request that you provide us a reasonable amount of time to resolve the issue before publishing details.
- We will credit you (if desired) in our release notes for responsibly disclosing the vulnerability.
