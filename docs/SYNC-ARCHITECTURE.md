# Sync Architecture — KOB WMS Pro

> Data Storage, Caching, Flow, Fetching & Throttling
> ป้องกันระบบล่มหน้างาน

---

## Overview

```
  +-----------------------------------------------------------------+
  |  Browser (React)                                                |
  |                                                                 |
  |  +----------+     +-----------+     +------------------------+  |
  |  |          |     |           |     |     SyncEngine         |  |
  |  |  UI      |<--->|  Cache    |<--->|                        |  |
  |  |  Layer   |     |  Layer    |     |  - Smart Polling       |  |
  |  |          |     |           |     |  - Backoff             |  |
  |  | Pick     |     | IndexedDB |     |  - Queue Drain         |  |
  |  | Pack     |     | + Memory  |     |  - Conflict Resolve    |  |
  |  | Scan     |     | Maps      |     |  - Request Dedup       |  |
  |  +----------+     +-----------+     +----------+-------------+  |
  |       ^                                        |                |
  |       |                                        v                |
  |       |  reads cache               +-----------+-----------+    |
  |       |  (never waits              |   RequestManager      |    |
  |       |   for network)             |   - Dedup inflight    |    |
  |       |                            |   - Cancel stale      |    |
  |       +---[instant response]       |   - Throttle/Debounce |    |
  |                                    +----------+------------+    |
  +-----------------------------------------------------------------+
                                                   |
                                            HTTP / JSON-RPC
                                                   |
                                                   v
                                       +-----------+----------+
                                       |    Odoo 18 Server    |
                                       |    (PostgreSQL 16)   |
                                       +----------------------+
```

---

## Module Map

```
src/services/
  syncEngine.js        Orchestrator: ties all modules together
  requestManager.js    Dedup, cancel, throttle, debounce
  offlineQueue.js      IndexedDB action queue (survives crash)
  productCache.js      IndexedDB product catalog + memory Maps
  conflictResolver.js  Field-level merge for concurrent edits
  odooApi.js           Odoo JSON-RPC client (bug fixes applied)

src/hooks/
  useOdooSync.js       React hook wrapping SyncEngine
```

---

## Box 1: SyncEngine (Smart Polling + Backoff)

```
File: src/services/syncEngine.js
```

### Flow

```
                       +--[start()]--+
                       |             |
                       v             |
                 +-----+------+     |
                 |  sync()    |     |
                 |  (fetch    |     |
                 |   Odoo)    |     |
                 +-----+------+     |
                       |            |
              success? |            |
           +-----------+---------+  |
           |                     |  |
           v                     v  |
    +------+------+    +--------+---+---+
    | Reset       |    | Increment      |
    | errors = 0  |    | errors++       |
    | interval =  |    | interval =     |
    |  15s/60s    |    |  30/60/120/240s|
    +------+------+    +--------+-------+
           |                    |
           v                    v
    +------+--------------------+------+
    |       scheduleNext()             |
    |  setTimeout(sync, interval)      |
    +----------------------------------+
```

### Polling Intervals

| State | Interval | Trigger |
|-------|----------|---------|
| Active (user interacting) | **15 seconds** | mousedown, keydown, touchstart, scroll |
| Idle (no interaction > 2min) | **60 seconds** | Automatic after 2min inactivity |
| Tab hidden | **Paused** | `document.visibilitychange` |
| Tab visible again | **Immediate sync** | `document.visibilitychange` |
| Error (1st fail) | **30 seconds** | Exponential backoff starts |
| Error (2nd fail) | **60 seconds** | Doubles each time |
| Error (3rd fail) | **120 seconds** | Marks `isOnline = false` |
| Error (4th+ fail) | **240 seconds** | Max backoff cap |
| Back online | **Immediate sync** | `window.online` event |

### Key Design Decisions

- **Only marks offline after 3 consecutive failures** (not 1) to avoid false alarms from transient network blips
- **Cancels previous sync** when a new one starts (no overlapping requests)
- **Tab visibility** stops/starts polling (saves server resources when user switches tabs)

---

## Box 2: OfflineQueue (IndexedDB)

```
File: src/services/offlineQueue.js
```

### Flow

