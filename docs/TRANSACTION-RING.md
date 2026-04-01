# Transaction Ring — Event Ledger for KOB WMS

> วงแหวนธุรกรรม: hash-chain event stream ที่ทำงานใน browser
> ไม่กระทบ Odoo / Server / Network

---

## Overview

```
  ทุกการกระทำใน WMS = 1 Transaction (TX)
  TX ถูก chain ด้วย SHA-256 hash (เหมือน blockchain แต่ไม่มี mining)
  เก็บใน IndexedDB (browser) → ไม่ส่งไป server

  ┌──────────────────────────────────────────────────┐
  │  Transaction Ring (IndexedDB)                    │
  │                                                  │
  │  TX#1 ──► TX#2 ──► TX#3 ──► TX#4 ──► TX#5      │
  │  pick     pack     pick     scan     rts         │
  │  hash:a1  hash:b2  hash:c3  hash:d4  hash:e5    │
  │  prev:00  prev:a1  prev:b2  prev:c3  prev:d4    │
  │                                                  │
  │  ◄──── max 10,000 TXs (oldest pruned) ────►     │
  └────────┬─────────────┬─────────────┬─────────────┘
           │             │             │
    ┌──────▼──────┐ ┌────▼──────┐ ┌───▼──────────┐
    │ Subscription│ │ Broadcast │ │ Query/Trail  │
    │ Engine      │ │ Channel   │ │ Engine       │
    │             │ │           │ │              │
    │ role-based  │ │ cross-tab │ │ filter by    │
    │ notify      │ │ sync      │ │ action/order │
    └─────────────┘ └───────────┘ └──────────────┘
```

---

## Module Map

```
src/services/
  transactionRing.js    Ring buffer + SHA-256 hash chain (IndexedDB)
  txSubscription.js     Role-based subscribe/notify engine
  txBroadcast.js        BroadcastChannel API (cross-tab sync)

src/hooks/
  useTransactionRing.js React hook — emit, subscribe, query, notifications
```

---

## Box 1: TransactionRing (Ring Buffer + Hash Chain)

```
File: src/services/transactionRing.js
```

### TX Structure

```
{
  seq:       42                          ← auto-increment ID
  hash:      "a3f8c1d2e5..."            ← SHA-256 of payload
  prevHash:  "7b2d4e9f1a..."            ← previous TX's hash (chain link)
  action:    "pick"                      ← what happened
  actor:     "picker01"                  ← who did it
  target:    { orderId: 100,             ← what was affected
               sku: "STDH080",
               qty: 1 }
  affects:   ["packer","supervisor"]     ← who should know
  meta:      { location: "A-01-03" }     ← extra context
  timestamp: 1711929600000               ← when
}
```

### Hash Chain Flow

```
  TX#1 (genesis)           TX#2                    TX#3
  ┌─────────────┐          ┌─────────────┐         ┌─────────────┐
  │ prevHash:   │          │ prevHash:   │         │ prevHash:   │
  │ 000000...   │          │ a1b2c3...   │◄────────│ d4e5f6...   │
  │             │          │             │         │             │
  │ payload     │ SHA-256  │ payload     │ SHA-256 │ payload     │
  │ ──────────► │────►     │ ──────────► │────►    │ ──────────► │
  │             │          │             │         │             │
  │ hash:       │          │ hash:       │         │ hash:       │
  │ a1b2c3...  ─┼─────────►│ d4e5f6...  ─┼────────►│ g7h8i9...  │
  └─────────────┘          └─────────────┘         └─────────────┘

  ถ้ามีคนแก้ TX#2 → hash เปลี่ยน → TX#3.prevHash ≠ TX#2.hash → VIOLATION!
```

### Ring Pruning

```
  Ring Size: 10,000 TXs (configurable)

  ┌────┬────┬────┬────┬────┬─ ─ ─ ─┬────┬────┐
  │ 01 │ 02 │ 03 │ 04 │ 05 │       │9999│10K │  ← full
  └────┴────┴────┴────┴────┴─ ─ ─ ─┴────┴────┘

  New TX#10001 arrives:
  ┌────┬────┬────┬────┬─ ─ ─ ─┬────┬────┬─────┐
  │ 02 │ 03 │ 04 │ 05 │       │9999│10K │10001│  ← TX#01 pruned
  └────┴────┴────┴────┴─ ─ ─ ─┴────┴────┴─────┘
```

### API

```javascript
import txRing from '../services/transactionRing';

// Append
const tx = await txRing.append({
  action: 'pick',
  actor: 'picker01',
  target: { orderId: 100, sku: 'STDH080', qty: 1 },
  affects: ['packer', 'supervisor'],
});

// Query
const recent = await txRing.query({ action: 'pick', since: Date.now() - 3600000 });
const trail  = await txRing.getOrderTrail(100);

// Verify integrity
const result = await txRing.verifyChain();
// { checked: 500, valid: true, violations: [] }
```

---

## Box 2: TxSubscription (Role-Based Notify)

```
File: src/services/txSubscription.js
```

### Routing Rules

```
  TX action        Who gets notified
  ─────────        ──────────────────
  pick          →  packer, senior, admin
  pack          →  outbound, senior, admin
  scan          →  outbound, senior, admin
  confirmRTS    →  outbound, senior, admin
  dispatch      →  senior, admin
  adjust        →  senior, admin
  cycleCount    →  senior, admin
  transfer      →  senior, admin, picker, packer
  gwp           →  packer, senior, admin
  login/logout  →  admin
```

### Notification Flow

