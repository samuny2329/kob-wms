# WMS Pro — Odoo 18 ERD (Entity Relationship Diagram)

> **Version:** 4.2.0 | **Updated:** 2026-03-31 | **Models:** 19 (16 core + 3 wizards)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        WMS Pro (React)                          │
│  Dashboard │ Pick │ Pack │ Inventory │ Full Count │ Fulfillment │
└──────────────────────────┬──────────────────────────────────────┘
                           │ JSON-RPC / REST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Odoo 18 Server                             │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  STOCK   │  │  SALES   │  │ INVOICE  │  │  MASTER  │       │
│  │ 8 models │  │ 3 models │  │ 2 models │  │ 6 models │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│                    PostgreSQL 16                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Full ERD Diagram (Mermaid)

```mermaid
erDiagram

    %% ══════════════════════════════════════
    %% STOCK (Warehouse) — 8 models
    %% ══════════════════════════════════════

    stock_picking {
        int id PK
        string name "WH/OUT/00001"
        int partner_id FK "res.partner"
        string state "draft|waiting|confirmed|assigned|done|cancel"
        string origin "SO origin ref"
        string note
        date scheduled_date
        int sale_id FK "sale.order"
        int company_id
        int location_id FK "stock.location (source)"
        int location_dest_id FK "stock.location (dest)"
    }

    stock_move {
        int id PK
        int picking_id FK "stock.picking"
        int product_id FK "product.product"
        float product_uom_qty "Demand qty"
        float quantity "Done qty"
        int location_id FK "stock.location (source)"
        int location_dest_id FK "stock.location (dest)"
        string state
        date date
        string origin
    }

    stock_move_line {
        int id PK
        int move_id FK "stock.move"
        int picking_id FK "stock.picking"
        int product_id FK "product.product"
        int location_id FK "stock.location (source)"
        int location_dest_id FK "stock.location (dest)"
        int lot_id FK "stock.lot"
        float quantity "Demand"
        float qty_done "Actually done"
        date date
        string reference
    }

    stock_quant {
        int id PK
        int product_id FK "product.product"
        int lot_id FK "stock.lot"
        float quantity "On hand"
        float reserved_quantity "Reserved for picks"
        float inventory_quantity "Set by Full Count"
        int location_id FK "stock.location"
        int company_id
    }

    stock_location {
        int id PK
        string name "PICKFACE, WH/Stock"
        string complete_name "WH/Stock/PICKFACE"
        string usage "internal|customer|supplier|transit|view"
        int location_id FK "Parent location"
        boolean active
    }

    stock_picking_type {
        int id PK
        string name "Delivery Orders"
        string code "outgoing|incoming|internal"
    }

    stock_warehouse_orderpoint {
        int id PK
        int product_id FK "product.product"
        int location_id FK "stock.location"
        float product_min_qty "Reorder point"
        float product_max_qty "Max stock"
        float qty_to_order "Auto-calculated"
        string trigger "auto|manual"
        boolean active
    }

    %% ══════════════════════════════════════
    %% SALES — 3 models
    %% ══════════════════════════════════════

    sale_order {
        int id PK
        string name "S00001"
        int partner_id FK "res.partner"
        int team_id FK "crm.team (platform)"
        date date_order
        string state "draft|sale|done|cancel"
        string source_id
        date commitment_date "Promise date"
        string client_order_ref "Platform order ref"
        string note
    }

    sale_order_line {
        int id PK
        int order_id FK "sale.order"
        int product_id FK "product.product"
        float product_uom_qty
        float price_unit
        float price_subtotal
        date create_date
        string state
    }

    %% ══════════════════════════════════════
    %% ACCOUNTING — 2 models
    %% ══════════════════════════════════════

    account_move {
        int id PK
        string name "INV/2026/00001"
        int partner_id FK "res.partner"
        date invoice_date
        date invoice_date_due
        string state "draft|posted|cancel"
        string payment_state "not_paid|in_payment|paid"
        float amount_untaxed
        float amount_tax
        float amount_total
        string invoice_origin "SO ref"
        string move_type "out_invoice|in_invoice"
    }

    account_move_line {
        int id PK
        int move_id FK "account.move"
        int product_id FK "product.product"
        string name "Description"
        float quantity
        float price_unit
        float price_subtotal
        float price_total
        string display_type "product|line_section|line_note"
    }

    %% ══════════════════════════════════════
    %% MASTER DATA — 6 models
    %% ══════════════════════════════════════

    product_product {
        int id PK
        string name "SKINOXY Serum 30ml"
        string default_code "SKU: SKN-SRM-030"
        string barcode "8850XXX"
        float lst_price "Sale price"
        float standard_price "Cost price"
        string uom_id
        boolean active
        int categ_id FK "product.category"
        string detailed_type "consu|product|service"
        string tracking "none|lot|serial"
        float weight
        float volume
        float qty_available "On hand (computed)"
        float virtual_available "Forecast (computed)"
        float incoming_qty
        float outgoing_qty
    }

    product_supplierinfo {
        int id PK
        int product_id FK "product.product"
        int partner_id FK "res.partner (vendor)"
        float price "Vendor price"
        float min_qty "Min order qty"
        int delay "Lead time (days)"
        date date_start
        date date_end
    }

    product_category {
        int id PK
        string name "GWP / Sample / Gift"
        string complete_name "All / Cosmetics / GWP"
        int parent_id FK "Parent category"
    }

    res_partner {
        int id PK
        string name "Customer / Vendor name"
        int customer_rank "0=not customer, 1+=customer"
    }

    crm_team {
        int id PK
        string name "Shopee / Lazada / TikTok"
    }

    %% ══════════════════════════════════════
    %% RELATIONSHIPS
    %% ══════════════════════════════════════

    sale_order ||--o{ sale_order_line : "order_line"
    sale_order ||--o{ stock_picking : "picking_ids"
    sale_order }o--|| res_partner : "partner_id"
    sale_order }o--|| crm_team : "team_id (platform)"

    sale_order_line }o--|| product_product : "product_id"

    stock_picking ||--o{ stock_move : "move_ids"
    stock_picking }o--|| res_partner : "partner_id"
    stock_picking }o--|| stock_location : "location_id"
    stock_picking }o--|| stock_location : "location_dest_id"
    stock_picking }o--|| stock_picking_type : "picking_type_id"

    stock_move ||--o{ stock_move_line : "move_line_ids"
    stock_move }o--|| product_product : "product_id"
    stock_move }o--|| stock_location : "location_id"

    stock_move_line }o--|| product_product : "product_id"
    stock_move_line }o--|| stock_location : "location_id"
    stock_move_line }o--|| stock_location : "location_dest_id"

    stock_quant }o--|| product_product : "product_id"
    stock_quant }o--|| stock_location : "location_id"

    stock_warehouse_orderpoint }o--|| product_product : "product_id"
    stock_warehouse_orderpoint }o--|| stock_location : "location_id"

    account_move ||--o{ account_move_line : "invoice_line_ids"
    account_move }o--|| res_partner : "partner_id"

    account_move_line }o--|| product_product : "product_id"

    product_product }o--|| product_category : "categ_id"
    product_supplierinfo }o--|| product_product : "product_id"
    product_supplierinfo }o--|| res_partner : "partner_id (vendor)"

    stock_location }o--o| stock_location : "location_id (parent)"
    product_category }o--o| product_category : "parent_id"
```

