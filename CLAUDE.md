# CLAUDE.md — KOB WMS Pro Developer Guide

## Project Overview

**KOB WMS Pro** — Enterprise Warehouse Management System for Kiss of Beauty / SKINOXY
React 18 + Vite 5 + Tailwind CSS 3 | Odoo 18 ERP integration | Multi-platform e-commerce

```
Tech Stack: React 18.2, Vite 5.1, Tailwind 3.4, Recharts, Lucide icons
Backend:    Odoo 18 ERP (via JSON-RPC proxy)
Deploy:     Docker (Nginx + Odoo + PostgreSQL) or standalone Node.js
```

---

## Quick Start

```bash
# Development
npm install
npm run dev          # http://localhost:5173

# Production (standalone)
npm run build
./install-ubuntu.sh  # Ubuntu auto-setup

# Production (Docker full-stack)
cp .env.example .env # Edit passwords first!
docker compose up -d # WMS :3000 + Odoo :8069 + PostgreSQL :5432
```

---

## Project Structure

```
src/
├── App.jsx                    # Main app controller + state + routing (1300+ lines)
├── constants.jsx              # Roles, tabs, product catalog, OKR config
├── translations.js            # EN/TH translations
├── index.css                  # Odoo 18 design system (CSS variables)
├── components/
│   ├── Sidebar.jsx            # Navigation sidebar
│   ├── Dashboard.jsx          # KPI overview
│   ├── Pick.jsx / Pack.jsx    # Core warehouse ops
│   ├── Scan.jsx / Dispatch.jsx
│   ├── Inventory.jsx / CycleCount.jsx / GWPManager.jsx / Sorting.jsx
│   ├── Fulfillment.jsx / PlatformMonitor.jsx / Invoice.jsx
│   ├── TeamPerformance.jsx / SLATracker.jsx / TimeAttendance.jsx / KPIAssessment.jsx
│   ├── Reports.jsx / Users.jsx / Settings.jsx / Manual.jsx
│   ├── ClaudeChat.jsx         # AI chat assistant
│   ├── HandheldLayout.jsx     # Mobile/tablet layout
│   ├── HandheldPack.jsx / POSPack.jsx
│   └── Login.jsx / ErrorBoundary.jsx / LoadingScreen.jsx
├── services/
│   ├── odooApi.js             # Odoo JSON-RPC client
│   ├── claudeApi.js           # Claude AI API client
│   └── platformApi.js         # Shopee/Lazada/TikTok/couriers
├── hooks/
│   └── useOdooSync.js         # Auto-sync hook
└── utils/
    ├── security.js            # Auth, session, sanitize, audit
    └── index.js               # Helpers (tracking URL, debounce)
```

---

## Architecture Decisions

- **No router library** — pure `activeTab` state-based navigation (localStorage persisted)
- **No global state library** — all state in App.jsx, passed via props
- **No backend server** — Odoo is the backend; frontend handles auth client-side
- **Inline styles** — Odoo 18 design system uses inline styles + Tailwind utilities
- **localStorage** — primary data persistence (orders, users, configs, chat history)

---

## Roles & Access

| Role | Access | Tab Count |
|------|--------|-----------|
| admin | Everything | 24 |
| senior | Everything | 24 |
| picker | pick, cycleCount, gwp, kpiAssessment, timeAttendance, sorting, manual | 7 |
| packer | pack, handheldPack, posPack, gwp, kpiAssessment, timeAttendance, fulfillment, manual | 8 |
| outbound | scan, list, dispatch, kpiAssessment, timeAttendance, report, manual | 7 |

Defined in `src/constants.jsx` → `rolesInfo`

---

## Design System

Odoo 18 color palette — defined in `src/index.css`:

```css
--odoo-purple:      #714B67   /* Primary */
--odoo-purple-dark: #5a3d52   /* Hover */
--odoo-bg:          #f8f9fa   /* Background */
--odoo-surface:     #ffffff   /* Cards */
--odoo-border:      #dee2e6   /* Borders */
--odoo-text:        #212529   /* Text */
--odoo-success:     #28a745
--odoo-warning:     #ffac00
--odoo-danger:      #dc3545
```

