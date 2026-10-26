/**
 * TrackerLens — Weekly Summary Script (Phase 4)
 *
 * Loads 7-day aggregated data from the service worker and renders:
 *   - 8 key metric cards
 *   - Daily score bar chart (Canvas API — no external libraries)
 *   - Daily tracker bar chart (Canvas API)
 *   - Risk level distribution bars
 *   - Score interpretation panel
 *
 * Zero external dependencies — all charts via Canvas 2D API.
 */
import { MSG } from '../shared/config.js';

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

function scoreToColor(score) {
  if (score <= 20)  return '#10b981'; // green
  if (score <= 40)  return '#f59e0b'; // amber
  if (score <= 60)  return '#ef4444'; // red
  if (score <= 80)  return '#dc2626'; // crimson
  return '#8b5cf6';                   // purple
}

function shortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Canvas Chart Renderer ────────────────────────────────────────────────────

/**
 * Draws a labelled bar chart on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {{label: string, value: number, color: string}[]} bars
 * @param {{ maxValue?: number, yLabel?: string }} opts
 */
function drawBarChart(canvas, bars, opts = {}) {
  const dpr    = window.devicePixelRatio || 1;
  const w      = canvas.offsetWidth  || 700;
  const h      = canvas.offsetHeight || 200;

  canvas.width  = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!bars || bars.length === 0) return;

  const maxVal = opts.maxValue ?? Math.max(...bars.map(b => b.value), 1);
  const paddingLeft  = 36;
  const paddingRight = 12;
  const paddingTop   = 12;
  const paddingBot   = 10;
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBot;
  const barW   = (chartW / bars.length) * 0.6;
  const gap    = (chartW / bars.length) * 0.4;

  // Y grid lines
  const gridLines = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= gridLines; i++) {
    const y = paddingTop + chartH - (i / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartW, y);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = 'rgba(138,171,200,0.7)';
    ctx.font      = `${9 * dpr / dpr}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i / gridLines) * maxVal), paddingLeft - 4, y + 3);
  }

  // Bars
  bars.forEach((bar, i) => {
    const x      = paddingLeft + i * (chartW / bars.length) + (gap / 2);
    const barH   = bar.value > 0 ? (bar.value / maxVal) * chartH : 0;
    const y      = paddingTop + chartH - barH;
    const radius = Math.min(4, barW / 2);

    // Bar fill with rounded top
    ctx.fillStyle = bar.color ?? '#00d2ff';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Value label above bar
    if (bar.value > 0) {
      ctx.fillStyle = 'rgba(228,240,252,0.9)';
      ctx.font      = `bold ${10}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(bar.value, x + barW / 2, y - 4);
    }
  });
}

// ─── Render Functions ─────────────────────────────────────────────────────────

function renderMetrics(data) {
  $('metSites').textContent     = data.sitesVisited    ?? 0;
  $('metAvgScore').textContent  = data.avgScore        ?? 0;
  $('metHighScore').textContent = data.highScore       ?? 0;
  $('metLowScore').textContent  = data.lowScore        ?? 0;
  $('metTrackers').textContent  = data.uniqueTrackers  ?? 0;
  $('metFp').textContent        = data.fingerprintingEvents ?? 0;
  $('metRequests').textContent  = data.trackingRequests ?? 0;
  $('metConsent').textContent   = data.consentWarnings ?? 0;
}

function renderScoreChart(chartData) {
  const canvas = $('scoreChart');
  if (!chartData || chartData.length === 0) {
    $('chartEmpty').hidden = false;
    return;
  }

  const bars = chartData.map(d => ({
    label: d.date,
    value: d.score,
    color: scoreToColor(d.score),
  }));

  // X-axis date labels
  const xLabels = $('chartXLabels');
  xLabels.textContent = '';
  bars.forEach(b => {
    const span = document.createElement('span');
    span.textContent = shortDate(b.label);
    xLabels.appendChild(span);
  });

  // Wait for layout
  requestAnimationFrame(() => {
    drawBarChart(canvas, bars, { maxValue: 100 });
  });
}

function renderTrackerChart(chartData) {
  const canvas = $('trackerChart');
  if (!chartData || chartData.length === 0) {
    $('trackerChartEmpty').hidden = false;
    return;
  }

  const bars = chartData.map(d => ({
    label: d.date,
    value: d.trackers,
    color: '#ef4444',
  }));

  const xLabels = $('trackerChartXLabels');
  xLabels.textContent = '';
  bars.forEach(b => {
    const span = document.createElement('span');
    span.textContent = shortDate(b.label);
    xLabels.appendChild(span);
  });

  requestAnimationFrame(() => {
    drawBarChart(canvas, bars, { maxValue: Math.max(...bars.map(b => b.value), 5) });
  });
}

