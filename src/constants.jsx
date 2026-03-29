import React from 'react';
import { LayoutDashboard, ShoppingCart, Box, ScanLine, FileText, Truck, Printer, Users, Settings, BookOpen, Smartphone, Monitor, Warehouse, Layers, PackageCheck, Receipt, BarChart2, Trophy, Shield, UserCheck, ClipboardCheck, Clock, Target } from 'lucide-react';
import { PlatformBadge } from './components/PlatformLogo';

export const ITEMS_PER_PAGE = 25;

export const rolesInfo = {
    senior: { label: 'Senior Management', tabs: ['dashboard', 'teamPerformance', 'slaTracker', 'kpiAssessment', 'pick', 'pack', 'handheldPack', 'posPack', 'inventory', 'cycleCount', 'sorting', 'fulfillment', 'platformMonitor', 'invoice', 'scan', 'list', 'dispatch', 'timeAttendance', 'report', 'users', 'settings', 'manual'], icon: <UserCheck />, desc: 'Senior Management — Full Access + Strategic' },
    admin: { label: 'Administrator', tabs: ['dashboard', 'teamPerformance', 'slaTracker', 'kpiAssessment', 'pick', 'pack', 'handheldPack', 'posPack', 'inventory', 'cycleCount', 'sorting', 'fulfillment', 'platformMonitor', 'invoice', 'scan', 'list', 'dispatch', 'timeAttendance', 'report', 'users', 'settings', 'manual'], icon: <LayoutDashboard />, desc: 'Full System Access' },
    picker: { label: 'Picker Specialist', tabs: ['pick', 'cycleCount', 'kpiAssessment', 'timeAttendance', 'sorting', 'manual'], icon: <ShoppingCart />, desc: 'Inventory Picking' },
    packer: { label: 'Packer & QC', tabs: ['pack', 'handheldPack', 'posPack', 'kpiAssessment', 'timeAttendance', 'fulfillment', 'manual'], icon: <Box />, desc: 'Packing & Validation' },
    outbound: { label: 'Outbound Ops', tabs: ['scan', 'list', 'dispatch', 'kpiAssessment', 'timeAttendance', 'report', 'manual'], icon: <ScanLine />, desc: 'Scanning & Logistics' },
    // accounting: HOLD — will be added later
    // accounting: { label: 'Accounting', tabs: ['dashboard', 'invoice', 'kpiAssessment', 'timeAttendance', 'report', 'manual'], icon: <Receipt />, desc: 'Invoices & Finance' }
};

// ── OKR Grading ──
export const OKR_GRADES = [
    { grade: 'S', label: 'Outstanding', min: 110, color: '#7c3aed', bg: '#ede9fe' },
    { grade: 'A', label: 'Excellent', min: 90, color: '#059669', bg: '#d1fae5' },
    { grade: 'B', label: 'Good', min: 75, color: '#2563eb', bg: '#dbeafe' },
    { grade: 'C', label: 'Needs Improvement', min: 60, color: '#d97706', bg: '#fef3c7' },
    { grade: 'D', label: 'Below Standard', min: 0, color: '#dc2626', bg: '#fee2e2' },
];
export const getOkrGrade = (score) => OKR_GRADES.find(g => score >= g.min) || OKR_GRADES[OKR_GRADES.length - 1];

// ── Helpers for compute functions ──
const _pickActions = ['pick'];
const _packActions = ['pack', 'pack-handheld', 'pack-pos'];
const _awbActions = ['awb_confirm', 'awb-confirm-pos'];
const _scanActions = ['scan'];
const _dispatchActions = ['dispatch'];
const _boxActions = ['box-handheld', 'box-pos'];
const _invoiceActions = ['create-so-odoo', 'import'];

