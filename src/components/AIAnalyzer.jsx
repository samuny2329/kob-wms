import React, { useState, useMemo, useCallback } from 'react';
import { BrainCircuit, AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown, ArrowRight, RefreshCw, ChevronDown, ChevronUp, Package, Users as UsersIcon, DollarSign, Clock, Warehouse, BarChart2, ShieldAlert, Zap, Building2, Filter, Download, ShoppingCart, AlertOctagon, Boxes, CalendarDays, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { COMPANIES, getCompany } from '../constants';

// ── AI Analysis Engine (Rule-Based) ──────────────────────────────────────────
// Analyzes WMS + Odoo data from all 360-degree dimensions

const SEVERITY = {
    critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', icon: XCircle },
    high: { label: 'High', color: '#ea580c', bg: '#fff7ed', icon: AlertTriangle },
    medium: { label: 'Medium', color: '#d97706', bg: '#fffbeb', icon: AlertTriangle },
    low: { label: 'Low', color: '#2563eb', bg: '#eff6ff', icon: CheckCircle2 },
    info: { label: 'Info', color: '#6b7280', bg: '#f9fafb', icon: CheckCircle2 },
};

const DIMENSIONS = [
    { key: 'inventory', label: 'Inventory Variance', labelTh: 'ผลต่างสต็อค', icon: Package, color: '#3b82f6' },
    { key: 'order', label: 'Order Accuracy', labelTh: 'ความแม่นยำออเดอร์', icon: BarChart2, color: '#10b981' },
    { key: 'worker', label: 'Worker Performance', labelTh: 'ประสิทธิภาพพนักงาน', icon: UsersIcon, color: '#8b5cf6' },
    { key: 'sla', label: 'SLA Compliance', labelTh: 'การปฏิบัติตาม SLA', icon: Clock, color: '#f59e0b' },
    { key: 'financial', label: 'Financial Reconciliation', labelTh: 'กระทบยอดการเงิน', icon: DollarSign, color: '#ef4444' },
    { key: 'warehouse', label: 'Warehouse Utilization', labelTh: 'การใช้พื้นที่คลัง', icon: Warehouse, color: '#06b6d4' },
    { key: 'platform', label: 'Platform Performance', labelTh: 'ประสิทธิภาพแพลตฟอร์ม', icon: Zap, color: '#ec4899' },
];

// ── Mock Data Generator ──────────────────────────────────────────────────────
function generateMockAnalysis(companyKey) {
    const company = getCompany(companyKey);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    return {
        generatedAt: now.toISOString(),
        company: company.code,
        period: dateStr,
        overallScore: companyKey === 'kob' ? 78 : 72,
        totalFindings: companyKey === 'kob' ? 18 : 22,
        criticalCount: companyKey === 'kob' ? 2 : 3,

        dimensions: {
            // ── 1. Inventory Variance ──
            inventory: {
                score: companyKey === 'kob' ? 82 : 75,
                findings: [
                    {
                        id: 'inv-001',
                        severity: 'critical',
                        title: 'Stock Discrepancy: SKINOXY Toner Pad',
                        titleTh: 'สต็อคไม่ตรง: SKINOXY Toner Pad',
                        description: `Odoo shows 450 units at ${company.warehouse}/Stock, but last cycle count recorded 412 units. Variance: -38 units (8.4%)`,
                        descriptionTh: `Odoo แสดง 450 ชิ้นที่ ${company.warehouse}/Stock แต่นับจริงล่าสุดได้ 412 ชิ้น ผลต่าง: -38 ชิ้น (8.4%)`,
                        rootCause: 'Likely cause: 3 picks on 2026-03-27 were not confirmed in Odoo (stock.move.line qty_done=0). Worker "somchai" processed 3 orders without scan confirmation.',
                        rootCauseTh: 'สาเหตุน่าจะมาจาก: 3 รายการหยิบวันที่ 27/03/2026 ไม่ได้ยืนยันใน Odoo (stock.move.line qty_done=0) พนักงาน "somchai" ทำ 3 ออเดอร์โดยไม่สแกนยืนยัน',
                        recommendation: 'Force-validate pending picks. Run physical count for STDH080-REFILL. Enable mandatory scan-to-confirm.',
                        recommendationTh: 'บังคับ validate pick ที่ค้าง นับสต็อคจริง STDH080-REFILL เปิดบังคับสแกนยืนยัน',
                        data: { odooQty: 450, actualQty: 412, variance: -38, variancePct: -8.4, sku: 'STDH080-REFILL', location: `${company.warehouse}/Stock/K2-A01-01` },
                    },
                    {
                        id: 'inv-002',
                        severity: 'high',
                        title: 'GWP Items Not Synced to Odoo',
                        titleTh: 'สินค้า GWP ไม่ได้ sync ไป Odoo',
                        description: '12 GWP items registered locally but not found in Odoo product.product. Stock tracking is incomplete.',
                        descriptionTh: 'มีสินค้า GWP 12 รายการลงทะเบียนใน WMS แต่ไม่พบใน Odoo product.product ทำให้ track สต็อคไม่ครบ',
                        rootCause: 'GWP Quick Register was used while Odoo was offline. Items saved to localStorage only.',
                        rootCauseTh: 'GWP Quick Register ถูกใช้ขณะ Odoo ออฟไลน์ ข้อมูลบันทึกเฉพาะ localStorage',
                        recommendation: 'Run GWP Sync when Odoo is back online. Consider batch push of 12 pending items.',
                        recommendationTh: 'รัน GWP Sync เมื่อ Odoo ออนไลน์ ลองอัปโหลดเป็น batch 12 รายการที่ค้าง',
                        data: { localCount: 12, odooCount: 0, pending: 12 },
                    },
                    {
                        id: 'inv-003',
                        severity: 'medium',
                        title: 'Slow-Moving Stock Alert',
                        titleTh: 'สินค้าเคลื่อนไหวช้า',
                        description: '8 SKUs have not moved in 30+ days. Total value: 125,400 THB.',
                        descriptionTh: '8 SKU ไม่มีการเคลื่อนไหว 30+ วัน มูลค่ารวม 125,400 บาท',
                        rootCause: 'Seasonal products (summer campaign ended). No reorder rule adjustment made.',
                        rootCauseTh: 'สินค้าตามฤดูกาล (แคมเปญซัมเมอร์จบ) ไม่ได้ปรับ reorder rule',
                        recommendation: 'Review reorder rules for 8 SKUs. Consider promotional bundle to clear.',
                        recommendationTh: 'ทบทวน reorder rule ของ 8 SKU พิจารณาทำ bundle โปรโมชั่น',
                        data: { skuCount: 8, totalValue: 125400, avgDaysStagnant: 42 },
                    },
                ],
            },

            // ── 2. Order Accuracy ──
            order: {
                score: companyKey === 'kob' ? 94 : 88,
                findings: [
                    {
                        id: 'ord-001',
                        severity: 'high',
                        title: 'Pick Errors Spike — Last 7 Days',
                        titleTh: 'ข้อผิดพลาดการหยิบเพิ่มขึ้น — 7 วันล่าสุด',
                        description: 'Pick error rate increased from 1.2% to 3.8%. 14 wrong-item picks detected across 368 orders.',
                        descriptionTh: 'อัตราหยิบผิดเพิ่มจาก 1.2% เป็น 3.8% พบหยิบสินค้าผิด 14 ครั้งจาก 368 ออเดอร์',
                        rootCause: 'Analysis: 11 of 14 errors occurred in Zone C (location C-02-*). Zone C was reorganized on 2026-03-25 but pick locations not updated in system.',
                        rootCauseTh: 'วิเคราะห์: 11 จาก 14 ข้อผิดพลาดเกิดที่ Zone C (location C-02-*) Zone C ถูกจัดเรียงใหม่ 25/03/2026 แต่ไม่ได้อัปเดต location ในระบบ',
                        recommendation: 'Update stock.location for Zone C in Odoo. Run cycle count on C-02 rack. Retrain picker on zone layout changes.',
                        recommendationTh: 'อัปเดต stock.location ของ Zone C ใน Odoo นับสต็อค C-02 ทั้ง rack อบรมพนักงานหยิบเรื่อง layout ใหม่',
                        data: { errorRate: 3.8, prevErrorRate: 1.2, totalErrors: 14, totalOrders: 368, hotZone: 'C-02' },
                    },
                    {
                        id: 'ord-002',
                        severity: 'medium',
                        title: 'Partial Shipments Increasing',
                        titleTh: 'ส่งสินค้าไม่ครบเพิ่มขึ้น',
                        description: '6.2% of orders shipped partially (backorder created). Up from 2.1% last month.',
                        descriptionTh: '6.2% ของออเดอร์ส่งไม่ครบ (สร้าง backorder) เพิ่มจาก 2.1% เดือนที่แล้ว',
                        rootCause: 'Stock-outs on 3 popular SKUs caused by delayed supplier delivery. PO #KOB-PO-2026-089 still pending receipt.',
                        rootCauseTh: 'สินค้าหมด 3 SKU ยอดนิยม เพราะ supplier ส่งช้า PO #KOB-PO-2026-089 ยังไม่ได้รับของ',
                        recommendation: 'Follow up PO-089 with supplier. Set safety stock for top 20 SKUs. Enable auto-backorder notification.',
                        recommendationTh: 'ติดตาม PO-089 กับ supplier ตั้ง safety stock สำหรับ top 20 SKU เปิดแจ้งเตือน backorder อัตโนมัติ',
                        data: { partialRate: 6.2, prevRate: 2.1, affectedOrders: 23 },
                    },
                ],
            },

            // ── 3. Worker Performance ──
            worker: {
                score: companyKey === 'kob' ? 76 : 70,
                findings: [
                    {
                        id: 'wrk-001',
                        severity: 'high',
                        title: 'UPH Drop: Picker "Somchai K." — Below Target',
                        titleTh: 'UPH ลดลง: พนักงานหยิบ "สมชาย ค." — ต่ำกว่าเป้า',
                        description: 'Somchai\'s pick UPH dropped from 58 to 34 over 5 days. Currently 43% below target (60 UPH).',
                        descriptionTh: 'UPH หยิบของสมชายลดจาก 58 เหลือ 34 ใน 5 วัน ปัจจุบันต่ำกว่าเป้า 43% (เป้า 60 UPH)',
                        rootCause: 'Pattern: UPH normal in morning (52), drops significantly after lunch (18). Correlates with Zone C re-layout. Picker may be unfamiliar with new locations.',
                        rootCauseTh: 'รูปแบบ: UPH ปกติช่วงเช้า (52) ลดลงมากหลังอาหารเที่ยง (18) สอดคล้องกับการจัด Zone C ใหม่ พนักงานอาจไม่คุ้นเคยกับ location ใหม่',
                        recommendation: 'Pair with experienced picker for Zone C. Provide zone map update. Review after 3 days.',
                        recommendationTh: 'จับคู่กับพนักงานหยิบมีประสบการณ์สำหรับ Zone C ให้แผนผัง zone ใหม่ ติดตามผลใน 3 วัน',
                        data: { worker: 'Somchai K.', currentUPH: 34, targetUPH: 60, prevUPH: 58, morningUPH: 52, afternoonUPH: 18, daysTrending: 5 },
                    },
                    {
                        id: 'wrk-002',
                        severity: 'low',
                        title: 'Top Performer: Packer "Nattaya P."',
                        titleTh: 'พนักงานดีเด่น: แพ็คเกอร์ "ณัฐยา พ."',
                        description: 'Nattaya achieved 62 UPH (138% of target) with 100% accuracy for 14 consecutive days.',
                        descriptionTh: 'ณัฐยาทำได้ 62 UPH (138% ของเป้า) แม่นยำ 100% ติดต่อกัน 14 วัน',
                        rootCause: 'Consistent high performance. Uses scan-verify on every item. Zero rework.',
                        rootCauseTh: 'ทำงานดีสม่ำเสมอ ใช้ scan ตรวจทุกชิ้น ไม่มีงานแก้ไข',
                        recommendation: 'Recognize in team meeting. Consider for trainer role. Award KPI bonus points.',
                        recommendationTh: 'ชื่นชมในที่ประชุมทีม พิจารณาเป็น trainer ให้ KPI bonus',
                        data: { worker: 'Nattaya P.', currentUPH: 62, targetUPH: 45, accuracy: 100, streak: 14 },
                    },
                    {
                        id: 'wrk-003',
                        severity: 'medium',
                        title: 'Overtime Pattern: 3 Workers Consistently Late Checkout',
                        titleTh: 'รูปแบบ OT: 3 พนักงานเลิกงานช้าสม่ำเสมอ',
                        description: 'Preecha, Kannika, Wichai clock out 45-90 min late daily. Total extra hours this month: 38.5 hrs.',
                        descriptionTh: 'ปรีชา กรรณิการ์ วิชัย ลงเวลาออกช้า 45-90 นาที ทุกวัน OT รวมเดือนนี้ 38.5 ชม.',
                        rootCause: 'Workload imbalance — these 3 workers handle 60% of evening wave orders while team has 8 members.',
                        rootCauseTh: 'ปริมาณงานไม่สมดุล — 3 คนนี้ทำ 60% ของออเดอร์ evening wave ทั้งที่ทีมมี 8 คน',
                        recommendation: 'Redistribute evening wave assignments. Consider shift rotation. Review wave template capacity.',
                        recommendationTh: 'กระจายงาน evening wave ใหม่ พิจารณาหมุนเวียนกะ ทบทวนความจุ wave template',
                        data: { workers: ['Preecha M.', 'Kannika R.', 'Wichai S.'], totalOT: 38.5, avgDailyOT: 1.5 },
                    },
                ],
            },

            // ── 4. SLA Compliance ──
            sla: {
                score: companyKey === 'kob' ? 85 : 79,
                findings: [
                    {
                        id: 'sla-001',
                        severity: 'critical',
                        title: 'Shopee SLA Breach — 12 Orders Past Deadline',
                        titleTh: 'Shopee SLA เกินกำหนด — 12 ออเดอร์เลยเวลา',
                        description: '12 Shopee orders exceeded 48-hour ship-by deadline. Platform penalty risk: 1,200 THB + rating impact.',
                        descriptionTh: '12 ออเดอร์ Shopee เกินกำหนดส่ง 48 ชม. เสี่ยงถูกปรับ 1,200 บาท + ส่งผลต่อ rating',
                        rootCause: 'Bottleneck at Pack station: 8 of 12 orders were picked but stuck in "picked" status for 6+ hours. Only 1 packer on duty during afternoon shift (2 called in sick).',
                        rootCauseTh: 'คอขวดที่สถานีแพ็ค: 8 จาก 12 ออเดอร์หยิบแล้วแต่ค้างสถานะ "picked" 6+ ชม. มีแพ็คเกอร์ทำงานคนเดียวช่วงบ่าย (2 คนลาป่วย)',
                        recommendation: 'Implement auto-escalation when orders stuck >2hrs at any stage. Cross-train 2 pickers for pack backup. Set up SMS alert for SLA warning at 75% threshold.',
                        recommendationTh: 'ตั้ง auto-escalation เมื่อออเดอร์ค้าง >2 ชม. ฝึกพนักงานหยิบ 2 คนให้แพ็คได้ ตั้ง SMS alert เมื่อ SLA ถึง 75%',
                        data: { breachedOrders: 12, platform: 'Shopee', deadlineHrs: 48, penaltyRisk: 1200, bottleneck: 'Pack' },
                    },
                    {
                        id: 'sla-002',
                        severity: 'medium',
                        title: 'TikTok Ship-by Time Tightening',
                        titleTh: 'TikTok เวลาส่งสินค้ากระชั้น',
                        description: 'Average time-to-ship for TikTok orders: 22.3 hrs (deadline: 24 hrs). Only 1.7 hrs buffer remaining.',
                        descriptionTh: 'เวลาเฉลี่ยส่ง TikTok: 22.3 ชม. (กำหนด 24 ชม.) เหลือ buffer เพียง 1.7 ชม.',
                        rootCause: 'TikTok orders arrive in evening wave but are processed next morning. Overnight idle time adds 10+ hours.',
                        rootCauseTh: 'ออเดอร์ TikTok เข้ามาช่วง evening wave แต่ทำงานวันรุ่งขึ้นเช้า เวลาว่าง overnight เพิ่ม 10+ ชม.',
                        recommendation: 'Process TikTok orders in same-day evening wave. Or negotiate extended SLA with TikTok.',
                        recommendationTh: 'ทำออเดอร์ TikTok ใน evening wave วันเดียวกัน หรือเจรจาขอ SLA เพิ่มกับ TikTok',
                        data: { avgShipTime: 22.3, deadline: 24, buffer: 1.7, platform: 'TikTok' },
                    },
                ],
            },

            // ── 5. Financial Reconciliation ──
            financial: {
                score: companyKey === 'kob' ? 88 : 82,
                findings: [
                    {
                        id: 'fin-001',
                        severity: 'high',
                        title: 'Invoice-Order Mismatch: 8 Orders',
                        titleTh: 'ใบแจ้งหนี้ไม่ตรงกับออเดอร์: 8 รายการ',
                        description: 'Total invoice amount differs from sale order amount by 12,840 THB across 8 orders. All are Lazada platform.',
                        descriptionTh: 'ยอดใบแจ้งหนี้ต่างจากยอดใบสั่งขาย 12,840 บาท ใน 8 ออเดอร์ ทั้งหมดเป็น Lazada',
                        rootCause: 'Lazada promotional discount (15% off) was applied at platform level but not reflected in Odoo sale.order. Price list not synced.',
                        rootCauseTh: 'ส่วนลดโปรโมชั่น Lazada (ลด 15%) ถูกคำนวณที่แพลตฟอร์มแต่ไม่ได้สะท้อนใน Odoo sale.order Price list ไม่ได้ sync',
                        recommendation: 'Create credit notes for 8 orders. Update Lazada price sync to include promotional discounts. Review all Lazada orders from March campaign.',
                        recommendationTh: 'สร้าง credit note 8 ออเดอร์ อัปเดต Lazada price sync ให้รวมส่วนลดโปรโมชั่น ทบทวนออเดอร์ Lazada ทั้งหมดจากแคมเปญเดือนมี.ค.',
                        data: { mismatchAmount: 12840, orderCount: 8, platform: 'Lazada', cause: 'Promo discount not synced' },
                    },
                    {
                        id: 'fin-002',
                        severity: 'high',
                        title: 'COGS Variance: Actual Cost Exceeds Standard by 8.3%',
                        titleTh: 'ผลต่างต้นทุน: ต้นทุนจริงสูงกว่ามาตรฐาน 8.3%',
                        description: `Actual COGS for March: 1,284,500 THB vs Standard cost: 1,186,200 THB. Variance of 98,300 THB (8.3%). Top contributors: ${companyKey === 'kob' ? 'SKINOXY Serum (packaging cost +22%), Sunscreen SPF50 (raw material +15%)' : 'imported product line (FX rate +5.2%)'}.`,
                        descriptionTh: `ต้นทุนขายจริงเดือน มี.ค.: 1,284,500 บาท vs ต้นทุนมาตรฐาน: 1,186,200 บาท ผลต่าง 98,300 บาท (8.3%) ตัวหลัก: ${companyKey === 'kob' ? 'SKINOXY Serum (บรรจุภัณฑ์ +22%), กันแดด SPF50 (วัตถุดิบ +15%)' : 'สินค้านำเข้า (อัตราแลกเปลี่ยน +5.2%)'}`,
                        rootCause: 'Packaging supplier raised prices in Feb but product.product standard_price in Odoo not updated. BOM cost not recalculated since Q4.',
                        rootCauseTh: 'ซัพพลายเออร์บรรจุภัณฑ์ขึ้นราคาเดือน ก.พ. แต่ standard_price ใน Odoo ไม่ได้อัปเดต ต้นทุน BOM ไม่ได้คำนวณใหม่ตั้งแต่ Q4',
                        recommendation: 'Update standard_price for affected products. Recalculate BOM costs. Set up quarterly cost review schedule. Consider alternative packaging suppliers.',
                        recommendationTh: 'อัปเดต standard_price สินค้าที่เกี่ยวข้อง คำนวณต้นทุน BOM ใหม่ ตั้งตาราง review ต้นทุนรายไตรมาส พิจารณาซัพพลายเออร์บรรจุภัณฑ์ทางเลือก',
                        data: { actualCOGS: 1284500, standardCOGS: 1186200, variance: 98300, variancePct: 8.3, topSku: 'SKINOXY-SRM-30' },
                    },
                    {
                        id: 'fin-003',
                        severity: 'high',
                        title: 'Gross Profit Margin Dropped: 62% → 54%',
                        titleTh: 'กำไรขั้นต้นลดลง: 62% → 54%',
                        description: `Gross margin declined 8 points MoM. Revenue: 3,380,000 THB, COGS: 1,554,800 THB, Gross Profit: 1,825,200 THB (54%). ${companyKey === 'kob' ? 'Shopee 3.3 campaign heavy discounts (-18%) combined with COGS increase eroded margin.' : 'Modern Trade listing fees + COGS increase impacted margin.'}`,
                        descriptionTh: `กำไรขั้นต้นลดลง 8 จุด เทียบเดือนก่อน รายได้: 3,380,000 บาท ต้นทุน: 1,554,800 บาท กำไรขั้นต้น: 1,825,200 บาท (54%) ${companyKey === 'kob' ? 'แคมเปญ Shopee 3.3 ลดหนัก (-18%) + ต้นทุนเพิ่ม ทำให้มาร์จิ้นหด' : 'ค่า listing fee ห้าง + ต้นทุนเพิ่ม กระทบมาร์จิ้น'}`,
                        rootCause: 'Double impact: (1) Aggressive 3.3 campaign pricing reduced ASP by 18% on top SKUs. (2) COGS +8.3% from packaging cost increase. No margin floor policy enforced.',
                        rootCauseTh: 'กระทบสองทาง: (1) ตั้งราคาแคมเปญ 3.3 ลดเฉลี่ย 18% บน SKU หลัก (2) ต้นทุน +8.3% จากบรรจุภัณฑ์ ไม่มีนโยบาย minimum margin',
                        recommendation: 'Set minimum margin floor at 45% for all promotions. Create promotion simulation tool before campaign launch. Renegotiate packaging costs or find alternatives.',
                        recommendationTh: 'ตั้ง minimum margin 45% สำหรับทุกโปรโมชั่น สร้างเครื่องมือจำลองโปรโมชั่นก่อนเปิดแคมเปญ เจรจาต้นทุนบรรจุภัณฑ์ใหม่หรือหาทางเลือก',
                        data: { revenue: 3380000, cogs: 1554800, grossProfit: 1825200, marginCurrent: 54, marginPrev: 62, marginDrop: 8 },
                    },
                    {
                        id: 'fin-004',
                        severity: 'medium',
                        title: 'Unpaid Invoices: 45+ Days Overdue',
                        titleTh: 'ใบแจ้งหนี้ค้างชำระ: เกิน 45 วัน',
                        description: `5 invoices totaling 234,500 THB are overdue 45+ days. All from ${companyKey === 'btv' ? 'Modern Trade chains' : 'wholesale customers'}.`,
                        descriptionTh: `5 ใบแจ้งหนี้รวม 234,500 บาท ค้างเกิน 45 วัน ทั้งหมดจาก${companyKey === 'btv' ? 'ห้างค้าปลีก' : 'ลูกค้าขายส่ง'}`,
                        rootCause: 'Payment terms are Net 30 but actual collection averages 52 days. No automated follow-up in place.',
                        rootCauseTh: 'เทอมชำระ Net 30 แต่เก็บเงินจริงเฉลี่ย 52 วัน ไม่มีระบบติดตามอัตโนมัติ',
                        recommendation: 'Send payment reminder at Day 30, 37, 45. Escalate to management at Day 45. Review customer credit limits.',
                        recommendationTh: 'ส่งเตือนชำระวันที่ 30, 37, 45 ส่งต่อผู้บริหารวันที่ 45 ทบทวนวงเงินเครดิตลูกค้า',
                        data: { overdueAmount: 234500, invoiceCount: 5, avgDaysOverdue: 52 },
                    },
                    {
                        id: 'fin-005',
                        severity: 'medium',
                        title: 'Platform Commission Cost: 142,380 THB (4.2% of Revenue)',
                        titleTh: 'ค่าคอมมิชชั่นแพลตฟอร์ม: 142,380 บาท (4.2% ของรายได้)',
                        description: 'Total platform fees across Shopee (5.5%), Lazada (4.8%), TikTok (3.2%): weighted avg 4.2%. Shopee highest absolute: 78,540 THB due to volume.',
                        descriptionTh: 'ค่าธรรมเนียมแพลตฟอร์มรวม Shopee (5.5%), Lazada (4.8%), TikTok (3.2%): ถัวเฉลี่ย 4.2% Shopee สูงสุด: 78,540 บาท เพราะมียอดมากสุด',
                        rootCause: 'Shopee commission tier increased from 4% to 5.5% for beauty category in March. No adjustment to selling price to compensate.',
                        rootCauseTh: 'Shopee ขึ้นค่าคอมมิชชั่นหมวดความงามจาก 4% เป็น 5.5% ในเดือน มี.ค. ไม่ได้ปรับราคาขายชดเชย',
                        recommendation: 'Factor commission rates into pricing formula. Consider shifting volume to TikTok (lower commission). Negotiate Shopee preferred seller rate.',
                        recommendationTh: 'รวมค่าคอมมิชชั่นในสูตรตั้งราคา พิจารณาย้ายยอดไป TikTok (ค่าคอมต่ำกว่า) เจรจา preferred seller rate กับ Shopee',
                        data: { totalCommission: 142380, pctOfRevenue: 4.2, shopee: 78540, lazada: 42300, tiktok: 21540 },
                    },
                    {
                        id: 'fin-006',
                        severity: 'low',
                        title: 'Net Profit Margin: 18.2% (Target: 22%)',
                        titleTh: 'กำไรสุทธิ: 18.2% (เป้า: 22%)',
                        description: 'Revenue: 3,380,000 → COGS: 1,554,800 → Gross: 1,825,200 → OpEx: 1,210,300 (staff 680K, logistics 285K, platform 142K, other 103K) → Net Profit: 614,900 THB (18.2%).',
                        descriptionTh: 'รายได้: 3,380,000 → ต้นทุน: 1,554,800 → กำไรขั้นต้น: 1,825,200 → ค่าใช้จ่าย: 1,210,300 (พนักงาน 680K, ขนส่ง 285K, แพลตฟอร์ม 142K, อื่นๆ 103K) → กำไรสุทธิ: 614,900 บาท (18.2%)',
                        rootCause: 'Logistics cost increased 12% due to courier rate hikes. Staff overtime during 3.3 campaign added 45,000 THB. Combined with margin erosion from discounts.',
                        rootCauseTh: 'ค่าขนส่งเพิ่ม 12% จากขนส่งขึ้นราคา ค่าล่วงเวลาพนักงานช่วงแคมเปญ 3.3 เพิ่ม 45,000 บาท รวมกับมาร์จิ้นลดจากส่วนลด',
                        recommendation: 'Negotiate bulk courier rates. Optimize staffing schedule during campaigns. Target logistics cost < 8% of revenue.',
                        recommendationTh: 'เจรจาค่าขนส่งแบบ bulk พนักงานให้เพียงพอช่วงแคมเปญ ตั้งเป้าค่าขนส่ง < 8% ของรายได้',
                        data: { revenue: 3380000, cogs: 1554800, grossProfit: 1825200, opEx: 1210300, netProfit: 614900, netMargin: 18.2, target: 22 },
                    },
                ],
            },

            // ── 6. Warehouse Utilization ──
            warehouse: {
                score: companyKey === 'kob' ? 71 : 68,
                findings: [
                    {
                        id: 'wh-001',
                        severity: 'medium',
                        title: `${company.warehouse} Capacity at 87%`,
                        titleTh: `${company.warehouse} ใช้ความจุ 87%`,
                        description: 'Warehouse utilization approaching critical threshold (90%). Zone A: 95%, Zone B: 82%, Zone C: 78%.',
                        descriptionTh: 'การใช้พื้นที่คลังใกล้ขีดวิกฤต (90%) Zone A: 95%, Zone B: 82%, Zone C: 78%',
                        rootCause: 'Zone A overloaded with seasonal stock that should have been moved to overflow area. No rotation policy in place.',
                        rootCauseTh: 'Zone A เต็มด้วยสต็อคตามฤดูกาลที่ควรย้ายไป overflow ไม่มีนโยบายหมุนเวียนสินค้า',
                        recommendation: 'Move slow-movers from Zone A to overflow. Implement ABC classification for zone allocation.',
                        recommendationTh: 'ย้ายสินค้าเคลื่อนไหวช้าจาก Zone A ไป overflow ใช้ ABC classification จัดสรร zone',
                        data: { totalUtilization: 87, zoneA: 95, zoneB: 82, zoneC: 78, threshold: 90 },
                    },
                    {
                        id: 'wh-002',
                        severity: 'low',
                        title: 'Pickface Replenishment Needed: 5 Locations',
                        titleTh: 'ต้องเติมสินค้าหน้าชั้น: 5 ตำแหน่ง',
                        description: '5 pickface locations have stock below replenishment trigger (10 units). Average pick delay: +45 sec/order.',
                        descriptionTh: '5 ตำแหน่งหน้าชั้นสต็อคต่ำกว่าจุดเติม (10 ชิ้น) หยิบช้ากว่าปกติเฉลี่ย +45 วินาที/ออเดอร์',
                        rootCause: 'Replenishment task not triggered because stock.warehouse.orderpoint thresholds not set for new SKUs.',
                        rootCauseTh: 'task เติมสินค้าไม่ทำงานเพราะ stock.warehouse.orderpoint ไม่ได้ตั้งค่าสำหรับ SKU ใหม่',
                        recommendation: 'Configure reorder rules for 5 SKUs. Set min=10, max=50 for pickface locations.',
                        recommendationTh: 'ตั้ง reorder rule สำหรับ 5 SKU ตั้ง min=10, max=50 สำหรับ pickface',
                        data: { locations: 5, avgDelay: 45, unit: 'seconds' },
                    },
                ],
            },

            // ── 7. Platform Performance ──
            platform: {
                score: companyKey === 'kob' ? 80 : 74,
                findings: [
                    {
                        id: 'plt-001',
                        severity: 'medium',
                        title: 'Shopee Order Sync Delay: Avg 18 min',
                        titleTh: 'Shopee sync ออเดอร์ล่าช้า: เฉลี่ย 18 นาที',
                        description: 'Shopee orders take 18 min to appear in WMS after customer purchase. Target: <5 min.',
                        descriptionTh: 'ออเดอร์ Shopee ใช้เวลา 18 นาทีกว่าจะแสดงใน WMS หลังลูกค้าสั่ง เป้าหมาย <5 นาที',
                        rootCause: 'Platform polling interval is 60 seconds but Shopee API rate limit is causing 429 errors (15% of requests). Effective sync interval becomes ~3 minutes with retries.',
                        rootCauseTh: 'Polling interval คือ 60 วินาที แต่ Shopee API rate limit ทำให้เกิด 429 error (15% ของ request) Effective sync interval เป็น ~3 นาทีเมื่อรวม retry',
                        recommendation: 'Implement webhook receiver for real-time Shopee notifications. Reduce polling to once per 5 min as fallback only.',
                        recommendationTh: 'ทำ webhook receiver สำหรับ Shopee notification แบบ real-time ลด polling เป็น 5 นาทีเป็น fallback',
                        data: { avgSyncDelay: 18, target: 5, errorRate429: 15, platform: 'Shopee' },
                    },
                    {
                        id: 'plt-002',
                        severity: 'low',
                        title: 'Lazada Return Rate Higher Than Average',
                        titleTh: 'Lazada อัตราคืนสินค้าสูงกว่าเฉลี่ย',
                        description: 'Lazada return rate: 4.8% vs overall average 2.1%. Most returns cite "wrong item received".',
                        descriptionTh: 'อัตราคืน Lazada: 4.8% เทียบกับเฉลี่ย 2.1% คืนส่วนใหญ่ระบุ "ได้สินค้าไม่ถูก"',
                        rootCause: 'Lazada orders have similar SKU variants (color differences) that are hard to distinguish visually. No barcode scan verification at pack.',
                        rootCauseTh: 'ออเดอร์ Lazada มี SKU คล้ายกัน (ต่างสี) ที่แยกด้วยตายากว่ า ไม่มีสแกนบาร์โค้ดตรวจที่สถานีแพ็ค',
                        recommendation: 'Enable mandatory barcode scan at pack station for Lazada orders. Add visual comparison photo to pick list.',
                        recommendationTh: 'เปิดบังคับสแกนบาร์โค้ดที่สถานีแพ็คสำหรับ Lazada ใส่รูปเปรียบเทียบใน pick list',
                        data: { returnRate: 4.8, avgReturnRate: 2.1, mainReason: 'Wrong item', platform: 'Lazada' },
                    },
                ],
            },

        },
    };
}

// ── Sales Forecast Mock Data ─────────────────────────────────────────────────
function generateSalesForecast(companyKey) {
    const company = getCompany(companyKey);
    const now = new Date();
    const isKOB = companyKey === 'kob';

    // Generate 30-day sales history
    const salesHistory = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (29 - i));
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const base = isKOB ? 85 : 45;
        const weekendFactor = isWeekend ? 1.4 : 1.0;
        const trend = 1 + (i * 0.005); // slight upward trend
        const noise = 0.8 + Math.random() * 0.4;
        return {
            date: d.toISOString().split('T')[0],
            orders: Math.round(base * weekendFactor * trend * noise),
            revenue: Math.round(base * weekendFactor * trend * noise * (isKOB ? 890 : 1250)),
            units: Math.round(base * weekendFactor * trend * noise * 2.8),
        };
    });

    const totalRevenue30d = salesHistory.reduce((s, d) => s + d.revenue, 0);
    const totalOrders30d = salesHistory.reduce((s, d) => s + d.orders, 0);
    const totalUnits30d = salesHistory.reduce((s, d) => s + d.units, 0);
    const avgDailyOrders = Math.round(totalOrders30d / 30);
    const avgDailyRevenue = Math.round(totalRevenue30d / 30);

    // Top SKUs with stock forecast
    const skuData = isKOB ? [
        { sku: 'STDH080-REFILL', name: 'SKINOXY Toner Pad Refill (Dewy)', currentStock: 412, avgDailySales: 18, reorderPoint: 150, reorderQty: 500, unitCost: 89, unitPrice: 299, category: 'Skincare', topPlatform: 'Shopee', trend: 'up', trendPct: 12 },
        { sku: 'STBG080-REFILL', name: 'SKINOXY Toner Pad Refill (Bright)', currentStock: 285, avgDailySales: 14, reorderPoint: 120, reorderQty: 400, unitCost: 92, unitPrice: 299, category: 'Skincare', topPlatform: 'Lazada', trend: 'up', trendPct: 8 },
        { sku: 'SWB700', name: 'SKINOXY Body Wash 700ml', currentStock: 680, avgDailySales: 8, reorderPoint: 100, reorderQty: 300, unitCost: 125, unitPrice: 490, category: 'Body Care', topPlatform: 'TikTok', trend: 'stable', trendPct: 1 },
        { sku: 'SCL150', name: 'SKINOXY Cleansing Oil 150ml', currentStock: 45, avgDailySales: 12, reorderPoint: 100, reorderQty: 350, unitCost: 78, unitPrice: 350, category: 'Skincare', topPlatform: 'Shopee', trend: 'up', trendPct: 22 },
        { sku: 'SSR030', name: 'SKINOXY Sunscreen SPF50 30ml', currentStock: 890, avgDailySales: 6, reorderPoint: 80, reorderQty: 200, unitCost: 65, unitPrice: 290, category: 'Sun Care', topPlatform: 'Lazada', trend: 'down', trendPct: -5 },
        { sku: 'SMK020', name: 'SKINOXY Mask Sheet (Box/10)', currentStock: 320, avgDailySales: 11, reorderPoint: 100, reorderQty: 300, unitCost: 110, unitPrice: 399, category: 'Skincare', topPlatform: 'TikTok', trend: 'up', trendPct: 15 },
        { sku: 'SES030', name: 'SKINOXY Essence Serum 30ml', currentStock: 155, avgDailySales: 9, reorderPoint: 80, reorderQty: 250, unitCost: 95, unitPrice: 450, category: 'Skincare', topPlatform: 'Shopee', trend: 'stable', trendPct: 2 },
        { sku: 'SLP015', name: 'SKINOXY Lip Treatment 15ml', currentStock: 520, avgDailySales: 4, reorderPoint: 50, reorderQty: 150, unitCost: 42, unitPrice: 199, category: 'Lip Care', topPlatform: 'TikTok', trend: 'down', trendPct: -8 },
    ] : [
        { sku: 'STDH080-REFILL', name: 'SKINOXY Toner Pad Refill (Dewy)', currentStock: 1200, avgDailySales: 32, reorderPoint: 300, reorderQty: 1000, unitCost: 89, unitPrice: 185, category: 'Skincare', topPlatform: 'Big C', trend: 'up', trendPct: 10 },
        { sku: 'STBG080-REFILL', name: 'SKINOXY Toner Pad Refill (Bright)', currentStock: 850, avgDailySales: 25, reorderPoint: 250, reorderQty: 800, unitCost: 92, unitPrice: 185, category: 'Skincare', topPlatform: "Lotus's", trend: 'stable', trendPct: 3 },
        { sku: 'SWB700', name: 'SKINOXY Body Wash 700ml', currentStock: 380, avgDailySales: 15, reorderPoint: 200, reorderQty: 500, unitCost: 125, unitPrice: 310, category: 'Body Care', topPlatform: 'Watsons', trend: 'up', trendPct: 18 },
        { sku: 'SCL150', name: 'SKINOXY Cleansing Oil 150ml', currentStock: 90, avgDailySales: 18, reorderPoint: 150, reorderQty: 400, unitCost: 78, unitPrice: 220, category: 'Skincare', topPlatform: 'Big C', trend: 'up', trendPct: 25 },
        { sku: 'SSR030', name: 'SKINOXY Sunscreen SPF50 30ml', currentStock: 2100, avgDailySales: 22, reorderPoint: 200, reorderQty: 600, unitCost: 65, unitPrice: 180, category: 'Sun Care', topPlatform: '7-11', trend: 'up', trendPct: 35 },
        { sku: 'SMK020', name: 'SKINOXY Mask Sheet (Box/10)', currentStock: 180, avgDailySales: 14, reorderPoint: 120, reorderQty: 350, unitCost: 110, unitPrice: 250, category: 'Skincare', topPlatform: 'Watsons', trend: 'stable', trendPct: 0 },
    ];

    // Calculate days until stockout & status
    const stockForecasts = skuData.map(item => {
        const daysUntilOut = item.avgDailySales > 0 ? Math.floor(item.currentStock / item.avgDailySales) : 999;
        const daysUntilReorder = item.avgDailySales > 0 ? Math.max(0, Math.floor((item.currentStock - item.reorderPoint) / item.avgDailySales)) : 999;
        const status = daysUntilOut <= 3 ? 'stockout' : daysUntilOut <= 7 ? 'critical' : daysUntilOut <= 14 ? 'warning' : daysUntilReorder <= 0 ? 'reorder' : 'healthy';
        const stockValue = item.currentStock * item.unitCost;
        const monthlyRevenue = item.avgDailySales * 30 * item.unitPrice;
        const margin = Math.round(((item.unitPrice - item.unitCost) / item.unitPrice) * 100);
        const turnoverDays = item.avgDailySales > 0 ? Math.round(item.currentStock / item.avgDailySales) : 999;
        return { ...item, daysUntilOut, daysUntilReorder, status, stockValue, monthlyRevenue, margin, turnoverDays };
    }).sort((a, b) => a.daysUntilOut - b.daysUntilOut);

    // Platform breakdown
    const platforms = isKOB
        ? [
            { name: 'Shopee', orders: Math.round(totalOrders30d * 0.42), revenue: Math.round(totalRevenue30d * 0.38), growth: 12, color: '#ee4d2d' },
            { name: 'Lazada', orders: Math.round(totalOrders30d * 0.28), revenue: Math.round(totalRevenue30d * 0.30), growth: 5, color: '#0f146d' },
            { name: 'TikTok', orders: Math.round(totalOrders30d * 0.22), revenue: Math.round(totalRevenue30d * 0.24), growth: 28, color: '#010101' },
            { name: 'Website', orders: Math.round(totalOrders30d * 0.08), revenue: Math.round(totalRevenue30d * 0.08), growth: -3, color: '#714B67' },
        ]
        : [
            { name: 'Big C', orders: Math.round(totalOrders30d * 0.30), revenue: Math.round(totalRevenue30d * 0.28), growth: 8, color: '#dc2626' },
            { name: "Lotus's", orders: Math.round(totalOrders30d * 0.25), revenue: Math.round(totalRevenue30d * 0.26), growth: 6, color: '#16a34a' },
            { name: '7-11', orders: Math.round(totalOrders30d * 0.20), revenue: Math.round(totalRevenue30d * 0.18), growth: 15, color: '#f97316' },
            { name: 'Watsons', orders: Math.round(totalOrders30d * 0.15), revenue: Math.round(totalRevenue30d * 0.17), growth: 12, color: '#2563eb' },
            { name: 'Others', orders: Math.round(totalOrders30d * 0.10), revenue: Math.round(totalRevenue30d * 0.11), growth: 2, color: '#6b7280' },
        ];

    // Category breakdown
    const categories = {};
    stockForecasts.forEach(item => {
        if (!categories[item.category]) categories[item.category] = { units: 0, revenue: 0, stockValue: 0, skuCount: 0 };
        categories[item.category].units += item.avgDailySales * 30;
        categories[item.category].revenue += item.monthlyRevenue;
        categories[item.category].stockValue += item.stockValue;
        categories[item.category].skuCount += 1;
    });

    // AI insights for sales
    const criticalStockItems = stockForecasts.filter(s => s.status === 'stockout' || s.status === 'critical');
    const reorderItems = stockForecasts.filter(s => s.status === 'reorder' || s.status === 'warning');
    const totalStockValue = stockForecasts.reduce((s, i) => s + i.stockValue, 0);

    return {
        generatedAt: now.toISOString(),
        company: company.code,
        salesHistory,
        summary: {
            totalRevenue30d, totalOrders30d, totalUnits30d,
            avgDailyOrders, avgDailyRevenue,
            avgOrderValue: Math.round(totalRevenue30d / totalOrders30d),
            revenueGrowth: isKOB ? 14.2 : 9.8,
            orderGrowth: isKOB ? 11.5 : 7.3,
        },
        stockForecasts,
        platforms,
        categories,
        alerts: {
            criticalCount: criticalStockItems.length,
            reorderCount: reorderItems.length,
            totalStockValue,
            overstock: stockForecasts.filter(s => s.turnoverDays > 60).length,
            deadStock: stockForecasts.filter(s => s.turnoverDays > 90).length,
        },
        aiInsights: {
            demandForecast: isKOB
                ? 'Demand trending +14% MoM driven by TikTok campaigns. Expect surge in Toner Pad (Dewy) — prepare 600+ units for next 2 weeks.'
                : 'Modern Trade restocking cycle peaks in Week 1 of each month. Pre-position 40% more stock for Big C and Lotus\'s by March 30.',
            demandForecastTh: isKOB
                ? 'ยอดสั่งเพิ่ม +14% MoM จากแคมเปญ TikTok คาดว่า Toner Pad (Dewy) จะขายดี — เตรียมสต็อค 600+ ชิ้นสำหรับ 2 สัปดาห์ถัดไป'
                : 'รอบเติมสินค้า Modern Trade สูงสุดสัปดาห์ที่ 1 ของเดือน เตรียมสต็อคเพิ่ม 40% สำหรับ Big C และ Lotus\'s ภายใน 30 มี.ค.',
            stockStrategy: isKOB
                ? 'SCL150 (Cleansing Oil) will stockout in 3-4 days with +22% demand growth. Emergency PO needed NOW. SSR030 (Sunscreen) is overstocked — 148 days supply, consider bundling.'
                : 'SCL150 will stockout in 5 days — request inter-company transfer from KOB-WH1. SSR030 (Sunscreen) has 95 days supply with +35% summer demand growth — well positioned.',
            stockStrategyTh: isKOB
                ? 'SCL150 (Cleansing Oil) จะหมดใน 3-4 วันพร้อมยอดขายเพิ่ม +22% ต้องสั่ง PO ด่วนทันที SSR030 (กันแดด) สต็อคเกิน — มีของ 148 วัน พิจารณาทำ bundle'
                : 'SCL150 จะหมดใน 5 วัน — ขอโอนย้ายจาก KOB-WH1 SSR030 (กันแดด) มีสต็อค 95 วัน + ยอดขายเพิ่ม 35% ช่วงซัมเมอร์ — อยู่ในตำแหน่งดี',
            revenueProjection: isKOB
                ? `30-day revenue projection: ${(totalRevenue30d * 1.14 / 1000000).toFixed(1)}M THB (+14%). Key risk: stockout on top 2 SKUs could reduce by 800K.`
                : `30-day revenue projection: ${(totalRevenue30d * 1.10 / 1000000).toFixed(1)}M THB (+10%). Key risk: delayed PO from KOB could impact Big C restocking.`,
            revenueProjectionTh: isKOB
                ? `ประมาณการรายได้ 30 วัน: ${(totalRevenue30d * 1.14 / 1000000).toFixed(1)}M บาท (+14%) ความเสี่ยง: ของหมด 2 SKU แรกอาจลดรายได้ 800K`
                : `ประมาณการรายได้ 30 วัน: ${(totalRevenue30d * 1.10 / 1000000).toFixed(1)}M บาท (+10%) ความเสี่ยง: PO จาก KOB ล่าช้าอาจกระทบการเติม Big C`,
        },
    };
}

