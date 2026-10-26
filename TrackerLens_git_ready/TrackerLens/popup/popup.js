/**
 * TrackerLens — Popup Script (Phase 4)
 *
 * Renders:
 *   - Score ring + risk badge
 *   - 4-category score breakdown with progress bars
 *   - "Why this score?" transparent explanation panel
 *   - Recommendations
 *   - Network counters
 *   - Trusted-site toggle
 *   - Loading skeleton + error state
 */

import { MSG, DEV_MODE, SEVERITY } from '../shared/config.js';

// ─── Risk color map ────────────────────────────────────────────────────────────

const RISK = {
  [SEVERITY.NONE]:      { stroke: '#445f7a', text: '#445f7a', label: 'No Data',       cls: 'risk-none'      },
  [SEVERITY.LOW]:       { stroke: '#10b981', text: '#10b981', label: 'Low Risk',       cls: 'risk-low'       },
  [SEVERITY.MODERATE]:  { stroke: '#f59e0b', text: '#f59e0b', label: 'Moderate Risk',  cls: 'risk-moderate'  },
  [SEVERITY.HIGH]:      { stroke: '#ef4444', text: '#ef4444', label: 'High Risk',      cls: 'risk-high'      },
  [SEVERITY.VERY_HIGH]: { stroke: '#dc2626', text: '#dc2626', label: 'Very High Risk', cls: 'risk-very-high' },
  [SEVERITY.CRITICAL]:  { stroke: '#8b5cf6', text: '#8b5cf6', label: 'Critical Risk',  cls: 'risk-critical'  },
};

const RING_CIRCUM = 264; // 2π × 42

// ─── DOM References ────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const el = {
  // Loading / error states
  loadingSkeleton: $('loadingSkeleton'),
  mainContent:     $('mainContent'),
  errorState:      $('errorState'),
  errorMsg:        $('errorMsg'),
  btnRetry:        $('btnRetry'),

  // Header
  demoBadge:   $('demoBadge'),
  statusDot:   $('statusDot'),
  statusLabel: $('statusLabel'),

  // Site bar
  siteFavicon:     $('siteFavicon'),
  siteDomain:      $('siteDomain'),
  trustBadge:      $('trustBadge'),
  btnTrustToggle:  $('btnTrustToggle'),
  trustToggleIcon: $('trustToggleIcon'),
  trustStatus:     $('trustStatus'),

  // Score hero
  scoreRingFill: $('scoreRingFill'),
  scoreNumber:   $('scoreNumber'),
  riskBadge:     $('riskBadge'),
  scoreMeta:     $('scoreMeta'),

  // Breakdown cards
  bscoreTrackers:     $('bscore-trackers'),
  bscoreFp:           $('bscore-fp'),
  bscoreCookies:      $('bscore-cookies'),
  bscoreConsent:      $('bscore-consent'),
  bbarTrackers:       $('bbar-trackers'),
  bbarFp:             $('bbar-fp'),
  bbarCookies:        $('bbar-cookies'),
  bbarConsent:        $('bbar-consent'),
  bsubTrackers:       $('bsub-trackers'),
  bsubFp:             $('bsub-fp'),
  bsubCookies:        $('bsub-cookies'),
  bsubConsent:        $('bsub-consent'),

  // Explanation
  explainList:  $('explainList'),

  // Audits
  auditSection:      $('auditSection'),
  trackerAuditGroup: $('trackerAuditGroup'),
  trackerList:       $('trackerList'),
  fpAuditGroup:      $('fpAuditGroup'),
  fpList:            $('fpList'),

  // Recommendations
  recoSection:  $('recoSection'),
  recoList:     $('recoList'),

  // Counters
  totalReqCount:      $('totalReqCount'),
  thirdPartyReqCount: $('thirdPartyReqCount'),
  trackerReqCount:    $('trackerReqCount'),

  // Dev panel
  devPanel:  $('devPanel'),
  diagTab:   $('diag-tab'),
  diagVisit: $('diag-visit'),
  diagPing:  $('diag-ping'),
  diagMsg:   $('diag-msg'),
  btnLoadDemo: $('btnLoadDemo'),
  btnRefresh:  $('btnRefresh'),

  // Nav
  navHistory:  $('navHistory'),
  navSummary:  $('navSummary'),
  navSettings: $('navSettings'),
  navDev:      $('navDev'),
};

