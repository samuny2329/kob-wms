import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Download, Trash2, ChevronLeft, ChevronRight, Package, ScanLine, Truck, ShoppingCart, Calendar, User, Filter, BarChart2, Clock, Hash, FileText, ArrowUpDown } from 'lucide-react';
import { queryActivities, getStats, getWorkers, getCount, exportAll, clearAll } from '../utils/activityDB';

const ACTION_CONFIG = {
    pick:             { label: 'Pick',           labelTh: 'หยิบ',         color: '#2563eb', bg: '#eff6ff', icon: ShoppingCart },
    pack:             { label: 'Pack',           labelTh: 'แพ็ค',         color: '#7c3aed', bg: '#f5f3ff', icon: Package },
    'pack-handheld':  { label: 'Pack (HH)',      labelTh: 'แพ็ค (มือถือ)', color: '#7c3aed', bg: '#f5f3ff', icon: Package },
    'pack-pos':       { label: 'Pack (POS)',     labelTh: 'แพ็ค (POS)',   color: '#7c3aed', bg: '#f5f3ff', icon: Package },
    scan:             { label: 'Outbound Scan',  labelTh: 'สแกนขาออก',    color: '#ea580c', bg: '#fff7ed', icon: ScanLine },
    dispatch:         { label: 'Dispatch',       labelTh: 'ส่งออก',       color: '#16a34a', bg: '#f0fdf4', icon: Truck },
    awb_confirm:      { label: 'AWB Confirm',    labelTh: 'ยืนยัน AWB',   color: '#0891b2', bg: '#ecfeff', icon: FileText },
    'box-handheld':   { label: 'Box Select',     labelTh: 'เลือกกล่อง',   color: '#a855f7', bg: '#faf5ff', icon: Package },
    'create-so-odoo': { label: 'Create SO',      labelTh: 'สร้าง SO',     color: '#714B67', bg: '#fdf4fb', icon: FileText },
    import:           { label: 'Import',         labelTh: 'นำเข้า',       color: '#64748b', bg: '#f8fafc', icon: Download },
};

const PERIOD_OPTIONS = [
    { value: 'today', label: 'Today', labelTh: 'วันนี้' },
    { value: 'yesterday', label: 'Yesterday', labelTh: 'เมื่อวาน' },
    { value: 'week', label: 'This Week', labelTh: 'สัปดาห์นี้' },
    { value: 'month', label: 'This Month', labelTh: 'เดือนนี้' },
    { value: 'year', label: 'This Year', labelTh: 'ปีนี้' },
    { value: 'custom', label: 'Custom', labelTh: 'กำหนดเอง' },
];

function getDateRange(period) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    switch (period) {
        case 'today': return { from: today, to: today };
        case 'yesterday': {
            const y = new Date(now); y.setDate(y.getDate() - 1);
            const yd = y.toISOString().slice(0, 10);
            return { from: yd, to: yd };
        }
        case 'week': {
            const w = new Date(now); w.setDate(w.getDate() - w.getDay());
            return { from: w.toISOString().slice(0, 10), to: today };
        }
        case 'month': return { from: today.slice(0, 8) + '01', to: today };
        case 'year': return { from: today.slice(0, 5) + '01-01', to: today };
        default: return { from: today, to: today };
    }
}