Button classes: `.odoo-btn`, `.odoo-btn-primary`, `.odoo-btn-secondary`
Input class: `.odoo-input`

---

## Adding a New Page

1. Create `src/components/NewPage.jsx`
2. Add to `tabInfo` in `src/constants.jsx` (with icon + section)
3. Add tab name to roles in `rolesInfo` (constants.jsx)
4. Import + render in `src/App.jsx`: `{activeTab === 'newPage' && <NewPage ... />}`
5. Add translations in `src/translations.js` (`tabNewPage` key, EN + TH)

---

## API Integration Pattern

All API configs stored in `apiConfigs` state (App.jsx) → persisted to `localStorage('wms_apis')`.

```javascript
// Adding a new API integration:
// 1. Add default config in App.jsx apiConfigs state
// 2. Add config UI in Settings.jsx PLATFORM_DEFS or API section
// 3. Create service in src/services/
```

---

# SECURITY AUDIT REPORT

**Audit Date:** 2026-03-29
**Status:** NOT production-ready — requires fixes before internet-facing deployment
**Safe for:** Internal LAN use with trusted users

---

## CRITICAL Issues (Fix Before Production)

### 1. Client-Side Password Hashing
**File:** `src/utils/security.js:8-29`
**Risk:** SHA-256 is NOT suitable for passwords — no salt variation, no slow function
**Attack:** Rainbow tables, brute-force (billions of hashes/sec)
**Fix:** Implement server-side bcrypt/Argon2 via Odoo or dedicated auth backend

### 2. Default Password Hardcoded
**File:** `src/App.jsx:63`
**Risk:** Default admin user with password `123456` in source code
**Fix:** Force password change on first login, remove hardcoded password

### 3. API Keys Stored in localStorage (Plaintext)
**Files:** `App.jsx:66-74`, `ClaudeChat.jsx:16`, `platformApi.js:32-40`
**Risk:** Any XSS vulnerability → full credential theft (Claude key, Odoo password, platform secrets)
**Fix:** Encrypt localStorage with AES-GCM using user-derived key, or move to server-side proxy

### 4. VITE_ Environment Variables Compiled into Bundle
**File:** `.env.example:55` — `VITE_CLAUDE_API_KEY`
**Risk:** All `VITE_` prefixed variables are embedded in the JavaScript bundle — anyone accessing the app can extract them
**Fix:** Remove `VITE_` prefix from secrets, serve through backend API proxy

### 5. No localStorage Encryption
**Files:** All components using `safeParse()` / `localStorage.setItem()`
**Data exposed:** User passwords, API keys, session tokens, chat history, audit logs
**Fix:** Use encryption wrapper (AES-GCM via Web Crypto API) or `idb-keyval` with encryption

---

## HIGH Issues

### 6. XSS via dangerouslySetInnerHTML
**File:** `src/components/GWPManager.jsx:~158`
```jsx
<div dangerouslySetInnerHTML={{ __html: generateBarcodeSVG(saved.sku, 200, 40) }} />
```
**Risk:** If SKU contains malicious input → stored XSS
**Fix:** Sanitize SVG output or use DOM-based barcode rendering

### 7. Weak Content Security Policy
**File:** `nginx.conf:66`
```
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' ws: wss: https://api.anthropic.com;
```
**Issues:**
- `'unsafe-inline'` defeats XSS protection
- `ws: wss:` too broad (no origin restriction)
- Missing: `form-action`, `object-src`, `base-uri` directives
**Fix:** Use nonce-based CSP, restrict WebSocket origins

### 8. No HTTPS Enforcement
**File:** `nginx.conf:46` — SSL redirect commented out
**Risk:** Credentials sent in plaintext over HTTP
**Fix:** Enable SSL with Let's Encrypt, uncomment HTTPS redirect

### 9. Docker Secrets via .env File
**File:** `docker-compose.yml:66`
**Risk:** `env_file: .env` exposes all secrets in container inspect
**Fix:** Use Docker secrets or HashiCorp Vault for production

### 10. Sensitive Data in Browser DevTools
**Risk:** Physical access to machine → full access to passwords, API keys, session data via DevTools > Application > Local Storage
**Fix:** Encrypt stored data, implement auto-clear on session timeout

