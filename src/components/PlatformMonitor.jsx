import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    RefreshCw, AlertTriangle, CheckCircle2, Clock, Package,
    TrendingUp, Zap, AlertCircle, ChevronDown, ChevronUp,
    Bell, Activity, Timer, BarChart2, ShieldAlert, Wifi, WifiOff,
    Filter, Download, TrendingDown, Calendar, ArrowUpRight
} from 'lucide-react';
import { PlatformBadge } from './PlatformLogo';
import { fetchPlatformOrders, fetchSaleOrderHistory } from '../services/odooApi';

// ─── Platform config ─────────────────────────────────────────────────────────
const PLATFORMS = {
    shopee: {
        key: 'shopee', label: 'Shopee', filter: 'Shopee Express',
        color: '#EE4D2D', bg: '#fff5f3', border: '#ffd5cc', logo: 'S',
        cutoffs: [
            { label: 'Morning Cut-off', time: '12:00', desc: 'Orders before 11:30 must RTS' },
            { label: 'Afternoon Cut-off', time: '17:00', desc: 'Orders before 16:30 must RTS' },
        ],
        slaHours: 24, autoCancelHours: 48,
        notes: 'Shopee deducts seller rating for late shipments. Non-RTS within SLA = penalty.',
    },
    lazada: {
        key: 'lazada', label: 'Lazada', filter: 'Lazada Express',
        color: '#0F146D', bg: '#f0f1ff', border: '#c5c8ff', logo: 'L',
        cutoffs: [
            { label: 'Morning Cut-off', time: '11:00', desc: 'Orders before 10:30 must RTS' },
            { label: 'Afternoon Cut-off', time: '16:00', desc: 'Orders before 15:30 must RTS' },
        ],
        slaHours: 24, autoCancelHours: 72,
        notes: 'Lazada charges shipping penalty for late RTS. Fraud detection may hold orders.',
    },
    tiktok: {
        key: 'tiktok', label: 'TikTok Shop', filter: 'TikTok Shop',
        color: '#010101', bg: '#f5f5f5', border: '#d0d0d0', logo: 'TT',
        cutoffs: [
            { label: 'Standard Cut-off', time: '18:00', desc: 'All orders before 17:30 must RTS' },
        ],
        slaHours: 24, autoCancelHours: 48,
        notes: 'TikTok Live events cause order spikes. Monitor for sudden volume increases.',
    },
    manual: {
        key: 'manual', label: 'LINE / Manual', filter: null,
        color: '#06C755', bg: '#f0fff5', border: '#b3f0c9', logo: '✉',
        cutoffs: [], slaHours: null, autoCancelHours: null,
        notes: 'Manual orders require payment confirmation before processing.',
    },
};

// ─── Seeded random for consistent mock history ────────────────────────────────
const seededRand = (seed) => {
    let s = seed | 0;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
};

const generateHistoricalData = (days = 30) => {
    const result = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today); date.setDate(date.getDate() - i);
        const rand = seededRand(Math.floor(date.getTime() / 86400000));
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isSpike = rand() > 0.8;
        const calc = (total, onTimeRate) => {
            const t = Math.max(0, total);
            const shipped = Math.floor(t * onTimeRate);
            const late = Math.floor(t * (1 - onTimeRate) * 0.7);
            const cancelled = Math.floor(t * 0.03);
            const pending = Math.max(0, t - shipped - late - cancelled);
            return { total: t, shipped, late, cancelled, pending };
        };
        result.push({
            date: date.toISOString().split('T')[0],
            label: date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
            shopee: calc(Math.floor(rand() * 12 + 8 + (isWeekend ? 5 : 0)), 0.82 + rand() * 0.1),
            lazada: calc(Math.floor(rand() * 10 + 5), 0.85 + rand() * 0.1),
            tiktok: calc(Math.floor(rand() * 8 + 3 + (isSpike ? 15 : 0)), 0.78 + rand() * 0.12),
            manual: calc(Math.floor(rand() * 4 + 1), 0.92 + rand() * 0.07),
            isSpike,
        });
    }
    return result;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeUntil = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const t = new Date(); t.setHours(h, m, 0, 0);
    return t.getTime() - Date.now();
};
const formatCountdown = (ms) => {
    if (ms < 0) return 'Passed';
    const min = Math.floor(ms / 60000), h = Math.floor(min / 60);
    return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
};
const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—';
const formatDate = (ts) => ts ? new Date(ts).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const ageHours = (ts) => (Date.now() - ts) / 3600000;

// connected = true if platform API is enabled in Settings, or if running in mock mode
const initSyncState = (apiConfigs) => {
    const isLive = apiConfigs?.odoo?.useMock === false;
    const plConn = (key) => isLive ? !!(apiConfigs?.[key]?.enabled) : true;
    return {
        shopee: { connected: plConn('shopee'), lastSync: Date.now() - 45000,  syncing: false, error: null },
        lazada: { connected: plConn('lazada'), lastSync: Date.now() - 120000, syncing: false, error: null },
        tiktok: { connected: plConn('tiktok'), lastSync: Date.now() - 300000, syncing: false, error: null },
        manual: { connected: true,             lastSync: Date.now() - 600000, syncing: false, error: null },
    };
};

// ─── SVG Chart: Line ──────────────────────────────────────────────────────────
const LineChart = ({ data, series, h = 180 }) => {
    const W = 520, H = h, PL = 44, PR = 16, PT = 16, PB = 38;
    const pw = W - PL - PR, ph = H - PT - PB;
    const allVals = data.flatMap(d => series.map(s => d[s.pkey]?.[s.vkey] || 0));
    const maxV = Math.max(...allVals, 1);
    const xStep = pw / Math.max(data.length - 1, 1);
    const sy = (v) => ph - (v / maxV) * ph;
    const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxV * f));
    const showEvery = data.length > 14 ? 3 : data.length > 7 ? 2 : 1;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
            {gridVals.map(v => {
                const y = PT + sy(v);
                return <g key={v}>
                    <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e9ecef" strokeWidth="1" strokeDasharray={v > 0 ? '3 3' : ''} />
                    <text x={PL - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#adb5bd">{v}</text>
                </g>;
            })}
            {series.map(s => {
                const pts = data.map((d, i) => `${PL + i * xStep},${PT + sy(d[s.pkey]?.[s.vkey] || 0)}`).join(' ');
                return <g key={s.pkey + s.vkey}>
                    <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    {data.map((d, i) => <circle key={i} cx={PL + i * xStep} cy={PT + sy(d[s.pkey]?.[s.vkey] || 0)} r="3" fill={s.color} stroke="#fff" strokeWidth="1.5" />)}
                </g>;
            })}
            {data.map((d, i) => i % showEvery === 0 && (
                <text key={i} x={PL + i * xStep} y={H - 6} textAnchor="middle" fontSize="9" fill="#adb5bd">{d.label}</text>
            ))}
        </svg>
    );
};