// ─── Messaging Helper ──────────────────────────────────────────────────────────

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.error ?? 'Unknown error'));
        return;
      }
      resolve(response.data);
    });
  });
}

// ─── UI State ─────────────────────────────────────────────────────────────────

function showLoading() {
  el.loadingSkeleton.hidden = false;
  el.mainContent.hidden     = true;
  el.errorState.hidden      = true;
  setStatus('loading');
}

function showMain() {
  el.loadingSkeleton.hidden = true;
  el.mainContent.hidden     = false;
  el.errorState.hidden      = true;
}

function showError(msg) {
  el.loadingSkeleton.hidden = true;
  el.mainContent.hidden     = true;
  el.errorState.hidden      = false;
  el.errorMsg.textContent   = msg;
  setStatus('error');
}

function setStatus(state, msg = '') {
  const { statusDot: dot, statusLabel: lbl } = el;
  const map = {
    loading: { bg: 'var(--amber)', shadow: 'var(--amber)', text: 'LOADING',  clr: 'var(--amber)' },
    active:  { bg: 'var(--green)', shadow: 'var(--green)', text: 'ACTIVE',   clr: 'var(--green)' },
    error:   { bg: 'var(--red)',   shadow: 'var(--red)',   text: msg || 'ERR', clr: 'var(--red)'  },
  };
  const cfg = map[state] ?? map.active;
  dot.style.background = cfg.bg;
  dot.style.boxShadow  = `0 0 8px ${cfg.shadow}`;
  lbl.textContent      = cfg.text;
  lbl.style.color      = cfg.clr;
}

// ─── Render Helpers ───────────────────────────────────────────────────────────

function renderScore(score, severity) {
  const cfg    = RISK[severity] ?? RISK[SEVERITY.NONE];
  const offset = RING_CIRCUM - (score / 100) * RING_CIRCUM;

  el.scoreRingFill.style.strokeDashoffset = offset;
  el.scoreRingFill.style.stroke           = cfg.stroke;
  el.scoreRingFill.style.color            = cfg.stroke;
  el.scoreNumber.textContent              = score > 0 ? score : '—';
  el.scoreNumber.style.color              = cfg.text;

  // Risk badge
  const allRiskCls = Object.values(RISK).map(r => r.cls);
  el.riskBadge.className = 'risk-badge';
  el.riskBadge.classList.add(cfg.cls);
  el.riskBadge.textContent = cfg.label;
}

function animateCounter(element, target) {
  if (!element || typeof target !== 'number') return;
  const start    = parseInt(element.textContent, 10) || 0;
  if (start === target) return;
  const duration = 500;
  const frames   = 20;
  const step     = (target - start) / frames;
  let current = start, frame = 0;
  const timer = setInterval(() => {
    frame++;
    current += step;
    element.textContent = Math.round(current);
    if (frame >= frames) { clearInterval(timer); element.textContent = target; }
  }, duration / frames);
}

function renderBreakdown(breakdown, trackerCount, fpCount, cookieCount, consentEvents) {
  const caps = { trackers: 40, fingerprinting: 30, cookies: 20, consent: 10 };

  // Trackers
  const ts = breakdown.trackers ?? 0;
  el.bscoreTrackers.textContent = ts;
  el.bbarTrackers.style.width   = `${(ts / caps.trackers) * 100}%`;
  el.bsubTrackers.textContent   = trackerCount > 0
    ? `${trackerCount} likely tracking indicator${trackerCount !== 1 ? 's' : ''} detected`
    : 'No trackers detected';

  // Fingerprinting
  const fp = breakdown.fingerprinting ?? 0;
  el.bscoreFp.textContent = fp;
  el.bbarFp.style.width   = `${(fp / caps.fingerprinting) * 100}%`;
  el.bsubFp.textContent   = fpCount > 0
    ? `${fpCount} possible FP signal${fpCount !== 1 ? 's' : ''} detected`
    : 'No fingerprinting detected';

  // Cookies
  const cs = breakdown.cookies ?? 0;
  el.bscoreCookies.textContent = cs;
  el.bbarCookies.style.width   = `${(cs / caps.cookies) * 100}%`;
  el.bsubCookies.textContent   = cookieCount > 0
    ? `${cookieCount} cookie${cookieCount !== 1 ? 's' : ''} observed`
    : 'No cookies observed';

  // Consent
  const co = breakdown.consent ?? 0;
  const darkPatterns = (consentEvents ?? [])
    .flatMap(e => e.patterns ?? []).length;
  el.bscoreConsent.textContent = co;
  el.bbarConsent.style.width   = `${(co / caps.consent) * 100}%`;
  el.bsubConsent.textContent   = darkPatterns > 0
    ? `${darkPatterns} dark pattern${darkPatterns !== 1 ? 's' : ''} detected`
    : (consentEvents?.length > 0 ? 'Consent banner detected' : 'No consent banner');
}