---

## MEDIUM Issues

| # | Issue | File | Fix |
|---|-------|------|-----|
| 11 | MIME type validation allows `text/html` | security.js:311 | Stricter whitelist |
| 12 | No file content (magic byte) validation | security.js:288-319 | Add magic byte check |
| 13 | Console.warn leaks key names | App.jsx:59 | Strip in production |
| 14 | Error messages expose API internals | claudeApi.js:52 | Generic user-facing errors |
| 15 | No `Cache-Control: no-store` for sensitive data | nginx.conf | Add header for API routes |
| 16 | Rate limiting gap on `/web/dataset` | nginx.conf | Add rate limit location |

---

## LOW Issues

| # | Issue | File |
|---|-------|------|
| 17 | No secrets rotation documentation | — |
| 18 | Base Docker images need update policy | Dockerfile:8,27 |
| 19 | No pre-commit hook for secret scanning | — |
| 20 | Filename length limit could be stricter | security.js:316 |

---

## Security Roadmap (Recommended Order)

### Phase 1 — Quick Wins (1-2 days)
- [ ] Remove hardcoded default password (App.jsx:63)
- [ ] Remove `VITE_` prefix from secret env vars
- [ ] Enable HTTPS in nginx.conf
- [ ] Fix CSP: remove `unsafe-inline`, add nonce
- [ ] Sanitize barcode SVG output (GWPManager)
- [ ] Add `Cache-Control: no-store` for API routes
- [ ] Strip console.warn in production build

### Phase 2 — Encryption Layer (3-5 days)
- [ ] Implement localStorage encryption (AES-GCM via Web Crypto API)
- [ ] Encrypt API keys at rest with user-derived key
- [ ] Auto-clear sensitive data on session timeout
- [ ] Add secure session storage option

### Phase 3 — Server-Side Auth (1-2 weeks)
- [ ] Move authentication to Odoo backend (bcrypt/Argon2)
- [ ] Implement JWT/session cookies (HttpOnly, Secure, SameSite)
- [ ] Create API proxy for platform credentials (no keys in browser)
- [ ] Add CSRF protection for state-changing requests

### Phase 4 — Infrastructure (1 week)
- [ ] Migrate Docker secrets from .env to Docker Swarm secrets
- [ ] Add CI/CD secret scanning (GitHub Actions)
- [ ] Implement rate limiting on all API endpoints
- [ ] Add security headers audit in CI
- [ ] Set up automated base image updates

---

## Current Security Features (Working)

- Session timeout: 30 minutes with refresh
- Login rate limiting: 5 attempts / 5 min → 15 min lockout
- Constant-time password comparison
- Password strength validation (min 6 chars)
- CSRF token generation
- Audit logging (login, logout, actions)
- File upload validation (size, extension, MIME)
- HTML entity sanitization (`sanitizeText()`)
- Nginx: rate limiting, security headers, server version hidden
- Docker: non-root user, resource limits, health checks, network isolation
- `.gitignore` excludes `.env` files

---

## Dev Commands

```bash
npm run dev          # Start dev server (HMR)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint check

# Docker
docker compose up -d          # Start all
docker compose up -d wms      # WMS only
docker compose logs -f wms    # Logs
docker compose down           # Stop all

# Ubuntu desktop
./install-ubuntu.sh                          # Full install
~/.local/share/kob-wms/start.sh             # Start server
~/.local/share/kob-wms/stop.sh              # Stop server
tail -f ~/.local/share/kob-wms/server.log   # View logs
./uninstall-linux.sh                         # Remove
```

---

---

# DEVELOPMENT FLOW — จากโค้ดสู่ Production

