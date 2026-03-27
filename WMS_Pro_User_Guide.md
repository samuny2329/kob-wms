# Enterprise WMS Pro - User Guide
## คู่มือการใช้งานระบบ Enterprise WMS Pro
**สำหรับ Kiss of Beauty / SKINOXY Brand**

---

**Version:** 4.1.0
**Last Updated:** 2026-03-27
**Prepared by:** WMS Admin Team

---

## สารบัญ (Table of Contents)

1. [ภาพรวมระบบ (System Overview)](#1-ภาพรวมระบบ-system-overview)
2. [การเข้าสู่ระบบ (Login & Authentication)](#2-การเข้าสู่ระบบ-login--authentication)
3. [โครงสร้างสิทธิ์ผู้ใช้งาน (Role-Based Access)](#3-โครงสร้างสิทธิ์ผู้ใช้งาน-role-based-access)
4. [Dashboard - แดชบอร์ด](#4-dashboard---แดชบอร์ด)
5. [Pick List - รายการจัดเตรียมสินค้า](#5-pick-list---รายการจัดเตรียมสินค้า)
6. [Pack & Verify - บรรจุภัณฑ์และทวนสอบ](#6-pack--verify---บรรจุภัณฑ์และทวนสอบ)
7. [Handheld Pack - แพ็คผ่านมือถือ](#7-handheld-pack---แพ็คผ่านมือถือ)
8. [POS Pack - แพ็คแบบสถานี](#8-pos-pack---แพ็คแบบสถานี)
9. [Inventory - จัดการคลังสินค้า](#9-inventory---จัดการคลังสินค้า)
10. [Wave Sorting - จัดกลุ่มคำสั่งซื้อ](#10-wave-sorting---จัดกลุ่มคำสั่งซื้อ)
11. [Fulfillment - ติดตามสถานะคำสั่งซื้อ](#11-fulfillment---ติดตามสถานะคำสั่งซื้อ)
12. [Platform Monitor - เฝ้าระวังแพลตฟอร์ม](#12-platform-monitor---เฝ้าระวังแพลตฟอร์ม)
13. [Outbound Scan - สแกนนำจ่ายพัสดุ](#13-outbound-scan---สแกนนำจ่ายพัสดุ)
14. [Manifest - รายการจัดส่ง](#14-manifest---รายการจัดส่ง)
15. [Dispatch - ส่งมอบพัสดุ](#15-dispatch---ส่งมอบพัสดุ)
16. [Invoices - ใบแจ้งหนี้](#16-invoices---ใบแจ้งหนี้)
17. [Reports - รายงาน](#17-reports---รายงาน)
18. [User Management - จัดการผู้ใช้งาน](#18-user-management---จัดการผู้ใช้งาน)
19. [Settings - ตั้งค่าระบบ](#19-settings---ตั้งค่าระบบ)
20. [คีย์ลัด (Keyboard Shortcuts)](#20-คีย์ลัด-keyboard-shortcuts)
21. [แพลตฟอร์มที่รองรับ (Supported Platforms)](#21-แพลตฟอร์มที่รองรับ-supported-platforms)
22. [รายการสินค้า Pickface (Product Catalog)](#22-รายการสินค้า-pickface-product-catalog)
23. [การแก้ไขปัญหาเบื้องต้น (Troubleshooting)](#23-การแก้ไขปัญหาเบื้องต้น-troubleshooting)

---

## 1. ภาพรวมระบบ (System Overview)

**Enterprise WMS Pro** คือระบบบริหารจัดการคลังสินค้าอัจฉริยะ ออกแบบสำหรับ Kiss of Beauty / SKINOXY Brand โดยรองรับกระบวนการทำงานตั้งแต่การจัดเตรียมสินค้า (Picking), บรรจุภัณฑ์ (Packing), สแกนนำจ่าย (Outbound Scan) จนถึงการส่งมอบแก่ผู้ให้บริการขนส่ง (Dispatch)

### คุณสมบัติหลัก
- **Multi-Platform Integration** - เชื่อมต่อ Shopee, Lazada, TikTok Shop
- **Real-time Sync** - ซิงค์ข้อมูลกับ Odoo 18 ERP ทุก 10 วินาที (Polling)
- **Docker Deployment** - รันผ่าน Docker Compose (Nginx + Odoo 18 + PostgreSQL 16)
- **Barcode Scanner** - รองรับการสแกนบาร์โค้ดทุกขั้นตอน
- **Multi-Language** - รองรับภาษาไทยและภาษาอังกฤษ
- **Dark Mode** - โหมดมืดสำหรับการทำงานในสภาพแสงน้อย
- **Role-Based Access** - ระบบสิทธิ์ 5 ระดับ
- **Analytics** - Team Performance + SLA Tracker สำหรับ Admin

### สถานะคำสั่งซื้อ (Order Status Flow)

```
Pending → Picking → Picked → Packing → Packed → RTS (Ready to Ship) → Locked
```

| สถานะ | ความหมาย | สี |
|--------|----------|-----|
| Pending | รอจัดเตรียม | เทา |
| Picking | กำลังหยิบสินค้า | น้ำเงิน |
| Picked | หยิบสินค้าครบแล้ว | เขียว |
| Packing | กำลังบรรจุ | ส้ม |
| Packed | บรรจุเรียบร้อย | ม่วง |
| RTS | พร้อมส่ง (Ready to Ship) | เขียวเข้ม |
| Locked | ล็อคแล้ว (แก้ไขไม่ได้) | ดำ |

---

## 2. การเข้าสู่ระบบ (Login & Authentication)

### ขั้นตอนการเข้าสู่ระบบ

1. เปิดแอปพลิเคชัน WMS Pro ผ่านเว็บเบราว์เซอร์
2. กรอก **Username** (ชื่อผู้ใช้งาน)
3. กรอก **Password** (รหัสผ่าน)
4. กด **Sign In**

### การเข้าใช้ครั้งแรก (First Login)

- ระบบจะแจ้งข้อความ **"Security Update Required"**
- กำหนดรหัสผ่านใหม่ (ไม่น้อยกว่า 8 ตัวอักษร)
- กรอกรหัสผ่านใหม่ 2 ครั้งให้ตรงกัน
- กด **Update & Login**

### ข้อมูลเริ่มต้น (Default Credentials)

| ชื่อผู้ใช้ | รหัสผ่าน | บทบาท |
|-----------|----------|--------|
| admin | 123456 | Administrator |

> **หมายเหตุ:** รหัสผ่านเริ่มต้นของพนักงานใหม่คือ **123456** ระบบจะบังคับเปลี่ยนรหัสผ่านเมื่อเข้าใช้ครั้งแรก

### เปลี่ยนภาษา

- ที่หน้า Login สามารถเลือก **English** หรือ **ภาษาไทย** ได้จาก dropdown

---

## 3. โครงสร้างสิทธิ์ผู้ใช้งาน (Role-Based Access)

ระบบจัดการสิทธิ์การเข้าถึงอัตโนมัติตามบทบาทหน้าที่ (Segregation of Duties)

| บทบาท | คำอธิบาย | เมนูที่เข้าถึงได้ |
|--------|----------|-------------------|
| **Administrator** | ผู้ดูแลระบบ - สิทธิ์สูงสุด | ทุกเมนู |
| **Picker Specialist** | เจ้าหน้าที่หยิบสินค้า | Pick List, Wave Sorting, Manual |
| **Packer & QC** | เจ้าหน้าที่บรรจุภัณฑ์ | Pack & Verify, Handheld Pack, POS Pack, Fulfillment, Manual |
| **Outbound Ops** | เจ้าหน้าที่นำจ่าย | Outbound Scan, Manifest, Dispatch, Reports, Manual |
| **Accounting** | เจ้าหน้าที่บัญชี | Dashboard, Invoices, Reports, Manual |

---

## 4. Dashboard - แดชบอร์ด

แดชบอร์ดแสดงภาพรวมการดำเนินงานทั้งหมดในหน้าเดียว

### 4.1 Order Pipeline (สถานะคำสั่งซื้อ)

แสดงจำนวนคำสั่งซื้อในแต่ละสถานะ:
- **Pending** - รอจัดเตรียม
- **Picked** - หยิบแล้ว
- **Packed** - บรรจุแล้ว
- **RTS/Shipped** - พร้อมส่ง
- **Total Orders** - คำสั่งซื้อทั้งหมด

### 4.2 Inventory KPIs (ดัชนีคลังสินค้า)

- **Stock Value** - มูลค่าสินค้าคงคลังรวม (บาท)
- **Low Stock SKUs** - จำนวน SKU ที่สินค้าใกล้หมด
- **Active Waves** - จำนวน Wave ที่กำลังดำเนินการ
- **Invoiced Today** - ยอดออกใบแจ้งหนี้วันนี้

### 4.3 Outbound KPIs (ดัชนีขาออก)

- **Total Expected** - จำนวนพัสดุที่ต้องสแกนทั้งหมด
- **Total Scanned** - จำนวนที่สแกนแล้ว
- **Processing UPH** - อัตราความเร็ว (Units Per Hour)
- **SLA Breached** - จำนวนคำสั่งซื้อที่เกิน SLA

### 4.4 Charts (กราฟวิเคราะห์)

- **Courier Distribution** - สัดส่วนพัสดุแยกตามผู้ให้บริการขนส่ง (Pie Chart)
- **Delayed Orders by Platform** - คำสั่งซื้อล่าช้าแยกตามแพลตฟอร์ม (Bar Chart)

### 4.5 Team Performance (ผลงานทีม - Admin only)

ตารางแสดง KPI รายบุคคล:
- ชื่อพนักงาน
- จำนวน Pick / Pack / Scan
- รวมทั้งหมด
- UPH (Units Per Hour)

---

## 5. Pick List - รายการจัดเตรียมสินค้า

**คีย์ลัด:** `F1`
**สิทธิ์:** Admin, Picker

### 5.1 ภาพรวม

Pick List แสดงรายการคำสั่งซื้อที่รอจัดเตรียม เรียงตามความเร่งด่วน SLA

### 5.2 ขั้นตอนการทำงาน (Physical + Digital)

**ขั้นตอนที่ 1: เตรียมรายการ (ที่ PC/Tablet)**
1. **เปิดเมนู Pick List** - ระบบแสดงรายการ Order ที่สถานะ Pending
2. **เลือก Order** - คลิกที่ Order หรือสแกนบาร์โค้ดใบ Pick (WH/OUT/XXXXX)
3. **พิมพ์ Picking List** - กด Print List เพื่อพิมพ์ใบ Pick (A6, 100x150mm) หรือดูบน Tablet
   - ใบ Pick แสดง: ชื่อสินค้า, SKU, ตำแหน่ง Location, จำนวนที่ต้องหยิบ, ช่องเช็คถูก

**ขั้นตอนที่ 2: หยิบสินค้าที่ Pickface Shelf (Physical)**
4. **หยิบ Tote/Bin** - นำถาดรวมสินค้าจากจุดเริ่มต้น
5. **เดินไปตาม Pick Path** - ระบบเรียงลำดับ Location ให้เดินทางน้อยสุด:

| Zone | Location | สินค้า |
|------|----------|--------|
| A | A-01-01, A-01-02, A-02-01, A-02-02 | SKINOXY Toner Pad, Hydrogel Mask |
| B | B-02-01, B-02-02 | SKINOXY Body Wash |
| C | C-01-01, C-01-02, C-02-01, C-02-02 | KISS-MY-BODY Lotion, Mist |

6. **หยิบสินค้าตามจำนวน** - ที่แต่ละ Location:
   - อ่านชื่อสินค้า + จำนวนบนใบ Pick
   - หยิบจากชั้น Pickface ใส่ Tote
   - เช็คถูก ✓ บนใบ Pick (หรือสแกน barcode ณ จุดหยิบ ถ้าใช้ Tablet)
   - **FEFO**: หยิบ Lot ที่หมดอายุก่อน (ดูฉลากบน shelf)
7. **ตรวจทานก่อนกลับ** - นับจำนวนสินค้าใน Tote ให้ตรงกับใบ Pick

**ขั้นตอนที่ 3: สแกนยืนยันในระบบ (Digital)**
8. **นำ Tote มาที่ Pack Station** - วาง Tote บนโต๊ะ Pack
9. **สแกนบาร์โค้ดสินค้า** - ที่ช่อง Scan ด้านบน ให้สแกน SKU หรือ EAN barcode ทีละชิ้น
10. **ตรวจสอบจำนวน** - ระบบแสดง picked/expected สำหรับแต่ละรายการ
11. **หยิบครบ** - เมื่อหยิบสินค้าครบทุกรายการ Order จะเปลี่ยนสถานะเป็น "Picked" อัตโนมัติ

> **หมายเหตุ:** กรณีใช้ Handheld Scanner (มือถือ) สามารถสแกน barcode ที่ชั้นสินค้าได้เลย ไม่ต้องกลับมาสแกนที่ Pack Station อีก

### 5.3 ฟีเจอร์เพิ่มเติม

- **Print List** - พิมพ์รายการ Picking List (A6, 100x150mm)
- **Search** - ค้นหา Order ด้วยหมายเลข WH/OUT หรือชื่อลูกค้า
- **Barcode Scan** - รองรับสแกน SKU, EAN barcode, Order reference
- **Auto-focus** - ช่องสแกนจะโฟกัสอัตโนมัติ (บนมือถือใช้ readonly trick ป้องกันแป้นพิมพ์ขึ้น)

### 5.4 แสดงผลรายการ Order

แต่ละ Order แสดง:
- โลโก้แพลตฟอร์ม (Shopee/Lazada/TikTok/etc.)
- หมายเลข WH/OUT/XXXXX
- ชื่อลูกค้า
- จำนวนรายการสินค้า
- วันที่กำหนด
- สถานะ (Pending / In Progress)

---

## 6. Pack & Verify - บรรจุภัณฑ์และทวนสอบ

**คีย์ลัด:** `F2`
**สิทธิ์:** Admin, Packer

### 6.1 ภาพรวม

ระบบ Double Verification สำหรับการทวนสอบสินค้าก่อนบรรจุ พร้อม Cartonization Algorithm แนะนำกล่องที่เหมาะสม

### 6.2 ขั้นตอนการทำงาน (Physical + Digital)

**ขั้นตอนที่ 1: เตรียม Pack Station (Physical)**
1. **รับ Tote จาก Picker** - ตรวจสอบว่า Tote มีใบ Pick แนบมาด้วย
2. **วางสินค้าบนโต๊ะ Pack** - เรียงสินค้าออกจาก Tote ให้เห็นชัด
3. **เตรียมวัสดุบรรจุ** - กล่อง, Bubble Wrap, กระดาษกันกระแทก, เทปปิด

**ขั้นตอนที่ 2: ITEM SCAN — ทวนสอบสินค้า (Digital)**
4. เลือก Order จากรายการที่สถานะ "Picked"
5. **สแกนบาร์โค้ดสินค้าทีละชิ้น** — ยกสินค้าขึ้น สแกน barcode แล้ววางฝั่ง "สแกนแล้ว"
6. ระบบตรวจสอบว่าสินค้าตรงกับ Order หรือไม่
7. ทำซ้ำจนครบทุกรายการ

> **เทคนิค:** แบ่งโต๊ะเป็น 2 ฝั่ง — ซ้าย "ยังไม่สแกน" / ขวา "สแกนแล้ว" เพื่อไม่ให้สับสน

**ขั้นตอนที่ 3: BOX SELECT — เลือกและบรรจุกล่อง (Physical + Digital)**
8. ระบบแนะนำขนาดกล่องที่เหมาะสม
9. **เลือกกล่องในระบบ** แล้ว **หยิบกล่องจริงมาจากชั้นวัสดุ**:

| กล่อง | ขนาด | น้ำหนักสูงสุด | ใช้สำหรับ |
|-------|------|--------------|----------|
| Box S | 15x20x10 cm | 0.5 kg | สินค้า 1-2 ชิ้นเล็ก (Mist, Mask) |
| Box M | 25x30x15 cm | 1.5 kg | สินค้า 2-4 ชิ้น (Toner Pad + Lotion) |
| Box L | 35x40x20 cm | 3.0 kg | สินค้า 4-6 ชิ้น (Body Wash + อื่นๆ) |
| Box XL | 45x50x30 cm | 5.0 kg | สินค้าจำนวนมากหรือชิ้นใหญ่ |
| Envelope A4 | 24x33 cm | 0.3 kg | สินค้าแบน 1 ชิ้น (Hydrogel Mask) |
| Bubble Mailer | 20x28 cm | 0.4 kg | สินค้าเล็ก 1 ชิ้น (Mist, Serum) |

10. **บรรจุสินค้าลงกล่อง (Physical):**
    - วาง Bubble Wrap รองก้นกล่อง
    - วางสินค้าหนักก่อน → เบาซ้อนด้านบน
    - สินค้าที่แตกง่าย (ขวดแก้ว) ห่อ Bubble Wrap เพิ่ม
    - ใส่ใบ Packing Slip / ใบเสร็จ (ถ้ามี)
    - ปิดกล่อง + ติดเทปให้แน่น

**ขั้นตอนที่ 4: AWB CONFIRM — พิมพ์และติดใบปะหน้า (Physical + Digital)**
11. ระบบสร้าง AWB (Air Waybill) อัตโนมัติ
12. **พิมพ์ใบปะหน้า** จากเครื่องพิมพ์สติกเกอร์ (100x150mm)
13. **ติดใบปะหน้าบนกล่อง** — ติดด้านบนหรือด้านข้างใหญ่ที่สุด ห้ามติดทับรอยต่อเทป
14. **สแกน AWB barcode** บนใบปะหน้าเพื่อยืนยัน
15. Order เปลี่ยนสถานะเป็น "RTS" (Ready to Ship)

**ขั้นตอนที่ 5: LOCKED + วางพัสดุ**
16. Order ถูกล็อค ไม่สามารถแก้ไขได้
17. **วางพัสดุลงถาด Outbound** แยกตามขนส่ง (ดูสี Sorting Bin ที่กำหนด)

### 6.3 Feedback (การแจ้งผล)
- **สแกนถูกต้อง** - Flash สีเขียว + เสียง Beep
- **สแกนผิด** - Flash สีแดง + เสียงเตือน + ข้อความ "Barcode not recognized"
- **สแกนครบ** - ข้อความ "All items verified"

### 6.4 สิ่งที่ต้องตรวจสอบก่อนปิดกล่อง (QC Checklist)

- [ ] สินค้าครบตามจำนวน (ดูหน้าจอ packed = expected)
- [ ] สินค้าถูกรุ่น/สี/ขนาด (ตรวจด้วยตา + barcode)
- [ ] สินค้าไม่เสียหาย (ไม่บุบ, ไม่รั่ว, ฝาปิดสนิท)
- [ ] Lot/Expiry ถูกต้อง (FEFO — หมดอายุก่อนส่งก่อน)
- [ ] กล่องปิดสนิท เทปแน่น
- [ ] ใบปะหน้าติดเรียบร้อย อ่าน barcode ได้

---

## 7. Handheld Pack - แพ็คผ่านมือถือ

**สิทธิ์:** Admin, Packer

### 7.1 ภาพรวม

อินเทอร์เฟซสำหรับอุปกรณ์มือถือ (Handheld Scanner) ออกแบบมาเพื่อการใช้งานด้วยมือเดียว ปุ่มใหญ่ แสดงรูปสินค้า

### 7.2 ขั้นตอนการทำงาน (Physical + Digital)

**เตรียมตัว (Physical)**
1. **ชาร์จ Handheld Scanner** ให้พร้อม (แบตเตอรี่ ≥ 30%)
2. **เชื่อมต่อ WiFi คลัง** — ต้องใช้ WiFi เดียวกับเซิร์ฟเวอร์
3. **เปิด WMS Pro ผ่าน Browser** — ระบบจะตรวจจับเป็นโหมด Handheld อัตโนมัติ

**Picking + Packing แบบ Walk-and-Scan**
4. **เลือก Order** - แตะที่ Order card ที่ต้องการ
5. **เดินไปที่ Pickface** — ดูตำแหน่ง Location บนหน้าจอ (เช่น A-01-01)
6. **สแกนสินค้าที่ชั้น** — ยกสินค้าจาก shelf แล้วสแกน barcode ด้วย Handheld ทันที
7. **ตรวจด้วยตา** — ดูรูปสินค้าบนหน้าจอเทียบกับของจริง
8. **ดู Progress** - Progress bar แสดง % ความคืบหน้า
9. **AI Brain** - กดปุ่ม "AI Brain" เพื่อดูคำแนะนำการบรรจุ (FEFO, วิธีจัดของ)
10. **หยิบครบ → เดินกลับ Pack Station** — นำสินค้ามาที่โต๊ะ Pack

**บรรจุและติดใบปะหน้า (Physical)**
11. **เลือกกล่อง** - เมื่อสแกนครบ ให้แตะเลือกกล่องจากปุ่ม Grid บนหน้าจอ
12. **หยิบกล่องจริง** จากชั้นวัสดุ → บรรจุสินค้า → ปิดกล่อง
13. **พิมพ์ใบปะหน้า** — กด "Print Label" → ติดใบปะหน้าบนกล่อง
14. **วางพัสดุในถาด Outbound** → ไปยัง Order ถัดไป

> **ข้อดีของ Handheld:** สแกนที่ชั้นได้เลย ไม่ต้องกลับมาสแกนซ้ำที่ Pack Station — ลดขั้นตอน 1 รอบ

### 7.3 ฟีเจอร์พิเศษ

- **AI Smart Suggestion** - เรียก API จาก Odoo เพื่อแนะนำวิธีบรรจุสินค้า (SOP Guidance)
- **Product Image** - แสดงรูปสินค้าใหญ่เพื่อยืนยันด้วยสายตา
- **Touch-Friendly** - ปุ่มใหญ่เหมาะกับหน้าจอสัมผัส
- **Progress Tracking** - แสดง % ความคืบหน้าแบบ Real-time
- **Offline Queue** - สแกนได้แม้ WiFi หลุดชั่วคราว ระบบจะ sync เมื่อกลับมาออนไลน์

---

## 8. POS Pack - แพ็คแบบสถานี

**สิทธิ์:** Admin, Packer

### 8.1 ภาพรวม

อินเทอร์เฟซ 2 แผง สำหรับสถานีบรรจุ (Desktop Workstation) แผงซ้ายคือรายการ Order แผงขวาคือรายละเอียดการบรรจุ

### 8.2 การจัดวาง Pack Station (Physical Setup)

```
┌─────────────────────────────────────────────┐
│  MONITOR     │ ใบ Pick  │   เครื่องพิมพ์     │
│  (จอ PC)     │ + Tote   │   สติกเกอร์       │
├──────────────┼──────────┼───────────────────┤
│  Barcode     │ กล่อง    │   Bubble Wrap     │
│  Scanner     │ S/M/L/XL │   + เทป           │
├──────────────┼──────────┼───────────────────┤
│  ถาด OUT:    │ Flash    │ Shopee │ Kerry    │
│  (แยกขนส่ง) │ (เหลือง)  │ (ส้ม)  │ (แดง)    │
└─────────────────────────────────────────────┘
```

### 8.3 ขั้นตอนการทำงาน (Physical + Digital)

**เตรียม Station (Physical)**
1. **รับ Tote จาก Picker** — วาง Tote ฝั่งซ้ายของโต๊ะ
2. **เตรียมกล่อง + วัสดุ** — เก็บกล่องทุกขนาดไว้ใกล้มือ

**สแกนและบรรจุ (Digital + Physical)**
3. **ค้นหา/สแกน Order** - ที่แผงซ้ายบนจอ สแกน WH/OUT reference หรือพิมพ์ค้นหา
4. **ดูรายละเอียด** - แผงขวาแสดงรายการสินค้าของ Order ที่เลือก
5. **หยิบสินค้าจาก Tote → สแกน SKU** - ยกสินค้าขึ้น สแกนบาร์โค้ดทีละชิ้น แล้ววางฝั่ง "สแกนแล้ว"
6. **ปรับจำนวน** - ใช้ปุ่ม +/- ปรับจำนวนหากสินค้าจริงไม่ตรง (Short pick)
7. **เลือกกล่อง** - ระบบแนะนำ → คลิกเลือก → หยิบกล่องจริงมา

**บรรจุ (Physical)**
8. **บรรจุสินค้าลงกล่อง:**
   - Bubble Wrap รองก้น → วางสินค้า → กันกระแทกด้านบน → ปิดกล่อง
9. **พิมพ์ + ติดใบปะหน้า** — เครื่องพิมพ์อยู่ข้างจอ → ติดบนกล่องทันที
10. **สแกน AWB** - สแกนใบปะหน้าเพื่อล็อค Order

**จัดวาง (Physical)**
11. **วางพัสดุลงถาด Outbound** — แยกตามขนส่ง (สีถาดตาม Sorting Bin)
12. ทำ Order ถัดไป

### 8.4 ฟีเจอร์พิเศษ

- **Manual Adjustment** - ปุ่ม +/- สำหรับแก้ไขจำนวนที่หยิบ
- **Order Timeline** - แสดง Timeline สถานะของ Order
- **Search Filter** - ค้นหาด้วยหมายเลข Order หรือชื่อลูกค้า
- **Bulk RTS** - เลือกหลาย Order ที่ packed แล้ว เพื่อทำ Ready-to-Ship พร้อมกัน

---

## 9. Inventory - จัดการคลังสินค้า

**สิทธิ์:** Admin

### 9.1 ภาพรวม

ระบบจัดการคลังสินค้าแบบ Real-time รองรับ Lot Tracking, Stock Adjustment, และ Replenishment

### 9.2 การดูสินค้าคงคลัง

- **Filter by Warehouse** - เลือกคลัง (WH - Main, WH - Store B)
- **Filter by Category** - กรองตามหมวดหมู่สินค้า
- **Search** - ค้นหาด้วย SKU หรือชื่อสินค้า
- **Group By** - จัดกลุ่มตาม Warehouse, Category, Brand
- **Sort** - เรียงลำดับจากมากไปน้อย/น้อยไปมาก

### 9.3 รายละเอียดสินค้า

คลิกที่สินค้าเพื่อดู:
- รูปสินค้า, Barcode, Variant
- จำนวนคงคลัง (On Hand), จำนวนที่จองไว้ (Reserved), จำนวนพร้อมใช้ (Available)
- ตำแหน่งจัดเก็บ (Location) เช่น A-01-01
- Lot Number, Expiry Date, Received Date

### 9.4 Stock History (ประวัติการเคลื่อนไหว)

คลิก "History" เพื่อดูรายการเคลื่อนไหวทั้งหมดของสินค้า พร้อม Timestamp

### 9.5 Replenishment — เติมสินค้าจาก Bulk ไป Pickface (Physical + Digital)

**เมื่อระบบแจ้ง Low Stock:**
1. ดูรายการสินค้าที่ไฮไลท์สีแดง (ต่ำกว่า Reorder Point)
2. คลิก "Replenish" ที่สินค้าที่ต้องการ
3. กรอกจำนวนที่ต้องการเติม + ระบุเหตุผล

**ไปเติมสินค้าหน้างาน (Physical):**
4. **ไปที่ Bulk Storage** — เป็นชั้นเก็บสินค้าหลัก (มีสินค้า Lot จำนวนมาก)
5. **หยิบสินค้าตามจำนวน** — เลือก Lot ที่หมดอายุเร็วสุด (FEFO)
6. **นำไปวางที่ Pickface Shelf** — เติมที่ Location ตรงตามระบบ (เช่น A-01-01)
7. **จัดเรียง FEFO** — Lot เก่า (หมดอายุเร็ว) อยู่ด้านหน้า / Lot ใหม่อยู่ด้านหลัง
8. ระบบอัปเดตสต็อกและบันทึกประวัติ

### 9.6 Cycle Count — นับสต็อกตรวจสอบ (Physical)

การนับสต็อกเป็นระยะเพื่อให้ข้อมูลในระบบตรงกับของจริง:
1. **เลือก SKU ที่ต้องนับ** จากหน้า Inventory
2. **เดินไปที่ Pickface Location** ของ SKU นั้น
3. **นับจำนวนจริง** บนชั้น — นับแยก Lot (ดูฉลาก Lot Number)
4. **เปรียบเทียบกับระบบ** — ถ้าไม่ตรง ให้ทำ Stock Adjustment
5. **บันทึกเหตุผล** — เช่น "สินค้าเสียหาย", "นับผิดรอบก่อน", "คืนจาก QC Reject"

> **ความถี่แนะนำ:** Cycle Count สินค้า Top 20 SKU ทุกวันจันทร์ / สินค้าทั้งหมดทุกสิ้นเดือน

### 9.7 การแจ้งเตือน

- **Low Stock Alert** - สินค้าที่ต่ำกว่า Reorder Point จะแสดงไฮไลท์สีแดง
- **Stock Value** - มูลค่าสินค้าคงคลังรวมแสดงที่ด้านบน

---

## 10. Wave Sorting - จัดกลุ่มคำสั่งซื้อ

**สิทธิ์:** Admin, Picker

### 10.1 ภาพรวม

จัดกลุ่ม Order เป็น Wave เพื่อ Batch Picking ที่มีประสิทธิภาพ

### 10.2 สร้าง Wave ใหม่

1. กด **"Create Wave"**
2. ตั้งชื่อ Wave (เช่น "Morning Wave 16-Mar")
3. เลือกประเภท Wave:

| ประเภท | ช่วงเวลา | ไอคอน |
|--------|----------|-------|
| Morning Wave (รอบเช้า) | 08:00-12:00 | &#x1F305; |
| Afternoon Wave (รอบบ่าย) | 12:00-17:00 | &#x2600;&#xFE0F; |
| Evening Wave (รอบค่ำ) | 17:00-21:00 | &#x1F319; |
| Custom Wave (รอบพิเศษ) | กำหนดเอง | &#x26A1; |

4. เลือก Order ที่ต้องการรวมใน Wave (Checkbox / Select All)
5. กด **"Create Wave"**

### 10.3 Batch Picking ตาม Wave (Physical)

เมื่อสร้าง Wave แล้ว Picker จะหยิบสินค้าแบบ Batch:

1. **พิมพ์ Wave Pick List** — ระบบรวมสินค้าจากทุก Order ใน Wave เป็น 1 รายการ
2. **เตรียม Tote หลายใบ** — 1 Tote ต่อ 1 Order (ติดป้าย Order Ref บน Tote)
3. **เดินหยิบแบบ Batch** — เดินรอบเดียว หยิบสินค้าทุก Order ตาม Pick Path:
   - ที่ Location A-01-01 → หยิบ Toner Pad 5 ชิ้น (Order A=2, B=1, C=2) → แจกใส่ Tote ที่ถูก
   - ที่ Location B-02-01 → หยิบ Body Wash 3 ชิ้น → แจกใส่ Tote
4. **Wave Sorting** — หลังหยิบครบ นำ Tote มาเรียงตาม Courier:

```
Wave: Morning 27-Mar (15 Orders)
├── Shopee Express (6 Totes) → ส่งไป Pack Station 1
├── Lazada Express (4 Totes)  → ส่งไป Pack Station 2
├── Kerry Express (3 Totes)   → ส่งไป Pack Station 1
└── Flash Express (2 Totes)   → ส่งไป Pack Station 2
```

### 10.4 ติดตาม Wave (Digital)

- **Pick Progress** - แสดง % ที่หยิบสินค้าแล้ว
- **Pack Progress** - แสดง % ที่บรรจุแล้ว
- **Courier Group** - แสดง Order แยกตามผู้ให้บริการขนส่ง
- **Close Wave** - ปิด Wave เมื่อดำเนินการเสร็จ

---

## 11. Fulfillment - ติดตามสถานะคำสั่งซื้อ

**สิทธิ์:** Admin, Packer

### 11.1 ภาพรวม

ศูนย์กลางติดตามสถานะ Order ทั้งหมด พร้อมฟังก์ชัน Bulk RTS

### 11.2 Stats Row (แถบสถิติ)

- Total (ทั้งหมด)
- Pending (รอดำเนินการ)
- Processing (กำลังดำเนินการ)
- Packed (บรรจุแล้ว)
- Shipped (ส่งแล้ว)
- Rate % (อัตราความสำเร็จ)

### 11.3 Filter & Search

- **Status Filter** - กรอง All / Pending / Processing / Packed / Shipped
- **Search** - ค้นหาด้วย Order Ref, ชื่อลูกค้า, AWB

### 11.4 Bulk RTS (พร้อมส่งทีเดียว)

1. กรองสถานะ "Packed"
2. เลือก Order ที่ต้องการ (Checkbox)
3. กด **"Bulk RTS"**
4. ระบบสร้าง AWB และเปลี่ยนสถานะเป็น "Shipped" ทั้งหมด

### 11.5 Order Detail (คลิกเพื่อดูรายละเอียด)

- **Timeline** - แสดง 4 ขั้นตอน: Confirmed → Picked → Packed → Shipped
- **Item List** - รายการสินค้า (SKU, จำนวน packed/picked/expected)
- **AWB** - หมายเลขติดตามพัสดุ
- **Tracking Link** - ลิงก์ไปยังเว็บไซต์ผู้ให้บริการขนส่ง

---

## 12. Platform Monitor - เฝ้าระวังแพลตฟอร์ม

**สิทธิ์:** Admin

### 12.1 ภาพรวม

ติดตามสถานะ SLA ของแต่ละแพลตฟอร์ม E-Commerce แบบ Real-time

### 12.2 Platform Tabs

เลือกดูทีละแพลตฟอร์ม:
- Shopee, Lazada, TikTok
- Flash Express, J&T Express, Kerry Express, Thai Post

### 12.3 ข้อมูลที่แสดง

- **Connection Status** - สถานะการเชื่อมต่อ + จำนวน Order
- **Cutoff Time** - เวลาตัดรอบ (เช้า/บ่าย)
- **SLA Compliance** - อัตราปฏิบัติตาม SLA
- **Pending Orders** - Order ที่ยังไม่ได้ทำ RTS
- **SLA Breach Warning** - แจ้งเตือน Order ที่ใกล้เกิน SLA

### 12.4 กฎ SLA แต่ละแพลตฟอร์ม

| แพลตฟอร์ม | SLA | Auto-cancel |
|-----------|-----|-------------|
| Shopee | 24 ชม. | 48 ชม. |
| Lazada | 24 ชม. | 72 ชม. |
| TikTok | Real-time SLA | ตามนโยบาย |

---

## 13. Outbound Scan - สแกนนำจ่ายพัสดุ

**คีย์ลัด:** `F3`
**สิทธิ์:** Admin, Outbound

### 13.1 ภาพรวม

ระบบคัดแยกพัสดุอัตโนมัติตามผู้ให้บริการขนส่ง

### 13.2 จัดวาง Outbound Station (Physical Setup)

```
┌──────────────────────────────────────────────────┐
│  จอ PC + Scanner     │    พัสดุรอสแกน            │
│  (แสดงจุดคัดแยก)      │    (กองเรียงจาก Pack)      │
├──────────────────────┴───────────────────────────┤
│                                                  │
│  BIN 1 (เหลือง)    BIN 2 (ส้ม)    BIN 3 (แดง)    │
│  Flash Express     Shopee/Kerry   J&T Express    │
│                                                  │
│  BIN 4 (ชมพู)      BIN 5 (ม่วง)   Exception Bin  │
│  Thai Post         Lazada         ❌ ตรวจสอบ       │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 13.3 ขั้นตอนการทำงาน (Physical + Digital)

1. **นำพัสดุจากถาด Outbound มาวางที่โต๊ะ** — เรียง 1 แถว อ่าน AWB ง่าย
2. **หยิบพัสดุทีละชิ้น** → หันใบปะหน้าเข้าหา Scanner
3. **สแกน Tracking Number / AWB barcode**
4. **ดูหน้าจอ** — ระบบแสดง:
   - ชื่อขนส่ง + สี Sorting Bin (ตัวใหญ่ Flash สีเต็มจอ)
   - ข้อความ BIN 1 / BIN 2 / etc.
5. **วางพัสดุลง Sorting Bin ที่ระบุ** — จับคู่สีให้ตรง
6. หยิบพัสดุชิ้นถัดไป → ทำซ้ำ

### 13.4 การกำหนดจุดคัดแยก

| สี | ผู้ให้บริการขนส่ง | จุดคัดแยก | ป้ายถาด |
|-----|-------------------|-----------|---------|
| เหลือง | Flash Express | BIN 1 | ⚡ FLASH |
| ส้ม | Shopee Express / Kerry Express | BIN 2 | 🛒 SPX/KERRY |
| แดง | J&T Express | BIN 3 | J&T |
| ชมพู | Thailand Post / EMS | BIN 4 | 🇹🇭 THP |
| ม่วง | Lazada Express | BIN 5 | LEX |

> **เทคนิค:** ติดกระดาษสีที่ถาด/Bin ให้ตรงกับสีบนหน้าจอ จะหยิบวางได้เร็วขึ้นมาก

### 13.5 การจัดการข้อยกเว้น (Exception Handling)

- **สแกนซ้ำ** - ระบบแจ้งเตือน "Already scanned" → ข้ามไปชิ้นถัดไป
- **ไม่พบข้อมูล** - ระบบแจ้งเตือน "Not found" → วางลง Exception Bin แล้วตรวจสอบทีหลัง
- **กด Spacebar** - บันทึกข้อผิดพลาดและนำพัสดุออกจากสายพาน
- **ใบปะหน้าชำรุด/อ่านไม่ได้** — พิมพ์ใบใหม่จาก Fulfillment tab แล้วติดทับ

### 13.6 แผงขวา - สรุปการสแกน

- จำนวนที่สแกนแล้ว / จำนวนทั้งหมด
- รายการสแกนล่าสุดพร้อม Timestamp
- สถานะ Success / Error

---

## 14. Manifest - รายการจัดส่ง

**สิทธิ์:** Admin, Outbound

### 14.1 ภาพรวม

ตารางแสดงรายการพัสดุที่สแกนแล้วทั้งหมด ใช้สำหรับการตรวจสอบและส่งมอบ

### 14.2 ฟีเจอร์

- **Search** - ค้นหาด้วย Tracking Number หรือ Order Ref
- **Courier Filter** - กรองตามผู้ให้บริการขนส่ง
- **Pagination** - แสดง 25 รายการต่อหน้า
- **Tracking URL** - คลิก Tracking Number เพื่อเปิดหน้าติดตามพัสดุ
- **Status** - แสดง Scanned / Pending

### 14.3 ข้อมูลในตาราง

| คอลัมน์ | คำอธิบาย |
|---------|----------|
| No. | ลำดับ |
| Tracking/Barcode | หมายเลขติดตาม |
| Order Ref | หมายเลข WH/OUT |
| Platform | แพลตฟอร์มต้นทาง |
| Qty | จำนวนสินค้า |
| Status | สถานะ Scanned/Pending |

---

## 15. Dispatch - ส่งมอบพัสดุ

**คีย์ลัด:** `F4`
**สิทธิ์:** Admin, Outbound

### 15.1 ภาพรวม

กระบวนการส่งมอบพัสดุแก่คนขับรถขนส่ง พร้อมลายเซ็นดิจิทัล

### 15.2 ขั้นตอนการทำงาน (Physical + Digital)

**เตรียมส่งมอบ (Physical)**
1. **นำ Sorting Bin มารวมที่จุดส่งมอบ** — แยกตามขนส่ง
2. **นับพัสดุจริง** ในแต่ละ Bin → จดจำนวนไว้

**ส่งมอบ (Physical + Digital)**
3. **เมื่อคนขับมาถึง** — ตรวจบัตรประจำตัว / ป้ายทะเบียนรถ
4. **เลือกผู้ให้บริการขนส่ง** ในระบบ - กดที่ Chip แสดงชื่อขนส่ง + จำนวนพัสดุ
5. **ทวนสอบจำนวน** — นับพัสดุจริงให้ตรงกับจำนวนในระบบ
   - ถ้าไม่ตรง → ตรวจสอบ Exception Bin / ตรวจสอบ Sorting Bin ที่คัดแยกผิด
6. **ยกพัสดุขึ้นรถ** — คนขับ + เจ้าหน้าที่ช่วยยก นับซ้ำขณะยก
7. **ลงลายเซ็นดิจิทัล** — ให้คนขับลงลายเซ็นบน Canvas ในระบบ
   - รองรับทั้งเมาส์และหน้าจอสัมผัส (Tablet)
   - กด "Clear" เพื่อลบและเซ็นใหม่
8. **กด "Confirm Dispatch"**
9. ระบบบันทึก Timestamp และปิดรอบการจัดส่ง

**หลังส่งมอบ (Physical)**
10. **ทำความสะอาด Sorting Bin** — เก็บ Bin เปล่าพร้อมใช้รอบถัดไป
11. **ตรวจ Exception Bin** — จัดการพัสดุที่ค้าง (ใบปะหน้าผิด, สแกนไม่ได้, etc.)
12. **Export Manifest PDF** (ถ้าต้องการ) — เก็บเป็นหลักฐานการส่งมอบ

> **หมายเหตุ:** ควรถ่ายรูปรถขนส่ง + จำนวนพัสดุบนรถเก็บไว้เป็นหลักฐานเพิ่มเติม

---

## 16. Invoices - ใบแจ้งหนี้

**สิทธิ์:** Admin, Accounting

### 16.1 ภาพรวม

ระบบออกใบแจ้งหนี้อัตโนมัติ เชื่อมต่อกับ Odoo Accounting

### 16.2 Revenue KPI Cards

- **Total Revenue** - รายได้สะสมทั้งหมด
- **Today's Revenue** - รายได้วันนี้
- **Draft Count** - จำนวนใบแจ้งหนี้ร่าง
- **Paid Count** - จำนวนที่ชำระแล้ว

### 16.3 สถานะใบแจ้งหนี้

| สถานะ | คำอธิบาย | ไอคอน |
|--------|----------|-------|
| Draft | ร่าง (รอ Post) | &#x1F550; |
| Posted | ส่งแล้ว (รอชำระ) | &#x1F4E4; |
| Paid | ชำระแล้ว | &#x2713; |

### 16.4 ขั้นตอนการทำงาน

1. ระบบสร้าง Draft Invoice อัตโนมัติเมื่อ Order เปลี่ยนเป็น RTS
2. กด **"Auto-create"** เพื่อสร้างใบแจ้งหนี้ที่ยังไม่มี
3. กรองตามสถานะ (Draft / Posted / Paid)
4. เลือก Draft Invoice ที่ต้องการ (Checkbox)
5. กด **"Post"** เพื่อส่งไป Odoo Accounting
6. เมื่อลูกค้าชำระ ให้ mark "Paid" ใน Odoo

### 16.5 รายละเอียดใบแจ้งหนี้

คลิกเพื่อดู:
- **Line Items** - สินค้า, SKU, จำนวน, ราคาต่อหน่วย, ยอดรวม
- **VAT 7%** - ภาษีมูลค่าเพิ่มคำนวณอัตโนมัติ
- **Invoice Date / Due Date** - วันที่ออก / วันครบกำหนด
- **Payment State** - สถานะการชำระ

---

## 17. Team Performance - ผลงานทีม

**สิทธิ์:** Admin เท่านั้น

### 17.1 ภาพรวม

Dashboard วิเคราะห์ประสิทธิภาพรายบุคคลและรายทีม ใช้ตัวชี้วัด UPH (Units Per Hour) เป็นมาตรฐาน เป้าหมาย = **50 UPH**

### 17.2 KPI Cards

- **Active Workers** - จำนวนพนักงานที่กำลังทำงาน
- **Team UPH** - อัตราเฉลี่ยของทีม
- **Total Units** - จำนวนหน่วยที่ทำได้ทั้งหมด
- **Accuracy** - อัตราความถูกต้อง

### 17.3 Speed Gauge

แสดง UPH แบบ Gauge:
- **สีแดง** (0-25): ช้ากว่าเป้า
- **สีเหลือง** (25-50): ปานกลาง
- **สีเขียว** (50+): ได้เป้า

### 17.4 Leaderboard + Worker Detail

คลิกที่ชื่อพนักงานเพื่อดู:
- Scorecard รายบุคคล (UPH, Accuracy, Speed)
- Hourly Timeline — ปริมาณงานรายชั่วโมง
- Action Breakdown — สัดส่วน Pick/Pack/Scan
- Activity Log — รายการกิจกรรมล่าสุด
- 7-Day History — แนวโน้ม 7 วันย้อนหลัง
- Badges — เหรียญรางวัล (Speed Star, Perfect Accuracy, etc.)

### 17.5 Task Difficulty Scoring

ระบบจะให้คะแนนความยากของ Task 5 ระดับ:

| Tier | ชื่อ | เงื่อนไข |
|------|------|----------|
| 1 | Easy | 1-2 SKUs, 1 zone |
| 2 | Normal | 3-5 SKUs, 1-2 zones |
| 3 | Complex | 6-10 SKUs, 2-3 zones |
| 4 | Hard | 10+ SKUs, 3+ zones, special handling |
| 5 | Critical | VIP order, hazmat, cold chain |

---

## 17B. SLA Tracker - ติดตาม SLA

**สิทธิ์:** Admin เท่านั้น

### 17B.1 ภาพรวม

ติดตามการปฏิบัติตาม SLA (Service Level Agreement) แยกตาม Account/Platform

### 17B.2 SLA Windows

| ขั้นตอน | SLA | น้ำหนัก |
|---------|-----|---------|
| Pick | ≤ 120 นาที จากรับ Order | 30% |
| Pack | ≤ 60 นาที หลัง Pick เสร็จ | 30% |
| Ship | ≤ 240 นาที จากรับ Order | 30% |
| Accuracy | ถูกต้อง 100% | 10% |

**Overall SLA** = (Pick×0.3) + (Pack×0.3) + (Ship×0.3) + (Accuracy×0.1)

### 17B.3 ข้อมูลที่แสดง

- **Overview Cards** — On-time %, Breached count, Average time
- **Per-Account Table** — SLA compliance แยกตาม Shopee/Lazada/TikTok
- **Breach Timeline** — กราฟแสดง breach events ตามเวลา
- **Alerts** — แจ้งเตือน Order ที่ใกล้หรือเกิน SLA
- **Trend Chart** — แนวโน้ม SLA รายสัปดาห์

---

## 18. Reports - รายงาน

**สิทธิ์:** Admin, Outbound, Accounting

### 17.1 ภาพรวม

สร้างรายงาน Manifest และรายงานเชิงสถิติ

### 17.2 ตัวเลือกรายงาน

- **Data Source** - เลือกจาก Current Session หรือ History Batch
- **Courier Filter** - กรองตามผู้ให้บริการขนส่ง
- **Batch Selector** - เลือก Batch จากประวัติ (กรณีเลือก History)

### 17.3 Export PDF

กด **"Export PDF"** เพื่อสร้างเอกสาร A4:
- Header: KISS OF BEAUTY
- Batch ID + Timestamp
- ตาราง: ลำดับ | Tracking Number | Order Ref | Platform | Qty
- ช่องลงนาม: ผู้ส่ง / ผู้รับ + วันที่

---

## 18. User Management - จัดการผู้ใช้งาน

**สิทธิ์:** Admin เท่านั้น

### 18.1 เพิ่มพนักงานใหม่

1. กด **"Add New Employee"**
2. กรอก **Full Name** (ชื่อ-นามสกุล)
3. กรอก **Username** (ชื่อผู้ใช้สำหรับ Login)
4. เลือก **Role** จาก dropdown:
   - Administrator
   - Picker Specialist
   - Packer & QC
   - Outbound Ops
   - Accounting
5. กด **"Create User"**
6. ระบบกำหนดรหัสผ่านเริ่มต้น: **123456**

### 18.2 จัดการผู้ใช้ที่มีอยู่

| การดำเนินการ | วิธีการ |
|-------------|---------|
| Reset Password | กดไอคอน Refresh → รหัสผ่านกลับเป็น 123456 |
| Delete User | กดไอคอน Trash (ไม่สามารถลบ Admin ได้) |

### 18.3 ตารางผู้ใช้งาน

แสดง: ชื่อ, Username, Role Badge, Security Status (เปลี่ยนรหัสผ่านแล้ว/ยัง), Actions

---

## 19. Settings - ตั้งค่าระบบ

**สิทธิ์:** Admin เท่านั้น

### 19.1 Language (ภาษา)

เลือก English หรือ ภาษาไทย จาก Dropdown

### 19.2 Working Date (วันที่ทำงาน)

กำหนดวันที่ทำงานสำหรับการสร้าง Order และ Report

### 19.3 API Integration (การเชื่อมต่อ API)

#### Odoo ERP
- **Server URL** - ที่อยู่เซิร์ฟเวอร์ Odoo
- **Database** - ชื่อฐานข้อมูล
- **Username** - ชื่อผู้ใช้ Odoo
- **Password** - รหัสผ่าน Odoo
- **Mock Mode** - Toggle เปิด/ปิดโหมดจำลอง
- **Test Connection** - ทดสอบการเชื่อมต่อ
- **Setup PICKFACE Location** - สร้าง/ค้นหา Location "PICKFACE" ใน Odoo

#### Shopee API
- Shop ID, Partner ID, Partner Key

#### Lazada API
- App Key, App Secret, Access Token

#### TikTok API
- App Key, App Secret, Access Token

### 19.4 Test Data (ข้อมูลทดสอบ)

- **Create Test SOs** - สร้าง Sales Order ทดสอบ (กำหนดจำนวนได้)

### 19.5 Danger Zone (พื้นที่อันตราย)

- **Purge All Orders** - ลบ Order ทั้งหมด (ต้องยืนยันก่อนดำเนินการ)
- **Reset All Data** - รีเซ็ตข้อมูลทั้งหมด + Logout

> **คำเตือน:** การ Purge/Reset ไม่สามารถย้อนกลับได้!

---

## 20. คีย์ลัด (Keyboard Shortcuts)

| คีย์ลัด | ฟังก์ชัน |
|---------|----------|
| `F1` | เปิด Pick List |
| `F2` | เปิด Pack & Verify |
| `F3` | เปิด Outbound Scan |
| `F4` | เปิด Dispatch |
| `Spacebar` | บันทึกข้อยกเว้น (ขณะอยู่ใน Outbound Scan) |

---

## 21. แพลตฟอร์มที่รองรับ (Supported Platforms)

| แพลตฟอร์ม | สี | Prefix AWB | ผู้ให้บริการขนส่ง |
|-----------|-----|-----------|------------------|
| Shopee Express | ส้มแดง (#EE4D2D) | SPXTH | Shopee Express |
| Lazada Express | น้ำเงินเข้ม (#0F146D) | LZTH | Lazada Express |
| Flash Express | เหลือง (#FFCD00) | FLTH | Flash Express |
| Kerry Express | ส้ม (#FF6600) | KETH | Kerry Express |
| J&T Express | แดง (#D32011) | JTTH | J&T Express |
| Thai Post | แดง (#ED1C24) | TPTH | Thai Post |
| TikTok Shop | ดำ (#010101) | TTTH | TikTok Shop |

---

## 22. รายการสินค้า Pickface (Product Catalog)

### SKINOXY Brand

| SKU | ชื่อสินค้า | Barcode | Location |
|-----|-----------|---------|----------|
| STDH080-REFILL | Refill Toner Pad (Dewy) 150ml | 8859139111901 | A-01-01 |
| STBG080-REFILL | Toner Pad Refill (Bright) 150ml | 8859139111925 | A-01-02 |
| SWB700 | Body Wash (Bright) 700ml | 8859139111703 | B-02-01 |
| SWH700 | Body Wash (Hydra) 700ml | 8859139111680 | B-02-02 |
| SHGG030 | Hydrogel Mask (Glow) 30g | 8859139119830 | A-02-01 |
| SHLF030 | Hydrogel Mask (Lift) 30g | 8859139119847 | A-02-02 |

### KISS-MY-BODY Brand

| SKU | ชื่อสินค้า | Barcode | Location |
|-----|-----------|---------|----------|
| KLA226 | Bright & Shining Lotion 226ml | 8859139102261 | C-01-01 |
| KMA088 | Perfume Mist 88ml | 8859139100882 | C-01-02 |
| KLMH180 | Tone Up Body Lotion 180ml | 8859139118010 | C-02-01 |
| KWAP380 | Perfume & Aroma 380ml | 8859139138030 | C-02-02 |

---

## 23. การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

### ปัญหาที่พบบ่อย

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|---------|
| สแกนแล้วไม่ขึ้น | Barcode ไม่ตรงกับสินค้าใน Order | ตรวจสอบว่าเลือก Order ถูกต้อง |
| "Already scanned" | พัสดุถูกสแกนไปแล้ว | ข้ามไปสแกนชิ้นถัดไป |
| สถานะ "Offline" | ขาดการเชื่อมต่ออินเทอร์เน็ต | ตรวจสอบ WiFi / สาย LAN |
| Order ไม่แสดง | ข้อมูลค้างใน localStorage | ไป Settings > Reset หรือ Purge |
| Test Connection ล้มเหลว | URL/Credentials ไม่ถูกต้อง | ตรวจสอบ Server URL, DB, Username, Password |
| ใบปะหน้าไม่พิมพ์ | ไม่ได้เชื่อมต่อเครื่องพิมพ์ | ตรวจสอบการเชื่อมต่อเครื่องพิมพ์ |
| สินค้าไม่พบใน Inventory | ยังไม่ได้เพิ่มเข้าระบบ | เพิ่มสินค้าใน Odoo แล้ว Sync |
| Odoo sync ค้าง/ช้า | Network หรือ Odoo container ไม่ตอบ | ตรวจสอบ docker compose logs, restart container |

### การติดต่อผู้ดูแลระบบ

- ปัญหาเกี่ยวกับรหัสผ่าน → ติดต่อ Administrator เพื่อ Reset Password
- ปัญหาเกี่ยวกับสิทธิ์ → ติดต่อ Administrator เพื่อปรับ Role
- ปัญหาทางเทคนิค → ติดต่อทีม IT Support

---

**Enterprise WMS Pro v4.1.0** | Kiss of Beauty / SKINOXY
*เอกสารนี้เป็นความลับ ห้ามเผยแพร่โดยไม่ได้รับอนุญาต*