---

## Wizard Models (Transient)

Wizards are temporary models used for multi-step operations:

```mermaid
erDiagram

    sale_advance_payment_inv {
        int id PK
        string advance_payment_method "delivered|percentage|fixed"
        int sale_order_ids FK "sale.order"
    }

    stock_backorder_confirmation {
        int id PK
        int pick_ids FK "stock.picking"
    }

    stock_immediate_transfer {
        int id PK
        int pick_ids FK "stock.picking"
    }

    sale_advance_payment_inv }o--|| sale_order : "creates invoice from SO"
    stock_backorder_confirmation }o--|| stock_picking : "handles partial delivery"
    stock_immediate_transfer }o--|| stock_picking : "forces immediate validation"
```

---

## WMS Function → Odoo Model Mapping

### STOCK Operations

| WMS Function | Models Used | Methods | Purpose |
|---|---|---|---|
| `fetchAllOrders()` | stock.picking, stock.move, sale.order, product.product | search_read, read | Load all pending deliveries |
| `confirmRTS()` | stock.picking, stock.move, stock.move.line, stock.quant, sale.order, account.move, sale.advance.payment.inv, stock.backorder.confirmation, stock.immediate.transfer | search_read, write, create, button_validate, action_confirm, action_post, process | Ready-to-ship: validate picking → create invoice → post |
| `createInternalTransfer()` | stock.picking, stock.picking.type, stock.move, stock.move.line, stock.location, stock.immediate.transfer | search_read, create, action_confirm, button_validate, process | Move stock between locations |
| `fetchInventory()` | stock.quant, product.product, stock.location | search_read, read | Load current stock levels |
| `fetchFullInventory()` | stock.quant, product.product | search_read | All warehouse stock (no location filter) |
| `fetchStockByLocation()` | stock.quant, product.product | search_read | Stock breakdown per location |
| `fetchStockForecast()` | stock.move, product.product | search_read | Incoming/outgoing predictions |
| `fetchStockHistory()` | stock.move.line | search_read | Movement audit trail |
| `fetchAllLocations()` | stock.location | search_read | List all internal locations |
| `getOrCreatePickfaceLocation()` | stock.location | search_read, create | Ensure PICKFACE location exists |

### Full Count (NEW)

| WMS Function | Models Used | Methods | Purpose |
|---|---|---|---|
| `applyFullCountAdjustments()` | product.product, stock.location, stock.quant | search_read, write, create, action_apply_inventory | Send counted qty → adjust stock.quant in Odoo |

