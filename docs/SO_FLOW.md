# WMS Pro — Sales Order Flow (End-to-End)

> Version 1.0 | Updated: 2026-03-27
> Miro Diagram: https://miro.com/app/board/uXjVGrM5Wms=/

## Status Flow

```
pending → picking → picked → packed → rts → scanned → shipped
                                       │
                                       ├→ auto-invoice (draft → posted)
                                       ├→ stock deducted (Odoo button_validate)
                                       └→ AWB generated (SPXTH/LZTH/JTTH...)
```

---

## 1. SO Sources (ขาเข้า)

| # | Source | How | File |
|---|--------|-----|------|
| 1 | **Shopee / Lazada / TikTok** | `usePlatformSync.js` polls every 60s → fetches orders from platform API → calls `createSalesOrder()` | `platformApi.js` → `odooApi.js` |
| 2 | **Odoo UI (Manual)** | Staff creates SO directly in Odoo 18 backend | Odoo backend |
| 3 | **WMS Settings (Test)** | Admin clicks "Create Test Orders" → `createTestSalesOrders()` | `odooApi.js` |
| 4 | **POS Pack (Walk-in)** | Packer scans products at counter → creates SO + packs immediately | `POSPack.jsx` → `odooApi.js` |

### Odoo Operations at This Stage
```
sale.order.create({
    partner_id,          // ECOMMERCE:SHOPEE / LAZADA / TIKTOK
    team_id,             // Sales team (Shopee, eMarketplace, Tiktok Shop)
    order_line,          // [{product_id, product_uom_qty, price_unit}]
    client_order_ref,    // Platform order reference
})
sale.order.action_confirm()  → auto-creates stock.picking (WH/OUT/XXXXX)
```

---

## 2. WMS Sync (ดึงเข้า WMS)

`useOdooSync.js` polls Odoo every **10 seconds**:

```
fetchAllOrders() →
  stock.picking search_read  (picking_type_code='outgoing', last 30 days)
  stock.move search_read     (items per picking)
  product.product read       (SKU, barcode, name)
  sale.order search_read     (team_id → detect platform)
```

**State mapping:**
| Odoo state | WMS status |
|------------|-----------|
| `assigned` | `pending` (ready to pick) |
| `done` | `rts` (shipped/validated) |
| `cancel` | `cancelled` |

**Storage:** React state (`orderData`) + `localStorage.wms_sales_orders`

---

## 3. Wave Sorting (จัดกลุ่ม — Optional)

Admin/Picker groups orders into waves before picking:

| Wave Type | Example |
|-----------|---------|
| By Platform | "Shopee Wave AM", "Lazada Wave PM" |
| By Courier | "Flash Express Batch", "Kerry Batch" |
| By Zone | "Zone A Wave", "Zone B Wave" |

**Physical:** Place a Tote per wave on a trolley, attach wave label.

---

## 4. Pick List (หยิบสินค้า)

**Status transition:** `pending` → `picking` → `picked`

### System Flow
1. Picker sees orders with status `pending`
2. Clicks **"Start Pick"** → status changes to `picking`
3. Scans product barcode for each item
4. System verifies: barcode matches SKU? Quantity complete?
5. Clicks **"Complete Pick"** → status changes to `picked`

### Physical Workflow
1. Picker takes trolley + empty Tote to **PICKFACE shelf**
2. Scans **Location tag** (e.g., A-01-01) on the shelf
3. Scans **Product barcode** on the item
4. Picks the required quantity → places into Tote
5. Repeats for all items in the order
6. Pushes trolley to **Pack Station**

### Error Handling
- Wrong barcode → system alerts, picker re-scans
- Insufficient stock → system shows shortage warning

---

## 5. Pack & Verify (แพ็คและตรวจสอบ)

**Status transition:** `picked` → `packed`

### System Flow
1. Packer sees orders with status `picked`
2. Scans barcode for each item to **verify** (matches pick list?)
3. Selects **Box size** (S / M / L / Oversize) from `BOX_TYPES`
4. Clicks **"Confirm Pack"** → status changes to `packed`

### Physical Workflow
1. Receive Tote from Pick Station
2. Lay out all items on the Pack Table
3. Scan verify each item (barcode gun)
4. Select box size → wrap fragile items with bubble wrap
5. Pack items into box → seal with tape
6. Place packed box in **staging area**

