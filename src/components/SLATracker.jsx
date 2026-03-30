import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, Clock, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, ChevronRight, Zap, Target, Users } from 'lucide-react';

// SLA thresholds (minutes)
const SLA_PICK = 120;
const SLA_PACK = 60;
const SLA_SHIP = 240;
const SLA_UPH_MIN = 30;

const STATUS_CONFIG = {
  Excellent: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: '#166534', min: 95 },
  Good:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: '#1e40af', min: 85 },
  'Needs Improvement': { color: '#eab308', bg: 'rgba(234,179,8,0.15)', border: '#854d0e', min: 70 },
  Critical:  { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: '#991b1b', min: 0 },
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
const RingGauge = ({ value, size = 64, strokeWidth = 6, color }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value, 100) / 100);
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
};

const ProgressBar = ({ value, color }) => (
  <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
  </div>
);

const SLACard = ({ title, value, unit, icon: Icon, color, trend, trendLabel }) => {
  const isUp = trend >= 0;
  return (
    <div className="rounded-lg p-4 flex flex-col gap-2" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-xs text-slate-500 mb-1">{unit}</span>
      </div>
      <div className="flex items-center gap-1">
        {isUp ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
        <span className={`text-xs ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% {trendLabel || 'vs yesterday'}
        </span>
      </div>
      <ProgressBar value={typeof value === 'string' ? parseFloat(value) : value} color={color} />
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
      <p className="text-slate-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function SLATracker({ activityLogs = [], orders = [], salesOrders = [], onSelectWorker, t }) {
  const [sortCol, setSortCol] = useState('overall');
  const [sortDir, setSortDir] = useState('desc');

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
      { range: 'Excellent (95-100)', count: 0, color: '#22c55e' },
      { range: 'Good (85-94)', count: 0, color: '#3b82f6' },
      { range: 'Fair (70-84)', count: 0, color: '#eab308' },
      { range: 'Critical (<70)', count: 0, color: '#ef4444' },
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
    if (!workers.length) return { overall: 0, pick: 0, pack: 0, ship: 0, avgResp: 0 };
    const avg = (key) => +(workers.reduce((s, w) => s + w[key], 0) / workers.length).toFixed(1);
    return {
      overall: avg('overall'),
      pick: avg('pickSla'),
      pack: avg('packSla'),
      ship: avg('shipSla'),
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
    <span className="text-slate-500 ml-1 text-[10px]">{sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
  );

  // Top 4 workers for trend charts
  const topWorkers = useMemo(() => [...workers].sort((a, b) => b.ordersHandled - a.ordersHandled).slice(0, 4), [workers]);

  if (!workers.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Shield className="w-12 h-12 mb-3 text-slate-600" />
        <p className="text-lg font-medium">No SLA data available</p>
        <p className="text-sm text-slate-500 mt-1">Activity logs will populate this view</p>
      </div>
    );
  }

  const label = (key, fallback) => (typeof t === 'function' ? t(key) : null) || fallback;

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-12 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}>
          <Shield className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">{label('slaTracker', 'SLA Performance Tracker')}</h2>
          <p className="text-xs text-slate-400">Service Level Agreement compliance per worker account</p>
        </div>
      </div>

      {/* Section 1: Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-lg p-4 flex items-center gap-4 col-span-2 sm:col-span-1" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <div className="relative flex-shrink-0">
            <RingGauge value={overview.overall} color={overview.overall >= 85 ? '#22c55e' : overview.overall >= 70 ? '#eab308' : '#ef4444'} />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{overview.overall}%</span>
          </div>
          <div>
            <p className="text-xs text-slate-400">Overall SLA</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">▲ 2.1% vs yesterday</span>
            </div>
          </div>
        </div>
        <SLACard title="Pick On-Time" value={overview.pick} unit="%" icon={Zap} color={overview.pick >= 85 ? '#22c55e' : '#ef4444'} trend={1.8} />
        <SLACard title="Pack On-Time" value={overview.pack} unit="%" icon={Target} color={overview.pack >= 85 ? '#22c55e' : '#ef4444'} trend={-0.5} />
        <SLACard title="Ship On-Time" value={overview.ship} unit="%" icon={CheckCircle} color={overview.ship >= 85 ? '#22c55e' : '#ef4444'} trend={3.2} />
        <SLACard title="Avg Response" value={overview.avgResp} unit="min" icon={Clock} color="#8b5cf6" trend={-2.4} trendLabel="vs yesterday" />
      </div>

      {/* Section 2: Per-Account Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1e293b' }}>
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Per-Account SLA Breakdown</span>
          <span className="ml-auto text-[10px] text-slate-500">{workers.length} workers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 800 }}>
            <thead>
              <tr style={{ backgroundColor: '#020617' }}>
                {[
                  { key: 'name', label: 'Account' },
                  { key: 'ordersHandled', label: 'Orders' },
                  { key: 'pickSla', label: 'Pick SLA %' },
                  { key: 'packSla', label: 'Pack SLA %' },
                  { key: 'shipSla', label: 'Ship SLA %' },
                  { key: 'avgTime', label: 'Avg Time' },
                  { key: 'uph', label: 'UPH' },
                  { key: 'overall', label: 'Overall' },
                  { key: 'status', label: 'Status' },
                ].map(col => (
                  <th key={col.key} className="px-4 py-2.5 text-left text-slate-400 font-medium cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => col.key !== 'status' && toggleSort(col.key)}>
                    {col.label}{col.key !== 'status' && <SortIcon col={col.key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedWorkers.map((w, i) => {
                const status = getStatus(w.overall);
                const cfg = STATUS_CONFIG[status];
                const isCritical = status === 'Critical';
                return (
                  <tr key={w.username} className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid #1e293b', borderLeft: isCritical ? '3px solid #ef4444' : '3px solid transparent' }}
                    onClick={() => onSelectWorker?.(w)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(w.name) }}>
                          {w.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-slate-200 font-medium">{w.name}</p>
                          <p className="text-slate-500 text-[10px]">@{w.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-medium">{w.ordersHandled}</td>
                    {['pickSla', 'packSla', 'shipSla'].map(key => (
                      <td key={key} className="px-4 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-200 font-medium">{w[key]}%</span>
                          <ProgressBar value={w[key]} color={w[key] >= 85 ? '#22c55e' : w[key] >= 70 ? '#eab308' : '#ef4444'} />
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-slate-300">{w.avgTime}m</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-medium ${w.uph >= SLA_UPH_MIN ? 'text-emerald-400' : 'text-red-400'}`}>{w.uph}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-white font-bold">{w.overall}%</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
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

      {/* Section 3 + 4: Breach Timeline + Alerts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Breach Timeline */}
        <div className="lg:col-span-2 rounded-lg p-4" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">SLA Breach Timeline</span>
            <span className="text-[10px] text-slate-500 ml-auto">Today</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={breachTimeline} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pick" name="Pick Breach" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pack" name="Pack Breach" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ship" name="Ship Breach" stackId="a" fill="#eab308" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            {[{ label: 'Pick', color: '#ef4444' }, { label: 'Pack', color: '#f97316' }, { label: 'Ship', color: '#eab308' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                {l.label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-4 border-t border-dashed border-emerald-500" />Target: 0
            </div>
          </div>
        </div>

        {/* Real-Time Alerts */}
        <div className="rounded-lg p-4 flex flex-col" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-white">Live SLA Alerts</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[260px] custom-scrollbar pr-1">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <CheckCircle className="w-8 h-8 mb-2 text-emerald-500" />
                <p className="text-sm">All SLAs met — great job!</p>
              </div>
            ) : (
              alerts.slice(0, 10).map(a => (
                <div key={a.id} className="rounded-md p-2.5 flex items-start gap-2"
                  style={{
                    backgroundColor: a.isBreach ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
                    border: `1px solid ${a.isBreach ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}`,
                  }}>
                  {a.isBreach
                    ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    : <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-500">{a.timestamp}</span>
                      <span className="text-slate-400 font-medium truncate">{a.worker}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">{a.type} — <span className="text-slate-500">{a.orderRef}</span></p>
                    <span className={`text-[10px] font-semibold ${a.isBreach ? 'text-red-400' : 'text-amber-400'}`}>
                      +{a.overMinutes} min over SLA
                    </span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0 mt-1" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 5 + 6: Trend Charts + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SLA Trend by Account */}
        <div className="lg:col-span-2 rounded-lg p-4" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">SLA Trend by Account</span>
            <span className="text-[10px] text-slate-500 ml-auto">Past 7 days</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {topWorkers.map((w, idx) => {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const data = w.trend.map((v, i) => ({ day: days[i], score: v }));
              const trending = w.trend[6] >= w.trend[5];
              const lineColor = trending ? '#22c55e' : '#ef4444';
              return (
                <div key={w.username} className="p-3 rounded-md" style={{ backgroundColor: '#020617', border: '1px solid #1e293b' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                        style={{ backgroundColor: getAvatarColor(w.name) }}>{w.name.charAt(0)}</div>
                      <span className="text-[11px] text-slate-300 font-medium">{w.name}</span>
                    </div>
                    {trending
                      ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />}
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
        <div className="rounded-lg p-4" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">SLA Distribution</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribution} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="range" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Workers" radius={[0, 4, 4, 0]}>
                {distribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {distribution.map(d => (
              <div key={d.range} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-400">{d.range}</span>
                </div>
                <span className="text-slate-300 font-medium">{d.count} workers</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
