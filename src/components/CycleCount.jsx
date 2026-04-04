import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { formatDate, formatDateTime, formatTime } from '../utils/dateFormat';
import {
    ClipboardCheck, BarChart3, Search, ScanLine, CheckCircle2, AlertTriangle,
    Package, RefreshCw, Calendar, Filter, ChevronDown, ChevronRight, Hash,
    ArrowUpDown, X, Check, Clock, Target, TrendingUp, TrendingDown, Shuffle,
    Archive, Eye, ChevronLeft, Users, UserCheck, MapPin, Camera, Bell, BellRing,
    RotateCcw, ShieldCheck, Image, Lock, Unlock, QrCode, Plus, Download, Printer, FileText
} from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';
import { getActivePickers } from './TimeAttendance';
import { applyFullCountAdjustments } from '../services/odooApi';
import WarehouseMap from './WarehouseMap';

// ── Zone Colors ──
const ZONE_COLORS = {
    A: '#dc2626', B: '#d97706', C: '#2563eb', D: '#16a34a',
    E: '#9333ea', F: '#e11d48', G: '#0891b2', H: '#65a30d',
    I: '#475569', FLG: '#78716c',
};

// Extract zone letter from location (handles K2-A01-01 and A-01-01)
const getZone = (loc) => {
    if (!loc) return '';
    const parts = loc.split('-');
    if (parts.length >= 2 && /\d/.test(parts[0])) {
        return parts[1].replace(/\d+/g, '');
    }
    return parts[0];
};

// ── ABC Classification ──
const ABC_CONFIG = {
    A: { label: 'A — High Movement', color: '#dc2626', bg: '#fee2e2', pct: 0.20, dailySamplePct: 1.00, desc: 'Count every day' },
    B: { label: 'B — Medium Movement', color: '#d97706', bg: '#fef3c7', pct: 0.30, dailySamplePct: 0.30, desc: 'Sample ~30% daily' },
    C: { label: 'C — Low Movement', color: '#2563eb', bg: '#dbeafe', pct: 0.50, dailySamplePct: 0.10, desc: 'Sample ~10% daily' },
};

const VARIANCE_AUTO_APPROVE_PCT = 5;

const seededRandom = (seed) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const parseQrInput = (raw) => {
    const val = raw.replace(/[^\x20-\x7E\u0E00-\u0E7F]/g, '').trim().toUpperCase();
    if (val.startsWith('LOC:')) return { type: 'location', value: val.slice(4).trim() };
    if (val.startsWith('PRD:')) {
        const parts = val.split('|');
        const sku = parts[0].slice(4).trim();
        const lot = parts.find(p => p.startsWith('LOT:'))?.slice(4)?.trim() || null;
        return { type: 'product', value: sku, lot };
    }
    return { type: 'auto', value: val };
};

// ── Notification helpers ──
const NOTIF_KEY = 'wms_count_notifications';

const getNotifications = (username) => {
    try {
        const all = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        return all.filter(n => n.username === username);
    } catch { return []; }
};

const addNotification = (username, message, type = 'info') => {
    try {
        const all = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        const notif = {
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            username, message, type,
            createdAt: new Date().toISOString(),
            read: false,
        };
        all.unshift(notif);
        localStorage.setItem(NOTIF_KEY, JSON.stringify(all.slice(0, 100)));
        return notif;
    } catch { return null; }
};

