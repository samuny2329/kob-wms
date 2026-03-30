# KOB WMS Pro — System Architecture & Flow Diagrams

> **Deep Dive:** ทุก flow ของระบบ — ข้อมูลไหลไปไหน, วิ่งกลับ, ย้อนกลับ, บันทึกที่ไหน, สำรองที่ไหน, รันที่ไหน

---

## 1. ภาพรวมระบบ (System Architecture)

```mermaid
graph TB
    subgraph USERS["👤 Users"]
        ADMIN["🔑 Admin / Senior<br/>Desktop Browser"]
        PICKER["📋 Picker<br/>Handheld Scanner"]
        PACKER["📦 Packer<br/>Tablet / POS"]
        OUTBOUND["🚛 Outbound<br/>Desktop + Scanner"]
    end

    subgraph FRONTEND["⚛️ Frontend — React 18 + Vite"]
        direction TB
        APP["App.jsx<br/>State Controller"]
        SIDEBAR["Sidebar.jsx<br/>Navigation"]
        PAGES["24 Pages<br/>Dashboard, Pick, Pack,<br/>Scan, Dispatch, Invoice..."]
        CHAT["ClaudeChat.jsx<br/>AI Assistant"]
    end

    subgraph STORAGE["💾 Browser Storage"]
        LS["localStorage<br/>22 keys"]
        SS["sessionStorage<br/>Encryption key"]
        CRYPTO["AES-GCM<br/>Encryption Layer"]
    end

    subgraph BACKEND["🖥️ Backend Services (Docker)"]
        direction TB
        NGINX["Nginx :80<br/>Reverse Proxy + SPA"]
        ODOO["Odoo 18 :8069<br/>ERP Core"]
        PG["PostgreSQL 16 :5432<br/>Database"]
    end

    subgraph EXTERNAL["🌐 External APIs"]
        SHOPEE["🟠 Shopee<br/>Open Platform"]
        LAZADA["🔵 Lazada<br/>Open Platform"]
        TIKTOK["⚫ TikTok<br/>Shop API"]
        FLASH["⚡ Flash Express"]
        KERRY["🟠 Kerry Express"]
        JT["🔴 J&T Express"]
        THAIPOST["🔴 Thai Post"]
        CLAUDE["🟣 Claude AI<br/>api.anthropic.com"]
    end

    USERS --> FRONTEND
    FRONTEND --> STORAGE
    FRONTEND -->|"JSON-RPC<br/>/web/dataset/call_kw"| NGINX
    NGINX -->|"proxy_pass"| ODOO
    ODOO -->|"SQL"| PG
    FRONTEND -->|"REST API"| SHOPEE & LAZADA & TIKTOK
    FRONTEND -->|"REST API"| FLASH & KERRY & JT & THAIPOST
    CHAT -->|"POST /v1/messages"| CLAUDE

    style FRONTEND fill:#f0e8ed,stroke:#714B67,stroke-width:2px
    style BACKEND fill:#e8f5e9,stroke:#28a745,stroke-width:2px
    style EXTERNAL fill:#fff8e1,stroke:#ffac00,stroke-width:2px
    style STORAGE fill:#e3f2fd,stroke:#2196F3,stroke-width:2px
```

---

## 2. Data Flow — ข้อมูลไหลไปไหน

```mermaid
flowchart LR
    subgraph SOURCES["📥 แหล่งข้อมูลเข้า"]
        S1["Shopee Orders"]
        S2["Lazada Orders"]
        S3["TikTok Orders"]
        S4["Manual Import<br/>(Excel/CSV)"]
        S5["Odoo Sale Orders"]
    end

    subgraph WMS["⚙️ WMS Processing"]
        direction TB
        MERGE["Order Merge<br/>+ Dedup"]
        PICK["Pick<br/>สแกน barcode"]
        PACK["Pack<br/>เลือกกล่อง + AWB"]
        SCAN["Scan Outbound<br/>batch verify"]
        DISPATCH["Dispatch<br/>ส่งมอบขนส่ง"]
        INVOICE["Invoice<br/>สร้างใบแจ้งหนี้"]
    end

    subgraph OUTPUTS["📤 ข้อมูลออก"]
        O1["Odoo stock.picking<br/>อัพเดทสถานะ"]
        O2["Odoo account.move<br/>บันทึกบัญชี"]
        O3["Platform Status<br/>แจ้ง shipped"]
        O4["Courier AWB<br/>ปริ้นใบปะหน้า"]
        O5["Reports / Excel<br/>ส่งออกรายงาน"]
    end

    SOURCES --> MERGE --> PICK --> PACK --> SCAN --> DISPATCH --> INVOICE
    DISPATCH --> O1 & O3 & O4
    INVOICE --> O2
    DISPATCH --> O5

    style SOURCES fill:#e3f2fd,stroke:#1976D2
    style WMS fill:#f0e8ed,stroke:#714B67
    style OUTPUTS fill:#e8f5e9,stroke:#388E3C
```

