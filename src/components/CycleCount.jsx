import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    ClipboardCheck, BarChart3, Search, ScanLine, CheckCircle2, AlertTriangle,
    Package, RefreshCw, Calendar, Filter, ChevronDown, ChevronRight, Hash,
    ArrowUpDown, X, Check, Clock, Target, TrendingUp, TrendingDown, Shuffle,
    Archive, Eye, ChevronLeft, Users, UserCheck, MapPin, Camera, Bell, BellRing,
    RotateCcw, ShieldCheck, Image, Lock, Unlock, QrCode
} from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';
import { getActivePickers } from './TimeAttendance';

// ── ABC Classification ──
const ABC_CONFIG = {
    A: { label: 'A — High Movement', color: '#dc2626', bg: '#fee2e2', pct: 0.20, dailySamplePct: 1.00, desc: 'Count every day' },
    B: { label: 'B — Medium Movement', color: '#d97706', bg: '#fef3c7', pct: 0.30, dailySamplePct: 0.30, desc: 'Sample ~30% daily' },
    C: { label: 'C — Low Movement', color: '#2563eb', bg: '#dbeafe', pct: 0.50, dailySamplePct: 0.10, desc: 'Sample ~10% daily' },
};

// Variance threshold for auto-approve vs supervisor recount
const VARIANCE_AUTO_APPROVE_PCT = 5; // Auto-approve if variance ≤5%

