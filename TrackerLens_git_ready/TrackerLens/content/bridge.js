/**
 * TrackerLens — Bridge (Content Script)
 * Relays signals from fp_observer.js (same-document) to the service worker.
 * Also relays page_observer.js signals.
 *
 * Runs at document_start, after fp_observer.js.
 * 
 * SECURITY NOTE (Phase 5): The MAIN world execution is strictly necessary
 * because we need to override native JavaScript properties directly on the page 
 * (e.g. Navigator.prototype.webdriver, HTMLCanvasElement.prototype.toDataURL) 
 * to detect tracking indicators. These properties cannot be hooked or altered 
 * from the ISOLATED extension world. The script contains minimal logic, no 
 * extension secrets, and uses postMessage/CustomEvents to relay data to the 
 * isolated world securely.
 */

(function () {
  'use strict';

  if (window.__trackerLensBridgeInstalled) return;
  window.__trackerLensBridgeInstalled = true;

  /**
   * Sends a message to the service worker safely.
   * Catches errors gracefully (e.g. extension context invalidated).
   */
  function sendToSW(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, ...payload }, () => {
        // Suppress "The message port closed before a response was received" error
        void chrome.runtime.lastError;
      });
    } catch (err) {
      // Extension may have been reloaded; silently ignore
    }
  }

  // ── Listen for FP signals from fp_main.js ───────────────────────────────
  window.addEventListener('__trackerLensFpSignals', (event) => {
    // Basic validation to prevent malicious page from sending garbage
    const { signals } = event.detail ?? {};
    if (!Array.isArray(signals)) return;
    
    const validSignals = signals.filter(s => 
      s && typeof s === 'object' &&
      typeof s.api === 'string' &&
      typeof s.indicator === 'string' &&
      typeof s.confidence === 'string' &&
      typeof s.count === 'number'
    ).map(s => ({
      // Strictly sanitize inputs to prevent malicious payloads
      api: String(s.api).slice(0, 100),
      indicator: String(s.indicator).slice(0, 200),
      confidence: ['low', 'medium', 'high'].includes(s.confidence) ? s.confidence : 'low',
      count: Math.max(1, Math.min(Number(s.count) || 1, 10000)),
      timestamps: (Array.isArray(s.timestamps) ? s.timestamps : [Date.now()]).slice(0, 20).map(t => Number(t) || Date.now())
    }));

    if (validSignals.length > 0) {
      sendToSW('FP_SIGNALS', { signals: validSignals });
    }
  });

  // ── Listen for page signals from page_observer.js ───────────────────────────
  window.addEventListener('__trackerLensPageSignals', (event) => {
    const { signals } = event.detail ?? {};
    if (signals && typeof signals === 'object') {
      // Validate page signals
      const validSignals = {
        hasBanner: Boolean(signals.hasBanner),
        isDarkPattern: Boolean(signals.isDarkPattern),
        hasLegitimateOptOut: Boolean(signals.hasLegitimateOptOut),
        patterns: Array.isArray(signals.patterns) ? signals.patterns.filter(p => p && typeof p === 'object').map(p => ({
          type: String(p.type).slice(0, 50),
          confidence: ['low', 'medium', 'high'].includes(p.confidence) ? p.confidence : 'low',
          reason: String(p.reason).slice(0, 200)
        })) : []
      };
      sendToSW('PAGE_SIGNALS', { signals: validSignals });
    }
  });

})();