// ── Mini Bar Chart (pure CSS) ──
const MiniBar = ({ values, maxVal, color = '#3b82f6', height = 40 }) => {
    const max = maxVal || Math.max(...values, 1);
    return (
        <div className="flex items-end gap-px" style={{ height }}>
            {values.map((v, i) => (
                <div key={i} className="flex-1 rounded-t-sm transition-all" style={{
                    height: `${Math.max((v / max) * 100, 2)}%`,
                    backgroundColor: i >= values.length - 7 ? color : color + '50',
                    minWidth: '2px',
                }} title={`${v}`} />
            ))}
        </div>
    );
};

// ── Stock Status Badge ──
const StockStatusBadge = ({ status, isEn }) => {
    const config = {
        stockout: { label: isEn ? 'STOCKOUT RISK' : 'เสี่ยงหมด', color: '#dc2626', bg: '#fef2f2' },
        critical: { label: isEn ? 'CRITICAL' : 'วิกฤต', color: '#ea580c', bg: '#fff7ed' },
        warning: { label: isEn ? 'WARNING' : 'เตือน', color: '#d97706', bg: '#fffbeb' },
        reorder: { label: isEn ? 'REORDER NOW' : 'สั่งเติมเลย', color: '#7c3aed', bg: '#f5f3ff' },
        healthy: { label: isEn ? 'HEALTHY' : 'ปกติ', color: '#059669', bg: '#f0fdf4' },
    }[status] || { label: status, color: '#6b7280', bg: '#f9fafb' };
    return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.color}30` }}>
            {config.label}
        </span>
    );
};

// ── Sales Forecast Panel Component ──
const SalesForecastPanel = ({ forecastData, language, company }) => {
    const [stockFilter, setStockFilter] = useState('all');
    const [expandedSku, setExpandedSku] = useState(null);
    const isEn = language === 'en';

    if (!forecastData) return null;

    const { summary, stockForecasts, platforms, categories, alerts, aiInsights, salesHistory } = forecastData;

    const filteredStock = stockFilter === 'all' ? stockForecasts
        : stockFilter === 'alert' ? stockForecasts.filter(s => ['stockout', 'critical', 'warning', 'reorder'].includes(s.status))
        : stockForecasts.filter(s => s.status === stockFilter);

    return (
        <div className="space-y-4">
            {/* ── Sales Summary Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: isEn ? 'Revenue (30d)' : 'รายได้ (30 วัน)', value: `${(summary.totalRevenue30d / 1000000).toFixed(1)}M`, sub: `+${summary.revenueGrowth}%`, color: '#059669', icon: DollarSign, trend: 'up' },
                    { label: isEn ? 'Orders (30d)' : 'ออเดอร์ (30 วัน)', value: summary.totalOrders30d.toLocaleString(), sub: `+${summary.orderGrowth}%`, color: '#3b82f6', icon: ShoppingCart, trend: 'up' },
                    { label: isEn ? 'Avg Order Value' : 'ยอดเฉลี่ย/ออเดอร์', value: `${summary.avgOrderValue.toLocaleString()} THB`, sub: `${summary.avgDailyOrders}/day`, color: '#8b5cf6', icon: BarChart2 },
                    { label: isEn ? 'Stock Alerts' : 'แจ้งเตือนสต็อค', value: alerts.criticalCount + alerts.reorderCount, sub: `${alerts.criticalCount} critical`, color: alerts.criticalCount > 0 ? '#dc2626' : '#d97706', icon: AlertOctagon },
                ].map(card => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="rounded-xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
                            <div className="flex items-center justify-between mb-2">
                                <Icon className="w-5 h-5" style={{ color: card.color }} />
                                {card.trend && (
                                    <div className="flex items-center gap-0.5">
                                        <ArrowUpRight className="w-3 h-3" style={{ color: '#059669' }} />
                                        <span className="text-[10px] font-bold" style={{ color: '#059669' }}>{card.sub}</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xl font-bold" style={{ color: '#111827' }}>{card.value}</p>
                            <p className="text-[11px]" style={{ color: '#6b7280' }}>{card.label}</p>
                            {!card.trend && card.sub && <p className="text-[10px] mt-0.5" style={{ color: card.color }}>{card.sub}</p>}
                        </div>
                    );
                })}
            </div>

            {/* ── Sales Trend Chart ── */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold" style={{ color: '#111827' }}>
                        {isEn ? '30-Day Sales Trend' : 'แนวโน้มยอดขาย 30 วัน'}
                    </h3>
                    <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />{isEn ? 'Orders' : 'ออเดอร์'}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }} />{isEn ? 'Revenue' : 'รายได้'}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] font-medium mb-1" style={{ color: '#6b7280' }}>{isEn ? 'Daily Orders' : 'ออเดอร์รายวัน'}</p>
                        <MiniBar values={salesHistory.map(d => d.orders)} color="#3b82f6" height={50} />
                        <div className="flex justify-between mt-1 text-[9px]" style={{ color: '#9ca3af' }}>
                            <span>30d ago</span><span>Today</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-medium mb-1" style={{ color: '#6b7280' }}>{isEn ? 'Daily Revenue (THB)' : 'รายได้รายวัน (บาท)'}</p>
                        <MiniBar values={salesHistory.map(d => d.revenue)} color="#10b981" height={50} />
                        <div className="flex justify-between mt-1 text-[9px]" style={{ color: '#9ca3af' }}>
                            <span>30d ago</span><span>Today</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Platform Breakdown ── */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#111827' }}>
                    {isEn ? 'Channel Performance' : 'ประสิทธิภาพแต่ละช่องทาง'}
                </h3>
                <div className="space-y-2">
                    {platforms.map(p => {
                        const pctOfTotal = Math.round((p.revenue / summary.totalRevenue30d) * 100);
                        return (
                            <div key={p.name} className="flex items-center gap-3">
                                <div className="w-20 text-xs font-semibold" style={{ color: '#374151' }}>{p.name}</div>
                                <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
                                    <div className="h-full rounded-full transition-all flex items-center px-2" style={{ width: `${pctOfTotal}%`, backgroundColor: p.color, minWidth: '30px' }}>
                                        <span className="text-[9px] font-bold text-white">{pctOfTotal}%</span>
                                    </div>
                                </div>
                                <div className="w-24 text-right">
                                    <span className="text-xs font-semibold" style={{ color: '#374151' }}>{(p.revenue / 1000).toFixed(0)}K</span>
                                </div>
                                <div className="w-16 text-right flex items-center justify-end gap-0.5">
                                    {p.growth > 0 ? <ArrowUpRight className="w-3 h-3" style={{ color: '#059669' }} /> : p.growth < 0 ? <ArrowDownRight className="w-3 h-3" style={{ color: '#dc2626' }} /> : <Minus className="w-3 h-3" style={{ color: '#6b7280' }} />}
                                    <span className="text-[11px] font-bold" style={{ color: p.growth > 0 ? '#059669' : p.growth < 0 ? '#dc2626' : '#6b7280' }}>
                                        {p.growth > 0 ? '+' : ''}{p.growth}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Stock Forecast 360° ── */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Boxes className="w-5 h-5" style={{ color: company.color }} />
                        <h3 className="text-sm font-bold" style={{ color: '#111827' }}>
                            {isEn ? 'Stock Forecast 360°' : 'พยากรณ์สต็อค 360°'}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                            {stockForecasts.length} SKUs
                        </span>
                    </div>
                    <div className="flex gap-1.5">
                        {[
                            { key: 'all', label: isEn ? 'All' : 'ทั้งหมด' },
                            { key: 'alert', label: isEn ? 'Alerts' : 'แจ้งเตือน' },
                            { key: 'stockout', label: isEn ? 'Stockout' : 'หมด' },
                            { key: 'healthy', label: isEn ? 'Healthy' : 'ปกติ' },
                        ].map(f => (
                            <button key={f.key} onClick={() => setStockFilter(f.key)}
                                className="text-[10px] font-medium px-2 py-1 rounded-md transition-all"
                                style={{ backgroundColor: stockFilter === f.key ? company.color : '#f3f4f6', color: stockFilter === f.key ? '#fff' : '#6b7280' }}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stock Summary Bar */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                    {[
                        { label: isEn ? 'Total Value' : 'มูลค่ารวม', value: `${(alerts.totalStockValue / 1000).toFixed(0)}K`, color: '#374151' },
                        { label: isEn ? 'Critical' : 'วิกฤต', value: alerts.criticalCount, color: '#dc2626' },
                        { label: isEn ? 'Reorder' : 'ต้องสั่ง', value: alerts.reorderCount, color: '#7c3aed' },
                        { label: isEn ? 'Overstock' : 'สต็อคเกิน', value: alerts.overstock, color: '#d97706' },
                        { label: isEn ? 'Dead Stock' : 'ค้างนาน', value: alerts.deadStock, color: '#6b7280' },
                    ].map(s => (
                        <div key={s.label} className="text-center rounded-lg py-2" style={{ backgroundColor: s.color + '08', border: `1px solid ${s.color}20` }}>
                            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-[9px]" style={{ color: s.color }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Stock Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                <th className="text-left py-2 px-1 font-semibold" style={{ color: '#6b7280' }}>SKU</th>
                                <th className="text-right py-2 px-1 font-semibold" style={{ color: '#6b7280' }}>{isEn ? 'Stock' : 'สต็อค'}</th>
                                <th className="text-right py-2 px-1 font-semibold" style={{ color: '#6b7280' }}>{isEn ? 'Daily Sales' : 'ขาย/วัน'}</th>
                                <th className="text-right py-2 px-1 font-semibold" style={{ color: '#6b7280' }}>{isEn ? 'Days Left' : 'เหลือ(วัน)'}</th>
                                <th className="text-center py-2 px-1 font-semibold" style={{ color: '#6b7280' }}>{isEn ? 'Trend' : 'แนวโน้ม'}</th>
                                <th className="text-center py-2 px-1 font-semibold" style={{ color: '#6b7280' }}>{isEn ? 'Status' : 'สถานะ'}</th>
                                <th className="text-right py-2 px-1 font-semibold" style={{ color: '#6b7280' }}>{isEn ? 'Margin' : 'กำไร'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStock.map(item => (
                                <React.Fragment key={item.sku}>
                                    <tr className="cursor-pointer transition-colors" style={{ borderBottom: '1px solid #f3f4f6' }}
                                        onClick={() => setExpandedSku(expandedSku === item.sku ? null : item.sku)}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <td className="py-2 px-1">
                                            <p className="font-semibold" style={{ color: '#111827' }}>{item.sku}</p>
                                            <p className="text-[10px]" style={{ color: '#6b7280' }}>{item.name.length > 30 ? item.name.slice(0, 30) + '...' : item.name}</p>
                                        </td>
                                        <td className="text-right py-2 px-1 font-semibold" style={{ color: item.currentStock <= item.reorderPoint ? '#dc2626' : '#111827' }}>
                                            {item.currentStock.toLocaleString()}
                                        </td>
                                        <td className="text-right py-2 px-1" style={{ color: '#374151' }}>{item.avgDailySales}</td>
                                        <td className="text-right py-2 px-1 font-bold" style={{ color: item.daysUntilOut <= 7 ? '#dc2626' : item.daysUntilOut <= 14 ? '#d97706' : '#059669' }}>
                                            {item.daysUntilOut}d
                                        </td>
                                        <td className="text-center py-2 px-1">
                                            <div className="flex items-center justify-center gap-0.5">
                                                {item.trend === 'up' ? <ArrowUpRight className="w-3 h-3" style={{ color: '#059669' }} /> : item.trend === 'down' ? <ArrowDownRight className="w-3 h-3" style={{ color: '#dc2626' }} /> : <Minus className="w-3 h-3" style={{ color: '#6b7280' }} />}
                                                <span className="text-[10px] font-bold" style={{ color: item.trend === 'up' ? '#059669' : item.trend === 'down' ? '#dc2626' : '#6b7280' }}>
                                                    {item.trendPct > 0 ? '+' : ''}{item.trendPct}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-center py-2 px-1"><StockStatusBadge status={item.status} isEn={isEn} /></td>
                                        <td className="text-right py-2 px-1 font-semibold" style={{ color: item.margin >= 60 ? '#059669' : item.margin >= 40 ? '#2563eb' : '#d97706' }}>
                                            {item.margin}%
                                        </td>
                                    </tr>
                                    {expandedSku === item.sku && (
                                        <tr><td colSpan={7} className="py-2 px-2">
                                            <div className="rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Reorder Point' : 'จุดสั่งเติม'}</p>
                                                    <p className="text-sm font-bold" style={{ color: '#334155' }}>{item.reorderPoint} {isEn ? 'units' : 'ชิ้น'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Reorder Qty' : 'จำนวนสั่ง'}</p>
                                                    <p className="text-sm font-bold" style={{ color: '#334155' }}>{item.reorderQty} {isEn ? 'units' : 'ชิ้น'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Stock Value' : 'มูลค่าสต็อค'}</p>
                                                    <p className="text-sm font-bold" style={{ color: '#334155' }}>{(item.stockValue / 1000).toFixed(1)}K THB</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Top Channel' : 'ช่องทางหลัก'}</p>
                                                    <p className="text-sm font-bold" style={{ color: '#334155' }}>{item.topPlatform}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Monthly Revenue' : 'รายได้/เดือน'}</p>
                                                    <p className="text-sm font-bold" style={{ color: '#059669' }}>{(item.monthlyRevenue / 1000).toFixed(0)}K THB</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Unit Cost' : 'ต้นทุน/ชิ้น'}</p>
                                                    <p className="text-sm font-bold" style={{ color: '#334155' }}>{item.unitCost} THB</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Sell Price' : 'ราคาขาย'}</p>
                                                    <p className="text-sm font-bold" style={{ color: '#334155' }}>{item.unitPrice} THB</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold" style={{ color: '#64748b' }}>{isEn ? 'Turnover' : 'หมุนเวียน'}</p>
                                                    <p className="text-sm font-bold" style={{ color: item.turnoverDays > 60 ? '#d97706' : '#334155' }}>{item.turnoverDays} {isEn ? 'days' : 'วัน'}</p>
                                                </div>
                                            </div>
                                        </td></tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── AI Sales Insights ── */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <div className="flex items-center gap-2 mb-3">
                    <BrainCircuit className="w-5 h-5" style={{ color: '#059669' }} />
                    <h3 className="text-sm font-bold" style={{ color: '#065f46' }}>
                        {isEn ? 'AI Sales & Stock Insights' : 'AI วิเคราะห์ยอดขายและสต็อค'}
                    </h3>
                </div>
                <div className="space-y-2 text-xs" style={{ color: '#064e3b' }}>
                    <p>
                        <strong>{isEn ? 'Demand Forecast:' : 'คาดการณ์ความต้องการ:'}</strong>{' '}
                        {isEn ? aiInsights.demandForecast : aiInsights.demandForecastTh}
                    </p>
                    <p>
                        <strong>{isEn ? 'Stock Strategy:' : 'กลยุทธ์สต็อค:'}</strong>{' '}
                        {isEn ? aiInsights.stockStrategy : aiInsights.stockStrategyTh}
                    </p>
                    <p>
                        <strong>{isEn ? 'Revenue Projection:' : 'ประมาณการรายได้:'}</strong>{' '}
                        {isEn ? aiInsights.revenueProjection : aiInsights.revenueProjectionTh}
                    </p>
                </div>
            </div>
        </div>
    );
};

// ── Score Badge Component ──
const ScoreBadge = ({ score, size = 'lg' }) => {
    const color = score >= 90 ? '#059669' : score >= 75 ? '#2563eb' : score >= 60 ? '#d97706' : '#dc2626';
    const bg = score >= 90 ? '#d1fae5' : score >= 75 ? '#dbeafe' : score >= 60 ? '#fef3c7' : '#fee2e2';
    const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Needs Attention' : 'Critical';
    const sz = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'md' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs';
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={`${sz} rounded-full flex items-center justify-center font-bold`} style={{ backgroundColor: bg, color, border: `2px solid ${color}` }}>
                {score}
            </div>
            {size !== 'sm' && <span className="text-[10px] font-medium" style={{ color }}>{label}</span>}
        </div>
    );
};

// ── Finding Card Component ──
const FindingCard = ({ finding, language }) => {
    const [expanded, setExpanded] = useState(false);
    const sev = SEVERITY[finding.severity];
    const SevIcon = sev.icon;
    const isEn = language === 'en';

    return (
        <div className="rounded-lg border transition-all" style={{ backgroundColor: sev.bg, borderColor: sev.color + '30' }}>
            <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3 flex items-start gap-3">
                <SevIcon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: sev.color }} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: sev.color, color: '#fff' }}>
                            {sev.label}
                        </span>
                        <span className="text-xs" style={{ color: '#6b7280' }}>{finding.id}</span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#111827' }}>
                        {isEn ? finding.title : finding.titleTh}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#4b5563' }}>
                        {isEn ? finding.description : finding.descriptionTh}
                    </p>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 shrink-0 mt-1" style={{ color: '#9ca3af' }} /> : <ChevronDown className="w-4 h-4 shrink-0 mt-1" style={{ color: '#9ca3af' }} />}
            </button>

            {expanded && (
                <div className="px-3 pb-3 pt-0 ml-8 space-y-3">
                    {/* Root Cause */}
                    <div className="rounded-md p-2.5" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#dc2626' }}>
                            {isEn ? 'Root Cause Analysis' : 'วิเคราะห์สาเหตุ'}
                        </p>
                        <p className="text-xs" style={{ color: '#374151' }}>
                            {isEn ? finding.rootCause : finding.rootCauseTh}
                        </p>
                    </div>

                    {/* Recommendation */}
                    <div className="rounded-md p-2.5" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#059669' }}>
                            {isEn ? 'AI Recommendation' : 'AI แนะนำ'}
                        </p>
                        <p className="text-xs" style={{ color: '#374151' }}>
                            {isEn ? finding.recommendation : finding.recommendationTh}
                        </p>
                    </div>

                    {/* Data Points */}
                    {finding.data && (
                        <div className="rounded-md p-2.5" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#64748b' }}>
                                {isEn ? 'Data Points' : 'ข้อมูลประกอบ'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(finding.data).map(([key, value]) => (
                                    <span key={key} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e2e8f0', color: '#334155' }}>
                                        <span className="font-medium">{key}:</span>
                                        <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Main AI Analyzer Component ──────────────────────────────────────────────
export default function AIAnalyzer({ language, addToast, activityLogs, inventory, orders, users, invoices, apiConfigs }) {
    const [activeMode, setActiveMode] = useState('operations'); // 'operations' | 'salesForecast'
    const [selectedDimension, setSelectedDimension] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisData, setAnalysisData] = useState(null);
    const [forecastData, setForecastData] = useState(null);

    const isEn = language === 'en';

    // Run AI analysis — requires real data from Odoo
    const runAnalysis = useCallback(() => {
        const hasRealData = (activityLogs?.length > 10) || (orders?.length > 5) || (inventory?.length > 3);
        if (!hasRealData) {
            addToast?.('No data available. Connect Odoo and process orders first.', 'warning');
            return;
        }
        setIsAnalyzing(true);
        setTimeout(() => {
            setAnalysisData(generateMockAnalysis('kob'));
            setForecastData(generateSalesForecast('kob'));
            setIsAnalyzing(false);
            addToast?.('AI Analysis complete', 'success');
        }, 2000);
    }, [addToast, activityLogs, orders, inventory]);

    // All findings flattened
    const allFindings = useMemo(() => {
        if (!analysisData?.dimensions) return [];
        return Object.entries(analysisData.dimensions).flatMap(([dimKey, dim]) =>
            (dim.findings || []).map(f => ({ ...f, dimension: dimKey }))
        );
    }, [analysisData]);

    // Filtered findings
    const filteredFindings = useMemo(() => {
        return allFindings.filter(f => {
            if (selectedDimension !== 'all' && f.dimension !== selectedDimension) return false;
            if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
            return true;
        });
    }, [allFindings, selectedDimension, severityFilter]);

    // Summary stats
    const stats = useMemo(() => {
        const bySeverity = {};
        allFindings.forEach(f => { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
        return bySeverity;
    }, [allFindings]);

    const company = getCompany('kob');

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${company.color}15, ${company.color}05)`, border: `1px solid ${company.color}30` }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: company.color + '20' }}>
                            <BrainCircuit className="w-7 h-7" style={{ color: company.color }} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold" style={{ color: '#111827' }}>
                                WMS AI Analyzer
                            </h2>
                            <p className="text-sm" style={{ color: '#6b7280' }}>
                                {isEn ? 'E-commerce — Real-time 360° Variance Analysis' : 'E-commerce — วิเคราะห์ผลต่าง 360° แบบเรียลไทม์'}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>
                                {isEn ? 'Last analysis' : 'วิเคราะห์ล่าสุด'}: {analysisData?.generatedAt ? new Date(analysisData.generatedAt).toLocaleString() : '—'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <ScoreBadge score={analysisData?.overallScore || 0} />
                        <button
                            onClick={runAnalysis}
                            disabled={isAnalyzing}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                            style={{ backgroundColor: company.color, opacity: isAnalyzing ? 0.6 : 1 }}
                        >
                            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                            {isAnalyzing ? (isEn ? 'Analyzing...' : 'กำลังวิเคราะห์...') : (isEn ? 'Run Analysis' : 'เริ่มวิเคราะห์')}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Mode Tabs ── */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: '#f3f4f6' }}>
                {[
                    { key: 'operations', label: isEn ? 'Operations Analysis' : 'วิเคราะห์ปฏิบัติการ', icon: ShieldAlert },
                    { key: 'salesForecast', label: isEn ? 'Sales Forecast & Stock 360°' : 'พยากรณ์ยอดขาย & สต็อค 360°', icon: TrendingUp },
                ].map(tab => {
                    const TabIcon = tab.icon;
                    return (
                        <button key={tab.key}
                            onClick={() => setActiveMode(tab.key)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all"
                            style={{
                                backgroundColor: activeMode === tab.key ? '#ffffff' : 'transparent',
                                color: activeMode === tab.key ? company.color : '#6b7280',
                                boxShadow: activeMode === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>
                            <TabIcon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Sales Forecast Mode ── */}
            {activeMode === 'salesForecast' && (
                <SalesForecastPanel forecastData={forecastData} language={language} company={company} />
            )}

            {/* ── Operations Mode ── */}
            {activeMode === 'operations' && <>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {[
                    { label: isEn ? 'Total Findings' : 'พบทั้งหมด', value: allFindings.length, color: '#6b7280', bg: '#f9fafb' },
                    { label: 'Critical', value: stats.critical || 0, color: '#dc2626', bg: '#fef2f2' },
                    { label: 'High', value: stats.high || 0, color: '#ea580c', bg: '#fff7ed' },
                    { label: 'Medium', value: stats.medium || 0, color: '#d97706', bg: '#fffbeb' },
                    { label: isEn ? 'Low / Info' : 'ต่ำ / ทั่วไป', value: (stats.low || 0) + (stats.info || 0), color: '#2563eb', bg: '#eff6ff' },
                ].map(card => (
                    <div key={card.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: card.bg, border: `1px solid ${card.color}20` }}>
                        <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-[11px] font-medium" style={{ color: card.color }}>{card.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Dimension Scores ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DIMENSIONS.map(dim => {
                    const dimData = analysisData?.dimensions?.[dim.key];
                    const DimIcon = dim.icon;
                    const isSelected = selectedDimension === dim.key;
                    return (
                        <button
                            key={dim.key}
                            onClick={() => setSelectedDimension(prev => prev === dim.key ? 'all' : dim.key)}
                            className="rounded-lg p-3 text-left transition-all"
                            style={{
                                backgroundColor: isSelected ? dim.color + '15' : '#ffffff',
                                border: `1.5px solid ${isSelected ? dim.color : '#e5e7eb'}`,
                                boxShadow: isSelected ? `0 0 0 2px ${dim.color}30` : 'none',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <DimIcon className="w-4 h-4" style={{ color: dim.color }} />
                                <span className="text-xs font-semibold" style={{ color: '#374151' }}>
                                    {isEn ? dim.label : dim.labelTh}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <ScoreBadge score={dimData?.score || 0} size="sm" />
                                <span className="text-[10px]" style={{ color: '#9ca3af' }}>
                                    {dimData?.findings?.length || 0} {isEn ? 'findings' : 'รายการ'}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Filters ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4" style={{ color: '#6b7280' }} />
                    <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{isEn ? 'Severity:' : 'ความรุนแรง:'}</span>
                </div>
                {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
                    <button
                        key={sev}
                        onClick={() => setSeverityFilter(sev)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
                        style={{
                            backgroundColor: severityFilter === sev ? (sev === 'all' ? '#374151' : SEVERITY[sev]?.color || '#374151') : '#f3f4f6',
                            color: severityFilter === sev ? '#fff' : '#6b7280',
                        }}
                    >
                        {sev === 'all' ? (isEn ? 'All' : 'ทั้งหมด') : SEVERITY[sev]?.label || sev}
                        {sev !== 'all' && ` (${stats[sev] || 0})`}
                    </button>
                ))}
                <div className="ml-auto">
                    <button
                        onClick={() => {
                            const csv = ['ID,Severity,Dimension,Title,Root Cause,Recommendation'];
                            filteredFindings.forEach(f => {
                                csv.push(`${f.id},${f.severity},${f.dimension},"${f.title}","${f.rootCause}","${f.recommendation}"`);
                            });
                            const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `ai-analysis-${company.code}-${analysisData?.period || 'report'}.csv`;
                            a.click(); URL.revokeObjectURL(url);
                            addToast?.('Report exported as CSV', 'success');
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {isEn ? 'Export CSV' : 'ส่งออก CSV'}
                    </button>
                </div>
            </div>

            {/* ── Findings List ── */}
            <div className="space-y-2">
                {filteredFindings.length === 0 ? (
                    <div className="text-center py-12 rounded-lg" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: '#10b981' }} />
                        <p className="text-sm font-medium" style={{ color: '#374151' }}>
                            {isEn ? 'No findings match your filter' : 'ไม่พบรายการตามตัวกรอง'}
                        </p>
                    </div>
                ) : (
                    filteredFindings.map(finding => (
                        <FindingCard key={finding.id} finding={finding} language={language} />
                    ))
                )}
            </div>

            {/* ── AI Insights Summary ── */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                <div className="flex items-center gap-2 mb-3">
                    <BrainCircuit className="w-5 h-5" style={{ color: '#7c3aed' }} />
                    <h3 className="text-sm font-bold" style={{ color: '#5b21b6' }}>
                        {isEn ? 'AI Executive Summary' : 'AI สรุปผู้บริหาร'}
                    </h3>
                </div>
                <div className="space-y-2 text-xs" style={{ color: '#4c1d95' }}>
                    <p>
                        <strong>{isEn ? 'Top Priority:' : 'เรื่องด่วนที่สุด:'}</strong>{' '}
                        {isEn
                            ? `Resolve ${stats.critical || 0} critical findings immediately — Shopee SLA breach and stock discrepancy on best-seller SKU.`
                            : `แก้ไข ${stats.critical || 0} ปัญหาวิกฤตทันที — SLA Shopee เกินกำหนดและสต็อคไม่ตรงของ SKU ขายดี`}
                    </p>
                    <p>
                        <strong>{isEn ? 'Pattern Detected:' : 'รูปแบบที่พบ:'}</strong>{' '}
                        {isEn
                            ? 'Zone C reorganization on Mar 25 is the root cause of 3 separate issues (pick errors, UPH drop, stock discrepancy). Fixing zone mapping will resolve all 3.'
                            : 'การจัดเรียง Zone C ใหม่วันที่ 25 มี.ค. เป็นสาเหตุหลักของ 3 ปัญหา (หยิบผิด, UPH ลด, สต็อคต่าง) แก้ zone mapping จะแก้ได้ทั้ง 3 ปัญหา'}
                    </p>
                    <p>
                        <strong>{isEn ? 'Quick Win:' : 'ทำได้เลย:'}</strong>{' '}
                        {isEn
                            ? 'Cross-train 2 pickers for pack backup and enable auto-escalation alerts. These two changes alone can prevent 70% of SLA breaches.'
                            : 'ฝึกพนักงานหยิบ 2 คนให้แพ็คได้ + เปิด auto-escalation alert สองสิ่งนี้ป้องกัน SLA เกินกำหนดได้ 70%'}
                    </p>
                    <p>
                        <strong>{isEn ? 'Financial Impact:' : 'ผลกระทบทางการเงิน:'}</strong>{' '}
                        {isEn
                            ? 'Estimated recoverable loss: 248,540 THB (stock discrepancy 38 units + invoice mismatch 12,840 + overdue invoices 234,500 + penalty risk 1,200).'
                            : 'ประมาณการความเสียหายที่กู้คืนได้: 248,540 บาท (สต็อคหาย 38 ชิ้น + ใบแจ้งหนี้ไม่ตรง 12,840 + ค้างชำระ 234,500 + เสี่ยงถูกปรับ 1,200)'}
                    </p>
                </div>
            </div>

            </>}
        </div>
    );
}
