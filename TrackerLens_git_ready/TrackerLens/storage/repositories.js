/**
 * TrackerLens — Repositories (Phase 4)
 * High-level CRUD operations for each object store.
 * All methods return Promises.
 */
import { openDB, promisifyRequest } from './indexeddb.js';
import { log } from '../shared/logger.js';

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

async function addRecord(storeName, record) {
  const db  = await openDB();
  const tx  = db.transaction(storeName, 'readwrite');
  const os  = tx.objectStore(storeName);
  const req = os.add(record);
  return promisifyRequest(req);
}

async function batchAddRecords(storeName, records) {
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const os = tx.objectStore(storeName);
    for (const record of records) {
      os.add(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));
  });
}

async function putRecord(storeName, record) {
  const db  = await openDB();
  const tx  = db.transaction(storeName, 'readwrite');
  const os  = tx.objectStore(storeName);
  const req = os.put(record);
  return promisifyRequest(req);
}

async function getRecord(storeName, key) {
  try {
    const os  = await getStore(storeName, 'readonly');
    return await promisifyRequest(os.get(key));
  } catch (err) {
    log.error(`Failed to get record from ${storeName}:`, err);
    return null;
  }
}

async function getAllRecords(storeName) {
  try {
    const os  = await getStore(storeName, 'readonly');
    const records = await promisifyRequest(os.getAll());
    return records.filter(r => r && typeof r === 'object');
  } catch (err) {
    log.error(`Failed to get all records from ${storeName}:`, err);
    return [];
  }
}

async function deleteRecord(storeName, key) {
  const db  = await openDB();
  const tx  = db.transaction(storeName, 'readwrite');
  const os  = tx.objectStore(storeName);
  return promisifyRequest(os.delete(key));
}

async function clearStore(storeName) {
  const db  = await openDB();
  const tx  = db.transaction(storeName, 'readwrite');
  const os  = tx.objectStore(storeName);
  return promisifyRequest(os.clear());
}

async function getByIndex(storeName, indexName, value) {
  const os  = await getStore(storeName, 'readonly');
  const idx = os.index(indexName);
  return promisifyRequest(idx.getAll(value));
}

async function countRecords(storeName) {
  const os  = await getStore(storeName, 'readonly');
  return promisifyRequest(os.count());
}

async function deleteRecordsOlderThan(storeName, timestamp) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const os = tx.objectStore(storeName);

    let req;
    try {
      const idx   = os.index('timestamp');
      const range = IDBKeyRange.upperBound(timestamp);
      req = idx.openCursor(range);
    } catch {
      req = os.openCursor();
    }

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.timestamp && cursor.value.timestamp <= timestamp) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Visits ───────────────────────────────────────────────────────────────────

