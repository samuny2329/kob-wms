/**
 * OfflineQueue — IndexedDB-backed action queue
 *
 * Stores user actions (scan, pick, pack, status update) locally
 * so they survive page refresh, browser crash, and network outage.
 * SyncEngine drains the queue when back online.
 *
 * Usage:
 *   import offlineQueue from './offlineQueue';
 *   await offlineQueue.push({ action: 'pick', orderId: 100, itemSku: 'ABC', qty: 1 });
 *   const pending = await offlineQueue.getAll();
 *   await offlineQueue.remove(id);
 *   await offlineQueue.clear();
 */

const DB_NAME = 'wms_offline';
const DB_VERSION = 1;
const STORE_NAME = 'action_queue';

let _db = null;

// ── Open / Create DB ──
const openDB = () => {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('action', 'action', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      _db = e.target.result;

      // Handle DB connection lost (e.g., browser update)
      _db.onclose = () => { _db = null; };
      _db.onversionchange = () => { _db.close(); _db = null; };

      resolve(_db);
    };

    request.onerror = () => reject(request.error);
  });
};

// ── Push action to queue ──
// action: { action: 'pick'|'pack'|'scan'|'updateStatus'|'confirmRTS', ...data }
// Returns the auto-generated id
const push = async (actionData) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      ...actionData,
      timestamp: Date.now(),
      status: 'pending',     // pending | processing | failed
      retries: 0,
      lastError: null,
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result); // returns id
    req.onerror = () => reject(req.error);
  });
};

// ── Get all pending actions (FIFO order) ──
const getAll = async (statusFilter = null) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      let results = req.result || [];
      if (statusFilter) {
        results = results.filter(r => r.status === statusFilter);
      }
      // Sort by timestamp ASC (FIFO)
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
};

// ── Get pending count ──
const count = async () => {
  const all = await getAll('pending');
  return all.length;
};

// ── Update record status ──
const updateStatus = async (id, status, error = null) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) return resolve(false);
      record.status = status;
      record.retries = (record.retries || 0) + (status === 'failed' ? 1 : 0);
      record.lastError = error;
      store.put(record);
      resolve(true);
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

// ── Remove single record (after successful sync) ──
const remove = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};

// ── Clear all (after full sync or logout) ──
const clear = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};

// ── Get failed items (retries >= maxRetries) for supervisor review ──
const getFailed = async (maxRetries = 3) => {
  const all = await getAll('failed');
  return all.filter(r => r.retries >= maxRetries);
};

// ── Stats ──
const getStats = async () => {
  const all = await getAll();
  return {
    total: all.length,
    pending: all.filter(r => r.status === 'pending').length,
    processing: all.filter(r => r.status === 'processing').length,
    failed: all.filter(r => r.status === 'failed').length,
    oldest: all[0]?.timestamp || null,
  };
};

const offlineQueue = { push, getAll, count, updateStatus, remove, clear, getFailed, getStats };
export default offlineQueue;