function renderExplanations(explanations) {
  if (!explanations || explanations.length === 0) {
    el.explainList.textContent = '';
    const emptyLi = document.createElement('li');
    emptyLi.className = 'explain-empty';
    emptyLi.textContent = 'No privacy signals detected on this page.';
    el.explainList.appendChild(emptyLi);
    return;
  }

  el.explainList.textContent = '';

  // Group and sort: highest points first
  const sorted = [...explanations].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  for (const item of sorted) {
    const pts     = item.points ?? 0;
    const isPos   = pts >= 0;
    const ptsText = isPos ? `+${pts}` : `${pts}`;
    const ptsCls  = isPos ? 'positive' : 'negative';

    const li = document.createElement('li');
    li.className = 'explain-item';

    const body = document.createElement('div');
    body.className = 'explain-body';

    const label = document.createElement('span');
    label.className = 'explain-label';
    label.textContent = item.label ?? item.rule ?? '';
    body.appendChild(label);

    const desc = document.createElement('span');
    desc.className = 'explain-desc';
    desc.textContent = item.description ?? '';
    body.appendChild(desc);
    li.appendChild(body);

    const ptsSpan = document.createElement('span');
    ptsSpan.className = `explain-pts ${ptsCls}`;
    ptsSpan.setAttribute('aria-label', `${ptsText} points`);
    ptsSpan.textContent = ptsText;
    li.appendChild(ptsSpan);
    el.explainList.appendChild(li);
  }
}

function renderDetailedAudits(report) {
  const { trackers = [], fpSignals = [] } = report;

  // Trackers
  if (trackers.length > 0) {
    el.trackerAuditGroup.hidden = false;
    el.trackerList.textContent = '';
    trackers.forEach(t => {
      const item = document.createElement('div');
      item.className = 'audit-item';
      
      const icon = document.createElement('div');
      icon.className = 'audit-item-icon';
      icon.textContent = '🎯';
      
      const body = document.createElement('div');
      body.className = 'audit-item-body';
      const title = document.createElement('div');
      title.className = 'audit-item-title';
      title.textContent = t.company || t.domain;
      const sub = document.createElement('div');
      sub.className = 'audit-item-sub';
      sub.textContent = `${t.domain} • ${t.category || 'tracker'}`;
      body.appendChild(title);
      body.appendChild(sub);
      
      const badge = document.createElement('div');
      badge.className = 'audit-item-badge';
      badge.style.background = 'rgba(218,54,51,0.1)';
      badge.style.color = 'var(--red)';
      badge.style.border = '1px solid rgba(218,54,51,0.2)';
      badge.textContent = t.severity || 'high';
      
      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(badge);
      el.trackerList.appendChild(item);
    });
  } else {
    el.trackerAuditGroup.hidden = true;
  }

  // Fingerprinting
  if (fpSignals.length > 0) {
    el.fpAuditGroup.hidden = false;
    el.fpList.textContent = '';
    fpSignals.forEach(f => {
      const item = document.createElement('div');
      item.className = 'audit-item';
      
      const icon = document.createElement('div');
      icon.className = 'audit-item-icon';
      icon.textContent = '🔍';
      
      const body = document.createElement('div');
      body.className = 'audit-item-body';
      const title = document.createElement('div');
      title.className = 'audit-item-title';
      title.textContent = `${f.api || f.type || 'Unknown'} API Access`;
      const sub = document.createElement('div');
      sub.className = 'audit-item-sub';
      sub.textContent = `${f.indicator ? f.indicator + ' · ' : ''}${f.confidence || 'low'} confidence`;
      body.appendChild(title);
      body.appendChild(sub);
      
      const badge = document.createElement('div');
      badge.className = 'audit-item-badge';
      badge.style.background = 'rgba(137,87,229,0.1)';
      badge.style.color = 'var(--purple)';
      badge.style.border = '1px solid rgba(137,87,229,0.2)';
      badge.textContent = 'Detected';
      
      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(badge);
      el.fpList.appendChild(item);
    });
  } else {
    el.fpAuditGroup.hidden = true;
  }
}