export const VisitsRepo = {
  add: (visit) => addRecord('visits', { ...visit, timestamp: visit.timestamp ?? Date.now() }),
  put: (visit) => putRecord('visits', visit),
  get: (id)    => getRecord('visits', id),
  all: ()      => getAllRecords('visits'),
  byDomain: (domain) => getByIndex('visits', 'domain', domain),
  byRisk:   (level)  => getByIndex('visits', 'riskLevel', level),
  delete:   (id)     => deleteRecord('visits', id),
  clear:    ()       => clearStore('visits'),
  count:    ()       => countRecords('visits'),
  deleteOlderThan: (timestamp) => deleteRecordsOlderThan('visits', timestamp),

  recent: async (limit = 50) => {
    const db  = await openDB();
    const tx  = db.transaction('visits', 'readonly');
    const os  = tx.objectStore('visits');
    const idx = os.index('timestamp');
    const req = idx.openCursor(null, 'prev');
    return new Promise((resolve, reject) => {
      const results = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  },

  /** Returns visits within a time range, sorted newest first */
  sinceTimestamp: async (since) => {
    const db  = await openDB();
    const tx  = db.transaction('visits', 'readonly');
    const os  = tx.objectStore('visits');
    const idx = os.index('timestamp');
    const range = IDBKeyRange.lowerBound(since);
    const req = idx.openCursor(range, 'prev');
    return new Promise((resolve, reject) => {
      const results = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  },
};

// ─── Trackers ─────────────────────────────────────────────────────────────────

export const TrackersRepo = {
  add: (t) => addRecord('trackers', { ...t, timestamp: t.timestamp ?? Date.now() }),
  batchAdd: (items) => batchAddRecords('trackers', items.map(t => ({ ...t, timestamp: t.timestamp ?? Date.now() }))),
  byVisit:  (visitId) => getByIndex('trackers', 'visitId', visitId),
  byDomain: (domain)  => getByIndex('trackers', 'domain', domain),
  all: ()   => getAllRecords('trackers'),
  clear:    ()        => clearStore('trackers'),
  count:    ()        => countRecords('trackers'),
  deleteOlderThan: (timestamp) => deleteRecordsOlderThan('trackers', timestamp),
};

// ─── Fingerprints ─────────────────────────────────────────────────────────────

export const FingerprintsRepo = {
  add: (fp) => addRecord('fingerprints', { ...fp, timestamp: fp.timestamp ?? Date.now() }),
  put: (fp) => putRecord('fingerprints', fp),
  batchAdd: (items) => batchAddRecords('fingerprints', items.map(fp => ({ ...fp, timestamp: fp.timestamp ?? Date.now() }))),
  byVisit:  (visitId) => getByIndex('fingerprints', 'visitId', visitId),
  byDomain: (domain)  => getByIndex('fingerprints', 'domain', domain),
  all: ()   => getAllRecords('fingerprints'),
  clear:    ()        => clearStore('fingerprints'),
  count:    ()        => countRecords('fingerprints'),
  deleteOlderThan: (timestamp) => deleteRecordsOlderThan('fingerprints', timestamp),
};

// ─── Cookies ──────────────────────────────────────────────────────────────────

export const CookiesRepo = {
  add: (c) => addRecord('cookies', { ...c, timestamp: c.timestamp ?? Date.now() }),
  batchAdd: (items) => batchAddRecords('cookies', items.map(c => ({ ...c, timestamp: c.timestamp ?? Date.now() }))),
  byVisit:  (visitId) => getByIndex('cookies', 'visitId', visitId),
  byDomain: (domain)  => getByIndex('cookies', 'domain', domain),
  all: ()   => getAllRecords('cookies'),
  clear:    ()        => clearStore('cookies'),
  count:    ()        => countRecords('cookies'),
  deleteOlderThan: (timestamp) => deleteRecordsOlderThan('cookies', timestamp),
};

// ─── Consent Events ───────────────────────────────────────────────────────────

export const ConsentRepo = {
  add: (e) => addRecord('consentEvents', { ...e, timestamp: e.timestamp ?? Date.now() }),
  batchAdd: (items) => batchAddRecords('consentEvents', items.map(e => ({ ...e, timestamp: e.timestamp ?? Date.now() }))),
  byVisit: (visitId) => getByIndex('consentEvents', 'visitId', visitId),
  all: ()  => getAllRecords('consentEvents'),
  clear:   ()        => clearStore('consentEvents'),
  deleteOlderThan: (timestamp) => deleteRecordsOlderThan('consentEvents', timestamp),
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const SettingsRepo = {
  get: (key)           => getRecord('settings', key),
  set: (key, value)    => putRecord('settings', { key, value, updatedAt: Date.now() }),
  all: ()              => getAllRecords('settings'),
  delete: (key)        => deleteRecord('settings', key),
  clear:  ()           => clearStore('settings'),

  bulkSet: async (obj) => {
    const db  = await openDB();
    const tx  = db.transaction('settings', 'readwrite');
    const os  = tx.objectStore('settings');
    const now = Date.now();
    for (const [key, value] of Object.entries(obj)) {
      os.put({ key, value, updatedAt: now });
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  },

  asMap: async () => {
    const rows = await getAllRecords('settings');
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
};

// ─── Trusted Sites ────────────────────────────────────────────────────────────

export const TrustedSitesRepo = {
  add:    (domain) => putRecord('trustedSites', { domain, addedAt: Date.now() }),
  remove: (domain) => deleteRecord('trustedSites', domain),
  all:    ()       => getAllRecords('trustedSites'),
  has: async (domain) => {
    const r = await getRecord('trustedSites', domain);
    return !!r;
  },
  toggle: async (domain) => {
    const exists = await TrustedSitesRepo.has(domain);
    if (exists) {
      await TrustedSitesRepo.remove(domain);
      return false;
    } else {
      await TrustedSitesRepo.add(domain);
      return true;
    }
  },
  clear: () => clearStore('trustedSites'),
};

// ─── Daily Stats ──────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export const DailyStatsRepo = {
  getToday: () => getRecord('dailyStats', todayKey()),
  get: (date) => getRecord('dailyStats', date),
  all: ()     => getAllRecords('dailyStats'),
  clear:      () => clearStore('dailyStats'),

  increment: async (delta) => {
    const date    = todayKey();
    const db      = await openDB();
    const tx      = db.transaction('dailyStats', 'readwrite');
    const os      = tx.objectStore('dailyStats');
    const getReq  = os.get(date);

    return new Promise((resolve, reject) => {
      getReq.onsuccess = () => {
        const existing = getReq.result ?? {
          date,
          trackers: 0, fingerprints: 0, cookies: 0, visits: 0,
          consentWarnings: 0, trackingRequests: 0, totalScore: 0, scoredVisits: 0,
        };
        const updated = {
          ...existing,
          trackers:        (existing.trackers        ?? 0) + (delta.trackers        ?? 0),
          fingerprints:    (existing.fingerprints    ?? 0) + (delta.fingerprints    ?? 0),
          cookies:         (existing.cookies         ?? 0) + (delta.cookies         ?? 0),
          visits:          (existing.visits          ?? 0) + (delta.visits          ?? 0),
          consentWarnings: (existing.consentWarnings ?? 0) + (delta.consentWarnings ?? 0),
          trackingRequests:(existing.trackingRequests?? 0) + (delta.trackingRequests?? 0),
          totalScore:      (existing.totalScore      ?? 0) + (delta.totalScore      ?? 0),
          scoredVisits:    (existing.scoredVisits    ?? 0) + (delta.scoredVisits    ?? 0),
        };
        const putReq = os.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror   = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  /**
   * Returns the last N days of stats (newest first).
   * @param {number} n
   * @returns {Promise<Object[]>}
   */
  lastNDays: async (n = 7) => {
    const all   = await getAllRecords('dailyStats');
    const sorted = all.sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, n);
  },
};

// ─── Weekly Stats ─────────────────────────────────────────────────────────────

/** ISO week key format: YYYY-WW */
function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Monday=1
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export const WeeklyStatsRepo = {
  getThisWeek: () => getRecord('weeklyStats', weekKey()),
  get: (wk)   => getRecord('weeklyStats', wk),
  all: ()      => getAllRecords('weeklyStats'),
  clear: ()    => clearStore('weeklyStats'),

  increment: async (delta) => {
    const wk    = weekKey();
    const db    = await openDB();
    const tx    = db.transaction('weeklyStats', 'readwrite');
    const os    = tx.objectStore('weeklyStats');
    const getReq = os.get(wk);

    return new Promise((resolve, reject) => {
      getReq.onsuccess = () => {
        const existing = getReq.result ?? {
          weekKey: wk,
          sites: 0, uniqueTrackers: 0, fingerprintingEvents: 0,
          trackingRequests: 0, consentWarnings: 0,
          totalScore: 0, scoredVisits: 0,
          highScore: 0, lowScore: 100,
        };
        const updated = {
          ...existing,
          sites:               (existing.sites               ?? 0) + (delta.sites               ?? 0),
          uniqueTrackers:      (existing.uniqueTrackers      ?? 0) + (delta.uniqueTrackers      ?? 0),
          fingerprintingEvents:(existing.fingerprintingEvents?? 0) + (delta.fingerprintingEvents?? 0),
          trackingRequests:    (existing.trackingRequests    ?? 0) + (delta.trackingRequests    ?? 0),
          consentWarnings:     (existing.consentWarnings     ?? 0) + (delta.consentWarnings     ?? 0),
          totalScore:          (existing.totalScore          ?? 0) + (delta.totalScore          ?? 0),
          scoredVisits:        (existing.scoredVisits        ?? 0) + (delta.scoredVisits        ?? 0),
          highScore: Math.max(existing.highScore ?? 0, delta.score ?? 0),
          lowScore:  delta.score !== undefined
            ? Math.min(existing.lowScore ?? 100, delta.score)
            : existing.lowScore,
        };
        const putReq = os.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror   = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },
};

// ─── Nuclear Reset ────────────────────────────────────────────────────────────

export async function clearAllData() {
  log.warn('Clearing all TrackerLens data…');
  await Promise.all([
    VisitsRepo.clear(),
    TrackersRepo.clear(),
    FingerprintsRepo.clear(),
    CookiesRepo.clear(),
    ConsentRepo.clear(),
    TrustedSitesRepo.clear(),
    DailyStatsRepo.clear(),
    WeeklyStatsRepo.clear(),
  ]);
  log.info('All data cleared.');
}

export async function factoryReset() {
  await clearAllData();
  await SettingsRepo.clear();
  log.info('Factory reset complete.');
}