---

## 3. Order Lifecycle — วงจรชีวิต Order (ไหลไป + ย้อนกลับ)

```mermaid
stateDiagram-v2
    [*] --> pending: Order เข้าระบบ
    pending --> picking: Picker หยิบสินค้า
    picking --> picked: สแกนครบทุกชิ้น
    picked --> packing: Packer เริ่มแพ็ค
    packing --> packed: เลือกกล่อง + ปิดกล่อง
    packed --> rts: สแกน AWB + Dispatch
    rts --> locked: ขนส่งรับแล้ว (เซ็นรับ)

    picking --> pending: ❌ ยกเลิกการหยิบ
    packing --> picked: ❌ แพ็คผิด (ย้อนกลับ)
    packed --> picked: ❌ AWB ผิด (repack)
    pending --> cancelled: ❌ ยกเลิก order

    locked --> [*]: ✅ จบ flow

    note right of pending
        📍 บันทึก: localStorage + Odoo stock.picking
        🔄 Sync ทุก 10 วินาที
    end note

    note right of rts
        📍 Odoo: button_validate()
        📍 Invoice: account.move สร้างอัตโนมัติ
        📍 Platform: แจ้ง shipped กลับ
    end note

    note right of locked
        🔒 ไม่สามารถแก้ไขได้
        📋 Manifest + ลายเซ็นคนขับ
    end note
```

---

## 4. Storage Map — บันทึกที่ไหน, สำรองที่ไหน

```mermaid
graph TB
    subgraph BROWSER["🌐 Browser (Client-Side)"]
        direction TB
        LS_NORMAL["localStorage — ข้อมูลทั่วไป<br/>───────────────────<br/>wms_orders (scan batch)<br/>wms_sales_orders (orders)<br/>wms_users (accounts+hash)<br/>wms_history (archive)<br/>wms_logs (activity)<br/>wms_box_usage (boxes)<br/>wms_inventory (stock)<br/>wms_waves (waves)<br/>wms_invoices (invoices)<br/>wms_eod_archives (EOD 30 วัน)<br/>wms_cycle_counts (นับสต็อค)<br/>wms_attendance (เข้า-ออกงาน)<br/>wms_chat_history (AI chat 50 msg)<br/>wms_sync_queue (offline queue)<br/>theme, lang, activeTab, userRole"]

        LS_ENCRYPTED["localStorage — 🔐 Encrypted (AES-GCM)<br/>───────────────────<br/>wms_apis (API keys ทุกตัว)<br/>wms_session (login session)<br/>wms_audit_log (security log)"]

        SS["sessionStorage<br/>───────────────────<br/>wms_enc_key (encryption passphrase)<br/>⚠️ หายเมื่อปิด tab"]
    end

    subgraph DOCKER["🐳 Docker Volumes (Server-Side)"]
        direction TB
        PG_VOL["postgres-data<br/>───────────────────<br/>PostgreSQL 16 database<br/>• Odoo tables ทั้งหมด<br/>• stock.picking, stock.quant<br/>• account.move, product.product<br/>• sale.order, res.partner"]

        ODOO_VOL["odoo-data<br/>───────────────────<br/>Odoo filestore<br/>• Product images<br/>• Attachments<br/>• Report templates"]

        ADDON_VOL["odoo-addons<br/>───────────────────<br/>Custom Odoo modules<br/>• WMS custom endpoints"]
    end

    subgraph BACKUP["💾 Backup Strategy"]
        direction TB
        B1["EOD Archive<br/>WMS สร้างทุกวัน<br/>เก็บ 30 วัน ใน localStorage"]
        B2["PostgreSQL Backup<br/>ต้องตั้ง cron ด้วยมือ<br/>pg_dump daily"]
        B3["Odoo Filestore<br/>ต้อง backup volume<br/>docker cp / rsync"]
        B4["Export Excel<br/>Reports → ดาวน์โหลด<br/>manual backup"]
    end

    BROWSER -->|"Sync ทุก 10 วิ"| DOCKER
    DOCKER --> BACKUP

    style BROWSER fill:#e3f2fd,stroke:#1976D2,stroke-width:2px
    style DOCKER fill:#e8f5e9,stroke:#388E3C,stroke-width:2px
    style BACKUP fill:#fff3e0,stroke:#FF9800,stroke-width:2px
```

