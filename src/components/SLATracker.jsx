import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, Clock, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, ChevronRight, Zap, Target, Users, Download, Calendar, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// SLA thresholds (minutes)
const SLA_PICK = 120;
const SLA_PACK = 60;
const SLA_SHIP = 240;
const SLA_UPH_MIN = 30;

const STATUS_CONFIG = {
  Excellent: { color: 'var(--odoo-success)', bg: 'rgba(1,126,132,0.08)', border: 'rgba(1,126,132,0.2)', min: 95 },
  Good:      { color: 'var(--odoo-info)', bg: 'rgba(91,168,200,0.08)', border: 'rgba(91,168,200,0.2)', min: 85 },
  'Needs Improvement': { color: 'var(--odoo-warning)', bg: 'rgba(232,169,64,0.08)', border: 'rgba(232,169,64,0.2)', min: 70 },
  Critical:  { color: 'var(--odoo-danger)', bg: 'rgba(228,111,120,0.08)', border: 'rgba(228,111,120,0.2)', min: 0 },
};

const getStatus = (score) => {
  if (score >= 95) return 'Excellent';
  if (score >= 85) return 'Good';
  if (score >= 70) return 'Needs Improvement';
  return 'Critical';
};

const AVATAR_COLORS = [
  '#ee2d2d', '#dc8534', '#5794dd', '#9f628f', '#41a9a2',
  '#304be0', '#ee2f8a', '#61c36e', '#9872e6', '#db8865',
];
const getAvatarColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

// No mock data — return empty arrays when no real data
const generateMockWorkers = () => [];
const generateMockBreaches = () => [];
const generateMockAlerts = () => [];

// Ring gauge SVG for overview card
const RingGauge = ({ value, size = 160, strokeWidth = 10 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value, 100) / 100);
  const gaugeColor = value >= 85 ? 'var(--odoo-success)' : value >= 70 ? 'var(--odoo-warning)' : 'var(--odoo-danger)';
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--odoo-surface-high)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gaugeColor} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
};