```
  picker01 picks item
       │
       ▼
  txRing.append({ action: 'pick', actor: 'picker01', ... })
       │
       ▼
  txSub.notify(tx)
       │
       ├── packer01 subscribed as 'packer'?
       │   YES → callback("Order #100 picked — ready to pack")
       │
       ├── senior01 subscribed as 'senior'?
       │   YES → callback("Order #100 picked by picker01")
       │
       ├── picker01 is the actor?
       │   SKIP (don't notify yourself)
       │
       └── outbound01 subscribed as 'outbound'?
           'outbound' not in pick routes → SKIP
```

### API

```javascript
import txSub from '../services/txSubscription';

// Subscribe
const unsub = txSub.subscribe('packer01', 'packer', (tx, message) => {
  showNotification(message);
  // message = "📦 Order #100 picked by picker01 — ready to pack"
});

// Custom filters
const unsub2 = txSub.subscribe('senior01', 'senior', callback, {
  actions: ['confirmRTS', 'adjust'],   // only these actions
  orderIds: [100, 101],                // only these orders
});

// Cleanup
unsub();
```

---

## Box 3: TxBroadcast (Cross-Tab Sync)

```
File: src/services/txBroadcast.js
```

### How It Works

```
  Same computer, same browser, multiple tabs:

  Tab 1 (Picker)          Tab 2 (Packer)         Tab 3 (Dashboard)
  ┌───────────┐           ┌───────────┐          ┌───────────┐
  │ picks item│           │           │          │           │
  │           │           │           │          │           │
  │ txBroadcast           │           │          │           │
  │ .send(tx) │           │           │          │           │
  └─────┬─────┘           └─────┬─────┘          └─────┬─────┘
        │                       │                       │
        ▼                       ▼                       ▼
  ┌─────────────────────────────────────────────────────────┐
  │            BroadcastChannel: "wms-tx-ring"              │
  │                                                         │
  │   postMessage({ type: 'tx', payload: tx })              │
  │                                                         │
  │   → Tab 2 receives → txSub.notify(tx) → 🔔 notify      │
  │   → Tab 3 receives → txSub.notify(tx) → 📊 update      │
  └─────────────────────────────────────────────────────────┘

  ✅ No network — browser internal only
  ✅ No server — instant delivery
  ✅ No setup — BroadcastChannel is browser built-in
```

### API

```javascript
import txBroadcast from '../services/txBroadcast';

// Start receiving (usually in useEffect)
txBroadcast.start((tx) => {
  // TX from another tab
  txSub.notify(tx);
});

// Send (after creating a TX)
txBroadcast.send(tx);

// Stop (cleanup)
txBroadcast.stop();
```

---

## Integration: useTransactionRing Hook

```
File: src/hooks/useTransactionRing.js
```

### Usage in Components

```jsx
import useTransactionRing from '../hooks/useTransactionRing';

const PickPage = ({ currentUser }) => {
  const { emit, notifications, unreadCount, orderTrail } = useTransactionRing({
    userId: currentUser.username,
    role: currentUser.role,
    onNotification: (tx, msg) => addToast(msg),
  });

  const handlePick = async (order, item) => {
    // ... update local state ...

    // Emit TX (auto: hash chain + notify + broadcast)
    await emit('pick', {
      orderId: order.id,
      orderRef: order.ref,
      sku: item.sku,
      qty: 1,
    });
  };

  return (
    <div>
      {/* Notification badge */}
      <Bell count={unreadCount} />

      {/* Order audit trail */}
      <AuditTrail trail={await orderTrail(order.id)} />
    </div>
  );
};
```

### What `emit()` Does (Complete Flow)

```
  emit('pick', { orderId: 100, sku: 'STDH080' })
       │
       ▼
  1. txRing.append(...)         ← Save to IndexedDB + hash chain
       │
       ▼
  2. txSub.notify(tx)           ← Notify local subscribers by role
       │
       ├── packer01 → 🔔 "Order #100 ready to pack"
       └── senior01 → 📊 dashboard update
       │
       ▼
  3. txBroadcast.send(tx)       ← Send to other browser tabs
       │
       ├── Tab 2 → txSub.notify(tx) → 🔔 packer sees notification
       └── Tab 3 → txSub.notify(tx) → 📊 dashboard updates
       │
       ▼
  4. Return tx object           ← { hash, seq, timestamp, ... }
```

---

## Security: Tamper Detection

```javascript
// Verify the entire chain (run periodically or on demand)
const result = await txRing.verifyChain();

if (!result.valid) {
  console.error('DATA INTEGRITY VIOLATION:', result.violations);
  // violations: [
  //   { seq: 42, type: 'hash_mismatch', expected: 'abc...', actual: 'xyz...' },
  //   { seq: 43, type: 'chain_break', expected: 'def...', actual: '000...' },
  // ]
}
```

---

## Performance

| Operation | Time | Storage |
|-----------|------|---------|
| `append()` (write + hash) | ~2ms | IndexedDB |
| `query()` (indexed lookup) | ~1-5ms | IndexedDB |
| `notify()` (local callbacks) | < 0.1ms | Memory |
| `broadcast.send()` (cross-tab) | < 0.1ms | BroadcastChannel |
| `verifyChain(500)` | ~100ms | CPU |
| Ring size 10,000 TXs | ~5MB | IndexedDB |

---

## Impact on Existing System

```
  Transaction Ring              Odoo Server
  ─────────────────            ─────────────
  ✅ Browser only               ❌ Not touched
  ✅ IndexedDB storage          ❌ No extra API calls
  ✅ BroadcastChannel           ❌ No database changes
  ✅ Web Crypto SHA-256         ❌ No network traffic
  ✅ ~2ms per TX                ❌ No performance impact
  ✅ No dependencies            ❌ No Odoo modules needed
```