// Seeded random for deterministic daily sampling
const seededRandom = (seed) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// Parse QR/Barcode input — supports LOC:xxx and PRD:xxx|LOT:xxx formats
const parseQrInput = (raw) => {
    const val = raw.replace(/[^\x20-\x7E\u0E00-\u0E7F]/g, '').trim().toUpperCase();
    // Location QR: "LOC:A-01-02"
    if (val.startsWith('LOC:')) return { type: 'location', value: val.slice(4).trim() };
    // Product QR with optional lot: "PRD:STDH080|LOT:LOT2026-001"
    if (val.startsWith('PRD:')) {
        const parts = val.split('|');
        const sku = parts[0].slice(4).trim();
        const lot = parts.find(p => p.startsWith('LOT:'))?.slice(4)?.trim() || null;
        return { type: 'product', value: sku, lot };
    }
    // Plain barcode/sku — determine by context
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
        // Keep last 100 notifications
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

// Generate daily notifications for assigned users
const generateDailyNotifications = (assignedTasks, pickers, dateStr) => {
    const sentKey = `wms_count_notif_sent_${dateStr}`;
    if (localStorage.getItem(sentKey)) return; // Already sent today

    // Group tasks by assignee
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


const CycleCount = ({ inventory, activityLogs = [], salesOrders = [], addToast, user, users = [], logActivity }) => {
    // ── State ──
    const [mode, setMode] = useState('dashboard');
    // Scan flow: 'scan-location' → 'scan-product' → 'enter-qty' → submit → next
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
    const [sortBy, setSortBy] = useState({ col: 'location', dir: 'asc' });
    const [expandedDate, setExpandedDate] = useState(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const scanRef = useRef(null);
    const countRef = useRef(null);
    const locScanRef = useRef(null);

    // localStorage
    const LS_COUNTS = 'wms_cycle_counts';
    const safeParse = (key, fallback) => {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch { return fallback; }
    };
    const [countRecords, setCountRecords] = useState(() => safeParse(LS_COUNTS, []));

    useEffect(() => {
        localStorage.setItem(LS_COUNTS, JSON.stringify(countRecords));
    }, [countRecords]);

    // ── Build product list ──
    const products = useMemo(() => {
        const items = [];
        Object.entries(PRODUCT_CATALOG).forEach(([sku, cat]) => {
            const invItem = inventory?.items?.find(i => i.sku === sku || i.default_code === sku);
            items.push({
                sku,
                name: cat.shortName || cat.name,
                barcode: cat.barcode || '',
                location: cat.location || '',
                systemQty: invItem?.onHand ?? invItem?.quantity ?? Math.floor(Math.random() * 200) + 20,
                brand: cat.brand || '',
                image: cat.image || '',
                lotTracking: cat.lotTracking ?? false,
                lots: invItem?.lots || [],
            });
        });
        if (inventory?.items) {
            inventory.items.forEach(item => {
                const sku = item.sku || item.default_code;
                if (sku && !items.find(i => i.sku === sku)) {
                    items.push({
                        sku, name: item.name || sku, barcode: item.barcode || '',
                        location: item.location || '', systemQty: item.onHand ?? item.quantity ?? 0,
                        brand: '', image: '', lotTracking: !!item.lot_id, lots: item.lots || [],
                    });
                }
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

    // Generate daily notifications
    useEffect(() => {
        if (assignedTasks.length > 0 && pickers.length > 0) {
            generateDailyNotifications(assignedTasks, pickers, countDate);
        }
    }, [assignedTasks, pickers, countDate]);

    // ── My tasks ──
    const myTasks = useMemo(() => {
        if (isAdmin && filterAssignee === 'all') return assignedTasks;
        return assignedTasks.filter(t => t.assignedTo === user?.username);
    }, [assignedTasks, isAdmin, filterAssignee, user]);

    // ── Assignment summary ──
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

    // ── Notifications ──
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

    // ── Submit count (Blind Count) ──
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

        // Show result AFTER submit (user never sees system qty beforehand)
        if (qty === task.systemQty) {
            addToast?.(`${task.sku} — Matched!`, 'success');
        } else if (needsRecount) {
            addToast?.(`${task.sku} — Variance detected. Flagged for supervisor recount.`, 'error');
            // Notify supervisors about recount needed
            users.filter(u => u.role === 'admin' || u.role === 'senior').forEach(admin => {
                addNotification(admin.username,
                    `Recount needed: ${task.sku} at ${task.location} — counted ${qty} by ${user?.name || user?.username} (variance >${VARIANCE_AUTO_APPROVE_PCT}%)`,
                    'recount'
                );
            });
        } else {
            addToast?.(`${task.sku} — Minor variance (${qty - task.systemQty > 0 ? '+' : ''}${qty - task.systemQty}). Auto-approved.`, 'warning');
        }

        // Move to next uncounted task
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
        // Notify original counter
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

        // Match location to selected task's location
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

        // Match product barcode or SKU
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

    // ── Dashboard scan (quick jump) ──
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

    // ═══════════════════════════════════════════════════════════════
    // ── RENDER: Counting Mode (Location → Product → Qty) ──
    // ═══════════════════════════════════════════════════════════════
    if (mode === 'counting' && selectedTask) {
        const abcCfg = ABC_CONFIG[selectedTask.abcGrade];
        const pendingList = myTasks.filter(t => !t.counted);
        const cat = PRODUCT_CATALOG[selectedTask.sku];

        // Step indicator
        const steps = [
            { key: 'scan-location', label: 'Location', Icon: MapPin, done: scanStep !== 'scan-location' },
            { key: 'scan-product', label: 'Product', Icon: QrCode, done: scanStep === 'enter-qty' },
            { key: 'enter-qty', label: 'Quantity', Icon: Hash, done: false },
        ];

        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={() => { setSelectedTask(null); setMode('dashboard'); setScanStep('scan-location'); setScannedLocation(null); }}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Blind Count</h2>
                        <p className="text-xs text-gray-500">{stats.done}/{stats.total} completed</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: abcCfg.bg, color: abcCfg.color }}>
                        {selectedTask.abcGrade}
                    </span>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
                    {steps.map((s, i) => (
                        <React.Fragment key={s.key}>
                            {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center ${
                                scanStep === s.key ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                                s.done ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                                'text-gray-400'
                            }`}>
                                {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.Icon className="w-3.5 h-3.5" />}
                                {s.label}
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {/* Product info card — shows image, SKU, name, location */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex gap-4">
                        {/* Product image */}
                        <div className="w-20 h-20 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 bg-gray-50 dark:bg-gray-900">
                            {cat?.image ? (
                                <img src={cat.image} alt={selectedTask.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Image className="w-8 h-8 text-gray-300" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">{selectedTask.sku}</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedTask.name}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <MapPin className="w-3 h-3" />{selectedTask.location || '—'}
                                </span>
                                {selectedTask.barcode && (
                                    <span className="text-xs font-mono text-gray-400">{selectedTask.barcode}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BLIND: No system qty shown */}
                    <div className="mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                            <Eye className="w-3.5 h-3.5" />
                            <span className="font-medium">Blind Count Mode — system quantity hidden</span>
                        </div>
                    </div>
                </div>

                {/* ── STEP 1: Scan Location ── */}
                {scanStep === 'scan-location' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-200 dark:border-blue-800 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-500" />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Step 1: Scan Location</h3>
                        </div>
                        <p className="text-xs text-gray-500">
                            Go to <span className="font-bold text-blue-600 dark:text-blue-400">{selectedTask.location || 'assigned location'}</span> and scan the shelf QR/barcode
                        </p>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    ref={locScanRef}
                                    value={scanInput}
                                    onChange={e => setScanInput(e.target.value)}
                                    onKeyDown={handleLocationScan}
                                    placeholder="Scan location QR/barcode..."
                                    className="w-full pl-10 pr-4 py-3 text-lg border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400">Supports: QR (LOC:A-01-02), barcode, or type location code</p>
                    </div>
                )}

                {/* ── STEP 2: Scan Product ── */}
                {scanStep === 'scan-product' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-green-200 dark:border-green-800 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-green-500" />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Step 2: Scan Product</h3>
                            <span className="ml-auto text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Location: {scannedLocation}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">
                            Scan the barcode on <span className="font-bold">{selectedTask.sku}</span>
                        </p>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    ref={scanRef}
                                    value={scanInput}
                                    onChange={e => setScanInput(e.target.value)}
                                    onKeyDown={handleProductScan}
                                    placeholder="Scan product barcode/QR..."
                                    className="w-full pl-10 pr-4 py-3 text-lg border-2 border-green-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400">Supports: EAN-13 barcode, QR (PRD:SKU|LOT:xxx), or type SKU</p>
                    </div>
                )}

                {/* ── STEP 3: Enter Quantity ── */}
                {scanStep === 'enter-qty' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-purple-200 dark:border-purple-800 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Hash className="w-5 h-5 text-purple-500" />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Step 3: Enter Counted Quantity</h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-green-600">
                            <CheckCircle2 className="w-3 h-3" /> Location: {scannedLocation}
                            <CheckCircle2 className="w-3 h-3 ml-2" /> Product: {selectedTask.sku}
                        </div>

                        {/* Lot selector (if product has lot tracking) */}
                        {(selectedTask.lotTracking || selectedTask.lots?.length > 0) && (
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Lot / Batch Number</label>
                                <input
                                    value={scannedLot}
                                    onChange={e => setScannedLot(e.target.value)}
                                    placeholder="Enter or scan lot number..."
                                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                                />
                                {selectedTask.lots?.length > 0 && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {selectedTask.lots.map(l => (
                                            <button key={l} onClick={() => setScannedLot(l)}
                                                className={`px-2 py-0.5 rounded text-[10px] border ${scannedLot === l ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600'}`}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quantity input — large touch-friendly */}
                        <div className="flex gap-3 items-center">
                            <button onClick={() => setCountInput(prev => String(Math.max(0, (parseInt(prev) || 0) - 1)))}
                                className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 text-2xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 flex items-center justify-center">
                                −
                            </button>
                            <input
                                ref={countRef}
                                type="number" min="0"
                                value={countInput}
                                onChange={e => setCountInput(e.target.value)}
                                onKeyDown={handleCountSubmit}
                                placeholder="0"
                                className="flex-1 px-4 py-3 text-3xl font-bold border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white text-center"
                                autoFocus
                            />
                            <button onClick={() => setCountInput(prev => String((parseInt(prev) || 0) + 1))}
                                className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 text-2xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 flex items-center justify-center">
                                +
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => { if (countInput) handleCountSubmit({ key: 'Enter' }); }}
                                disabled={!countInput}
                                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
                                <Check className="w-5 h-5" /> Submit Count
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
                                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200">
                                Skip
                            </button>
                        </div>
                    </div>
                )}

                {/* Already counted warning */}
                {selectedTask.counted && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm text-yellow-700 dark:text-yellow-400">
                            Already counted by {selectedTask.countedBy}. Re-submitting will overwrite.
                        </span>
                    </div>
                )}

                {/* Pending list */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Remaining ({pendingList.length})</h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {pendingList.map(t => (
                            <button key={t.sku} onClick={() => {
                                setSelectedTask(t); setScanStep('scan-location'); setScannedLocation(null);
                                setCountInput(''); setScannedLot('');
                            }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${t.sku === selectedTask.sku ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-medium text-gray-900 dark:text-white">{t.sku}</span>
                                    {t.needsRecount && <RotateCcw className="w-3 h-3 text-red-500" />}
                                </div>
                                <span className="text-gray-400 text-xs">{t.location}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ── RENDER: Supervisor Recount Mode ──
    // ═══════════════════════════════════════════════════════════════
    if (mode === 'recount') {
        const recountTasks = myTasks.filter(t => t.needsRecount);
        const [recountInput, setRecountInput] = useState('');
        const [recountTask, setRecountTask] = useState(recountTasks[0] || null);

        if (recountTask) {
            const cat = PRODUCT_CATALOG[recountTask.sku];
            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMode('dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-orange-500" />Supervisor Recount
                            </h2>
                            <p className="text-xs text-gray-500">{recountTasks.length} items need verification</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-orange-200 dark:border-orange-800 p-4">
                        <div className="flex gap-4 mb-4">
                            {cat?.image && (
                                <img src={cat.image} alt={recountTask.name} className="w-16 h-16 rounded-lg object-cover border" />
                            )}
                            <div>
                                <p className="text-lg font-bold text-blue-600 font-mono">{recountTask.sku}</p>
                                <p className="text-sm text-gray-900 dark:text-white">{recountTask.name}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3" />{recountTask.location}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Original Count</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{recountTask.countedQty}</p>
                                <p className="text-[10px] text-gray-400">by {recountTask.countedBy}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Variance</p>
                                <p className={`text-xl font-bold ${recountTask.variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {recountTask.variance > 0 ? '+' : ''}{recountTask.variance}
                                </p>
                                <p className="text-[10px] text-gray-400">{recountTask.variancePct || '?'}%</p>
                            </div>
                        </div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Your Recount (Blind)
                        </label>
                        <div className="flex gap-3">
                            <input type="number" min="0" value={recountInput}
                                onChange={e => setRecountInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key !== 'Enter' || !recountInput.trim()) return;
                                    submitSupervisorRecount(recountTask, parseInt(recountInput));
                                    setRecountInput('');
                                    const next = recountTasks.find(t => t.sku !== recountTask.sku);
                                    setRecountTask(next || null);
                                    if (!next) setMode('dashboard');
                                }}
                                placeholder="Enter count..."
                                className="flex-1 px-4 py-3 text-xl font-bold border-2 border-orange-300 rounded-xl focus:border-orange-500 dark:bg-gray-700 dark:border-gray-600 text-center text-gray-900 dark:text-white"
                                autoFocus
                            />
                            <button onClick={() => {
                                if (!recountInput) return;
                                submitSupervisorRecount(recountTask, parseInt(recountInput));
                                setRecountInput('');
                                const next = recountTasks.find(t => t.sku !== recountTask.sku);
                                setRecountTask(next || null);
                                if (!next) setMode('dashboard');
                            }}
                                className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5" /> Verify
                            </button>
                        </div>
                    </div>

                    {/* Remaining recounts */}
                    {recountTasks.length > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Pending Recounts ({recountTasks.length})</h3>
                            <div className="space-y-1">
                                {recountTasks.map(t => (
                                    <button key={t.sku} onClick={() => { setRecountTask(t); setRecountInput(''); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${t.sku === recountTask?.sku ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                        <span className="font-mono font-medium">{t.sku}</span>
                                        <span className="text-xs text-gray-400">{t.location}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No items need recounting</p>
                <button onClick={() => setMode('dashboard')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Back to Dashboard</button>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ── RENDER: History ──
    // ═══════════════════════════════════════════════════════════════
    if (mode === 'history') {
        const dateRecords = expandedDate ? countRecords.filter(r => r.date === expandedDate) : [];

        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => setMode('dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Count History</h2>
                    <span className="text-sm text-gray-500">{countRecords.length} records</span>
                </div>

                {historyByDate.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border p-12 text-center">
                        <Archive className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No count history yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {historyByDate.map(h => (
                            <div key={h.date} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <button onClick={() => setExpandedDate(expandedDate === h.date ? null : h.date)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-5 h-5 text-gray-400" />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 dark:text-white">{h.date}</p>
                                            <p className="text-xs text-gray-500">{h.total} items counted {h.recounts > 0 && `| ${h.recounts} recounted`}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${h.accuracy >= 95 ? 'text-green-600' : h.accuracy >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {h.accuracy}% match
                                            </p>
                                            {h.variances > 0 && <p className="text-xs text-red-500">{h.variances} variance{h.variances > 1 ? 's' : ''}</p>}
                                        </div>
                                        {expandedDate === h.date ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>
                                {expandedDate === h.date && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-xs text-gray-500 uppercase">
                                                    <th className="text-left py-1">SKU</th>
                                                    <th className="text-left py-1">Location</th>
                                                    <th className="text-left py-1">Lot</th>
                                                    <th className="text-center py-1">System</th>
                                                    <th className="text-center py-1">Counted</th>
                                                    <th className="text-center py-1">Supervisor</th>
                                                    <th className="text-center py-1">Variance</th>
                                                    <th className="text-left py-1">Status</th>
                                                    <th className="text-left py-1">By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dateRecords.map(r => (
                                                    <tr key={r.sku} className="border-t border-gray-100 dark:border-gray-700">
                                                        <td className="py-2 font-mono font-medium text-gray-900 dark:text-white">{r.sku}</td>
                                                        <td className="py-2 text-gray-500 text-xs">{r.location}</td>
                                                        <td className="py-2 text-gray-400 text-xs">{r.lot || '—'}</td>
                                                        <td className="py-2 text-center text-gray-700 dark:text-gray-300">{r.systemQty}</td>
                                                        <td className="py-2 text-center font-bold text-gray-900 dark:text-white">{r.countedQty}</td>
                                                        <td className="py-2 text-center text-gray-600">{r.supervisorCount ?? '—'}</td>
                                                        <td className={`py-2 text-center font-bold ${r.variance === 0 ? 'text-green-600' : r.variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                            {r.variance === 0 ? '—' : `${r.variance > 0 ? '+' : ''}${r.variance}`}
                                                        </td>
                                                        <td className="py-2">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                r.status === 'matched' ? 'bg-green-100 text-green-700' :
                                                                r.status === 'recount-done' ? 'bg-blue-100 text-blue-700' :
                                                                r.status === 'needs-recount' ? 'bg-red-100 text-red-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                {r.status === 'matched' ? 'Match' :
                                                                 r.status === 'recount-done' ? 'Recounted' :
                                                                 r.status === 'needs-recount' ? 'Needs Recount' : 'Auto-OK'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-gray-500 text-xs">{r.countedBy}</td>
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
    // ── RENDER: Notifications panel ──
    // ═══════════════════════════════════════════════════════════════
    if (showNotifications) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => { setShowNotifications(false); markNotificationsRead(user?.username); }}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-500" /> Notifications
                    </h2>
                    <span className="text-sm text-gray-500">{notifications.length}</span>
                </div>

                {notifications.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border p-12 text-center">
                        <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No notifications</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {notifications.slice(0, 20).map(n => {
                            const typeColor = n.type === 'assignment' ? 'blue' : n.type === 'recount' ? 'orange' : n.type === 'recount-result' ? 'green' : 'gray';
                            return (
                                <div key={n.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${!n.read ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-${typeColor}-100 dark:bg-${typeColor}-900/30`}>
                                            {n.type === 'assignment' ? <ClipboardCheck className={`w-4 h-4 text-${typeColor}-600`} /> :
                                             n.type === 'recount' ? <RotateCcw className={`w-4 h-4 text-${typeColor}-600`} /> :
                                             <CheckCircle2 className={`w-4 h-4 text-${typeColor}-600`} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900 dark:text-white">{n.message}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                        </div>
                                        {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />}
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
    // ── DASHBOARD (default) ──
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ClipboardCheck className="w-6 h-6 text-purple-600" />
                        Cycle Count
                    </h2>
                    <p className="text-sm text-gray-500">Blind Count — Location → Product → Quantity</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Notification bell */}
                    <button onClick={() => setShowNotifications(true)}
                        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        {unreadCount > 0 ? <BellRing className="w-5 h-5 text-blue-500" /> : <Bell className="w-5 h-5 text-gray-400" />}
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                    <input type="date" value={countDate} onChange={e => setCountDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white" />
                    <button onClick={() => setMode('history')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white">
                        <Archive className="w-4 h-4" /> History
                    </button>
                </div>
            </div>

            {/* Notification banner for today's assignments */}
            {stats.pending > 0 && notifications.filter(n => !n.read && n.type === 'assignment').length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-center gap-3">
                    <BellRing className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            You have {stats.pending} count tasks assigned today
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Please complete before end of shift</p>
                    </div>
                    <button onClick={() => {
                        const first = myTasks.find(t => !t.counted);
                        if (first) { setSelectedTask(first); setMode('counting'); setScanStep('scan-location'); }
                    }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex-shrink-0">
                        Start Now
                    </button>
                </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-gray-500 uppercase">Target</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                    <p className="text-xs text-gray-400">SKUs to count</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-gray-500 uppercase">Done</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{stats.done}</p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${stats.pctDone}%` }} />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-gray-500 uppercase">Variance</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{stats.variances}</p>
                    <p className="text-xs text-gray-400">
                        {stats.positiveVar > 0 && <span className="text-blue-500">+{stats.positiveVar}</span>}
                        {stats.positiveVar > 0 && stats.negativeVar > 0 && ' / '}
                        {stats.negativeVar > 0 && <span className="text-red-500">{stats.negativeVar} short</span>}
                        {stats.variances === 0 && '—'}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <RotateCcw className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-gray-500 uppercase">Recount</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">{stats.needsRecount}</p>
                    <p className="text-xs text-gray-400">await supervisor</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-gray-500 uppercase">Accuracy</span>
                    </div>
                    <p className={`text-2xl font-bold ${stats.accuracy >= 95 ? 'text-green-600' : stats.accuracy >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {stats.done > 0 ? `${stats.accuracy}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-400">count vs system</p>
                </div>
            </div>

            {/* ABC Classification */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">ABC Classification</h3>
                <div className="grid grid-cols-3 gap-3">
                    {Object.entries(ABC_CONFIG).map(([grade, cfg]) => (
                        <div key={grade} className="rounded-lg p-3 border" style={{ borderColor: cfg.color + '40', background: cfg.bg + '60' }}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-lg" style={{ color: cfg.color }}>{grade}</span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: cfg.color + '20', color: cfg.color }}>
                                    {abcSummary[grade].today} today
                                </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{cfg.desc}</p>
                            <p className="text-xs text-gray-400 mt-1">{abcSummary[grade].total} total SKUs</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fair Assignment */}
            {pickers.length > 1 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <Users className="w-4 h-4" /> Fair Assignment
                        </h3>
                        {isAdmin && (
                            <div className="flex gap-1">
                                <button onClick={() => setFilterAssignee('mine')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${filterAssignee === 'mine' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400'}`}>
                                    My Tasks
                                </button>
                                <button onClick={() => setFilterAssignee('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${filterAssignee === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400'}`}>
                                    All Pickers
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {assignmentSummary.map(s => (
                            <div key={s.username}
                                className={`rounded-lg p-3 border transition-colors ${s.username === user?.username ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${s.username === user?.username ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                        {s.name?.charAt(0) || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{s.name}</p>
                                        {s.username === user?.username && <p className="text-[10px] text-blue-500 font-medium">YOU</p>}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">{s.done}/{s.total} done</span>
                                    <div className="flex gap-1">
                                        {s.A > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">{s.A}A</span>}
                                        {s.B > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">{s.B}B</span>}
                                        {s.C > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600">{s.C}C</span>}
                                    </div>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2">
                                    <div className={`h-1 rounded-full transition-all ${s.done === s.total && s.total > 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                                        style={{ width: `${s.total > 0 ? (s.done / s.total) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                        <Shuffle className="w-3 h-3" />
                        Tasks distributed by round-robin per ABC grade — rotation changes daily
                    </p>
                </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={() => {
                    const first = myTasks.find(t => !t.counted) || myTasks[0];
                    if (first) {
                        setSelectedTask(first); setMode('counting'); setScanStep('scan-location');
                        setScannedLocation(null); setCountInput(''); setScannedLot('');
                    }
                }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
                    <ScanLine className="w-5 h-5" />
                    Start Counting ({stats.pending} pending)
                </button>
                {isAdmin && stats.needsRecount > 0 && (
                    <button onClick={() => setMode('recount')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors">
                        <ShieldCheck className="w-5 h-5" />
                        Supervisor Recount ({stats.needsRecount})
                    </button>
                )}
                <button onClick={() => setMode('history')}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <Archive className="w-5 h-5" />
                    View History
                </button>
            </div>

            {/* Scan bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            ref={scanRef}
                            value={scanInput}
                            onChange={e => setScanInput(e.target.value)}
                            onKeyDown={handleDashboardScan}
                            placeholder="Scan barcode or type SKU to jump to count..."
                            className="w-full pl-10 pr-4 py-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <QrCode className="w-3 h-3" />
                    Supports QR Code (LOC: / PRD:) and standard barcodes (EAN-13, Code128)
                </p>
            </div>

            {/* Task list */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 uppercase font-bold">Filter:</span>
                    {['all', 'A', 'B', 'C'].map(f => (
                        <button key={f} onClick={() => setFilterAbc(f)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium ${filterAbc === f ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {f === 'all' ? 'All' : `Class ${f}`}
                        </button>
                    ))}
                    <span className="mx-2 text-gray-300">|</span>
                    {['all', 'pending', 'counted', 'variance', 'recount'].map(f => (
                        <button key={f} onClick={() => setFilterStatus(f)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium ${filterStatus === f ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {f === 'all' ? 'All' : f === 'recount' ? 'Recount' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                                <th className="text-left px-4 py-2 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('abc')}>
                                    <div className="flex items-center gap-1">ABC <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="text-left px-4 py-2 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('location')}>
                                    <div className="flex items-center gap-1">Location <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="text-left px-4 py-2 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('sku')}>
                                    <div className="flex items-center gap-1">SKU <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="text-left px-4 py-2">Product</th>
                                {isAdmin && filterAssignee === 'all' && <th className="text-left px-4 py-2">Assigned</th>}
                                {/* NO System Qty column — Blind Count */}
                                <th className="text-center px-4 py-2">Counted</th>
                                <th className="text-center px-4 py-2 cursor-pointer hover:text-gray-700" onClick={() => toggleSort('status')}>
                                    <div className="flex items-center gap-1 justify-center">Status <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.map(task => {
                                const abcCfg = ABC_CONFIG[task.abcGrade];
                                return (
                                    <tr key={task.sku}
                                        onClick={() => {
                                            setSelectedTask(task); setMode('counting'); setScanStep('scan-location');
                                            setScannedLocation(null); setCountInput(''); setScannedLot('');
                                        }}
                                        className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                        <td className="px-4 py-2.5">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: abcCfg.bg, color: abcCfg.color }}>
                                                {task.abcGrade}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{task.location}</td>
                                        <td className="px-4 py-2.5 font-mono font-medium text-gray-900 dark:text-white">{task.sku}</td>
                                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 truncate max-w-[180px]">{task.name}</td>
                                        {isAdmin && filterAssignee === 'all' && (
                                            <td className="px-4 py-2.5">
                                                <span className="inline-flex items-center gap-1 text-xs">
                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${task.assignedTo === user?.username ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                                        {task.assignedName?.charAt(0) || '?'}
                                                    </span>
                                                    <span className="text-gray-600 dark:text-gray-300">{task.assignedName || task.assignedTo}</span>
                                                </span>
                                            </td>
                                        )}
                                        {/* NO System Qty — Blind Count */}
                                        <td className="px-4 py-2.5 text-center font-bold text-gray-900 dark:text-white">{task.counted ? task.countedQty : '—'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {task.needsRecount ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-orange-600">
                                                    <RotateCcw className="w-3.5 h-3.5" />Recount
                                                </span>
                                            ) : task.counted ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                            ) : (
                                                <Clock className="w-4 h-4 text-gray-300 mx-auto" />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredTasks.length === 0 && (
                                <tr>
                                    <td colSpan={isAdmin && filterAssignee === 'all' ? 7 : 6} className="px-4 py-8 text-center text-gray-400">
                                        No tasks match current filters
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CycleCount;