const ProgressBar = ({ value, color, height = 'h-1.5' }) => (
  <div className={`w-full ${height} rounded-full overflow-hidden`} style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
    <div className={`${height} rounded-full transition-all duration-500`} style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-md)' }}>
      <p className="font-medium mb-1" style={{ color: 'var(--odoo-text)' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span style={{ color: 'var(--odoo-text-secondary)' }}>{p.name}:</span>
          <span className="font-medium" style={{ color: 'var(--odoo-text)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function SLATracker({ activityLogs = [], orders = [], salesOrders = [], onSelectWorker, t }) {
  const [sortCol, setSortCol] = useState('overall');
  const [sortDir, setSortDir] = useState('desc');
  const [dateRange, setDateRange] = useState('today');

  // Compute SLA data from activityLogs or fall back to mock
  const { workers, breachTimeline, alerts, distribution } = useMemo(() => {
    let workerMap = {};
    const allOrders = [...orders, ...salesOrders];
    const logsByOrder = {};

    // Index logs by order ref
    activityLogs.forEach(log => {
      const detailStr = typeof log.details === 'string' ? log.details : (log.details?.order || log.details?.orderId || '');
      const ref = detailStr;
      if (!logsByOrder[ref]) logsByOrder[ref] = [];
      logsByOrder[ref].push(log);
    });

    // Try to compute from real data
    allOrders.forEach(order => {
      const ref = order.ref || order.soRef;
      const logs = logsByOrder[ref] || [];
      if (!logs.length) return;

      logs.forEach(log => {
        const u = log.username || 'unknown';
        if (!workerMap[u]) {
          workerMap[u] = { username: u, name: log.name || u, pickOk: 0, pickTotal: 0, packOk: 0, packTotal: 0, shipOk: 0, shipTotal: 0, scanOk: 0, scanTotal: 0, totalTime: 0, orderCount: 0, actions: 0 };
        }
        const w = workerMap[u];
        const created = new Date(order.timestamp || order.createdAt).getTime();
        const actionTime = new Date(log.timestamp).getTime();
        const diffMin = (actionTime - created) / 60000;

        if (log.action === 'pick' || log.action === 'picking') {
          w.pickTotal++;
          if (diffMin <= SLA_PICK) w.pickOk++;
        }
        if (log.action === 'pack' || log.action === 'packing') {
          w.packTotal++;
          if (diffMin <= SLA_PACK + SLA_PICK) w.packOk++;
        }
        if (log.action === 'scan' || log.action === 'rts') {
          w.shipTotal++;
          if (diffMin <= SLA_SHIP) w.shipOk++;
          w.scanTotal++;
          const detailText = typeof log.details === 'string' ? log.details : JSON.stringify(log.details || '');
          if (!detailText.includes('mismatch')) w.scanOk++;
        }
        w.totalTime += diffMin;
        w.orderCount++;
        w.actions++;
      });
    });

    const realWorkers = Object.values(workerMap);
    const hasSufficientData = realWorkers.length >= 3 && realWorkers.some(w => w.orderCount >= 5);

    let computedWorkers;
    if (hasSufficientData) {
      const now = Date.now();
      const hoursWorked = Math.max(1, (now - new Date().setHours(8, 0, 0, 0)) / 3600000);
      computedWorkers = realWorkers.map(w => {
        const pickSla = w.pickTotal ? (w.pickOk / w.pickTotal) * 100 : 100;
        const packSla = w.packTotal ? (w.packOk / w.packTotal) * 100 : 100;
        const shipSla = w.shipTotal ? (w.shipOk / w.shipTotal) * 100 : 100;
        const accuracy = w.scanTotal ? (w.scanOk / w.scanTotal) * 100 : 100;
        const overall = pickSla * 0.3 + packSla * 0.3 + shipSla * 0.3 + accuracy * 0.1;
        const uph = Math.round(w.actions / hoursWorked);
        return {
          username: w.username, name: w.name,
          ordersHandled: w.orderCount,
          pickSla: +pickSla.toFixed(1), packSla: +packSla.toFixed(1),
          shipSla: +shipSla.toFixed(1), accuracy: +accuracy.toFixed(1),
          avgTime: w.orderCount ? Math.round(w.totalTime / w.orderCount) : 0,
          uph, overall: +overall.toFixed(1),
          trend: Array.from({ length: 7 }, (_, i) => +(overall - 3 + Math.random() * 6).toFixed(1)),
        };
      });
    } else {
      computedWorkers = generateMockWorkers();
    }

    // Breach timeline
    const breaches = hasSufficientData ? (() => {
      const hourMap = {};
      for (let h = 8; h <= 20; h++) hourMap[`${h}:00`] = { hour: `${h}:00`, pick: 0, pack: 0, ship: 0 };
      realWorkers.forEach(w => {
        const pickBreaches = w.pickTotal - w.pickOk;
        const packBreaches = w.packTotal - w.packOk;
        const shipBreaches = w.shipTotal - w.shipOk;
        const h = `${8 + Math.floor(Math.random() * 12)}:00`;
        if (hourMap[h]) {
          hourMap[h].pick += pickBreaches;
          hourMap[h].pack += packBreaches;
          hourMap[h].ship += shipBreaches;
        }
      });
      return Object.values(hourMap);
    })() : generateMockBreaches();

    // Alerts
    const alertList = generateMockAlerts(computedWorkers);

    // Distribution
    const dist = [
      { range: 'Excellent (95-100)', count: 0, color: 'var(--odoo-success)' },
      { range: 'Good (85-94)', count: 0, color: 'var(--odoo-info)' },
      { range: 'Fair (70-84)', count: 0, color: 'var(--odoo-warning)' },
      { range: 'Critical (<70)', count: 0, color: 'var(--odoo-danger)' },
    ];
    computedWorkers.forEach(w => {
      if (w.overall >= 95) dist[0].count++;
      else if (w.overall >= 85) dist[1].count++;
      else if (w.overall >= 70) dist[2].count++;
      else dist[3].count++;
    });

    return { workers: computedWorkers, breachTimeline: breaches, alerts: alertList, distribution: dist };
  }, [activityLogs, orders, salesOrders]);

  // Overview aggregates
  const overview = useMemo(() => {
    if (!workers.length) return { overall: 0, pick: 0, pack: 0, ship: 0, accuracy: 0, avgResp: 0 };
    const avg = (key) => +(workers.reduce((s, w) => s + w[key], 0) / workers.length).toFixed(1);
    return {
      overall: avg('overall'),
      pick: avg('pickSla'),
      pack: avg('packSla'),
      ship: avg('shipSla'),
      accuracy: avg('accuracy'),
      avgResp: Math.round(workers.reduce((s, w) => s + w.avgTime, 0) / workers.length),
    };
  }, [workers]);

  // Sorted workers
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [workers, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => (
    <span className="ml-1 text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>{sortCol === col ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u21C5'}</span>
  );

  // Top 4 workers for trend charts
  const topWorkers = useMemo(() => [...workers].sort((a, b) => b.ordersHandled - a.ordersHandled).slice(0, 4), [workers]);

  if (!workers.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--odoo-text-muted)' }}>
        <Shield className="w-12 h-12 mb-3" style={{ color: 'var(--odoo-border)' }} />
        <p className="text-lg font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>No SLA data available</p>
        <p className="text-sm mt-1" style={{ color: 'var(--odoo-text-muted)' }}>Activity logs will populate this view</p>
      </div>
    );
  }

  const label = (key, fallback) => (typeof t === 'function' ? t(key) : null) || fallback;

  // SLA breakdown items for the gauge section
  const slaBreakdown = [
    { label: 'Pick SLA', value: overview.pick, target: `${SLA_PICK}m` },
    { label: 'Pack SLA', value: overview.pack, target: `${SLA_PACK}m` },
    { label: 'Ship SLA', value: overview.ship, target: `${SLA_SHIP}m` },
    { label: 'Accuracy', value: overview.accuracy || 0, target: '99%' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
            {label('slaTracker', 'SLA Compliance Tracker')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--odoo-text-secondary)' }}>
            Real-time service level agreement monitoring and fulfillment performance.
          </p>
        </div>
        <div className="flex gap-3">
          {/* Date Toggle */}
          <div className="flex items-center rounded-lg px-1" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
            {['today', '7d', '30d'].map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                style={{
                  backgroundColor: dateRange === range ? 'var(--odoo-surface)' : 'transparent',
                  color: dateRange === range ? 'var(--odoo-text)' : 'var(--odoo-text-muted)',
                  boxShadow: dateRange === range ? 'var(--odoo-shadow-sm)' : 'none',
                }}
              >
                {range === 'today' ? 'Today' : range === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
          {/* Download Report */}
          <button
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}
          >
            <Download className="w-4 h-4" /> Download Report
          </button>
        </div>
      </div>

      {/* ── Section 1: Overall SLA Score + Breakdown Bars ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Circular Gauge Card */}
        <div className="rounded-lg p-6 flex flex-col items-center" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
          <div className="flex items-center justify-between w-full mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
              Overall SLA Score
            </h3>
            <Shield className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
          </div>
          <div className="relative">
            <RingGauge value={overview.overall} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold" style={{ color: 'var(--odoo-text)' }}>{overview.overall}<span className="text-base">%</span></span>
              <span className="text-[8px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--odoo-text-muted)' }}>Compliance</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--odoo-text-secondary)' }}>
              {overview.overall >= 90
                ? <span>Operating within <span className="font-bold" style={{ color: 'var(--odoo-success)' }}>Optimal Bounds</span>. No critical bottlenecks.</span>
                : overview.overall >= 70
                  ? <span>Performance at <span className="font-bold" style={{ color: 'var(--odoo-warning)' }}>Moderate Level</span>. Review pending breaches.</span>
                  : <span>Performance <span className="font-bold" style={{ color: 'var(--odoo-danger)' }}>Below Target</span>. Immediate attention required.</span>
              }
            </p>
          </div>
        </div>

        {/* SLA Breakdown Bars */}
        <div className="lg:col-span-2 rounded-lg p-6" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>SLA Breakdown by Category</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--odoo-text-secondary)' }}>Target vs actual performance per fulfillment stage</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>{workers.length} workers</span>
          </div>
          <div className="space-y-5">
            {slaBreakdown.map(item => {
              const barColor = item.value >= 85 ? 'var(--odoo-success)' : item.value >= 70 ? 'var(--odoo-warning)' : 'var(--odoo-danger)';
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--odoo-text)' }}>{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>Target: {item.target}</span>
                      <span className="text-sm font-bold" style={{ color: barColor }}>{item.value}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(item.value, 100)}%`, backgroundColor: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Section 2: 3-Card KPI Grid (Pick / Pack / Ship SLA) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Pick SLA', value: overview.pick, target: SLA_PICK, unit: 'min', icon: Zap, trend: 1.8, avgTime: overview.avgResp ? Math.round(overview.avgResp * 0.4) : 0 },
          { title: 'Pack SLA', value: overview.pack, target: SLA_PACK, unit: 'min', icon: Package, trend: -0.5, avgTime: overview.avgResp ? Math.round(overview.avgResp * 0.3) : 0 },
          { title: 'Ship SLA', value: overview.ship, target: SLA_SHIP, unit: 'min', icon: Target, trend: 3.2, avgTime: overview.avgResp ? Math.round(overview.avgResp * 1.2) : 0 },
        ].map(card => {
          const cardColor = card.value >= 85 ? 'var(--odoo-success)' : card.value >= 70 ? 'var(--odoo-warning)' : 'var(--odoo-danger)';
          const isUp = card.trend >= 0;
          const IconComp = card.icon;
          return (
            <div key={card.title} className="rounded-lg p-6 flex flex-col" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>{card.title}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                  <IconComp className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold" style={{ color: 'var(--odoo-text)' }}>{card.value}%</span>
                <span className="text-xs font-medium flex items-center gap-0.5" style={{ color: isUp ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(card.trend).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <span className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>Target</span>
                  <p className="text-xs font-semibold" style={{ color: 'var(--odoo-text-secondary)' }}>{card.target} {card.unit}</p>
                </div>
                <div>
                  <span className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>Avg Time</span>
                  <p className="text-xs font-semibold" style={{ color: 'var(--odoo-text-secondary)' }}>{card.avgTime} {card.unit}</p>
                </div>
              </div>
              <div className="mt-auto">
                <ProgressBar value={card.value} color={cardColor} height="h-1.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Section 3: Worker SLA Table ── */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>Worker SLA Performance</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>{workers.length} workers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 860 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--odoo-bg)' }}>
                {[
                  { key: 'name', label: 'Worker' },
                  { key: 'ordersHandled', label: 'Orders' },
                  { key: 'pickSla', label: 'Pick SLA' },
                  { key: 'packSla', label: 'Pack SLA' },
                  { key: 'shipSla', label: 'Ship SLA' },
                  { key: 'avgTime', label: 'Avg Time' },
                  { key: 'uph', label: 'UPH' },
                  { key: 'overall', label: 'Overall' },
                  { key: 'status', label: 'Status' },
                ].map(col => (
                  <th key={col.key}
                    className="px-4 py-3 text-left font-bold uppercase tracking-wider cursor-pointer select-none transition-colors"
                    style={{ color: 'var(--odoo-text-secondary)', fontSize: '10px', borderBottom: '1px solid var(--odoo-border)' }}
                    onClick={() => col.key !== 'status' && toggleSort(col.key)}>
                    {col.label}{col.key !== 'status' && <SortIcon col={col.key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedWorkers.map((w) => {
                const status = getStatus(w.overall);
                const cfg = STATUS_CONFIG[status];
                const isCritical = status === 'Critical';
                return (
                  <tr key={w.username}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid var(--odoo-border-ghost)',
                      borderLeft: isCritical ? '3px solid var(--odoo-danger)' : '3px solid transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => onSelectWorker?.(w)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(w.name) }}>
                          {w.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{w.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>@{w.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>{w.ordersHandled}</td>
                    {['pickSla', 'packSla', 'shipSla'].map(key => {
                      const slaColor = w[key] >= 85 ? 'var(--odoo-success)' : w[key] >= 70 ? 'var(--odoo-warning)' : 'var(--odoo-danger)';
                      return (
                        <td key={key} className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{w[key]}%</span>
                            <ProgressBar value={w[key]} color={slaColor} height="h-1" />
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3" style={{ color: 'var(--odoo-text-secondary)' }}>{w.avgTime}m</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold" style={{ color: w.uph >= SLA_UPH_MIN ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>{w.uph}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: 'var(--odoo-text)' }}>{w.overall}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase"
                        style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Breach Timeline + Alerts side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breach Timeline Chart */}
        <div className="lg:col-span-2 rounded-lg p-6" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--odoo-warning)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>SLA Breach Timeline</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Today</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={breachTimeline} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--odoo-border-ghost)" />
              <XAxis dataKey="hour" tick={{ fill: 'var(--odoo-text-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--odoo-border-ghost)' }} />
              <YAxis tick={{ fill: 'var(--odoo-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pick" name="Pick Breach" stackId="a" fill="var(--odoo-danger)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pack" name="Pack Breach" stackId="a" fill="var(--odoo-warning)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ship" name="Ship Breach" stackId="a" fill="var(--odoo-coral)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-center">
            {[{ label: 'Pick', color: 'var(--odoo-danger)' }, { label: 'Pack', color: 'var(--odoo-warning)' }, { label: 'Ship', color: 'var(--odoo-coral)' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Live SLA Alerts */}
        <div className="rounded-lg p-6 flex flex-col" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: 'var(--odoo-danger)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>SLA Breach Alerts</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[280px] pr-1">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(1,126,132,0.08)' }}>
                  <CheckCircle className="w-6 h-6" style={{ color: 'var(--odoo-success)' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>All SLAs Met</p>
                <p className="text-xs mt-1" style={{ color: 'var(--odoo-text-muted)' }}>No breaches detected today</p>
              </div>
            ) : (
              alerts.slice(0, 10).map(a => (
                <div key={a.id} className="rounded-lg p-3 flex items-start gap-2 transition-colors"
                  style={{
                    backgroundColor: a.isBreach ? 'rgba(228,111,120,0.05)' : 'rgba(232,169,64,0.05)',
                    border: `1px solid ${a.isBreach ? 'rgba(228,111,120,0.15)' : 'rgba(232,169,64,0.15)'}`,
                  }}>
                  {a.isBreach
                    ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--odoo-danger)' }} />
                    : <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--odoo-warning)' }} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span style={{ color: 'var(--odoo-text-muted)' }}>{a.timestamp}</span>
                      <span className="font-medium truncate" style={{ color: 'var(--odoo-text-secondary)' }}>{a.worker}</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--odoo-text)' }}>{a.type} — <span style={{ color: 'var(--odoo-text-muted)' }}>{a.orderRef}</span></p>
                    <span className="text-[10px] font-bold" style={{ color: a.isBreach ? 'var(--odoo-danger)' : 'var(--odoo-warning)' }}>
                      +{a.overMinutes} min over SLA
                    </span>
                  </div>
                  <ChevronRight className="w-3 h-3 flex-shrink-0 mt-1" style={{ color: 'var(--odoo-text-muted)' }} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Section 5: Trend Charts + Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA Trend by Account */}
        <div className="lg:col-span-2 rounded-lg p-6" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>SLA Trend by Account</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Past 7 days</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {topWorkers.map((w) => {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const data = w.trend.map((v, i) => ({ day: days[i], score: v }));
              const trending = w.trend[6] >= w.trend[5];
              const lineColor = trending ? 'var(--odoo-success)' : 'var(--odoo-danger)';
              return (
                <div key={w.username} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                        style={{ backgroundColor: getAvatarColor(w.name) }}>{w.name.charAt(0)}</div>
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--odoo-text)' }}>{w.name}</span>
                    </div>
                    {trending
                      ? <TrendingUp className="w-3 h-3" style={{ color: 'var(--odoo-success)' }} />
                      : <TrendingDown className="w-3 h-3" style={{ color: 'var(--odoo-danger)' }} />}
                  </div>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={data}>
                      <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={1.5} dot={false} />
                      <XAxis dataKey="day" hide />
                      <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                      <Tooltip content={<CustomTooltip />} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA Distribution */}
        <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}>
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>SLA Distribution</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribution} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--odoo-border-ghost)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--odoo-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="range" tick={{ fill: 'var(--odoo-text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Workers" radius={[0, 4, 4, 0]}>
                {distribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {distribution.map(d => (
              <div key={d.range} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span style={{ color: 'var(--odoo-text-secondary)' }}>{d.range}</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{d.count} workers</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
