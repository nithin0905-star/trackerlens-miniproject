/**
 * TrackerLens — Options Script (Phase 4)
 * Handles settings persistence, trusted sites management, import/export.
 * Phase 4: adds consent weight, 4-weight validation, trusted site toggle via message.
 */
import { MSG, DEV_MODE, APP_VERSION } from '../shared/config.js';
import { DEFAULT_SETTINGS } from '../storage/defaults.js';
import { exportAsJSON, exportVisitsCSV, importSettings } from '../report/exporter.js';

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

function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = (type === 'success' ? '✓ ' : '✗ ') + message;
  toast.className   = `toast ${type} show`;
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function toggleValue(inputEl, valueEl, unit = '%') {
  if (!inputEl || !valueEl) return;
  inputEl.addEventListener('input', () => {
    valueEl.textContent = inputEl.value + unit;
    updateWeightTotal();
  });
}

function updateWeightTotal() {
  const t  = parseInt($('weightTrackers').value,       10) || 0;
  const f  = parseInt($('weightFingerprinting').value, 10) || 0;
  const c  = parseInt($('weightCookies').value,        10) || 0;
  const co = parseInt($('weightConsent').value,        10) || 0;
  const total = t + f + c + co;
  const el = $('weightTotal');
  el.textContent = total + '%';
  el.style.color = total === 100 ? 'var(--green)' : 'var(--red)';

  const saveBtn = $('btnSaveScoring');
  if (saveBtn) {
    saveBtn.disabled = total !== 100;
    saveBtn.title    = total !== 100 ? `Weights must sum to 100 (currently ${total}%)` : '';
  }
}

// ─── Settings Load / Save ─────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const settings = await sendMessage(MSG.GET_SETTINGS);

    $('scoringEnabled').checked       = settings.scoringEnabled       ?? true;
    $('weightTrackers').value         = settings.weightTrackers       ?? 40;
    $('weightFingerprinting').value   = settings.weightFingerprinting ?? 30;
    $('weightCookies').value          = settings.weightCookies        ?? 20;
    $('weightConsent').value          = settings.weightConsent        ?? 10;
    $('showRiskBadge').checked        = settings.showRiskBadge        ?? true;
    $('showTrackerCount').checked     = settings.showTrackerCount     ?? true;
    $('showFpCount').checked          = settings.showFpCount          ?? true;
    $('showCookieCount').checked      = settings.showCookieCount      ?? true;
    $('showExplanations').checked     = settings.showExplanations     ?? true;
    $('retentionDays').value          = settings.retentionDays        ?? 30;
    $('autoDeleteOld').checked        = settings.autoDeleteOld        ?? true;
    $('trackerListEnabled').checked   = settings.trackerListEnabled   ?? true;

    // Update display values
    $('val-weightTrackers').textContent       = ($('weightTrackers').value)       + '%';
    $('val-weightFingerprinting').textContent = ($('weightFingerprinting').value) + '%';
    $('val-weightCookies').textContent        = ($('weightCookies').value)        + '%';
    $('val-weightConsent').textContent        = ($('weightConsent').value)        + '%';
    updateWeightTotal();

  } catch (err) {
    showToast('Failed to load settings: ' + err.message, 'error');
  }
}

async function saveSettings(keys) {
  const all = {
    scoringEnabled:       $('scoringEnabled').checked,
    weightTrackers:       parseInt($('weightTrackers').value,       10),
    weightFingerprinting: parseInt($('weightFingerprinting').value, 10),
    weightCookies:        parseInt($('weightCookies').value,        10),
    weightConsent:        parseInt($('weightConsent').value,        10),
    showRiskBadge:        $('showRiskBadge').checked,
    showTrackerCount:     $('showTrackerCount').checked,
    showFpCount:          $('showFpCount').checked,
    showCookieCount:      $('showCookieCount').checked,
    showExplanations:     $('showExplanations').checked,
    retentionDays:        parseInt($('retentionDays').value, 10),
    autoDeleteOld:        $('autoDeleteOld').checked,
    trackerListEnabled:   $('trackerListEnabled').checked,
  };

  // Validate weight total before saving scoring settings
  if (!keys || keys.includes('weightTrackers')) {
    const total = all.weightTrackers + all.weightFingerprinting + all.weightCookies + all.weightConsent;
    if (total !== 100) {
      showToast(`Weights must sum to 100 (currently ${total}%)`, 'error');
      return;
    }
  }

  const toSave = keys
    ? Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k)))
    : all;

  try {
    await sendMessage(MSG.SAVE_SETTINGS, { settings: toSave });
    showToast('Settings saved.');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

// ─── Trusted Sites ────────────────────────────────────────────────────────────

let _trustedSites = [];

async function loadTrustedSites() {
  try {
    const domains = await sendMessage(MSG.GET_TRUSTED_SITES);
    _trustedSites = Array.isArray(domains) ? domains : [];
    renderTrustedList(_trustedSites);
  } catch (err) {
    console.error('[TrackerLens Options] Failed to load trusted sites:', err);
  }
}

function renderTrustedList(sites) {
  const list = $('trustedList');
  list.textContent = ''; // clear

  if (!sites || sites.length === 0) {
    const empty = document.createElement('li');
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '12px';
    empty.style.padding = '8px 0';
    empty.textContent = 'No trusted sites added yet.';
    list.appendChild(empty);
    return;
  }

  sites.forEach(domain => {
    const li = document.createElement('li');
    li.className = 'trusted-item';
    
    const span = document.createElement('span');
    span.className = 'trusted-domain';
    span.textContent = domain;
    li.appendChild(span);

    const btn = document.createElement('button');
    btn.className = 'trusted-remove';
    btn.dataset.domain = domain;
    btn.setAttribute('aria-label', `Remove ${domain} from trusted sites`);
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => removeTrusted(domain));
    li.appendChild(btn);

    list.appendChild(li);
  });
}