```
  Worker scans barcode
       |
       v
  +----+----------+
  | offlineQueue   |
  | .push({        |
  |   action:'pick'|
  |   orderId: 100 |          writes to
  |   itemSku:'ABC'|  ------> IndexedDB
  |   qty: 1       |          (persistent)
  | })             |
  +----+-----------+
       |
       | UI shows instantly:
       | "1 item pending sync"
       |
       v
  +----+-----------+           +------------------+
  | SyncEngine     |           |                  |
  | drainQueue()   |  online?  | Process against  |
  | every 5s       +---------->| Odoo server      |
  |                |   yes     |                  |
  +----+-----------+           +--------+---------+
       |                                |
       | no (offline)           success |  fail
       |                       +--------+---------+
       v                       |                  |
  +----+-----------+    +------+-----+    +-------+------+
  | Stay in queue  |    | Remove     |    | Retry up to  |
  | retry when     |    | from queue |    | 3 times      |
  | back online    |    |            |    | then flag for|
  +----------------+    +------------+    | supervisor   |
                                          +--------------+
```

### IndexedDB Schema

```
Database: wms_offline (v1)
Store: action_queue
  - id          (autoIncrement, keyPath)
  - action      (indexed) — 'pick' | 'pack' | 'scan' | 'updateStatus' | 'confirmRTS'
  - timestamp   (indexed) — Date.now()
  - status      (indexed) — 'pending' | 'processing' | 'failed'
  - retries     — number (0-3)
  - lastError   — string | null
  - [action-specific fields: orderId, itemSku, qty, platform, ...]
```

### Why IndexedDB (not localStorage)?

| Feature | localStorage | IndexedDB |
|---------|-------------|-----------|
| Max size | ~5-10 MB | ~50 MB+ |
| Blocking | Yes (sync) | No (async) |
| Structured data | JSON string only | Native objects |
| Survives crash | Usually | Always |
| Indexed queries | No | Yes |
| Concurrent tabs | Race conditions | Transaction-safe |

---

## Box 3: ProductCache (IndexedDB + Memory)

```
File: src/services/productCache.js
```

### Flow

```
  App starts
       |
       v
  +----+-----------+
  | productCache   |
  | .initialize()  |
  +----+-----------+
       |
       v
  +----+-----------+      +------------------+
  | Load from      |      |                  |
  | IndexedDB      +----->| Build in-memory  |
  | (instant)      |      | Maps:            |
  +----+-----------+      |  barcodeMap      |
       |                  |  skuMap          |
       | Is cache stale?  |  idMap           |
       | (TTL > 1hr)      +--------+---------+
       |                           |
  +----+---+                       | Ready for
  | Yes    | No                    | lookups (<1ms)
  +----+---+ |                     v
       |     |              +------+--------+
       v     v              | lookupBarcode |
  +---------+-+             | lookupSku     |
  | Fetch     |             | search        |
  | from Odoo |             +---------------+
  | (bg)      |
  +-----+-----+
        |
        v
  +-----+------+
  | Save to    |
  | IndexedDB  |
  | + rebuild  |
  | Maps       |
  +------------+
```

### Stale-While-Revalidate Strategy

```
  Request         Cache State          Action
  -------         -----------          ------
  1st ever        EMPTY                Block → fetch from Odoo → save → return
  Within 1hr      FRESH                Return from memory Map (instant)
  After 1hr       STALE                Return stale data + fetch in background
  Odoo down       STALE                Return stale data (still works!)
  After logout    CLEARED              Next login fetches fresh
```

### Lookup Performance

| Method | Data Source | Speed |
|--------|-----------|-------|
| `lookupBarcode('8859...')` | In-memory Map | **< 0.1ms** |
| `lookupSku('STDH080')` | In-memory Map | **< 0.1ms** |
| `search('skin', 10)` | In-memory iteration | **< 5ms** |
| Old: `productsData.find(p => p.sku === sku)` | Array scan | **1-50ms** (scales with products) |

---

## Box 4: RequestManager (Dedup + Cancel + Throttle)

```
File: src/services/requestManager.js
```

### Flow

```
  Component calls API
       |
       v
  +----+----------+
  | requestManager|
  | .request(     |
  |   'fetchOrders|
  |   ', fetchFn) |
  +----+----------+
       |
       v
  +----+----------+
  | Same key      |    +----------------+
  | in-flight?    +--->| YES: Return    |
  |               |    | existing       |
  +----+----------+    | promise (DEDUP)|
       |               +----------------+
       | NO
       v
  +----+----------+
  | Cancel         |    +----------------+
  | previous?      +--->| YES: Abort     |
  | (option)       |    | old request    |
  +----+-----------+    +----------------+
       |
       v
  +----+-----------+
  | Execute fn()   |
  | with AbortCtrl |
  | + timeout      |
  +----+-----------+
       |
       v
  +----+-----------+
  | Cleanup:       |
  | remove from    |
  | inflight map   |
  +----------------+
```

### Request Protection

