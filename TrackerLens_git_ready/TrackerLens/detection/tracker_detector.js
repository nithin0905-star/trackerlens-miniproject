/**
 * TrackerLens — Tracker Detector
 * Matches request URLs against the local tracker domain list.
 * No remote lookups. No blocking.
 */
import { log } from '../shared/logger.js';

/** @type {Map<string, {company: string, category: string, purpose: string, severity: string}>} */
let trackerMap = null;

/**
 * Loads and indexes tracker_domains.json into a Map for O(1) domain lookups.
 * Called once at startup.
 */
export async function initTrackerDetector() {
  if (trackerMap) return; // already loaded

  try {
    const url  = chrome.runtime.getURL('data/tracker_domains.json');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    trackerMap = new Map();
    for (const entry of data.trackers) {
      // Normalize domain using standard URL parsing to handle punycode/case
      const normalizedDomain = extractDomain(`http://${entry.domain}`);
      if (!normalizedDomain) continue;

      const info = {
        company: entry.company,
        category: entry.category,
        purpose: entry.purpose,
        severity: entry.severity
      };

      trackerMap.set(normalizedDomain, info);

      // Index without www. if present
      if (normalizedDomain.startsWith('www.')) {
        trackerMap.set(normalizedDomain.slice(4), info);
      }
    }

    log.info(`Tracker detector loaded: ${trackerMap.size} entries.`);
  } catch (err) {
    log.error('Failed to load tracker_domains.json:', err);
    trackerMap = new Map(); // fail safe — empty map
  }
}

/**
 * Extracts the registrable domain (hostname) from a URL string.
 * Uses extremely fast string parsing to avoid the heavy new URL() constructor overhead
 * in high-frequency event handlers.
 * @param {string} urlString
 * @returns {string|null}
 */
export function extractDomain(urlString) {
  if (!urlString) return null;
  
  let startIdx = urlString.indexOf('://');
  if (startIdx === -1) return null;
  startIdx += 3;
  
  let endIdx = urlString.indexOf('/', startIdx);
  if (endIdx === -1) {
    endIdx = urlString.indexOf('?', startIdx);
    if (endIdx === -1) {
      endIdx = urlString.indexOf('#', startIdx);
      if (endIdx === -1) endIdx = urlString.length;
    }
  }
  
  let domain = urlString.substring(startIdx, endIdx);
  
  const portIdx = domain.indexOf(':');
  if (portIdx !== -1) {
    domain = domain.substring(0, portIdx);
  }
  
  return domain.toLowerCase();
}

/**
 * Gets the "top-level" / registrable domain structure.
 * Naive implementation for demo, works for most domains.
 * @param {string} hostname
 * @returns {string}
 */
export function getRegistrableDomain(hostname) {
  if (!hostname) return '';
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  
  // Basic handling for .co.uk, .com.au, etc.
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if (tld.length === 2 && sld.length <= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Checks if a URL belongs to a known tracker.
 * @param {string} urlString     — the full request URL
 * @returns {{ isTracker: boolean, company: string|null, category: string|null, purpose: string|null, severity: string|null, domain: string|null }}
 */
export function detectTracker(urlString) {
  if (!trackerMap) {
    return { isTracker: false, company: null, category: null, purpose: null, severity: null, domain: null };
  }

  const hostname = extractDomain(urlString);
  if (!hostname) return { isTracker: false, company: null, category: null, purpose: null, severity: null, domain: null };

  // Exact match
  if (trackerMap.has(hostname)) {
    const info = trackerMap.get(hostname);
    return { isTracker: true, ...info, domain: hostname };
  }

  // Suffix match — walk up domain levels (e.g. sub.tracker.com → tracker.com)
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    if (trackerMap.has(candidate)) {
      const info = trackerMap.get(candidate);
      return { isTracker: true, ...info, domain: candidate };
    }
  }

  return { isTracker: false, company: null, category: null, purpose: null, severity: null, domain: hostname };
}

/**
 * Determines if a request is third-party relative to the page origin.
 * @param {string} requestUrl
 * @param {string} pageUrl
 * @returns {boolean}
 */
export function isThirdParty(requestUrl, pageUrl) {
  const reqHost  = extractDomain(requestUrl);
  const pageHost = extractDomain(pageUrl);
  if (!reqHost || !pageHost) return false;

  const reqReg = getRegistrableDomain(reqHost);
  const pageReg = getRegistrableDomain(pageHost);
  
  return reqReg !== pageReg;
}