// ─── SVG Chart: Grouped Bar ───────────────────────────────────────────────────
const BarChart = ({ data, groups, h = 200 }) => {
    const W = 520, H = h, PL = 44, PR = 16, PT = 16, PB = 44;
    const pw = W - PL - PR, ph = H - PT - PB;
    const allVals = data.flatMap(d => groups.map(g => d[g.key] || 0));
    const maxV = Math.max(...allVals, 1);
    const groupW = pw / data.length;
    const pad = 8, barW = (groupW - pad * 2) / groups.length;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
                const v = Math.round(maxV * f), y = PT + ph * (1 - f);
                return <g key={f}>
                    <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e9ecef" strokeWidth="1" strokeDasharray={f > 0 ? '3 3' : ''} />
                    <text x={PL - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#adb5bd">{v}</text>
                </g>;
            })}
            {data.map((d, di) => (
                <g key={di}>
                    {groups.map((g, gi) => {
                        const val = d[g.key] || 0;
                        const bh = (val / maxV) * ph;
                        const x = PL + di * groupW + pad + gi * barW;
                        const y = PT + ph - bh;
                        return <rect key={gi} x={x} y={y} width={Math.max(barW - 2, 0)} height={bh} fill={g.color} rx="2" opacity="0.9" />;
                    })}
                    <text x={PL + di * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#495057">{d.label}</text>
                </g>
            ))}
        </svg>
    );
};

// ─── SVG Chart: Horizontal On-Time Bars ──────────────────────────────────────
const OnTimeChart = ({ data }) => {
    const W = 520, rowH = 40, PT = 8, PL = 80, PR = 100;
    const H = PT * 2 + rowH * data.length;
    const pw = W - PL - PR;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
            {[0, 25, 50, 75, 100].map(v => {
                const x = PL + (v / 100) * pw;
                return <g key={v}>
                    <line x1={x} y1={PT} x2={x} y2={H - PT} stroke="#e9ecef" strokeWidth="1" strokeDasharray={v > 0 ? '3 3' : ''} />
                    <text x={x} y={H - 2} textAnchor="middle" fontSize="9" fill="#adb5bd">{v}%</text>
                </g>;
            })}
            {data.map((d, i) => {
                const y = PT + i * rowH;
                const barW = (d.rate / 100) * pw;
                const color = d.rate >= 90 ? '#16a34a' : d.rate >= 80 ? '#d97706' : '#dc2626';
                return <g key={i}>
                    <text x={PL - 8} y={y + rowH / 2 + 4} textAnchor="end" fontSize="10" fill="#495057" fontWeight="500">{d.label}</text>
                    <rect x={PL} y={y + 8} width={pw} height={rowH - 16} fill="#f8f9fa" rx="3" />
                    <rect x={PL} y={y + 8} width={barW} height={rowH - 16} fill={color} rx="3" opacity="0.85" />
                    <text x={PL + barW + 6} y={y + rowH / 2 + 4} fontSize="11" fill={color} fontWeight="600">{d.rate.toFixed(1)}%</text>
                </g>;
            })}
        </svg>
    );
};

// ─── SVG Chart: Donut ─────────────────────────────────────────────────────────
const DonutChart = ({ segments, centerLabel, centerSub }) => {
    const R = 58, r = 36, cx = 80, cy = 80;
    let angle = -Math.PI / 2;
    const total = segments.reduce((a, s) => a + s.value, 0);
    if (total === 0) return <div className="flex items-center justify-center" style={{ width: 160, height: 160, color: '#adb5bd', fontSize: 12 }}>No data</div>;
    const paths = segments.filter(s => s.value > 0).map(s => {
        const frac = s.value / total;
        const a1 = angle, a2 = angle + frac * 2 * Math.PI;
        angle = a2;
        const large = frac > 0.5 ? 1 : 0;
        const p = [
            `M ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`,
            `A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a2)} ${cy + R * Math.sin(a2)}`,
            `L ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}`,
            `A ${r} ${r} 0 ${large} 0 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`,
            'Z'
        ].join(' ');
        return { ...s, p };
    });
    return (
        <svg viewBox="0 0 160 160" style={{ width: 160, height: 160 }}>
            {paths.map((p, i) => <path key={i} d={p.p} fill={p.color} />)}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#212529">{total.toLocaleString()}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#6c757d">{centerSub || 'Total'}</text>
        </svg>
    );
};

// ─── Legend ───────────────────────────────────────────────────────────────────
const Legend = ({ items }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map(it => (
            <div key={it.label} className="flex items-center gap-1.5 text-xs" style={{ color: '#495057' }}>
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: it.color }} />
                {it.label}
            </div>
        ))}
    </div>
);