const _countActions = (logs, actions) => logs.filter(l => actions.includes(l.action)).length;
const _workerUPH = (logs, actions) => {
    const filtered = logs.filter(l => actions.includes(l.action));
    if (filtered.length < 2) return filtered.length;
    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
    let hours = (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 3600000;
    if (hours < 0.1) hours = 0.1;
    return Math.round(filtered.length / hours);
};

// ── OKR Config per Role ──
export const ROLE_KPI_CONFIG = {
    picker: {
        label: 'Picker', targetUPH: 60, color: '#3b82f6',
        objective: 'หยิบสินค้าได้รวดเร็วและแม่นยำ พร้อมนับสต็อคตามที่ได้รับมอบหมาย',
        objectiveEn: 'Pick items quickly and accurately, complete assigned cycle counts',
        keyResults: [
            { key: 'uph', label: 'Pick UPH', weight: 0.20, target: 60, unit: 'UPH',
              compute: (logs) => _workerUPH(logs, _pickActions) },
            { key: 'accuracy', label: 'Pick Accuracy', weight: 0.20, target: 99, unit: '%',
              compute: (logs) => { const total = _countActions(logs, _pickActions); return total > 0 ? Math.round(((total - _countActions(logs, ['pick-error'])) / total) * 100 * 10) / 10 : 100; } },
            { key: 'sla', label: 'SLA Compliance', weight: 0.15, target: 95, unit: '%',
              compute: (logs, orders) => { const picked = orders.filter(o => o.status !== 'pending'); const onTime = picked.filter(o => { const age = o.pickedAt && o.createdAt ? (new Date(o.pickedAt) - new Date(o.createdAt)) / 60000 : 60; return age <= 120; }); return picked.length > 0 ? Math.round((onTime.length / picked.length) * 100) : 100; } },
            { key: 'countCompliance', label: 'Count Compliance', weight: 0.10, target: 100, unit: '%',
              compute: (logs) => {
                  // % of assigned cycle count tasks completed today
                  // Read from localStorage for assigned count, use logs for completed
                  const countLogs = logs.filter(l => l.action === 'cycle-count');
                  const today = new Date().toISOString().split('T')[0];
                  const todayCounts = countLogs.filter(l => new Date(l.timestamp).toISOString().split('T')[0] === today);
                  // Estimate assigned tasks from wms_cycle_counts config (fallback: if any count done, assume compliance)
                  try {
                      const records = JSON.parse(localStorage.getItem('wms_cycle_counts') || '[]');
                      const myToday = records.filter(r => r.date === today && r.countedBy === logs[0]?.username);
                      // Get total assigned from fair assignment (stored per picker)
                      // Approximate: use total daily tasks / number of pickers, min 1
                      const allToday = records.filter(r => r.date === today);
                      const uniqueCounters = new Set(allToday.map(r => r.countedBy));
                      const avgPerPicker = uniqueCounters.size > 0 ? Math.ceil(allToday.length / uniqueCounters.size) : 4;
                      const assigned = Math.max(avgPerPicker, 1);
                      return myToday.length > 0 ? Math.min(Math.round((myToday.length / assigned) * 100), 100) : 0;
                  } catch { return todayCounts.length > 0 ? 100 : 0; }
              } },
            { key: 'countAccuracy', label: 'Count Accuracy', weight: 0.10, target: 95, unit: '%',
              compute: (logs) => {
                  // % of cycle counts where counted qty matched system qty
                  const countLogs = logs.filter(l => l.action === 'cycle-count');
                  if (countLogs.length === 0) return 0;
                  const matches = countLogs.filter(l => l.details?.match === true).length;
                  return Math.round((matches / countLogs.length) * 100);
              } },
            { key: 'multiZone', label: 'Multi-zone Efficiency', weight: 0.10, target: 3, unit: 'zones',
              compute: (logs) => { const zones = new Set(logs.filter(l => l.action === 'pick').map(l => l.details?.zone || l.details?.sku?.charAt(0) || 'A')); return zones.size; } },
            { key: 'difficulty', label: 'Task Difficulty', weight: 0.05, target: 2.0, unit: 'avg tier',
              compute: (logs, orders) => { const handled = orders.filter(o => o.status !== 'pending'); if (!handled.length) return 1.0; const avg = handled.reduce((s, o) => s + Math.min((o.items?.length || 1) / 3, 5), 0) / handled.length; return Math.round(avg * 10) / 10; } },
            { key: 'attendanceRate', label: 'Attendance Rate', weight: 0.10, target: 95, unit: '%',
              compute: (logs) => {
                  try {
                      const records = JSON.parse(localStorage.getItem('wms_attendance') || '[]');
                      const username = logs[0]?.username;
                      if (!username || records.length === 0) return 100;
                      const myRecords = records.filter(r => r.username === username);
                      if (myRecords.length === 0) return 100;
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                      const monthRecords = myRecords.filter(r => new Date(r.date) >= monthStart);
                      if (monthRecords.length === 0) return 100;
                      const onTime = monthRecords.filter(r => r.status === 'present' || r.status === 'late').length;
                      return Math.round((onTime / monthRecords.length) * 100);
                  } catch { return 100; }
              } },
        ],
    },
    packer: {
        label: 'Packer', targetUPH: 45, color: '#10b981',
        objective: 'แพ็คสินค้าถูกต้องครบถ้วนทันเวลา',
        objectiveEn: 'Pack items correctly and on time',
        keyResults: [
            { key: 'uph', label: 'Pack UPH', weight: 0.25, target: 45, unit: 'UPH',
              compute: (logs) => _workerUPH(logs, _packActions) },
            { key: 'awbVerify', label: 'AWB Verify Rate', weight: 0.25, target: 100, unit: '%',
              compute: (logs) => { const packs = _countActions(logs, _packActions); const awbs = _countActions(logs, _awbActions); return packs > 0 ? Math.round((awbs / packs) * 100) : 0; } },
            { key: 'sla', label: 'SLA Compliance', weight: 0.20, target: 95, unit: '%',
              compute: (logs, orders) => { const packed = orders.filter(o => ['packed', 'rts', 'shipped', 'dispatched'].includes(o.status)); const onTime = packed.filter(o => { const age = o.packedAt && o.pickedAt ? (new Date(o.packedAt) - new Date(o.pickedAt)) / 60000 : 30; return age <= 60; }); return packed.length > 0 ? Math.round((onTime.length / packed.length) * 100) : 100; } },
            { key: 'boxEfficiency', label: 'Box Efficiency', weight: 0.15, target: 95, unit: '%',
              compute: (logs) => { const boxes = _countActions(logs, _boxActions); const packs = _countActions(logs, _packActions); if (packs === 0) return 100; const ratio = boxes / packs; return ratio <= 1.1 ? 100 : Math.max(0, Math.round((1 / ratio) * 100)); } },
            { key: 'zeroDefect', label: 'Zero Defect Rate', weight: 0.15, target: 100, unit: '%',
              compute: (logs) => { const total = _countActions(logs, _packActions); const errors = _countActions(logs, ['pack-error', 'pack-pos-adjust']); return total > 0 ? Math.round(((total - errors) / total) * 100) : 100; } },
        ],
    },
    outbound: {
        label: 'Outbound', targetUPH: 55, color: '#f59e0b',
        objective: 'สแกนจ่ายครบถ้วนส่งมอบตรงเวลา',
        objectiveEn: 'Scan and dispatch accurately on time',
        keyResults: [
            { key: 'uph', label: 'Scan UPH', weight: 0.25, target: 55, unit: 'UPH',
              compute: (logs) => _workerUPH(logs, _scanActions) },
            { key: 'scanAccuracy', label: 'Scan Accuracy', weight: 0.25, target: 99.5, unit: '%',
              compute: (logs) => { const total = _countActions(logs, _scanActions); const errors = logs.filter(l => l.action === 'scan' && l.details?.mismatch).length; return total > 0 ? Math.round(((total - errors) / total) * 1000) / 10 : 100; } },
            { key: 'manifestRate', label: 'Manifest Complete', weight: 0.20, target: 100, unit: '%',
              compute: (logs) => { const dispatches = _countActions(logs, _dispatchActions); return dispatches > 0 ? 100 : 0; } },
            { key: 'dispatchOnTime', label: 'Dispatch On-Time', weight: 0.20, target: 95, unit: '%',
              compute: (logs, orders) => { const rts = orders.filter(o => ['rts', 'shipped', 'dispatched'].includes(o.status)); const onTime = rts.filter(o => { const age = o.createdAt ? (Date.now() - new Date(o.createdAt).getTime()) / 60000 : 120; return age <= 240; }); return rts.length > 0 ? Math.round((onTime.length / rts.length) * 100) : 100; } },
            { key: 'courierSort', label: 'Courier Sort Accuracy', weight: 0.10, target: 100, unit: '%',
              compute: (logs) => { const scans = _countActions(logs, _scanActions); const sortErrors = logs.filter(l => l.action === 'scan' && l.details?.wrongBin).length; return scans > 0 ? Math.round(((scans - sortErrors) / scans) * 100) : 100; } },
        ],
    },
    accounting: {
        label: 'Accounting', targetUPH: null, color: '#8b5cf6',
        objective: 'ออกใบแจ้งหนี้ถูกต้องทันเวลา',
        objectiveEn: 'Process invoices accurately and promptly',
        keyResults: [
            { key: 'invoiceCount', label: 'Invoices / Day', weight: 0.30, target: 50, unit: 'inv',
              compute: (logs) => _countActions(logs, _invoiceActions) },
            { key: 'invoiceAccuracy', label: 'Invoice Accuracy', weight: 0.30, target: 100, unit: '%',
              compute: () => 100 },
            { key: 'sameDayRate', label: 'Same-Day Invoice', weight: 0.25, target: 95, unit: '%',
              compute: (logs) => { const total = _countActions(logs, _invoiceActions); return total > 0 ? 95 : 0; } },
            { key: 'importEfficiency', label: 'Import Efficiency', weight: 0.15, target: 20, unit: 'batches',
              compute: (logs) => logs.filter(l => l.action === 'import').length },
        ],
    },
    admin: {
        label: 'Admin', targetUPH: 50, color: '#714B67',
        objective: 'บริหารคลังสินค้าได้ประสิทธิภาพ',
        objectiveEn: 'Manage warehouse operations efficiently',
        keyResults: [
            { key: 'teamUph', label: 'Team Avg UPH', weight: 0.25, target: 50, unit: 'UPH',
              compute: (logs) => { const all = _countActions(logs, [..._pickActions, ..._packActions, ..._scanActions]); const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp); let hours = sorted.length > 1 ? (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 3600000 : 0.1; if (hours < 0.1) hours = 0.1; return Math.round(all / hours); } },
            { key: 'overallSla', label: 'Overall SLA', weight: 0.25, target: 90, unit: '%',
              compute: (logs, orders) => { const total = orders.length; if (!total) return 100; const breached = orders.filter(o => o.status === 'pending' && o.createdAt && (Date.now() - new Date(o.createdAt).getTime()) > 7200000).length; return Math.round(((total - breached) / total) * 100); } },
            { key: 'fulfillment', label: 'Fulfillment Rate', weight: 0.25, target: 85, unit: '%',
              compute: (logs, orders) => { const total = orders.length; const done = orders.filter(o => ['rts', 'shipped', 'dispatched'].includes(o.status)).length; return total > 0 ? Math.round((done / total) * 100) : 0; } },
            { key: 'teamCoverage', label: 'Team Coverage', weight: 0.25, target: 5, unit: 'workers',
              compute: (logs) => new Set(logs.map(l => l.username)).size },
        ],
    },
    senior: {
        label: 'Senior Management', targetUPH: null, color: '#0f172a',
        objective: 'บริหารเชิงกลยุทธ์และพัฒนาองค์กร',
        objectiveEn: 'Strategic management and organizational development',
        keyResults: [
            { key: 'overallSla', label: 'Overall SLA', weight: 0.20, target: 95, unit: '%',
              compute: (logs, orders) => { const total = orders.length; if (!total) return 100; const breached = orders.filter(o => o.status === 'pending' && o.createdAt && (Date.now() - new Date(o.createdAt).getTime()) > 7200000).length; return Math.round(((total - breached) / total) * 100); } },
            { key: 'fulfillment', label: 'Fulfillment Rate', weight: 0.20, target: 90, unit: '%',
              compute: (logs, orders) => { const total = orders.length; const done = orders.filter(o => ['rts', 'shipped', 'dispatched'].includes(o.status)).length; return total > 0 ? Math.round((done / total) * 100) : 0; } },
            { key: 'teamUph', label: 'Team Avg UPH', weight: 0.20, target: 55, unit: 'UPH',
              compute: (logs) => { const all = _countActions(logs, [..._pickActions, ..._packActions, ..._scanActions]); const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp); let hours = sorted.length > 1 ? (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 3600000 : 0.1; if (hours < 0.1) hours = 0.1; return Math.round(all / hours); } },
            { key: 'teamCoverage', label: 'Team Coverage', weight: 0.20, target: 8, unit: 'workers',
              compute: (logs) => new Set(logs.map(l => l.username)).size },
            { key: 'revenueGrowth', label: 'Revenue Growth', weight: 0.20, target: 10, unit: '%',
              compute: () => 0 },
        ],
    },
};

// ── KPI Assessment — Approval Chain ──
export const APPROVAL_CHAIN = [
    { level: 0, role: 'employee', label: 'Employee', labelTh: 'พนักงาน' },
    { level: 1, role: 'asst', label: 'Asst. Manager', labelTh: 'ผู้ช่วยผู้จัดการ' },
    { level: 2, role: 'manager', label: 'Manager', labelTh: 'ผู้จัดการ' },
    { level: 3, role: 'improvement', label: 'Improvement', labelTh: 'ปรับปรุง' },
    { level: 4, role: 'director', label: 'Director', labelTh: 'ผู้อำนวยการ' },
    { level: 5, role: 'md', label: 'MD', labelTh: 'กรรมการผู้จัดการ' },
];

export const CORE_VALUES = [
    { key: 'teamwork', label: 'Teamwork', labelTh: 'การทำงานเป็นทีม' },
    { key: 'integrity', label: 'Integrity', labelTh: 'ความซื่อสัตย์' },
    { key: 'ownership', label: 'Ownership', labelTh: 'ความเป็นเจ้าของ' },
    { key: 'innovation', label: 'Innovation', labelTh: 'ความคิดสร้างสรรค์' },
    { key: 'customerFocus', label: 'Customer Focus', labelTh: 'มุ่งเน้นลูกค้า' },
];

// ── KPI Pillars (8 Pillar Structure) ──
export const KPI_PILLARS = [
  { id: 1, key: 'developPeople',    label: 'Develop Our People',                           labelTh: 'พัฒนาบุคลากร',         color: '#3b82f6', icon: 'Users' },
  { id: 2, key: 'driveValue',       label: 'Drive Value for Clients',                      labelTh: 'สร้างคุณค่าให้ลูกค้า',    color: '#10b981', icon: 'Heart' },
  { id: 3, key: 'makeRevenue',      label: 'Make Revenue at Omnichannel & Strategic Partnership', labelTh: 'สร้างรายได้', color: '#f59e0b', icon: 'TrendingUp' },
  { id: 4, key: 'championProgress', label: 'Champion Progress & Digitization',             labelTh: 'ขับเคลื่อนดิจิทัล',      color: '#8b5cf6', icon: 'Zap' },
  { id: 5, key: 'deliverFinancial', label: 'Deliver Financial Results',                    labelTh: 'ผลลัพธ์ทางการเงิน',     color: '#ef4444', icon: 'DollarSign' },
  { id: 6, key: 'manageRisk',       label: 'Manage Corporate & Compliance Risk',           labelTh: 'บริหารความเสี่ยง',       color: '#06b6d4', icon: 'Shield' },
  { id: 7, key: 'liveValues',       label: 'Live Our Values',                              labelTh: 'ค่านิยมองค์กร',          color: '#f97316', icon: 'Star', is360: true },
  { id: 8, key: 'goAboveBeyond',    label: 'Go Above and Beyond',                          labelTh: 'ทำเหนือความคาดหวัง',    color: '#ec4899', icon: 'Award' },
];

// ── Auto KPI Compute Registry (maps autoKey → compute function) ──
// Reuses existing compute functions from ROLE_KPI_CONFIG
export const AUTO_KPI_REGISTRY = {};
Object.entries(ROLE_KPI_CONFIG).forEach(([role, config]) => {
  (config.keyResults || []).forEach(kr => {
    AUTO_KPI_REGISTRY[`${kr.key}_${role}`] = kr.compute;
    if (!AUTO_KPI_REGISTRY[kr.key]) AUTO_KPI_REGISTRY[kr.key] = kr.compute;
  });
});

// ── Default Pillar Templates per Role ──
// Admin can customize via UI; these are the shipped defaults
// weight = pillar weight (% of total 100), kpiWeight = within-pillar % summing to 100
export const DEFAULT_PILLAR_TEMPLATES = {
  picker: [
    { pillarKey: 'developPeople', weight: 45, kpis: [
      { id: 'pk-p1-attend',  label: 'Attendance Rate', labelTh: 'อัตราการเข้างาน', source: 'auto', autoKey: 'attendanceRate', kpiWeight: 22,
        rubric: { 1: 'Absent >5 days/month', 2: 'Absent 3-5 days', 3: 'Absent 1-2 days, mostly on time', 4: 'Near-perfect attendance', 5: 'Perfect attendance, always early, covers for others' } },
      { id: 'pk-p1-uph',     label: 'Pick UPH', labelTh: 'ความเร็วหยิบสินค้า', source: 'auto', autoKey: 'uph', kpiWeight: 22,
        rubric: { 1: '<30 UPH', 2: '30-44 UPH', 3: '45-59 UPH (meets target)', 4: '60-74 UPH (exceeds)', 5: '75+ UPH (outstanding)' } },
      { id: 'pk-p1-acc',     label: 'Pick Accuracy', labelTh: 'ความแม่นยำในการหยิบ', source: 'auto', autoKey: 'accuracy', kpiWeight: 22,
        rubric: { 1: '<90% accuracy', 2: '90-94%', 3: '95-97%', 4: '98-99%', 5: '99.5%+ (near perfect)' } },
      { id: 'pk-p1-train',   label: 'Training Completion', labelTh: 'เข้าร่วมการอบรม', source: 'manual', kpiWeight: 12,
        rubric: { 1: 'No training attended', 2: 'Attended some', 3: 'Attended all required', 4: 'Attended all + applied to work', 5: 'Attended all, applied effectively, mentors others' } },
      { id: 'pk-p1-equip',   label: 'Equipment Care', labelTh: 'ดูแลอุปกรณ์', source: 'manual', kpiWeight: 22,
        rubric: { 1: 'Never checks equipment', 2: 'Checks sometimes, equipment breaks often', 3: 'Regular checks, equipment always ready', 4: 'Proactive maintenance, prevents damage', 5: 'Proactive + suggests improvements, equipment always optimal' } },
    ]},
    { pillarKey: 'driveValue', weight: 10, kpis: [
      { id: 'pk-p2-sla',     label: 'SLA Compliance', labelTh: 'ตรงเวลาตาม SLA', source: 'auto', autoKey: 'sla', kpiWeight: 60,
        rubric: { 1: '<70% on-time', 2: '70-79%', 3: '80-89%', 4: '90-95%', 5: '96%+ (outstanding)' } },
      { id: 'pk-p2-quality',  label: 'Order Quality', labelTh: 'คุณภาพออเดอร์', source: 'manual', kpiWeight: 40,
        rubric: { 1: 'Frequent complaints', 2: 'Some complaints', 3: 'Meets quality standards', 4: 'Exceeds quality standards', 5: 'Zero complaints, proactive quality improvement' } },
    ]},
    { pillarKey: 'makeRevenue', weight: 0, kpis: [] },
    { pillarKey: 'championProgress', weight: 10, kpis: [
      { id: 'pk-p4-digital',  label: 'System Adoption', labelTh: 'การใช้ระบบดิจิทัล', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'Cannot use systems', 2: 'Uses basic functions only', 3: 'Uses all required features', 4: 'Efficient system user, helps others', 5: 'Power user, suggests improvements' } },
    ]},
    { pillarKey: 'deliverFinancial', weight: 10, kpis: [
      { id: 'pk-p5-ebitda',   label: 'EBITDA', labelTh: 'ผลกำไร EBITDA', source: 'md', kpiWeight: 100,
        rubric: { 1: 'Significantly below target', 2: 'Below target', 3: 'Meets target', 4: 'Above target', 5: 'Significantly above target' } },
    ]},
    { pillarKey: 'manageRisk', weight: 10, kpis: [
      { id: 'pk-p6-sop',      label: 'SOP Compliance', labelTh: 'ปฏิบัติตาม SOP', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'Does not follow SOP', 2: 'Follows sometimes', 3: 'Follows consistently', 4: 'Follows + verifies correctness', 5: 'Follows + improves SOP, trains others' } },
      { id: 'pk-p6-inv',      label: 'Inventory Accuracy', labelTh: 'ความถูกต้องสต็อค', source: 'auto', autoKey: 'countAccuracy', kpiWeight: 50,
        rubric: { 1: '<80% count accuracy', 2: '80-89%', 3: '90-94%', 4: '95-98%', 5: '99%+ accuracy' } },
    ]},
    { pillarKey: 'liveValues', weight: 10, kpis: [
      { id: 'pk-p7-team',   label: 'Teamwork', labelTh: 'การทำงานเป็นทีม', source: '360', kpiWeight: 25, rubric: { 1: 'Works in isolation', 2: 'Cooperates when asked', 3: 'Good team player', 4: 'Actively supports team', 5: 'Inspires team, resolves conflicts' } },
      { id: 'pk-p7-integ',  label: 'Integrity', labelTh: 'ความซื่อสัตย์', source: '360', kpiWeight: 25, rubric: { 1: 'Dishonest behavior', 2: 'Sometimes cuts corners', 3: 'Honest and reliable', 4: 'Highly trustworthy', 5: 'Role model for integrity' } },
      { id: 'pk-p7-own',    label: 'Ownership', labelTh: 'ความเป็นเจ้าของ', source: '360', kpiWeight: 25, rubric: { 1: 'Avoids responsibility', 2: 'Does minimum required', 3: 'Takes ownership of tasks', 4: 'Goes beyond assigned duties', 5: 'Full ownership, drives results' } },
      { id: 'pk-p7-innov',  label: 'Innovation', labelTh: 'ความคิดสร้างสรรค์', source: '360', kpiWeight: 25, rubric: { 1: 'Resists change', 2: 'Accepts change passively', 3: 'Suggests improvements', 4: 'Implements improvements', 5: 'Drives innovation, transforms processes' } },
    ]},
    { pillarKey: 'goAboveBeyond', weight: 5, kpis: [
      { id: 'pk-p8-initiative', label: 'Initiative & Commitment', labelTh: 'ความคิดริเริ่มและความมุ่งมั่น', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'No initiative', 2: 'Occasionally shows initiative', 3: 'Regularly shows initiative', 4: 'Exceptional initiative and perseverance', 5: 'Inspires others, learns from mistakes, creates new opportunities' } },
    ]},
  ],
  packer: [
    { pillarKey: 'developPeople', weight: 45, kpis: [
      { id: 'pa-p1-attend', label: 'Attendance Rate', labelTh: 'อัตราการเข้างาน', source: 'auto', autoKey: 'attendanceRate', kpiWeight: 20,
        rubric: { 1: 'Absent >5 days/month', 2: 'Absent 3-5 days', 3: 'Absent 1-2 days', 4: 'Near-perfect', 5: 'Perfect, always early' } },
      { id: 'pa-p1-uph',    label: 'Pack UPH', labelTh: 'ความเร็วแพ็ค', source: 'auto', autoKey: 'uph', kpiWeight: 25,
        rubric: { 1: '<20 UPH', 2: '20-29 UPH', 3: '30-44 UPH', 4: '45-55 UPH', 5: '56+ UPH' } },
      { id: 'pa-p1-awb',    label: 'AWB Verify Rate', labelTh: 'อัตราตรวจ AWB', source: 'auto', autoKey: 'awbVerify', kpiWeight: 20,
        rubric: { 1: '<80% verified', 2: '80-89%', 3: '90-95%', 4: '96-99%', 5: '100% verified' } },
      { id: 'pa-p1-train',  label: 'Training', labelTh: 'การอบรม', source: 'manual', kpiWeight: 15,
        rubric: { 1: 'No training', 2: 'Some training', 3: 'All required', 4: 'All + applied', 5: 'All + mentors others' } },
      { id: 'pa-p1-equip',  label: 'Equipment Care', labelTh: 'ดูแลอุปกรณ์', source: 'manual', kpiWeight: 20,
        rubric: { 1: 'Never checks', 2: 'Checks sometimes', 3: 'Regular checks', 4: 'Proactive care', 5: 'Proactive + suggests improvements' } },
    ]},
    { pillarKey: 'driveValue', weight: 10, kpis: [
      { id: 'pa-p2-quality', label: 'Pack Quality (Zero Defect)', labelTh: 'คุณภาพการแพ็ค', source: 'auto', autoKey: 'zeroDefect', kpiWeight: 60,
        rubric: { 1: '<90%', 2: '90-94%', 3: '95-97%', 4: '98-99%', 5: '100%' } },
      { id: 'pa-p2-box',    label: 'Box Efficiency', labelTh: 'ประสิทธิภาพกล่อง', source: 'auto', autoKey: 'boxEfficiency', kpiWeight: 40,
        rubric: { 1: 'Wastes materials', 2: 'Some waste', 3: 'Efficient', 4: 'Very efficient', 5: 'Optimal, reduces costs' } },
    ]},
    { pillarKey: 'makeRevenue', weight: 0, kpis: [] },
    { pillarKey: 'championProgress', weight: 10, kpis: [
      { id: 'pa-p4-digital', label: 'System Adoption', labelTh: 'การใช้ระบบ', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'Cannot use', 2: 'Basic only', 3: 'All features', 4: 'Efficient + helps', 5: 'Power user + improves' } },
    ]},
    { pillarKey: 'deliverFinancial', weight: 10, kpis: [
      { id: 'pa-p5-ebitda', label: 'EBITDA', labelTh: 'ผลกำไร EBITDA', source: 'md', kpiWeight: 100,
        rubric: { 1: 'Far below target', 2: 'Below', 3: 'Meets', 4: 'Above', 5: 'Far above' } },
    ]},
    { pillarKey: 'manageRisk', weight: 10, kpis: [
      { id: 'pa-p6-sop', label: 'SOP Compliance', labelTh: 'ปฏิบัติตาม SOP', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'Does not follow', 2: 'Sometimes', 3: 'Consistently', 4: '+ verifies', 5: '+ improves' } },
      { id: 'pa-p6-sla', label: 'SLA Compliance', labelTh: 'ตรงเวลา SLA', source: 'auto', autoKey: 'sla', kpiWeight: 50,
        rubric: { 1: '<70%', 2: '70-79%', 3: '80-89%', 4: '90-95%', 5: '96%+' } },
    ]},
    { pillarKey: 'liveValues', weight: 10, kpis: [
      { id: 'pa-p7-team',  label: 'Teamwork', labelTh: 'ทีมเวิร์ค', source: '360', kpiWeight: 25, rubric: { 1: 'Isolated', 2: 'Cooperates when asked', 3: 'Good player', 4: 'Supports actively', 5: 'Inspires team' } },
      { id: 'pa-p7-integ', label: 'Integrity', labelTh: 'ซื่อสัตย์', source: '360', kpiWeight: 25, rubric: { 1: 'Dishonest', 2: 'Cuts corners', 3: 'Honest', 4: 'Trustworthy', 5: 'Role model' } },
      { id: 'pa-p7-own',   label: 'Ownership', labelTh: 'เป็นเจ้าของ', source: '360', kpiWeight: 25, rubric: { 1: 'Avoids', 2: 'Minimum', 3: 'Takes ownership', 4: 'Beyond assigned', 5: 'Full ownership' } },
      { id: 'pa-p7-innov', label: 'Innovation', labelTh: 'สร้างสรรค์', source: '360', kpiWeight: 25, rubric: { 1: 'Resists', 2: 'Passive', 3: 'Suggests', 4: 'Implements', 5: 'Transforms' } },
    ]},
    { pillarKey: 'goAboveBeyond', weight: 5, kpis: [
      { id: 'pa-p8-init', label: 'Initiative & Commitment', labelTh: 'ริเริ่มและมุ่งมั่น', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'No initiative', 2: 'Occasional', 3: 'Regular', 4: 'Exceptional', 5: 'Inspires others' } },
    ]},
  ],
  outbound: [
    { pillarKey: 'developPeople', weight: 45, kpis: [
      { id: 'ob-p1-attend', label: 'Attendance Rate', labelTh: 'การเข้างาน', source: 'auto', autoKey: 'attendanceRate', kpiWeight: 20,
        rubric: { 1: 'Absent >5 days', 2: '3-5 days', 3: '1-2 days', 4: 'Near-perfect', 5: 'Perfect + early' } },
      { id: 'ob-p1-uph',    label: 'Scan UPH', labelTh: 'ความเร็วสแกน', source: 'auto', autoKey: 'uph', kpiWeight: 25,
        rubric: { 1: '<25 UPH', 2: '25-39', 3: '40-54', 4: '55-65', 5: '66+' } },
      { id: 'ob-p1-acc',    label: 'Scan Accuracy', labelTh: 'ความแม่นยำสแกน', source: 'auto', autoKey: 'scanAccuracy', kpiWeight: 25,
        rubric: { 1: '<90%', 2: '90-94%', 3: '95-97%', 4: '98-99%', 5: '99.5%+' } },
      { id: 'ob-p1-train',  label: 'Training', labelTh: 'การอบรม', source: 'manual', kpiWeight: 15,
        rubric: { 1: 'None', 2: 'Some', 3: 'All required', 4: 'All + applied', 5: 'All + mentors' } },
      { id: 'ob-p1-equip',  label: 'Equipment Care', labelTh: 'ดูแลอุปกรณ์', source: 'manual', kpiWeight: 15,
        rubric: { 1: 'Never checks', 2: 'Sometimes', 3: 'Regular', 4: 'Proactive', 5: 'Proactive + suggests' } },
    ]},
    { pillarKey: 'driveValue', weight: 10, kpis: [
      { id: 'ob-p2-dispatch', label: 'Dispatch On-Time', labelTh: 'จัดส่งตรงเวลา', source: 'auto', autoKey: 'dispatchOnTime', kpiWeight: 60,
        rubric: { 1: '<70%', 2: '70-79%', 3: '80-89%', 4: '90-95%', 5: '96%+' } },
      { id: 'ob-p2-courier', label: 'Courier Sort Accuracy', labelTh: 'แยกขนส่งถูกต้อง', source: 'auto', autoKey: 'courierSort', kpiWeight: 40,
        rubric: { 1: '<85%', 2: '85-89%', 3: '90-95%', 4: '96-99%', 5: '100%' } },
    ]},
    { pillarKey: 'makeRevenue', weight: 0, kpis: [] },
    { pillarKey: 'championProgress', weight: 10, kpis: [
      { id: 'ob-p4-digital', label: 'System Adoption', labelTh: 'การใช้ระบบ', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'Cannot use', 2: 'Basic', 3: 'All features', 4: 'Efficient', 5: 'Power user' } },
    ]},
    { pillarKey: 'deliverFinancial', weight: 10, kpis: [
      { id: 'ob-p5-ebitda', label: 'EBITDA', labelTh: 'EBITDA', source: 'md', kpiWeight: 100,
        rubric: { 1: 'Far below', 2: 'Below', 3: 'Meets', 4: 'Above', 5: 'Far above' } },
    ]},
    { pillarKey: 'manageRisk', weight: 10, kpis: [
      { id: 'ob-p6-manifest', label: 'Manifest Completion', labelTh: 'ใบส่งสินค้าครบ', source: 'auto', autoKey: 'manifestRate', kpiWeight: 50,
        rubric: { 1: '<70%', 2: '70-84%', 3: '85-94%', 4: '95-99%', 5: '100%' } },
      { id: 'ob-p6-sop', label: 'SOP Compliance', labelTh: 'ปฏิบัติตาม SOP', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'Does not follow', 2: 'Sometimes', 3: 'Consistently', 4: '+ verifies', 5: '+ improves' } },
    ]},
    { pillarKey: 'liveValues', weight: 10, kpis: [
      { id: 'ob-p7-team',  label: 'Teamwork', labelTh: 'ทีมเวิร์ค', source: '360', kpiWeight: 25, rubric: { 1: 'Isolated', 2: 'Cooperates when asked', 3: 'Good player', 4: 'Supports', 5: 'Inspires' } },
      { id: 'ob-p7-integ', label: 'Integrity', labelTh: 'ซื่อสัตย์', source: '360', kpiWeight: 25, rubric: { 1: 'Dishonest', 2: 'Cuts corners', 3: 'Honest', 4: 'Trustworthy', 5: 'Role model' } },
      { id: 'ob-p7-own',   label: 'Ownership', labelTh: 'เป็นเจ้าของ', source: '360', kpiWeight: 25, rubric: { 1: 'Avoids', 2: 'Minimum', 3: 'Takes ownership', 4: 'Beyond', 5: 'Full ownership' } },
      { id: 'ob-p7-innov', label: 'Innovation', labelTh: 'สร้างสรรค์', source: '360', kpiWeight: 25, rubric: { 1: 'Resists', 2: 'Passive', 3: 'Suggests', 4: 'Implements', 5: 'Transforms' } },
    ]},
    { pillarKey: 'goAboveBeyond', weight: 5, kpis: [
      { id: 'ob-p8-init', label: 'Initiative & Commitment', labelTh: 'ริเริ่มและมุ่งมั่น', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'No initiative', 2: 'Occasional', 3: 'Regular', 4: 'Exceptional', 5: 'Inspires others' } },
    ]},
  ],
  // ── ACCOUNTING: HOLD — will be added later ──
  // accounting: [ ... ],

  admin: [
    { pillarKey: 'developPeople', weight: 30, kpis: [
      { id: 'ad-p1-attend', label: 'Attendance Rate', labelTh: 'การเข้างาน', source: 'auto', autoKey: 'attendanceRate', kpiWeight: 30,
        rubric: { 1: 'Absent >5 days', 2: '3-5 days', 3: '1-2 days', 4: 'Near-perfect', 5: 'Perfect' } },
      { id: 'ad-p1-team',   label: 'Team Coverage', labelTh: 'ครอบคลุมทีม', source: 'auto', autoKey: 'teamCoverage', kpiWeight: 35,
        rubric: { 1: '<2 workers', 2: '2-3', 3: '4-5', 4: '6-7', 5: '8+ workers' } },
      { id: 'ad-p1-train',  label: 'Team Training', labelTh: 'การอบรมทีม', source: 'manual', kpiWeight: 35,
        rubric: { 1: 'No training planned', 2: 'Some training', 3: 'Regular training', 4: 'Comprehensive program', 5: 'Develops talent pipeline' } },
    ]},
    { pillarKey: 'driveValue', weight: 15, kpis: [
      { id: 'ad-p2-sla', label: 'Overall SLA', labelTh: 'SLA รวม', source: 'auto', autoKey: 'overallSla', kpiWeight: 50,
        rubric: { 1: '<70%', 2: '70-79%', 3: '80-89%', 4: '90-95%', 5: '96%+' } },
      { id: 'ad-p2-fulfill', label: 'Fulfillment Rate', labelTh: 'อัตราจัดส่ง', source: 'auto', autoKey: 'fulfillment', kpiWeight: 50,
        rubric: { 1: '<60%', 2: '60-69%', 3: '70-84%', 4: '85-95%', 5: '96%+' } },
    ]},
    { pillarKey: 'makeRevenue', weight: 5, kpis: [
      { id: 'ad-p3-channel', label: 'Channel Expansion', labelTh: 'ขยายช่องทาง', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'No new channels', 2: '1 channel explored', 3: '1 channel launched', 4: '2+ channels', 5: '3+ channels with growth' } },
    ]},
    { pillarKey: 'championProgress', weight: 10, kpis: [
      { id: 'ad-p4-digital', label: 'Process Digitization', labelTh: 'ปรับเป็นดิจิทัล', source: 'manual', kpiWeight: 100,
        rubric: { 1: '<20% digitized', 2: '20-34%', 3: '35-49%', 4: '50-69%', 5: '70%+ digitized' } },
    ]},
    { pillarKey: 'deliverFinancial', weight: 15, kpis: [
      { id: 'ad-p5-ebitda', label: 'EBITDA', labelTh: 'EBITDA', source: 'md', kpiWeight: 50,
        rubric: { 1: 'Far below', 2: 'Below', 3: 'Meets', 4: 'Above', 5: 'Far above' } },
      { id: 'ad-p5-uph',    label: 'Team Avg UPH', labelTh: 'UPH เฉลี่ยทีม', source: 'auto', autoKey: 'teamUph', kpiWeight: 50,
        rubric: { 1: '<25 UPH', 2: '25-34', 3: '35-49', 4: '50-60', 5: '61+' } },
    ]},
    { pillarKey: 'manageRisk', weight: 10, kpis: [
      { id: 'ad-p6-compliance', label: 'Overall Compliance', labelTh: 'ความสอดคล้อง', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'Major issues', 2: 'Minor issues', 3: 'Compliant', 4: 'Proactive risk mgmt', 5: 'Zero incidents + improves' } },
    ]},
    { pillarKey: 'liveValues', weight: 10, kpis: [
      { id: 'ad-p7-team',  label: 'Teamwork', labelTh: 'ทีมเวิร์ค', source: '360', kpiWeight: 25, rubric: { 1: 'Isolated', 2: 'Cooperates', 3: 'Good player', 4: 'Supports', 5: 'Inspires' } },
      { id: 'ad-p7-integ', label: 'Integrity', labelTh: 'ซื่อสัตย์', source: '360', kpiWeight: 25, rubric: { 1: 'Dishonest', 2: 'Cuts corners', 3: 'Honest', 4: 'Trustworthy', 5: 'Role model' } },
      { id: 'ad-p7-own',   label: 'Ownership', labelTh: 'เป็นเจ้าของ', source: '360', kpiWeight: 25, rubric: { 1: 'Avoids', 2: 'Minimum', 3: 'Takes ownership', 4: 'Beyond', 5: 'Full ownership' } },
      { id: 'ad-p7-innov', label: 'Innovation', labelTh: 'สร้างสรรค์', source: '360', kpiWeight: 25, rubric: { 1: 'Resists', 2: 'Passive', 3: 'Suggests', 4: 'Implements', 5: 'Transforms' } },
    ]},
    { pillarKey: 'goAboveBeyond', weight: 5, kpis: [
      { id: 'ad-p8-init', label: 'Initiative & Commitment', labelTh: 'ริเริ่มและมุ่งมั่น', source: 'manual', kpiWeight: 100,
        rubric: { 1: 'No initiative', 2: 'Occasional', 3: 'Regular', 4: 'Exceptional', 5: 'Inspires others' } },
    ]},
  ],
  senior: [
    { pillarKey: 'developPeople', weight: 20, kpis: [
      { id: 'sr-p1-talent',  label: 'Talent Pipeline', labelTh: 'พัฒนาบุคลากรทดแทน', source: 'manual', kpiWeight: 30,
        rubric: { 1: 'No succession planning', 2: 'Identified potential successors only', 3: 'Active development plans for key positions', 4: 'Multiple successors ready, cross-training in place', 5: 'Robust pipeline, promotes from within, zero vacancy gaps' } },
      { id: 'sr-p1-culture', label: 'Culture & Engagement', labelTh: 'วัฒนธรรมและการมีส่วนร่วม', source: 'manual', kpiWeight: 25,
        rubric: { 1: 'Low morale, high turnover', 2: 'Some engagement efforts', 3: 'Stable team, regular engagement activities', 4: 'High engagement scores, low turnover', 5: 'Best-in-class culture, employer of choice' } },
      { id: 'sr-p1-coverage', label: 'Team Coverage', labelTh: 'ครอบคลุมทีม', source: 'auto', autoKey: 'teamCoverage', kpiWeight: 25,
        rubric: { 1: '<3 workers managed', 2: '3-5 workers', 3: '6-8 workers', 4: '9-12 workers', 5: '13+ workers, multi-team oversight' } },
      { id: 'sr-p1-attend', label: 'Attendance Rate', labelTh: 'อัตราการเข้างาน', source: 'auto', autoKey: 'attendanceRate', kpiWeight: 20,
        rubric: { 1: 'Absent >5 days/month', 2: '3-5 days', 3: '1-2 days', 4: 'Near-perfect', 5: 'Perfect, leads by example' } },
    ]},
    { pillarKey: 'driveValue', weight: 15, kpis: [
      { id: 'sr-p2-sla',    label: 'Overall SLA', labelTh: 'SLA รวม', source: 'auto', autoKey: 'overallSla', kpiWeight: 40,
        rubric: { 1: '<70% SLA', 2: '70-79%', 3: '80-89%', 4: '90-95%', 5: '96%+ consistently' } },
      { id: 'sr-p2-fulfill', label: 'Fulfillment Rate', labelTh: 'อัตราจัดส่งสำเร็จ', source: 'auto', autoKey: 'fulfillment', kpiWeight: 30,
        rubric: { 1: '<60%', 2: '60-74%', 3: '75-89%', 4: '90-95%', 5: '96%+ fulfillment' } },
      { id: 'sr-p2-client',  label: 'Client Satisfaction', labelTh: 'ความพึงพอใจลูกค้า', source: 'manual', kpiWeight: 30,
        rubric: { 1: 'Major complaints unresolved', 2: 'Recurring complaints', 3: 'Meets expectations, complaints handled', 4: 'Exceeds expectations, proactive service', 5: 'Strategic partnerships, NPS consistently high' } },
    ]},
    { pillarKey: 'makeRevenue', weight: 10, kpis: [
      { id: 'sr-p3-growth',  label: 'Revenue Growth', labelTh: 'การเติบโตรายได้', source: 'auto', autoKey: 'revenueGrowth', kpiWeight: 50,
        rubric: { 1: 'Revenue decline', 2: '0-4% growth', 3: '5-9% growth', 4: '10-19% growth', 5: '20%+ growth' } },
      { id: 'sr-p3-channel', label: 'Channel Strategy', labelTh: 'กลยุทธ์ช่องทาง', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'No new channels', 2: '1 channel explored', 3: '1 new channel launched', 4: '2+ channels generating revenue', 5: '3+ channels, diversified revenue streams' } },
    ]},
    { pillarKey: 'championProgress', weight: 10, kpis: [
      { id: 'sr-p4-digital', label: 'Digital Transformation', labelTh: 'การปรับเปลี่ยนสู่ดิจิทัล', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'No digital strategy', 2: 'Basic tools adopted', 3: 'Key processes digitized', 4: 'Integrated digital ecosystem', 5: 'Industry-leading digital operations' } },
      { id: 'sr-p4-innovate', label: 'Process Innovation', labelTh: 'นวัตกรรมกระบวนการ', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'No process improvements', 2: '1-2 minor improvements', 3: 'Regular improvements with measurable impact', 4: 'Significant efficiency gains (>15%)', 5: 'Transformative changes, automation, industry benchmark' } },
    ]},
    { pillarKey: 'deliverFinancial', weight: 15, kpis: [
      { id: 'sr-p5-ebitda',  label: 'EBITDA', labelTh: 'ผลกำไร EBITDA', source: 'md', kpiWeight: 40,
        rubric: { 1: 'Significantly below target', 2: 'Below target', 3: 'Meets target', 4: 'Above target', 5: 'Significantly above target' } },
      { id: 'sr-p5-cost',    label: 'Cost Management', labelTh: 'บริหารต้นทุน', source: 'manual', kpiWeight: 30,
        rubric: { 1: 'Over budget >20%', 2: 'Over budget 5-20%', 3: 'Within budget', 4: 'Under budget 5-10%', 5: 'Under budget >10% while maintaining quality' } },
      { id: 'sr-p5-uph',     label: 'Team Avg UPH', labelTh: 'UPH เฉลี่ยทีม', source: 'auto', autoKey: 'teamUph', kpiWeight: 30,
        rubric: { 1: '<25 UPH avg', 2: '25-34', 3: '35-49', 4: '50-60', 5: '61+ UPH avg' } },
    ]},
    { pillarKey: 'manageRisk', weight: 10, kpis: [
      { id: 'sr-p6-govern',  label: 'Corporate Governance', labelTh: 'ธรรมาภิบาล', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'Major compliance failures', 2: 'Minor compliance issues', 3: 'Fully compliant, audits passed', 4: 'Proactive risk management, zero incidents', 5: 'Best-practice governance, advises other departments' } },
      { id: 'sr-p6-safety',  label: 'Safety & Loss Prevention', labelTh: 'ความปลอดภัยและป้องกันสูญเสีย', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'Safety incidents, high shrinkage', 2: 'Occasional incidents', 3: 'Safe operations, shrinkage within limits', 4: 'Zero incidents, proactive prevention', 5: 'Industry-leading safety record, zero shrinkage' } },
    ]},
    { pillarKey: 'liveValues', weight: 10, kpis: [
      { id: 'sr-p7-team',  label: 'Understanding', labelTh: 'ความเข้าใจ', source: '360', kpiWeight: 25, rubric: { 1: 'Does not listen to others', 2: 'Listens but rarely acts', 3: 'Understands team needs', 4: 'Actively empathetic, adapts approach', 5: 'Deep understanding, mentors with empathy' } },
      { id: 'sr-p7-trust', label: 'Trustworthiness', labelTh: 'ความน่าเชื่อถือ', source: '360', kpiWeight: 25, rubric: { 1: 'Unreliable, breaks commitments', 2: 'Inconsistent follow-through', 3: 'Reliable, keeps promises', 4: 'Highly trusted, transparent', 5: 'Organizational trust anchor, exemplary integrity' } },
      { id: 'sr-p7-vision', label: 'Visionary', labelTh: 'มีวิสัยทัศน์', source: '360', kpiWeight: 25, rubric: { 1: 'No strategic thinking', 2: 'Short-term focus only', 3: 'Sets clear direction', 4: 'Inspires with compelling vision', 5: 'Transforms organization with bold vision' } },
      { id: 'sr-p7-dare',  label: 'Daring', labelTh: 'กล้าคิดกล้าทำ', source: '360', kpiWeight: 25, rubric: { 1: 'Risk-averse, avoids decisions', 2: 'Takes action only when safe', 3: 'Makes tough decisions when needed', 4: 'Boldly drives change, accepts calculated risks', 5: 'Fearless leader, turns challenges into breakthroughs' } },
    ]},
    { pillarKey: 'goAboveBeyond', weight: 10, kpis: [
      { id: 'sr-p8-strategic', label: 'Strategic Initiative', labelTh: 'ริเริ่มเชิงกลยุทธ์', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'No strategic projects', 2: '1 project started but incomplete', 3: '1 strategic project delivered', 4: '2+ strategic projects with measurable ROI', 5: 'Portfolio of initiatives transforming the business' } },
      { id: 'sr-p8-leader',   label: 'Leadership Beyond Role', labelTh: 'ภาวะผู้นำเกินหน้าที่', source: 'manual', kpiWeight: 50,
        rubric: { 1: 'Stays in comfort zone', 2: 'Occasionally helps outside scope', 3: 'Regularly contributes beyond role', 4: 'Leads cross-functional initiatives', 5: 'Drives organizational change, industry thought leader' } },
    ]},
  ],
};

