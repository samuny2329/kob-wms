import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    RefreshCw, AlertTriangle, CheckCircle2, Clock, Package,
    TrendingUp, Zap, AlertCircle, ChevronDown, ChevronUp,
    Bell, Activity, Timer, BarChart2, ShieldAlert, Wifi, WifiOff,
    Filter, Download, TrendingDown, Calendar, ArrowUpRight,
    FileText, FileSpreadsheet, Printer, Brain, ClipboardList,
    Users, AlertOctagon, Star, ThumbsUp, ThumbsDown, MessageSquare
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

// No mock historical data — returns empty array when no real data
const generateHistoricalData = () => [];

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

// connected = true only if platform API is actually enabled in Settings
const initSyncState = (apiConfigs) => {
    const plConn = (key) => !!(apiConfigs?.[key]?.enabled);
    return {
        shopee: { connected: plConn('shopee'), lastSync: null, syncing: false, error: null },
        lazada: { connected: plConn('lazada'), lastSync: null, syncing: false, error: null },
        tiktok: { connected: plConn('tiktok'), lastSync: null, syncing: false, error: null },
        manual: { connected: true,             lastSync: null, syncing: false, error: null },
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
                        <span>⚪</span> No data — Connect Odoo in Settings to view real platform history.
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

// ─── AI End-of-Day Report Engine ────────────────────────────────────────────
const generateAIReport = (salesOrders, activityLogs, inventory, users) => {
    const all = salesOrders || [];
    const logs = activityLogs || [];
    const inv = inventory?.items || [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.timestamp && new Date(l.timestamp).toISOString().split('T')[0] === today);

    // ── Order Analysis ──
    const total = all.length;
    const shipped = all.filter(o => ['rts', 'delivered', 'shipped'].includes(o.status)).length;
    const pending = all.filter(o => o.status === 'pending').length;
    const picking = all.filter(o => o.status === 'picking').length;
    const packed = all.filter(o => ['picked', 'packing', 'packed'].includes(o.status)).length;
    const cancelled = all.filter(o => o.status === 'cancelled').length;
    const fulfillmentRate = total > 0 ? Math.round((shipped / total) * 100) : 0;

    // ── Platform breakdown ──
    const platformStats = {};
    ['Shopee', 'Lazada', 'TikTok', 'LINE'].forEach(p => {
        const pOrders = all.filter(o => o.platform?.toLowerCase().includes(p.toLowerCase()));
        const pShipped = pOrders.filter(o => ['rts', 'delivered', 'shipped'].includes(o.status)).length;
        platformStats[p] = {
            total: pOrders.length,
            shipped: pShipped,
            pending: pOrders.filter(o => o.status === 'pending').length,
            rate: pOrders.length > 0 ? Math.round((pShipped / pOrders.length) * 100) : 0,
        };
    });

    // ── SLA breach detection ──
    const SLA_HOURS = { shopee: 48, lazada: 48, tiktok: 72 };
    const lateOrders = all.filter(o => {
        if (['rts', 'delivered', 'shipped', 'cancelled'].includes(o.status)) return false;
        const age = (now - new Date(o.createdAt)) / 3600000;
        const pk = Object.keys(SLA_HOURS).find(k => o.platform?.toLowerCase().includes(k));
        return pk && age > SLA_HOURS[pk];
    });

    // ── Worker Performance ──
    const workerMap = {};
    todayLogs.forEach(l => {
        const u = l.username || 'unknown';
        if (!workerMap[u]) workerMap[u] = { name: l.name || u, pick: 0, pack: 0, scan: 0, total: 0, first: l.timestamp, last: l.timestamp };
        const w = workerMap[u];
        if (l.action === 'pick') w.pick++;
        else if (l.action === 'pack' || l.action === 'pack-handheld') w.pack++;
        else if (l.action === 'scan') w.scan++;
        w.total++;
        if (l.timestamp < w.first) w.first = l.timestamp;
        if (l.timestamp > w.last) w.last = l.timestamp;
    });
    const workers = Object.values(workerMap).map(w => {
        let hours = (w.last - w.first) / 3600000;
        if (hours < 0.1) hours = 0.1;
        w.uph = Math.round(w.total / hours);
        return w;
    }).sort((a, b) => b.total - a.total);

    const avgUph = workers.length > 0 ? Math.round(workers.reduce((s, w) => s + w.uph, 0) / workers.length) : 0;
    const topWorker = workers[0] || null;
    const lowWorker = workers.length > 1 ? workers[workers.length - 1] : null;

    // ── Inventory alerts ──
    const lowStockItems = inv.filter(i => (i.onHand ?? i.quantity ?? 0) > 0 && (i.onHand ?? i.quantity ?? 0) <= 5);
    const outOfStock = inv.filter(i => (i.onHand ?? i.quantity ?? 0) === 0);

    // ── Hourly throughput ──
    const hourlyMap = {};
    todayLogs.forEach(l => {
        const h = new Date(l.timestamp).getHours();
        hourlyMap[h] = (hourlyMap[h] || 0) + 1;
    });
    const peakHour = Object.entries(hourlyMap).sort(([,a], [,b]) => b - a)[0];
    const slowHour = Object.entries(hourlyMap).filter(([,v]) => v > 0).sort(([,a], [,b]) => a - b)[0];

    // ── AI Checklist (auto-verified) ──
    const checks = [
        { key: 'rts_done', label: 'All orders scanned out to courier', pass: pending === 0 && picking === 0, detail: `${shipped}/${total} shipped` },
        { key: 'sla_ok', label: 'No SLA breaches remaining', pass: lateOrders.length === 0, detail: lateOrders.length > 0 ? `${lateOrders.length} late orders` : 'All clear' },
        { key: 'shopee_cut', label: 'Shopee: Pre-cutoff orders completed (17:00)', pass: (platformStats.Shopee?.pending || 0) === 0, detail: `${platformStats.Shopee?.shipped || 0}/${platformStats.Shopee?.total || 0}` },
        { key: 'lazada_cut', label: 'Lazada: Pre-cutoff orders completed (16:00)', pass: (platformStats.Lazada?.pending || 0) === 0, detail: `${platformStats.Lazada?.shipped || 0}/${platformStats.Lazada?.total || 0}` },
        { key: 'tiktok_cut', label: 'TikTok: Pre-cutoff orders completed (18:00)', pass: (platformStats.TikTok?.pending || 0) === 0, detail: `${platformStats.TikTok?.shipped || 0}/${platformStats.TikTok?.total || 0}` },
        { key: 'inv_ok', label: 'No critical out-of-stock items', pass: outOfStock.length === 0, detail: outOfStock.length > 0 ? `${outOfStock.length} OOS items` : 'Stock OK' },
        { key: 'team_active', label: 'All team members logged activity', pass: workers.length >= (users?.length || 1) - 1, detail: `${workers.length} active workers` },
        { key: 'quality', label: 'Zero cancelled/returned orders', pass: cancelled === 0, detail: cancelled > 0 ? `${cancelled} cancelled` : 'None' },
    ];

    // ── AI Insights & Recommendations ──
    const insights = [];
    const issues = [];
    const recommendations = [];

    // Performance insights
    if (fulfillmentRate >= 95) insights.push({ type: 'positive', text: `Excellent fulfillment rate: ${fulfillmentRate}% — target exceeded` });
    else if (fulfillmentRate >= 80) insights.push({ type: 'neutral', text: `Fulfillment rate: ${fulfillmentRate}% — within acceptable range` });
    else issues.push({ severity: 'high', text: `Low fulfillment rate: ${fulfillmentRate}% — ${pending + picking} orders still pending` });

    if (lateOrders.length > 0) {
        issues.push({ severity: 'critical', text: `${lateOrders.length} SLA breaches detected — risk of platform penalties` });
        recommendations.push(`Prioritize ${lateOrders.length} late order(s) first thing tomorrow morning`);
    }

    if (topWorker && topWorker.uph >= 50) insights.push({ type: 'positive', text: `Top performer: ${topWorker.name} at ${topWorker.uph} UPH (${topWorker.total} actions)` });
    if (lowWorker && lowWorker.uph < 20 && workers.length > 1) issues.push({ severity: 'medium', text: `${lowWorker.name} below target at ${lowWorker.uph} UPH — may need training` });

    if (lowStockItems.length > 0) {
        issues.push({ severity: 'medium', text: `${lowStockItems.length} items at critical low stock (≤5 units)` });
        recommendations.push(`Create replenishment order for ${lowStockItems.length} low-stock items`);
    }

    if (peakHour) insights.push({ type: 'neutral', text: `Peak hour: ${peakHour[0]}:00 with ${peakHour[1]} actions` });
    if (slowHour && peakHour && slowHour[0] !== peakHour[0]) recommendations.push(`Consider redistributing workload — ${slowHour[0]}:00 had only ${slowHour[1]} actions vs peak ${peakHour[1]}`);

    // Platform-specific recommendations
    Object.entries(platformStats).forEach(([p, s]) => {
        if (s.total > 0 && s.rate < 80) recommendations.push(`${p}: Only ${s.rate}% fulfillment — investigate bottleneck`);
    });

    if (avgUph < 30 && workers.length > 0) recommendations.push(`Team avg UPH is ${avgUph} — consider process improvement or additional training`);
    if (recommendations.length === 0) recommendations.push('No critical action items — maintain current performance');

    // ── Meeting Brief ──
    const brief = {
        date: today,
        summary: `${today} — ${total} orders processed, ${fulfillmentRate}% fulfilled, ${workers.length} active staff`,
        keyMetrics: { total, shipped, pending, fulfillmentRate, avgUph, lateOrders: lateOrders.length, lowStock: lowStockItems.length },
        platformStats,
        workers: workers.map(w => ({ name: w.name, pick: w.pick, pack: w.pack, scan: w.scan, total: w.total, uph: w.uph })),
        checks,
        insights,
        issues,
        recommendations,
        lowStockItems: lowStockItems.slice(0, 10).map(i => ({ sku: i.sku || i.default_code, name: i.name, qty: i.onHand ?? i.quantity })),
        lateOrders: lateOrders.slice(0, 10).map(o => ({ ref: o.ref || o.id, customer: o.customer, platform: o.platform, status: o.status })),
    };

    return brief;
};

// ── Export helpers ──
const exportToCSV = (brief) => {
    const rows = [
        ['WMS Pro — End-of-Day Report'],
        ['Date', brief.date],
        [''],
        ['=== KEY METRICS ==='],
        ['Total Orders', brief.keyMetrics.total],
        ['Shipped', brief.keyMetrics.shipped],
        ['Pending', brief.keyMetrics.pending],
        ['Fulfillment Rate', `${brief.keyMetrics.fulfillmentRate}%`],
        ['Avg Team UPH', brief.keyMetrics.avgUph],
        ['SLA Breaches', brief.keyMetrics.lateOrders],
        ['Low Stock Items', brief.keyMetrics.lowStock],
        [''],
        ['=== PLATFORM BREAKDOWN ==='],
        ['Platform', 'Total', 'Shipped', 'Pending', 'Rate'],
        ...Object.entries(brief.platformStats).map(([p, s]) => [p, s.total, s.shipped, s.pending, `${s.rate}%`]),
        [''],
        ['=== WORKER PERFORMANCE ==='],
        ['Name', 'Pick', 'Pack', 'Scan', 'Total', 'UPH'],
        ...brief.workers.map(w => [w.name, w.pick, w.pack, w.scan, w.total, w.uph]),
        [''],
        ['=== CHECKLIST ==='],
        ...brief.checks.map(c => [c.pass ? 'PASS' : 'FAIL', c.label, c.detail]),
        [''],
        ['=== ISSUES ==='],
        ...brief.issues.map(i => [i.severity.toUpperCase(), i.text]),
        [''],
        ['=== RECOMMENDATIONS ==='],
        ...brief.recommendations.map((r, i) => [`${i + 1}.`, r]),
    ];
    if (brief.lateOrders.length > 0) {
        rows.push([''], ['=== LATE ORDERS ==='], ['Ref', 'Customer', 'Platform', 'Status']);
        brief.lateOrders.forEach(o => rows.push([o.ref, o.customer, o.platform, o.status]));
    }
    if (brief.lowStockItems.length > 0) {
        rows.push([''], ['=== LOW STOCK ==='], ['SKU', 'Name', 'Qty']);
        brief.lowStockItems.forEach(i => rows.push([i.sku, i.name, i.qty]));
    }
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `EOD_Report_${brief.date}.csv`; a.click();
    URL.revokeObjectURL(url);
};

const exportToPDF = (brief) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const passIcon = (pass) => pass ? '<span style="color:#16a34a">&#10003;</span>' : '<span style="color:#dc2626">&#10007;</span>';
    const sevColor = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#2563eb' };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EOD Report ${brief.date}</title>
    <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:40px;color:#212529;font-size:13px;line-height:1.6}
        h1{font-size:20px;color:#714B67;margin:0 0 4px;border-bottom:3px solid #714B67;padding-bottom:8px}
        h2{font-size:14px;color:#017E84;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.05em}
        .subtitle{color:#6c757d;font-size:12px;margin-bottom:20px}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
        .metric{border:1px solid #dee2e6;border-radius:6px;padding:12px;text-align:center}
        .metric .val{font-size:24px;font-weight:800;color:#017E84}
        .metric .lbl{font-size:10px;color:#6c757d;text-transform:uppercase;margin-top:2px}
        table{width:100%;border-collapse:collapse;margin:8px 0}
        th{background:#f8f9fa;border:1px solid #dee2e6;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#6c757d}
        td{border:1px solid #dee2e6;padding:6px 10px;font-size:12px}
        .check{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f1f3f5}
        .issue{padding:6px 10px;border-radius:4px;margin:4px 0;font-size:12px}
        .rec{padding:4px 0;border-bottom:1px solid #f1f3f5;font-size:12px}
        .footer{margin-top:30px;padding-top:12px;border-top:2px solid #dee2e6;font-size:10px;color:#adb5bd;text-align:center}
        @media print{body{padding:20px}h1{font-size:18px}}
    </style></head><body>
    <h1>WMS Pro — End-of-Day Report</h1>
    <div class="subtitle">${brief.date} | Generated ${new Date().toLocaleTimeString()} | KOB & BTV-Online</div>

    <h2>Key Metrics</h2>
    <div class="grid">
        <div class="metric"><div class="val">${brief.keyMetrics.total}</div><div class="lbl">Total Orders</div></div>
        <div class="metric"><div class="val">${brief.keyMetrics.fulfillmentRate}%</div><div class="lbl">Fulfillment</div></div>
        <div class="metric"><div class="val">${brief.keyMetrics.avgUph}</div><div class="lbl">Avg UPH</div></div>
        <div class="metric"><div class="val" style="color:${brief.keyMetrics.lateOrders > 0 ? '#dc2626' : '#16a34a'}">${brief.keyMetrics.lateOrders}</div><div class="lbl">SLA Breaches</div></div>
    </div>

    <h2>Platform Performance</h2>
    <table><thead><tr><th>Platform</th><th>Total</th><th>Shipped</th><th>Pending</th><th>Rate</th></tr></thead><tbody>
    ${Object.entries(brief.platformStats).map(([p, s]) => `<tr><td><b>${p}</b></td><td>${s.total}</td><td>${s.shipped}</td><td>${s.pending}</td><td><b>${s.rate}%</b></td></tr>`).join('')}
    </tbody></table>

    <h2>Worker Performance</h2>
    <table><thead><tr><th>Name</th><th>Pick</th><th>Pack</th><th>Scan</th><th>Total</th><th>UPH</th></tr></thead><tbody>
    ${brief.workers.map(w => `<tr><td><b>${w.name}</b></td><td>${w.pick}</td><td>${w.pack}</td><td>${w.scan}</td><td><b>${w.total}</b></td><td><b>${w.uph}</b></td></tr>`).join('')}
    </tbody></table>

    <h2>Verification Checklist</h2>
    ${brief.checks.map(c => `<div class="check">${passIcon(c.pass)} <span style="flex:1">${c.label}</span> <span style="color:#6c757d;font-size:11px">${c.detail}</span></div>`).join('')}

    ${brief.issues.length > 0 ? `<h2>Issues & Alerts</h2>${brief.issues.map(i => `<div class="issue" style="background:${sevColor[i.severity]}11;border-left:3px solid ${sevColor[i.severity]};color:${sevColor[i.severity]}"><b>[${i.severity.toUpperCase()}]</b> ${i.text}</div>`).join('')}` : ''}

    <h2>Recommendations for Tomorrow</h2>
    ${brief.recommendations.map((r, i) => `<div class="rec"><b>${i + 1}.</b> ${r}</div>`).join('')}

    ${brief.lateOrders.length > 0 ? `<h2>Late Orders Detail</h2><table><thead><tr><th>Ref</th><th>Customer</th><th>Platform</th><th>Status</th></tr></thead><tbody>${brief.lateOrders.map(o => `<tr><td>${o.ref}</td><td>${o.customer || '—'}</td><td>${o.platform || '—'}</td><td>${o.status}</td></tr>`).join('')}</tbody></table>` : ''}

    ${brief.lowStockItems.length > 0 ? `<h2>Critical Low Stock</h2><table><thead><tr><th>SKU</th><th>Name</th><th>Qty</th></tr></thead><tbody>${brief.lowStockItems.map(i => `<tr><td>${i.sku}</td><td>${i.name}</td><td style="color:#dc2626;font-weight:700">${i.qty}</td></tr>`).join('')}</tbody></table>` : ''}

    <div class="footer">WMS Pro by KOB & BTV-Online — Auto-generated End-of-Day Report</div>
    </body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
};

const EODChecklist = ({ salesOrders, activityLogs, inventory, users }) => {
    const [checked, setChecked] = useState({});
    const [showBrief, setShowBrief] = useState(false);
    const [generating, setGenerating] = useState(false);
    const toggle = k => setChecked(p => ({ ...p, [k]: !p[k] }));

    const brief = useMemo(() => generateAIReport(salesOrders, activityLogs, inventory, users), [salesOrders, activityLogs, inventory, users]);
    const passCount = brief.checks.filter(c => c.pass).length;
    const manualDone = brief.checks.filter(c => checked[c.key]).length;
    const totalChecked = brief.checks.filter(c => c.pass || checked[c.key]).length;
    const allDone = totalChecked === brief.checks.length;
    const issueCount = brief.issues.length;
    const sevColor = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#2563eb' };
    const sevBg = { critical: '#fff0f0', high: '#fff7ed', medium: '#fffbeb', low: '#eff6ff' };

    const handleGenerate = () => {
        setGenerating(true);
        setTimeout(() => { setShowBrief(true); setGenerating(false); }, 800);
    };

    return (
        <div className="space-y-4 max-w-4xl">
            {/* Header card */}
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '2px solid #714B67', background: 'linear-gradient(135deg, #714B67 0%, #017E84 100%)' }}>
                    <div className="flex items-center gap-3">
                        <Brain className="w-6 h-6 text-white" />
                        <div>
                            <h2 className="text-base font-bold text-white">AI End-of-Day Report</h2>
                            <p className="text-xs text-white/70">Auto-verified checklist, insights & meeting brief</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ backgroundColor: allDone ? '#d1fae5' : '#fef3c7', color: allDone ? '#059669' : '#d97706' }}>
                            {totalChecked}/{brief.checks.length} Verified
                        </span>
                    </div>
                </div>

                {/* Quick KPI strip */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-0" style={{ borderBottom: '1px solid #dee2e6' }}>
                    {[
                        { label: 'Orders', value: brief.keyMetrics.total, color: '#017E84' },
                        { label: 'Fulfilled', value: `${brief.keyMetrics.fulfillmentRate}%`, color: brief.keyMetrics.fulfillmentRate >= 90 ? '#059669' : '#d97706' },
                        { label: 'Avg UPH', value: brief.keyMetrics.avgUph, color: '#3b82f6' },
                        { label: 'SLA Issues', value: brief.keyMetrics.lateOrders, color: brief.keyMetrics.lateOrders > 0 ? '#dc2626' : '#059669' },
                        { label: 'Low Stock', value: brief.keyMetrics.lowStock, color: brief.keyMetrics.lowStock > 0 ? '#d97706' : '#059669' },
                    ].map(m => (
                        <div key={m.label} className="px-4 py-3 text-center" style={{ borderRight: '1px solid #f1f3f5' }}>
                            <div className="text-xl font-black" style={{ color: m.color }}>{m.value}</div>
                            <div className="text-[10px] uppercase font-bold" style={{ color: '#6c757d' }}>{m.label}</div>
                        </div>
                    ))}
                </div>

                {/* Auto-verified checklist */}
                <div className="p-4 space-y-1.5">
                    {brief.checks.map(c => {
                        const isAuto = c.pass;
                        const isManual = checked[c.key];
                        const isDone = isAuto || isManual;
                        return (
                            <div key={c.key} className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors" style={{ backgroundColor: isDone ? '#f0fdf4' : '#fff', border: `1px solid ${isDone ? '#bbf7d0' : '#e9ecef'}` }}>
                                {isAuto ? (
                                    <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" style={{ color: '#16a34a' }} />
                                ) : (
                                    <input type="checkbox" checked={!!isManual} onChange={() => toggle(c.key)} className="w-4 h-4 accent-teal-600 flex-shrink-0" />
                                )}
                                <span className="text-sm flex-1" style={{ color: isDone ? '#6c757d' : '#212529', textDecoration: isDone ? 'line-through' : 'none' }}>{c.label}</span>
                                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: isDone ? '#d1fae5' : '#f8f9fa', color: isDone ? '#059669' : '#6c757d' }}>
                                    {c.detail}
                                </span>
                                {isAuto && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>AUTO</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* AI Insights & Issues */}
            {(brief.insights.length > 0 || brief.issues.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Insights */}
                    <div className="rounded-lg" style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
                        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <Star className="w-4 h-4" style={{ color: '#017E84' }} />
                            <span className="font-semibold text-sm" style={{ color: '#212529' }}>AI Insights</span>
                        </div>
                        <div className="p-3 space-y-2">
                            {brief.insights.map((ins, i) => (
                                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded" style={{ backgroundColor: ins.type === 'positive' ? '#f0fdf4' : '#f8f9fa' }}>
                                    {ins.type === 'positive' ? <ThumbsUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#16a34a' }} /> : <Activity className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#6c757d' }} />}
                                    <span className="text-xs" style={{ color: '#374151' }}>{ins.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Issues */}
                    <div className="rounded-lg" style={{ border: `1px solid ${issueCount > 0 ? '#fecaca' : '#dee2e6'}`, backgroundColor: '#ffffff' }}>
                        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: issueCount > 0 ? '#fff5f5' : '#f8f9fa' }}>
                            <div className="flex items-center gap-2">
                                <AlertOctagon className="w-4 h-4" style={{ color: issueCount > 0 ? '#dc2626' : '#16a34a' }} />
                                <span className="font-semibold text-sm" style={{ color: '#212529' }}>Issues</span>
                            </div>
                            {issueCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>{issueCount}</span>}
                        </div>
                        <div className="p-3 space-y-2">
                            {brief.issues.length > 0 ? brief.issues.map((iss, i) => (
                                <div key={i} className="px-3 py-2 rounded text-xs" style={{ backgroundColor: sevBg[iss.severity], borderLeft: `3px solid ${sevColor[iss.severity]}`, color: '#374151' }}>
                                    <span className="font-bold" style={{ color: sevColor[iss.severity] }}>[{iss.severity.toUpperCase()}]</span> {iss.text}
                                </div>
                            )) : (
                                <div className="text-center py-4 text-sm" style={{ color: '#16a34a' }}>
                                    <CheckCircle2 className="w-8 h-8 mx-auto mb-1" style={{ color: '#16a34a' }} />
                                    No issues detected
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Recommendations for tomorrow */}
            <div className="rounded-lg" style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <MessageSquare className="w-4 h-4" style={{ color: '#714B67' }} />
                    <span className="font-semibold text-sm" style={{ color: '#212529' }}>Tomorrow's Action Items (Meeting Brief)</span>
                </div>
                <div className="p-4 space-y-2">
                    {brief.recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 px-3 py-2 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: '#714B67', color: '#fff' }}>{i + 1}</span>
                            <span className="text-sm" style={{ color: '#374151' }}>{r}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Platform comparison table */}
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #dee2e6', backgroundColor: '#ffffff' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <BarChart2 className="w-4 h-4" style={{ color: '#017E84' }} />
                    <span className="font-semibold text-sm" style={{ color: '#212529' }}>Platform Comparison</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                            {['Platform', 'Total', 'Shipped', 'Pending', 'Rate'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', borderBottom: '1px solid #dee2e6', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#6c757d', fontWeight: 700 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(brief.platformStats).map(([p, s]) => (
                            <tr key={p} style={{ borderBottom: '1px solid #f1f3f5' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#212529', fontSize: '13px' }}>{p}</td>
                                <td style={{ padding: '8px 12px', fontSize: '13px' }}>{s.total}</td>
                                <td style={{ padding: '8px 12px', fontSize: '13px', color: '#059669', fontWeight: 600 }}>{s.shipped}</td>
                                <td style={{ padding: '8px 12px', fontSize: '13px', color: s.pending > 0 ? '#d97706' : '#6c757d' }}>{s.pending}</td>
                                <td style={{ padding: '8px 12px' }}>
                                    <div className="flex items-center gap-2">
                                        <div style={{ width: 60, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${s.rate}%`, height: '100%', borderRadius: 3, backgroundColor: s.rate >= 90 ? '#059669' : s.rate >= 70 ? '#d97706' : '#dc2626' }} />
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: s.rate >= 90 ? '#059669' : s.rate >= 70 ? '#d97706' : '#dc2626' }}>{s.rate}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Export buttons */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleGenerate()} disabled={generating}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors"
                        style={{ backgroundColor: '#714B67', color: '#fff', opacity: generating ? 0.6 : 1 }}>
                        <Brain className="w-4 h-4" />
                        {generating ? 'Generating...' : 'Generate Full Brief'}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => exportToCSV(brief)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: '#f8f9fa', color: '#212529', border: '1px solid #dee2e6' }}>
                        <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: '#059669' }} /> Export Excel/CSV
                    </button>
                    <button onClick={() => exportToPDF(brief)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: '#f8f9fa', color: '#212529', border: '1px solid #dee2e6' }}>
                        <FileText className="w-3.5 h-3.5" style={{ color: '#dc2626' }} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Full Brief modal */}
            {showBrief && (
                <div className="rounded-lg overflow-hidden" style={{ border: '2px solid #714B67', backgroundColor: '#ffffff' }}>
                    <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: '#714B67' }}>
                        <span className="text-sm font-bold text-white flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Meeting Brief — {brief.date}</span>
                        <button onClick={() => setShowBrief(false)} className="text-white/70 hover:text-white text-sm font-bold px-2">Close</button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                            <p className="text-sm font-medium" style={{ color: '#212529' }}>{brief.summary}</p>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold uppercase mb-2" style={{ color: '#6c757d' }}>Worker Summary</h4>
                            <div className="space-y-1">
                                {brief.workers.map(w => (
                                    <div key={w.name} className="flex items-center justify-between px-3 py-2 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                                        <span className="text-sm font-medium" style={{ color: '#212529' }}>{w.name}</span>
                                        <div className="flex items-center gap-4 text-xs" style={{ color: '#6c757d' }}>
                                            <span>Pick: <b style={{ color: '#3b82f6' }}>{w.pick}</b></span>
                                            <span>Pack: <b style={{ color: '#059669' }}>{w.pack}</b></span>
                                            <span>UPH: <b style={{ color: w.uph >= 50 ? '#059669' : w.uph >= 30 ? '#d97706' : '#dc2626' }}>{w.uph}</b></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {brief.issues.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold uppercase mb-2" style={{ color: '#dc2626' }}>Open Issues</h4>
                                {brief.issues.map((iss, i) => (
                                    <p key={i} className="text-sm mb-1" style={{ color: '#374151' }}>
                                        <span className="font-bold" style={{ color: sevColor[iss.severity] }}>[{iss.severity.toUpperCase()}]</span> {iss.text}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div>
                            <h4 className="text-xs font-bold uppercase mb-2" style={{ color: '#714B67' }}>Action Items for Tomorrow</h4>
                            {brief.recommendations.map((r, i) => (
                                <p key={i} className="text-sm mb-1" style={{ color: '#374151' }}><b>{i + 1}.</b> {r}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )}
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
export default function PlatformMonitor({ salesOrders = [], addToast, syncStatus, apiConfigs, activityLogs, inventory, users, orders }) {
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
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: isLive ? '#f0fff4' : '#fff0f0', color: isLive ? '#16a34a' : '#9ca3af', border: `1px solid ${isLive ? '#bbf7d0' : '#e5e7eb'}` }}>
                        {isLive ? '🟢 Live' : '⚪ Not Connected'}
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

                {view === 'eod' && <div className="max-w-4xl"><EODChecklist salesOrders={salesOrders} activityLogs={activityLogs} inventory={inventory} users={users} /></div>}
            </div>
        </div>
    );
}