```
  BEFORE (10 workers, 10s poll):         AFTER:
  10 x 5 APIs x 6/min = 300 calls/min   10 x 5 APIs x 1-4/min = 50-200 calls/min
                                          + dedup = ~50-100 effective calls/min
```

### Throttle vs Debounce

```
  Throttle (rate limit):                Debounce (wait for calm):

  calls:  x x x x x x                  calls:  x x x x x x
  exec:   x . . x . .                  exec:   . . . . . x
          ^     ^                                         ^
          every N ms                          wait N ms after last
```

| Method | Use Case | Default |
|--------|----------|---------|
| `throttle('sync', fn, 2000)` | Sync button — max 1 per 2s | 2s |
| `debounce('search', fn, 500)` | Search input — wait for typing to stop | 1s |
| `request(key, fn)` | API call dedup — same call returns same promise | - |
| `request(key, fn, {cancelPrevious: true})` | Sync — cancel stale, start fresh | - |

---

## Box 5: ConflictResolver (Field-Level Merge)

```
File: src/services/conflictResolver.js
```

### Flow

```
  Odoo returns           Local state has
  remote orders          local orders
       |                      |
       v                      v
  +----+----------------------+----+
  |       mergeOrders()            |
  +----+---------------------------+
       |
       v
  For each remote order:
       |
       +---> Has matching local? ---> NO ---> Add (new from Odoo)
       |          |
       |         YES
       |          |
       |          v
       |     +---------+
       |     | Remote  |    +----> Return remote
       |     | status  +--->|      (Odoo is truth)
       |     | = rts/  |   |
       |     | shipped |   |
       |     +---------+   |
       |          |         |
       |         NO         |
       |          v         |
       |     +---------+   |
       |     | Remote  |   +----> Remove order
       |     | status  +--->|     (cancelled)
       |     |=cancel  |   |
       |     +---------+   |
       |          |         |
       |         NO         |
       |          v         |
       |   +-----------+   |
       |   | Compare   |   |
       |   | progress  |   |
       |   | per item  |   |
       |   +-----+-----+   |
       |         |          |
       |         v          |
       |   +-----------+   |
       |   | MERGE:    |   |
       |   | max(pick) |   +----> Return merged
       |   | max(pack) |   |
       |   | remote    |   |
       |   | barcode   |   |
       |   +-----------+   |
       |                   |
       v                   |
  For local-only orders:   |
       |                   |
       +---> Has odooPickingId? ---> YES ---> Discard
       |          |                           (archived/cancelled in Odoo)
       |         NO
       |          |
       |          v
       |     Keep (mock/demo order)
       |
       v
  Return merged array
```

### Merge Rules

| Rule | Priority | Example |
|------|----------|---------|
| Odoo `done`/`rts` | **Always wins** | Picking validated in Odoo = done |
| Odoo `cancelled` | **Always wins** | Order removed from WMS |
| Higher `picked` count | **Max wins** | Worker A: 2, Worker B: 3 → use 3 |
| Higher `packed` count | **Max wins** | Same logic as picked |
| Barcode | **Remote wins** | Odoo master data is truth |
| Customer/Platform | **Remote wins** | Master data from Odoo |
| Local metadata (pickedBy, packedAt) | **Preserved** | Audit trail kept |
| Local-only orders (no odooPickingId) | **Kept** | Demo/mock data stays |
| Odoo-origin orders not in response | **Removed** | Old/archived pickings cleaned up |

### Before vs After

```
  BEFORE (last-write-wins):

  Worker A picks item 1  →  saves [item1: picked=1]
  Worker B picks item 2  →  saves [item2: picked=1]
  Sync: Worker B overwrites A  →  LOST item1 pick!

  AFTER (field-level merge):

  Worker A picks item 1  →  local: [item1: picked=1]
  Worker B picks item 2  →  local: [item2: picked=1]
  Sync: merge per-item   →  [item1: picked=1, item2: picked=1]  ✓
```

---

## Integration: How They Work Together