## สถานะปัจจุบันของระบบ

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (React)        →  ทำงานได้ 100%  ✅                        │
│  Mock Mode (localStorage) →  ทำงานได้ 100%  ✅                       │
│  Odoo Integration        →  โค้ดพร้อม, ยังไม่ได้เชื่อม server จริง  ⚠️  │
│  Platform APIs           →  โค้ดพร้อม, ยังไม่ได้ใส่ key จริง        ⚠️  │
│  Security Hardening      →  แก้แล้ว 10 จุด, เหลืออีก 10 จุด (Phase 3-4) │
└─────────────────────────────────────────────────────────────────────┘
```

### ข้อมูลที่เชื่อม Odoo แล้ว vs ยังเป็น Local

| ข้อมูล | Mock Mode | Live Mode (Odoo) | Odoo Model |
|--------|-----------|------------------|------------|
| Sales Orders / Picking | localStorage | Odoo ✅ | `stock.picking` + `stock.move.line` |
| Inventory (สต็อค) | localStorage | Odoo ✅ | `stock.quant` |
| Products | localStorage | Odoo ✅ | `product.product` |
| Locations | localStorage | Odoo ✅ | `stock.location` |
| Invoices | localStorage | **ยังเป็น local** ⚠️ | `account.move` (โค้ดพร้อม) |
| Waves | localStorage | **ยังเป็น local** ⚠️ | — |
| Reorder Rules | localStorage | **ยังเป็น local** ⚠️ | `stock.warehouse.orderpoint` (โค้ดพร้อม) |
| KPI / Attendance | localStorage | **ยังเป็น local** | — |
| Platform Orders | localStorage | **ยังเป็น local** | — |

---

## PHASE 0 — Dev Setup (วันที่ 1)

**เป้าหมาย:** Dev ทุกคนรันโปรเจคได้บนเครื่องตัวเอง

### สิ่งที่ต้องทำ:

```bash
# 1. Clone repo
git clone https://github.com/samuny2329/kob-wms.git
cd kob-wms

# 2. Install dependencies
npm install

# 3. รัน development server
npm run dev
# → เปิด http://localhost:5173

# 4. Login ด้วย admin (ครั้งแรกจะต้องตั้งรหัสผ่านใหม่)
# Username: admin
# Password: (ว่าง — ระบบจะบังคับตั้งรหัสผ่าน)
```

### ทดสอบ Mock Mode:
- Dashboard → ดู KPI, กราฟ
- Pick → สร้าง order ทดสอบ, สแกน barcode
- Pack → เลือกกล่อง, แพ็คสินค้า
- Scan → สแกนจ่ายออก
- Settings → ดู API config (ยังไม่ต้องเชื่อม)

### ผลลัพธ์:
- [ ] Dev ทุกคนรัน `npm run dev` ได้
- [ ] Login + ตั้งรหัสผ่านใหม่ได้
- [ ] ทดสอบ flow Pick → Pack → Scan ด้วย demo data ได้

---

## PHASE 1 — ทดสอบหน้างาน (Mock Mode) (สัปดาห์ที่ 1-2)

**เป้าหมาย:** ให้พนักงานลองใช้ระบบจริงๆ แต่ยังไม่เชื่อม Odoo — ใช้ข้อมูล demo

### Deploy บนคอมโกดัง:

```bash
# บน Ubuntu ที่โกดัง
./install-ubuntu.sh
# → WMS รันที่ http://localhost:3000
# → มือถือ/แท็บเล็ตเข้าที่ http://<IP-คอม>:3000
```

### สร้าง User สำหรับทีม:
ที่หน้า **Users** (admin เท่านั้น) → สร้างพนักงาน:

| ชื่อ | Username | Role | ใช้หน้าไหน |
|------|----------|------|-----------|
| หัวหน้า | senior01 | senior | ทุกหน้า (ดู Dashboard, KPI) |
| พนง.หยิบ 1 | picker01 | picker | Pick, Cycle Count |
| พนง.แพ็ค 1 | packer01 | packer | Pack (Handheld/POS) |
| พนง.จ่าย 1 | outbound01 | outbound | Scan, Dispatch |

### สิ่งที่ทดสอบ (ยังไม่กระทบบัญชี/สต็อคจริง):

| ทดสอบ | หน้า | อุปกรณ์ | สิ่งที่ดู |
|--------|------|---------|----------|
| หยิบสินค้า | Pick | Handheld/แท็บเล็ต | Flow สแกน barcode ถูกตำแหน่ง? |
| แพ็คสินค้า | Pack / Handheld Pack | Handheld | เลือกกล่อง, สแกน AWB ใช้ได้? |
| สแกนจ่ายออก | Scan | คอมตั้งโต๊ะ | Batch scan เร็วพอ? |
| ส่งมอบขนส่ง | Dispatch | แท็บเล็ต | เซ็นรับ, สร้าง manifest |
| GWP ของแถม | GWP Manager | คอมตั้งโต๊ะ | ถ่ายรูป, พิมพ์ label |
| นับสต็อค | Cycle Count | Handheld | Blind scan, บันทึก variance |
| เข้า-ออกงาน | Time Attendance | มือถือ | Clock in/out |

### Feedback ที่ต้องเก็บจากทีม:
- [ ] UI/UX ใช้ง่ายไหม? ตัวหนังสือเล็กไป?
- [ ] Barcode scanner ทำงานได้กับ handheld?
- [ ] Flow ถูกต้องตาม SOP จริงไหม?
- [ ] ต้องการข้อมูลอะไรเพิ่มในแต่ละหน้า?
- [ ] ความเร็ว/performance เป็นอย่างไร?

### ผลลัพธ์:
- [ ] พนักงานทุก role ลองใช้ระบบแล้ว
- [ ] เก็บ feedback มาแก้ไข
- [ ] ยืนยัน flow Pick → Pack → Scan → Dispatch ใช้ได้จริง

---

## PHASE 2 — เชื่อม Odoo (สต็อคจริง, ยังไม่บัญชี) (สัปดาห์ที่ 3-4)

**เป้าหมาย:** เชื่อม Odoo สำหรับ Orders + Inventory + Products — **ยังไม่เปิด Invoice/บัญชี**

### Prerequisites:
- [ ] Odoo 18 server พร้อม (Docker หรือ cloud)
- [ ] PostgreSQL 16 พร้อม
- [ ] สร้าง database `odoo18` + ลง Odoo modules: `stock`, `sale`, `product`

### Step 1: ตั้ง Odoo Server

```bash
# ตั้งค่า environment
cp .env.example .env
# แก้ไข .env:
#   POSTGRES_PASSWORD=<รหัสผ่านจริง>
#   VITE_ODOO_URL=http://<odoo-server>:8069