function renderRecommendations(report) {
  const { score, breakdown, trackerCount, fpCount, cookieCount, consentEvents } = report;
  const recos = [];

  if (score >= 60) {
    recos.push('Consider using a privacy-focused browser to limit tracking.');
  }
  if ((breakdown?.trackers ?? 0) >= 20) {
    recos.push('Consider an ad blocker to reduce tracking exposure.');
  }
  if ((breakdown?.fingerprinting ?? 0) >= 15) {
    recos.push('Consider enabling fingerprinting resistance in your browser settings.');
  }
  if ((breakdown?.cookies ?? 0) >= 10) {
    recos.push('Regularly clear cookies or use a browser with cookie protection.');
  }
  if ((consentEvents ?? []).flatMap(e => e.patterns ?? []).length > 0) {
    recos.push('Possible manipulative consent UI detected — exercise caution with cookie choices.');
  }
  if (score <= 20 && score > 0) {
    recos.push('This site has low detection of privacy risks.');
  }

  if (recos.length === 0) return;

  el.recoSection.hidden = false;
  el.recoList.textContent = '';
  recos.forEach(r => {
    const li = document.createElement('li');
    li.className = 'reco-item';
    const bullet = document.createElement('span');
    bullet.className = 'reco-bullet';
    bullet.setAttribute('aria-hidden', 'true');
    bullet.textContent = '→';
    const text = document.createElement('span');
    text.textContent = r;
    li.appendChild(bullet);
    li.appendChild(text);
    el.recoList.appendChild(li);
  });
}

function renderTrustToggle(isTrusted, domain) {
  el.btnTrustToggle.classList.toggle('trusted', isTrusted);
  el.btnTrustToggle.title      = isTrusted ? 'Remove from trusted sites' : 'Add to trusted sites';
  el.btnTrustToggle.setAttribute('aria-label',
    isTrusted ? 'Remove from trusted sites' : 'Add to trusted sites');
  el.trustBadge.hidden         = !isTrusted;
  el.trustStatus.hidden        = !isTrusted;
  el.trustToggleIcon.textContent = isTrusted ? '🛡' : '○';
}

function renderReport(report) {
  const {
    domain, score, severity, isTrusted, isDemo, breakdown, explanations,
    totalRequests, thirdPartyRequests, trackerRequests,
    trackerCount, fpCount, cookieCount, consentEvents,
  } = report;

  // Site bar
  el.siteDomain.textContent = domain || '—';
  el.siteDomain.title       = domain || '';
  if (domain) {
    // Do NOT fetch from Google favicons service — that would leak the domain name.
    // Show a generic placeholder icon instead.
    el.siteFavicon.src = '../icons/icon16.png';
    el.siteFavicon.onerror = () => { el.siteFavicon.removeAttribute('src'); };
  }

  // Trust
  renderTrustToggle(isTrusted, domain);

  // Demo badge
  if (isDemo && DEV_MODE) el.demoBadge.hidden = false;

  // Score ring
  renderScore(score, severity);

  // Score meta
  const lastSeen = report.timestamp
    ? new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';
  el.scoreMeta.textContent = '';
  const metaText = document.createElement('strong');
  metaText.textContent = `${score}/100`;
  el.scoreMeta.appendChild(metaText);
  el.scoreMeta.appendChild(document.createTextNode(` privacy exposure · ${lastSeen}`));

  if (isDemo) {
    el.scoreMeta.appendChild(document.createElement('br'));
    const demoWarning = document.createElement('em');
    demoWarning.style.color = 'var(--amber)';
    demoWarning.textContent = '⚠ Demo data — not real';
    el.scoreMeta.appendChild(demoWarning);
  }

  // Breakdown
  renderBreakdown(breakdown, trackerCount, fpCount, cookieCount, consentEvents);

  // Explanations
  renderExplanations(explanations);

  // Detailed Audits
  renderDetailedAudits(report);

  // Recommendations
  renderRecommendations(report);

  // Network counters
  animateCounter(el.totalReqCount,      totalRequests      ?? 0);
  animateCounter(el.thirdPartyReqCount, thirdPartyRequests ?? 0);
  animateCounter(el.trackerReqCount,    trackerRequests    ?? 0);

  // Dev panel
  if (DEV_MODE) {
    el.diagVisit.textContent = report.visitId ?? '—';
  }
}

