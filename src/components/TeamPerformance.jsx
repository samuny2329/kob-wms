import React, { useMemo, useState } from 'react';
import { AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Zap, Users, Clock, Target, Award, Activity, Layers, LayoutGrid, List, Columns } from 'lucide-react';
import { TIER_CONFIG, getTaskDistribution, calculateTaskDifficulty } from '../utils/taskScoring';
import { ROLE_KPI_CONFIG, computeOkrResults, getOkrGrade, SAMPLE_OKR_WORKERS } from '../constants';

const TARGET_UPH = 50;
const GAUGE_COLORS = { red: '#ef4444', yellow: '#eab308', green: '#10b981', blue: '#3b82f6' };

function getGaugeColor(uph) {
    if (uph < 20) return GAUGE_COLORS.red;
    if (uph < 40) return GAUGE_COLORS.yellow;
    if (uph < 60) return GAUGE_COLORS.green;
    return GAUGE_COLORS.blue;
}

function SpeedGauge({ name, uph, maxUph = 80 }) {
    const radius = 40;
    const stroke = 7;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(uph / maxUph, 1);
    const dashOffset = circumference * (1 - progress);
    const color = getGaugeColor(uph);

    return (
        <div className="flex flex-col items-center gap-1 min-w-[100px]">
            <svg width={100} height={100} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth={stroke} />
                <circle
                    cx="50" cy="50" r={radius} fill="none"
                    stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset}
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
                <text x="50" y="46" textAnchor="middle" fill={color} fontSize="20" fontWeight="bold">{uph}</text>
                <text x="50" y="62" textAnchor="middle" fill="#94a3b8" fontSize="10">UPH</text>
            </svg>
            <span className="text-xs text-slate-400 truncate max-w-[96px] text-center">{name}</span>
        </div>
    );
}

function HeatmapCell({ value, maxValue }) {
    const intensity = maxValue > 0 ? value / maxValue : 0;
    const bg = intensity === 0
        ? 'bg-slate-800'
        : intensity < 0.25 ? 'bg-emerald-900/50'
        : intensity < 0.5 ? 'bg-emerald-700/60'
        : intensity < 0.75 ? 'bg-emerald-500/70'
        : 'bg-emerald-400/80';
    return (
        <div className={`w-8 h-8 rounded-sm ${bg} flex items-center justify-center`} title={`${value} actions`}>
            {value > 0 && <span className="text-[9px] text-white/70">{value}</span>}
        </div>
    );
}