# รัน Docker (Odoo + PostgreSQL)
docker compose up -d odoo postgres

# รอ Odoo healthy (~60 วินาที)
docker compose logs -f odoo
```

### Step 2: ตั้งค่า Odoo ใน WMS

1. เปิด **Settings** → ส่วน **API Integrations**
2. เปิด **Odoo ERP** toggle
3. สลับจาก **Mock Mode** → **Live Mode**
4. ใส่ข้อมูล:
   - Server URL: `http://<odoo-ip>:8069`
   - Database: `odoo18`
   - Username: `admin`
   - Password: `<odoo-admin-password>`
5. กด **Test Connection** → ต้องขึ้น "Connected"

### Step 3: ตั้ง Odoo Data

ใน Odoo 18 backend ต้องเตรียม:

```
Odoo Backend (http://<odoo-ip>:8069/web)
├── Inventory → Warehouses → ตั้ง WH/Stock location
├── Inventory → Products → นำเข้าสินค้า (SKU, barcode, ราคา)
├── Inventory → Locations → ตั้ง Pickface locations (A-01-01, A-01-02, ...)
├── Sales → สร้าง Sale Orders ทดสอบ
└── Settings → Users → สร้าง API user สำหรับ WMS
```

### Step 4: Sync ทดสอบ

เมื่อเปิด Live Mode แล้ว ระบบจะ sync อัตโนมัติทุก 10 วินาที:
- **Header bar** จะแสดง "Connected" (เขียว) หรือ "Syncing..." (เหลือง)
- **Pick list** จะดึง orders จาก Odoo (`stock.picking` ที่ ready)
- **Inventory** จะแสดงสต็อคจริงจาก Odoo (`stock.quant`)

### สิ่งที่ทดสอบ (กระทบสต็อคจริงใน Odoo):