// ── Compute OKR Score for a worker ──
export function computeOkrResults(roleKey, workerLogs, orders = []) {
    const config = ROLE_KPI_CONFIG[roleKey];
    if (!config?.keyResults) return { results: [], totalScore: 0, grade: getOkrGrade(0) };
    const results = config.keyResults.map(kr => {
        const actual = kr.compute(workerLogs, orders);
        const score = kr.target > 0 ? Math.min(Math.round((actual / kr.target) * 100), 120) : (actual > 0 ? 100 : 0);
        return { ...kr, actual, score };
    });
    const totalScore = Math.round(results.reduce((s, r) => s + r.score * r.weight, 0));
    return { results, totalScore, grade: getOkrGrade(totalScore) };
}

// ── Sample OKR data for demo ──
export const SAMPLE_OKR_WORKERS = [
    { name: 'Somchai K.', username: 'somchai', role: 'picker' },
    { name: 'Nattaya P.', username: 'nattaya', role: 'packer' },
    { name: 'Wichai S.', username: 'wichai', role: 'outbound' },
    { name: 'Preecha M.', username: 'preecha', role: 'picker' },
    { name: 'Kannika R.', username: 'kannika', role: 'packer' },
];

export const tabInfo = {
    dashboard: { icon: <LayoutDashboard className="w-5 h-5" />, section: 'Operations' },
    pick: { icon: <ShoppingCart className="w-5 h-5" />, section: 'Operations' },
    pack: { icon: <Box className="w-5 h-5" />, section: 'Operations' },
    handheldPack: { icon: <Smartphone className="w-5 h-5" />, section: 'Operations' },
    posPack: { icon: <Monitor className="w-5 h-5" />, section: 'Operations' },
    inventory: { icon: <Warehouse className="w-5 h-5" />, section: 'Inventory' },
    cycleCount: { icon: <ClipboardCheck className="w-5 h-5" />, section: 'Inventory' },
    sorting: { icon: <Layers className="w-5 h-5" />, section: 'Inventory' },
    fulfillment: { icon: <PackageCheck className="w-5 h-5" />, section: 'Logistics' },
    platformMonitor: { icon: <BarChart2 className="w-5 h-5" />, section: 'Logistics' },
    scan: { icon: <ScanLine className="w-5 h-5" />, section: 'Logistics' },
    list: { icon: <FileText className="w-5 h-5" />, section: 'Logistics' },
    dispatch: { icon: <Truck className="w-5 h-5" />, section: 'Logistics' },
    invoice: { icon: <Receipt className="w-5 h-5" />, section: 'Accounting' },
    teamPerformance: { icon: <Trophy className="w-5 h-5" />, section: 'Analytics' },
    slaTracker: { icon: <Shield className="w-5 h-5" />, section: 'Analytics' },
    timeAttendance: { icon: <Clock className="w-5 h-5" />, section: 'Analytics' },
    kpiAssessment: { icon: <Target className="w-5 h-5" />, section: 'Analytics' },
    report: { icon: <Printer className="w-5 h-5" />, section: 'System' },
    users: { icon: <Users className="w-5 h-5" />, section: 'System' },
    settings: { icon: <Settings className="w-5 h-5" />, section: 'System' },
    manual: { icon: <BookOpen className="w-5 h-5" />, section: 'Help' }
};

