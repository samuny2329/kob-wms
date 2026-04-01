/**
 * TransactionRing — Append-only ring buffer with SHA-256 hash chain
 *
 * Every WMS action (pick, pack, scan, dispatch, adjust) becomes a
 * Transaction (TX) stored in IndexedDB with a cryptographic hash chain.
 * Old TXs are pruned when the ring exceeds MAX_SIZE.
 *
 * Properties:
 *   - Append-only: TXs cannot be modified after creation
 *   - Hash-chained: each TX references the previous TX's hash (tamper detection)
 *   - Ring buffer: oldest TXs pruned automatically (configurable size)
 *   - Queryable: filter by action, actor, target, time range
 *
 * Usage:
 *   import txRing from './transactionRing';
 *   const tx = await txRing.append({ action: 'pick', actor: 'picker01', target: { orderId: 100 }, affects: ['packer','supervisor'] });
 *   const history = await txRing.query({ action: 'pick', since: Date.now() - 3600000 });
 *   const valid = await txRing.verifyChain();
 */

const DB_NAME = 'wms_txring';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
const META_STORE = 'ring_meta';
const MAX_RING_SIZE = 10_000;

let _db = null;

// ── SHA-256 hash using Web Crypto API (browser built-in, no external deps) ──
const sha256 = async (data) => {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ── Open DB ──
const openDB = () => {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'seq', autoIncrement: true });
        store.createIndex('hash', 'hash', { unique: true });
        store.createIndex('action', 'action', { unique: false });
        store.createIndex('actor', 'actor', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('orderId', 'orderId', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      _db.onclose = () => { _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
};

// ── Get last TX (for chain linking) ──
const getLastTx = async () => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor(null, 'prev'); // last record
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => resolve(null);
  });
};

// ── Append a new TX to the ring ──
const append = async ({ action, actor, target = {}, affects = [], meta = {} }) => {
  const lastTx = await getLastTx();
  const prevHash = lastTx?.hash || '0'.repeat(64); // genesis

  const timestamp = Date.now();
  const orderId = target.orderId || target.id || null;

  // Build the TX payload (everything that gets hashed)
  const payload = {
    action,
    actor,
    target,
    affects,
    meta,
    timestamp,
    prevHash,
  };

  // Compute hash
  const hash = await sha256(payload);

  const record = {
    ...payload,
    hash,
    orderId, // denormalized for index queries
  };

  // Write to IndexedDB
  const db = await openDB();
  const seq = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  record.seq = seq;

  // Prune if ring is full
  await pruneIfNeeded();

  return record;
};

// ── Prune oldest TXs when ring exceeds MAX_SIZE ──
const pruneIfNeeded = async () => {
  const db = await openDB();
  const count = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });

  if (count <= MAX_RING_SIZE) return;

  const excess = count - MAX_RING_SIZE;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor(); // oldest first (ascending seq)
    let deleted = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && deleted < excess) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        resolve(deleted);
      }
    };
    req.onerror = () => resolve(0);
  });
};

// ── Query TXs ──
// Filters: { action, actor, orderId, since, until, limit }
const query = async (filters = {}) => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    // Use index if a single filter matches
    let req;
    if (filters.orderId) {
      const idx = store.index('orderId');
      req = idx.getAll(IDBKeyRange.only(filters.orderId));
    } else if (filters.action && !filters.actor) {
      const idx = store.index('action');
      req = idx.getAll(IDBKeyRange.only(filters.action));
    } else if (filters.actor && !filters.action) {
      const idx = store.index('actor');
      req = idx.getAll(IDBKeyRange.only(filters.actor));
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => {
      let results = req.result || [];

      // Apply remaining filters in JS
      if (filters.action && filters.actor) {
        results = results.filter(r => r.action === filters.action && r.actor === filters.actor);
      }
      if (filters.since) {
        results = results.filter(r => r.timestamp >= filters.since);
      }
      if (filters.until) {
        results = results.filter(r => r.timestamp <= filters.until);
      }
      if (filters.affects) {
        results = results.filter(r => r.affects?.includes(filters.affects));
      }

      // Sort newest first
      results.sort((a, b) => b.timestamp - a.timestamp);

      // Limit
      if (filters.limit) {
        results = results.slice(0, filters.limit);
      }

      resolve(results);
    };
    req.onerror = () => resolve([]);
  });
};

// ── Get full chain for an order (complete audit trail) ──
const getOrderTrail = async (orderId) => {
  const results = await query({ orderId });
  // Sort chronological (oldest first) for trail view
  return results.sort((a, b) => a.timestamp - b.timestamp);
};

// ── Verify hash chain integrity (tamper detection) ──
const verifyChain = async (limit = 500) => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = async () => {
      const all = (req.result || []).sort((a, b) => a.seq - b.seq);
      const toCheck = all.slice(-limit); // check last N

      const violations = [];
      for (let i = 0; i < toCheck.length; i++) {
        const record = toCheck[i];
        const { seq, hash, orderId: _oid, ...payload } = record;

        // Recompute hash from payload
        const { hash: _h, seq: _s, orderId: _o, ...hashPayload } = record;
        const recomputed = await sha256(hashPayload);

        if (recomputed !== record.hash) {
          violations.push({ seq: record.seq, type: 'hash_mismatch', expected: recomputed, actual: record.hash });
        }

        // Check prevHash link
        if (i > 0) {
          const prevRecord = toCheck[i - 1];
          if (record.prevHash !== prevRecord.hash) {
            violations.push({ seq: record.seq, type: 'chain_break', expected: prevRecord.hash, actual: record.prevHash });
          }
        }
      }

      resolve({
        checked: toCheck.length,
        valid: violations.length === 0,
        violations,
      });
    };
    req.onerror = () => resolve({ checked: 0, valid: false, violations: [{ type: 'db_error' }] });
  });
};

// ── Stats ──
const getStats = async () => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const countReq = store.count();

    countReq.onsuccess = () => {
      const count = countReq.result;
      // Get newest and oldest
      const newestReq = store.openCursor(null, 'prev');
      newestReq.onsuccess = () => {
        const newest = newestReq.result?.value;
        const oldestReq = store.openCursor(null, 'next');
        oldestReq.onsuccess = () => {
          const oldest = oldestReq.result?.value;
          resolve({
            count,
            maxSize: MAX_RING_SIZE,
            oldest: oldest?.timestamp || null,
            newest: newest?.timestamp || null,
            lastHash: newest?.hash || null,
          });
        };
      };
    };
    countReq.onerror = () => resolve({ count: 0, maxSize: MAX_RING_SIZE });
  });
};

// ── Clear (for testing/reset) ──
const clear = async () => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
};

const txRing = {
  append,
  query,
  getOrderTrail,
  getLastTx,
  verifyChain,
  getStats,
  clear,
  MAX_RING_SIZE,
};

export default txRing;