```
  +--[User scans barcode]-------------------------------------------+
  |                                                                 |
  | 1. productCache.lookupBarcode('8859...')  →  instant result     |
  |    (from in-memory Map, no network)                             |
  |                                                                 |
  | 2. offlineQueue.push({ action:'pick', ... })                    |
  |    (saved to IndexedDB immediately)                             |
  |    UI shows: "Picked! (syncing...)"                             |
  |                                                                 |
  | 3. If online: SyncEngine.drainQueue() processes it              |
  |    requestManager.request('drain:pick', ...) → Odoo             |
  |    Success → offlineQueue.remove(id)                            |
  |    UI shows: "Synced ✓"                                         |
  |                                                                 |
  | 4. If offline: stays in queue                                   |
  |    Window 'online' event → drainQueue() → process all           |
  |    UI shows: "Synced 3 queued actions"                          |
  |                                                                 |
  +--[Background: SyncEngine poll]----------------------------------+
  |                                                                 |
  | 5. Every 15s (active) / 60s (idle):                             |
  |    requestManager.request('sync:main', fetchAll, {cancelPrev})  |
  |    → fetchAllOrders + fetchInventory + fetchWaves + fetchInvoices|
  |    → conflictResolver.mergeOrders(local, remote)                |
  |    → setSalesOrders(merged)                                     |
  |                                                                 |
  | 6. On error: backoff 30s → 60s → 120s → 240s                   |
  |    After 3 fails: isOnline = false                              |
  |    On recovery: immediate sync + drain queue                    |
  |                                                                 |
  +--[Tab hidden]---------------------------------------------------+
  |                                                                 |
  | 7. Polling pauses (saves server resources)                      |
  | 8. Tab visible → immediate sync                                 |
  |                                                                 |
  +-----------------------------------------------------------------+
```

---

## Bug Fixes Applied

### 1. OR Domain Builder (`fetchInventory`)

```diff
- locDomain = [...ors, ...conds, ['location_id.usage', '=', 'internal']];
+ locDomain = ['&', ...ors, ...conds, ['location_id.usage', '=', 'internal']];
```

**Problem:** `usage = internal` was AND'd with only the last OR condition
**Fix:** Wrap entire expression with explicit `'&'` operator

### 2. Cancelled Orders Stuck (`conflictResolver.js`)

**Problem:** Local orders from Odoo that were cancelled/archived stayed forever
**Fix:** `mergeOrders()` now removes orders that have `odooPickingId` but are no longer in Odoo response

### 3. Silent Error in `confirmRTS`

```diff
- await odooCallKw(..., 'stock.move.line', 'write', ...).catch(() => {});
+ await odooCallKw(..., 'stock.move.line', 'write', ...);
```

**Problem:** If move line write/create fails, `button_validate` still runs with wrong quantities
**Fix:** Let errors propagate so validation doesn't proceed with incorrect data

### 4. JSONRPC ID Collision

```diff
- jsonrpc: '2.0', method: 'call', id: Date.now(),
+ jsonrpc: '2.0', method: 'call', id: nextRequestId(),
```

**Problem:** Parallel API calls use same `Date.now()` → ID collision
**Fix:** Monotonic counter from `requestManager.nextRequestId()`

### 5. `fetchStockHistory` Location Domain

```diff
- domain.push('|');
- domain.push(...locDomain.slice(0, 2));
+ if (conds.length === 1) { domain.push(conds[0]); }
+ else { for (let i = 0; i < conds.length - 1; i++) domain.push('|'); domain.push(...conds); }
```

**Problem:** `slice(0, 2)` only took first condition, ignored rest
**Fix:** Proper Odoo prefix OR notation for N conditions

---

## Usage Examples

### In a component (scanning)

```jsx
import productCache from '../services/productCache';
import offlineQueue from '../services/offlineQueue';

const handleScan = async (barcode) => {
  // Instant lookup — no network needed
  const product = productCache.lookupBarcode(barcode);
  if (!product) {
    showError('Unknown barcode');
    return;
  }

  // Update UI immediately
  markItemPicked(product.sku);

  // Queue for Odoo sync (survives offline)
  await offlineQueue.push({
    action: 'pick',
    orderId: currentOrder.id,
    itemSku: product.sku,
    qty: 1,
  });
};
```

### In useOdooSync hook (existing API)

```jsx
const { isOnline, isSyncing, syncNow, queueChange, queueCount } = useOdooSync({
  apiConfigs, salesOrders, setSalesOrders,
  inventory, setInventory, waves, setWaves,
  invoices, setInvoices, addToast,
});

// Show sync status
<StatusBar online={isOnline} syncing={isSyncing} queued={queueCount} />

// Manual sync
<button onClick={syncNow}>Sync Now</button>
```

---

## Performance Comparison

| Metric | Before | After |
|--------|--------|-------|
| Poll frequency | Every 10s (fixed) | 15-60s (adaptive) |
| Calls to Odoo | ~30/min per user | ~5-15/min per user |
| Barcode lookup | ~1-50ms (array scan) | **< 0.1ms** (Map) |
| Offline capability | None (data lost) | Full queue + cache |
| Concurrent edit | Last-write-wins | Field-level merge |
| Tab hidden | Still polling | Paused |
| After crash | Data lost | IndexedDB persists |
| 10 users simultaneous | ~300 calls/min | ~50-100 calls/min |