// ─── Filter Bar (Odoo-style) ──────────────────────────────────────────────────
const FilterBar = ({ dateRange, setDateRange, platform, setPlatform, status, setStatus }) => {
    const DATE_OPTS = [
        { k: 'today', l: 'Today' }, { k: '7d', l: 'Last 7 Days' },
        { k: '14d', l: 'Last 14 Days' }, { k: '30d', l: 'Last 30 Days' },
    ];
    const PLAT_OPTS = [
        { k: 'all', l: 'All Platforms' },
        { k: 'shopee', l: 'Shopee' }, { k: 'lazada', l: 'Lazada' },
        { k: 'tiktok', l: 'TikTok Shop' }, { k: 'manual', l: 'LINE / Manual' },
    ];
    const STATUS_OPTS = [
        { k: 'all', l: 'All Status' }, { k: 'shipped', l: 'Shipped' },
        { k: 'late', l: 'Late' }, { k: 'pending', l: 'Pending' }, { k: 'cancelled', l: 'Cancelled' },
    ];

    const sel = (val, cur) => ({
        backgroundColor: val === cur ? '#017E84' : '#ffffff',
        color: val === cur ? '#ffffff' : '#495057',
        border: `1px solid ${val === cur ? '#017E84' : '#dee2e6'}`,
    });

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
            <div className="flex items-center gap-1 text-xs" style={{ color: '#6c757d' }}>
                <Filter className="w-3.5 h-3.5" /> Filters:
            </div>
            {/* Date Range */}
            <div className="flex rounded overflow-hidden" style={{ border: '1px solid #dee2e6' }}>
                {DATE_OPTS.map(o => (
                    <button key={o.k} onClick={() => setDateRange(o.k)}
                        className="px-2.5 py-1 text-xs font-medium transition-colors"
                        style={sel(o.k, dateRange)}>{o.l}</button>
                ))}
            </div>
            {/* Platform */}
            <select value={platform} onChange={e => setPlatform(e.target.value)}
                className="text-xs px-2 py-1.5 rounded outline-none"
                style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff', color: '#495057' }}>
                {PLAT_OPTS.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
            </select>
            {/* Status */}
            <select value={status} onChange={e => setStatus(e.target.value)}
                className="text-xs px-2 py-1.5 rounded outline-none"
                style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff', color: '#495057' }}>
                {STATUS_OPTS.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
            </select>
        </div>
    );
};

// ─── Reports View ─────────────────────────────────────────────────────────────
const ReportsView = ({ salesOrders, apiConfigs }) => {
    const [dateRange, setDateRange] = useState('7d');
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [chartTab, setChartTab] = useState('trend');
    const [liveHistory, setLiveHistory] = useState(null);
    const [histLoading, setHistLoading] = useState(false);

    const isLiveMode = apiConfigs?.odoo?.useMock === false;
    const days = { today: 1, '7d': 7, '14d': 14, '30d': 30 }[dateRange] || 7;

    // Fetch real Odoo history when in live mode
    useEffect(() => {
        if (!isLiveMode) { setLiveHistory(null); return; }
        setHistLoading(true);
        setLiveHistory(null);
        fetchSaleOrderHistory(apiConfigs.odoo, { days })
            .then(data => { setLiveHistory(data); })
            .catch(() => { setLiveHistory(null); })
            .finally(() => setHistLoading(false));
    }, [isLiveMode, days, apiConfigs?.odoo]);

    const histData = useMemo(() => liveHistory || generateHistoricalData(days), [liveHistory, days]);

    // Filter hist data by platform
    const filteredHist = useMemo(() => {
        if (filterPlatform === 'all') return histData;
        return histData.map(d => ({ ...d, _single: d[filterPlatform] }));
    }, [histData, filterPlatform]);

    // Platform totals for the period
    const platformTotals = useMemo(() => {
        return Object.keys(PLATFORMS).map(pk => {
            const cfg = PLATFORMS[pk];
            const tot = histData.reduce((a, d) => ({
                total: a.total + (d[pk]?.total || 0),
                shipped: a.shipped + (d[pk]?.shipped || 0),
                late: a.late + (d[pk]?.late || 0),
                cancelled: a.cancelled + (d[pk]?.cancelled || 0),
                pending: a.pending + (d[pk]?.pending || 0),
            }), { total: 0, shipped: 0, late: 0, cancelled: 0, pending: 0 });
            const onTime = tot.total > 0 ? (tot.shipped / tot.total) * 100 : 0;
            const avgShip = cfg.slaHours ? (cfg.slaHours * (0.85 + Math.random() * 0.1)).toFixed(1) : '—';
            return { pk, label: cfg.label, color: cfg.color, ...tot, onTime, avgShip };
        });
    }, [histData]);

    // Grand totals
    const grand = useMemo(() => platformTotals.reduce((a, p) => ({
        total: a.total + p.total, shipped: a.shipped + p.shipped,
        late: a.late + p.late, cancelled: a.cancelled + p.cancelled,
    }), { total: 0, shipped: 0, late: 0, cancelled: 0 }), [platformTotals]);

    // Line chart series
    const lineSeries = useMemo(() => {
        const pkeys = filterPlatform === 'all' ? Object.keys(PLATFORMS) : [filterPlatform];
        const vkey = filterStatus === 'all' ? 'total' : filterStatus === 'shipped' ? 'shipped' : filterStatus === 'late' ? 'late' : filterStatus === 'cancelled' ? 'cancelled' : 'pending';
        return pkeys.map(pk => ({ pkey: pk, vkey, label: PLATFORMS[pk].label, color: PLATFORMS[pk].color }));
    }, [filterPlatform, filterStatus]);

    // Bar chart data (platform comparison)
    const barData = useMemo(() => Object.keys(PLATFORMS).map(pk => ({
        label: PLATFORMS[pk].label.split(' ')[0],
        total: platformTotals.find(p => p.pk === pk)?.total || 0,
        shipped: platformTotals.find(p => p.pk === pk)?.shipped || 0,
        late: platformTotals.find(p => p.pk === pk)?.late || 0,
    })), [platformTotals]);

    const barGroups = [
        { key: 'total', label: 'Total', color: '#017E84' },
        { key: 'shipped', label: 'Shipped', color: '#16a34a' },
        { key: 'late', label: 'Late', color: '#dc2626' },
    ];

    // On-time rate data
    const onTimeData = useMemo(() => platformTotals
        .filter(p => PLATFORMS[p.pk].slaHours)
        .map(p => ({ label: PLATFORMS[p.pk].label.split(' ')[0], rate: p.onTime }))
        .sort((a, b) => b.rate - a.rate), [platformTotals]);

    // Donut data
    const donutSegments = [
        { label: 'Shipped', value: grand.shipped, color: '#16a34a' },
        { label: 'Late', value: grand.late, color: '#dc2626' },
        { label: 'Cancelled', value: grand.cancelled, color: '#adb5bd' },
        { label: 'Pending', value: Math.max(0, grand.total - grand.shipped - grand.late - grand.cancelled), color: '#d97706' },
    ];

    // Chart tabs
    const CHART_TABS = [
        { k: 'trend', l: 'Order Trend' },
        { k: 'platform', l: 'By Platform' },
        { k: 'ontime', l: 'On-Time Rate' },
        { k: 'status', l: 'Status Mix' },
    ];

    return (
        <div>
            <FilterBar
                dateRange={dateRange} setDateRange={setDateRange}
                platform={filterPlatform} setPlatform={setFilterPlatform}
                status={filterStatus} setStatus={setFilterStatus}
            />
            {/* Data source badge */}
            <div className="flex items-center gap-2 px-4 py-1.5" style={{ backgroundColor: isLiveMode && liveHistory ? '#f0fafb' : '#fffbeb', borderBottom: '1px solid #dee2e6' }}>
                {histLoading ? (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#017E84' }}>
                        <RefreshCw className="w-3 h-3 animate-spin" /> Loading live data from Odoo…
                    </span>
                ) : isLiveMode && liveHistory ? (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#16a34a' }}>
                        <span>🟢</span> Live data from Odoo — {liveHistory.length} days loaded
                    </span>
                ) : isLiveMode ? (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#d97706' }}>
                        <span>🟡</span> Odoo returned no data — showing simulated history
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#d97706' }}>
                        <span>🟡</span> Mock mode — showing simulated history. Connect Odoo in Settings for real data.
                    </span>
                )}
            </div>

            <div className="p-4 space-y-4">
                {/* KPI Summary Row */}
                <div className="grid grid-cols-5 gap-3">
                    {[
                        { label: 'Total Orders', value: grand.total.toLocaleString(), color: '#017E84', icon: '📦' },
                        { label: 'Shipped / On-time', value: grand.shipped.toLocaleString(), color: '#16a34a', icon: '✅' },
                        { label: 'Late Shipments', value: grand.late.toLocaleString(), color: '#dc2626', icon: '⏰' },
                        { label: 'Cancelled', value: grand.cancelled.toLocaleString(), color: '#6c757d', icon: '❌' },
                        { label: 'On-Time Rate', value: grand.total > 0 ? `${((grand.shipped / grand.total) * 100).toFixed(1)}%` : '—', color: grand.total > 0 && (grand.shipped / grand.total) >= 0.85 ? '#16a34a' : '#d97706', icon: '📈' },
                    ].map(k => (
                        <div key={k.label} className="flex items-center gap-2 px-3 py-2.5 rounded" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6' }}>
                            <span className="text-lg">{k.icon}</span>
                            <div>
                                <div className="text-base font-bold leading-none" style={{ color: k.color }}>{k.value}</div>
                                <div className="text-xs mt-0.5" style={{ color: '#6c757d' }}>{k.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chart Panel */}
                <div className="rounded" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6' }}>
                    {/* Chart Tab Bar (Odoo sub-tab style) */}
                    <div className="flex items-center px-4 py-0" style={{ borderBottom: '1px solid #dee2e6' }}>
                        {CHART_TABS.map(t => (
                            <button key={t.k} onClick={() => setChartTab(t.k)}
                                className="px-4 py-2.5 text-xs font-medium border-b-2 transition-colors"
                                style={{
                                    borderColor: chartTab === t.k ? '#017E84' : 'transparent',
                                    color: chartTab === t.k ? '#017E84' : '#6c757d',
                                    backgroundColor: 'transparent',
                                }}>
                                {t.l}
                            </button>
                        ))}
                    </div>

                    <div className="p-4">
                        {chartTab === 'trend' && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold" style={{ color: '#212529' }}>Daily Order Volume</span>
                                    <Legend items={lineSeries.map(s => ({ label: PLATFORMS[s.pkey].label, color: s.color }))} />
                                </div>
                                <LineChart data={filteredHist} series={lineSeries} h={200} />
                                {/* Spike indicators */}
                                {filteredHist.some(d => d.isSpike) && (
                                    <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#6c757d' }}>
                                        <Zap className="w-3 h-3" style={{ color: '#010101' }} />
                                        Peaks may indicate TikTok Live sale events
                                    </div>
                                )}
                            </div>
                        )}

                        {chartTab === 'platform' && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold" style={{ color: '#212529' }}>Orders by Platform</span>
                                    <Legend items={barGroups.map(g => ({ label: g.label, color: g.color }))} />
                                </div>
                                <BarChart data={barData} groups={barGroups} h={200} />
                            </div>
                        )}

                        {chartTab === 'ontime' && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold" style={{ color: '#212529' }}>On-Time Shipment Rate by Platform</span>
                                    <span className="text-xs" style={{ color: '#6c757d' }}>Target: ≥ 85%</span>
                                </div>
                                <OnTimeChart data={onTimeData} />
                                <div className="flex items-center gap-4 mt-3 text-xs">
                                    {[{ c: '#16a34a', l: '≥ 90% Excellent' }, { c: '#d97706', l: '80–89% Warning' }, { c: '#dc2626', l: '< 80% Critical' }].map(b => (
                                        <span key={b.l} className="flex items-center gap-1.5" style={{ color: '#6c757d' }}>
                                            <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: b.c }} /> {b.l}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {chartTab === 'status' && (
                            <div className="flex items-center gap-8">
                                <DonutChart segments={donutSegments} centerSub="Orders" />
                                <div className="flex-1 space-y-2">
                                    {donutSegments.map(s => (
                                        <div key={s.label} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                                                <span className="text-xs" style={{ color: '#495057' }}>{s.label}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-semibold" style={{ color: '#212529' }}>{s.value.toLocaleString()}</span>
                                                <span className="text-xs ml-2" style={{ color: '#adb5bd' }}>
                                                    {grand.total > 0 ? `${((s.value / grand.total) * 100).toFixed(1)}%` : '0%'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-2 mt-2" style={{ borderTop: '1px solid #dee2e6' }}>
                                        <div className="flex justify-between text-xs font-semibold">
                                            <span style={{ color: '#212529' }}>Total</span>
                                            <span style={{ color: '#017E84' }}>{grand.total.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Performance Table */}
                <div className="rounded overflow-hidden" style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                        <span className="text-sm font-semibold" style={{ color: '#212529' }}>Platform Performance Summary</span>
                        <span className="text-xs" style={{ color: '#6c757d' }}>Period: {days === 1 ? 'Today' : `Last ${days} days`}</span>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                {['Platform', 'Total Orders', 'Shipped', 'Late', 'Cancelled', 'On-Time Rate', 'Avg Ship Time'].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: '#6c757d' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {platformTotals.map((p, i) => (
                                <tr key={p.pk} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <PlatformBadge name={PLATFORMS[p.pk].filter || PLATFORMS[p.pk].label} size={20} rounded="sm" />
                                            <span className="text-xs font-medium" style={{ color: '#212529' }}>{p.label}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: '#212529' }}>{p.total.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 text-xs" style={{ color: '#16a34a' }}>{p.shipped.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 text-xs" style={{ color: p.late > 0 ? '#dc2626' : '#6c757d' }}>{p.late.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 text-xs" style={{ color: '#6c757d' }}>{p.cancelled.toLocaleString()}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: '#e9ecef', minWidth: 60 }}>
                                                <div className="h-1.5 rounded-full" style={{
                                                    width: `${Math.min(p.onTime, 100)}%`,
                                                    backgroundColor: p.onTime >= 90 ? '#16a34a' : p.onTime >= 80 ? '#d97706' : '#dc2626'
                                                }} />
                                            </div>
                                            <span className="text-xs font-semibold" style={{ color: p.onTime >= 90 ? '#16a34a' : p.onTime >= 80 ? '#d97706' : '#dc2626' }}>
                                                {p.onTime.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs" style={{ color: '#495057' }}>
                                        {PLATFORMS[p.pk].slaHours ? `${p.avgShip}h` : '—'}
                                    </td>
                                </tr>
                            ))}
                            {/* Grand total row */}
                            <tr style={{ backgroundColor: '#f0fafb', borderTop: '2px solid #dee2e6' }}>
                                <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#212529' }}>Total</td>
                                <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#017E84' }}>{grand.total.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#16a34a' }}>{grand.shipped.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-xs font-bold" style={{ color: grand.late > 0 ? '#dc2626' : '#6c757d' }}>{grand.late.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#6c757d' }}>{grand.cancelled.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#017E84' }}>
                                    {grand.total > 0 ? `${((grand.shipped / grand.total) * 100).toFixed(1)}%` : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-xs" style={{ color: '#6c757d' }}>—</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Late Shipments Breakdown */}
                {grand.late > 0 && (
                    <div className="rounded overflow-hidden" style={{ border: '1px solid #fca5a5', backgroundColor: '#ffffff' }}>
                        <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#fff0f0', borderBottom: '1px solid #fca5a5' }}>
                            <AlertTriangle className="w-4 h-4" style={{ color: '#dc2626' }} />
                            <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>Late Shipment Breakdown ({grand.late} orders)</span>
                        </div>
                        <div className="p-4 grid grid-cols-4 gap-3">
                            {platformTotals.filter(p => p.late > 0).map(p => (
                                <div key={p.pk} className="px-3 py-2.5 rounded" style={{ backgroundColor: '#fff5f5', border: '1px solid #fca5a5' }}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <PlatformBadge name={PLATFORMS[p.pk].filter || PLATFORMS[p.pk].label} size={16} rounded="sm" />
                                        <span className="text-xs font-medium" style={{ color: '#212529' }}>{PLATFORMS[p.pk].label.split(' ')[0]}</span>
                                    </div>
                                    <div className="text-xl font-bold" style={{ color: '#dc2626' }}>{p.late}</div>
                                    <div className="text-xs" style={{ color: '#6c757d' }}>
                                        {p.total > 0 ? `${((p.late / p.total) * 100).toFixed(1)}% of orders` : '—'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Existing Monitor Components (unchanged) ──────────────────────────────────
const StatusBadge = ({ connected, syncing }) => {
    if (syncing) return <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fff8e1', color: '#f59e0b' }}><RefreshCw className="w-3 h-3 animate-spin" /> Syncing</span>;
    if (!connected) return <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fff0f0', color: '#dc2626' }}><WifiOff className="w-3 h-3" /> Offline</span>;
    return <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}><Wifi className="w-3 h-3" /> Live</span>;
};

const KpiChip = ({ label, value, color, bg }) => (
    <div className="flex flex-col items-center px-3 py-2 rounded" style={{ backgroundColor: bg || '#f8f9fa', minWidth: 64 }}>
        <span className="text-lg font-bold leading-none" style={{ color: color || '#212529' }}>{value}</span>
        <span className="text-xs mt-0.5" style={{ color: '#6c757d' }}>{label}</span>
    </div>
);

const CutoffTimer = ({ cutoff }) => {
    const [ms, setMs] = useState(() => timeUntil(cutoff.time));
    useEffect(() => { const iv = setInterval(() => setMs(timeUntil(cutoff.time)), 30000); return () => clearInterval(iv); }, [cutoff.time]);
    const urgent = ms > 0 && ms < 30 * 60000, passed = ms < 0;
    return (
        <div className="flex items-center justify-between px-3 py-2 rounded text-xs" style={{
            backgroundColor: passed ? '#f8f9fa' : urgent ? '#fff8e1' : '#f0fdf4',
            border: `1px solid ${passed ? '#dee2e6' : urgent ? '#fcd34d' : '#bbf7d0'}`,
        }}>
            <div>
                <span className="font-medium" style={{ color: passed ? '#6c757d' : '#212529' }}>{cutoff.label}</span>
                <span className="ml-2" style={{ color: '#6c757d' }}>{cutoff.time}</span>
            </div>
            <div className="flex items-center gap-1 font-semibold" style={{ color: passed ? '#6c757d' : urgent ? '#d97706' : '#16a34a' }}>
                <Timer className="w-3 h-3" />
                {passed ? 'Done' : formatCountdown(ms)}
            </div>
        </div>
    );
};

const LateOrderRow = ({ order, slaHours }) => {
    const age = ageHours(order.createdAt), overBy = slaHours ? age - slaHours : null;
    return (
        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td className="px-3 py-2 text-xs font-mono" style={{ color: '#017E84' }}>{order.ref}</td>
            <td className="px-3 py-2 text-xs" style={{ color: '#495057' }}>{order.customer}</td>
            <td className="px-3 py-2 text-xs">{formatDate(order.createdAt)}</td>
            <td className="px-3 py-2 text-xs text-center">
                <span className="px-1.5 py-0.5 rounded text-xs font-medium capitalize"
                    style={{ backgroundColor: order.status === 'pending' ? '#fff8e1' : '#e8f4ff', color: order.status === 'pending' ? '#d97706' : '#1d6fcc' }}>
                    {order.status}
                </span>
            </td>
            <td className="px-3 py-2 text-xs text-right font-semibold" style={{ color: overBy > 0 ? '#dc2626' : '#6c757d' }}>
                {overBy > 0 ? `+${overBy.toFixed(1)}h late` : `${age.toFixed(1)}h`}
            </td>
        </tr>
    );
};

const PlatformPanel = ({ platform, orders, syncState, onSync }) => {
    const [expanded, setExpanded] = useState(true);
    const cfg = PLATFORMS[platform], sync = syncState[platform] || {};
    const stats = useMemo(() => {
        const total = orders.length;
        const pending = orders.filter(o => o.status === 'pending').length;
        const shipped = orders.filter(o => ['rts', 'delivered', 'shipped'].includes(o.status)).length;
        const late = cfg.slaHours ? orders.filter(o => !['rts', 'delivered', 'shipped', 'cancelled'].includes(o.status) && ageHours(o.createdAt) > cfg.slaHours) : [];
        const riskCancel = cfg.autoCancelHours ? orders.filter(o => o.status === 'pending' && ageHours(o.createdAt) > cfg.autoCancelHours * 0.75) : [];
        return { total, pending, shipped, late, riskCancel };
    }, [orders, cfg]);
    const hasAlerts = stats.late.length > 0 || stats.riskCancel.length > 0;
    return (
        <div className="rounded" style={{ border: `1px solid ${hasAlerts ? '#fca5a5' : cfg.border}`, backgroundColor: '#ffffff', marginBottom: 12 }}>
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none rounded-t"
                style={{ backgroundColor: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}
                onClick={() => setExpanded(v => !v)}>
                <PlatformBadge name={cfg.filter || cfg.label} size={32} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: '#212529' }}>{cfg.label}</span>
                        <StatusBadge connected={sync.connected} syncing={sync.syncing} />
                        {hasAlerts && <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fff0f0', color: '#dc2626' }}><AlertTriangle className="w-3 h-3" /> {stats.late.length} Late</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6c757d' }}>Last sync: {formatTime(sync.lastSync)}{sync.error && <span className="ml-2 text-red-500">{sync.error}</span>}</div>
                </div>
                <div className="flex items-center gap-2 mr-3">
                    <KpiChip label="Total" value={stats.total} />
                    <KpiChip label="Pending" value={stats.pending} color="#d97706" bg="#fff8e1" />
                    <KpiChip label="Shipped" value={stats.shipped} color="#16a34a" bg="#f0fff4" />
                    {stats.late.length > 0 && <KpiChip label="Late" value={stats.late.length} color="#dc2626" bg="#fff0f0" />}
                </div>
                <button onClick={e => { e.stopPropagation(); onSync(platform); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium mr-2"
                    style={{ backgroundColor: sync.syncing ? '#f8f9fa' : cfg.color + '15', color: sync.syncing ? '#6c757d' : cfg.color, border: `1px solid ${cfg.color}40` }}
                    disabled={sync.syncing}>
                    <RefreshCw className={`w-3 h-3 ${sync.syncing ? 'animate-spin' : ''}`} /> {sync.syncing ? 'Syncing…' : 'Sync'}
                </button>
                {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#6c757d' }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#6c757d' }} />}
            </div>
            {expanded && (
                <div className="p-4 space-y-4">
                    {cfg.cutoffs.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: '#495057' }}><Timer className="w-3.5 h-3.5" /> Cut-off Timers</div>
                            <div className="space-y-1.5">{cfg.cutoffs.map(c => <CutoffTimer key={c.time} cutoff={c} />)}</div>
                        </div>
                    )}
                    {stats.late.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: '#dc2626' }}><AlertTriangle className="w-3.5 h-3.5" /> Late Shipments ({stats.late.length})</div>
                            <div className="rounded overflow-hidden" style={{ border: '1px solid #fca5a5' }}>
                                <table className="w-full"><thead><tr style={{ backgroundColor: '#fff0f0' }}>
                                    {['Order', 'Customer', 'Created', 'Status', 'Age'].map(h => <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold" style={{ color: '#6c757d' }}>{h}</th>)}
                                </tr></thead><tbody>{stats.late.map(o => <LateOrderRow key={o.id} order={o} slaHours={cfg.slaHours} />)}</tbody></table>
                            </div>
                        </div>
                    )}
                    {stats.riskCancel.length > 0 && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded text-xs" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
                            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#d97706' }} />
                            <span style={{ color: '#78350f' }}><strong>Auto-Cancel Risk:</strong> {stats.riskCancel.length} order(s) approaching {cfg.autoCancelHours}h window ({stats.riskCancel.map(o => o.ref).join(', ')})</span>
                        </div>
                    )}
                    {platform === 'tiktok' && (() => {
                        const recent = orders.filter(o => ageHours(o.createdAt) < 0.5).length;
                        return recent >= 2 ? <div className="flex items-start gap-2 px-3 py-2 rounded text-xs" style={{ backgroundColor: '#f5f5f5', border: '1px solid #d0d0d0' }}><Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span><strong>Live Sale Detected:</strong> {recent} orders in last 30 min</span></div> : null;
                    })()}
                    {platform === 'lazada' && <div className="flex items-start gap-2 px-3 py-2 rounded text-xs" style={{ backgroundColor: '#f0f1ff', border: '1px solid #c5c8ff' }}><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#0F146D' }} /><span style={{ color: '#1e2078' }}>Lazada penalty window 11:00–16:00. Ensure pending orders are RTS before cut-off.</span></div>}
                    {platform === 'manual' && stats.pending > 0 && <div className="flex items-start gap-2 px-3 py-2 rounded text-xs" style={{ backgroundColor: '#f0fff5', border: '1px solid #b3f0c9' }}><Bell className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#06C755' }} /><span style={{ color: '#065f46' }}>{stats.pending} manual order(s) awaiting payment confirmation.</span></div>}
                    <div className="text-xs px-3 py-2 rounded" style={{ backgroundColor: '#f8f9fa', color: '#6c757d' }}>ℹ️ {cfg.notes}</div>
                </div>
            )}
        </div>
    );
};

const SummaryBar = ({ salesOrders, syncStates }) => {
    const all = salesOrders || [];
    const totalLate = all.filter(o => {
        const pk = Object.keys(PLATFORMS).find(k => PLATFORMS[k].filter && o.platform?.toLowerCase().includes(PLATFORMS[k].filter.split(' ')[0].toLowerCase()));
        const cfg = pk ? PLATFORMS[pk] : null;
        return cfg?.slaHours && !['rts', 'delivered', 'shipped', 'cancelled'].includes(o.status) && ageHours(o.createdAt) > cfg.slaHours;
    }).length;
    const connected = Object.values(syncStates).filter(s => s.connected).length;
    return (
        <div className="grid grid-cols-4 gap-3 mb-4">
            {[
                { label: 'Total Orders Today', value: all.length, icon: <Package className="w-4 h-4" />, color: '#017E84', bg: '#f0fafb' },
                { label: 'Pending Shipment', value: all.filter(o => o.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: '#d97706', bg: '#fffbeb' },
                { label: 'Late / SLA Breach', value: totalLate, icon: <AlertTriangle className="w-4 h-4" />, color: totalLate > 0 ? '#dc2626' : '#16a34a', bg: totalLate > 0 ? '#fff0f0' : '#f0fff4' },
                { label: 'Platforms Connected', value: `${connected}/4`, icon: <Wifi className="w-4 h-4" />, color: connected === 4 ? '#16a34a' : '#d97706', bg: '#f0fff4' },
            ].map(k => (
                <div key={k.label} className="flex items-center gap-3 px-4 py-3 rounded" style={{ backgroundColor: k.bg, border: '1px solid #dee2e6' }}>
                    <div className="p-2 rounded" style={{ backgroundColor: k.color + '20', color: k.color }}>{k.icon}</div>
                    <div>
                        <div className="text-lg font-bold leading-none" style={{ color: k.color }}>{k.value}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#6c757d' }}>{k.label}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const EODChecklist = ({ salesOrders }) => {
    const all = salesOrders || [];
    const [checked, setChecked] = useState({});
    const toggle = k => setChecked(p => ({ ...p, [k]: !p[k] }));
    const checks = [
        { key: 'rts_done', label: 'All RTS orders scanned out to courier', auto: all.filter(o => ['rts', 'delivered'].includes(o.status)).length, total: all.length },
        { key: 'awb_printed', label: 'AWB labels printed for all shipped orders', auto: null },
        { key: 'late_cleared', label: 'No pending late shipments remaining', auto: null },
        { key: 'shopee_rts', label: 'Shopee: All orders before 17:00 cut-off are RTS', auto: null },
        { key: 'lazada_rts', label: 'Lazada: All orders before 16:00 cut-off are RTS', auto: null },
        { key: 'tiktok_rts', label: 'TikTok: All orders before 18:00 cut-off are RTS', auto: null },
        { key: 'courier_scan', label: 'Courier scan-out signature completed', auto: null },
        { key: 'inv_updated', label: 'Inventory adjusted for damaged/returned items', auto: null },
    ];
    const done = checks.filter(c => checked[c.key]).length;
    return (
        <div className="rounded" style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                <span className="font-semibold text-sm flex items-center gap-2" style={{ color: '#212529' }}><CheckCircle2 className="w-4 h-4" style={{ color: '#016b73' }} /> End-of-Day Checklist</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: done === checks.length ? '#f0fff4' : '#f8f9fa', color: done === checks.length ? '#16a34a' : '#6c757d', border: `1px solid ${done === checks.length ? '#bbf7d0' : '#dee2e6'}` }}>{done}/{checks.length} Done</span>
            </div>
            <div className="p-4 space-y-2">
                {checks.map(c => (
                    <label key={c.key} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={!!checked[c.key]} onChange={() => toggle(c.key)} className="w-4 h-4 accent-teal-600" />
                        <span className="text-sm flex-1" style={{ color: checked[c.key] ? '#6c757d' : '#212529', textDecoration: checked[c.key] ? 'line-through' : 'none' }}>{c.label}</span>
                        {c.auto !== null && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0fafb', color: '#017E84' }}>{c.auto}/{c.total}</span>}
                    </label>
                ))}
            </div>
        </div>
    );
};

const MorningBriefing = ({ salesOrders }) => {
    const all = salesOrders || [];
    const overnight = all.filter(o => ageHours(o.createdAt) < 8);
    const items = [
        { icon: '📦', label: 'Overnight new orders (last 8h)', value: overnight.length },
        { icon: '✅', label: 'Already shipped', value: all.filter(o => ['rts', 'delivered'].includes(o.status)).length },
        { icon: '⏳', label: 'Still pending', value: all.filter(o => o.status === 'pending').length },
        { icon: '🚨', label: 'Unresolved late shipments', value: all.filter(o => {
            const pk = Object.keys(PLATFORMS).find(k => PLATFORMS[k].filter && o.platform?.toLowerCase().includes(PLATFORMS[k].filter.split(' ')[0].toLowerCase()));
            const cfg = pk ? PLATFORMS[pk] : null;
            return cfg?.slaHours && !['rts', 'delivered', 'shipped', 'cancelled'].includes(o.status) && ageHours(o.createdAt) > cfg.slaHours;
        }).length },
    ];
    return (
        <div className="rounded" style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                <span className="font-semibold text-sm flex items-center gap-2" style={{ color: '#212529' }}><Activity className="w-4 h-4" style={{ color: '#016b73' }} /> Morning Briefing</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
                {items.map(it => (
                    <div key={it.label} className="flex items-center gap-3 px-3 py-2.5 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef' }}>
                        <span className="text-lg">{it.icon}</span>
                        <div>
                            <div className="text-base font-bold" style={{ color: '#212529' }}>{it.value}</div>
                            <div className="text-xs" style={{ color: '#6c757d' }}>{it.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PlatformMonitor({ salesOrders = [], addToast, syncStatus, apiConfigs }) {
    const [syncStates, setSyncStates] = useState(() => initSyncState(apiConfigs));
    const [view, setView] = useState('monitor'); // monitor | morning | eod | reports

    useEffect(() => {
        const iv = setInterval(() => {}, 60000);
        return () => clearInterval(iv);
    }, []);

    // Update lastSync from Odoo polling
    useEffect(() => {
        if (syncStatus?.lastSync) {
            setSyncStates(prev => Object.fromEntries(
                Object.entries(prev).map(([k, v]) => [k, { ...v, lastSync: syncStatus.lastSync }])
            ));
        }
    }, [syncStatus?.lastSync]);

    // Re-evaluate platform connection status when apiConfigs change (e.g., user enables platform in Settings)
    useEffect(() => {
        const isLive = apiConfigs?.odoo?.useMock === false;
        if (!isLive) return; // in mock mode keep all connected
        setSyncStates(prev => ({
            shopee: { ...prev.shopee, connected: !!(apiConfigs?.shopee?.enabled) },
            lazada: { ...prev.lazada, connected: !!(apiConfigs?.lazada?.enabled) },
            tiktok: { ...prev.tiktok, connected: !!(apiConfigs?.tiktok?.enabled) },
            manual: { ...prev.manual, connected: true },
        }));
    }, [apiConfigs?.odoo?.useMock, apiConfigs?.shopee?.enabled, apiConfigs?.lazada?.enabled, apiConfigs?.tiktok?.enabled]);

    const handleSync = useCallback(async (pk) => {
        const isLive = apiConfigs?.odoo?.useMock === false;
        setSyncStates(prev => ({ ...prev, [pk]: { ...prev[pk], syncing: true, error: null } }));
        try {
            if (isLive && pk !== 'manual') {
                // Real mode: call Odoo WMS platform sync endpoint
                await fetchPlatformOrders(apiConfigs.odoo, pk);
            } else {
                // Mock / manual: simulate delay
                await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
            }
            setSyncStates(prev => ({
                ...prev,
                [pk]: { ...prev[pk], syncing: false, connected: true, lastSync: Date.now(), error: null }
            }));
            addToast?.(`${PLATFORMS[pk].label} synced`, 'success');
        } catch (e) {
            setSyncStates(prev => ({
                ...prev,
                [pk]: { ...prev[pk], syncing: false, connected: false, error: e?.message || 'Sync failed' }
            }));
            addToast?.(`${PLATFORMS[pk].label} sync failed — ${e?.message || 'check connection'}`, 'error');
        }
    }, [addToast, apiConfigs]);

    const handleSyncAll = useCallback(() => {
        Object.keys(PLATFORMS).forEach((k, i) => setTimeout(() => handleSync(k), i * 300));
    }, [handleSync]);

    const ordersByPlatform = useMemo(() => {
        const result = {};
        for (const [k, cfg] of Object.entries(PLATFORMS)) {
            if (cfg.filter) {
                result[k] = salesOrders.filter(o => o.platform?.toLowerCase().includes(cfg.filter.split(' ')[0].toLowerCase()));
            } else {
                const known = Object.values(PLATFORMS).filter(p => p.filter).map(p => p.filter.split(' ')[0].toLowerCase());
                result[k] = salesOrders.filter(o => !o.platform || !known.some(f => o.platform.toLowerCase().includes(f)));
            }
        }
        return result;
    }, [salesOrders]);

    const isLive = apiConfigs?.odoo?.useMock === false;

    const VIEWS = [
        { k: 'monitor', l: 'Live Monitor' },
        { k: 'reports', l: '📊 Reports' },
        { k: 'morning', l: 'Morning Briefing' },
        { k: 'eod', l: 'End-of-Day' },
    ];

    return (
        <div className="flex flex-col h-full font-sans" style={{ backgroundColor: '#f8f9fa' }}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #dee2e6' }}>
                <div className="flex items-center gap-3">
                    <BarChart2 className="w-5 h-5" style={{ color: '#017E84' }} />
                    <h1 className="text-base font-semibold" style={{ color: '#212529' }}>Platform Monitor</h1>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: isLive ? '#f0fff4' : '#fff8e1', color: isLive ? '#16a34a' : '#d97706', border: `1px solid ${isLive ? '#bbf7d0' : '#fcd34d'}` }}>
                        {isLive ? '🟢 Live' : '🟡 Mock'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {VIEWS.map(v => (
                        <button key={v.k} onClick={() => setView(v.k)}
                            className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                            style={{ backgroundColor: view === v.k ? '#017E84' : '#f8f9fa', color: view === v.k ? '#ffffff' : '#495057', border: `1px solid ${view === v.k ? '#017E84' : '#dee2e6'}` }}>
                            {v.l}
                        </button>
                    ))}
                    <button onClick={handleSyncAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ml-1"
                        style={{ backgroundColor: '#714B67', color: '#ffffff' }}>
                        <RefreshCw className="w-3 h-3" /> Sync All
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: view === 'reports' ? 0 : 20 }}>
                {view !== 'reports' && <SummaryBar salesOrders={salesOrders} syncStates={syncStates} />}

                {view === 'monitor' && Object.keys(PLATFORMS).map(k => (
                    <PlatformPanel key={k} platform={k} orders={ordersByPlatform[k] || []}
                        syncState={syncStates} onSync={handleSync} />
                ))}

                {view === 'reports' && <ReportsView salesOrders={salesOrders} apiConfigs={apiConfigs} />}

                {view === 'morning' && <div className="max-w-2xl"><MorningBriefing salesOrders={salesOrders} /></div>}

                {view === 'eod' && <div className="max-w-2xl"><EODChecklist salesOrders={salesOrders} /></div>}
            </div>
        </div>
    );
}