// ─── Trusted Toggle Action ────────────────────────────────────────────────────

let _currentDomain = '';

async function handleTrustToggle() {
  if (!_currentDomain) return;
  try {
    el.btnTrustToggle.disabled = true;
    const result = await sendMessage(MSG.TOGGLE_TRUSTED, { domain: _currentDomain });
    renderTrustToggle(result.isTrusted, _currentDomain);
  } catch (err) {
    console.error('[TrackerLens Popup] Trust toggle failed:', err);
  } finally {
    el.btnTrustToggle.disabled = false;
  }
}

// ─── Explanation Toggle ───────────────────────────────────────────────────────

function initExplanationToggle() {
  const btn = $('btnExplain');
  const panel = $('explainPanel');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const isCollapsed = panel.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded', !isCollapsed);
    btn.classList.toggle('rotated', isCollapsed);
  });
}

// ─── App Logic ────────────────────────────────────────────────────────────────

async function loadData() {
  try {
    showLoading();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');

    if (DEV_MODE) el.diagTab.textContent = tab.id;

    const report = await sendMessage(MSG.GET_TAB_REPORT, { tabId: tab.id, url: tab.url });

    _currentDomain = report.domain ?? '';
    renderReport(report);
    showMain();
    setStatus('active');
  } catch (err) {
    console.error('[TrackerLens Popup] Failed to load data:', err);
    if (err.message.includes('Extension context invalidated') || err.message.includes('No active tab found')) {
      showError('Detection unavailable on this page');
    } else {
      showError('Detection unavailable on this page');
    }
    setStatus('error', 'ERR');
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────

function init() {
  // Navigation
  el.navHistory.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history/history.html') });
  });
  el.navSummary.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('summary/summary.html') });
  });
  el.navSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Trust toggle
  el.btnTrustToggle.addEventListener('click', handleTrustToggle);

  // Explanation panel
  initExplanationToggle();

  // Retry button
  el.btnRetry.addEventListener('click', loadData);

  // Dev mode
  if (DEV_MODE) {
    el.navDev.hidden = false;
    el.navDev.addEventListener('click', () => {
      el.devPanel.hidden = !el.devPanel.hidden;
    });

    el.btnLoadDemo.addEventListener('click', async () => {
      try {
        el.btnLoadDemo.disabled    = true;
        el.btnLoadDemo.textContent = 'Loading…';
        await sendMessage(MSG.LOAD_DEMO);
        await loadData();
      } catch (err) {
        console.error('Demo load failed', err);
      } finally {
        el.btnLoadDemo.disabled    = false;
        el.btnLoadDemo.textContent = 'Load Demo';
      }
    });

    el.btnRefresh.addEventListener('click', loadData);

    // Ping loop for dev diagnostics
    setInterval(async () => {
      if (el.devPanel.hidden) return;
      const t = performance.now();
      try {
        await sendMessage(MSG.PING);
        el.diagMsg.textContent = 'OK';
        el.diagMsg.className   = 'dev-val ok';
        el.diagPing.textContent = `${Math.round(performance.now() - t)}ms`;
      } catch {
        el.diagMsg.textContent = 'ERR';
        el.diagMsg.className   = 'dev-val err';
      }
    }, 2000);
  } else {
    el.navDev.hidden = true;
  }

  loadData();
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