---

## 5. Network & Deployment — รันที่ไหน

```mermaid
graph TB
    subgraph WAREHOUSE["🏭 โกดัง (LAN 192.168.x.x)"]
        direction TB

        subgraph SERVER["Ubuntu Server / Desktop"]
            DOCKER_WMS["🐳 wms-pro<br/>Nginx :3000→:80<br/>React SPA<br/>256MB / 0.5 CPU"]
            DOCKER_ODOO["🐳 wms-odoo<br/>Odoo 18 :8069<br/>ERP Backend<br/>1GB / 1 CPU"]
            DOCKER_PG["🐳 wms-postgres<br/>PostgreSQL 16 :5432<br/>Database<br/>512MB / 0.5 CPU"]

            DOCKER_WMS -->|"proxy_pass /web/"| DOCKER_ODOO
            DOCKER_ODOO -->|"SQL :5432"| DOCKER_PG
        end

        subgraph DEVICES["📱 อุปกรณ์หน้างาน"]
            D1["💻 คอม Admin<br/>http://server-ip:3000"]
            D2["📱 Handheld Picker<br/>http://server-ip:3000"]
            D3["📱 Tablet Packer<br/>http://server-ip:3000"]
            D4["💻 คอม Outbound<br/>http://server-ip:3000"]
        end

        DEVICES -->|"WiFi LAN"| DOCKER_WMS
    end

    subgraph INTERNET["☁️ Internet"]
        API_SHOPEE["Shopee API"]
        API_LAZADA["Lazada API"]
        API_TIKTOK["TikTok API"]
        API_COURIER["Courier APIs"]
        API_CLAUDE["Claude AI API"]
    end

    DOCKER_WMS -->|"HTTPS"| INTERNET

    style SERVER fill:#e8f5e9,stroke:#388E3C,stroke-width:2px
    style DEVICES fill:#e3f2fd,stroke:#1976D2
    style INTERNET fill:#fff8e1,stroke:#ffac00
```

---

## 6. Sync Flow — Online vs Offline

```mermaid
sequenceDiagram
    participant Browser as 🌐 Browser
    participant Queue as 📋 Sync Queue
    participant WMS as ⚛️ WMS Frontend
    participant Odoo as 🖥️ Odoo 18
    participant DB as 🗄️ PostgreSQL

    Note over Browser,DB: 🟢 ONLINE MODE (ทุก 10 วินาที)

    loop Poll every 10s
        WMS->>Odoo: fetchAllOrders()
        Odoo->>DB: SELECT stock.picking
        DB-->>Odoo: orders data
        Odoo-->>WMS: JSON-RPC response
        WMS->>WMS: Merge (local progress vs remote)
        WMS->>Browser: Update UI + localStorage
    end

    Note over Browser,DB: 🔴 OFFLINE MODE (ไม่มี server)

    Browser->>WMS: User scans barcode
    WMS->>Browser: Update localStorage
    WMS->>Queue: queueChange({action, data, ts})

    Note over Browser,DB: 🟡 RECONNECT (กลับมา online)

    WMS->>Odoo: Process sync queue
    loop For each queued action
        WMS->>Odoo: Apply change
        Odoo->>DB: UPDATE/INSERT
    end
    Odoo-->>WMS: Sync complete
    WMS->>Queue: Clear queue ✅
    WMS->>Browser: Toast "Synced N changes"
```

---

## 7. Odoo Data Model — Read/Write Direction