export default function TeamPerformance({ activityLogs, orders, users = [], t, onSelectWorker, workerOkrData = {} }) {
    const [sortCol, setSortCol] = useState('total');
    const [sortAsc, setSortAsc] = useState(false);
    const [okrView, setOkrView] = useState('kanban');

    const today = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Username → role lookup
    const userRoleMap = useMemo(() => {
        const map = {};
        (users || []).forEach(u => { map[u.username] = u.role || 'admin'; });
        return map;
    }, [users]);

    // Filter today's logs
    const todayLogs = useMemo(() => {
        if (!activityLogs?.length) return [];
        return activityLogs.filter(l => {
            if (!l.timestamp) return false;
            return new Date(l.timestamp).toISOString().split('T')[0] === today;
        });
    }, [activityLogs, today]);

    // Per-worker stats
    const workerStats = useMemo(() => {
        const stats = {};
        todayLogs.forEach(log => {
            const key = log.username || 'unknown';
            if (!stats[key]) {
                stats[key] = {
                    name: log.name || log.username, username: key,
                    pick: 0, pack: 0, scan: 0, total: 0,
                    firstAction: log.timestamp, lastAction: log.timestamp
                };
            }
            const s = stats[key];
            if (log.action === 'pick') s.pick++;
            else if (log.action === 'pack') s.pack++;
            else if (log.action === 'scan') s.scan++;
            s.total++;
            if (log.timestamp < s.firstAction) s.firstAction = log.timestamp;
            if (log.timestamp > s.lastAction) s.lastAction = log.timestamp;
        });

        // Role-specific action sets for UPH — matches KPI Assessment auto KPIs
        const ROLE_ACTIONS = {
            picker: ['pick'], packer: ['pack', 'pack-handheld', 'pack-pos'],
            outbound: ['scan'], admin: ['pick', 'pack', 'pack-handheld', 'pack-pos', 'scan'],
            senior: ['pick', 'pack', 'pack-handheld', 'pack-pos', 'scan'],
        };

        return Object.values(stats).map(s => {
            s.role = userRoleMap[s.username] || 'admin';
            s.roleConfig = ROLE_KPI_CONFIG[s.role] || ROLE_KPI_CONFIG.admin;
            const targetForRole = s.roleConfig.targetUPH || TARGET_UPH;

            // Use role-specific actions for UPH (aligned with KPI Assessment)
            const roleActions = ROLE_ACTIONS[s.role] || ROLE_ACTIONS.admin;
            const roleCount = todayLogs.filter(l => l.username === s.username && roleActions.includes(l.action)).length;
            let hours = (s.lastAction - s.firstAction) / 3600000;
            if (hours < 0.1) hours = 0.1;
            s.uph = Math.round(roleCount / hours);
            s.efficiency = Math.round((s.uph / targetForRole) * 100);

            // Use shared OKR data if available
            if (workerOkrData[s.username]?.okrToday) {
                s.sharedOkr = workerOkrData[s.username].okrToday;
            }
            return s;
        });
    }, [todayLogs, userRoleMap]);

    // Historical stats for trend (mock from past 7 days of activityLogs)
    const historicalData = useMemo(() => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en', { weekday: 'short' });

            const dayLogs = (activityLogs || []).filter(l => {
                if (!l.timestamp) return false;
                return new Date(l.timestamp).toISOString().split('T')[0] === dateStr;
            });

            const totalUnits = dayLogs.length;
            // Compute avg UPH for the day
            const byUser = {};
            dayLogs.forEach(l => {
                const k = l.username || 'unknown';
                if (!byUser[k]) byUser[k] = { total: 0, first: l.timestamp, last: l.timestamp };
                byUser[k].total++;
                if (l.timestamp < byUser[k].first) byUser[k].first = l.timestamp;
                if (l.timestamp > byUser[k].last) byUser[k].last = l.timestamp;
            });
            const uphValues = Object.values(byUser).map(u => {
                let h = (u.last - u.first) / 3600000;
                if (h < 0.1) h = 0.1;
                return Math.round(u.total / h);
            });
            const avgUph = uphValues.length > 0 ? Math.round(uphValues.reduce((a, b) => a + b, 0) / uphValues.length) : 0;

            days.push({ day: dayLabel, date: dateStr, totalUnits, avgUph, target: TARGET_UPH });
        }
        return days;
    }, [activityLogs]);

    // Yesterday stats for trend arrows
    const yesterdayAvgUph = useMemo(() => {
        const d = historicalData.find((_, i) => i === historicalData.length - 2);
        return d ? d.avgUph : 0;
    }, [historicalData]);

    // KPI computations
    const kpis = useMemo(() => {
        const totalUnits = workerStats.reduce((a, w) => a + w.total, 0);
        const avgUph = workerStats.length > 0
            ? Math.round(workerStats.reduce((a, w) => a + w.uph, 0) / workerStats.length)
            : 0;
        const topPerformer = workerStats.length > 0
            ? workerStats.reduce((best, w) => w.uph > best.uph ? w : best, workerStats[0])
            : null;
        const teamEfficiency = Math.round((avgUph / TARGET_UPH) * 100);
        const uphTrend = avgUph - yesterdayAvgUph;

        return { totalUnits, avgUph, topPerformer, teamEfficiency, uphTrend };
    }, [workerStats, yesterdayAvgUph]);

    // Hourly throughput data
    const hourlyData = useMemo(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const data = [];
        for (let h = 6; h <= Math.max(currentHour, 6); h++) {
            const hourLogs = todayLogs.filter(l => new Date(l.timestamp).getHours() === h);
            data.push({
                hour: `${h.toString().padStart(2, '0')}:00`,
                Pick: hourLogs.filter(l => l.action === 'pick').length,
                Pack: hourLogs.filter(l => l.action === 'pack').length,
                Scan: hourLogs.filter(l => l.action === 'scan').length,
            });
        }
        return data;
    }, [todayLogs]);

    // Sorted leaderboard
    const leaderboard = useMemo(() => {
        const sorted = [...workerStats];
        sorted.sort((a, b) => {
            const valA = a[sortCol] ?? 0;
            const valB = b[sortCol] ?? 0;
            return sortAsc ? valA - valB : valB - valA;
        });
        return sorted;
    }, [workerStats, sortCol, sortAsc]);

    // Action distribution for pie
    const actionDistribution = useMemo(() => {
        const pick = todayLogs.filter(l => l.action === 'pick').length;
        const pack = todayLogs.filter(l => l.action === 'pack').length;
        const scan = todayLogs.filter(l => l.action === 'scan').length;
        if (pick + pack + scan === 0) return [];
        return [
            { name: 'Pick', value: pick, color: '#3b82f6' },
            { name: 'Pack', value: pack, color: '#10b981' },
            { name: 'Scan', value: scan, color: '#f59e0b' },
        ];
    }, [todayLogs]);

    // Heatmap data: rows = hours (6-22), cols = last 7 days
    const heatmapData = useMemo(() => {
        const hours = [];
        for (let h = 6; h <= 22; h++) {
            const row = { hour: h };
            historicalData.forEach(day => {
                const dayLogs = (activityLogs || []).filter(l => {
                    if (!l.timestamp) return false;
                    const d = new Date(l.timestamp);
                    return d.toISOString().split('T')[0] === day.date && d.getHours() === h;
                });
                row[day.day] = dayLogs.length;
            });
            hours.push(row);
        }
        return hours;
    }, [activityLogs, historicalData]);

    const heatmapMax = useMemo(() => {
        let max = 0;
        heatmapData.forEach(row => {
            historicalData.forEach(day => {
                if (row[day.day] > max) max = row[day.day];
            });
        });
        return max;
    }, [heatmapData, historicalData]);

    // Summary cards
    const summaryStats = useMemo(() => {
        // Peak hour
        let peakHour = '--';
        let peakCount = 0;
        hourlyData.forEach(h => {
            const total = h.Pick + h.Pack + h.Scan;
            if (total > peakCount) { peakCount = total; peakHour = h.hour; }
        });

        // Avg time per order estimate
        const totalOrders = orders?.length || 0;
        const totalActions = todayLogs.length;
        const avgTimePerOrder = totalOrders > 0 && totalActions > 0
            ? `${Math.round((totalActions / totalOrders) * 2.5)}min`
            : '--';

        // Best day this week
        const bestDay = historicalData.reduce((best, d) => d.totalUnits > (best?.totalUnits || 0) ? d : best, null);

        return {
            peakHour: peakCount > 0 ? `${peakHour} (${peakCount})` : '--',
            avgTimePerOrder,
            bestDay: bestDay && bestDay.totalUnits > 0 ? `${bestDay.day} (${bestDay.totalUnits})` : '--',
            qualityScore: '98.5%',
        };
    }, [hourlyData, orders, todayLogs, historicalData]);

    // Task difficulty distribution from salesOrders/orders
    const tierDistribution = useMemo(() => {
        if (!orders?.length) return null;
        const dist = getTaskDistribution(orders);
        const total = orders.length;

        // Per-worker tier breakdown
        const workerTiers = {};
        todayLogs.forEach(log => {
            const key = log.username || 'unknown';
            if (!workerTiers[key]) workerTiers[key] = { name: log.name || key, username: key, tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, weightedTotal: 0 };
            // Match log to an order and get tier
            const matchedOrder = orders.find(o => log.details?.order === o.ref || log.details?.orderId === o.ref);
            const { tier, weight } = calculateTaskDifficulty(matchedOrder);
            workerTiers[key].tiers[tier]++;
            workerTiers[key].weightedTotal += weight;
        });

        return { dist, total, workerTiers: Object.values(workerTiers) };
    }, [orders, todayLogs]);

    // Column sort handler
    const handleSort = (col) => {
        if (sortCol === col) setSortAsc(!sortAsc);
        else { setSortCol(col); setSortAsc(false); }
    };
    const SortArrow = ({ col }) => sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';

    const hasLogs = todayLogs.length > 0;

    return (
        <div className="space-y-6">
            {/* ─── SECTION 1: KPI CARDS ─── */}
            {hasLogs && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon={<Zap className="w-5 h-5" />}
                    label="Avg Team UPH"
                    value={kpis.avgUph}
                    accent="blue"
                    trend={kpis.uphTrend}
                />
                <KpiCard
                    icon={<Trophy className="w-5 h-5" />}
                    label="Top Performer"
                    value={kpis.topPerformer?.name || '--'}
                    sub={kpis.topPerformer ? `${kpis.topPerformer.uph} UPH` : ''}
                    accent="amber"
                />
                <KpiCard
                    icon={<Activity className="w-5 h-5" />}
                    label="Total Units Today"
                    value={kpis.totalUnits}
                    accent="emerald"
                />
                <KpiCard
                    icon={<Target className="w-5 h-5" />}
                    label="Team Efficiency"
                    value={`${kpis.teamEfficiency}%`}
                    accent={kpis.teamEfficiency >= 80 ? 'emerald' : kpis.teamEfficiency >= 50 ? 'amber' : 'red'}
                    sub={`Target: ${TARGET_UPH} UPH`}
                />
            </div>}

            {/* ─── SECTION: OKR SCORECARD (Multi-View) ─── */}
            {(() => {
                const displayWorkers = workerStats.length > 0
                    ? workerStats.map(w => ({ ...w, role: w.role || 'admin' }))
                    : SAMPLE_OKR_WORKERS.map(w => ({ ...w, pick: Math.floor(Math.random() * 40) + 20, pack: Math.floor(Math.random() * 30) + 15, scan: Math.floor(Math.random() * 25) + 10, total: 0, uph: Math.floor(Math.random() * 30) + 20 }));
                const roles = ['picker', 'packer', 'outbound', 'accounting'];

                // Compute OKR for all workers
                const allWorkerOkrs = displayWorkers.map(w => {
                    const wLogs = workerStats.length > 0 ? todayLogs.filter(l => l.username === w.username) : [];
                    const okr = computeOkrResults(w.role, wLogs, orders || []);
                    const rc = ROLE_KPI_CONFIG[w.role] || ROLE_KPI_CONFIG.admin;
                    return { ...w, okr, rc };
                });

                const ViewBtn = ({ mode, icon, label }) => (
                    <button onClick={() => setOkrView(mode)} className="p-1.5 rounded transition-colors" title={label}
                        style={{ backgroundColor: okrView === mode ? '#714B67' : 'transparent', color: okrView === mode ? '#fff' : '#64748b' }}>
                        {icon}
                    </button>
                );

                return (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                        {/* Header with view switcher */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-purple-400" /> OKR Scorecard
                                </h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">Objectives & Key Results — role-based performance</p>
                            </div>
                            <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                                <ViewBtn mode="scorecard" icon={<Columns className="w-3.5 h-3.5" />} label="Scorecard" />
                                <ViewBtn mode="kanban" icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Kanban" />
                                <ViewBtn mode="list" icon={<List className="w-3.5 h-3.5" />} label="List" />
                            </div>
                        </div>

                        {/* ── VIEW: Scorecard (default) ── */}
                        {okrView === 'scorecard' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                {roles.map(roleKey => {
                                    const rc = ROLE_KPI_CONFIG[roleKey];
                                    if (!rc?.keyResults) return null;
                                    const roleWorkers = allWorkerOkrs.filter(w => w.role === roleKey);
                                    if (roleWorkers.length === 0) return null;
                                    const roleLogs = workerStats.length > 0 ? todayLogs.filter(l => roleWorkers.some(w => w.username === l.username)) : [];
                                    const teamOkr = computeOkrResults(roleKey, roleLogs, orders || []);
                                    return (
                                        <div key={roleKey} className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                                            {/* Role header with score */}
                                            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: `2px solid ${rc.color}44` }}>
                                                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black" style={{ backgroundColor: rc.color + '22', color: rc.color }}>
                                                    {rc.label.charAt(0)}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold truncate" style={{ color: rc.color }}>{rc.label}</div>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-2xl font-black" style={{ color: teamOkr.grade.color }}>{teamOkr.totalScore}%</span>
                                                    <div className="text-[8px] font-bold px-1.5 py-0.5 rounded mt-0.5" style={{ backgroundColor: teamOkr.grade.bg, color: teamOkr.grade.color }}>{teamOkr.grade.grade}</div>
                                                </div>
                                            </div>

                                            {/* Compact KR bars */}
                                            <div className="px-3 py-2.5 space-y-2 flex-1">
                                                {teamOkr.results.slice(0, 5).map(kr => {
                                                    const barColor = kr.score >= 100 ? '#10b981' : kr.score >= 75 ? '#f59e0b' : '#ef4444';
                                                    return (
                                                        <div key={kr.key}>
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <span className="text-[10px] text-slate-400 truncate flex-1">{kr.label}</span>
                                                                <span className="text-[10px] font-bold ml-2" style={{ color: barColor }}>{kr.score}%</span>
                                                            </div>
                                                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full" style={{ width: `${Math.min(kr.score, 100)}%`, backgroundColor: barColor, transition: 'width 0.5s' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Workers */}
                                            <div className="px-3 py-2 border-t border-slate-700/60 bg-slate-800/30 space-y-0.5">
                                                {roleWorkers.map(w => (
                                                    <div key={w.username} className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-700/40 rounded px-1.5 -mx-1.5" onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: rc.color }}>{w.name?.charAt(0)}</span>
                                                            <span className="text-[11px] text-slate-300">{w.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-bold" style={{ color: getGaugeColor(w.uph) }}>{w.uph}</span>
                                                            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: w.okr.grade.bg, color: w.okr.grade.color }}>{w.okr.grade.grade}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── VIEW: Kanban (by Grade) ── */}
                        {okrView === 'kanban' && (
                            <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: '200px' }}>
                                {[
                                    { grade: 'S', label: 'Outstanding', color: '#7c3aed', bg: '#ede9fe' },
                                    { grade: 'A', label: 'Excellent', color: '#059669', bg: '#d1fae5' },
                                    { grade: 'B', label: 'Good', color: '#2563eb', bg: '#dbeafe' },
                                    { grade: 'C', label: 'Needs Improvement', color: '#d97706', bg: '#fef3c7' },
                                    { grade: 'D', label: 'Below Standard', color: '#dc2626', bg: '#fee2e2' },
                                ].map(col => {
                                    const colWorkers = allWorkerOkrs.filter(w => w.okr.grade.grade === col.grade);
                                    return (
                                        <div key={col.grade} className="flex-1 min-w-[180px] bg-slate-800/40 rounded-lg border border-slate-700 flex flex-col">
                                            <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                                                <span className="text-sm font-black" style={{ color: col.color }}>{col.grade}</span>
                                                <span className="text-[10px] text-slate-400 flex-1">{col.label}</span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">{colWorkers.length}</span>
                                            </div>
                                            <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '400px' }}>
                                                {colWorkers.map(w => (
                                                    <div key={w.username} className="bg-slate-800 rounded-lg p-3 border border-slate-700 cursor-pointer hover:border-slate-500 transition-colors" onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-bold text-slate-200">{w.name}</span>
                                                            <span className="text-sm font-black" style={{ color: col.color }}>{w.okr.totalScore}%</span>
                                                        </div>
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: w.rc.color + '22', color: w.rc.color }}>{w.rc.label}</span>
                                                        <div className="mt-2 space-y-1">
                                                            {w.okr.results.slice(0, 3).map(kr => (
                                                                <div key={kr.key} className="flex items-center gap-1.5">
                                                                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                                        <div className="h-full rounded-full" style={{ width: `${Math.min(kr.score, 100)}%`, backgroundColor: kr.score >= 100 ? '#10b981' : kr.score >= 75 ? '#f59e0b' : '#ef4444' }} />
                                                                    </div>
                                                                    <span className="text-[8px] text-slate-500 w-6 text-right">{kr.score}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                {colWorkers.length === 0 && <div className="text-center text-[10px] text-slate-600 py-6">No workers</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── VIEW: List (Table) ── */}
                        {okrView === 'list' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-400">
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase">Employee</th>
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase">Role</th>
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase text-center">Score</th>
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase text-center">Grade</th>
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase text-center">UPH</th>
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase text-center">KR1</th>
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase text-center">KR2</th>
                                            <th className="py-2 px-3 text-[10px] font-bold uppercase text-center">KR3</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allWorkerOkrs.sort((a, b) => b.okr.totalScore - a.okr.totalScore).map(w => (
                                            <tr key={w.username} className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer" onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}>
                                                <td className="py-2.5 px-3 text-slate-200 font-medium">{w.name}</td>
                                                <td className="py-2.5 px-3">
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: w.rc.color + '22', color: w.rc.color }}>{w.rc.label}</span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-bold" style={{ color: w.okr.grade.color }}>{w.okr.totalScore}%</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: w.okr.grade.bg, color: w.okr.grade.color }}>{w.okr.grade.grade}</span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center" style={{ color: getGaugeColor(w.uph) }}>{w.uph}</td>
                                                {w.okr.results.slice(0, 3).map(kr => (
                                                    <td key={kr.key} className="py-2.5 px-3 text-center">
                                                        <div className="text-[10px] font-bold" style={{ color: kr.score >= 100 ? '#10b981' : kr.score >= 75 ? '#f59e0b' : '#ef4444' }}>{kr.score}%</div>
                                                    </td>
                                                ))}
                                                {w.okr.results.length < 3 && Array.from({ length: 3 - w.okr.results.length }).map((_, i) => <td key={`e${i}`} className="py-2.5 px-3" />)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ─── REMAINING SECTIONS (only with real data) ─── */}
            {hasLogs && <>
            {/* ─── SECTION: TASK DIFFICULTY DISTRIBUTION ─── */}
            {tierDistribution && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" /> Task Difficulty Breakdown
                    </h3>

                    {/* Tier overview bar */}
                    <div className="mb-5">
                        <div className="flex h-8 rounded-lg overflow-hidden">
                            {[1, 2, 3, 4, 5].map(tier => {
                                const d = tierDistribution.dist[tier];
                                if (d.pct === 0) return null;
                                return (
                                    <div
                                        key={tier}
                                        className="flex items-center justify-center text-xs font-bold text-white transition-all"
                                        style={{ width: `${d.pct}%`, backgroundColor: TIER_CONFIG[tier].color, minWidth: d.pct > 0 ? '40px' : 0 }}
                                        title={`Tier ${tier}: ${TIER_CONFIG[tier].label} — ${d.count} orders (${d.pct}%)`}
                                    >
                                        {d.pct >= 8 && `${TIER_CONFIG[tier].icon} ${d.pct}%`}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-2">
                            {[1, 2, 3, 4, 5].map(tier => (
                                <div key={tier} className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <span>{TIER_CONFIG[tier].icon}</span>
                                    <span>{TIER_CONFIG[tier].label}</span>
                                    <span className="font-bold text-slate-300">({tierDistribution.dist[tier].count})</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Per-worker tier table */}
                    {tierDistribution.workerTiers.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="py-2 px-3 text-left">Employee</th>
                                        {[1, 2, 3, 4, 5].map(tier => (
                                            <th key={tier} className="py-2 px-2 text-center" title={TIER_CONFIG[tier].label}>
                                                {TIER_CONFIG[tier].icon}
                                            </th>
                                        ))}
                                        <th className="py-2 px-3 text-right">Weighted Score</th>
                                        <th className="py-2 px-3 text-left">Difficulty Profile</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tierDistribution.workerTiers
                                        .sort((a, b) => b.weightedTotal - a.weightedTotal)
                                        .map(w => {
                                            const totalTasks = Object.values(w.tiers).reduce((a, b) => a + b, 0);
                                            const avgTier = totalTasks > 0
                                                ? (Object.entries(w.tiers).reduce((s, [t, c]) => s + Number(t) * c, 0) / totalTasks).toFixed(1)
                                                : '0';
                                            // Mini bar showing tier distribution
                                            return (
                                                <tr key={w.username} onClick={() => onSelectWorker?.({ username: w.username, name: w.name })} className="border-b border-slate-800 cursor-pointer hover:bg-slate-800/50">
                                                    <td className="py-2.5 px-3 text-slate-200 font-medium">{w.name}</td>
                                                    {[1, 2, 3, 4, 5].map(tier => (
                                                        <td key={tier} className="py-2.5 px-2 text-center">
                                                            {w.tiers[tier] > 0 ? (
                                                                <span className="inline-block min-w-[24px] px-1 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: TIER_CONFIG[tier].color + '22', color: TIER_CONFIG[tier].color }}>
                                                                    {w.tiers[tier]}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-700">-</span>
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td className="py-2.5 px-3 text-right font-bold text-purple-400">{w.weightedTotal.toFixed(1)}</td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-3 w-24 rounded-full overflow-hidden bg-slate-800">
                                                                {[1, 2, 3, 4, 5].map(tier => {
                                                                    const pct = totalTasks > 0 ? (w.tiers[tier] / totalTasks) * 100 : 0;
                                                                    if (pct === 0) return null;
                                                                    return <div key={tier} style={{ width: `${pct}%`, backgroundColor: TIER_CONFIG[tier].color }} />;
                                                                })}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">avg {avgTier}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ─── SECTION 2: LIVE SPEED GAUGES ─── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" /> Live Worker Speed
                </h3>
                <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                    {workerStats.map(w => (
                        <SpeedGauge key={w.username} name={w.name} uph={w.uph} />
                    ))}
                </div>
            </div>

            {/* ─── SECTION 3: HOURLY THROUGHPUT ─── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" /> Hourly Throughput
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={hourlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                            labelStyle={{ color: '#94a3b8' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="Pick" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                        <Area type="monotone" dataKey="Pack" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                        <Area type="monotone" dataKey="Scan" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* ─── SECTION 4: TEAM LEADERBOARD ─── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" /> Team Leaderboard
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-700">
                                {[
                                    { key: 'rank', label: '#' },
                                    { key: 'name', label: 'Employee' },
                                    { key: 'pick', label: 'Pick' },
                                    { key: 'pack', label: 'Pack' },
                                    { key: 'scan', label: 'Scan' },
                                    { key: 'total', label: 'Total' },
                                    { key: 'uph', label: 'UPH' },
                                    { key: 'efficiency', label: 'Efficiency' },
                                    { key: 'trend', label: 'Trend' },
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        className="py-2 px-3 text-left cursor-pointer hover:text-slate-200 select-none whitespace-nowrap"
                                        onClick={() => col.key !== 'rank' && col.key !== 'trend' && handleSort(col.key)}
                                    >
                                        {col.label}<SortArrow col={col.key} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((w, i) => {
                                const rank = i + 1;
                                const medal = rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : rank === 3 ? '\u{1F949}' : `${rank}`;
                                const isTop = kpis.topPerformer && w.username === kpis.topPerformer.username;
                                const avgFromHistory = historicalData.length > 1
                                    ? Math.round(historicalData.slice(0, -1).reduce((a, d) => a + d.avgUph, 0) / (historicalData.length - 1))
                                    : 0;
                                const trendUp = w.uph >= avgFromHistory;

                                return (
                                    <tr key={w.username} onClick={() => onSelectWorker?.({ username: w.username, name: w.name })} className={`border-b border-slate-800 cursor-pointer ${isTop ? 'bg-amber-500/5' : 'hover:bg-slate-800/50'}`}>
                                        <td className="py-2.5 px-3 font-medium">{medal}</td>
                                        <td className="py-2.5 px-3 text-slate-200 font-medium">
                                            {w.name}
                                            {w.roleConfig && (
                                                <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: w.roleConfig.color + '22', color: w.roleConfig.color }}>
                                                    {w.roleConfig.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-blue-400">{w.pick}</td>
                                        <td className="py-2.5 px-3 text-emerald-400">{w.pack}</td>
                                        <td className="py-2.5 px-3 text-amber-400">{w.scan}</td>
                                        <td className="py-2.5 px-3 text-slate-200 font-bold">{w.total}</td>
                                        <td className="py-2.5 px-3 font-bold" style={{ color: getGaugeColor(w.uph) }}>{w.uph}</td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(w.efficiency, 100)}%`,
                                                            backgroundColor: getGaugeColor(w.uph),
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">{w.efficiency}%</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            {trendUp
                                                ? <TrendingUp className="w-4 h-4 text-emerald-400 inline" />
                                                : <TrendingDown className="w-4 h-4 text-red-400 inline" />}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── ROW: 7-DAY TREND + ACTION DISTRIBUTION ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SECTION 5: 7-DAY TREND */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-700 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" /> 7-Day Performance Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={historicalData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="avgUph" name="Avg UPH" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="totalUnits" name="Total Units" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="target" name="Target" stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 4" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* SECTION 7: ACTION DISTRIBUTION */}
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-400" /> Action Distribution
                    </h3>
                    {actionDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={actionDistribution}
                                    cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={85}
                                    paddingAngle={4}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {actionDistribution.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-60 text-slate-500 text-sm">No data</div>
                    )}
                </div>
            </div>

            {/* ─── SECTION 6: PERFORMANCE HEATMAP ─── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Performance Heatmap
                </h3>
                <div className="overflow-x-auto">
                    <div className="inline-grid gap-1" style={{ gridTemplateColumns: `60px repeat(${historicalData.length}, 32px)` }}>
                        {/* Header row */}
                        <div />
                        {historicalData.map(d => (
                            <div key={d.day} className="text-[10px] text-slate-500 text-center">{d.day}</div>
                        ))}
                        {/* Data rows */}
                        {heatmapData.map(row => (
                            <React.Fragment key={row.hour}>
                                <div className="text-[10px] text-slate-500 flex items-center">{`${row.hour.toString().padStart(2, '0')}:00`}</div>
                                {historicalData.map(d => (
                                    <HeatmapCell key={`${row.hour}-${d.day}`} value={row[d.day] || 0} maxValue={heatmapMax} />
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── SECTION 8: PERFORMANCE SUMMARY ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard icon={<Clock className="w-5 h-5 text-blue-400" />} label="Peak Hour" value={summaryStats.peakHour} />
                <SummaryCard icon={<Zap className="w-5 h-5 text-amber-400" />} label="Avg Time / Order" value={summaryStats.avgTimePerOrder} />
                <SummaryCard icon={<Award className="w-5 h-5 text-emerald-400" />} label="Best Day This Week" value={summaryStats.bestDay} />
                <SummaryCard icon={<Target className="w-5 h-5 text-purple-400" />} label="Quality Score" value={summaryStats.qualityScore} />
            </div>
            </>
            }
        </div>
    );
}

/* ─── Sub-components ─── */

function KpiCard({ icon, label, value, sub, accent = 'blue', trend }) {
    const accentMap = {
        blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: 'text-blue-400' },
        emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'text-emerald-400' },
        amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: 'text-amber-400' },
        red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: 'text-red-400' },
    };
    const a = accentMap[accent] || accentMap.blue;

    return (
        <div className={`${a.bg} border ${a.border} rounded-lg p-4 flex items-center gap-4`}>
            <div className={`p-2.5 rounded-lg bg-slate-800 ${a.icon}`}>{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <div className="flex items-baseline gap-2">
                    <p className={`text-2xl font-bold ${a.text} truncate`}>{value}</p>
                    {trend !== undefined && trend !== null && (
                        <span className={`text-xs font-medium flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {trend >= 0 ? '+' : ''}{trend}
                        </span>
                    )}
                </div>
                {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function SummaryCard({ icon, label, value }) {
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-lg font-bold text-slate-200">{value}</p>
            </div>
        </div>
    );
}