### Sales & Invoicing

| WMS Function | Models Used | Methods | Purpose |
|---|---|---|---|
| `syncManualSalesOrder()` | sale.order, sale.order.line, res.partner, crm.team, product.product | search_read, create, action_confirm | Create SO from platform orders |
| `fetchSalesHistory()` | sale.order.line | search_read | Product sales trends |
| `fetchInvoices()` | account.move, account.move.line | search_read | Load invoice list |

### Master Data

| WMS Function | Models Used | Methods | Purpose |
|---|---|---|---|
| `fetchProducts()` | product.product | search_read | Active SKU catalog |
| `fetchProductDetail()` | product.product | read | Single product full detail |
| `fetchSupplierInfo()` | product.supplierinfo | search_read | Vendor pricing & lead times |
| `fetchProductCategories()` | product.category | search_read | Category tree |
| `fetchProductBrands()` | product.product | search_read | Distinct brand list |
| `fetchReorderRules()` | stock.warehouse.orderpoint | search_read | Auto-reorder settings |
| `createReorderRule()` | stock.warehouse.orderpoint | create | Set new reorder point |
| `updateReorderRule()` | stock.warehouse.orderpoint | write | Update min/max qty |
| `createGWPProduct()` | product.product | create | Create gift-with-purchase product |
| `setGWPInitialStock()` | stock.quant | search_read, write, create, action_apply_inventory | Set initial stock for GWP |

---

## Data Flow: Full Count → Odoo Adjustment

```
WMS React                              Odoo 18
─────────                              ───────

1. fetchInventory() ◀───────────────── stock.quant (quantity)
                                        product.product (sku, name)
   ┌─────────────────┐
   │ Create Session   │
   │ systemQty = qty  │
   │ countedQty = null│
   └────────┬────────┘
            │
2. Count    │  (localStorage only)
   ┌────────▼────────┐
   │ countedQty = 48  │
   │ systemQty  = 50  │
   │ variance   = -2  │
   │ variancePct = 4% │
   │ status = matched │
   │   or needs-recount│
   │   or variance-    │
   │     approved      │
   └────────┬────────┘
            │
3. Approve  │  applyFullCountAdjustments()
   ┌────────▼────────┐
   │ For each variance│──────────────▶ product.product.search_read
   │ item:            │                 → find product_id by SKU
   │                  │──────────────▶ stock.location.search_read
   │                  │                 → find location_id
   │                  │──────────────▶ stock.quant.search_read
   │                  │                 → find existing quant
   │                  │──────────────▶ stock.quant.write
   │                  │                 inventory_quantity = 48
   │                  │──────────────▶ stock.quant.action_apply_inventory
   │                  │                 → Odoo creates stock.move
   │                  │                 → quantity updated: 50 → 48
   └──────────────────┘

4. Result
   ┌──────────────────┐
   │ status: success   │
   │ applied: 12       │
   │ failed: 0         │
   │ → Close session   │
   │ → Unfreeze stock  │
   └──────────────────┘
```

---

## SO Flow × ERD (End-to-End Order Lifecycle)

```
Stage 1: ORDER                    Stage 2: CONFIRM
─────────────                     ────────────────
sale.order.create()               sale.order.action_confirm()
  └─ sale.order.line                └─ auto-creates:
       └─ product_id                     stock.picking (WH/OUT)
       └─ product_uom_qty                 └─ stock.move
       └─ price_unit                          └─ product_id
  └─ partner_id                               └─ product_uom_qty
  └─ team_id (platform)

Stage 3-5: PICK → PACK           Stage 6: RTS (Ready-to-Ship)
───────────────────               ──────────────────────────
WMS updates state only            stock.move.line.write(qty_done)
(localStorage + React)            stock.picking.button_validate()
                                    └─ stock.quant.quantity updated
                                    └─ stock.move → state: done
                                  sale.advance.payment.inv.create()
                                    └─ .create_invoices()
                                    └─ account.move created
                                    └─ account.move.action_post()

Stage 7: FULL COUNT               Stage 8: REORDER
─────────────────                  ────────────────
stock.quant.write                  stock.warehouse.orderpoint
  (inventory_quantity)               └─ product_min_qty
stock.quant.action_apply_inventory   └─ product_max_qty
  └─ Odoo adjusts quantity           └─ trigger: auto
  └─ Creates stock.move (adjust)     └─ qty_to_order (computed)
```

---

## Model Statistics

| Category | Models | Fields Used | Methods |
|---|---|---|---|
| **Stock** | 8 | 52 | search_read, write, create, button_validate, action_confirm, action_apply_inventory, process |
| **Sales** | 3 | 19 | search_read, read, create, action_confirm, create_invoices |
| **Accounting** | 2 | 21 | search_read, action_post |
| **Master Data** | 6 | 41 | search_read, read, create, write |
| **Total** | **19** | **133** | **12 unique methods** |
