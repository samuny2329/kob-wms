// ── Activity History Database (IndexedDB) ────────────────────────────────────
// Stores detailed pick/pack/outbound/dispatch logs with full traceability
// Capacity: 100MB+ (~100,000+ records), queryable by worker/date/AWB/order
// Future: add Odoo sync to persist in PostgreSQL via Docker

const DB_NAME = 'wms_activity_history';
const DB_VERSION = 1;
const STORE_NAME = 'activities';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('action', 'action', { unique: false });
                store.createIndex('username', 'username', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('yearMonth', 'yearMonth', { unique: false });
                store.createIndex('orderRef', 'orderRef', { unique: false });
                store.createIndex('awb', 'awb', { unique: false });
                store.createIndex('action_user', ['action', 'username'], { unique: false });
                store.createIndex('action_date', ['action', 'date'], { unique: false });
                store.createIndex('user_date', ['username', 'date'], { unique: false });
            }
        };
    });
}

// Add a single activity record
export async function addActivity(record) {
    try {
        const db = await openDB();
        const ts = record.timestamp || Date.now();
        const d = new Date(ts);
        const entry = {
            ...record,
            timestamp: ts,
            date: d.toISOString().slice(0, 10),           // "2026-03-30"
            yearMonth: d.toISOString().slice(0, 7),        // "2026-03"
            year: d.getFullYear(),
            hour: d.getHours(),
        };
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.add(entry);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        console.warn('ActivityDB addActivity failed:', e);
    }
}

// Query activities with filters
// filters: { action, username, dateFrom, dateTo, orderRef, awb, limit, offset }
export async function queryActivities(filters = {}) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const results = [];
            let source;

            // Choose best index based on filters
            if (filters.awb) {
                source = store.index('awb').openCursor(IDBKeyRange.only(filters.awb), 'prev');
            } else if (filters.orderRef) {
                source = store.index('orderRef').openCursor(IDBKeyRange.only(filters.orderRef), 'prev');
            } else if (filters.username && filters.dateFrom && filters.dateTo) {
                source = store.index('user_date').openCursor(
                    IDBKeyRange.bound([filters.username, filters.dateFrom], [filters.username, filters.dateTo]),
                    'prev'
                );
            } else if (filters.action && filters.dateFrom && filters.dateTo) {
                source = store.index('action_date').openCursor(
                    IDBKeyRange.bound([filters.action, filters.dateFrom], [filters.action, filters.dateTo]),
                    'prev'
                );
            } else if (filters.username) {
                source = store.index('username').openCursor(IDBKeyRange.only(filters.username), 'prev');
            } else if (filters.action) {
                source = store.index('action').openCursor(IDBKeyRange.only(filters.action), 'prev');
            } else if (filters.dateFrom && filters.dateTo) {
                source = store.index('date').openCursor(
                    IDBKeyRange.bound(filters.dateFrom, filters.dateTo),
                    'prev'
                );
            } else {
                source = store.index('timestamp').openCursor(null, 'prev');
            }

            const limit = filters.limit || 200;
            const offset = filters.offset || 0;
            let skipped = 0;

            source.onsuccess = (e) => {
                const cursor = e.target.result;
                if (!cursor || results.length >= limit) {
                    resolve(results);
                    return;
                }

                const val = cursor.value;

                // Apply additional filters not covered by index
                let match = true;
                if (filters.action && !filters.dateFrom && val.action !== filters.action) match = false;
                if (filters.username && !filters.dateFrom && val.username !== filters.username) match = false;
                if (filters.dateFrom && val.date < filters.dateFrom) match = false;
                if (filters.dateTo && val.date > filters.dateTo) match = false;
                if (filters.searchText) {
                    const s = filters.searchText.toLowerCase();
                    const searchable = `${val.orderRef || ''} ${val.awb || ''} ${val.sku || ''} ${val.name || ''} ${val.username || ''}`.toLowerCase();
                    if (!searchable.includes(s)) match = false;
                }

                if (match) {
                    if (skipped < offset) {
                        skipped++;
                    } else {
                        results.push(val);
                    }
                }
                cursor.continue();
            };
            source.onerror = () => reject(source.error);
            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        console.warn('ActivityDB query failed:', e);
        return [];
    }
}

// Get summary stats for a date range
// Returns: { totalPick, totalPack, totalScan, totalDispatch, byWorker: { username: { pick, pack, scan } } }
export async function getStats(dateFrom, dateTo, username) {
    try {
        const filters = { dateFrom, dateTo, limit: 50000 };
        if (username) filters.username = username;
        const records = await queryActivities(filters);

        const stats = {
            totalPick: 0, totalPack: 0, totalScan: 0, totalDispatch: 0,
            totalOrders: new Set(), totalAWBs: new Set(),
            byWorker: {}, byDate: {}, byHour: {},
        };

        records.forEach(r => {
            // Totals
            if (r.action === 'pick') stats.totalPick++;
            if (r.action === 'pack' || r.action === 'pack-handheld' || r.action === 'pack-pos') stats.totalPack++;
            if (r.action === 'scan') stats.totalScan++;
            if (r.action === 'dispatch') stats.totalDispatch++;
            if (r.orderRef) stats.totalOrders.add(r.orderRef);
            if (r.awb) stats.totalAWBs.add(r.awb);

            // By worker
            const w = r.name || r.username || 'Unknown';
            if (!stats.byWorker[w]) stats.byWorker[w] = { pick: 0, pack: 0, scan: 0, dispatch: 0, orders: new Set() };
            if (r.action === 'pick') stats.byWorker[w].pick++;
            if (r.action === 'pack' || r.action === 'pack-handheld' || r.action === 'pack-pos') stats.byWorker[w].pack++;
            if (r.action === 'scan') stats.byWorker[w].scan++;
            if (r.action === 'dispatch') stats.byWorker[w].dispatch++;
            if (r.orderRef) stats.byWorker[w].orders.add(r.orderRef);

            // By date
            if (!stats.byDate[r.date]) stats.byDate[r.date] = { pick: 0, pack: 0, scan: 0 };
            if (r.action === 'pick') stats.byDate[r.date].pick++;
            if (r.action === 'pack' || r.action === 'pack-handheld' || r.action === 'pack-pos') stats.byDate[r.date].pack++;
            if (r.action === 'scan') stats.byDate[r.date].scan++;

            // By hour
            const h = r.hour ?? 0;
            if (!stats.byHour[h]) stats.byHour[h] = 0;
            stats.byHour[h]++;
        });

        // Convert Sets to counts
        stats.totalOrders = stats.totalOrders.size;
        stats.totalAWBs = stats.totalAWBs.size;
        Object.values(stats.byWorker).forEach(w => { w.orders = w.orders.size; });

        return stats;
    } catch (e) {
        console.warn('ActivityDB getStats failed:', e);
        return { totalPick: 0, totalPack: 0, totalScan: 0, totalDispatch: 0, totalOrders: 0, totalAWBs: 0, byWorker: {}, byDate: {}, byHour: {} };
    }
}

// Get unique worker names
export async function getWorkers() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const idx = store.index('username');
            const req = idx.openKeyCursor(null, 'nextunique');
            const workers = [];
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    if (cursor.key) workers.push(cursor.key);
                    cursor.continue();
                } else {
                    resolve(workers);
                }
            };
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        return [];
    }
}

// Get total record count
export async function getCount() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        return 0;
    }
}

// Export all data as JSON (for backup / Odoo sync)
export async function exportAll() {
    return queryActivities({ limit: 999999 });
}

// Clear all data
export async function clearAll() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        console.warn('ActivityDB clear failed:', e);
    }
}