| ทดสอบ | ผลใน Odoo | ตรวจสอบที่ |
|--------|-----------|-----------|
| Pick order | `stock.picking` → assigned → done | Odoo > Inventory > Transfers |
| Pack + AWB | `stock.picking` validate | Odoo > Inventory > Delivery Orders |
| Scan outbound | Update tracking number | Odoo > Sales > Orders |
| Inventory count | `stock.quant` adjustment | Odoo > Inventory > Physical Inventory |

### สิ่งที่ยังปิดไว้ (ห้ามเปิด):
- ❌ Invoice — ยังไม่สร้าง `account.move` จริง
- ❌ Platform Sync — ยังไม่ดึง order จาก Shopee/Lazada/TikTok
- ❌ Reorder Rules — ยังไม่สั่งซื้ออัตโนมัติ

### ผลลัพธ์:
- [ ] Orders sync จาก Odoo → WMS สำเร็จ
- [ ] Pick → Pack → Scan อัพเดทกลับ Odoo สำเร็จ
- [ ] สต็อคใน Odoo ตรงกับ WMS
- [ ] ไม่มี data loss / conflict

---

## PHASE 3 — เชื่อม Platform APIs (สัปดาห์ที่ 5-6)

**เป้าหมาย:** ดึง orders จาก marketplace + ปริ้น AWB จริง

### เชื่อมทีละแพลตฟอร์ม (เรียงตาม priority):

#### 3.1 Shopee Open Platform
```
Settings → Shopee Open API → เปิด
- Shop ID: <จาก Shopee Seller Center>
- Partner ID: <จาก Shopee Open Platform>
- Partner Key: <API secret>
```
ทดสอบ: Platform Monitor → กด Sync → ดู orders เข้า

#### 3.2 Lazada Open Platform
```
Settings → Lazada → เปิด
- App Key / App Secret / Access Token
```

#### 3.3 TikTok Shop
```
Settings → TikTok → เปิด
- App Key / App Secret / Access Token
```

#### 3.4 Courier APIs (Flash, Kerry, J&T, Thai Post)
```
Platform Settings → ใส่ credentials ของแต่ละขนส่ง
```
ทดสอบ: Dispatch → สร้าง manifest → ปริ้น AWB

### ผลลัพธ์:
- [ ] Orders จาก marketplace เข้า WMS อัตโนมัติ
- [ ] AWB/tracking number จาก courier ถูกต้อง
- [ ] สถานะ order sync กลับ marketplace

---

## PHASE 4 — เปิดบัญชี + Production (สัปดาห์ที่ 7-8)

**เป้าหมาย:** เปิด Invoice module + Reorder rules → **Go Live**

