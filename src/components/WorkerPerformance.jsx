import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { X, Trophy, Zap, Target, Clock, Activity, TrendingUp, Star, Flame, Award, Crosshair, Layers } from 'lucide-react';
import { TIER_CONFIG, calculateTaskDifficulty } from '../utils/taskScoring';

// Generate a consistent color from a string
const hashColor = (str = '') => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Format relative time
const relativeTime = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// Action type config
const ACTION_CONFIG = {
  pick: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Pick' },
  pack: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Pack' },
  scan: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Scan' },
};

const getActionType = (action = '') => {
  const lower = action.toLowerCase();
  if (lower.includes('pick')) return 'pick';
  if (lower.includes('pack')) return 'pack';
  if (lower.includes('scan')) return 'scan';
  return 'scan';
};

// Mini sparkline component
const Sparkline = ({ data, color }) => (
  <ResponsiveContainer width="100%" height={28}>
    <LineChart data={data}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

// Gauge ring SVG
const GaugeRing = ({ value, max, color, size = 64 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <svg width={size} height={size} className="absolute inset-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
    </svg>
  );
};

export default function WorkerPerformance({ activityLogs = [], worker, onClose, t }) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  };

  const stats = useMemo(() => {
    if (!worker || !activityLogs.length) {
      return {
        workerLogs: [], todayLogs: [], uph: 0, totalActions: 0,
        activeHours: 0, efficiency: 0, hourlyData: [], actionBreakdown: { pick: 0, pack: 0, scan: 0 },
        recentLogs: [], weeklyData: [], sparklines: { uph: [], actions: [], hours: [], eff: [] },
        avgTimeBetween: 0, firstAction: null,
      };
    }

    const workerLogs = activityLogs.filter(
      (l) => l.username === worker.username || l.name === worker.name
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = workerLogs.filter((l) => new Date(l.timestamp) >= today);

    // Action breakdown
    const breakdown = { pick: 0, pack: 0, scan: 0 };
    todayLogs.forEach((l) => { breakdown[getActionType(l.action)]++; });
    const totalActions = breakdown.pick + breakdown.pack + breakdown.scan;

    // Active hours
    let activeHours = 0;
    let firstAction = null;
    if (todayLogs.length > 1) {
      const sorted = [...todayLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      firstAction = sorted[0].timestamp;
      const first = new Date(sorted[0].timestamp).getTime();
      const last = new Date(sorted[sorted.length - 1].timestamp).getTime();
      activeHours = Math.max((last - first) / 3600000, 0.1);
    } else if (todayLogs.length === 1) {
      firstAction = todayLogs[0].timestamp;
      activeHours = 0.1;
    }

    const uph = activeHours > 0 ? Math.round(totalActions / activeHours) : 0;
    const efficiency = Math.min(Math.round((uph / 50) * 100), 200);

    // Hourly data (6AM to current hour)
    const currentHour = new Date().getHours();
    const startHour = 6;
    const hourlyData = [];
    for (let h = startHour; h <= currentHour; h++) {
      const hourLogs = todayLogs.filter((l) => new Date(l.timestamp).getHours() === h);
      hourlyData.push({
        hour: `${h.toString().padStart(2, '0')}:00`,
        h,
        Pick: hourLogs.filter((l) => getActionType(l.action) === 'pick').length,
        Pack: hourLogs.filter((l) => getActionType(l.action) === 'pack').length,
        Scan: hourLogs.filter((l) => getActionType(l.action) === 'scan').length,
        isCurrent: h === currentHour,
      });
    }

    // Sparkline data (last 6 hours)
    const sparkBase = [];
    for (let i = 5; i >= 0; i--) {
      const h = currentHour - i;
      const hourLogs = todayLogs.filter((l) => new Date(l.timestamp).getHours() === h);
      const cnt = hourLogs.length;
      sparkBase.push({ v: cnt });
    }
    const sparklines = {
      uph: sparkBase.map((s) => ({ v: s.v })),
      actions: sparkBase,
      hours: sparkBase.map((_, i) => ({ v: Math.min(i + 1, 6) })),
      eff: sparkBase.map((s) => ({ v: Math.round((s.v / 50) * 100) })),
    };

    // Avg time between actions
    let avgTimeBetween = 0;
    if (todayLogs.length > 1) {
      const sorted = [...todayLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let totalGap = 0;
      for (let i = 1; i < sorted.length; i++) {
        totalGap += new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime();
      }
      avgTimeBetween = Math.round(totalGap / (sorted.length - 1) / 1000);
    }

    // 7-day history (synthetic from available data)
    const weeklyData = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayLogs = workerLogs.filter((l) => {
        const ts = new Date(l.timestamp);
        return ts >= day && ts < nextDay;
      });
      const dayTotal = dayLogs.length;
      const dayLabel = d === 0 ? 'Today' : day.toLocaleDateString('en', { weekday: 'short' });
      // Estimate hours active for this day
      let dayHours = 0.1;
      if (dayLogs.length > 1) {
        const s = [...dayLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        dayHours = Math.max((new Date(s[s.length - 1].timestamp).getTime() - new Date(s[0].timestamp).getTime()) / 3600000, 0.1);
      }
      weeklyData.push({ day: dayLabel, units: dayTotal, uph: dayTotal > 0 ? Math.round(dayTotal / dayHours) : 0 });
    }
    const avgUph = weeklyData.length ? Math.round(weeklyData.reduce((s, d) => s + d.uph, 0) / weeklyData.length) : 0;
    weeklyData.forEach((d) => { d.avg = avgUph; });

    return {
      workerLogs, todayLogs, uph, totalActions, activeHours, efficiency,
      hourlyData, actionBreakdown: breakdown, recentLogs: workerLogs.slice(0, 50),
      weeklyData, sparklines, avgTimeBetween, firstAction,
    };
  }, [activityLogs, worker]);

  // Badges
  const badges = useMemo(() => {
    const allUserTotals = {};
    activityLogs.forEach((l) => {
      const key = l.username || l.name;
      allUserTotals[key] = (allUserTotals[key] || 0) + 1;
    });
    const workerKey = worker?.username || worker?.name;
    const maxActions = Math.max(...Object.values(allUserTotals), 0);

    // Yesterday UPH for "Rising Star"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
    const yLogs = (stats.workerLogs || []).filter((l) => {
      const ts = new Date(l.timestamp);
      return ts >= yesterday && ts < yesterdayEnd;
    });
    let yUph = 0;
    if (yLogs.length > 1) {
      const s = [...yLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const hrs = Math.max((new Date(s[s.length - 1].timestamp).getTime() - new Date(s[0].timestamp).getTime()) / 3600000, 0.1);
      yUph = Math.round(yLogs.length / hrs);
    }

    // All users UPH for top performer
    const allUphMap = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activityLogs.filter((l) => new Date(l.timestamp) >= today).forEach((l) => {
      const key = l.username || l.name;
      if (!allUphMap[key]) allUphMap[key] = [];
      allUphMap[key].push(l);
    });
    let isTopUph = true;
    Object.entries(allUphMap).forEach(([key, logs]) => {
      if (key === workerKey || logs.length < 2) return;
      const s = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const hrs = Math.max((new Date(s[s.length - 1].timestamp).getTime() - new Date(s[0].timestamp).getTime()) / 3600000, 0.1);
      if (Math.round(logs.length / hrs) > stats.uph) isTopUph = false;
    });

    return [
      { icon: <Flame className="w-4 h-4" />, label: 'Speed Demon', desc: 'UPH > 60', earned: stats.uph > 60, emoji: '🔥' },
      { icon: <Star className="w-4 h-4" />, label: 'Consistent', desc: 'Active > 6 hours', earned: stats.activeHours > 6, emoji: '⭐' },
      { icon: <Crosshair className="w-4 h-4" />, label: 'Sharpshooter', desc: '0 errors today', earned: stats.totalActions > 0, emoji: '🎯' },
      { icon: <Trophy className="w-4 h-4" />, label: 'Top Performer', desc: 'Highest UPH', earned: isTopUph && stats.uph > 0, emoji: '🏆' },
      { icon: <Zap className="w-4 h-4" />, label: 'Workhorse', desc: 'Most actions', earned: (allUserTotals[workerKey] || 0) >= maxActions && maxActions > 0, emoji: '💪' },
      { icon: <TrendingUp className="w-4 h-4" />, label: 'Rising Star', desc: 'UPH improved', earned: stats.uph > yUph && yUph > 0, emoji: '🌟' },
    ];
  }, [stats, activityLogs, worker]);

  const avatarColor = hashColor(worker?.name);
  const avatarLetter = (worker?.name || '?')[0].toUpperCase();

  const isEmpty = !worker || stats.totalActions === 0;

  // Custom tooltip for charts
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg px-3 py-2 text-xs shadow-xl" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
        <p className="font-semibold text-slate-200 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={handleClose}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-250 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      />

      {/* Panel */}
      <div
        className={`relative w-full sm:w-[480px] h-full overflow-y-auto custom-scrollbar transition-transform duration-250 ${isClosing ? 'translate-x-full' : 'translate-x-0'}`}
        style={{ backgroundColor: '#0f172a', borderLeft: '1px solid #1e293b' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. HEADER */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-4" style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base truncate">{worker?.name || 'Unknown'}</h2>
            <p className="text-slate-400 text-xs font-mono">@{worker?.username || '—'}</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
            WORKER
          </span>
          {stats.firstAction && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" /> Since {new Date(stats.firstAction).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
            <Activity className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No activity recorded today</p>
            <p className="text-xs mt-1">Actions will appear here once this worker starts.</p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* 2. TODAY'S SCORECARD */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Today's Scorecard</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'UPH', value: stats.uph, color: '#3b82f6', icon: <Zap className="w-3.5 h-3.5" />, spark: stats.sparklines.uph, gauge: true, max: 100 },
                  { label: 'Total Actions', value: stats.totalActions, color: '#10b981', icon: <Activity className="w-3.5 h-3.5" />, spark: stats.sparklines.actions },
                  { label: 'Active Hours', value: stats.activeHours.toFixed(1), color: '#f59e0b', icon: <Clock className="w-3.5 h-3.5" />, spark: stats.sparklines.hours },
                  { label: 'Efficiency', value: `${stats.efficiency}%`, color: stats.efficiency >= 100 ? '#10b981' : '#f59e0b', icon: <Target className="w-3.5 h-3.5" />, spark: stats.sparklines.eff },
                ].map((card, i) => (
                  <div key={i} className="rounded-xl p-3.5 relative overflow-hidden" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                        <span style={{ color: card.color }}>{card.icon}</span> {card.label}
                      </span>
                      {card.gauge && (
                        <div className="relative w-10 h-10 flex items-center justify-center">
                          <GaugeRing value={stats.uph} max={card.max} color={card.color} size={40} />
                        </div>
                      )}
                    </div>
                    <p className="text-2xl font-extrabold text-white">{card.value}</p>
                    <div className="mt-1.5 h-7 opacity-60">
                      <Sparkline data={card.spark} color={card.color} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. HOURLY ACTIVITY TIMELINE */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Hourly Activity</h3>
              <div className="rounded-xl p-4" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.hourlyData} barGap={1} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Pick" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]}>
                      {stats.hourlyData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isCurrent ? '#60a5fa' : '#3b82f6'} />
                      ))}
                    </Bar>
                    <Bar dataKey="Pack" stackId="a" fill="#10b981" />
                    <Bar dataKey="Scan" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  {['Pick', 'Pack', 'Scan'].map((type) => (
                    <span key={type} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ACTION_CONFIG[type.toLowerCase()]?.color }} />
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. ACTION BREAKDOWN */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Action Breakdown</h3>
              <div className="rounded-xl p-4" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                {/* Stacked bar */}
                <div className="h-5 rounded-full overflow-hidden flex mb-4" style={{ backgroundColor: '#0f172a' }}>
                  {Object.entries(stats.actionBreakdown).map(([type, count]) => {
                    const pct = stats.totalActions > 0 ? (count / stats.totalActions) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={type}
                        className="h-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: ACTION_CONFIG[type]?.color }}
                        title={`${ACTION_CONFIG[type]?.label}: ${count} (${pct.toFixed(0)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(stats.actionBreakdown).map(([type, count]) => {
                    const pct = stats.totalActions > 0 ? ((count / stats.totalActions) * 100).toFixed(0) : 0;
                    const cfg = ACTION_CONFIG[type];
                    return (
                      <div key={type} className="text-center">
                        <p className="text-lg font-bold" style={{ color: cfg.color }}>{count}</p>
                        <p className="text-[10px] text-slate-400">{cfg.label} ({pct}%)</p>
                      </div>
                    );
                  })}
                </div>
                {stats.avgTimeBetween > 0 && (
                  <p className="text-center text-[10px] text-slate-500 mt-3 pt-3" style={{ borderTop: '1px solid #334155' }}>
                    Avg. time between actions: <span className="text-slate-300 font-semibold">
                      {stats.avgTimeBetween < 60 ? `${stats.avgTimeBetween}s` : `${Math.floor(stats.avgTimeBetween / 60)}m ${stats.avgTimeBetween % 60}s`}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* 5. RECENT ACTIVITY LOG */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Recent Activity <span className="text-slate-500 font-normal">({stats.recentLogs.length})</span>
              </h3>
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', maxHeight: '280px', overflowY: 'auto' }}>
                {stats.recentLogs.map((log, i) => {
                  const type = getActionType(log.action);
                  const cfg = ACTION_CONFIG[type];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-800/50"
                      style={{ borderBottom: i < stats.recentLogs.length - 1 ? '1px solid #1e293b' : 'none' }}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                        <Activity className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">
                          <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                          {log.details && <span className="text-slate-400"> — {log.details}</span>}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">{relativeTime(log.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. 7-DAY HISTORY */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">7-Day History</h3>
              <div className="rounded-xl p-4" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={stats.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="uph" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name="UPH" />
                    <Line type="monotone" dataKey="units" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} name="Units" />
                    <Line type="monotone" dataKey="avg" stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Avg UPH" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: '#8b5cf6', display: 'inline-block' }} /> UPH
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: '#3b82f6', display: 'inline-block' }} /> Units
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-5 h-0" style={{ borderTop: '1px dashed #64748b', display: 'inline-block' }} /> Avg
                  </span>
                </div>
              </div>
            </div>

            {/* 7. TASK DIFFICULTY PROFILE */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Task Difficulty Profile
              </h3>
              {(() => {
                const tiers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                let weightedTotal = 0;
                workerLogs.forEach(log => {
                  const { tier, weight } = calculateTaskDifficulty(log.details || null);
                  tiers[tier]++;
                  weightedTotal += weight;
                });
                const totalTasks = Object.values(tiers).reduce((a, b) => a + b, 0);
                if (totalTasks === 0) return <p className="text-sm text-slate-500">No task data available</p>;
                const avgTier = (Object.entries(tiers).reduce((s, [t, c]) => s + Number(t) * c, 0) / totalTasks).toFixed(1);
                return (
                  <div className="space-y-3">
                    {/* Stacked bar */}
                    <div className="flex h-6 rounded-lg overflow-hidden">
                      {[1, 2, 3, 4, 5].map(tier => {
                        const pct = (tiers[tier] / totalTasks) * 100;
                        if (pct === 0) return null;
                        return (
                          <div key={tier} style={{ width: `${pct}%`, backgroundColor: TIER_CONFIG[tier].color, minWidth: pct > 0 ? '20px' : 0 }}
                            className="flex items-center justify-center text-[10px] font-bold text-white"
                            title={`${TIER_CONFIG[tier].label}: ${tiers[tier]} tasks (${pct.toFixed(0)}%)`}
                          >
                            {pct >= 12 && `${tiers[tier]}`}
                          </div>
                        );
                      })}
                    </div>
                    {/* Tier list */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map(tier => (
                        <div key={tier} className="text-center p-1.5 rounded-lg" style={{ backgroundColor: TIER_CONFIG[tier].color + '15' }}>
                          <div className="text-sm">{TIER_CONFIG[tier].icon}</div>
                          <div className="text-xs font-bold" style={{ color: TIER_CONFIG[tier].color }}>{tiers[tier]}</div>
                          <div className="text-[9px] text-slate-500">{TIER_CONFIG[tier].label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Summary */}
                    <div className="flex justify-between text-xs text-slate-400 px-1">
                      <span>Weighted Score: <b className="text-purple-400">{weightedTotal.toFixed(1)}</b></span>
                      <span>Avg Tier: <b className="text-slate-200">{avgTier}</b></span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 8. PERFORMANCE BADGES */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" /> Performance Badges
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                {badges.map((badge, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 text-center transition-all duration-300 ${badge.earned ? '' : 'opacity-30 grayscale'}`}
                    style={{
                      backgroundColor: badge.earned ? 'rgba(139,92,246,0.1)' : '#1e293b',
                      border: `1px solid ${badge.earned ? 'rgba(139,92,246,0.3)' : '#334155'}`,
                    }}
                  >
                    <span className="text-xl">{badge.emoji}</span>
                    <p className="text-[10px] font-bold text-slate-200 mt-1">{badge.label}</p>
                    <p className="text-[9px] text-slate-500">{badge.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom spacer */}
            <div className="h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