const markNotificationsRead = (username) => {
    try {
        const all = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        const updated = all.map(n => n.username === username ? { ...n, read: true } : n);
        localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
};

const generateDailyNotifications = (assignedTasks, pickers, dateStr) => {
    const sentKey = `wms_count_notif_sent_${dateStr}`;
    if (localStorage.getItem(sentKey)) return;
    const byUser = {};
    assignedTasks.forEach(t => {
        if (!byUser[t.assignedTo]) byUser[t.assignedTo] = { total: 0, A: 0, B: 0, C: 0 };
        byUser[t.assignedTo].total++;
        byUser[t.assignedTo][t.abcGrade]++;
    });
    Object.entries(byUser).forEach(([username, counts]) => {
        const grades = [];
        if (counts.A > 0) grades.push(`${counts.A} Grade A`);
        if (counts.B > 0) grades.push(`${counts.B} Grade B`);
        if (counts.C > 0) grades.push(`${counts.C} Grade C`);
        addNotification(
            username,
            `You have ${counts.total} cycle count tasks assigned today (${grades.join(', ')}). Please complete before end of shift.`,
            'assignment'
        );
    });
    localStorage.setItem(sentKey, 'true');
};

// ── Full Count Status Config ──
const FC_STATUS = {
    planning:     { label: 'Planning', color: '#6366f1', icon: '📋' },
    frozen:       { label: 'Stock Frozen', color: '#0284c7', icon: '🔒' },
    counting:     { label: 'Counting', color: '#2563eb', icon: '📊' },
    reconciling:  { label: 'Reconciling', color: '#d97706', icon: '⚖️' },
    closed:       { label: 'Closed', color: '#16a34a', icon: '✅' },
};

// ═══════════════════════════════════════════════════════════════
// Shared style objects — Stitch design system
// ═══════════════════════════════════════════════════════════════
const cardStyle = {
    background: 'var(--odoo-surface)',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
};

const sectionHeaderStyle = {
    fontSize: '12px',
    fontWeight: 800,
    color: 'var(--odoo-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    borderBottom: '1px solid var(--odoo-border-ghost)',
    paddingBottom: '8px',
    marginBottom: '12px',
};

const labelStyle = {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--odoo-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
};

const gradientBtnStyle = {
    background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 700,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'all 0.15s',
};

const outlineBtnStyle = {
    background: 'transparent',
    border: '2px solid var(--odoo-border)',
    borderRadius: '4px',
    color: 'var(--odoo-text-secondary)',
    fontWeight: 700,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'all 0.15s',
};

const inputStyle = {
    width: '100%',
    fontSize: '12px',
    padding: '10px 12px 10px 40px',
    borderRadius: '4px',
    border: 'none',
    background: 'var(--odoo-surface-low)',
    color: 'var(--odoo-text)',
    outline: 'none',
};

const CycleCount = ({ inventory, activityLogs = [], salesOrders = [], addToast, user, users = [], logActivity, apiConfigs }) => {
    // ── Tab & Mode State ──
    const [activeTab, setActiveTab] = useState('cycle');
    const [mode, setMode] = useState('dashboard');
    const [scanStep, setScanStep] = useState('scan-location');
    const [countDate, setCountDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [scanInput, setScanInput] = useState('');
    const [countInput, setCountInput] = useState('');
    const [scannedLocation, setScannedLocation] = useState(null);
    const [scannedLot, setScannedLot] = useState('');
    const [filterAbc, setFilterAbc] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterAssignee, setFilterAssignee] = useState('mine');
    const [recountInput, setRecountInput] = useState('');
    const [recountTask, setRecountTask] = useState(null);
    const [sortBy, setSortBy] = useState({ col: 'location', dir: 'asc' });
    const [expandedDate, setExpandedDate] = useState(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const scanRef = useRef(null);
    const countRef = useRef(null);
    const locScanRef = useRef(null);

    // Blind mode: admin/senior always see system qty; lower roles default blind unless admin grants permission in Settings
    const canSeeSystemQty = useMemo(() => {
        if (user?.role === 'admin' || user?.role === 'senior') return true;
        const currentUser = users.find(u => u.username === user?.username);
        return currentUser?.canSeeSystemQty === true;
    }, [user, users]);
    const blindMode = !canSeeSystemQty;

    const LS_COUNTS = 'wms_cycle_counts';
    const safeParse = (key, fallback) => {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch { return fallback; }
    };
    const [countRecords, setCountRecords] = useState(() => safeParse(LS_COUNTS, []));

    useEffect(() => {
        localStorage.setItem(LS_COUNTS, JSON.stringify(countRecords));
    }, [countRecords]);

    // ── Full Count State ──
    const LS_FULL_COUNTS = 'wms_full_counts';
    const [fullCountSessions, setFullCountSessions] = useState(() => safeParse(LS_FULL_COUNTS, []));
    const [activeSession, setActiveSession] = useState(null);
    const [fcMode, setFcMode] = useState('list');
    const [fcForm, setFcForm] = useState({ name: '', blindCount: true, requireDoubleCount: false, freezeStock: false, scopeType: 'full', zones: [] });
    const [fcCountInput, setFcCountInput] = useState('');
    const [fcSelectedItem, setFcSelectedItem] = useState(null);
    const [fcScannedLot, setFcScannedLot] = useState('');

    useEffect(() => {
        localStorage.setItem(LS_FULL_COUNTS, JSON.stringify(fullCountSessions));
    }, [fullCountSessions]);

    const stockFrozen = useMemo(() => {
        return fullCountSessions.some(s => (s.status === 'frozen' || s.status === 'counting') && s.settings?.freezeStock === true);
    }, [fullCountSessions]);

    // ── Build product list ──
    const products = useMemo(() => {
        const items = [];
        if (inventory?.items || (Array.isArray(inventory) && inventory.length > 0)) {
            const invItems = inventory?.items || inventory;
            invItems.forEach((item, idx) => {
                const sku = item.sku || item.default_code;
                if (!sku) return;
                const cat = PRODUCT_CATALOG[sku];
                items.push({
                    _key: `${sku}-${item.location || idx}`,
                    sku, name: cat?.shortName || item.name || sku,
                    barcode: cat?.barcode || item.barcode || '',
                    location: cat?.location || item.location || '',
                    systemQty: item.onHand ?? item.quantity ?? 0,
                    brand: cat?.brand || '', image: cat?.image || '',
                    lotTracking: cat?.lotTracking ?? !!item.lot_id,
                    lots: item.lots || [],
                });
            });
        }
        return items;
    }, [inventory]);

    // ── ABC Classification ──
    const abcClassification = useMemo(() => {
        const thirtyDaysAgo = Date.now() - 30 * 86400000;
        const pickLogs = activityLogs.filter(l => l.action === 'pick' && l.timestamp >= thirtyDaysAgo);
        const freqMap = {};
        pickLogs.forEach(l => {
            const sku = l.details?.sku || l.details?.barcode || '';
            if (sku) freqMap[sku] = (freqMap[sku] || 0) + 1;
        });
        salesOrders.forEach(so => {
            if (so.items) so.items.forEach(item => {
                const sku = item.sku || '';
                if (sku && so.status !== 'pending') freqMap[sku] = (freqMap[sku] || 0) + (item.picked || item.expected || 1);
            });
        });
        const sorted = [...products].sort((a, b) => (freqMap[b.sku] || 0) - (freqMap[a.sku] || 0));
        const total = sorted.length;
        const aCount = Math.max(1, Math.ceil(total * ABC_CONFIG.A.pct));
        const bCount = Math.max(1, Math.ceil(total * ABC_CONFIG.B.pct));
        const result = {};
        sorted.forEach((p, idx) => {
            let grade;
            if (idx < aCount) grade = 'A';
            else if (idx < aCount + bCount) grade = 'B';
            else grade = 'C';
            result[p.sku] = { grade, frequency: freqMap[p.sku] || 0 };
        });
        return result;
    }, [products, activityLogs, salesOrders]);

    // ── Daily tasks ──
    const dailyTasks = useMemo(() => {
        const dateSeed = countDate.split('-').join('') * 1;
        const tasks = [];
        ['A', 'B', 'C'].forEach(grade => {
            const cfg = ABC_CONFIG[grade];
            const gradeProducts = products.filter(p => abcClassification[p.sku]?.grade === grade);
            const sampleSize = Math.max(1, Math.ceil(gradeProducts.length * cfg.dailySamplePct));
            const shuffled = [...gradeProducts].sort((a, b) => {
                const sa = seededRandom(dateSeed + a.sku.charCodeAt(0) * 137);
                const sb = seededRandom(dateSeed + b.sku.charCodeAt(0) * 137);
                return sa - sb;
            });
            shuffled.slice(0, sampleSize).forEach(p => {
                const existing = countRecords.find(r => r.sku === p.sku && r.date === countDate);
                tasks.push({
                    ...p, abcGrade: grade,
                    frequency: abcClassification[p.sku]?.frequency || 0,
                    counted: !!existing, countedQty: existing?.countedQty ?? null,
                    variance: existing ? (existing.countedQty - existing.systemQty) : null,
                    countedBy: existing?.countedBy || null, countedAt: existing?.countedAt || null,
                    lot: existing?.lot || '', status: existing?.status || 'pending',
                    needsRecount: existing?.needsRecount || false,
                    supervisorCount: existing?.supervisorCount ?? null,
                });
            });
        });
        return tasks;
    }, [countDate, products, abcClassification, countRecords]);

    // ── Fair Assignment ──
    const pickers = useMemo(() => {
        const pickerUsers = users.filter(u => u.role === 'picker');
        if (pickerUsers.length === 0) return [{ username: user?.username || 'admin', name: user?.name || 'Admin' }];
        const activePickers = getActivePickers(pickerUsers);
        return activePickers.length > 0 ? activePickers : pickerUsers;
    }, [users, user]);

    const isAdmin = user?.role === 'admin' || user?.role === 'senior' || !users.find(u => u.username === user?.username && u.role === 'picker');

    const assignedTasks = useMemo(() => {
        if (pickers.length <= 1) {
            return dailyTasks.map(t => ({ ...t, assignedTo: pickers[0]?.username || user?.username }));
        }
        const dateSeed = countDate.split('-').join('') * 1;
        const rotationOffset = dateSeed % pickers.length;
        const byGrade = { A: [], B: [], C: [] };
        dailyTasks.forEach(t => { byGrade[t.abcGrade]?.push(t); });
        const assigned = [];
        let pickerIdx = rotationOffset;
        ['A', 'B', 'C'].forEach(grade => {
            byGrade[grade].forEach(task => {
                const picker = pickers[pickerIdx % pickers.length];
                assigned.push({ ...task, assignedTo: picker.username, assignedName: picker.name });
                pickerIdx++;
            });
        });
        return assigned;
    }, [dailyTasks, pickers, countDate, user]);

    useEffect(() => {
        if (assignedTasks.length > 0 && pickers.length > 0) {
            generateDailyNotifications(assignedTasks, pickers, countDate);
        }
    }, [assignedTasks, pickers, countDate]);

    const myTasks = useMemo(() => {
        if (isAdmin) return assignedTasks;
        return assignedTasks.filter(t => t.assignedTo === user?.username);
    }, [assignedTasks, isAdmin, user]);

    const assignmentSummary = useMemo(() => {
        const summary = {};
        pickers.forEach(p => { summary[p.username] = { name: p.name, username: p.username, total: 0, done: 0, A: 0, B: 0, C: 0 }; });
        assignedTasks.forEach(t => {
            const s = summary[t.assignedTo];
            if (s) { s.total++; s[t.abcGrade]++; if (t.counted) s.done++; }
        });
        return Object.values(summary);
    }, [assignedTasks, pickers]);

    // ── Stats ──
    const stats = useMemo(() => {
        const total = myTasks.length;
        const done = myTasks.filter(t => t.counted).length;
        const variances = myTasks.filter(t => t.counted && t.variance !== 0);
        const needsRecount = myTasks.filter(t => t.needsRecount).length;
        const accuracy = done > 0 ? Math.round(((done - variances.length) / done) * 100) : 0;
        return {
            total, done, pending: total - done, variances: variances.length, needsRecount,
            positiveVar: variances.filter(t => t.variance > 0).length,
            negativeVar: variances.filter(t => t.variance < 0).length,
            accuracy, pctDone: total > 0 ? Math.round((done / total) * 100) : 0,
        };
    }, [myTasks]);

    const notifications = useMemo(() => getNotifications(user?.username), [user, countDate, countRecords]);
    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    // ── Filtered/Sorted tasks ──
    const filteredTasks = useMemo(() => {
        let list = [...myTasks];
        if (filterAbc !== 'all') list = list.filter(t => t.abcGrade === filterAbc);
        if (filterStatus === 'pending') list = list.filter(t => !t.counted);
        if (filterStatus === 'counted') list = list.filter(t => t.counted && !t.needsRecount);
        if (filterStatus === 'variance') list = list.filter(t => t.counted && t.variance !== 0);
        if (filterStatus === 'recount') list = list.filter(t => t.needsRecount);
        list.sort((a, b) => {
            let va, vb;
            if (sortBy.col === 'sku') { va = a.sku; vb = b.sku; }
            else if (sortBy.col === 'location') { va = a.location || ''; vb = b.location || ''; }
            else if (sortBy.col === 'abc') { va = a.abcGrade; vb = b.abcGrade; }
            else if (sortBy.col === 'status') { va = a.counted ? 1 : 0; vb = b.counted ? 1 : 0; }
            else if (sortBy.col === 'variance') { va = Math.abs(a.variance || 0); vb = Math.abs(b.variance || 0); }
            else { va = a.sku; vb = b.sku; }
            if (typeof va === 'string') return sortBy.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortBy.dir === 'asc' ? va - vb : vb - va;
        });
        return list;
    }, [myTasks, filterAbc, filterStatus, sortBy]);

    // ── History ──
    const historyByDate = useMemo(() => {
        const grouped = {};
        countRecords.forEach(r => {
            if (!grouped[r.date]) grouped[r.date] = [];
            grouped[r.date].push(r);
        });
        return Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, records]) => ({
                date, total: records.length,
                variances: records.filter(r => r.countedQty !== r.systemQty).length,
                accuracy: Math.round(((records.length - records.filter(r => r.countedQty !== r.systemQty).length) / records.length) * 100),
                recounts: records.filter(r => r.needsRecount || r.supervisorCount != null).length,
            }));
    }, [countRecords]);

    // ── Submit count ──
    const submitCount = useCallback((task, qty, lot = '') => {
        const varianceAbs = Math.abs(qty - task.systemQty);
        const variancePct = task.systemQty > 0 ? (varianceAbs / task.systemQty) * 100 : (qty > 0 ? 100 : 0);
        const needsRecount = variancePct > VARIANCE_AUTO_APPROVE_PCT && qty !== task.systemQty;

        const record = {
            sku: task.sku, name: task.name, location: task.location, barcode: task.barcode,
            abcGrade: task.abcGrade, date: countDate,
            systemQty: task.systemQty, countedQty: qty,
            variance: qty - task.systemQty, variancePct: Math.round(variancePct * 10) / 10,
            lot: lot || '', countedBy: user?.username || 'unknown',
            countedAt: new Date().toISOString(),
            scannedLocation: scannedLocation, needsRecount,
            status: needsRecount ? 'needs-recount' : (qty === task.systemQty ? 'matched' : 'variance-approved'),
            supervisorCount: null, supervisorBy: null,
        };

        setCountRecords(prev => {
            const filtered = prev.filter(r => !(r.sku === task.sku && r.date === countDate));
            return [record, ...filtered];
        });

        logActivity?.('cycle-count', {
            sku: task.sku, location: task.location, abcGrade: task.abcGrade,
            systemQty: task.systemQty, countedQty: qty, variance: qty - task.systemQty,
            match: qty === task.systemQty, lot, needsRecount,
        });

        if (qty === task.systemQty) {
            addToast?.(`${task.sku} — Matched!`, 'success');
        } else if (needsRecount) {
            addToast?.(`${task.sku} — Variance detected. Flagged for supervisor recount.`, 'error');
            users.filter(u => u.role === 'admin' || u.role === 'senior').forEach(admin => {
                addNotification(admin.username,
                    `Recount needed: ${task.sku} at ${task.location} — counted ${qty} by ${user?.name || user?.username} (variance >${VARIANCE_AUTO_APPROVE_PCT}%)`,
                    'recount'
                );
            });
        } else {
            addToast?.(`${task.sku} — Minor variance (${qty - task.systemQty > 0 ? '+' : ''}${qty - task.systemQty}). Auto-approved.`, 'warning');
        }

        const nextTask = myTasks.find(t => !t.counted && t.sku !== task.sku);
        if (nextTask) {
            setSelectedTask(nextTask);
            setScanStep('scan-location');
            setScannedLocation(null);
            setCountInput('');
            setScannedLot('');
            setTimeout(() => locScanRef.current?.focus(), 100);
        } else {
            setSelectedTask(null);
            setMode('dashboard');
            addToast?.('All tasks completed!', 'success');
        }
    }, [countDate, user, users, scannedLocation, addToast, myTasks, logActivity]);

    // ── Supervisor Recount ──
    const submitSupervisorRecount = useCallback((task, qty) => {
        setCountRecords(prev => prev.map(r => {
            if (r.sku === task.sku && r.date === countDate) {
                return {
                    ...r, needsRecount: false, status: 'recount-done',
                    supervisorCount: qty, supervisorBy: user?.username,
                    supervisorAt: new Date().toISOString(),
                    finalQty: qty, finalVariance: qty - r.systemQty,
                };
            }
            return r;
        }));
        logActivity?.('cycle-recount', {
            sku: task.sku, location: task.location, supervisorQty: qty,
            originalQty: task.countedQty, systemQty: task.systemQty,
        });
        addToast?.(`Recount for ${task.sku}: ${qty} (supervisor verified)`, 'success');
        addNotification(task.countedBy,
            `Your count for ${task.sku} was recounted by supervisor: final qty = ${qty}`,
            'recount-result'
        );
    }, [countDate, user, addToast, logActivity]);

    // ── Scan handlers ──
    const handleLocationScan = (e) => {
        if (e.key !== 'Enter' || !scanInput.trim()) return;
        const parsed = parseQrInput(scanInput);
        const locValue = parsed.type === 'location' ? parsed.value : parsed.value;
        const expectedLoc = selectedTask?.location?.toUpperCase()?.replace(/[\s-]/g, '');
        const scannedLoc = locValue.replace(/[\s-]/g, '');
        if (expectedLoc && scannedLoc !== expectedLoc) {
            addToast?.(`Wrong location! Expected: ${selectedTask.location}, Scanned: ${locValue}`, 'error');
            setScanInput('');
            return;
        }
        setScannedLocation(locValue);
        setScanStep('scan-product');
        setScanInput('');
        addToast?.(`Location verified: ${locValue}`, 'success');
        setTimeout(() => scanRef.current?.focus(), 100);
    };

    const handleProductScan = (e) => {
        if (e.key !== 'Enter' || !scanInput.trim()) return;
        const parsed = parseQrInput(scanInput);
        const productVal = parsed.type === 'product' ? parsed.value : parsed.value;
        if (parsed.lot) setScannedLot(parsed.lot);
        const matchTask = selectedTask;
        const barcodeMatch = matchTask?.barcode?.toUpperCase() === productVal;
        const skuMatch = matchTask?.sku?.toUpperCase() === productVal;
        if (!barcodeMatch && !skuMatch) {
            addToast?.(`Wrong product! Expected: ${matchTask?.sku}, Scanned: ${productVal}`, 'error');
            setScanInput('');
            return;
        }
        setScanStep('enter-qty');
        setScanInput('');
        addToast?.(`Product verified: ${matchTask.sku}`, 'success');
        setTimeout(() => countRef.current?.focus(), 100);
    };

    const handleCountSubmit = (e) => {
        if (e.key !== 'Enter' || !countInput.trim()) return;
        const qty = parseInt(countInput.trim(), 10);
        if (isNaN(qty) || qty < 0) {
            addToast?.('Invalid quantity', 'error');
            return;
        }
        submitCount(selectedTask, qty, scannedLot);
        setCountInput('');
    };

    const handleDashboardScan = (e) => {
        if (e.key !== 'Enter' || !scanInput.trim()) return;
        const parsed = parseQrInput(scanInput);
        const input = parsed.value;
        const task = myTasks.find(t =>
            t.barcode?.toUpperCase() === input || t.sku.toUpperCase() === input
        );
        if (task) {
            setSelectedTask(task);
            setMode('counting');
            setScanStep('scan-location');
            setScannedLocation(null);
            setCountInput('');
            setScannedLot('');
            setScanInput('');
        } else {
            addToast?.(`"${input}" not in today's count list`, 'error');
            setScanInput('');
        }
    };

    const toggleSort = (col) => {
        setSortBy(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    };

    const abcSummary = useMemo(() => {
        const summary = { A: { total: 0, today: 0 }, B: { total: 0, today: 0 }, C: { total: 0, today: 0 } };
        products.forEach(p => { summary[abcClassification[p.sku]?.grade || 'C'].total++; });
        myTasks.forEach(t => { summary[t.abcGrade].today++; });
        return summary;
    }, [products, abcClassification, myTasks]);

    // ── Report State ──
    const [showCycleReport, setShowCycleReport] = useState(false);
    const [reportDate, setReportDate] = useState(null);
    const [showFullCountReport, setShowFullCountReport] = useState(null);

    const handleExportCycleCountPDF = useCallback((targetDate) => {
        setReportDate(targetDate || countDate);
        setShowCycleReport(true);
        setTimeout(() => {
            const el = document.getElementById('cycle-count-report-area');
            if (!el || !window.html2pdf) { setShowCycleReport(false); return; }
            window.html2pdf().set({
                margin: [10, 10, 10, 10], filename: `CycleCount_Report_${targetDate || countDate}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css'] },
            }).from(el).save().finally(() => setShowCycleReport(false));
        }, 600);
    }, [countDate]);

    const handleExportFullCountPDF = useCallback((session) => {
        setShowFullCountReport(session.id);
        setTimeout(() => {
            const el = document.getElementById('full-count-report-area');
            if (!el || !window.html2pdf) { setShowFullCountReport(null); return; }
            window.html2pdf().set({
                margin: [10, 10, 10, 10], filename: `FullCount_${session.name.replace(/\s+/g, '_')}_${session.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css'] },
            }).from(el).save().finally(() => setShowFullCountReport(null));
        }, 600);
    }, []);

    // ── Count Management filter state ──
    const [locationSearch, setLocationSearch] = useState('');
    const [dateRange, setDateRange] = useState('');
    const [mgmtFilter, setMgmtFilter] = useState('all');

    // ── Full Count Functions ──
    const createFullCount = useCallback(() => {
        const allBins = [];
        const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
        const seenLocations = new Set();
        Object.entries(PRODUCT_CATALOG).forEach(([sku, cat]) => {
            if (!cat.location) return;
            const invItem = invItems.find(i => (i.sku || i.default_code) === sku);
            allBins.push({
                binId: cat.location, sku, name: cat.shortName || cat.name, location: cat.location,
                systemQty: invItem?.onHand ?? invItem?.quantity ?? 0,
                countedQty: null, variance: null, countedBy: null, countedAt: null,
                secondCountQty: null, secondCountBy: null,
                status: 'pending', needsRecount: false, note: '',
                lotTracking: cat?.lotTracking ?? !!invItem?.lot_id,
                lots: invItem?.lots || [],
                lot: '',
            });
            seenLocations.add(cat.location);
        });
        invItems.forEach(item => {
            const loc = item.location;
            if (!loc || seenLocations.has(loc)) return;
            const cat = PRODUCT_CATALOG[item.sku || item.default_code];
            allBins.push({
                binId: loc, sku: item.sku || item.default_code || '', name: item.name || '', location: loc,
                systemQty: item.onHand ?? item.quantity ?? 0,
                countedQty: null, variance: null, countedBy: null, countedAt: null,
                secondCountQty: null, secondCountBy: null,
                status: 'pending', needsRecount: false, note: '',
                lotTracking: cat?.lotTracking ?? !!item.lot_id,
                lots: item.lots || [],
                lot: '',
            });
        });

        const zoneMap = {};
        allBins.forEach(b => {
            const zone = getZone(b.location);
            if (!zoneMap[zone]) zoneMap[zone] = [];
            if (!zoneMap[zone].includes(b.binId)) zoneMap[zone].push(b.binId);
        });

        const period = new Date().toISOString().split('T')[0].substring(0, 7);
        const session = {
            id: `FC-${Date.now()}`,
            name: fcForm.name || `Full Count ${period}`,
            status: 'counting',
            settings: { blindCount: isAdmin ? fcForm.blindCount : true, requireDoubleCount: fcForm.requireDoubleCount, freezeStock: fcForm.freezeStock },
            scope: { type: fcForm.scopeType, zones: Object.keys(zoneMap) },
            zoneAssignments: Object.keys(zoneMap).map(z => ({ zone: z, assignees: [] })),
            frozenAt: new Date().toISOString(),
            frozenInventory: invItems.map(it => ({ sku: it.sku || it.default_code, location: it.location, qty: it.onHand ?? it.quantity ?? 0, lots: (it.lots || []).map(l => ({ lotNumber: l.lotNumber, qty: l.qty, expiryDate: l.expiryDate || null })) })),
            counts: allBins,
            progress: {
                total: allBins.length, counted: 0, matched: 0, variance: 0,
                byZone: Object.fromEntries(Object.entries(zoneMap).map(([z, bins]) => [z, { total: bins.length, done: 0 }])),
            },
            reconciliation: { totalVarianceQty: 0, totalVarianceValue: 0, adjustments: [], approvedBy: null, approvedAt: null },
            createdBy: user?.username || 'admin', createdAt: new Date().toISOString(), closedAt: null,
        };

        setFullCountSessions(prev => [session, ...prev]);
        setActiveSession(session);
        setFcMode('counting');
        addToast?.(`Full Count "${session.name}" created with ${allBins.length} items`, 'success');
        logActivity?.('full-count-create', { sessionId: session.id, totalItems: allBins.length });
    }, [inventory, fcForm, user, addToast, logActivity]);

    const freezeStock = useCallback((sessionId) => {
        const invSnapshot = inventory?.items || (Array.isArray(inventory) ? inventory : []);
        setFullCountSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s, status: 'frozen', frozenAt: new Date().toISOString(), frozenInventory: JSON.parse(JSON.stringify(invSnapshot)),
        } : s));
        addToast?.('Stock frozen — Pick/Pack blocked during count', 'warning');
        logActivity?.('full-count-freeze', { sessionId });
    }, [inventory, addToast, logActivity]);

    const unfreezeStock = useCallback((sessionId) => {
        setFullCountSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'counting' } : s));
        addToast?.('Stock unfrozen — operations resumed', 'success');
    }, [addToast]);

    const submitFullCount = useCallback((sessionId, binId, qty, lot = '') => {
        setFullCountSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            const counts = s.counts.map(c => {
                if (c.binId !== binId) return c;
                const variance = qty - c.systemQty;
                const variancePct = c.systemQty > 0 ? Math.abs(variance / c.systemQty) * 100 : (qty > 0 ? 100 : 0);
                const needsRecount = variancePct > VARIANCE_AUTO_APPROVE_PCT && variance !== 0;
                return {
                    ...c, countedQty: qty, variance, countedBy: user?.username, countedAt: new Date().toISOString(),
                    status: needsRecount ? 'needs-recount' : (variance === 0 ? 'matched' : 'variance-approved'),
                    needsRecount, lot: lot || c.lot || '',
                };
            });
            const counted = counts.filter(c => c.countedQty !== null).length;
            const matched = counts.filter(c => c.status === 'matched').length;
            const varianceCount = counts.filter(c => c.countedQty !== null && c.variance !== 0).length;
            const byZone = { ...s.progress.byZone };
            Object.keys(byZone).forEach(z => {
                const zoneCounts = counts.filter(c => getZone(c.location) === z);
                byZone[z] = { total: zoneCounts.length, done: zoneCounts.filter(c => c.countedQty !== null).length };
            });
            return { ...s, counts, progress: { ...s.progress, counted, matched, variance: varianceCount, byZone } };
        }));
        logActivity?.('full-count-item', { sessionId, binId, qty });
    }, [user, logActivity]);

    const [isApplying, setIsApplying] = useState(false);
    const [applyResult, setApplyResult] = useState(null);

    // Build live + frozen maps for reconciliation (includes lots/expiry)
    const buildInventoryMaps = useCallback((session) => {
        const liveInv = inventory?.items || (Array.isArray(inventory) ? inventory : []);
        const liveMap = {};
        const liveLotMap = {};
        liveInv.forEach(item => {
            const key = `${item.sku || item.default_code}::${item.location || ''}`;
            liveMap[key] = item.onHand ?? item.quantity ?? 0;
            if (item.lots?.length) liveLotMap[key] = item.lots;
        });
        const frozenMap = {};
        const frozenLotMap = {};
        (session.frozenInventory || []).forEach(item => {
            const key = `${item.sku}::${item.location || ''}`;
            frozenMap[key] = item.qty ?? item.onHand ?? item.quantity ?? 0;
            if (item.lots?.length) frozenLotMap[key] = item.lots;
        });
        return { liveMap, frozenMap, liveLotMap, frozenLotMap };
    }, [inventory]);

    // Build price map from inventory for value calculation
    const priceMap = useMemo(() => {
        const map = {};
        const inv = inventory?.items || (Array.isArray(inventory) ? inventory : []);
        inv.forEach(item => {
            const sku = item.sku || item.default_code;
            if (sku && (item.unitCost > 0 || item.lst_price > 0)) map[sku] = item.unitCost || item.lst_price;
        });
        return map;
    }, [inventory]);

    // Reconciliation data — recalculates whenever inventory or session changes (includes lots/expiry + value)
    const reconciliationData = useMemo(() => {
        if (!activeSession || (fcMode !== 'reconcile' && activeSession.status !== 'closed')) return null;
        const { liveMap, frozenMap, liveLotMap, frozenLotMap } = buildInventoryMaps(activeSession);
        return activeSession.counts
            .filter(c => c.countedQty !== null)
            .map(c => {
                const key = `${c.sku}::${c.location || ''}`;
                const snapshotQty = frozenMap[key] ?? c.systemQty;
                const currentQty = liveMap[key] ?? snapshotQty;
                const movement = currentQty - snapshotQty;
                const adjustedVariance = c.countedQty - currentQty;
                const snapshotLots = frozenLotMap[key] || c.lots || [];
                const currentLots = liveLotMap[key] || [];
                const unitPrice = priceMap[c.sku] || 0;
                const varianceValue = adjustedVariance * unitPrice;
                return { ...c, snapshotQty, currentQty, movement, adjustedVariance, snapshotLots, currentLots, unitPrice, varianceValue };
            });
    }, [activeSession, fcMode, buildInventoryMaps, priceMap]);

    const closeFullCount = useCallback(async (sessionId) => {
        const session = fullCountSessions.find(s => s.id === sessionId);
        if (!session) return;

        // Movement Delta: compare counted vs CURRENT Odoo qty (not snapshot)
        const { liveMap, frozenMap, liveLotMap, frozenLotMap } = buildInventoryMaps(session);
        const reconciledItems = session.counts
            .filter(c => c.countedQty !== null)
            .map(c => {
                const key = `${c.sku}::${c.location || ''}`;
                const snapshotQty = frozenMap[key] ?? c.systemQty;
                const currentQty = liveMap[key] ?? snapshotQty;
                const movement = currentQty - snapshotQty;
                const adjustedVariance = c.countedQty - currentQty;
                const snapshotLots = frozenLotMap[key] || c.lots || [];
                const currentLots = liveLotMap[key] || [];
                const unitPrice = priceMap[c.sku] || 0;
                const varianceValue = adjustedVariance * unitPrice;
                return { ...c, snapshotQty, currentQty, movement, adjustedVariance, snapshotLots, currentLots, unitPrice, varianceValue };
            });

        const varianceItems = reconciledItems.filter(c => c.adjustedVariance !== 0);
        const totalVarianceQty = reconciledItems.reduce((sum, c) => sum + Math.abs(c.adjustedVariance), 0);
        const totalVarianceValue = reconciledItems.reduce((sum, c) => sum + c.varianceValue, 0);

        let odooResult = null;
        if (varianceItems.length > 0 && apiConfigs?.odoo) {
            setIsApplying(true);
            try {
                odooResult = await applyFullCountAdjustments(apiConfigs.odoo, {
                    sessionId,
                    sessionName: session.name,
                    items: varianceItems.map(c => ({
                        sku: c.sku, location: c.location,
                        systemQty: c.currentQty,
                        countedQty: c.countedQty,
                        variance: c.adjustedVariance,
                    })),
                    approvedBy: user?.username || 'admin',
                });
                setApplyResult(odooResult);
                if (odooResult.status === 'success') {
                    addToast?.(`Full Count approved — ${odooResult.applied} adjustments sent to Odoo`, 'success');
                } else {
                    addToast?.(`Partial: ${odooResult.applied} applied, ${odooResult.failed} failed — check details`, 'warning');
                }
            } catch (err) {
                addToast?.(`Odoo error: ${err.message}. Count saved locally.`, 'error');
                odooResult = { status: 'error', error: err.message, applied: 0, failed: varianceItems.length };
                setApplyResult(odooResult);
            } finally {
                setIsApplying(false);
            }
        } else if (varianceItems.length === 0) {
            addToast?.('Full Count closed — no adjusted variances, no adjustments needed', 'success');
        } else {
            addToast?.('Full Count closed locally — connect Odoo to sync adjustments', 'info');
        }

        setFullCountSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
                ...s, status: 'closed', closedAt: new Date().toISOString(),
                counts: reconciledItems,
                reconciliation: {
                    ...s.reconciliation, totalVarianceQty, totalVarianceValue,
                    totalAdjustedVariances: varianceItems.length,
                    approvedBy: user?.username, approvedAt: new Date().toISOString(),
                    odooResult: odooResult ? {
                        status: odooResult.status, applied: odooResult.applied,
                        failed: odooResult.failed, syncedAt: new Date().toISOString(),
                    } : null,
                },
            };
        }));
        setActiveSession(null);
        setFcMode('list');
        logActivity?.('full-count-close', {
            sessionId, totalVarianceQty, adjustedVariances: varianceItems.length,
            odooApplied: odooResult?.applied || 0, odooFailed: odooResult?.failed || 0,
        });
    }, [user, addToast, logActivity, fullCountSessions, apiConfigs, buildInventoryMaps]);

    useEffect(() => {
        if (activeSession) {
            const updated = fullCountSessions.find(s => s.id === activeSession.id);
            if (updated) setActiveSession(updated);
        }
    }, [fullCountSessions]);

    // ═══════════════════════════════════════════════════════════════
    // ── RENDER: Counting Mode (Location -> Product -> Qty)
    // ═══════════════════════════════════════════════════════════════
    if (mode === 'counting' && selectedTask) {
        const abcCfg = ABC_CONFIG[selectedTask.abcGrade];
        const pendingList = myTasks.filter(t => !t.counted);
        const cat = PRODUCT_CATALOG[selectedTask.sku];

        const steps = [
            { key: 'scan-location', label: 'Location', Icon: MapPin, done: scanStep !== 'scan-location' },
            { key: 'scan-product', label: 'Product', Icon: QrCode, done: scanStep === 'enter-qty' },
            { key: 'enter-qty', label: 'Quantity', Icon: Hash, done: false },
        ];

        return (
            <div style={{ padding: '24px' }}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => { setSelectedTask(null); setMode('dashboard'); setScanStep('scan-location'); setScannedLocation(null); }}
                        style={{ padding: '8px', borderRadius: '4px', background: 'var(--odoo-surface-low)', border: 'none', cursor: 'pointer', color: 'var(--odoo-text)' }}>
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-purple)', letterSpacing: '-0.02em' }}>Blind Count</h2>
                        <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{stats.done}/{stats.total} completed</p>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: abcCfg.bg, color: abcCfg.color }}>
                        {selectedTask.abcGrade}
                    </span>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-1 mb-4" style={{ background: 'var(--odoo-surface-low)', borderRadius: '4px', padding: '8px' }}>
                    {steps.map((s, i) => (
                        <React.Fragment key={s.key}>
                            {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--odoo-text-muted)' }} />}
                            <div className="flex items-center gap-1.5 flex-1 justify-center" style={{
                                padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                background: scanStep === s.key ? 'var(--odoo-purple)' : s.done ? 'var(--odoo-success)' : 'transparent',
                                color: scanStep === s.key || s.done ? '#fff' : 'var(--odoo-text-muted)',
                            }}>
                                {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.Icon className="w-3.5 h-3.5" />}
                                {s.label}
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {/* Product info card */}
                <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px' }}>
                    <div className="flex gap-4">
                        <div style={{ width: '72px', height: '72px', borderRadius: '4px', border: '1px solid var(--odoo-border-ghost)', overflow: 'hidden', flexShrink: 0, background: 'var(--odoo-surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {cat?.image ? (
                                <img src={cat.image} alt={selectedTask.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <Image className="w-8 h-8" style={{ color: 'var(--odoo-text-muted)' }} />
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-purple)', fontFamily: '"Source Code Pro", monospace' }}>{selectedTask.sku}</p>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--odoo-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTask.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>
                                    <MapPin className="w-3 h-3" />{selectedTask.location || '—'}
                                </span>
                                {selectedTask.barcode && (
                                    <span style={{ fontSize: '11px', fontFamily: '"Source Code Pro", monospace', color: 'var(--odoo-text-muted)' }}>{selectedTask.barcode}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {blindMode && (
                        <div className="flex items-center gap-2 mt-3" style={{ padding: '8px 12px', background: 'var(--odoo-warning-light)', border: '1px solid var(--odoo-warning)', borderRadius: '4px' }}>
                            <Eye className="w-3.5 h-3.5" style={{ color: 'var(--odoo-warning-dark)' }} />
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--odoo-warning-dark)' }}>Blind Count Mode — system quantity hidden</span>
                        </div>
                    )}
                </div>

                {/* STEP 1: Scan Location */}
                {scanStep === 'scan-location' && (
                    <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px', borderLeft: '4px solid var(--odoo-purple)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>Step 1: Scan Location</h3>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', marginBottom: '12px' }}>
                            Go to <span style={{ fontWeight: 700, color: 'var(--odoo-purple)' }}>{selectedTask.location || 'assigned location'}</span> and scan the shelf QR/barcode
                        </p>
                        <div style={{ position: 'relative' }}>
                            <MapPin className="w-4 h-4" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--odoo-text-muted)' }} />
                            <input
                                ref={locScanRef}
                                value={scanInput}
                                onChange={e => setScanInput(e.target.value)}
                                onKeyDown={handleLocationScan}
                                placeholder="Scan location QR/barcode..."
                                style={{ ...inputStyle, fontSize: '16px', padding: '12px 16px 12px 36px', borderBottom: '2px solid var(--odoo-purple)' }}
                                autoFocus
                            />
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', marginTop: '8px' }}>Supports: QR (LOC:A-01-02), barcode, or type location code</p>
                    </div>
                )}

                {/* STEP 2: Scan Product */}
                {scanStep === 'scan-product' && (
                    <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px', borderLeft: '4px solid var(--odoo-success)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <QrCode className="w-5 h-5" style={{ color: 'var(--odoo-success)' }} />
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>Step 2: Scan Product</h3>
                            <span className="ml-auto flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--odoo-success)' }}>
                                <CheckCircle2 className="w-3 h-3" /> Location: {scannedLocation}
                            </span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', marginBottom: '12px' }}>
                            Scan the barcode on <span style={{ fontWeight: 700 }}>{selectedTask.sku}</span>
                        </p>
                        <div style={{ position: 'relative' }}>
                            <ScanLine className="w-4 h-4" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--odoo-text-muted)' }} />
                            <input
                                ref={scanRef}
                                value={scanInput}
                                onChange={e => setScanInput(e.target.value)}
                                onKeyDown={handleProductScan}
                                placeholder="Scan product barcode/QR..."
                                style={{ ...inputStyle, fontSize: '16px', padding: '12px 16px 12px 36px', borderBottom: '2px solid var(--odoo-success)' }}
                                autoFocus
                            />
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', marginTop: '8px' }}>Supports: EAN-13 barcode, QR (PRD:SKU|LOT:xxx), or type SKU</p>
                    </div>
                )}

                {/* STEP 3: Enter Quantity */}
                {scanStep === 'enter-qty' && (
                    <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px', borderLeft: '4px solid var(--odoo-purple)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Hash className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>Step 3: Enter Counted Quantity</h3>
                        </div>
                        <div className="flex items-center gap-2 mb-3" style={{ fontSize: '11px', color: 'var(--odoo-success)' }}>
                            <CheckCircle2 className="w-3 h-3" /> Location: {scannedLocation}
                            <CheckCircle2 className="w-3 h-3 ml-2" /> Product: {selectedTask.sku}
                        </div>

                        {(selectedTask.lotTracking || selectedTask.lots?.length > 0) && (
                            <div style={{ marginBottom: '12px' }}>
                                <label style={labelStyle}>Lot / Batch Number</label>
                                <input
                                    value={scannedLot}
                                    onChange={e => setScannedLot(e.target.value)}
                                    placeholder="Enter or scan lot number..."
                                    style={{ ...inputStyle, paddingLeft: '12px', marginTop: '4px' }}
                                />
                                {selectedTask.lots?.length > 0 && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {selectedTask.lots.map((l, li) => {
                                            const lotName = typeof l === 'string' ? l : l.lotNumber || `Lot-${li + 1}`;
                                            return (
                                                <button key={lotName + li} onClick={() => setScannedLot(lotName)}
                                                    style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', border: scannedLot === lotName ? '1px solid var(--odoo-purple)' : '1px solid var(--odoo-border-ghost)', background: scannedLot === lotName ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)', color: scannedLot === lotName ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)', cursor: 'pointer' }}>
                                                    {lotName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 items-center mb-3">
                            <button onClick={() => setCountInput(prev => String(Math.max(0, (parseInt(prev) || 0) - 1)))}
                                style={{ width: '48px', height: '48px', borderRadius: '4px', background: 'var(--odoo-surface-low)', border: 'none', fontSize: '20px', fontWeight: 700, color: 'var(--odoo-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                −
                            </button>
                            <input
                                ref={countRef}
                                type="number" min="0"
                                value={countInput}
                                onChange={e => setCountInput(e.target.value)}
                                onKeyDown={handleCountSubmit}
                                placeholder="0"
                                style={{ flex: 1, padding: '12px', fontSize: '28px', fontWeight: 800, textAlign: 'center', borderRadius: '4px', border: '2px solid var(--odoo-purple)', background: 'var(--odoo-surface)', color: 'var(--odoo-text)', outline: 'none' }}
                                autoFocus
                            />
                            <button onClick={() => setCountInput(prev => String((parseInt(prev) || 0) + 1))}
                                style={{ width: '48px', height: '48px', borderRadius: '4px', background: 'var(--odoo-surface-low)', border: 'none', fontSize: '20px', fontWeight: 700, color: 'var(--odoo-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                +
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => { if (countInput) handleCountSubmit({ key: 'Enter' }); }}
                                disabled={!countInput}
                                style={{ ...gradientBtnStyle, flex: 1, padding: '12px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: countInput ? 1 : 0.4 }}>
                                <Check className="w-5 h-5" /> Validate Count
                            </button>
                            <button onClick={() => {
                                const nextTask = myTasks.find(t => !t.counted && t.sku !== selectedTask.sku);
                                if (nextTask) {
                                    setSelectedTask(nextTask); setScanStep('scan-location'); setScannedLocation(null);
                                    setCountInput(''); setScannedLot('');
                                } else {
                                    setMode('dashboard'); setSelectedTask(null);
                                }
                            }}
                                style={{ ...outlineBtnStyle, padding: '12px 16px', fontSize: '12px' }}>
                                Skip
                            </button>
                        </div>
                    </div>
                )}

                {/* Already counted warning */}
                {selectedTask.counted && (
                    <div className="flex items-center gap-2 mb-4" style={{ padding: '12px', background: 'var(--odoo-warning-light)', border: '1px solid var(--odoo-warning)', borderRadius: '4px' }}>
                        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--odoo-warning-dark)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--odoo-warning-dark)' }}>
                            Already counted by {selectedTask.countedBy}. Re-submitting will overwrite.
                        </span>
                    </div>
                )}

                {/* Pending list */}
                <div style={{ ...cardStyle, padding: '16px' }}>
                    <h3 style={sectionHeaderStyle}>Remaining ({pendingList.length})</h3>
                    <div style={{ maxHeight: '160px', overflowY: 'auto' }} className="space-y-1">
                        {pendingList.map(t => (
                            <button key={t._key || t.sku} onClick={() => {
                                setSelectedTask(t); setScanStep('scan-location'); setScannedLocation(null);
                                setCountInput(''); setScannedLot('');
                            }}
                                className="w-full flex items-center justify-between"
                                style={{ padding: '8px 12px', borderRadius: '4px', fontSize: '13px', border: 'none', cursor: 'pointer', background: t.sku === selectedTask.sku ? 'var(--odoo-purple-light)' : 'transparent', color: 'var(--odoo-text)', textAlign: 'left' }}>
                                <div className="flex items-center gap-2">
                                    <span style={{ fontFamily: '"Source Code Pro", monospace', fontWeight: 600 }}>{t.sku}</span>
                                    {t.needsRecount && <RotateCcw className="w-3 h-3" style={{ color: 'var(--odoo-danger)' }} />}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{t.location}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ── RENDER: Supervisor Recount Mode
    // ═══════════════════════════════════════════════════════════════
    if (mode === 'recount') {
        const recountTasks = myTasks.filter(t => t.needsRecount);
        const activeRecount = recountTask || recountTasks[0] || null;

        if (activeRecount) {
            const cat = PRODUCT_CATALOG[activeRecount.sku];
            return (
                <div style={{ padding: '24px' }} className="space-y-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setMode('dashboard'); setRecountTask(null); }} style={{ padding: '8px', borderRadius: '4px', background: 'var(--odoo-surface-low)', border: 'none', cursor: 'pointer', color: 'var(--odoo-text)' }}>
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="flex items-center gap-2" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-text)' }}>
                                <ShieldCheck className="w-5 h-5" style={{ color: 'var(--odoo-warning)' }} />Supervisor Recount
                            </h2>
                            <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{recountTasks.length} items need verification</p>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, padding: '16px', borderLeft: '4px solid var(--odoo-warning)' }}>
                        <div className="flex gap-4 mb-4">
                            {cat?.image && (
                                <img src={cat.image} alt={activeRecount.name} style={{ width: '56px', height: '56px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--odoo-border-ghost)' }} />
                            )}
                            <div>
                                <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-purple)', fontFamily: '"Source Code Pro", monospace' }}>{activeRecount.sku}</p>
                                <p style={{ fontSize: '13px', color: 'var(--odoo-text)' }}>{activeRecount.name}</p>
                                <p className="flex items-center gap-1 mt-1" style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>
                                    <MapPin className="w-3 h-3" />{activeRecount.location}
                                </p>
                            </div>
                        </div>

                        <div className={`grid ${blindMode ? 'grid-cols-2' : 'grid-cols-3'} gap-3 mb-4`} style={{ padding: '12px', background: 'var(--odoo-surface-low)', borderRadius: '4px' }}>
                            {!blindMode && (
                                <div>
                                    <p style={{ ...labelStyle, fontSize: '10px' }}>System Qty</p>
                                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-text-secondary)' }}>{activeRecount.systemQty}</p>
                                </div>
                            )}
                            <div>
                                <p style={{ ...labelStyle, fontSize: '10px' }}>Original Count</p>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-text)' }}>{activeRecount.countedQty}</p>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>by {activeRecount.countedBy}</p>
                            </div>
                            <div>
                                <p style={{ ...labelStyle, fontSize: '10px' }}>Variance</p>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: activeRecount.variance > 0 ? 'var(--odoo-purple)' : 'var(--odoo-danger)' }}>
                                    {activeRecount.variance > 0 ? '+' : ''}{activeRecount.variance}
                                </p>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>{activeRecount.variancePct || '?'}%</p>
                            </div>
                        </div>

                        <label style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>Your Recount{blindMode ? ' (Blind)' : ''}</label>
                        <div className="flex gap-3">
                            <input type="number" min="0" value={recountInput}
                                onChange={e => setRecountInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key !== 'Enter' || !recountInput.trim()) return;
                                    submitSupervisorRecount(activeRecount, parseInt(recountInput));
                                    setRecountInput('');
                                    const next = recountTasks.find(t => t.sku !== activeRecount.sku);
                                    setRecountTask(next || null);
                                    if (!next) setMode('dashboard');
                                }}
                                placeholder="Enter count..."
                                style={{ flex: 1, padding: '12px', fontSize: '18px', fontWeight: 700, textAlign: 'center', borderRadius: '4px', border: '2px solid var(--odoo-warning)', background: 'var(--odoo-surface)', color: 'var(--odoo-text)', outline: 'none' }}
                                autoFocus
                            />
                            <button onClick={() => {
                                if (!recountInput) return;
                                submitSupervisorRecount(activeRecount, parseInt(recountInput));
                                setRecountInput('');
                                const next = recountTasks.find(t => t.sku !== activeRecount.sku);
                                setRecountTask(next || null);
                                if (!next) setMode('dashboard');
                            }}
                                style={{ ...gradientBtnStyle, padding: '12px 20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--odoo-warning)' }}>
                                <ShieldCheck className="w-5 h-5" /> Verify
                            </button>
                        </div>
                    </div>

                    {recountTasks.length > 1 && (
                        <div style={{ ...cardStyle, padding: '16px' }}>
                            <h3 style={sectionHeaderStyle}>Pending Recounts ({recountTasks.length})</h3>
                            <div className="space-y-1">
                                {recountTasks.map(t => (
                                    <button key={t._key || t.sku} onClick={() => { setRecountTask(t); setRecountInput(''); }}
                                        className="w-full flex items-center justify-between"
                                        style={{ padding: '8px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '13px', background: t.sku === activeRecount?.sku ? 'var(--odoo-warning-light)' : 'transparent', color: 'var(--odoo-text)', textAlign: 'left' }}>
                                        <span style={{ fontFamily: '"Source Code Pro", monospace', fontWeight: 600 }}>{t.sku}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{t.location}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--odoo-success)' }} />
                <p style={{ color: 'var(--odoo-text-muted)' }}>No items need recounting</p>
                <button onClick={() => setMode('dashboard')} style={{ ...gradientBtnStyle, marginTop: '16px', padding: '8px 16px', fontSize: '12px' }}>Back to Dashboard</button>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ── RENDER: History
    // ═══════════════════════════════════════════════════════════════
    if (mode === 'history') {
        const dateRecords = expandedDate ? countRecords.filter(r => r.date === expandedDate) : [];

        return (
            <div style={{ padding: '24px' }} className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => setMode('dashboard')} style={{ padding: '8px', borderRadius: '4px', background: 'var(--odoo-surface-low)', border: 'none', cursor: 'pointer', color: 'var(--odoo-text)' }}>
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-text)' }}>Count History</h2>
                    <span style={{ fontSize: '12px', color: 'var(--odoo-text-muted)' }}>{countRecords.length} records</span>
                    <button onClick={() => handleExportCycleCountPDF(expandedDate || countDate)}
                        style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', border: '1px solid var(--odoo-purple)', background: 'var(--odoo-surface)', color: 'var(--odoo-purple)', cursor: 'pointer', fontWeight: 600 }}>
                        <Printer className="w-3.5 h-3.5" /> Print Report
                    </button>
                </div>

                {historyByDate.length === 0 ? (
                    <div style={{ ...cardStyle, padding: '48px', textAlign: 'center' }}>
                        <Archive className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--odoo-text-muted)' }} />
                        <p style={{ color: 'var(--odoo-text-muted)' }}>No count history yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {historyByDate.map(h => (
                            <div key={h.date} style={cardStyle}>
                                <button onClick={() => setExpandedDate(expandedDate === h.date ? null : h.date)}
                                    className="w-full flex items-center justify-between" style={{ padding: '16px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--odoo-text)', textAlign: 'left' }}>
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-5 h-5" style={{ color: 'var(--odoo-text-muted)' }} />
                                        <div>
                                            <p style={{ fontWeight: 700, color: 'var(--odoo-text)' }}>{h.date}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{h.total} items counted {h.recounts > 0 && `| ${h.recounts} recounted`}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: h.accuracy >= 95 ? 'var(--odoo-success)' : h.accuracy >= 80 ? 'var(--odoo-warning)' : 'var(--odoo-danger)' }}>
                                                {h.accuracy}% match
                                            </p>
                                            {h.variances > 0 && <p style={{ fontSize: '11px', color: 'var(--odoo-danger)' }}>{h.variances} variance{h.variances > 1 ? 's' : ''}</p>}
                                        </div>
                                        {expandedDate === h.date ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />}
                                    </div>
                                </button>
                                {expandedDate === h.date && (
                                    <div style={{ borderTop: '1px solid var(--odoo-border-ghost)', padding: '16px' }}>
                                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>SKU</th>
                                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Location</th>
                                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Lot</th>
                                                    <th style={{ textAlign: 'center', padding: '4px 0' }}>System</th>
                                                    <th style={{ textAlign: 'center', padding: '4px 0' }}>Counted</th>
                                                    <th style={{ textAlign: 'center', padding: '4px 0' }}>Supervisor</th>
                                                    <th style={{ textAlign: 'center', padding: '4px 0' }}>Variance</th>
                                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Status</th>
                                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dateRecords.map(r => (
                                                    <tr key={r._key || `${r.sku}-${r.location || idx}`} style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                                                        <td style={{ padding: '8px 0', fontFamily: '"Source Code Pro", monospace', fontWeight: 600, color: 'var(--odoo-text)' }}>{r.sku}</td>
                                                        <td style={{ padding: '8px 0', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{r.location}</td>
                                                        <td style={{ padding: '8px 0', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{r.lot || '—'}</td>
                                                        <td style={{ padding: '8px 0', textAlign: 'center', color: 'var(--odoo-text-secondary)' }}>{r.systemQty}</td>
                                                        <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: 700, color: 'var(--odoo-text)' }}>{r.countedQty}</td>
                                                        <td style={{ padding: '8px 0', textAlign: 'center', color: 'var(--odoo-text-secondary)' }}>{r.supervisorCount ?? '—'}</td>
                                                        <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: 700, color: r.variance === 0 ? 'var(--odoo-success)' : r.variance > 0 ? 'var(--odoo-purple)' : 'var(--odoo-danger)' }}>
                                                            {r.variance === 0 ? '—' : `${r.variance > 0 ? '+' : ''}${r.variance}`}
                                                        </td>
                                                        <td style={{ padding: '8px 0' }}>
                                                            <span style={{
                                                                padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                                background: r.status === 'matched' ? 'var(--odoo-success-bg)' : r.status === 'recount-done' ? 'var(--odoo-purple-light)' : r.status === 'needs-recount' ? 'var(--odoo-danger-light)' : 'var(--odoo-warning-light)',
                                                                color: r.status === 'matched' ? 'var(--odoo-success-dark)' : r.status === 'recount-done' ? 'var(--odoo-purple)' : r.status === 'needs-recount' ? 'var(--odoo-danger)' : 'var(--odoo-warning-dark)',
                                                            }}>
                                                                {r.status === 'matched' ? 'Match' : r.status === 'recount-done' ? 'Recounted' : r.status === 'needs-recount' ? 'Needs Recount' : 'Auto-OK'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '8px 0', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{r.countedBy}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ── RENDER: Notifications panel
    // ═══════════════════════════════════════════════════════════════
    if (showNotifications) {
        return (
            <div style={{ padding: '24px' }} className="space-y-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => { setShowNotifications(false); markNotificationsRead(user?.username); }}
                        style={{ padding: '8px', borderRadius: '4px', background: 'var(--odoo-surface-low)', border: 'none', cursor: 'pointer', color: 'var(--odoo-text)' }}>
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="flex items-center gap-2" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-text)' }}>
                        <Bell className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} /> Notifications
                    </h2>
                    <span style={{ fontSize: '12px', color: 'var(--odoo-text-muted)' }}>{notifications.length}</span>
                </div>

                {notifications.length === 0 ? (
                    <div style={{ ...cardStyle, padding: '48px', textAlign: 'center' }}>
                        <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--odoo-text-muted)' }} />
                        <p style={{ color: 'var(--odoo-text-muted)' }}>No notifications</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {notifications.slice(0, 20).map(n => {
                            return (
                                <div key={n.id} style={{ ...cardStyle, padding: '16px', borderLeft: !n.read ? '3px solid var(--odoo-purple)' : '3px solid transparent' }}>
                                    <div className="flex items-start gap-3">
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: n.type === 'assignment' ? 'var(--odoo-purple-light)' : n.type === 'recount' ? 'var(--odoo-warning-light)' : 'var(--odoo-success-light)' }}>
                                            {n.type === 'assignment' ? <ClipboardCheck className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> :
                                             n.type === 'recount' ? <RotateCcw className="w-4 h-4" style={{ color: 'var(--odoo-warning)' }} /> :
                                             <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--odoo-success)' }} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '13px', color: 'var(--odoo-text)' }}>{n.message}</p>
                                            <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', marginTop: '4px' }}>{formatDateTime(n.createdAt)}</p>
                                        </div>
                                        {!n.read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--odoo-purple)', flexShrink: 0, marginTop: '8px' }} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ── DASHBOARD (default) — Stitch Design
    // ═══════════════════════════════════════════════════════════════
    return (
        <div style={{ padding: '24px' }}>
            {/* Summary Strip — 4 stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div style={{ ...cardStyle, padding: '16px', borderLeft: '4px solid var(--odoo-purple)' }}>
                    <div className="flex items-center justify-between">
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Counts Today</span>
                        <ClipboardCheck className="w-[18px] h-[18px]" style={{ color: 'var(--odoo-purple)' }} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--odoo-text)', marginTop: '4px' }}>{stats.done}</div>
                </div>
                <div style={{ ...cardStyle, padding: '16px', borderLeft: '4px solid var(--odoo-success)' }}>
                    <div className="flex items-center justify-between">
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Accuracy Rate</span>
                        <TrendingUp className="w-[18px] h-[18px]" style={{ color: 'var(--odoo-success)' }} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--odoo-text)', marginTop: '4px' }}>{stats.done > 0 ? `${stats.accuracy}%` : '—'}</div>
                </div>
                <div style={{ ...cardStyle, padding: '16px', borderLeft: '4px solid var(--odoo-danger)' }}>
                    <div className="flex items-center justify-between">
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Variance Items</span>
                        <AlertTriangle className="w-[18px] h-[18px]" style={{ color: 'var(--odoo-danger)' }} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--odoo-text)', marginTop: '4px' }}>{stats.variances}</div>
                </div>
                <div style={{ ...cardStyle, padding: '16px', borderLeft: '4px solid var(--odoo-text-muted)' }}>
                    <div className="flex items-center justify-between">
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Pending Locations</span>
                        <MapPin className="w-[18px] h-[18px]" style={{ color: 'var(--odoo-text-muted)' }} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--odoo-text)', marginTop: '4px' }}>{stats.pending}</div>
                </div>
            </div>

            {/* Main Content: 2-column grid */}
            <div className="grid grid-cols-12 gap-6">

                {/* LEFT: Active Cycle Count Card (7 cols) */}
                <div className="col-span-12 lg:col-span-7">
                    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                        {/* Card header bar */}
                        <div className="flex justify-between items-center" style={{ padding: '12px 24px', background: 'var(--odoo-surface-low)' }}>
                            <div className="flex items-center gap-3">
                                <ScanLine className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                                <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--odoo-purple)', letterSpacing: '-0.02em' }}>Active Cycle Count</h2>
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: blindMode ? 'var(--odoo-warning)' : 'var(--odoo-success)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {blindMode ? <><Eye className="w-3 h-3" /> Blind Mode</> : <><Unlock className="w-3 h-3" /> System Qty Visible</>}
                            </span>
                        </div>

                        {/* Card body — centered content */}
                        <div style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%', maxWidth: '480px' }} className="space-y-6">
                                {/* Current Location Display */}
                                <div className="flex flex-col items-center gap-2">
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current Location</span>
                                    <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--odoo-text)', background: 'var(--odoo-surface-low)', padding: '12px 24px', borderRadius: '8px', border: '2px solid var(--odoo-border-ghost)' }}>
                                        {selectedTask?.location || myTasks[0]?.location || 'A-01-01'}
                                    </div>
                                </div>

                                {/* SKU Scan Input */}
                                <div className="space-y-2">
                                    <label style={labelStyle}>Product SKU Scan</label>
                                    <div style={{ position: 'relative' }}>
                                        <ScanLine className="w-5 h-5" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--odoo-text-muted)' }} />
                                        <input
                                            ref={scanRef}
                                            value={scanInput}
                                            onChange={e => setScanInput(e.target.value)}
                                            onKeyDown={handleDashboardScan}
                                            placeholder="Scan SKU..."
                                            style={{ width: '100%', height: '56px', paddingLeft: '48px', paddingRight: '16px', fontFamily: '"Source Code Pro", monospace', fontSize: '18px', fontWeight: 600, background: 'var(--odoo-surface-low)', border: 'none', borderBottom: '2px solid var(--odoo-purple)', borderRadius: '4px 4px 0 0', color: 'var(--odoo-text)', outline: 'none' }}
                                        />
                                    </div>
                                </div>

                                {/* Expected / Counted Qty */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label style={labelStyle}>Expected Qty</label>
                                        <input
                                            type="number"
                                            value={blindMode ? '—' : (selectedTask?.systemQty ?? myTasks[0]?.systemQty ?? 12)}
                                            readOnly
                                            style={{ width: '100%', height: '48px', textAlign: 'center', fontWeight: 700, fontSize: '18px', background: 'var(--odoo-surface-high)', border: 'none', borderRadius: '4px', color: 'var(--odoo-text)', opacity: 0.6, cursor: 'not-allowed' }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label style={labelStyle}>Counted Qty</label>
                                        <input
                                            type="number"
                                            value={countInput}
                                            onChange={e => setCountInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && countInput && selectedTask) {
                                                    handleCountSubmit(e);
                                                }
                                            }}
                                            placeholder="0"
                                            style={{ width: '100%', height: '48px', textAlign: 'center', fontWeight: 700, fontSize: '20px', background: 'var(--odoo-surface)', border: '2px solid var(--odoo-border-ghost)', borderRadius: '4px', color: 'var(--odoo-text)', outline: 'none' }}
                                        />
                                    </div>
                                </div>

                                {/* Variance Display */}
                                {(() => {
                                    const currentTask = selectedTask || myTasks[0];
                                    const countedVal = parseInt(countInput) || 0;
                                    const variance = currentTask ? countedVal - (currentTask.systemQty || 0) : 0;
                                    const isMatch = variance === 0 && countInput !== '';
                                    return (
                                        <div className="flex items-center justify-between" style={{
                                            padding: '16px', borderRadius: '4px',
                                            background: isMatch ? 'rgba(1, 126, 132, 0.08)' : 'rgba(228, 111, 120, 0.08)',
                                            border: `1px solid ${isMatch ? 'rgba(1, 126, 132, 0.2)' : 'rgba(228, 111, 120, 0.2)'}`,
                                        }}>
                                            <div className="flex items-center gap-3">
                                                {isMatch ? (
                                                    <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--odoo-success)' }} />
                                                ) : (
                                                    <AlertTriangle className="w-5 h-5" style={{ color: 'var(--odoo-danger)' }} />
                                                )}
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: isMatch ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                                                    {isMatch ? 'Match Confirmed' : (countInput === '' ? 'Enter quantity' : 'Variance Detected')}
                                                </span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase' }}>Variance</span>
                                                <span style={{ fontSize: '18px', fontWeight: 900, color: isMatch ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                                                    {countInput === '' ? '—' : variance}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Validate Button */}
                                <button
                                    onClick={() => {
                                        const first = myTasks.find(t => !t.counted) || myTasks[0];
                                        if (first) {
                                            setSelectedTask(first); setMode('counting'); setScanStep('scan-location');
                                            setScannedLocation(null); setCountInput(''); setScannedLot('');
                                        }
                                    }}
                                    style={{ ...gradientBtnStyle, width: '100%', height: '52px', fontSize: '13px', letterSpacing: '0.2em', boxShadow: '0 4px 12px rgba(87, 52, 79, 0.25)', borderRadius: '4px' }}>
                                    Validate Count
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Side Actions (5 cols) */}
                <div className="col-span-12 lg:col-span-5 space-y-6">
                    {/* Count Management */}
                    <div style={{ ...cardStyle, padding: '24px' }}>
                        <h3 style={sectionHeaderStyle}>Count Management</h3>
                        <div className="space-y-3">
                            <div style={{ position: 'relative' }}>
                                <MapPin className="w-[18px] h-[18px]" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--odoo-text-muted)' }} />
                                <input
                                    value={locationSearch}
                                    onChange={e => setLocationSearch(e.target.value)}
                                    placeholder="Search Location..."
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ position: 'relative' }}>
                                <Calendar className="w-[18px] h-[18px]" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--odoo-text-muted)' }} />
                                <input
                                    type="date"
                                    value={countDate}
                                    onChange={e => setCountDate(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            {/* Filter tabs */}
                            <div className="flex gap-1" style={{ padding: '4px', background: 'var(--odoo-surface-low)', borderRadius: '4px' }}>
                                {['all', 'match', 'mismatch'].map(f => (
                                    <button key={f} onClick={() => {
                                        setMgmtFilter(f);
                                        if (f === 'all') setFilterStatus('all');
                                        else if (f === 'match') setFilterStatus('counted');
                                        else setFilterStatus('variance');
                                    }}
                                        style={{
                                            flex: 1, padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                                            background: mgmtFilter === f ? 'var(--odoo-surface)' : 'transparent',
                                            color: mgmtFilter === f ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)',
                                            boxShadow: mgmtFilter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        }}>
                                        {f === 'all' ? 'All' : f === 'match' ? 'Match' : 'Mismatch'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button onClick={() => {
                                const first = myTasks.find(t => !t.counted) || myTasks[0];
                                if (first) {
                                    setSelectedTask(first); setMode('counting'); setScanStep('scan-location');
                                    setScannedLocation(null); setCountInput(''); setScannedLot('');
                                }
                            }}
                                style={{ ...gradientBtnStyle, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Plus className="w-4 h-4" /> Start New Count
                            </button>
                            <button onClick={() => handleExportCycleCountPDF(countDate)}
                                style={{ ...outlineBtnStyle, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Printer className="w-4 h-4" /> Print Report
                            </button>
                        </div>
                    </div>

                    {/* Storage Map */}
                    <div style={{ ...cardStyle, padding: '24px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--odoo-text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Storage Map Alpha</h3>
                        <div style={{ aspectRatio: '16/9', background: 'var(--odoo-surface-low)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: '6px', width: '100%', height: '100%', padding: '16px', position: 'relative' }}>
                                {Array.from({ length: 12 }).map((_, i) => {
                                    let bg = 'rgba(75, 93, 51, 0.5)';
                                    if (i === 2) bg = 'var(--odoo-purple)';
                                    if (i === 7) bg = 'var(--odoo-danger)';
                                    return <div key={i} style={{ background: bg, borderRadius: '2px', opacity: i === 2 ? 1 : 0.7 }} />;
                                })}
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-3" style={{ fontSize: '11px', fontWeight: 500, color: 'var(--odoo-text-muted)' }}>
                            <div className="flex items-center gap-1.5">
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--odoo-purple)' }} />
                                Current Focus
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(75, 93, 51, 0.6)' }} />
                                Verified
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--odoo-danger)' }} />
                                Flagged
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM: Recent Count History Table (full width) */}
                <div className="col-span-12">
                    <div style={cardStyle}>
                        <div className="flex justify-between items-center" style={{ padding: '12px 24px', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--odoo-text)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Count History</h3>
                            <button onClick={() => setMode('history')} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-purple)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer' }}>
                                View All Activities
                            </button>
                        </div>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--odoo-surface-low)', fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    <th style={{ padding: '10px 24px' }}>Location</th>
                                    <th style={{ padding: '10px 24px' }}>Product SKU</th>
                                    <th style={{ padding: '10px 24px', textAlign: 'center' }}>Expected</th>
                                    <th style={{ padding: '10px 24px', textAlign: 'center' }}>Counted</th>
                                    <th style={{ padding: '10px 24px', textAlign: 'center' }}>Variance</th>
                                    <th style={{ padding: '10px 24px' }}>Status</th>
                                    <th style={{ padding: '10px 24px', textAlign: 'right' }}>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '13px', fontWeight: 500 }}>
                                {countRecords.slice(0, 10).map((r, idx) => {
                                    const isMatch = r.variance === 0;
                                    return (
                                        <tr key={`${r.sku}-${r.date}-${idx}`} style={{ transition: 'background 0.15s', cursor: 'pointer' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--odoo-surface-high)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '10px 24px', fontWeight: 700, color: 'var(--odoo-purple)' }}>{r.location || '—'}</td>
                                            <td style={{ padding: '10px 24px', fontFamily: '"Source Code Pro", monospace', fontSize: '11px', color: 'var(--odoo-text-secondary)' }}>{r.sku}</td>
                                            <td style={{ padding: '10px 24px', textAlign: 'center', color: 'var(--odoo-text-muted)' }}>{r.systemQty}</td>
                                            <td style={{ padding: '10px 24px', textAlign: 'center', color: 'var(--odoo-text)' }}>{r.countedQty}</td>
                                            <td style={{ padding: '10px 24px', textAlign: 'center', fontWeight: 700, color: isMatch ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                                                {isMatch ? '0' : `${r.variance > 0 ? '+' : ''}${r.variance}`}
                                            </td>
                                            <td style={{ padding: '10px 24px' }}>
                                                <div className="flex items-center gap-2" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: isMatch ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isMatch ? 'var(--odoo-success)' : 'var(--odoo-danger)' }} />
                                                    {isMatch ? 'Match' : 'Mismatch'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 24px', textAlign: 'right', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>
                                                {r.countedAt ? formatTime(r.countedAt) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {countRecords.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--odoo-text-muted)', fontSize: '13px' }}>
                                            No count records yet. Start counting to see history here.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Tab bar below the main dashboard */}
            <div className="flex gap-1 mt-6 mb-4" style={{ background: 'var(--odoo-surface-low)', borderRadius: '4px', padding: '4px' }}>
                {[
                    { key: 'cycle', label: 'Cycle Count', icon: <RefreshCw className="w-4 h-4" /> },
                    { key: 'fullcount', label: 'Full Count', icon: <ClipboardCheck className="w-4 h-4" /> },
                    { key: 'map', label: 'Warehouse Map', icon: <MapPin className="w-4 h-4" /> },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className="flex items-center gap-1.5 flex-1 justify-center"
                        style={{
                            padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                            background: activeTab === tab.key ? 'var(--odoo-surface)' : 'transparent',
                            color: activeTab === tab.key ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)',
                            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}>
                        {tab.icon} {tab.label}
                        {tab.key === 'fullcount' && stockFrozen && (
                            <Lock className="w-3 h-3 ml-1" style={{ color: 'var(--odoo-danger)' }} />
                        )}
                    </button>
                ))}
            </div>

            {/* Stock Frozen Banner */}
            {stockFrozen && (
                <div className="flex items-center gap-3 mb-4" style={{ padding: '12px', background: 'var(--odoo-purple-light)', border: '1px solid var(--odoo-purple-border, var(--odoo-purple))', borderRadius: '4px' }}>
                    <Lock className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--odoo-purple)' }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-purple-dark)' }}>Stock Frozen — Full Count in Progress</p>
                        <p style={{ fontSize: '11px', color: 'var(--odoo-purple)' }}>Pick and Pack operations are paused until count is complete</p>
                    </div>
                </div>
            )}

            {/* TAB: WAREHOUSE MAP */}
            {activeTab === 'map' && (
                <WarehouseMap
                    inventory={inventory} activityLogs={activityLogs}
                    countData={countRecords}
                    fullCountSession={fullCountSessions.find(s => s.status !== 'closed')}
                    language="en"
                />
            )}

            {/* TAB: FULL COUNT — LIST */}
            {activeTab === 'fullcount' && fcMode === 'list' && (
                <div className="space-y-4">
                    {fullCountSessions.filter(s => s.status !== 'closed').map(session => (
                        <div key={session.id} style={{ ...cardStyle, padding: '20px', borderLeft: '4px solid var(--odoo-purple)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span style={{ fontSize: '16px' }}>{FC_STATUS[session.status]?.icon}</span>
                                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-text)' }}>{session.name}</h3>
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, backgroundColor: FC_STATUS[session.status]?.color + '20', color: FC_STATUS[session.status]?.color }}>
                                            {FC_STATUS[session.status]?.label}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', marginTop: '4px' }}>Created: {formatDate(session.createdAt)}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '24px', fontWeight: 900, color: 'var(--odoo-purple)' }}>{session.progress.counted}/{session.progress.total}</p>
                                    <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>items counted</p>
                                </div>
                            </div>

                            <div style={{ width: '100%', height: '10px', background: 'var(--odoo-surface-high)', borderRadius: '999px', marginBottom: '12px' }}>
                                <div style={{ height: '10px', borderRadius: '999px', transition: 'width 0.3s', background: session.progress.counted === session.progress.total && session.progress.total > 0 ? 'var(--odoo-success)' : 'var(--odoo-purple)', width: `${session.progress.total > 0 ? (session.progress.counted / session.progress.total) * 100 : 0}%` }} />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                                {Object.entries(session.progress.byZone || {}).map(([zone, data]) => (
                                    <div key={zone} style={{ background: 'var(--odoo-surface-low)', borderRadius: '4px', padding: '10px' }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: ZONE_COLORS[zone] || 'var(--odoo-text-muted)' }}>Zone {zone}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{data.done}/{data.total}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '4px', background: 'var(--odoo-surface-high)', borderRadius: '999px' }}>
                                            <div style={{ height: '4px', borderRadius: '999px', background: data.done === data.total && data.total > 0 ? 'var(--odoo-success)' : 'var(--odoo-purple)', width: `${data.total > 0 ? (data.done / data.total) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                {session.status === 'planning' && (
                                    <>
                                        <button onClick={() => { freezeStock(session.id); }}
                                            style={{ ...gradientBtnStyle, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Lock className="w-4 h-4" /> Freeze & Start
                                        </button>
                                        <button onClick={() => { setActiveSession(session); setFcMode('counting'); }}
                                            style={{ ...outlineBtnStyle, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--odoo-success)', color: 'var(--odoo-success)' }}>
                                            <Eye className="w-4 h-4" /> Start Without Freeze
                                        </button>
                                    </>
                                )}
                                {(session.status === 'frozen' || session.status === 'counting') && (
                                    <>
                                        <button onClick={() => { setActiveSession(session); setFcMode('counting'); }}
                                            style={{ ...gradientBtnStyle, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ScanLine className="w-4 h-4" /> Continue Counting
                                        </button>
                                        {session.status === 'frozen' && (
                                            <button onClick={() => unfreezeStock(session.id)}
                                                style={{ ...outlineBtnStyle, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--odoo-warning)', color: 'var(--odoo-warning)' }}>
                                                <Unlock className="w-4 h-4" /> Unfreeze
                                            </button>
                                        )}
                                        {session.progress.counted > 0 && (
                                            <button onClick={() => { setActiveSession(session); setFcMode('reconcile'); }}
                                                style={{ ...outlineBtnStyle, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--odoo-purple)', color: 'var(--odoo-purple)' }}>
                                                <BarChart3 className="w-4 h-4" /> Reconcile
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}

                    {!fullCountSessions.some(s => s.status !== 'closed') && (
                        <div style={{ ...cardStyle, padding: '24px', border: '2px dashed var(--odoo-border-ghost)' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text-secondary)', marginBottom: '16px' }}>Create Full Count Session</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label style={labelStyle}>Session Name</label>
                                    <input value={fcForm.name} onChange={e => setFcForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder={`Full Count ${new Date().toISOString().split('T')[0].substring(0, 7)}`}
                                        style={{ ...inputStyle, paddingLeft: '12px', marginTop: '4px' }} />
                                </div>
                                <div className="space-y-2">
                                    {isAdmin ? (
                                        <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>
                                            <input type="checkbox" checked={fcForm.blindCount} onChange={e => setFcForm(f => ({ ...f, blindCount: e.target.checked }))} style={{ borderRadius: '2px' }} />
                                            Blind Count (hide system qty)
                                        </label>
                                    ) : (
                                        <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Eye className="w-3.5 h-3.5" /> Blind Count: Enabled
                                        </p>
                                    )}
                                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>
                                        <input type="checkbox" checked={fcForm.requireDoubleCount} onChange={e => setFcForm(f => ({ ...f, requireDoubleCount: e.target.checked }))} style={{ borderRadius: '2px' }} />
                                        Require Double Count
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>
                                        <input type="checkbox" checked={fcForm.freezeStock} onChange={e => setFcForm(f => ({ ...f, freezeStock: e.target.checked }))} style={{ borderRadius: '2px' }} />
                                        Freeze Stock (block picks)
                                    </label>
                                </div>
                            </div>
                            <button onClick={createFullCount}
                                style={{ ...gradientBtnStyle, padding: '10px 20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus className="w-4 h-4" /> Create Full Count
                            </button>
                        </div>
                    )}

                    {fullCountSessions.filter(s => s.status === 'closed').length > 0 && (
                        <div style={{ ...cardStyle, padding: '16px' }}>
                            <h3 style={sectionHeaderStyle}>Past Sessions</h3>
                            <div className="space-y-2">
                                {fullCountSessions.filter(s => s.status === 'closed').map(s => (
                                    <div key={s.id} className="flex items-center justify-between" style={{ padding: '12px', background: 'var(--odoo-surface-low)', borderRadius: '4px' }}>
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--odoo-text)' }}>{s.name}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{formatDate(s.closedAt)} — {s.progress.total} items</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: s.progress.matched === s.progress.total ? 'var(--odoo-success)' : 'var(--odoo-warning)' }}>
                                                {s.progress.total > 0 ? Math.round((s.progress.matched / s.progress.total) * 100) : 0}% match
                                            </p>
                                            <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{s.progress.variance} variances</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* FULL COUNT: COUNTING MODE */}
            {activeTab === 'fullcount' && fcMode === 'counting' && activeSession && (
                <div className="space-y-4">
                    <button onClick={() => { setFcMode('list'); setFcSelectedItem(null); }}
                        className="flex items-center gap-1" style={{ fontSize: '12px', color: 'var(--odoo-purple)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <ChevronLeft className="w-4 h-4" /> Back to session
                    </button>

                    <WarehouseMap
                        inventory={inventory} activityLogs={activityLogs}
                        fullCountSession={activeSession} isEmbedded
                        onCountBin={(bin, stock) => {
                            const item = activeSession.counts.find(c => c.binId === bin.id);
                            if (item) { setFcSelectedItem(item); setFcCountInput(''); setFcScannedLot(''); }
                        }}
                        language="en"
                    />

                    {fcSelectedItem && (
                        <div style={{ ...cardStyle, padding: '16px', borderLeft: '4px solid var(--odoo-purple)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>{fcSelectedItem.location} — {fcSelectedItem.sku}</p>
                                    <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{fcSelectedItem.name}</p>
                                </div>
                                {!activeSession.settings.blindCount && (
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)' }}>System Qty</p>
                                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--odoo-text-secondary)' }}>{fcSelectedItem.systemQty}</p>
                                    </div>
                                )}
                            </div>
                            {(fcSelectedItem.lotTracking || fcSelectedItem.lots?.length > 0) && (
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={labelStyle}>Lot / Batch Number</label>
                                    <input value={fcScannedLot} onChange={e => setFcScannedLot(e.target.value)}
                                        placeholder="Enter or scan lot number..."
                                        style={{ width: '100%', marginTop: '4px', padding: '8px 12px', border: '1px solid var(--odoo-border)', borderRadius: '4px', fontSize: '13px', background: 'var(--odoo-surface)', color: 'var(--odoo-text)', outline: 'none' }} />
                                    {fcSelectedItem.lots?.length > 0 && (
                                        <div className="flex gap-1 flex-wrap mt-1">
                                            {fcSelectedItem.lots.map((l, li) => {
                                                const lotName = typeof l === 'string' ? l : l.lotNumber || `Lot-${li + 1}`;
                                                return (
                                                    <button key={lotName + li} onClick={() => setFcScannedLot(lotName)}
                                                        style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', border: fcScannedLot === lotName ? '1px solid var(--odoo-purple)' : '1px solid var(--odoo-border-ghost)', background: fcScannedLot === lotName ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)', color: fcScannedLot === lotName ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)', cursor: 'pointer' }}>
                                                        {lotName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-3 items-end">
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Counted Quantity</label>
                                    <input type="number" value={fcCountInput} onChange={e => setFcCountInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && fcCountInput.trim()) {
                                                const qty = parseInt(fcCountInput, 10);
                                                if (!isNaN(qty) && qty >= 0) {
                                                    submitFullCount(activeSession.id, fcSelectedItem.binId, qty, fcScannedLot);
                                                    const nextItem = activeSession.counts.find(c => c.countedQty === null && c.binId !== fcSelectedItem.binId);
                                                    if (nextItem) { setFcSelectedItem(nextItem); setFcCountInput(''); setFcScannedLot(''); }
                                                    else { setFcSelectedItem(null); addToast?.('All items counted!', 'success'); }
                                                }
                                            }
                                        }}
                                        placeholder="Enter count..."
                                        style={{ width: '100%', marginTop: '4px', padding: '12px', border: '2px solid var(--odoo-purple)', borderRadius: '4px', fontSize: '18px', fontWeight: 700, textAlign: 'center', background: 'var(--odoo-surface)', color: 'var(--odoo-text)', outline: 'none' }}
                                        autoFocus />
                                </div>
                                <button onClick={() => {
                                    const qty = parseInt(fcCountInput, 10);
                                    if (!isNaN(qty) && qty >= 0) {
                                        submitFullCount(activeSession.id, fcSelectedItem.binId, qty, fcScannedLot);
                                        const nextItem = activeSession.counts.find(c => c.countedQty === null && c.binId !== fcSelectedItem.binId);
                                        if (nextItem) { setFcSelectedItem(nextItem); setFcCountInput(''); setFcScannedLot(''); }
                                        else { setFcSelectedItem(null); addToast?.('All items counted!', 'success'); }
                                    }
                                }}
                                    style={{ ...gradientBtnStyle, padding: '12px 24px', fontSize: '12px' }}>
                                    Submit
                                </button>
                            </div>
                            {fcSelectedItem.countedQty !== null && (
                                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>
                                    Previously counted: {fcSelectedItem.countedQty} by {fcSelectedItem.countedBy} at {formatDateTime(fcSelectedItem.countedAt)}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ ...cardStyle, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--odoo-surface-low)', fontSize: '10px', color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Zone</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Location</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>SKU</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Lot</th>
                                        {!activeSession.settings.blindCount && <th style={{ padding: '8px 12px', textAlign: 'right' }}>System</th>}
                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Counted</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Variance</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeSession.counts.map(item => (
                                        <tr key={`${item.binId}-${item.sku || idx}`}
                                            onClick={() => { setFcSelectedItem(item); setFcCountInput(''); setFcScannedLot(''); }}
                                            style={{ borderTop: '1px solid var(--odoo-border-ghost)', cursor: 'pointer', background: fcSelectedItem?.binId === item.binId ? 'var(--odoo-purple-light)' : 'transparent' }}
                                            onMouseEnter={e => { if (fcSelectedItem?.binId !== item.binId) e.currentTarget.style.background = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { if (fcSelectedItem?.binId !== item.binId) e.currentTarget.style.background = 'transparent'; }}>
                                            <td style={{ padding: '8px 12px' }}>
                                                <span style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', backgroundColor: ZONE_COLORS[getZone(item.location)] || '#6b7280' }}>
                                                    {getZone(item.location)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 12px', fontFamily: '"Source Code Pro", monospace', fontSize: '11px' }}>{item.location}</td>
                                            <td style={{ padding: '8px 12px', fontFamily: '"Source Code Pro", monospace', fontSize: '11px', fontWeight: 700 }}>{item.sku}</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--odoo-text-secondary)' }}>{item.name}</td>
                                            <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{item.lot || '—'}</td>
                                            {!activeSession.settings.blindCount && <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--odoo-text-muted)' }}>{item.systemQty}</td>}
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{item.countedQty ?? '—'}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: item.variance > 0 ? 'var(--odoo-purple)' : item.variance < 0 ? 'var(--odoo-danger)' : 'var(--odoo-text-muted)' }}>
                                                {item.variance !== null ? (item.variance > 0 ? `+${item.variance}` : item.variance) : '—'}
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                {item.countedQty !== null ? (
                                                    item.variance === 0 ? <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--odoo-success)' }} /> :
                                                    item.needsRecount ? <AlertTriangle className="w-4 h-4 mx-auto" style={{ color: 'var(--odoo-danger)' }} /> :
                                                    <AlertTriangle className="w-4 h-4 mx-auto" style={{ color: 'var(--odoo-warning)' }} />
                                                ) : <Clock className="w-4 h-4 mx-auto" style={{ color: 'var(--odoo-text-muted)' }} />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL COUNT: RECONCILIATION */}
            {activeTab === 'fullcount' && fcMode === 'reconcile' && activeSession && (
                <div className="space-y-4">
                    <button onClick={() => setFcMode('list')} className="flex items-center gap-1" style={{ fontSize: '12px', color: 'var(--odoo-purple)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <div style={{ ...cardStyle, padding: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--odoo-text)', marginBottom: '16px' }}>Reconciliation — {activeSession.name}</h3>
                        <div className="grid grid-cols-5 gap-3 mb-4">
                            <div style={{ background: 'var(--odoo-surface-low)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-text)' }}>{activeSession.progress.total}</p>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>Total Items</p>
                            </div>
                            <div style={{ background: 'var(--odoo-success-light)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-success)' }}>{activeSession.progress.matched}</p>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>Matched</p>
                            </div>
                            <div style={{ background: 'var(--odoo-danger-light)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-danger)' }}>{activeSession.progress.variance}</p>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>Variance</p>
                            </div>
                            <div style={{ background: 'var(--odoo-purple-light)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
                                <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-purple)' }}>
                                    {activeSession.progress.total > 0 ? Math.round((activeSession.progress.matched / activeSession.progress.total) * 100) : 0}%
                                </p>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>Accuracy</p>
                            </div>
                            <div style={{ background: 'var(--odoo-warning-light)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
                                <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--odoo-warning)' }}>
                                    {reconciliationData ? `฿${Math.abs(reconciliationData.reduce((s, c) => s + (c.varianceValue || 0), 0)).toLocaleString()}` : '—'}
                                </p>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>Variance Value</p>
                            </div>
                        </div>

                        <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text-secondary)', marginBottom: '8px' }}>
                            Variance Detail (Movement Delta)
                            {reconciliationData && <span style={{ fontWeight: 400, color: 'var(--odoo-text-muted)', marginLeft: '8px' }}>
                                Snapshot: {activeSession.frozenAt?.split('T')[0]} {activeSession.frozenAt?.split('T')[1]?.substring(0, 5)}
                            </span>}
                        </h4>
                        <div style={{ overflowX: 'auto', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px' }}>
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--odoo-surface-low)', fontSize: '10px', color: 'var(--odoo-text-muted)', textTransform: 'uppercase' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>SKU</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Location</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Lot / Expiry</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Snapshot</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Current</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Movement</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Counted</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Adj. Variance</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(reconciliationData || activeSession.counts.filter(c => c.countedQty !== null))
                                        .filter(c => (c.adjustedVariance ?? c.variance) !== 0)
                                        .map((c, idx) => (
                                        <tr key={`${c.binId}-${c.sku}-${idx}`} style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                                            <td style={{ padding: '6px 10px', fontFamily: '"Source Code Pro", monospace', fontSize: '11px', fontWeight: 700 }}>{c.sku}</td>
                                            <td style={{ padding: '6px 10px', fontSize: '11px' }}>{c.location}</td>
                                            <td style={{ padding: '6px 10px', fontSize: '10px' }}>
                                                {c.lot || (c.snapshotLots || c.lots || []).map(l => l.lotNumber).filter(Boolean).join(', ') || '—'}
                                                {(() => {
                                                    const lots = c.snapshotLots || c.lots || [];
                                                    const exp = lots.find(l => l.expiryDate)?.expiryDate;
                                                    return exp ? <span style={{ display: 'block', fontSize: '9px', color: 'var(--odoo-warning)' }}>EXP: {exp.split('T')[0]}</span> : null;
                                                })()}
                                            </td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--odoo-text-secondary)' }}>{c.snapshotQty ?? c.systemQty}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{c.currentQty ?? '—'}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right', color: (c.movement || 0) !== 0 ? 'var(--odoo-teal)' : 'var(--odoo-text-muted)' }}>
                                                {(c.movement || 0) > 0 ? '+' : ''}{c.movement ?? 0}
                                            </td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{c.countedQty}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: (c.adjustedVariance ?? c.variance) > 0 ? 'var(--odoo-purple)' : 'var(--odoo-danger)' }}>
                                                {(c.adjustedVariance ?? c.variance) > 0 ? '+' : ''}{c.adjustedVariance ?? c.variance}
                                            </td>
                                            <td style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{c.countedBy}</td>
                                        </tr>
                                    ))}
                                    {(reconciliationData || activeSession.counts.filter(c => c.countedQty !== null))
                                        .filter(c => (c.adjustedVariance ?? c.variance) !== 0).length === 0 && (
                                        <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--odoo-text-muted)' }}>No adjusted variances — perfect match!</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {applyResult && (
                            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '4px', border: `1px solid ${applyResult.status === 'success' ? 'var(--odoo-success)' : applyResult.status === 'partial' ? 'var(--odoo-warning)' : 'var(--odoo-danger)'}`, background: applyResult.status === 'success' ? 'var(--odoo-success-light)' : applyResult.status === 'partial' ? 'var(--odoo-warning-light)' : 'var(--odoo-danger-light)' }}>
                                <p style={{ fontSize: '13px', fontWeight: 700 }}>
                                    {applyResult.status === 'success' ? 'Odoo Sync Complete' : applyResult.status === 'partial' ? 'Partial Sync' : 'Sync Failed'}
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', marginTop: '4px' }}>
                                    {applyResult.applied} adjustment{applyResult.applied !== 1 ? 's' : ''} applied to stock.quant
                                    {applyResult.failed > 0 && ` · ${applyResult.failed} failed`}
                                </p>
                                {applyResult.results?.filter(r => r.status === 'error' || r.status === 'skipped').length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {applyResult.results.filter(r => r.status !== 'applied').map((r, i) => (
                                            <p key={i} style={{ fontSize: '11px', color: 'var(--odoo-danger)' }}>{r.sku} @ {r.location}: {r.error}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                            <button onClick={() => closeFullCount(activeSession.id)}
                                disabled={isApplying}
                                style={{ ...gradientBtnStyle, padding: '10px 20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', opacity: isApplying ? 0.5 : 1, cursor: isApplying ? 'not-allowed' : 'pointer', background: isApplying ? '#999' : gradientBtnStyle.background }}>
                                {isApplying ? (
                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Sending to Odoo...</>
                                ) : (
                                    <><Check className="w-4 h-4" /> Approve & Send to Odoo</>
                                )}
                            </button>
                            <button onClick={() => handleExportFullCountPDF(activeSession)}
                                style={{ ...outlineBtnStyle, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Printer className="w-4 h-4" /> Export Report
                            </button>
                            <button onClick={() => setFcMode('counting')} disabled={isApplying}
                                style={{ ...outlineBtnStyle, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ChevronLeft className="w-4 h-4" /> Back to Counting
                            </button>
                            {!apiConfigs?.odoo && (
                                <p className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--odoo-warning)' }}>
                                    <AlertTriangle className="w-3.5 h-3.5" /> Odoo not connected — will save locally only
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: CYCLE COUNT (task list, assignment, etc.) */}
            {activeTab === 'cycle' && <>

            {/* Notification banner */}
            {stats.pending > 0 && notifications.filter(n => !n.read && n.type === 'assignment').length > 0 && (
                <div className="flex items-center gap-3 mb-4" style={{ padding: '12px', background: 'var(--odoo-purple-light)', border: '1px solid var(--odoo-purple-border, var(--odoo-purple))', borderRadius: '4px' }}>
                    <BellRing className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--odoo-purple)' }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--odoo-purple-dark)' }}>
                            You have {stats.pending} count tasks assigned today
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--odoo-purple)' }}>Please complete before end of shift</p>
                    </div>
                    <button onClick={() => {
                        const first = myTasks.find(t => !t.counted);
                        if (first) { setSelectedTask(first); setMode('counting'); setScanStep('scan-location'); }
                    }}
                        style={{ ...gradientBtnStyle, padding: '8px 12px', flexShrink: 0, fontSize: '11px' }}>
                        Start Now
                    </button>
                </div>
            )}

            {/* ABC Classification */}
            <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px' }}>
                <h3 style={sectionHeaderStyle}>ABC Classification</h3>
                <div className="grid grid-cols-3 gap-3">
                    {Object.entries(ABC_CONFIG).map(([grade, cfg]) => (
                        <div key={grade} style={{ borderRadius: '4px', padding: '12px', border: `1px solid ${cfg.color}40`, background: `${cfg.bg}60` }}>
                            <div className="flex items-center justify-between mb-1">
                                <span style={{ fontWeight: 700, fontSize: '16px', color: cfg.color }}>{grade}</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: cfg.color + '20', color: cfg.color }}>
                                    {abcSummary[grade].today} today
                                </span>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)' }}>{cfg.desc}</p>
                            <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', marginTop: '4px' }}>{abcSummary[grade].total} total SKUs</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fair Assignment */}
            {pickers.length > 1 && (
                <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px' }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="flex items-center gap-1.5" style={sectionHeaderStyle}>
                            <Users className="w-4 h-4" /> Fair Assignment
                        </h3>
                        {isAdmin && (
                            <div className="flex gap-1">
                                <button onClick={() => setFilterAssignee('mine')}
                                    style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: filterAssignee === 'mine' ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)', color: filterAssignee === 'mine' ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                                    My Tasks
                                </button>
                                <button onClick={() => setFilterAssignee('all')}
                                    style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: filterAssignee === 'all' ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)', color: filterAssignee === 'all' ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                                    All Pickers
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {assignmentSummary.map(s => (
                            <div key={s.username} style={{ borderRadius: '4px', padding: '12px', border: `1px solid ${s.username === user?.username ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`, background: s.username === user?.username ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)' }}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', background: s.username === user?.username ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                                        {s.name?.charAt(0) || '?'}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                                        {s.username === user?.username && <p style={{ fontSize: '10px', color: 'var(--odoo-purple)', fontWeight: 600 }}>YOU</p>}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between" style={{ fontSize: '11px' }}>
                                    <span style={{ color: 'var(--odoo-text-muted)' }}>{s.done}/{s.total} done</span>
                                    <div className="flex gap-1">
                                        {s.A > 0 && <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>{s.A}A</span>}
                                        {s.B > 0 && <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#d97706' }}>{s.B}B</span>}
                                        {s.C > 0 && <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: '#dbeafe', color: '#2563eb' }}>{s.C}C</span>}
                                    </div>
                                </div>
                                <div style={{ width: '100%', height: '3px', background: 'var(--odoo-surface-high)', borderRadius: '999px', marginTop: '8px' }}>
                                    <div style={{ height: '3px', borderRadius: '999px', transition: 'width 0.3s', background: s.done === s.total && s.total > 0 ? 'var(--odoo-success)' : 'var(--odoo-purple)', width: `${s.total > 0 ? (s.done / s.total) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="flex items-center gap-1 mt-2" style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>
                        <Shuffle className="w-3 h-3" />
                        Tasks distributed by round-robin per ABC grade — rotation changes daily
                    </p>
                </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <button onClick={() => {
                    const first = myTasks.find(t => !t.counted) || myTasks[0];
                    if (first) {
                        setSelectedTask(first); setMode('counting'); setScanStep('scan-location');
                        setScannedLocation(null); setCountInput(''); setScannedLot('');
                    }
                }}
                    style={{ ...gradientBtnStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}>
                    <ScanLine className="w-5 h-5" />
                    Start Counting ({stats.pending} pending)
                </button>
                {isAdmin && stats.needsRecount > 0 && (
                    <button onClick={() => setMode('recount')}
                        style={{ ...gradientBtnStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', background: 'var(--odoo-warning)' }}>
                        <ShieldCheck className="w-5 h-5" />
                        Supervisor Recount ({stats.needsRecount})
                    </button>
                )}
                <button onClick={() => setMode('history')}
                    style={{ ...outlineBtnStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}>
                    <Archive className="w-5 h-5" />
                    View History
                </button>
            </div>

            {/* Task list table */}
            <div style={cardStyle}>
                <div className="flex flex-wrap items-center gap-2" style={{ padding: '12px 16px', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Filter:</span>
                    {['all', 'A', 'B', 'C'].map(f => (
                        <button key={f} onClick={() => setFilterAbc(f)}
                            style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: filterAbc === f ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)', color: filterAbc === f ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                            {f === 'all' ? 'All' : `Class ${f}`}
                        </button>
                    ))}
                    <span style={{ margin: '0 8px', color: 'var(--odoo-border-ghost)' }}>|</span>
                    {['all', 'pending', 'counted', 'variance', 'recount'].map(f => (
                        <button key={f} onClick={() => setFilterStatus(f)}
                            style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: filterStatus === f ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)', color: filterStatus === f ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                            {f === 'all' ? 'All' : f === 'recount' ? 'Recount' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--odoo-surface-low)', fontSize: '10px', color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                <th style={{ textAlign: 'left', padding: '8px 16px', cursor: 'pointer' }} onClick={() => toggleSort('abc')}>
                                    <div className="flex items-center gap-1">ABC <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th style={{ textAlign: 'left', padding: '8px 16px', cursor: 'pointer' }} onClick={() => toggleSort('location')}>
                                    <div className="flex items-center gap-1">Location <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th style={{ textAlign: 'left', padding: '8px 16px', cursor: 'pointer' }} onClick={() => toggleSort('sku')}>
                                    <div className="flex items-center gap-1">SKU <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th style={{ textAlign: 'left', padding: '8px 16px' }}>Product</th>
                                {isAdmin && filterAssignee === 'all' && <th style={{ textAlign: 'left', padding: '8px 16px' }}>Assigned</th>}
                                <th style={{ textAlign: 'center', padding: '8px 16px' }}>Counted</th>
                                <th style={{ textAlign: 'center', padding: '8px 16px', cursor: 'pointer' }} onClick={() => toggleSort('status')}>
                                    <div className="flex items-center gap-1 justify-center">Status <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.map(task => {
                                const abcCfg = ABC_CONFIG[task.abcGrade];
                                return (
                                    <tr key={task._key || task.sku}
                                        onClick={() => {
                                            setSelectedTask(task); setMode('counting'); setScanStep('scan-location');
                                            setScannedLocation(null); setCountInput(''); setScannedLot('');
                                        }}
                                        style={{ borderTop: '1px solid var(--odoo-border-ghost)', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--odoo-surface-low)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: abcCfg.bg, color: abcCfg.color }}>
                                                {task.abcGrade}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 16px', fontFamily: '"Source Code Pro", monospace', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{task.location}</td>
                                        <td style={{ padding: '10px 16px', fontFamily: '"Source Code Pro", monospace', fontWeight: 600, color: 'var(--odoo-text)' }}>{task.sku}</td>
                                        <td style={{ padding: '10px 16px', color: 'var(--odoo-text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</td>
                                        {isAdmin && filterAssignee === 'all' && (
                                            <td style={{ padding: '10px 16px' }}>
                                                <span className="inline-flex items-center gap-1" style={{ fontSize: '11px' }}>
                                                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', background: task.assignedTo === user?.username ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                                                        {task.assignedName?.charAt(0) || '?'}
                                                    </span>
                                                    <span style={{ color: 'var(--odoo-text-secondary)' }}>{task.assignedName || task.assignedTo}</span>
                                                </span>
                                            </td>
                                        )}
                                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--odoo-text)' }}>{task.counted ? task.countedQty : '—'}</td>
                                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                            {task.needsRecount ? (
                                                <span className="inline-flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--odoo-warning)' }}>
                                                    <RotateCcw className="w-3.5 h-3.5" />Recount
                                                </span>
                                            ) : task.counted ? (
                                                <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--odoo-success)' }} />
                                            ) : (
                                                <Clock className="w-4 h-4 mx-auto" style={{ color: 'var(--odoo-text-muted)' }} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredTasks.length === 0 && (
                                <tr>
                                    <td colSpan={isAdmin && filterAssignee === 'all' ? 7 : 6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--odoo-text-muted)' }}>
                                        No tasks match current filters
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </>}

            {/* ── Off-screen: Cycle Count PDF Report ── */}
            {showCycleReport && reportDate && (() => {
                const dayRecords = countRecords.filter(r => r.date === reportDate);
                const matched = dayRecords.filter(r => r.status === 'matched').length;
                const variances = dayRecords.filter(r => r.variance !== 0);
                const recounts = dayRecords.filter(r => r.supervisorCount !== null);
                const accuracy = dayRecords.length > 0 ? Math.round((matched / dayRecords.length) * 100) : 0;
                const rptS = { fontSize: '11px', borderCollapse: 'collapse', width: '100%' };
                const thS = { padding: '6px 8px', textAlign: 'left', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid #714B67', color: '#714B67' };
                const tdS = { padding: '5px 8px', borderBottom: '1px solid #eee', fontSize: '10px' };
                return (
                    <div id="cycle-count-report-area" style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm', background: '#fff', color: '#212529', fontFamily: 'Inter, sans-serif', padding: '20mm' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '3px solid #714B67', paddingBottom: '16px' }}>
                            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#714B67', margin: 0 }}>CYCLE COUNT REPORT</h1>
                            <p style={{ fontSize: '14px', color: '#6c757d', margin: '4px 0 0' }}>Kiss of Beauty / SKINOXY &mdash; {reportDate}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                            {[
                                { label: 'Items Counted', val: dayRecords.length, color: '#714B67' },
                                { label: 'Matched', val: matched, color: '#28a745' },
                                { label: 'Variances', val: variances.length, color: '#dc3545' },
                                { label: 'Accuracy', val: `${accuracy}%`, color: accuracy >= 95 ? '#28a745' : '#dc3545' },
                                { label: 'Recounts', val: recounts.length, color: '#6f42c1' },
                            ].map(k => (
                                <div key={k.label} style={{ flex: 1, padding: '12px', border: '1px solid #dee2e6', borderRadius: '4px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#6c757d', margin: 0 }}>{k.label}</p>
                                    <p style={{ fontSize: '20px', fontWeight: 800, color: k.color, margin: '4px 0 0' }}>{k.val}</p>
                                </div>
                            ))}
                        </div>
                        {variances.length > 0 && (<>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#714B67', textTransform: 'uppercase', marginBottom: '8px' }}>Variance Items</h3>
                            <table style={rptS}>
                                <thead><tr>
                                    {['SKU', 'Location', 'System', 'Counted', 'Supervisor', 'Variance', 'Status', 'By'].map(h => <th key={h} style={thS}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {variances.map((r, i) => (
                                        <tr key={i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                                            <td style={{ ...tdS, fontWeight: 700, fontFamily: 'monospace' }}>{r.sku}</td>
                                            <td style={tdS}>{r.location}</td>
                                            <td style={{ ...tdS, textAlign: 'right' }}>{r.systemQty}</td>
                                            <td style={{ ...tdS, textAlign: 'right', fontWeight: 700 }}>{r.countedQty}</td>
                                            <td style={{ ...tdS, textAlign: 'right' }}>{r.supervisorCount ?? '—'}</td>
                                            <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: (r.finalVariance ?? r.variance) < 0 ? '#dc3545' : '#6f42c1' }}>
                                                {(r.finalVariance ?? r.variance) > 0 ? '+' : ''}{r.finalVariance ?? r.variance}
                                            </td>
                                            <td style={tdS}><span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 600, background: r.status === 'recount-done' ? '#f3e8ff' : r.status === 'matched' ? '#e8f5e9' : '#fff3cd', color: r.status === 'recount-done' ? '#6f42c1' : r.status === 'matched' ? '#28a745' : '#856404' }}>{r.status}</span></td>
                                            <td style={tdS}>{r.countedBy}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>)}
                        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dee2e6', paddingTop: '20px' }}>
                            <div><p style={{ fontSize: '10px', color: '#6c757d' }}>Prepared by: {user?.name || user?.username || 'Admin'}</p><div style={{ marginTop: '30px', borderTop: '1px solid #adb5bd', width: '160px' }} /><p style={{ fontSize: '9px', color: '#adb5bd' }}>Signature</p></div>
                            <div><p style={{ fontSize: '10px', color: '#6c757d' }}>Approved by:</p><div style={{ marginTop: '30px', borderTop: '1px solid #adb5bd', width: '160px' }} /><p style={{ fontSize: '9px', color: '#adb5bd' }}>Signature</p></div>
                        </div>
                        <p style={{ textAlign: 'center', fontSize: '8px', color: '#adb5bd', marginTop: '16px' }}>Generated by KOB WMS Pro &mdash; {new Date().toISOString()}</p>
                    </div>
                );
            })()}

            {/* ── Off-screen: Full Count PDF Report ── */}
            {showFullCountReport && (() => {
                const session = fullCountSessions.find(s => s.id === showFullCountReport);
                if (!session) return null;
                const { liveMap, frozenMap } = buildInventoryMaps(session);
                const items = session.counts.filter(c => c.countedQty !== null).map(c => {
                    const key = `${c.sku}::${c.location || ''}`;
                    const snapshotQty = frozenMap[key] ?? c.systemQty;
                    const currentQty = liveMap[key] ?? snapshotQty;
                    const movement = currentQty - snapshotQty;
                    const adjVar = c.countedQty - currentQty;
                    return { ...c, snapshotQty, currentQty, movement, adjVar };
                });
                const matched = items.filter(c => c.adjVar === 0).length;
                const varItems = items.filter(c => c.adjVar !== 0);
                const movedItems = items.filter(c => c.movement !== 0);
                const accuracy = items.length > 0 ? Math.round((matched / items.length) * 100) : 0;
                const duration = session.frozenAt && session.closedAt ? Math.round((new Date(session.closedAt) - new Date(session.frozenAt)) / 3600000 * 10) / 10 : null;
                const thS = { padding: '6px 8px', textAlign: 'left', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid #714B67', color: '#714B67' };
                const tdS = { padding: '4px 8px', borderBottom: '1px solid #eee', fontSize: '9px' };
                return (
                    <div id="full-count-report-area" style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm', background: '#fff', color: '#212529', fontFamily: 'Inter, sans-serif', padding: '15mm' }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '3px solid #714B67', paddingBottom: '12px' }}>
                            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#714B67', margin: 0 }}>FULL COUNT REPORT</h1>
                            <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0' }}>Kiss of Beauty / SKINOXY</p>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '11px' }}>
                            <div style={{ flex: 1 }}>
                                <p><strong>Session:</strong> {session.name}</p>
                                <p><strong>Created:</strong> {session.createdAt?.split('T')[0]} {session.createdAt?.split('T')[1]?.substring(0, 5)}</p>
                                <p><strong>Closed:</strong> {session.closedAt?.split('T')[0] || 'Open'} {session.closedAt?.split('T')[1]?.substring(0, 5) || ''}</p>
                            </div>
                            <div style={{ flex: 1 }}>
                                <p><strong>Duration:</strong> {duration ? `${duration} hrs` : '—'}</p>
                                <p><strong>Snapshot at:</strong> {session.frozenAt?.split('T')[0]} {session.frozenAt?.split('T')[1]?.substring(0, 5)}</p>
                                <p><strong>Approved by:</strong> {session.reconciliation?.approvedBy || '—'}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                            {[
                                { label: 'Total Items', val: items.length, color: '#714B67' },
                                { label: 'Matched', val: matched, color: '#28a745' },
                                { label: 'Adjusted Variances', val: varItems.length, color: '#dc3545' },
                                { label: 'Accuracy', val: `${accuracy}%`, color: accuracy >= 95 ? '#28a745' : '#dc3545' },
                                { label: 'Moved During Count', val: movedItems.length, color: '#017E84' },
                            ].map(k => (
                                <div key={k.label} style={{ flex: 1, padding: '10px', border: '1px solid #dee2e6', borderRadius: '4px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', color: '#6c757d', margin: 0 }}>{k.label}</p>
                                    <p style={{ fontSize: '18px', fontWeight: 800, color: k.color, margin: '2px 0 0' }}>{k.val}</p>
                                </div>
                            ))}
                        </div>
                        {varItems.length > 0 && (<>
                            <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#714B67', textTransform: 'uppercase', marginBottom: '6px' }}>Variance Items (Adjusted)</h3>
                            <table style={{ fontSize: '9px', borderCollapse: 'collapse', width: '100%' }}>
                                <thead><tr>
                                    {['SKU', 'Location', 'Snapshot', 'Current', 'Movement', 'Counted', 'Adj. Variance', 'By'].map(h => <th key={h} style={{ ...thS, textAlign: ['Snapshot', 'Current', 'Movement', 'Counted', 'Adj. Variance'].includes(h) ? 'right' : 'left' }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {varItems.map((c, i) => (
                                        <tr key={i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                                            <td style={{ ...tdS, fontWeight: 700, fontFamily: 'monospace' }}>{c.sku}</td>
                                            <td style={tdS}>{c.location}</td>
                                            <td style={{ ...tdS, textAlign: 'right' }}>{c.snapshotQty}</td>
                                            <td style={{ ...tdS, textAlign: 'right' }}>{c.currentQty}</td>
                                            <td style={{ ...tdS, textAlign: 'right', color: c.movement !== 0 ? '#017E84' : '#adb5bd' }}>{c.movement > 0 ? '+' : ''}{c.movement}</td>
                                            <td style={{ ...tdS, textAlign: 'right', fontWeight: 700 }}>{c.countedQty}</td>
                                            <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: c.adjVar < 0 ? '#dc3545' : '#6f42c1' }}>{c.adjVar > 0 ? '+' : ''}{c.adjVar}</td>
                                            <td style={tdS}>{c.countedBy}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>)}
                        {session.reconciliation?.odooResult && (
                            <div style={{ marginTop: '16px', padding: '10px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '10px' }}>
                                <p style={{ fontWeight: 700, color: '#714B67', marginBottom: '4px' }}>Odoo Sync Result</p>
                                <p>Status: <strong>{session.reconciliation.odooResult.status}</strong> | Applied: {session.reconciliation.odooResult.applied} | Failed: {session.reconciliation.odooResult.failed}</p>
                            </div>
                        )}
                        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dee2e6', paddingTop: '16px' }}>
                            <div><p style={{ fontSize: '10px', color: '#6c757d' }}>Prepared by: {user?.name || user?.username || 'Admin'}</p><div style={{ marginTop: '30px', borderTop: '1px solid #adb5bd', width: '160px' }} /><p style={{ fontSize: '9px', color: '#adb5bd' }}>Signature</p></div>
                            <div><p style={{ fontSize: '10px', color: '#6c757d' }}>Approved by: {session.reconciliation?.approvedBy || ''}</p><div style={{ marginTop: '30px', borderTop: '1px solid #adb5bd', width: '160px' }} /><p style={{ fontSize: '9px', color: '#adb5bd' }}>Signature</p></div>
                        </div>
                        <p style={{ textAlign: 'center', fontSize: '8px', color: '#adb5bd', marginTop: '12px' }}>Generated by KOB WMS Pro &mdash; {new Date().toISOString()}</p>
                    </div>
                );
            })()}
        </div>
    );
};

export default CycleCount;
