/**
 * TrackerLens — Page Observer (Content Script)
 * Detects consent banners and dark patterns on the page using DOM observation.
 * Runs at document_idle (after DOM is available).
 */

(function () {
  'use strict';

  if (window.__trackerLensPageObserverInstalled) return;
  window.__trackerLensPageObserverInstalled = true;

  // ─── Consent Banner Detection ─────────────────────────────────────────────

  const CONSENT_KEYWORDS = [
    'cookie', 'cookies', 'consent', 'gdpr', 'ccpa', 'privacy',
    'we use', 'tracking', 'accept all', 'agree', 'allow all',
  ];

  const REJECT_KEYWORDS = [
    'reject', 'decline', 'refuse', 'opt out', 'opt-out',
    'manage preferences', 'customize', 'customise', 'necessary only',
  ];

  const ACCEPT_KEYWORDS = [
    'accept all', 'agree', 'allow all', 'i accept', 'ok', 'got it',
    'accept cookies', 'accept & close',
  ];

  let _signalsSent = false;
  let _lastMutationTime = Date.now();
  let _scanCount = 0;

  function textOf(el) {
    return (el.textContent ?? '').toLowerCase().trim();
  }

  function hasKeyword(text, keywords) {
    return keywords.some(kw => text.includes(kw));
  }

  function checkVisualEmphasis(acceptBtn, rejectBtn) {
    if (!acceptBtn || !rejectBtn) return false;
    
    // Check if accept button is significantly more prominent than reject
    const acceptStyle = window.getComputedStyle(acceptBtn);
    const rejectStyle = window.getComputedStyle(rejectBtn);
    
    // Simplistic check: If accept is a button with a distinct background color, 
    // and reject has a transparent or no background (looks like a link)
    if (acceptStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
        rejectStyle.backgroundColor === 'rgba(0, 0, 0, 0)') {
      return true;
    }
    
    // If accept text is significantly larger or bolder
    if (parseInt(acceptStyle.fontWeight) > parseInt(rejectStyle.fontWeight)) {
      return true;
    }
    
    return false;
  }

  function scanForConsent() {
    const allElements = document.querySelectorAll(
      '[class*="cookie"], [class*="consent"], [class*="gdpr"], ' +
      '[id*="cookie"], [id*="consent"], [id*="gdpr"], ' +
      '[role="dialog"], [aria-label*="cookie"], [aria-label*="consent"]'
    );

    const patterns = [];

    let hasBanner = false;
    let acceptBtnNode = null;
    let rejectBtnNode = null;

    for (const el of allElements) {
      const text = textOf(el);
      if (hasKeyword(text, CONSENT_KEYWORDS)) {
        hasBanner = true;

        const buttons = el.querySelectorAll('button, [role="button"], a[href="#"], input[type="submit"]');
        for (const btn of buttons) {
          const btnText = textOf(btn);
          if (hasKeyword(btnText, ACCEPT_KEYWORDS)) acceptBtnNode = btn;
          if (hasKeyword(btnText, REJECT_KEYWORDS)) rejectBtnNode = btn;
        }

        const checked = el.querySelectorAll('input[type="checkbox"]:checked');
        if (checked.length > 0) {
          patterns.push({
            type: 'prechecked_consent',
            reason: 'Potential dark pattern: Consent checkboxes are pre-checked.',
            confidence: 'high'
          });
        }
      }
    }

    if (hasBanner) {
      if (acceptBtnNode && !rejectBtnNode) {
        // Look for hidden or obfuscated reject buttons
        const hiddenButtons = document.querySelectorAll('[class*="reject"], [class*="decline"], [class*="manage"]');
        let foundHidden = false;
        
        for (const btn of hiddenButtons) {
          const style = window.getComputedStyle(btn);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || parseInt(style.fontSize) < 8) {
            foundHidden = true;
            break;
          }
        }
        
        if (foundHidden) {
          patterns.push({
            type: 'hidden_reject',
            reason: 'Potential dark pattern: Reject button is hidden or extremely small.',
            confidence: 'high'
          });
        } else {
          patterns.push({
            type: 'no_reject',
            reason: 'Potential dark pattern: Accept button exists, but no clear Reject option.',
            confidence: 'medium'
          });
        }
      } else if (acceptBtnNode && rejectBtnNode) {
        if (checkVisualEmphasis(acceptBtnNode, rejectBtnNode)) {
          patterns.push({
            type: 'visual_emphasis',
            reason: 'Potential dark pattern: Accept button is visually emphasized over Reject.',
            confidence: 'medium'
          });
        }
      }
      
      const hasLegitimateOptOut = Boolean(acceptBtnNode && rejectBtnNode && patterns.length === 0);

      return {
        detected: true,
        hasLegitimateOptOut,
        hasRejectButton: Boolean(rejectBtnNode),
        hasAcceptButton: Boolean(acceptBtnNode),
        patterns
      };
    }

    return { detected: false, patterns: [], hasLegitimateOptOut: false };
  }

  function dispatchPageSignals(signals) {
    if (_signalsSent) return;
    _signalsSent = true;
    window.dispatchEvent(new CustomEvent('__trackerLensPageSignals', {
      detail: { signals },
    }));
  }

  function runScan() {
    if (_scanCount >= 3) {
      if (typeof observer !== 'undefined') observer.disconnect();
      return;
    }
    _scanCount++;
    
    const signals = scanForConsent();
    if (signals.detected) {
      dispatchPageSignals(signals);
      if (typeof observer !== 'undefined') observer.disconnect();
    }
  }

  // Scan immediately
  setTimeout(runScan, 1000);

  // Throttled observer
  let _observerTimeout = null;
  const observer = new MutationObserver(() => {
    if (_signalsSent) { observer.disconnect(); return; }
    
    const now = Date.now();
    if (now - _lastMutationTime < 500) return; // Throttle: drop mutations that come too fast
    _lastMutationTime = now; // Update so the next mutation is correctly throttled

    clearTimeout(_observerTimeout);
    _observerTimeout = setTimeout(runScan, 1000); // 1s debounce
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Stop observing after 10 seconds to prevent leaks
  setTimeout(() => {
    observer.disconnect();
    if (!_signalsSent) {
      runScan();
    }
  }, 10_000);

})();