// Wave templates
export const WAVE_TEMPLATES = [
    { id: 'morning', name: 'Morning Wave', timeRange: '08:00-12:00', icon: '🌅' },
    { id: 'afternoon', name: 'Afternoon Wave', timeRange: '12:00-17:00', icon: '☀️' },
    { id: 'evening', name: 'Evening Wave', timeRange: '17:00-21:00', icon: '🌙' },
    { id: 'custom', name: 'Custom Wave', timeRange: 'Custom', icon: '⚡' },
];

// Product catalog with images
export const PRODUCT_CATALOG = {
    // ── SKINOXY ─────────────────────────────────────────────
    'STDH080-REFILL': {
        name: 'SKINOXY Refill Toner Pad 150 ml (80 Sheets)',
        shortName: 'Refill Toner Pad (Dewy)',
        variant: 'Dewy & Hydrating',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/e8d5f5/6b21a8?text=STDH080%0ARefill',
        weight: 0.25,
        barcode: '8859139111901',
        location: 'A-01-01',
        odooId: 40001,
    },
    'STBG080-REFILL': {
        name: 'SKINOXY Refill Toner Pad 150 ml (80 Sheets)',
        shortName: 'Toner Pad Refill (Bright)',
        variant: 'Bright & Glow',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/fde68a/92400e?text=STBG080%0ARefill',
        weight: 0.28,
        barcode: '8859139111925',
        location: 'A-01-02',
        odooId: 40002,
    },
    'SWB700': {
        name: 'SKINOXY Body Wash 700ml (pH 5.5 Brightening)',
        shortName: 'Body Wash (Bright)',
        variant: 'pH 5.5 Brightening',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/bbf7d0/166534?text=SWB700%0ABody+Wash',
        weight: 0.78,
        barcode: '8859139111703',
        location: 'B-02-01',
        odooId: 40003,
    },
    'SWH700': {
        name: 'SKINOXY Body Wash 700ml (pH 5.5 Hydrating)',
        shortName: 'Body Wash (Hydra)',
        variant: 'pH 5.5 Hydrating',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/bfdbfe/1e40af?text=SWH700%0ABody+Wash',
        weight: 0.78,
        barcode: '8859139111680',
        location: 'B-02-02',
        odooId: 40004,
    },
    // ── SKINOXY Hydrogel Mask ────────────────────────────────
    'SHGG030': {
        name: 'SKINOXY Hydrogel Mask 30g (Glow & Glamour)',
        shortName: 'Hydrogel Mask (Glow)',
        variant: 'Glow & Glamour',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/fce4ec/880e4f?text=SHGG030%0AMask',
        weight: 0.05,
        barcode: '8859139119830',
        location: 'A-02-01',
        odooId: 43998,
    },
    'SHLF030': {
        name: 'SKINOXY Hydrogel Mask 30g (Lift & Firm)',
        shortName: 'Hydrogel Mask (Lift)',
        variant: 'Lift & Firm',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/e8eaf6/1a237e?text=SHLF030%0AMask',
        weight: 0.05,
        barcode: '8859139119847',
        location: 'A-02-02',
        odooId: 43999,
    },
    // ── KISS-MY-BODY ─────────────────────────────────────────
    'KLA226': {
        name: 'KISS-MY-BODY Bright & Shining Lotion 226ml',
        shortName: 'Bright & Shining Lotion',
        variant: 'Bright & Shining',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/fce4ec/880e4f?text=KLA226%0ALotion',
        weight: 0.32,
        barcode: '8859139102261',
        location: 'C-01-01',
        odooId: 24310,
    },
    'KMA088': {
        name: 'KISS-MY-BODY Perfume Mist 88ml',
        shortName: 'Perfume Mist 88ml',
        variant: 'Mist',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/f3e5f5/4a148c?text=KMA088%0AMist',
        weight: 0.18,
        barcode: '8859139100882',
        location: 'C-01-02',
        odooId: 24376,
    },
    'KLMH180': {
        name: 'KISS-MY-BODY Tone Up Body Lotion 180ml',
        shortName: 'Tone Up Lotion 180ml',
        variant: 'Tone Up',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/e8f5e9/1b5e20?text=KLMH180%0AToneUp',
        weight: 0.28,
        barcode: '8859139118010',
        location: 'C-02-01',
        odooId: 43355,
    },
    'KWAP380': {
        name: 'KISS-MY-BODY Perfume & Aroma 380ml',
        shortName: 'Perfume & Aroma 380ml',
        variant: 'Aroma',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/e3f2fd/0d47a1?text=KWAP380%0AAroma',
        weight: 0.52,
        barcode: '8859139138030',
        location: 'C-02-02',
        odooId: 43024,
    },
};

