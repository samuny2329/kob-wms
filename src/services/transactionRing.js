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
const MAX_RING_SIZE = 50_000;

let _db = null;
let _lastHash = null;  // In-memory cache of last hash (avoids DB read on every append)
let _pruneScheduled = false; // Debounce pruning

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
  // Use cached last hash (fast) or fallback to DB read (first call only)
  let prevHash = _lastHash;
  if (!prevHash) {
    const lastTx = await getLastTx();
    prevHash = lastTx?.hash || '0'.repeat(64); // genesis
  }

  const timestamp = Date.now();
  const orderId = target.orderId || target.id || null;

  const payload = { action, actor, target, affects, meta, timestamp, prevHash };
  const hash = await sha256(payload);

  const record = { ...payload, hash, orderId };

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
  _lastHash = hash; // Cache for next append (avoids DB read)

  // Debounced prune — don't prune on every append, check every 100 appends
  if (!_pruneScheduled) {
    _pruneScheduled = true;
    setTimeout(async () => {
      _pruneScheduled = false;
      await pruneIfNeeded();
    }, 5000); // Check every 5s at most
  }

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
// Filters: { action, actor, orderId, since, until, limit, offset }
// Optimized: uses IDB cursors walking backwards (newest first) + early exit on limit
const query = async (filters = {}) => {
  const db = await openDB();
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  // Fast path: orderId query uses index directly
  if (filters.orderId) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const idx = tx.objectStore(STORE_NAME).index('orderId');
      const req = idx.getAll(IDBKeyRange.only(filters.orderId));
      req.onsuccess = () => {
        const results = (req.result || []).sort((a, b) => b.timestamp - a.timestamp);
        resolve(results.slice(0, limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  // Fast path: time range query using timestamp index + cursor (no getAll)
  if (filters.since || filters.until) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const idx = tx.objectStore(STORE_NAME).index('timestamp');
      const lower = filters.since || 0;
      const upper = filters.until || Date.now() + 86400000;
      const range = IDBKeyRange.bound(lower, upper);
      const results = [];
      let skipped = 0;

      // Walk backwards (newest first)
      const req = idx.openCursor(range, 'prev');
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        const r = cursor.value;
        // Apply JS filters
        if (filters.action && r.action !== filters.action) { cursor.continue(); return; }
        if (filters.actor && r.actor !== filters.actor) { cursor.continue(); return; }
        if (filters.affects && !r.affects?.includes(filters.affects)) { cursor.continue(); return; }

        if (skipped < offset) { skipped++; cursor.continue(); return; }
        results.push(r);
        cursor.continue();
      };
      req.onerror = () => resolve([]);
    });
  }

  // Index-assisted query for action or actor
  if (filters.action || filters.actor) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const indexName = filters.action ? 'action' : 'actor';
      const indexValue = filters.action || filters.actor;
      const idx = store.index(indexName);
      const results = [];
      let skipped = 0;

      // Cursor over matching index values, walk backwards
      const req = idx.openCursor(IDBKeyRange.only(indexValue), 'prev');
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        const r = cursor.value;
        // Cross-filter
        if (filters.action && filters.actor && r.actor !== filters.actor) { cursor.continue(); return; }
        if (filters.action && filters.actor && r.action !== filters.action) { cursor.continue(); return; }
        if (filters.affects && !r.affects?.includes(filters.affects)) { cursor.continue(); return; }

        if (skipped < offset) { skipped++; cursor.continue(); return; }
        results.push(r);
        cursor.continue();
      };
      req.onerror = () => resolve([]);
    });
  }

  // Default: cursor scan backwards (newest first) with limit — never loads all into memory
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const results = [];
    let skipped = 0;

    const req = store.openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || results.length >= limit) {
        resolve(results);
        return;
      }
      if (skipped < offset) { skipped++; cursor.continue(); return; }
      results.push(cursor.value);
      cursor.continue();
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
// Uses cursor to read only the last N records — never loads full DB into memory
const verifyChain = async (limit = 200) => {
  const db = await openDB();

  // Step 1: collect last N records using reverse cursor
  const records = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const collected = [];
    const req = store.openCursor(null, 'prev'); // newest first
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || collected.length >= limit) {
        resolve(collected.reverse()); // reverse to chronological order
        return;
      }
      collected.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => resolve([]);
  });

  if (records.length === 0) {
    return { checked: 0, valid: true, violations: [] };
  }

  // Step 2: verify in batches (non-blocking, yields to UI between batches)
  const BATCH_SIZE = 50;
  const violations = [];

  for (let batchStart = 0; batchStart < records.length; batchStart += BATCH_SIZE) {
    const batch = records.slice(batchStart, batchStart + BATCH_SIZE);

    // Yield to UI thread between batches
    if (batchStart > 0) {
      await new Promise(r => setTimeout(r, 0));
    }

    for (let i = 0; i < batch.length; i++) {
      const globalIdx = batchStart + i;
      const record = batch[i];

      // Recompute hash from payload fields only (exclude seq, orderId which are denormalized)
      const { hash: _h, seq: _s, orderId: _o, ...hashPayload } = record;
      const recomputed = await sha256(hashPayload);

      if (recomputed !== record.hash) {
        violations.push({ seq: record.seq, type: 'hash_mismatch', expected: recomputed, actual: record.hash });
      }

      // Check prevHash link
      if (globalIdx > 0) {
        const prevRecord = records[globalIdx - 1];
        if (record.prevHash !== prevRecord.hash) {
          violations.push({ seq: record.seq, type: 'chain_break', expected: prevRecord.hash, actual: record.prevHash });
        }
      }

      // Early exit on too many violations (likely corrupted)
      if (violations.length >= 10) break;
    }
    if (violations.length >= 10) break;
  }

  return { checked: records.length, valid: violations.length === 0, violations };
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
