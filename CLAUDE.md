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

## Contributing

- Follow Odoo 18 design patterns (inline styles + Tailwind)
- Use `lucide-react` for icons (w-5 h-5 default)
- Add translations for both EN and TH
- Test on both desktop and handheld layouts
- Never commit `.env` files or API keys