export default function ActivityHistory({ language = 'en' }) {
    const th = language === 'th';
    const [period, setPeriod] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [searchText, setSearchText] = useState('');
    const [records, setRecords] = useState([]);
    const [stats, setStats] = useState(null);
    const [workers, setWorkers] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('list'); // list | stats
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 50;

    const dateRange = useMemo(() => {
        if (period === 'custom') return { from: customFrom, to: customTo };
        return getDateRange(period);
    }, [period, customFrom, customTo]);

    const loadData = useCallback(async () => {
        if (!dateRange.from || !dateRange.to) return;
        setLoading(true);
        try {
            const filters = {
                dateFrom: dateRange.from,
                dateTo: dateRange.to,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            };
            if (filterAction) filters.action = filterAction;
            if (filterWorker) filters.username = filterWorker;
            if (searchText) filters.searchText = searchText;

            const [recs, st, wk, cnt] = await Promise.all([
                queryActivities(filters),
                getStats(dateRange.from, dateRange.to, filterWorker || undefined),
                getWorkers(),
                getCount(),
            ]);
            setRecords(recs);
            setStats(st);
            setWorkers(wk);
            setTotalCount(cnt);
        } catch (e) {
            console.error('Load activity data failed:', e);
        }
        setLoading(false);
    }, [dateRange, filterAction, filterWorker, searchText, page]);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { setPage(0); }, [period, filterAction, filterWorker, searchText]);

    const handleExport = async () => {
        const data = await exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wms-activity-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClear = async () => {
        if (window.confirm(th ? 'ลบประวัติทั้งหมด? (ย้อนกลับไม่ได้)' : 'Clear ALL activity history? (Cannot undo)')) {
            await clearAll();
            loadData();
        }
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleString(th ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const formatDate = (ts) => {
        const d = new Date(ts);
        return d.toLocaleDateString(th ? 'th-TH' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Clock style={{ color: '#714B67' }} size={24} />
                        {th ? 'ประวัติกิจกรรม' : 'Activity History'}
                    </h2>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                        {th ? `ทั้งหมด ${totalCount.toLocaleString()} รายการใน IndexedDB` : `${totalCount.toLocaleString()} total records in IndexedDB`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}>
                        <Download size={15} /> {th ? 'ส่งออก JSON' : 'Export JSON'}
                    </button>
                    <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                        <Trash2 size={15} /> {th ? 'ล้างทั้งหมด' : 'Clear All'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                {/* Period */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={15} color="#64748b" />
                    <select value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontWeight: 600, background: '#fff' }}>
                        {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{th ? p.labelTh : p.label}</option>)}
                    </select>
                </div>
                {period === 'custom' && (
                    <>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>—</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
                    </>
                )}

                {/* Action filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={15} color="#64748b" />
                    <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontWeight: 600, background: '#fff' }}>
                        <option value="">{th ? 'ทุกประเภท' : 'All Actions'}</option>
                        {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{th ? v.labelTh : v.label}</option>
                        ))}
                    </select>
                </div>

                {/* Worker filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={15} color="#64748b" />
                    <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontWeight: 600, background: '#fff' }}>
                        <option value="">{th ? 'ทุกคน' : 'All Workers'}</option>
                        {workers.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>

                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
                    <Search size={15} color="#64748b" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        placeholder={th ? 'ค้นหา AWB, เลขออเดอร์, SKU...' : 'Search AWB, Order#, SKU...'}
                        style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, width: '100%', background: '#fff' }}
                    />
                </div>

                {/* View toggle */}
                <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #d1d5db', overflow: 'hidden' }}>
                    <button onClick={() => setView('list')} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'list' ? '#714B67' : '#fff', color: view === 'list' ? '#fff' : '#475569' }}>
                        {th ? 'รายการ' : 'List'}
                    </button>
                    <button onClick={() => setView('stats')} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'stats' ? '#714B67' : '#fff', color: view === 'stats' ? '#fff' : '#475569' }}>
                        {th ? 'สรุป' : 'Summary'}
                    </button>
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>{th ? 'กำลังโหลด...' : 'Loading...'}</div>}

            {/* ── Stats View ─────────────────────────────────────────────── */}
            {!loading && view === 'stats' && stats && (
                <div>
                    {/* Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                        {[
                            { label: 'Pick', labelTh: 'หยิบ', value: stats.totalPick, color: '#2563eb', bg: '#eff6ff', icon: ShoppingCart },
                            { label: 'Pack', labelTh: 'แพ็ค', value: stats.totalPack, color: '#7c3aed', bg: '#f5f3ff', icon: Package },
                            { label: 'Scan', labelTh: 'สแกน', value: stats.totalScan, color: '#ea580c', bg: '#fff7ed', icon: ScanLine },
                            { label: 'Dispatch', labelTh: 'ส่งออก', value: stats.totalDispatch, color: '#16a34a', bg: '#f0fdf4', icon: Truck },
                            { label: 'Orders', labelTh: 'ออเดอร์', value: stats.totalOrders, color: '#0891b2', bg: '#ecfeff', icon: Hash },
                            { label: 'AWBs', labelTh: 'AWB', value: stats.totalAWBs, color: '#a855f7', bg: '#faf5ff', icon: FileText },
                        ].map(c => (
                            <div key={c.label} style={{ padding: 16, borderRadius: 12, background: c.bg, textAlign: 'center', border: `1px solid ${c.color}22` }}>
                                <c.icon size={20} color={c.color} style={{ marginBottom: 6 }} />
                                <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value.toLocaleString()}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: c.color, opacity: 0.8, textTransform: 'uppercase' }}>{th ? c.labelTh : c.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Worker breakdown */}
                    <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', fontWeight: 700, fontSize: 14, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={16} /> {th ? 'สรุปรายบุคคล' : 'Per Worker Summary'}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9' }}>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>{th ? 'พนักงาน' : 'Worker'}</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>Pick</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#7c3aed' }}>Pack</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#ea580c' }}>Scan</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>Dispatch</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#0891b2' }}>{th ? 'ออเดอร์' : 'Orders'}</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>{th ? 'รวม' : 'Total'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(stats.byWorker).sort((a, b) => (b[1].pick + b[1].pack + b[1].scan) - (a[1].pick + a[1].pack + a[1].scan)).map(([name, w], idx) => (
                                        <tr key={name} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>{name}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#2563eb', fontWeight: 700 }}>{w.pick}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#7c3aed', fontWeight: 700 }}>{w.pack}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#ea580c', fontWeight: 700 }}>{w.scan}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{w.dispatch}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#0891b2', fontWeight: 700 }}>{w.orders}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>{w.pick + w.pack + w.scan + w.dispatch}</td>
                                        </tr>
                                    ))}
                                    {Object.keys(stats.byWorker).length === 0 && (
                                        <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>{th ? 'ไม่มีข้อมูล' : 'No data'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Daily breakdown */}
                    {Object.keys(stats.byDate).length > 1 && (
                        <div style={{ marginTop: 16, borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px', background: '#f8fafc', fontWeight: 700, fontSize: 14, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} /> {th ? 'สรุปรายวัน' : 'Daily Breakdown'}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>{th ? 'วันที่' : 'Date'}</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>Pick</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#7c3aed' }}>Pack</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#ea580c' }}>Scan</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>{th ? 'รวม' : 'Total'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(stats.byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, d], idx) => (
                                            <tr key={date} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{date}</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#2563eb', fontWeight: 700 }}>{d.pick}</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#7c3aed', fontWeight: 700 }}>{d.pack}</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#ea580c', fontWeight: 700 }}>{d.scan}</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>{d.pick + d.pack + d.scan}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── List View ──────────────────────────────────────────────── */}
            {!loading && view === 'list' && (
                <div>
                    <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9' }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{th ? 'วันเวลา' : 'Date/Time'}</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>{th ? 'ประเภท' : 'Action'}</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>{th ? 'พนักงาน' : 'Worker'}</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>{th ? 'เลขออเดอร์' : 'Order Ref'}</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>AWB</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>SKU</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>{th ? 'รายละเอียด' : 'Details'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((r, idx) => {
                                        const cfg = ACTION_CONFIG[r.action] || { label: r.action, labelTh: r.action, color: '#64748b', bg: '#f8fafc', icon: Clock };
                                        const Icon = cfg.icon;
                                        return (
                                            <tr key={r.id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{formatDate(r.timestamp)}</div>
                                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatTime(r.timestamp)}</div>
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
                                                        <Icon size={13} /> {th ? cfg.labelTh : cfg.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>{r.name || r.username || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{r.orderRef || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#ea580c', fontWeight: 600 }}>{r.awb || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{r.sku || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {r.boxType && `Box: ${r.boxType}`}
                                                    {r.courier && `Courier: ${r.courier}`}
                                                    {r.platform && `Platform: ${r.platform}`}
                                                    {r.itemCount && `${r.itemCount} items`}
                                                    {!r.boxType && !r.courier && !r.platform && !r.itemCount && '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {records.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ padding: 50, textAlign: 'center', color: '#94a3b8' }}>
                                                <ScanLine size={40} style={{ marginBottom: 10, opacity: 0.3 }} />
                                                <div style={{ fontSize: 15, fontWeight: 600 }}>{th ? 'ยังไม่มีข้อมูล' : 'No activity records yet'}</div>
                                                <div style={{ fontSize: 12, marginTop: 4 }}>{th ? 'เริ่มใช้งาน Pick / Pack / Scan แล้วข้อมูลจะบันทึกอัตโนมัติ' : 'Start using Pick / Pack / Scan and records will be saved automatically'}</div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {records.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13, color: '#64748b' }}>
                            <span>{th ? `หน้า ${page + 1}` : `Page ${page + 1}`} — {th ? `แสดง ${records.length} รายการ` : `Showing ${records.length} records`}</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <ChevronLeft size={14} /> {th ? 'ก่อนหน้า' : 'Prev'}
                                </button>
                                <button onClick={() => setPage(p => p + 1)} disabled={records.length < PAGE_SIZE} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: records.length < PAGE_SIZE ? 'not-allowed' : 'pointer', opacity: records.length < PAGE_SIZE ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {th ? 'ถัดไป' : 'Next'} <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
