/**
 * TrackerLens — IndexedDB initialization & migration runner (Phase 4)
 * Handles database open, schema creation, and version migrations.
 * DB_VERSION 2 adds the weeklyStats object store.
 */
import { DB_NAME, DB_VERSION } from '../shared/config.js';
import { log } from '../shared/logger.js';

// ─── Schema Definition ───────────────────────────────────────────────────────

const STORES_V1 = [
  {
    name: 'visits',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'domain',    keyPath: 'domain',    unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
      { name: 'riskLevel', keyPath: 'riskLevel', unique: false },
    ],
  },
  {
    name: 'trackers',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'visitId',     keyPath: 'visitId',     unique: false },
      { name: 'domain',      keyPath: 'domain',      unique: false },
      { name: 'trackerName', keyPath: 'trackerName', unique: false },
      { name: 'timestamp',   keyPath: 'timestamp',   unique: false },
    ],
  },
  {
    name: 'fingerprints',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'visitId',   keyPath: 'visitId',   unique: false },
      { name: 'domain',    keyPath: 'domain',    unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
      { name: 'riskLevel', keyPath: 'riskLevel', unique: false },
    ],
  },
  {
    name: 'cookies',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'visitId',   keyPath: 'visitId',   unique: false },
      { name: 'domain',    keyPath: 'domain',    unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
    ],
  },
  {
    name: 'consentEvents',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'visitId',   keyPath: 'visitId',   unique: false },
      { name: 'domain',    keyPath: 'domain',    unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false },
    ],
  },
  {
    name: 'settings',
    keyPath: 'key',
    autoIncrement: false,
    indexes: [],
  },
  {
    name: 'trustedSites',
    keyPath: 'domain',
    autoIncrement: false,
    indexes: [
      { name: 'addedAt', keyPath: 'addedAt', unique: false },
    ],
  },
  {
    name: 'dailyStats',
    keyPath: 'date',
    autoIncrement: false,
    indexes: [
      { name: 'date', keyPath: 'date', unique: true },
    ],
  },
];

/** New in v2 */
const STORES_V2 = [
  {
    name: 'weeklyStats',
    keyPath: 'weekKey',   // format: YYYY-WW (ISO week)
    autoIncrement: false,
    indexes: [
      { name: 'weekKey', keyPath: 'weekKey', unique: true },
    ],
  },
];

// ─── Migration Runners ────────────────────────────────────────────────────────

const MIGRATIONS = {
  1: (_db, _tx) => {
    log.info('Migration v1 applied (initial schema).');
  },
  2: (db, _tx) => {
    // Add weeklyStats store
    for (const store of STORES_V2) {
      if (db.objectStoreNames.contains(store.name)) continue;
      const os = db.createObjectStore(store.name, {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
      });
      for (const idx of store.indexes) {
        os.createIndex(idx.name, idx.keyPath, { unique: idx.unique ?? false });
      }
      log.debug(`Migration v2: created store ${store.name}`);
    }
    log.info('Migration v2 applied (weeklyStats store).');
  },
  3: (_db, _tx) => {
    log.info('Migration v3 applied (corrupted record handling).');
  },
};

function createStoresV1(db) {
  for (const store of STORES_V1) {
    if (db.objectStoreNames.contains(store.name)) continue;
    const os = db.createObjectStore(store.name, {
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
    });
    for (const idx of store.indexes) {
      os.createIndex(idx.name, idx.keyPath, { unique: idx.unique ?? false });
    }
    log.debug(`Created object store: ${store.name}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let _dbInstance = null;

/**
 * Opens (or returns cached) trackerLensDB.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_dbInstance) return Promise.resolve(_dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;
      const oldVersion = event.oldVersion;

      log.info(`DB upgrade: v${oldVersion} → v${DB_VERSION}`);

      if (oldVersion < 1) {
        createStoresV1(db);
      }

      // Run incremental migrations
      for (let v = Math.max(oldVersion + 1, 2); v <= DB_VERSION; v++) {
        if (MIGRATIONS[v]) {
          MIGRATIONS[v](db, tx);
          log.info(`Migration v${v} applied.`);
        }
      }
    };

    request.onsuccess = (event) => {
      _dbInstance = event.target.result;

      _dbInstance.onversionchange = () => {
        _dbInstance.close();
        _dbInstance = null;
        log.warn('DB version changed externally; connection closed.');
      };

      log.info(`${DB_NAME} v${DB_VERSION} opened successfully.`);
      resolve(_dbInstance);
    };

    request.onerror = (event) => {
      const err = event.target.error;
      log.error('Failed to open IndexedDB:', err);
      reject(err);
    };

    request.onblocked = () => {
      log.warn('DB open blocked — another tab may have an older version open.');
    };
  });
}

export function closeDB() {
  if (_dbInstance) {
    _dbInstance.close();
    _dbInstance = null;
    log.info('DB connection closed.');
  }
}

export function deleteDB() {
  closeDB();
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => { log.info('DB deleted.'); resolve(); };
    req.onerror   = (e) => { log.error('DB delete failed:', e.target.error); reject(e.target.error); };
  });
}

export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

export async function withTransaction(storeNames, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(new Error('Transaction aborted'));
    callback(tx);
  });
}