```mermaid
graph LR
    subgraph WMS_READ["📥 WMS อ่านจาก Odoo"]
        R1["stock.picking<br/>(orders + status)"]
        R2["stock.quant<br/>(stock levels)"]
        R3["product.product<br/>(SKU + barcode)"]
        R4["stock.location<br/>(warehouse zones)"]
        R5["account.move<br/>(invoices)"]
        R6["stock.warehouse.orderpoint<br/>(reorder rules)"]
        R7["sale.order<br/>(sales history)"]
    end

    subgraph WMS_WRITE["📤 WMS เขียนกลับ Odoo"]
        W1["stock.picking<br/>button_validate()"]
        W2["stock.move.line<br/>qty_done update"]
        W3["account.move<br/>create invoice"]
        W4["sale.order<br/>create + confirm"]
        W5["stock.location<br/>create PICKFACE"]
        W6["stock.warehouse.orderpoint<br/>create/update rules"]
    end

    subgraph WMS_BOTH["🔄 WMS อ่าน+เขียน"]
        B1["res.partner<br/>(customers)"]
        B2["stock.move<br/>(move lines)"]
    end

    style WMS_READ fill:#e3f2fd,stroke:#1976D2
    style WMS_WRITE fill:#ffebee,stroke:#D32F2F
    style WMS_BOTH fill:#fff3e0,stroke:#FF9800
```

---

## 8. Security & Encryption Flow

```mermaid
graph TB
    subgraph LOGIN["🔐 Login Flow"]
        L1["User enters password"]
        L2["Check account lockout<br/>(5 attempts / 5 min)"]
        L3["First login?<br/>(empty password)"]
        L4["Hash: SHA-256<br/>+ random salt<br/>+ 10,000 iterations"]
        L5["Verify: constant-time<br/>comparison"]
        L6["Create session<br/>(30 min timeout)"]
        L7["Force password change"]

        L1 --> L2
        L2 -->|"not locked"| L3
        L3 -->|"yes"| L7
        L3 -->|"no"| L4 --> L5
        L5 -->|"match"| L6
        L5 -->|"fail"| L2
    end

    subgraph ENCRYPT["🔒 Data Encryption"]
        E1["Sensitive data<br/>(API keys, session)"]
        E2["AES-GCM encrypt<br/>via Web Crypto API"]
        E3["Key: PBKDF2<br/>from random passphrase"]
        E4["Stored: localStorage<br/>prefix 'enc:'"]
        E5["Passphrase: sessionStorage<br/>⚠️ lost on tab close"]

        E1 --> E2 --> E4
        E3 --> E2
        E3 --> E5
    end

    subgraph SESSION["⏱️ Session Management"]
        S1["Session active<br/>(30 min timeout)"]
        S2["Warning at 25 min"]
        S3["Auto-refresh<br/>on user activity"]
        S4["Destroy session<br/>clear localStorage keys"]

        S1 --> S2 --> S3 --> S1
        S1 -->|"expired"| S4
    end

    style LOGIN fill:#fce4ec,stroke:#C62828,stroke-width:2px
    style ENCRYPT fill:#e8eaf6,stroke:#283593,stroke-width:2px
    style SESSION fill:#fff3e0,stroke:#E65100,stroke-width:2px
```

---

## 9. Platform Integration Flow

```mermaid
graph TB
    subgraph PLATFORMS["🛒 Marketplaces"]
        SHOPEE["🟠 Shopee<br/>Partner ID + Key<br/>shopee.com"]
        LAZADA["🔵 Lazada<br/>App Key + Secret<br/>lazada.com"]
        TIKTOK["⚫ TikTok<br/>App Key + Secret<br/>tiktokshop.com"]
    end

    subgraph COURIERS["🚚 Couriers"]
        FLASH["⚡ Flash Express"]
        KERRY["🟠 Kerry Express"]
        JT_EXP["🔴 J&T Express"]
        THAI["🔴 Thai Post / EMS"]
    end

    subgraph WMS_PLATFORM["⚙️ WMS Platform Engine"]
        SYNC["Platform Monitor<br/>Sync orders"]
        MAP["Order Mapping<br/>platform → WMS format"]
        AWB_GEN["AWB Generation<br/>ขอเลข tracking"]
        STATUS["Status Update<br/>แจ้ง shipped กลับ"]
    end

    PLATFORMS -->|"1. getOrders()"| SYNC
    SYNC --> MAP -->|"2. สร้าง salesOrder"| WMS_PLATFORM
    WMS_PLATFORM -->|"3. shipOrder()"| STATUS
    STATUS --> PLATFORMS

    WMS_PLATFORM -->|"4. createShipment()"| AWB_GEN
    AWB_GEN --> COURIERS
    COURIERS -->|"5. AWB + tracking"| AWB_GEN

    style PLATFORMS fill:#fff3e0,stroke:#FF9800,stroke-width:2px
    style COURIERS fill:#e0f2f1,stroke:#00897B,stroke-width:2px
    style WMS_PLATFORM fill:#f0e8ed,stroke:#714B67,stroke-width:2px
```

