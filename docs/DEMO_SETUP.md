# WMS Pro — Complete Demo Setup Guide

> สำหรับเตรียม Demo + ทดสอบ API ทั้งระบบ

---

## Overview

```
เครื่อง Demo ต้องรัน 3 services:
  1. WMS Pro (React + Nginx)     → :3000
  2. Odoo 18 (ERP)               → :8069
  3. PostgreSQL 16 (Database)    → :5432

ทั้งหมดรันผ่าน Docker Compose คำสั่งเดียว
```

---

## Step 1: Prerequisites (ติดตั้งก่อน)

| Software | Version | Download |
|----------|---------|----------|
| **Docker Desktop** | 4.x+ | https://docs.docker.com/get-docker/ |
| **Git** | 2.x+ | https://git-scm.com/ |
| **Node.js** (dev only) | 20 LTS | https://nodejs.org/ |

ตรวจสอบ:
```bash
docker --version    # Docker version 24.x+
docker compose version  # Docker Compose v2.x+
git --version
```

---

## Step 2: Clone Repository

```bash
git clone https://github.com/samuny2329/kob-wms.git
cd kob-wms
```

---

## Step 3: Configure Environment

```bash
cp .env.example .env
```

แก้ไข `.env`:
```env
# Application
VITE_APP_ENV=staging
VITE_ODOO_URL=http://localhost:8069

# PostgreSQL (REQUIRED)
POSTGRES_DB=odoo18
POSTGRES_USER=odoo
POSTGRES_PASSWORD=Demo2026!secure

# Docker Ports
WMS_PORT=3000
ODOO_PORT=8069
POSTGRES_PORT=5432

# Claude AI (optional)
VITE_CLAUDE_API_KEY=sk-ant-api03-xxx
```

---

## Step 4: Start Docker Compose

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# Expected output:
# wms-pro       running  0.0.0.0:3000->80/tcp
# wms-odoo      running  0.0.0.0:8069->8069/tcp
# wms-postgres  running  0.0.0.0:5432->5432/tcp

