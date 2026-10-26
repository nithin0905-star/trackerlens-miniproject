/**
 * TrackerLens — Demo Data Injector
 * Provides deterministic sample data for development/demonstration.
 * Demo records are labelled with isDemo: true and NEVER mixed with real data in UI.
 *
 * Three scenarios:
 *   1. Low-risk site    — personal blog, minimal tracking
 *   2. Medium-risk site — news site with analytics + some tracking cookies
 *   3. High-risk site   — ad-tech site with aggressive fingerprinting + many trackers
 */
import { DEV_MODE } from '../shared/config.js';
import {
  VisitsRepo, TrackersRepo, FingerprintsRepo, CookiesRepo,
  ConsentRepo, DailyStatsRepo,
} from '../storage/repositories.js';
import { log } from '../shared/logger.js';

const DEMO_TAG = '[DEMO]';

function demoTs(daysAgo, hoursAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.getTime();
}

// ─── Scenario Definitions ─────────────────────────────────────────────────────

const SCENARIOS = [
  // ── LOW RISK ────────────────────────────────────────────────────────────────
  {
    visit: {
      domain:    'myblog.example.com',
      url:       'https://myblog.example.com/article',
      timestamp: demoTs(1),
      riskLevel: 'low',
      score:     12,
      isDemo:    true,
    },
    trackers: [],
    fingerprints: {
      signals:    ['navigatorVendor'],
      riskLevel:  'low',
      isDemo:     true,
    },
    cookies: [
      { name: 'session_id', category: 'functional', thirdParty: false, httpOnly: true, secure: true, sameSite: 'Strict', isDemo: true },
    ],
    consent: {
      hasBanner: false, hasRejectButton: false, hasAcceptButton: false,
      preTickedOptIn: false, hiddenReject: false, consentWall: false,
      isDarkPattern: false, hasLegitimateOptOut: false, isDemo: true,
    },
  },

  // ── MEDIUM RISK ─────────────────────────────────────────────────────────────
  {
    visit: {
      domain:    'dailynews.example.com',
      url:       'https://dailynews.example.com/tech',
      timestamp: demoTs(0, 3),
      riskLevel: 'medium',
      score:     47,
      isDemo:    true,
    },
    trackers: [
      { domain: 'google-analytics.com', trackerName: 'Google Analytics', category: 'analytics',   requestUrl: 'https://www.google-analytics.com/analytics.js', isDemo: true },
      { domain: 'hotjar.com',           trackerName: 'Hotjar',           category: 'analytics',   requestUrl: 'https://static.hotjar.com/c/hotjar.js',         isDemo: true },
      { domain: 'doubleclick.net',      trackerName: 'Google DoubleClick',category: 'advertising',requestUrl: 'https://ad.doubleclick.net/ddm/trackimp',        isDemo: true },
    ],
    fingerprints: {
      signals:   ['canvas', 'screenResolution', 'timezone'],
      riskLevel: 'medium',
      isDemo:    true,
    },
    cookies: [
      { name: '_ga',       category: 'tracking',   thirdParty: false, httpOnly: false, secure: true,  sameSite: 'Lax',  isDemo: true },
      { name: '_gid',      category: 'tracking',   thirdParty: false, httpOnly: false, secure: true,  sameSite: 'Lax',  isDemo: true },
      { name: 'ANID',      category: 'tracking',   thirdParty: true,  httpOnly: false, secure: true,  sameSite: null,   isDemo: true },
      { name: 'session_id',category: 'functional', thirdParty: false, httpOnly: true,  secure: true,  sameSite: 'Strict', isDemo: true },
    ],
    consent: {
      hasBanner: true, hasRejectButton: true, hasAcceptButton: true,
      preTickedOptIn: false, hiddenReject: false, consentWall: false,
      isDarkPattern: false, hasLegitimateOptOut: true, isDemo: true,
    },
  },

  // ── HIGH RISK ───────────────────────────────────────────────────────────────
  {
    visit: {
      domain:    'adtech.example.com',
      url:       'https://adtech.example.com/',
      timestamp: demoTs(0, 1),
      riskLevel: 'critical',
      score:     89,
      isDemo:    true,
    },
    trackers: [
      { domain: 'google-analytics.com',   trackerName: 'Google Analytics',    category: 'analytics',      requestUrl: 'https://www.google-analytics.com/analytics.js', isDemo: true },
      { domain: 'googletagmanager.com',   trackerName: 'Google Tag Manager',  category: 'analytics',      requestUrl: 'https://www.googletagmanager.com/gtm.js',       isDemo: true },
      { domain: 'doubleclick.net',        trackerName: 'Google DoubleClick',  category: 'advertising',    requestUrl: 'https://ad.doubleclick.net/ddm/trackimp',        isDemo: true },
      { domain: 'criteo.com',             trackerName: 'Criteo',              category: 'advertising',    requestUrl: 'https://static.criteo.net/js/ld/ld.js',         isDemo: true },
      { domain: 'fingerprintjs.com',      trackerName: 'FingerprintJS',       category: 'fingerprinting', requestUrl: 'https://api.fingerprintjs.com/v3',              isDemo: true },
      { domain: 'fullstory.com',          trackerName: 'FullStory',           category: 'fingerprinting', requestUrl: 'https://edge.fullstory.com/s/fs.js',            isDemo: true },
      { domain: 'facebook.net',           trackerName: 'Facebook SDK',        category: 'social',         requestUrl: 'https://connect.facebook.net/en_US/fbevents.js',isDemo: true },
      { domain: 'amazon-adsystem.com',    trackerName: 'Amazon Ads',          category: 'advertising',    requestUrl: 'https://aax.amazon-adsystem.com/e/dtb/bid',     isDemo: true },
      { domain: 'scorecardresearch.com',  trackerName: 'Scorecard Research',  category: 'analytics',      requestUrl: 'https://b.scorecardresearch.com/beacon.js',     isDemo: true },
    ],
    fingerprints: {
      signals:   ['canvas', 'webgl', 'audioContext', 'fonts', 'battery', 'webRTC', 'hardwareConcurrency', 'deviceMemory'],
      riskLevel: 'critical',
      isDemo:    true,
    },
    cookies: [
      { name: '_ga',   category: 'tracking', thirdParty: false, httpOnly: false, secure: false, sameSite: null, isDemo: true },
      { name: 'IDE',   category: 'tracking', thirdParty: true,  httpOnly: false, secure: true,  sameSite: null, isDemo: true },
      { name: 'fbp',   category: 'tracking', thirdParty: true,  httpOnly: false, secure: true,  sameSite: null, isDemo: true },
      { name: 'ANID',  category: 'tracking', thirdParty: true,  httpOnly: false, secure: true,  sameSite: null, isDemo: true },
      { name: 'SID',   category: 'tracking', thirdParty: true,  httpOnly: true,  secure: true,  sameSite: null, isDemo: true },
      { name: 'SSID',  category: 'tracking', thirdParty: true,  httpOnly: true,  secure: true,  sameSite: null, isDemo: true },
      { name: '_hjid', category: 'tracking', thirdParty: false, httpOnly: false, secure: true,  sameSite: 'Lax', isDemo: true },
    ],
    consent: {
      hasBanner: true, hasRejectButton: false, hasAcceptButton: true,
      preTickedOptIn: true, hiddenReject: true, consentWall: false,
      isDarkPattern: true, hasLegitimateOptOut: false, isDemo: true,
    },
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if a record is demo data.
 * @param {Object} record
 * @returns {boolean}
 */
export function isDemoVisit(record) {
  return record?.isDemo === true;
}

/**
 * Injects all demo scenarios into IndexedDB.
 * Safe to call multiple times (adds new records each time — intended for dev refresh).
 * Only callable when DEV_MODE is true.
 */
export async function injectDemoData() {
  if (!DEV_MODE) {
    log.warn('Demo data injection blocked: DEV_MODE is false.');
    return;
  }

  log.info(`${DEMO_TAG} Injecting demo data…`);

  for (const scenario of SCENARIOS) {
    // Insert visit
    const visitId = await VisitsRepo.add(scenario.visit);

    // Insert trackers
    for (const t of scenario.trackers) {
      await TrackersRepo.add({ ...t, visitId, timestamp: scenario.visit.timestamp });
    }

    // Insert fingerprints
    await FingerprintsRepo.add({
      ...scenario.fingerprints,
      visitId,
      domain:       scenario.visit.domain,
      signalCount:  scenario.fingerprints.signals.length,
      highRiskSignals: scenario.fingerprints.signals.filter(s =>
        ['canvas', 'webgl', 'audioContext', 'fonts', 'webRTC'].includes(s)),
      rawScore:     0,
      timestamp:    scenario.visit.timestamp,
    });

    // Insert cookies
    for (const c of scenario.cookies) {
      await CookiesRepo.add({ ...c, visitId, domain: scenario.visit.domain, timestamp: scenario.visit.timestamp });
    }

    // Insert consent
    await ConsentRepo.add({ ...scenario.consent, visitId, domain: scenario.visit.domain, timestamp: scenario.visit.timestamp });
  }

  // Update daily stats with demo totals
  await DailyStatsRepo.increment({
    visits:       SCENARIOS.length,
    trackers:     SCENARIOS.flatMap(s => s.trackers).length,
    fingerprints: SCENARIOS.reduce((n, s) => n + s.fingerprints.signals.length, 0),
    cookies:      SCENARIOS.flatMap(s => s.cookies).length,
  });

  log.info(`${DEMO_TAG} Demo data injected for ${SCENARIOS.length} scenarios.`);
}