### Prerequisites ก่อน Go Live:
- [ ] **Security Phase 3-4** จาก audit report ทำเสร็จ:
  - [ ] HTTPS (Let's Encrypt certificate)
  - [ ] Server-side auth ผ่าน Odoo (ไม่ใช่ client-side hash)
  - [ ] Docker secrets แทน .env
- [ ] **Backup plan:**
  - [ ] PostgreSQL auto-backup (daily)
  - [ ] Odoo filestore backup
  - [ ] WMS config export
- [ ] **User training:**
  - [ ] พนักงานทุกคนผ่านการอบรม
  - [ ] มี SOP เอกสารแต่ละ role
  - [ ] หัวหน้าดู Dashboard + KPI ได้

### เปิด Invoices:
1. ใน Odoo ลง module `account` + ตั้งค่า Chart of Accounts
2. WMS Invoice page จะสร้าง `account.move` ใน Odoo จริง
3. ทดสอบ: สร้าง invoice → ตรวจใน Odoo Accounting → ยืนยัน

### เปิด Reorder Rules:
1. ใน Odoo ตั้ง `stock.warehouse.orderpoint` สำหรับสินค้าหลัก
2. WMS Inventory page จะแสดง reorder alerts
3. ทดสอบ: สต็อคต่ำ → แจ้งเตือน → สั่งซื้อ

### Go-Live Checklist:

```
PRE-LAUNCH (1 วันก่อน)
├── [ ] HTTPS enabled + SSL certificate valid
├── [ ] Odoo database backup ทำงาน
├── [ ] ทดสอบ full flow E2E: Order → Pick → Pack → Scan → Dispatch → Invoice
├── [ ] ทดสอบ mobile/handheld ทุก role
├── [ ] ตรวจ rate limiting + security headers
├── [ ] สร้าง admin account จริง (ลบ test accounts)
└── [ ] เตรียม rollback plan (switch กลับ Mock Mode ได้ทันที)

LAUNCH DAY
├── [ ] สลับ WMS → Live Mode
├── [ ] ตรวจ sync status (Connected / green)
├── [ ] ให้พนักงานเริ่มใช้ระบบจริง
├── [ ] Monitor: Dashboard + Server logs
└── [ ] หัวหน้าดู KPI real-time

POST-LAUNCH (สัปดาห์แรก)
├── [ ] ตรวจ data ใน Odoo ตรงกับ WMS ทุกวัน
├── [ ] เก็บ feedback + แก้ bug ที่พบ
├── [ ] ดู SLA Tracker ว่า performance เป็นอย่างไร
└── [ ] ยืนยันตัวเลขบัญชีกับทีม accounting
```

---

## สรุปภาพรวม Timeline

```
สัปดาห์     1    2    3    4    5    6    7    8
           ├────┼────┼────┼────┼────┼────┼────┤
Phase 0    █                                      Dev setup
Phase 1    ████████                                ทดสอบหน้างาน (Mock)
Phase 2              ████████                      เชื่อม Odoo (สต็อค)
Phase 3                        ████████            เชื่อม Platforms
Phase 4                                    ████    บัญชี + Go Live
Security   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ทำคู่ขนานตลอด
```

### Rollback Strategy ทุก Phase:

| Phase | ถ้ามีปัญหา | วิธี rollback |
|-------|-----------|--------------|
| 1 | UI/UX ใช้ไม่ได้ | แก้โค้ด, deploy ใหม่ |
| 2 | Odoo sync ผิดพลาด | สลับกลับ **Mock Mode** ทันที (1 คลิกใน Settings) |
| 3 | Platform API ล่ม | ปิด toggle แต่ละ platform ได้อิสระ |
| 4 | บัญชีมีปัญหา | Odoo journal entry สามารถ reverse ได้ |

---

## Dev Tasks — สิ่งที่ต้องทำก่อน Phase แต่ละเฟส

### ก่อน Phase 1 (ทดสอบหน้างาน):
- [ ] แก้ bug จาก feedback ที่เก็บมา
- [ ] ทดสอบ Handheld Layout บน tablet/phone จริง
- [ ] ตรวจ barcode scanner compatibility
- [ ] ปรับ UI ตามหน้างาน (ขนาดตัวอักษร, สี, ปุ่ม)

### ก่อน Phase 2 (เชื่อม Odoo):
- [ ] ตั้ง Odoo 18 server (Docker Compose หรือ cloud)
- [ ] ลง Odoo modules: `stock`, `sale`, `product`, `purchase`
- [ ] Import product master data (SKU, barcode, ราคา, location)
- [ ] ตั้ง Warehouse structure ใน Odoo
- [ ] ทดสอบ `testConnection()` จาก WMS → Odoo
- [ ] ทดสอบ sync loop (10 วินาที) ไม่มี error

### ก่อน Phase 3 (เชื่อม Platform):
- [ ] สมัคร API access ทุก marketplace (Shopee, Lazada, TikTok)
- [ ] สมัคร API access ทุก courier (Flash, Kerry, J&T)
- [ ] ทดสอบ sandbox/test environment ก่อนใช้ production key

### ก่อน Phase 4 (บัญชี + Go Live):
- [ ] ลง Odoo `account` module + ตั้ง Chart of Accounts
- [ ] ตั้ง SSL certificate (Let's Encrypt)
- [ ] เปลี่ยนจาก client-side auth → Odoo session auth
- [ ] ตั้ง automated PostgreSQL backup (daily)
- [ ] อบรมพนักงานทุก role
- [ ] เตรียม SOP เอกสาร

---

## Contributing

- Follow Odoo 18 design patterns (inline styles + Tailwind)
- Use `lucide-react` for icons (w-5 h-5 default)
- Add translations for both EN and TH
- Test on both desktop and handheld layouts
- Never commit `.env` files or API keys
