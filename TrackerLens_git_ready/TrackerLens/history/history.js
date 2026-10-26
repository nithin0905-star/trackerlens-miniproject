/**
 * TrackerLens — History Script (Phase 4)
 * Loads and renders the audit history from IndexedDB.
 * Adds: sort by date/score/domain, domain detail panel, CSV export.
 */
import { MSG, DEV_MODE } from '../shared/config.js';
import { exportAsJSON, exportVisitsCSV } from '../report/exporter.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (!response?.success)       { reject(new Error(response?.error ?? 'Error')); return; }
      resolve(response.data);
    });
  });
}

function formatTime(timestamp) {
  if (!timestamp) return '—';
  const d     = new Date(timestamp);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function riskLabel(level) {
  return {
    none: 'None', low: 'Low', moderate: 'Moderate',
    high: 'High', very_high: 'Very High', critical: 'Critical',
  }[level] ?? '—';
}

const RING_CIRCUM = 126;
function scoreToOffset(score) { return RING_CIRCUM - (score / 100) * RING_CIRCUM; }

const RISK_STROKE = {
  none:      '#445f7a',
  low:       '#10b981',
  moderate:  '#f59e0b',
  high:      '#ef4444',
  very_high: '#dc2626',
  critical:  '#8b5cf6',
};

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderVisitCard(visit) {
  const {
    id, domain, url, timestamp, score = 0, riskLevel = 'none',
    trackerCount = 0, fpCount = 0, cookieCount = 0, isDemo = false, isTrusted = false,
  } = visit;

  const stroke = RISK_STROKE[riskLevel] ?? RISK_STROKE.none;
  const offset = scoreToOffset(score);

  const li = document.createElement('li');
  li.className   = 'visit-card fade-in';
  li.dataset.risk   = riskLevel;
  li.dataset.domain = domain ?? '';
  li.dataset.id     = id;
  li.setAttribute('role', 'listitem');
  li.setAttribute('tabindex', '0');
  li.setAttribute('aria-label', `${domain}, score ${score}, risk ${riskLabel(riskLevel)}`);

  // We use DOMParser to safely inject HTML without innerHTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(`
    <div class="vc-left">
      <img src="../icons/icon16.png" class="vc-favicon" width="16" height="16" alt="" aria-hidden="true">
      <div class="vc-info">
        <span class="vc-domain" title="${escHtml(url ?? domain)}">${escHtml(domain || url || '—')}</span>
        <span class="vc-time">${formatTime(timestamp)}</span>
      </div>
    </div>

    <div class="vc-mid">
      <div class="vc-metric">
        <span class="vc-metric-icon">🎯</span>
        <span class="vc-metric-val trackers">${trackerCount}</span>
      </div>
      <div class="vc-metric">
        <span class="vc-metric-icon">🔍</span>
        <span class="vc-metric-val fp">${fpCount}</span>
      </div>
      <div class="vc-metric">
        <span class="vc-metric-icon">🍪</span>
        <span class="vc-metric-val cookies">${cookieCount}</span>
      </div>
    </div>

    <div class="vc-right">
      <span class="risk-badge risk-${riskLevel}">${riskLabel(riskLevel)}</span>
      <div class="vc-score">${score > 0 ? score : '—'}<span>/100</span></div>
    </div>
  `, 'text/html');

  li.textContent = '';
  while (doc.body.firstChild) {
    li.appendChild(doc.body.firstChild);
  }

  // Click / enter → show domain detail
  const openDetail = () => showDomainDetail(visit);
  li.addEventListener('click', openDetail);
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openDetail(); });

  return li;
}

// ─── Domain Detail Panel ─────────────────────────────────────────────────────

function showDomainDetail(visit) {
  const panel  = $('domainDetail');
  const title  = $('detailDomain');
  const body   = $('detailBody');
  const stroke = RISK_STROKE[visit.riskLevel] ?? RISK_STROKE.none;

  title.textContent = visit.domain || visit.url || '—';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`
    <div class="detail-score-row">
      <span class="ds-val" style="color:${stroke}">${visit.score ?? 0}</span>
      <span class="risk-badge risk-${visit.riskLevel}">${riskLabel(visit.riskLevel)}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-cell">
        <span class="detail-val" style="color:var(--red)">${visit.trackerCount ?? 0}</span>
        <span class="detail-key">Trackers</span>
      </div>
      <div class="detail-cell">
        <span class="detail-val" style="color:var(--purple)">${visit.fpCount ?? 0}</span>
        <span class="detail-key">FP Signals</span>
      </div>
      <div class="detail-cell">
        <span class="detail-val" style="color:var(--amber)">${visit.cookieCount ?? 0}</span>
        <span class="detail-key">Cookies</span>
      </div>
      <div class="detail-cell">
        <span class="detail-val" style="color:var(--cyan)">${visit.consentEvents?.length ? 'Yes' : 'No'}</span>
        <span class="detail-key">Consent</span>
      </div>
    </div>
    <div class="detail-meta">
      <div><strong>Last visited:</strong> ${formatTime(visit.timestamp)}</div>
      <div><strong>URL:</strong> <span style="font-family:var(--font-mono);">${escHtml(visit.url ?? '—')}</span></div>
      ${visit.isTrusted ? '<div style="margin-top:8px;color:var(--cyan);"><strong>Status:</strong> 🛡 Trusted site (alerts suppressed)</div>' : ''}
    </div>
    <div class="detail-actions">
      <button class="btn btn-ghost detail-trust-btn" data-domain="${escHtml(visit.domain ?? '')}"
              data-trusted="${visit.isTrusted}">
        ${visit.isTrusted ? '🛡 Remove from trusted' : '+ Add to trusted sites'}
      </button>
    </div>
  `, 'text/html');

  body.textContent = '';
  while (doc.body.firstChild) {
    body.appendChild(doc.body.firstChild);
  }

  // Trust toggle from detail panel
  body.querySelector('.detail-trust-btn')?.addEventListener('click', async (e) => {
    const btn    = e.currentTarget;
    const domain = btn.dataset.domain;
    try {
      btn.disabled = true;
      const res    = await sendMessage(MSG.TOGGLE_TRUSTED, { domain });
      btn.textContent = res.isTrusted ? '🛡 Remove from trusted' : '+ Add to trusted';
      btn.dataset.trusted = res.isTrusted;
    } catch (err) {
      console.error('[TrackerLens History] Trust toggle failed:', err);
    } finally {
      btn.disabled = false;
    }
  });

  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
}

$('btnDetailClose').addEventListener('click', () => {
  $('domainDetail').hidden = true;
});

// ─── Data Loading ──────────────────────────────────────────────────────────────

let _allVisits      = [];
let _currentFilter  = 'all';
let _searchQuery    = '';
let _sortKey        = 'date';
let _sortAsc        = false;

function applyFilters() {
  const list = $('visitList');
  list.textContent = '';

  let filtered = _allVisits.filter(v => {
    if (_currentFilter !== 'all' && v.riskLevel !== _currentFilter) return false;
    if (_searchQuery && !v.domain?.toLowerCase().includes(_searchQuery)) return false;
    return true;
  });

  // Sort
  filtered = filtered.sort((a, b) => {
    let valA, valB;
    if (_sortKey === 'date')   { valA = a.timestamp ?? 0;  valB = b.timestamp ?? 0; }
    if (_sortKey === 'score')  { valA = a.score ?? 0;      valB = b.score ?? 0; }
    if (_sortKey === 'domain') { valA = a.domain ?? '';     valB = b.domain ?? ''; }
    if (typeof valA === 'string') return _sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return _sortAsc ? valA - valB : valB - valA;
  });

  if (filtered.length === 0) {
    $('emptyState').hidden = false;
    list.hidden = true;
    return;
  }

  $('emptyState').hidden = true;
  list.hidden = false;

  for (const visit of filtered) {
    list.appendChild(renderVisitCard(visit));
  }
}

async function loadHistory() {
  try {
    _allVisits = await sendMessage(MSG.GET_HISTORY, { limit: 200 });
    $('loadingState').hidden = true;

    if (!_allVisits || _allVisits.length === 0) {
      $('emptyState').hidden = false;
      $('visitList').hidden  = true;
      return;
    }

    $('visitList').hidden = false;
    applyFilters();
  } catch (err) {
    const stateEl = $('loadingState');
    stateEl.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'empty-state';
    
    const icon = document.createElement('span');
    icon.className = 'empty-icon';
    icon.textContent = '⚠️';
    errDiv.appendChild(icon);
    
    const title = document.createElement('div');
    title.className = 'empty-title';
    title.textContent = 'Failed to Load History';
    errDiv.appendChild(title);
    
    const desc = document.createElement('p');
    desc.className = 'empty-desc';
    desc.textContent = err.message;
    errDiv.appendChild(desc);
    
    stateEl.appendChild(errDiv);
  }
}

async function loadDailyStats() {
  try {
    const stats = await sendMessage(MSG.GET_DAILY_STATS);
    $('statVisits').textContent   = stats?.visits       ?? 0;
    $('statTrackers').textContent = stats?.trackers     ?? 0;
    $('statFp').textContent       = stats?.fingerprints ?? 0;
    $('statCookies').textContent  = stats?.cookies      ?? 0;
  } catch {
    // Non-fatal
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

$('searchInput').addEventListener('input', (e) => {
  _searchQuery = e.target.value.toLowerCase().trim();
  applyFilters();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('active');
    chip.setAttribute('aria-pressed', 'true');
    _currentFilter = chip.dataset.filter;
    applyFilters();
  });
});

// Sort buttons
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    if (_sortKey === key) {
      _sortAsc = !_sortAsc;
    } else {
      _sortKey = key;
      _sortAsc = key === 'domain'; // Alphabetical ascending by default
    }
    document.querySelectorAll('.sort-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    updateSortDir();
    applyFilters();
  });
});

function updateSortDir() {
  const dirBtn = $('sortDir');
  dirBtn.textContent = _sortAsc ? '▲' : '▼';
  dirBtn.setAttribute('aria-label', `Sort direction: ${_sortAsc ? 'ascending' : 'descending'}`);
}

$('sortDir').addEventListener('click', () => {
  _sortAsc = !_sortAsc;
  updateSortDir();
  applyFilters();
});

// JSON export
$('btnExport').addEventListener('click', async () => {
  try {
    const data = await sendMessage(MSG.EXPORT_DATA);
    exportAsJSON(data);
  } catch (err) {
    console.error('[TrackerLens History] JSON export failed:', err);
  }
});

// CSV export
$('btnExportCSV').addEventListener('click', async () => {
  try {
    const rows = await sendMessage(MSG.EXPORT_CSV);
    exportVisitsCSV(rows);
  } catch (err) {
    console.error('[TrackerLens History] CSV export failed:', err);
  }
});

$('btnSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function loadDemo() {
  try {
    await sendMessage(MSG.LOAD_DEMO);
    await loadHistory();
    await loadDailyStats();
  } catch (err) {
    console.error('[TrackerLens History] Demo load failed:', err);
  }
}

$('btnLoadDemo')?.addEventListener('click', loadDemo);
$('btnLoadDemoEmpty')?.addEventListener('click', loadDemo);

if (!DEV_MODE) {
  $('btnLoadDemo').hidden = true;
}

// ─── Start ────────────────────────────────────────────────────────────────────
loadHistory();
loadDailyStats();