async function addTrusted() {
  const input  = $('trustedInput');
  const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0];
  if (!domain) return;
  if (_trustedSites.includes(domain)) { showToast('Already trusted.'); return; }

  try {
    await sendMessage(MSG.TOGGLE_TRUSTED, { domain });
    _trustedSites.push(domain);
    renderTrustedList(_trustedSites);
    input.value = '';
    showToast(`${domain} added to trusted sites. Auditing continues — alerts suppressed.`);
  } catch (err) {
    showToast('Failed to add trusted site: ' + err.message, 'error');
  }
}

async function removeTrusted(domain) {
  try {
    await sendMessage(MSG.TOGGLE_TRUSTED, { domain });
    _trustedSites = _trustedSites.filter(d => d !== domain);
    renderTrustedList(_trustedSites);
    showToast(`${domain} removed from trusted sites.`);
  } catch (err) {
    showToast('Failed to remove: ' + err.message, 'error');
  }
}

// ─── Export / Import ──────────────────────────────────────────────────────────

async function handleExportJSON() {
  try {
    const data = await sendMessage(MSG.EXPORT_DATA);
    exportAsJSON(data);
    showToast('Export downloaded.');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

async function handleExportCSV() {
  try {
    const rows = await sendMessage(MSG.EXPORT_CSV);
    exportVisitsCSV(rows);
    showToast('CSV downloaded.');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

function handleImport() {
  const file = $('importFile').files[0];
  if (!file) { showToast('Please select a JSON file.', 'error'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const settings = importSettings(e.target.result);
      await sendMessage(MSG.SAVE_SETTINGS, { settings });
      await loadSettings();
      showToast('Settings imported successfully.');
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────

async function handleClearData() {
  if (!confirm('Clear all visit history, tracker records, and fingerprint data? Settings will be preserved.')) return;
  try {
    await sendMessage(MSG.RESET_DATA, { full: false });
    showToast('All data cleared.');
  } catch (err) {
    showToast('Clear failed: ' + err.message, 'error');
  }
}

async function handleFactoryReset() {
  if (!confirm('⚠️ Factory reset will delete ALL data including settings. This cannot be undone. Continue?')) return;
  try {
    await sendMessage(MSG.RESET_DATA, { full: true });
    await loadSettings();
    showToast('Factory reset complete.');
  } catch (err) {
    showToast('Reset failed: ' + err.message, 'error');
  }
}

// ─── Tracker DB Count ─────────────────────────────────────────────────────────

async function loadTrackerDbCount() {
  try {
    const url  = chrome.runtime.getURL('data/tracker_domains.json');
    const resp = await fetch(url);
    const data = await resp.json();
    $('trackerDbCount').textContent = `${data.trackers.length} entries`;
  } catch {
    $('trackerDbCount').textContent = 'Unavailable';
  }
}

// ─── Section Navigation ───────────────────────────────────────────────────────

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.options-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`section-${sectionId}`)?.classList.add('active');
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  $('versionBadge').textContent = `v${APP_VERSION ?? '0.4.0'}`;

  initNavigation();

  loadSettings();
  loadTrustedSites();
  loadTrackerDbCount();

  // Slider display values (all 4 weights)
  toggleValue($('weightTrackers'),       $('val-weightTrackers'));
  toggleValue($('weightFingerprinting'), $('val-weightFingerprinting'));
  toggleValue($('weightCookies'),        $('val-weightCookies'));
  toggleValue($('weightConsent'),        $('val-weightConsent'));

  // Save scoring
  $('btnSaveScoring').addEventListener('click', () =>
    saveSettings(['scoringEnabled', 'weightTrackers', 'weightFingerprinting', 'weightCookies', 'weightConsent']));

  // Reset scoring to defaults
  $('btnResetScoring').addEventListener('click', async () => {
    $('weightTrackers').value       = DEFAULT_SETTINGS.weightTrackers;
    $('weightFingerprinting').value = DEFAULT_SETTINGS.weightFingerprinting;
    $('weightCookies').value        = DEFAULT_SETTINGS.weightCookies;
    $('weightConsent').value        = DEFAULT_SETTINGS.weightConsent;
    $('val-weightTrackers').textContent       = DEFAULT_SETTINGS.weightTrackers       + '%';
    $('val-weightFingerprinting').textContent = DEFAULT_SETTINGS.weightFingerprinting + '%';
    $('val-weightCookies').textContent        = DEFAULT_SETTINGS.weightCookies        + '%';
    $('val-weightConsent').textContent        = DEFAULT_SETTINGS.weightConsent        + '%';
    updateWeightTotal();
    showToast('Reset to defaults — click Save to apply.');
  });

  $('btnSaveDisplay').addEventListener('click', () =>
    saveSettings(['showRiskBadge', 'showTrackerCount', 'showFpCount', 'showCookieCount', 'showExplanations']));
  $('btnSaveData').addEventListener('click', () =>
    saveSettings(['retentionDays', 'autoDeleteOld']));
  $('btnSaveTrackers').addEventListener('click', () =>
    saveSettings(['trackerListEnabled']));

  // Trusted sites
  $('btnAddTrusted').addEventListener('click', addTrusted);
  $('trustedInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTrusted(); });

  // Export / Import
  $('btnExportJSON').addEventListener('click', handleExportJSON);
  $('btnExportCSV').addEventListener('click', handleExportCSV);
  $('btnImportSettings').addEventListener('click', handleImport);

  // Danger zone
  $('btnClearData').addEventListener('click', handleClearData);
  $('btnFactoryReset').addEventListener('click', handleFactoryReset);
}

init();