# View logs
docker compose logs -f odoo    # Watch Odoo startup
docker compose logs -f wms     # Watch WMS
```

Wait ~60 seconds for Odoo to initialize database.

---

## Step 5: Odoo First-Time Setup

### 5.1 Access Odoo
Open: **http://localhost:8069**

### 5.2 Create Database (if first time)
- Master Password: `wms_master_2026` (from odoo.conf)
- Database Name: `odoo18`
- Email: `admin@demo.com`
- Password: `admin`
- Language: English
- Country: Thailand

### 5.3 Install Required Modules

Go to: **Apps** menu → search and install:

| Module | Search Term | Click |
|--------|------------|-------|
| Inventory | `Inventory` | Install |
| Sales | `Sales` | Install |
| Invoicing | `Invoicing` | Install |

Wait for each to complete before installing next.

---

## Step 6: Create Locations in Odoo

Go to: **Inventory → Configuration → Warehouses** → open `My Company` warehouse

Then: **Inventory → Configuration → Locations** → Create:

| Location Name | Parent Location | Location Type |
|--------------|-----------------|---------------|
| `PICKFACE` | WH/Stock | Internal Location |
| `MATERIAL-STORE` | WH/Stock | Internal Location |
| `PACK-ROOM` | WH/Stock | Internal Location |

> Note: WMS will auto-create PICKFACE if missing, but create it manually for clarity.

---

## Step 7: Create Products in Odoo

### 7.1 Sales Products (10 SKUs)

Go to: **Inventory → Products → Create**

For each product set:
- **Product Type**: Storable Product
- **Internal Reference** (SKU): as listed
- **Barcode**: as listed
- **Sales Price**: any amount

| Internal Reference | Product Name | Barcode |
|---|---|---|
| `STDH080-REFILL` | SKINOXY Refill Toner Pad (Dewy) 150ml | 8859139111901 |
| `STBG080-REFILL` | SKINOXY Toner Pad Refill (Bright) 150ml | 8859139111925 |
| `SWB700` | SKINOXY Body Wash (Bright) 700ml | 8859139111703 |
| `SWH700` | SKINOXY Body Wash (Hydra) 700ml | 8859139111680 |
| `SHGG030` | SKINOXY Hydrogel Mask (Glow) 30g | 8859139119830 |
| `SHLF030` | SKINOXY Hydrogel Mask (Lift) 30g | 8859139119847 |
| `KLA226` | KISS-MY-BODY Bright Lotion 226ml | 8859139102261 |
| `KMA088` | KISS-MY-BODY Perfume Mist 88ml | 8859139100882 |
| `KLMH180` | KISS-MY-BODY Tone Up Lotion 180ml | 8859139118010 |
| `KWAP380` | KISS-MY-BODY Perfume & Aroma 380ml | 8859139138030 |

### 7.2 Packing Materials (11 items)

| Internal Reference | Product Name | UoM |
|---|---|---|
| `MAT-BOX-S` | Box S (15x20x10 cm) | Units |
| `MAT-BOX-M` | Box M (25x30x15 cm) | Units |
| `MAT-BOX-L` | Box L (35x40x20 cm) | Units |
| `MAT-BOX-XL` | Box XL (45x50x30 cm) | Units |
| `MAT-ENV-A4` | Envelope A4 (24x33 cm) | Units |
| `MAT-BUBBLE-MAILER` | Bubble Mailer (20x28 cm) | Units |
| `MAT-BUBBLE-WRAP` | Bubble Wrap Sheet | Units |
| `MAT-TAPE-CLEAR` | Clear Tape 48mm Roll | Units |
| `MAT-TAPE-BRAND` | Brand Tape (KOB) Roll | Units |
| `MAT-STRETCH` | Stretch Film 50cm Roll | Units |
| `MAT-FILL-PAPER` | Filling Paper Sheet | Units |

---

## Step 8: Set Initial Stock

Go to: **Inventory → Products → [select product] → Update Quantity**

### Sales Products at PICKFACE:

| Product | Location | Quantity |
|---------|----------|----------|
| STDH080-REFILL | WH/Stock/PICKFACE | 200 |
| STBG080-REFILL | WH/Stock/PICKFACE | 150 |
| SWB700 | WH/Stock/PICKFACE | 100 |
| SWH700 | WH/Stock/PICKFACE | 100 |
| SHGG030 | WH/Stock/PICKFACE | 300 |
| SHLF030 | WH/Stock/PICKFACE | 300 |
| KLA226 | WH/Stock/PICKFACE | 200 |
| KMA088 | WH/Stock/PICKFACE | 250 |
| KLMH180 | WH/Stock/PICKFACE | 150 |
| KWAP380 | WH/Stock/PICKFACE | 100 |

### Packing Materials at MATERIAL-STORE:

| Product | Location | Quantity |
|---------|----------|----------|
| MAT-BOX-S | WH/Stock/MATERIAL-STORE | 500 |
| MAT-BOX-M | WH/Stock/MATERIAL-STORE | 300 |
| MAT-BOX-L | WH/Stock/MATERIAL-STORE | 200 |
| MAT-BOX-XL | WH/Stock/MATERIAL-STORE | 100 |
| MAT-ENV-A4 | WH/Stock/MATERIAL-STORE | 500 |
| MAT-BUBBLE-MAILER | WH/Stock/MATERIAL-STORE | 300 |
| MAT-BUBBLE-WRAP | WH/Stock/MATERIAL-STORE | 2000 |
| MAT-TAPE-CLEAR | WH/Stock/MATERIAL-STORE | 50 |
| MAT-TAPE-BRAND | WH/Stock/MATERIAL-STORE | 30 |
| MAT-STRETCH | WH/Stock/MATERIAL-STORE | 20 |
| MAT-FILL-PAPER | WH/Stock/MATERIAL-STORE | 1000 |

---

## Step 9: Create Sales Teams

Go to: **Sales → Configuration → Sales Teams** → Create:

| Team Name | Usage |
|-----------|-------|
| Shopee | Shopee orders |
| Lazada | Lazada orders |
| Tiktok Shop | TikTok orders |
| Direct | Walk-in / POS |

---

## Step 10: Create Customer

Go to: **Contacts → Create**

| Name | Customer Rank |
|------|--------------|
| Walk-in Customer | 1 (Customer) |
| ECOMMERCE:SHOPEE | 1 |
| ECOMMERCE:LAZADA | 1 |
| ECOMMERCE:TIKTOK | 1 |

---

## Step 11: Configure WMS

### 11.1 Open WMS
- Docker: **http://localhost:3000**
- Dev: `npm run dev` → **http://localhost:5173**
- GitHub Pages: **https://samuny2329.github.io/kob-wms/**

### 11.2 Login
- Username: `admin`
- Password: `admin123` (first login → forced password change)

### 11.3 Settings → Odoo ERP
1. Toggle **ON**
2. Switch to **Live Mode** (not Mock)
3. Server URL: `http://localhost:8069`
4. Database: `odoo18`
5. Username: `admin`
6. Password: `admin`
7. Click **Test Connection** → should show green check
8. Click **Setup PICKFACE** → should confirm location ready