---

## 10. Rollback & Recovery Flow

```mermaid
graph TB
    subgraph NORMAL["✅ ปกติ"]
        N1["Live Mode<br/>Odoo connected"]
    end

    subgraph PROBLEMS["⚠️ เกิดปัญหา"]
        P1["Odoo server ล่ม"]
        P2["Platform API ล่ม"]
        P3["ข้อมูลผิดพลาด"]
        P4["บัญชีมีปัญหา"]
    end

    subgraph ROLLBACK["🔄 วิธี Rollback"]
        R1["สลับ Mock Mode<br/>1 คลิกใน Settings<br/>ใช้ localStorage ต่อ"]
        R2["ปิด toggle แต่ละ platform<br/>อิสระต่อกัน"]
        R3["EOD Archive<br/>restore จาก snapshot<br/>เก็บ 30 วัน"]
        R4["Odoo Journal Reverse<br/>กลับรายการบัญชี"]
    end

    subgraph RECOVERY["♻️ Recovery"]
        RC1["Odoo กลับมา<br/>→ Sync queue auto-process"]
        RC2["Platform กลับมา<br/>→ เปิด toggle sync ใหม่"]
        RC3["pg_dump restore<br/>→ กู้ database"]
    end

    N1 --> P1 & P2 & P3 & P4
    P1 --> R1 --> RC1
    P2 --> R2 --> RC2
    P3 --> R3 --> RC3
    P4 --> R4

    style NORMAL fill:#e8f5e9,stroke:#388E3C
    style PROBLEMS fill:#ffebee,stroke:#D32F2F
    style ROLLBACK fill:#fff3e0,stroke:#FF9800
    style RECOVERY fill:#e3f2fd,stroke:#1976D2
```

---

## Quick Reference — ตารางสรุป

### Ports

| Service | Port | URL |
|---------|------|-----|
| WMS (Nginx) | 3000 | `http://server-ip:3000` |
| Odoo 18 | 8069 | `http://server-ip:8069/web` |
| Odoo Longpoll | 8072 | WebSocket |
| PostgreSQL | 5432 | Internal only |
| Vite Dev | 5173 | `http://localhost:5173` |

### Docker Volumes

| Volume | Content | Backup Priority |
|--------|---------|-----------------|
| `postgres-data` | All Odoo data | 🔴 Critical — daily pg_dump |
| `odoo-data` | Images, files | 🟡 High — weekly rsync |
| `odoo-addons` | Custom modules | 🟢 Low — in git repo |

### localStorage Keys (22 keys)

| Key | Encrypted | Size Est. |
|-----|-----------|-----------|
| `wms_sales_orders` | No | 50-500 KB |
| `wms_apis` | **Yes** 🔐 | 1-2 KB |
| `wms_session` | **Yes** 🔐 | 0.5 KB |
| `wms_audit_log` | **Yes** 🔐 | 10-50 KB |
| `wms_users` | No | 1-5 KB |
| `wms_inventory` | No | 10-100 KB |
| `wms_logs` | No | 20-100 KB |
| `wms_chat_history` | No | 5-50 KB |
| `wms_eod_archives` | No | 50-200 KB |
| Other 13 keys | No | 1-10 KB each |

### Sync Intervals

| Target | Interval | Trigger |
|--------|----------|---------|
| Odoo orders | 10 sec | Auto-poll |
| Odoo inventory | 10 sec | Auto-poll |
| Platform orders | 60 sec | Auto-poll |
| Claude AI | On demand | User chat |
| EOD Archive | Daily | Manual / auto midnight |
