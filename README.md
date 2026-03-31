# Enterprise WMS Pro

**Enterprise Warehouse Management System for Kiss of Beauty / SKINOXY Brand**

Built with React 18 + Vite + Tailwind CSS | Odoo 18 ERP | PostgreSQL 16 | Docker Compose

---

## Key Features

- **Multi-Platform Integration** — Shopee, Lazada, TikTok Shop order sync (60s polling)
- **Real-time Odoo 18 Sync** — JSON-RPC connection, 10-second polling cycle
- **Barcode/QR Scanning** — 3-step scan flow at every stage (Location, Product, Qty)
- **Full Count 100%** — Complete physical inventory with stock freeze + Odoo reconciliation
- **Warehouse Map** — Interactive bird's eye floor plan (349 bins, 9 zones)
- **Cycle Count** — ABC Classification + Blind Count + Auto-approval
- **Wave Sorting** — Group orders by platform, courier, or zone
- **Fulfillment Pipeline** — Pick, Pack, RTS, Outbound Scan, Manifest, Dispatch
- **7 Courier Integrations** — Flash Express, Kerry, J&T, Thai Post + Shopee/Lazada/TikTok logistics
- **Team Performance Analytics** — UPH tracking, leaderboard, SLA compliance
- **PWA** — Auto-detects handheld/mobile devices, switches to touch-optimized layout
- **Role-Based Access** — 6 roles (Admin, Senior, Picker, Packer, Outbound, Accounting)
- **i18n** — English and Thai language support
- **Docker Deployment** — Nginx + Odoo 18 + PostgreSQL 16 with CI/CD (GitHub Actions)

## Warehouse Layout (KOB-WH2)

```
Location Format: K2-[Zone][Rack]-[Position]  (e.g., K2-A01-01)

Zone A-C:  4 racks x 8 positions  =  96 bins
Zone D-I:  4 racks x 10 positions = 240 bins
FLG:       10 floor ground + FLFG  =  11 bins
PICKFACE:  1 pick face zone        =   1 bin
                              Total: 348+ bins
```

## Quick Start

```bash
# Development
npm install
npm run dev          # http://localhost:5173

# Docker (Production)
docker compose up -d # Nginx :80, Odoo :8069, PostgreSQL :5432
```

### Environment Variables

```env
VITE_ODOO_URL=https://odoo.yourdomain.com
VITE_APP_ENV=production
```

## Architecture

```
React SPA (Vite)  -->  Nginx :80  -->  Odoo 18 :8069  -->  PostgreSQL 16 :5432
      |
      +--> Platform APIs (Shopee, Lazada, TikTok)
      +--> Courier APIs (Flash, Kerry, J&T, Thai Post)
```

**19 Odoo models** used across stock, sales, invoicing, and master data.
See `docs/ERD.md` for the complete entity relationship diagram.

## SO Flow (End-to-End)

```
Platform Order --> sale.order --> stock.picking --> Pick --> Pack --> RTS --> Ship
                                                                     |
                                                    stock.quant deducted
                                                    account.move created
                                                    AWB generated
```

Full documentation: `docs/SO_FLOW.md`

## Documentation

| Document | Description |
|----------|-------------|
| `docs/ERD.md` | Odoo 18 ERD — 19 models, 133 fields, Mermaid diagrams |
| `docs/SO_FLOW.md` | Sales Order lifecycle — 11 stages with Odoo operations |
| `docs/SYSTEM_ARCHITECTURE.md` | System architecture, data flows, component map |
| `WMS_Pro_User_Guide.md` | User guide v5.1 — 28 sections, Thai/English |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| ERP | Odoo 18 Community |
| Database | PostgreSQL 16 |
| Web Server | Nginx 1.25 |
| Container | Docker Compose |
| CI/CD | GitHub Actions, GHCR |
| Charts | Recharts |
| Icons | Lucide React |

## License

Proprietary. All rights reserved.