function renderRiskDistribution(chartData) {
  if (!chartData || chartData.length === 0) return;

  // Count visits per risk tier from score data
  const tiers = { low: 0, moderate: 0, high: 0, very_high: 0, critical: 0 };
  chartData.forEach(d => {
    if (d.score <= 0)   return;
    if (d.score <= 20)  tiers.low++;
    else if (d.score <= 40) tiers.moderate++;
    else if (d.score <= 60) tiers.high++;
    else if (d.score <= 80) tiers.very_high++;
    else                    tiers.critical++;
  });

  const maxCount = Math.max(...Object.values(tiers), 1);
  const tierLabels = {
    low: 'Low (0–20)',
    moderate: 'Moderate (21–40)',
    high: 'High (41–60)',
    very_high: 'Very High (61–80)',
    critical: 'Critical (81–100)',
  };

  const container = $('riskDistBars');
  container.textContent = '';
  
  Object.entries(tiers).forEach(([tier, count]) => {
    const row = document.createElement('div');
    row.className = 'risk-bar-row';
    
    const label = document.createElement('span');
    label.className = 'risk-bar-label';
    label.textContent = tierLabels[tier] ?? tier;
    row.appendChild(label);
    
    const track = document.createElement('div');
    track.className = 'risk-bar-track';
    
    const fill = document.createElement('div');
    fill.className = `risk-bar-fill ${tier.replace('_', '-')}`;
    fill.style.width = `${(count / maxCount) * 100}%`;
    track.appendChild(fill);
    row.appendChild(track);
    
    const countSpan = document.createElement('span');
    countSpan.className = 'risk-bar-count';
    countSpan.textContent = count.toString();
    row.appendChild(countSpan);
    
    container.appendChild(row);
  });
}

function renderInterpretation(data) {
  const avg = data.avgScore ?? 0;
  let icon, title, desc, cls;

  if (avg <= 20) {
    icon = '✅'; title = 'Excellent Privacy Week';
    desc = 'The sites you visited this week showed very low privacy exposure. This is a good indicator of privacy-respecting behaviour.';
    cls  = 'color:var(--green)';
  } else if (avg <= 40) {
    icon = '🟡'; title = 'Moderate Privacy Exposure';
    desc = `Your average score of ${avg} indicates moderate tracking indicators. Consider using a content blocker.`;
    cls  = 'color:var(--amber)';
  } else if (avg <= 60) {
    icon = '🔴'; title = 'High Privacy Exposure';
    desc = `With an average score of ${avg}, the sites you visited showed significant tracking activity indicators.`;
    cls  = 'color:var(--red)';
  } else if (avg <= 80) {
    icon = '🚨'; title = 'Very High Privacy Exposure';
    desc = `An average score of ${avg} is concerning. Many sites you visited may use aggressive trackers or manipulative consent patterns.`;
    cls  = 'color:#dc2626';
  } else {
    icon = '⚠️'; title = 'Critical Privacy Exposure';
    desc = `Your average score of ${avg} this week is very high. The sites you visited show strong indicators of tracking, fingerprinting, or manipulative UI patterns.`;
    cls  = 'color:var(--purple)';
  }

  const card = $('interpCard');
  card.textContent = '';
  
  const iconEl = document.createElement('div');
  iconEl.className = 'interp-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;
  card.appendChild(iconEl);
  
  const textContainer = document.createElement('div');
  
  const titleEl = document.createElement('div');
  titleEl.className = 'interp-title';
  titleEl.style = cls;
  titleEl.textContent = title;
  textContainer.appendChild(titleEl);
  
  const descEl = document.createElement('div');
  descEl.className = 'interp-desc';
  descEl.textContent = desc;
  textContainer.appendChild(descEl);
  
  card.appendChild(textContainer);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function loadSummary() {
  try {
    const data = await sendMessage(MSG.GET_WEEKLY_SUMMARY);

    $('loadingState').hidden = true;

    if (!data || (data.sitesVisited === 0 && data.chartData?.length === 0)) {
      $('emptyState').hidden = false;
      return;
    }

    $('mainContent').hidden = false;
    $('mainContent').classList.add('fade-in');

    renderMetrics(data);
    renderScoreChart(data.chartData);
    renderTrackerChart(data.chartData);
    renderRiskDistribution(data.chartData);
    renderInterpretation(data);

  } catch (err) {
    console.error('[TrackerLens Summary] Failed to load:', err);
    const state = $('loadingState');
    state.textContent = '';
    
    const errDiv = document.createElement('div');
    errDiv.style.color = '#ef4444';
    errDiv.style.fontSize = '13px';
    errDiv.textContent = `⚠️ Failed to load summary: ${err.message}`;
    state.appendChild(errDiv);
    
    const btn = document.createElement('button');
    btn.style.marginTop = '12px';
    btn.style.padding = '8px 16px';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.textContent = 'Retry';
    btn.onclick = () => location.reload();
    state.appendChild(btn);
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

$('btnBack')?.addEventListener('click', () => {
  if (document.referrer) window.history.back();
  else window.close();
});

$('btnSettings')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Redraw charts on resize
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(loadSummary, 300);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadSummary();
