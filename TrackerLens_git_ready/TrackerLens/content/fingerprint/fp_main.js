/**
 * TrackerLens — Main World Fingerprint Observer
 * Monitors privacy-sensitive API calls made by the page.
 * Injected into the MAIN world to properly intercept page scripts.
 */

(function () {
  'use strict';

  if (window.__trackerLensFpMainInstalled) return;
  window.__trackerLensFpMainInstalled = true;

  // Track signals: { api, indicator, confidence, count }
  const signals = new Map();
  let dispatchTimer = null;
  let lastDispatch = 0;

  function recordSignal(api, indicator, confidence = 'low') {
    const key = `${api}:${indicator}`;
    let sig = signals.get(key);
    if (!sig) {
      sig = { api, indicator, confidence, count: 0 };
      signals.set(key, sig);
    }
    
    sig.count++;
    if (sig.count > 50) return; // Hard limit per indicator to prevent memory leaks

    if (confidence === 'high') sig.confidence = 'high';
    else if (confidence === 'medium' && sig.confidence === 'low') sig.confidence = 'medium';

    scheduleDispatch();
  }

  function scheduleDispatch() {
    const now = Date.now();
    if (now - lastDispatch > 1000) {
      lastDispatch = now;
      dispatchSignals();
      return;
    }
    if (dispatchTimer) return;
    dispatchTimer = setTimeout(() => {
      dispatchTimer = null;
      lastDispatch = Date.now();
      dispatchSignals();
    }, 1000); // Debounce 1s
  }

  function dispatchSignals() {
    if (signals.size === 0) return;
    
    // Only send the ones that have been updated
    const payload = Array.from(signals.values());
    
    // Dispatch to isolated bridge
    window.dispatchEvent(new CustomEvent('__trackerLensFpSignals', {
      detail: { signals: payload },
    }));
  }

  // ─── Canvas Fingerprinting ──────────────────────────────────────────────────

  try {
    const origToDataURL    = HTMLCanvasElement.prototype.toDataURL;
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const origFillText     = CanvasRenderingContext2D.prototype.fillText;
    const origToBlob       = HTMLCanvasElement.prototype.toBlob;

    // We can detect the common pattern: fillText followed by toDataURL
    const canvasStates = new WeakMap();

    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (this.canvas) {
        if (!this._tlTextCount) this._tlTextCount = 0;
        this._tlTextCount++;
        if (this._tlTextCount < 50) {
          canvasStates.set(this.canvas, true);
          recordSignal('Canvas', 'fillText API accessed', 'low');
        }
      }
      return origFillText.apply(this, args);
    };

    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      if (!this._tlDataUrlCount) this._tlDataUrlCount = 0;
      this._tlDataUrlCount++;
      if (this._tlDataUrlCount < 50) {
        const hasDrawnText = canvasStates.get(this);
        if (hasDrawnText) {
          recordSignal('Canvas', 'Text drawn and extracted (toDataURL)', 'high');
        } else {
          recordSignal('Canvas', 'Canvas image extracted (toDataURL)', 'medium');
        }
      }
      return origToDataURL.apply(this, args);
    };

    HTMLCanvasElement.prototype.toBlob = function (...args) {
      if (!this._tlBlobCount) this._tlBlobCount = 0;
      this._tlBlobCount++;
      if (this._tlBlobCount < 50) {
        const hasDrawnText = canvasStates.get(this);
        if (hasDrawnText) {
          recordSignal('Canvas', 'Text drawn and extracted (toBlob)', 'high');
        } else {
          recordSignal('Canvas', 'Canvas image extracted (toBlob)', 'medium');
        }
      }
      return origToBlob.apply(this, args);
    };

    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      if (!this._tlImgDataCount) this._tlImgDataCount = 0;
      this._tlImgDataCount++;
      if (this._tlImgDataCount < 50) {
        const hasDrawnText = canvasStates.get(this.canvas);
        if (hasDrawnText) {
          recordSignal('Canvas', 'Text drawn and extracted (getImageData)', 'high');
        } else {
          recordSignal('Canvas', 'Canvas pixel data read', 'medium');
        }
      }
      return origGetImageData.apply(this, args);
    };
  } catch (e) {
    // API might not exist or be restricted
  }

  // ─── WebGL Fingerprinting ───────────────────────────────────────────────────

  try {
    const origGetParameter = WebGLRenderingContext.prototype.getParameter;
    const origGetExtension = WebGLRenderingContext.prototype.getExtension;

    WebGLRenderingContext.prototype.getParameter = function (...args) {
      if (!this._tlGetParamCount) this._tlGetParamCount = 0;
      this._tlGetParamCount++;
      if (this._tlGetParamCount < 100) {
        const param = args[0];
        if (param === 37445 || param === 37446) {
          recordSignal('WebGL', 'Unmasked vendor/renderer accessed', 'high');
        } else {
          recordSignal('WebGL', 'getParameter accessed', 'low');
        }
      }
      return origGetParameter.apply(this, args);
    };

    WebGLRenderingContext.prototype.getExtension = function (...args) {
      if (!this._tlGetExtCount) this._tlGetExtCount = 0;
      this._tlGetExtCount++;
      if (this._tlGetExtCount < 50) {
        const ext = args[0] ? args[0].toLowerCase() : '';
        if (ext.includes('debug_renderer_info')) {
          recordSignal('WebGL', 'Debug renderer info extension accessed', 'high');
        } else {
          recordSignal('WebGL', 'Extension accessed', 'low');
        }
      }
      return origGetExtension.apply(this, args);
    };

    if (typeof WebGL2RenderingContext !== 'undefined') {
      const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (...args) {
        if (!this._tlGetParam2Count) this._tlGetParam2Count = 0;
        this._tlGetParam2Count++;
        if (this._tlGetParam2Count < 100) {
          const param = args[0];
          if (param === 37445 || param === 37446) {
            recordSignal('WebGL', 'Unmasked vendor/renderer accessed', 'high');
          } else {
            recordSignal('WebGL', 'getParameter accessed', 'low');
          }
        }
        return origGetParam2.apply(this, args);
      };
    }
  } catch (e) {}

  // ─── AudioContext Fingerprinting ────────────────────────────────────────────

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const origCreateOscillator = AudioCtx.prototype.createOscillator;
      const origCreateDynamicsCompressor = AudioCtx.prototype.createDynamicsCompressor;

      AudioCtx.prototype.createOscillator = function (...args) {
        recordSignal('AudioContext', 'Oscillator created', 'medium');
        return origCreateOscillator.apply(this, args);
      };
      
      AudioCtx.prototype.createDynamicsCompressor = function (...args) {
        recordSignal('AudioContext', 'DynamicsCompressor created (common FP)', 'high');
        return origCreateDynamicsCompressor.apply(this, args);
      };
    }
  } catch (e) {}
  


})();