---

## 6. RTS — Ready To Ship (พร้อมส่ง)

**Status transition:** `packed` → `rts`

This is the **critical step** — triggers 3 parallel actions:

### A. Stock Deduction (Odoo)
```
stock.move.line write → set qty_done = demand qty
stock.picking button_validate → deducts stock
  → handles wizard: stock.backorder.confirmation / stock.immediate.transfer
  → verify: picking state = 'done'
```

### B. Auto-Invoice
```
sale.advance.payment.inv.create({advance_payment_method: 'delivered'})
  → create_invoices()
account.move search_read → find draft invoice
account.move action_post → post invoice (INV/2026/XXXXX)
```

### C. AWB Generation
```
Platform prefix + random 8-digit number:
  Shopee Express → SPXTH12345678
  Lazada Express → LZTH12345678
  TikTok Shop   → TTTH12345678
  Flash Express  → FLTH12345678
  Kerry Express  → KETH12345678
  J&T Express    → JTTH12345678
  Thai Post      → TPTH12345678
```

### Physical Workflow
1. Print **AWB label** (tracking number + courier info)
2. Stick label on the box
3. Place box into **courier sorting bin** (color-coded by courier)

---

## 7. Outbound Scan (สแกนขาออก)

**Status transition:** `rts` → `scanned`

### System Flow
1. QC staff scans **AWB barcode** on each box
2. System verifies: AWB matches order? Box in correct courier bin?
3. Records scan timestamp

### Physical Workflow
1. Take box from courier sorting bin
2. Scan AWB label with barcode gun
3. If correct → green light → place on loading pallet
4. If wrong bin → red alert → move to correct bin → rescan

### Error Handling
- Wrong courier bin → system shows red warning + correct bin assignment
- Already scanned → system shows "duplicate scan" warning

---

## 8. Manifest (ใบส่งของ)

### System Flow
1. System groups all scanned orders by courier
2. Generates manifest: box count, total weight, courier name
3. Print **Manifest Sheet**

### Physical Workflow
1. Print manifest for each courier batch
2. Attach manifest to the loading pallet/trolley
3. Count physical boxes vs manifest count → must match

---

## 9. Dispatch (จัดส่ง)

**Status transition:** `scanned` → `shipped`

### System Flow
1. Select courier → click **Dispatch**
2. Record: driver name, departure time, parcel count
3. Status changes to `shipped` → process complete

### Physical Workflow
1. Driver arrives at loading dock
2. Count boxes together (driver + warehouse staff)
3. Verify count matches manifest
4. Driver signs manifest (or digital signature)
5. Load boxes onto truck
6. Truck departs → **process complete**

---

## Odoo Models Written at Each Stage

| Stage | Models Read | Models Written |
|-------|------------|---------------|
| SO Creation | `product.product`, `res.partner`, `crm.team` | **`sale.order`** (create + confirm) |
| WMS Sync | `stock.picking`, `stock.move`, `product.product`, `sale.order` | — (read only) |
| Pick | — | `stock.move.line` (update qty) |
| RTS | `stock.picking`, `stock.move`, `stock.quant` | **`stock.move.line`** (write), **`stock.picking`** (validate) |
| Auto-Invoice | `sale.order` | **`sale.advance.payment.inv`**, **`account.move`** (post) |
| Inventory | `stock.quant`, `product.product`, `stock.location` | `stock.quant` (adjust) |

---

## Docker Infrastructure

```
Browser (localStorage cache)
    │ HTTP/HTTPS
    ▼
Nginx (:80) — Rate limit 10r/s + Security headers
    │ /web/*, /wms/* reverse proxy
    ▼
Odoo 18 (:8069) — JSON-RPC API + Session auth
    │ SQL
    ▼
PostgreSQL 16 (:5432) — All WMS data (14 Odoo models)
```

---

## Polling Intervals

| Hook | Interval | What it fetches |
|------|----------|----------------|
| `useOdooSync` | 10 seconds | Orders (stock.picking), Inventory, Waves, Invoices |
| `usePlatformSync` | 60 seconds | New orders from Shopee/Lazada/TikTok APIs |
