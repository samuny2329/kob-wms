/**
 * ProductCache — IndexedDB product catalog with TTL
 *
 * Products (SKU, barcode, name) change rarely but are read constantly
 * during scanning. This cache avoids re-fetching 500+ products every sync.
 *
 * Strategy:
 *   - First load: fetch from Odoo → store in IndexedDB
 *   - Subsequent loads: read from IndexedDB (instant)
 *   - Background refresh when TTL expires (stale-while-revalidate)
 *   - Barcode lookup in <1ms from memory Map
 *
 * Usage:
 *   import productCache from './productCache';
 *   await productCache.initialize(odooConfig);
 *   const product = productCache.lookupBarcode('8859458001234');
 *   const product = productCache.lookupSku('STDH080-REFILL');
 */

const DB_NAME = 'wms_cache';
const DB_VERSION = 1;
const STORE_NAME = 'products';
const META_STORE = 'cache_meta';
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

let _db = null;
let _barcodeMap = new Map();  // barcode → product (in-memory for speed)
let _skuMap = new Map();      // sku → product
let _idMap = new Map();       // id → product
let _initialized = false;
let _lastFetchTime = 0;

// ── Open DB ──
const openDB = () => {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('sku', 'sku', { unique: false });
        store.createIndex('barcode', 'barcode', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => {
      _db = e.target.result;
      _db.onclose = () => { _db = null; };
      resolve(_db);
    };
    request.onerror = () => reject(request.error);
  });
};

// ── Build in-memory lookup maps from IndexedDB ──
const buildMaps = async () => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const products = req.result || [];
      _barcodeMap.clear();
      _skuMap.clear();
      _idMap.clear();
      for (const p of products) {
        if (p.barcode) _barcodeMap.set(p.barcode, p);
        if (p.sku) _skuMap.set(p.sku, p);
        if (p.id) _idMap.set(p.id, p);
      }
      resolve(products);
    };
    req.onerror = () => resolve([]);
  });
};

// ── Save products to IndexedDB ──
const saveProducts = async (products) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(META_STORE);

    // Clear old products and write fresh
    store.clear();
    for (const p of products) {
      store.put(p);
    }

    // Update timestamp
    metaStore.put({ key: 'lastFetch', value: Date.now() });

    tx.oncomplete = () => {
      _lastFetchTime = Date.now();
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
};

// ── Get last fetch timestamp from IndexedDB ──
const getLastFetchTime = async () => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.get('lastFetch');
    req.onsuccess = () => resolve(req.result?.value || 0);
    req.onerror = () => resolve(0);
  });
};

// ── Initialize: load from IndexedDB, fetch if stale ──
// fetchFn: async () => [{ id, sku, name, barcode }]
const initialize = async (fetchFn, ttl = DEFAULT_TTL) => {
  // 1. Load existing cache from IndexedDB into memory
  const cached = await buildMaps();
  _lastFetchTime = await getLastFetchTime();

  const isStale = (Date.now() - _lastFetchTime) > ttl;
  const isEmpty = cached.length === 0;

  _initialized = cached.length > 0;

  // 2. If cache is fresh and non-empty, we're done
  if (!isEmpty && !isStale) {
    return { source: 'cache', count: cached.length };
  }

  // 3. Fetch fresh data (background if we have stale cache, blocking if empty)
  const doFetch = async () => {
    try {
      const products = await fetchFn();
      if (products && products.length > 0) {
        await saveProducts(products);
        await buildMaps();
        _initialized = true;
        return { source: 'odoo', count: products.length };
      }
    } catch (err) {
      // If fetch fails but we have cache, that's OK (stale-while-revalidate)
      if (cached.length > 0) {
        return { source: 'cache-stale', count: cached.length, error: err.message };
      }
      throw err;
    }
    return { source: 'cache', count: cached.length };
  };

  if (isEmpty) {
    // No cache at all — must block and wait
    return doFetch();
  }
  // Has stale cache — return immediately, refresh in background
  doFetch().catch(() => {}); // fire-and-forget
  return { source: 'cache-stale', count: cached.length };
};

// ── Lookup functions (synchronous, from memory) ──
const lookupBarcode = (barcode) => {
  if (!barcode) return null;
  return _barcodeMap.get(String(barcode)) || null;
};

const lookupSku = (sku) => {
  if (!sku) return null;
  return _skuMap.get(String(sku)) || null;
};

const lookupId = (id) => {
  if (!id) return null;
  return _idMap.get(Number(id)) || null;
};

// Search by partial name/sku (for autocomplete)
const search = (query, limit = 10) => {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const p of _skuMap.values()) {
    if (results.length >= limit) break;
    if (p.sku?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.includes(q)) {
      results.push(p);
    }
  }
  return results;
};

// ── Force refresh ──
const refresh = async (fetchFn) => {
  const products = await fetchFn();
  if (products && products.length > 0) {
    await saveProducts(products);
    await buildMaps();
  }
  return products?.length || 0;
};

// ── Patch: update barcode for specific SKUs (from Odoo sync) ──
const patchBarcodes = (patches) => {
  // patches: [{ sku, barcode }]
  for (const { sku, barcode } of patches) {
    const product = _skuMap.get(sku);
    if (product && barcode) {
      // Remove old barcode mapping
      if (product.barcode && product.barcode !== barcode) {
        _barcodeMap.delete(product.barcode);
      }
      product.barcode = barcode;
      _barcodeMap.set(barcode, product);
    }
  }
};

// ── Stats ──
const getStats = () => ({
  initialized: _initialized,
  productCount: _skuMap.size,
  barcodeCount: _barcodeMap.size,
  lastFetchTime: _lastFetchTime,
  ttlRemaining: Math.max(0, DEFAULT_TTL - (Date.now() - _lastFetchTime)),
  isStale: (Date.now() - _lastFetchTime) > DEFAULT_TTL,
});

// ── Clear cache (logout) ──
const clear = async () => {
  _barcodeMap.clear();
  _skuMap.clear();
  _idMap.clear();
  _initialized = false;
  _lastFetchTime = 0;
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(META_STORE).clear();
  } catch { /* ignore */ }
};

const productCache = {
  initialize, lookupBarcode, lookupSku, lookupId, search,
  refresh, patchBarcodes, clear, getStats,
  get isReady() { return _initialized; },
  get size() { return _skuMap.size; },
};

export default productCache;