### 11.4 Create WMS Users
Go to: **User Management → Create**

| Name | Username | Role |
|------|----------|------|
| Picker A | picker1 | Picker Specialist |
| Packer B | packer1 | Packer & QC |
| Outbound C | outbound1 | Outbound Ops |

---

## Step 12: Demo Test Flow

### Test 1: Create Order + Pick + Pack + Ship

```
1. Settings → Create Test Orders (or create SO in Odoo)
2. Pick List → select order → scan location → scan product → confirm
3. Pack & Verify → select order → scan verify → select box → AWB prints
4. Outbound Scan → scan AWB → place in courier bin
5. Manifest → print manifest for courier
6. Dispatch → count with driver → sign → dispatch
```

### Test 2: Inventory + Cycle Count

```
1. Inventory → view stock from Odoo (real-time)
2. Cycle Count → Cycle Count tab → complete daily blind count
3. Cycle Count → Full Count tab → create session → count all → reconcile → send to Odoo
4. Cycle Count → Warehouse Map → view 349 bins bird-eye
```

### Test 3: Station Count + Materials

```
1. Pack & Verify → Station button
2. Station Count → End-of-Day Count → enter remaining
3. Requisition → auto-suggest → print replenishment task
```

### Test 4: KPI + Performance

```
1. Login as picker1 → Dashboard → see My Performance
2. Do some picks → UPH gauge updates
3. KPI Assessment → review auto-computed KPIs
4. Login as admin → Team Performance → see all workers
```

### Test 5: Handheld (Mobile)

```
1. Open WMS on phone/tablet (same URL)
2. Auto-detects handheld → shows HandheldLayout
3. PICK / PACK / OUT / COUNT buttons
4. My Performance shows on home screen
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Odoo won't start | `docker compose logs odoo` → check DB connection |
| CORS error from WMS | Use same domain (Nginx proxy) or set `--cors` in odoo.conf |
| Connection refused :8069 | Wait 60s for Odoo init, check `docker compose ps` |
| WMS shows "Not Connected" | Settings → check URL, DB name, credentials |
| Products not syncing | Check PICKFACE location exists, products have `default_code` |
| Build fails | `docker compose build --no-cache wms` |

---

## Quick Commands

```bash
# Start everything
docker compose up -d

# Stop everything
docker compose down

# Restart Odoo only
docker compose restart odoo

# View real-time logs
docker compose logs -f

# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d

# Rebuild WMS after code changes
docker compose build wms && docker compose up -d wms

# Enter Odoo container shell
docker compose exec odoo bash

# Enter PostgreSQL
docker compose exec postgres psql -U odoo -d odoo18

# Backup database
docker compose exec postgres pg_dump -U odoo odoo18 > backup.sql
```

---

## Platform API Keys (Optional for Demo)

For full marketplace demo, register developer accounts:

| Platform | Registration URL | Required |
|----------|-----------------|----------|
| Shopee Open Platform | https://open.shopee.com | Partner ID, Partner Key, Shop ID |
| Lazada Open Platform | https://open.lazada.com | App Key, App Secret |
| TikTok Shop | https://partner.tiktokshop.com | App Key, App Secret |
| Flash Express | Contact Flash sales team | MCH ID, Secret Key |
| Kerry Express | Contact Kerry sales team | Customer ID, Username, Password |
| J&T Express | Contact J&T sales team | Company ID, API Account, API Key |
| Thai Post | https://track.thailandpost.co.th/developerGuide | API Token |

> Platform APIs are optional for demo. WMS works without them — orders can be created manually or via Odoo.

---

## Hardware for Demo (Optional)

| Device | Purpose | Recommendation |
|--------|---------|----------------|
| Barcode Scanner | Scan products + locations | Any USB/Bluetooth HID scanner |
| Label Printer | Print AWB labels | Brother QL-820NWB or Zebra ZD421 |
| Tablet | Handheld Pack UI | iPad or Android 10"+ tablet |
| Phone | Picker handheld | Any Android/iPhone with camera |

---

## Network Diagram

```
Demo LAN (192.168.1.x)
    │
    ├── Demo Server (Docker Host)
    │   ├── :3000  WMS Pro (Nginx)
    │   ├── :8069  Odoo 18
    │   └── :5432  PostgreSQL
    │
    ├── Admin PC
    │   └── Browser → http://server:3000
    │
    ├── Picker Phone
    │   └── Browser → http://server:3000 (auto HandheldLayout)
    │
    ├── Packer Tablet
    │   └── Browser → http://server:3000
    │
    └── Barcode Scanner (USB/BT to any device)
```