// Box/packaging types
export const BOX_TYPES = [
    { id: 'BOX-S', name: 'Box S', size: '15x20x10 cm', maxWeight: 0.5, icon: '📦' },
    { id: 'BOX-M', name: 'Box M', size: '25x30x15 cm', maxWeight: 1.5, icon: '📦' },
    { id: 'BOX-L', name: 'Box L', size: '35x40x20 cm', maxWeight: 3.0, icon: '📦' },
    { id: 'BOX-XL', name: 'Box XL', size: '45x50x30 cm', maxWeight: 5.0, icon: '📦' },
    { id: 'ENV-A4', name: 'Envelope A4', size: '24x33 cm', maxWeight: 0.3, icon: '✉️' },
    { id: 'BUBBLE', name: 'Bubble Mailer', size: '20x28 cm', maxWeight: 0.4, icon: '🫧' },
];

// Platform label configs — logo is now a React element (SVG badge)
// Use: <PlatformBadge name={order.platform} size={32} /> for best quality
// Or legacy: {pl.logo} still works (renders a sized badge)
const _badge = (name, size = 28) => <PlatformBadge name={name} size={size} />;
export const PLATFORM_LABELS = {
    'Shopee Express': { color: '#EE4D2D', logo: _badge('Shopee Express'), name: 'Shopee', prefix: 'SPXTH' },
    'Lazada Express': { color: '#0F146D', logo: _badge('Lazada Express'), name: 'Lazada', prefix: 'LZTH' },
    'Flash Express':  { color: '#FFCD00', logo: _badge('Flash Express'),  name: 'Flash',  prefix: 'FLTH', textColor: '#333' },
    'Kerry Express':  { color: '#FF6600', logo: _badge('Kerry Express'),  name: 'Kerry',  prefix: 'KETH' },
    'J&T Express':    { color: '#D32011', logo: _badge('J&T Express'),    name: 'J&T',    prefix: 'JTTH' },
    'Thai Post':      { color: '#ED1C24', logo: _badge('Thai Post'),      name: 'Thai Post', prefix: 'TPTH' },
    'TikTok Shop':    { color: '#010101', logo: _badge('TikTok Shop'),    name: 'TikTok', prefix: 'TTTH' },
};

