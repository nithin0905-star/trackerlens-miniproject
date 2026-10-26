/**
 * TrackerLens — Cookie Detector
 * Classifies cookies observed via the cookies API and webRequest headers.
 * Read-only audit — never modifies or blocks cookies.
 */
import { log } from '../shared/logger.js';

/**
 * Cookie name patterns that indicate tracking usage.
 * Checked case-insensitively via prefix or full match.
 */
const TRACKING_COOKIE_PATTERNS = [
  /^_ga/i,           // Google Analytics
  /^_gid/i,          // Google Analytics session
  /^_gcl/i,          // Google Click
  /^_gac/i,          // Google Ads Conversion
  /^fbp$/i,          // Facebook Pixel
  /^fbc$/i,          // Facebook Click ID
  /^_fbp/i,
  /^IDE$/i,          // DoubleClick
  /^NID$/i,          // Google signed-out state
  /^DSID$/i,         // DoubleClick
  /^ANID$/i,         // Google Ad
  /^SID$/i,          // Google session
  /^SSID$/i,
  /^__utma/i,        // Classic GA
  /^__utmb/i,
  /^__utmz/i,
  /^__utmt/i,
  /^_hjid/i,         // Hotjar
  /^_hjSession/i,
  /^mp_/i,           // Mixpanel
  /^ajs_/i,          // Segment
  /^amplitude_/i,    // Amplitude
  /^li_fat_id/i,     // LinkedIn
  /^bcookie$/i,      // LinkedIn
  /^lidc$/i,         // LinkedIn
  /^UID$/i,          // Scorecard Research
  /^UIDR$/i,
  /^_pin_unauth/i,   // Pinterest
  /^tt_/i,           // TikTok
  /^_ttp$/i,         // TikTok
];

/**
 * Determines cookie category.
 * @param {string} name
 * @param {boolean} thirdParty
 * @returns {'tracking'|'functional'|'unknown'}
 */
export function classifyCookie(name, thirdParty, isSession, lifespanDays = 0) {
  if (TRACKING_COOKIE_PATTERNS.some(re => re.test(name))) {
    return 'tracking';
  }
  
  // Third-party persistent cookies are highly likely to be tracking
  if (thirdParty && !isSession && lifespanDays > 30) {
    return 'tracking';
  }
  
  // Third-party cookies without a recognised name are treated as unknown
  if (thirdParty) return 'unknown';
  
  return 'functional';
}

/**
 * Audits a cookie object (from chrome.cookies API).
 * @param {chrome.cookies.Cookie} cookie
 * @param {string} pageUrl             — current page URL
 * @returns {Object}                   — enriched cookie record
 */
export function auditChromeApiCookie(cookie, pageUrl) {
  const thirdParty = !pageUrl.includes(cookie.domain.replace(/^\./, ''));
  
  let isSession = cookie.session;
  let lifespanDays = 0;
  if (!isSession && cookie.expirationDate) {
    lifespanDays = (cookie.expirationDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24);
  }

  let observable = 'fully';
  if (cookie.httpOnly) {
    observable = 'Unable to fully observe via JS (HttpOnly)';
  }

  return {
    name:       cookie.name,
    domain:     cookie.domain,
    category:   classifyCookie(cookie.name, thirdParty, isSession, lifespanDays),
    thirdParty,
    httpOnly:   cookie.httpOnly,
    secure:     cookie.secure,
    sameSite:   cookie.sameSite || null,
    session:    isSession,
    lifespanDays: lifespanDays > 0 ? Math.round(lifespanDays) : 0,
    observable,
    expiresAt:  cookie.expirationDate ?? null,
  };
}

/**
 * Parses Set-Cookie header strings from webRequest headers.
 * Returns an array of partial cookie records (name, domain from URL, flags).
 * @param {Object[]} headers    — responseHeaders array from webRequest
 * @param {string}   requestUrl — the URL that returned these headers
 * @param {string}   pageUrl    — page URL for third-party detection
 * @returns {Object[]}
 */
export function auditResponseCookies(headers, requestUrl, pageUrl) {
  if (!headers) return [];

  const cookieRecords = [];
  const reqDomain     = extractDomainFromUrl(requestUrl);

  for (const header of headers) {
    if (header.name.toLowerCase() !== 'set-cookie') continue;
    const parsed = parseSetCookieHeader(header.value, reqDomain, pageUrl, requestUrl);
    if (parsed) cookieRecords.push(parsed);
  }

  return cookieRecords;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function extractDomainFromUrl(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function parseSetCookieHeader(headerValue, reqDomain, pageUrl, requestUrl) {
  if (!headerValue) return null;

  const parts    = headerValue.split(';').map(p => p.trim());
  const nameVal  = parts[0];
  const eqIdx    = nameVal.indexOf('=');
  if (eqIdx === -1) return null;

  const name     = nameVal.slice(0, eqIdx).trim();
  const flags    = parts.slice(1).map(p => p.toLowerCase());

  const secure   = flags.some(f => f === 'secure');
  const httpOnly = flags.some(f => f === 'httponly');
  const sameSite = flags.find(f => f.startsWith('samesite='))?.split('=')[1] ?? null;

  const thirdParty = !pageUrl.toLowerCase().includes(reqDomain.toLowerCase().split('.').slice(-2).join('.'));

  let isSession = true;
  let lifespanDays = 0;
  
  const maxAgeFlag = flags.find(f => f.startsWith('max-age='));
  const expiresFlag = flags.find(f => f.startsWith('expires='));
  
  if (maxAgeFlag) {
    isSession = false;
    const maxAgeSec = parseInt(maxAgeFlag.split('=')[1], 10);
    if (!isNaN(maxAgeSec)) lifespanDays = maxAgeSec / (60 * 60 * 24);
  } else if (expiresFlag) {
    isSession = false;
    const expDate = new Date(expiresFlag.split('=')[1]);
    if (!isNaN(expDate.getTime())) {
      lifespanDays = (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    }
  }
  
  let observable = 'fully';
  if (httpOnly) {
    observable = 'Unable to fully observe via JS (HttpOnly)';
  } else if (secure && !requestUrl.startsWith('https')) {
    observable = 'Unable to fully observe via JS (Secure flag on HTTP)';
  }

  const category = classifyCookie(name, thirdParty, isSession, lifespanDays);

  return {
    name,
    domain:     reqDomain,
    category,
    thirdParty,
    httpOnly,
    secure,
    sameSite,
    session:    isSession,
    lifespanDays: lifespanDays > 0 ? Math.round(lifespanDays) : 0,
    observable,
  };
}