const _D = (msAgo) => Date.now() - msAgo;
const _today = new Date().toISOString().split('T')[0];

// SKINOXY products
const _P = {
    refill: { sku: 'STDH080-REFILL',  barcode: '8859139111901', name: 'SKINOXY Refill Toner Pad (Dewy) 150ml' },
    toner:  { sku: 'STBG080-REFILL',  barcode: '8859139111925', name: 'SKINOXY Toner Pad Refill (Bright) 150ml' },
    washB:  { sku: 'SWB700',          barcode: '8859139111703', name: 'SKINOXY Body Wash (Bright) 700ml' },
    washH:  { sku: 'SWH700',          barcode: '8859139111680', name: 'SKINOXY Body Wash (Hydra) 700ml' },
    maskG:  { sku: 'SHGG030',         barcode: '8859139119830', name: '[SHGG030] SKINOXY Hydrogel Mask (Glow) 30g' },
    maskL:  { sku: 'SHLF030',         barcode: '8859139119847', name: '[SHLF030] SKINOXY Hydrogel Mask (Lift) 30g' },
};
// KISS-MY-BODY products
const _K = {
    kla:    { sku: 'KLA226',   barcode: '8859139102261', name: '[KLA226] KISS-MY-BODY Bright & Shining Lotion 226ml' },
    kma:    { sku: 'KMA088',   barcode: '8859139100882', name: '[KMA088] KISS-MY-BODY Perfume Mist 88ml' },
    klmh:   { sku: 'KLMH180',  barcode: '8859139118010', name: '[KLMH180] KISS-MY-BODY Tone Up Body Lotion 180ml' },
    kwap:   { sku: 'KWAP380',  barcode: '8859139138030', name: '[KWAP380] KISS-MY-BODY Perfume & Aroma 380ml' },
};
const _i = (p, q) => ({ ...p, expected: q, picked: 0, packed: 0 });

// Real Odoo SO format:
//   ref      = WH/OUT/XXXXX  (delivery picking ref — used in WMS)
//   soRef    = platform order number
//              Shopee:  alphanumeric  e.g. "2603145CM763UM"
//              TikTok:  18-digit num  e.g. "583073436999124085"
//              Lazada:  16-digit num  e.g. "1090229548148582"
//   customer = "ECOMMERCE : {PLATFORM}" (as stored in Odoo)
//   source   = "{Platform}_{Shop}"  e.g. "Shopee_KissMyBody", "Lazada_Skinoxy"
// Production: starts empty. Use Settings > Create Test Orders for demo data.
export const INITIAL_SALES_ORDERS = [];
