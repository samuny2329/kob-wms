import React, { useMemo, useState } from 'react';
import { AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Zap, Users, Clock, Target, Award, Activity, Layers, LayoutGrid, List, Columns, Calendar, Download, ChevronUp, ChevronDown, Star, Medal, Flame } from 'lucide-react';
import { TIER_CONFIG, getTaskDistribution, calculateTaskDifficulty } from '../utils/taskScoring';
import { ROLE_KPI_CONFIG, computeOkrResults, getOkrGrade, SAMPLE_OKR_WORKERS } from '../constants';

const TARGET_UPH = 50;

function getGaugeColor(uph) {
    if (uph < 20) return 'var(--odoo-danger)';
    if (uph < 40) return 'var(--odoo-warning)';
    if (uph < 60) return 'var(--odoo-success)';
    return 'var(--odoo-purple)';
}

function getGaugeHex(uph) {
    if (uph < 20) return '#E46F78';
    if (uph < 40) return '#E8A940';
    if (uph < 60) return '#017E84';
    return '#714B67';
}

/* ─── Speed Gauge (sidebar widget) ─── */
function SpeedGauge({ name, uph, maxUph = 80 }) {
    const radius = 44;
    const stroke = 8;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(uph / maxUph, 1);
    const dashOffset = circumference * (1 - progress);
    const color = getGaugeHex(uph);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
            padding: '12px', borderRadius: '12px',
            backgroundColor: 'var(--odoo-surface-low)',
            border: '1px solid var(--odoo-border-ghost)',
        }}>
            <svg width={110} height={110} viewBox="0 0 110 110">
                <circle cx="55" cy="55" r={radius} fill="none" stroke="var(--odoo-surface-high)" strokeWidth={stroke} />
                <circle
                    cx="55" cy="55" r={radius} fill="none"
                    stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset}
                    transform="rotate(-90 55 55)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
                <text x="55" y="50" textAnchor="middle" fill={color} fontSize="22" fontWeight="800">{uph}</text>
                <text x="55" y="68" textAnchor="middle" fill="var(--odoo-text-muted)" fontSize="10" fontWeight="600">UPH</text>
            </svg>
            <span style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', fontWeight: 600, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{name}</span>
        </div>
    );
}

export default function TeamPerformance({ activityLogs, orders, users = [], t, onSelectWorker, workerOkrData = {} }) {
    const [sortCol, setSortCol] = useState('total');
    const [sortAsc, setSortAsc] = useState(false);
    const [okrView, setOkrView] = useState('kanban');
    const [dateRange, setDateRange] = useState('today');

    const today = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Username -> role lookup
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

        // Role-specific action sets for UPH
        const ROLE_ACTIONS = {
            picker: ['pick'], packer: ['pack', 'pack-handheld', 'pack-pos'],
            outbound: ['scan'], admin: ['pick', 'pack', 'pack-handheld', 'pack-pos', 'scan'],
            senior: ['pick', 'pack', 'pack-handheld', 'pack-pos', 'scan'],
        };

        return Object.values(stats).map(s => {
            s.role = userRoleMap[s.username] || 'admin';
            s.roleConfig = ROLE_KPI_CONFIG[s.role] || ROLE_KPI_CONFIG.admin;
            const targetForRole = s.roleConfig.targetUPH || TARGET_UPH;

            const roleActions = ROLE_ACTIONS[s.role] || ROLE_ACTIONS.admin;
            const roleCount = todayLogs.filter(l => l.username === s.username && roleActions.includes(l.action)).length;
            let hours = (s.lastAction - s.firstAction) / 3600000;
            if (hours < 0.1) hours = 0.1;
            s.uph = Math.round(roleCount / hours);
            s.efficiency = Math.round((s.uph / targetForRole) * 100);

            if (workerOkrData[s.username]?.okrToday) {
                s.sharedOkr = workerOkrData[s.username].okrToday;
            }
            return s;
        });
    }, [todayLogs, userRoleMap]);

    // Historical stats for trend (past 7 days)
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
            { name: 'Pick', value: pick, color: '#714B67' },
            { name: 'Pack', value: pack, color: '#017E84' },
            { name: 'Scan', value: scan, color: '#E8A940' },
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

    // Summary stats
    const summaryStats = useMemo(() => {
        let peakHour = '--';
        let peakCount = 0;
        hourlyData.forEach(h => {
            const total = h.Pick + h.Pack + h.Scan;
            if (total > peakCount) { peakCount = total; peakHour = h.hour; }
        });

        const totalOrders = orders?.length || 0;
        const totalActions = todayLogs.length;
        const avgTimePerOrder = totalOrders > 0 && totalActions > 0
            ? `${Math.round((totalActions / totalOrders) * 2.5)}min`
            : '--';

        const bestDay = historicalData.reduce((best, d) => d.totalUnits > (best?.totalUnits || 0) ? d : best, null);

        return {
            peakHour: peakCount > 0 ? `${peakHour} (${peakCount})` : '--',
            avgTimePerOrder,
            bestDay: bestDay && bestDay.totalUnits > 0 ? `${bestDay.day} (${bestDay.totalUnits})` : '--',
            qualityScore: '98.5%',
        };
    }, [hourlyData, orders, todayLogs, historicalData]);

    // Task difficulty distribution
    const tierDistribution = useMemo(() => {
        if (!orders?.length) return null;
        const dist = getTaskDistribution(orders);
        const total = orders.length;

        const workerTiers = {};
        todayLogs.forEach(log => {
            const key = log.username || 'unknown';
            if (!workerTiers[key]) workerTiers[key] = { name: log.name || key, username: key, tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, weightedTotal: 0 };
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

    const hasLogs = todayLogs.length > 0;

    // Export CSV handler
    const handleExportCSV = () => {
        const headers = ['Rank', 'Member', 'Role', 'Pick', 'Pack', 'Scan', 'Total', 'UPH', 'Efficiency'];
        const rows = leaderboard.map((w, i) => [
            i + 1, w.name, w.roleConfig?.label || w.role, w.pick, w.pack, w.scan, w.total, w.uph, `${w.efficiency}%`
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team-performance-${today}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Recharts tooltip style
    const tooltipStyle = {
        backgroundColor: 'var(--odoo-surface)',
        border: '1px solid var(--odoo-border)',
        borderRadius: '8px',
        color: 'var(--odoo-text)',
        boxShadow: '0 4px 12px rgba(113,75,103,0.08)',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ─── HEADER: Title + Date Range + Export ─── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                padding: '20px 24px', borderRadius: '12px',
                backgroundColor: 'var(--odoo-surface)',
                border: '1px solid var(--odoo-border-ghost)',
            }}>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--odoo-text)', margin: 0, letterSpacing: '-0.02em' }}>
                        Team Performance
                    </h1>
                    <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', marginTop: '2px' }}>
                        Monitor productivity, UPH, and team efficiency in real-time
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px', borderRadius: '8px',
                        backgroundColor: 'var(--odoo-surface-low)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        {['today', '7d', '30d'].map(range => (
                            <button key={range} onClick={() => setDateRange(range)} style={{
                                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                                backgroundColor: dateRange === range ? 'var(--odoo-purple)' : 'transparent',
                                color: dateRange === range ? '#fff' : 'var(--odoo-text-secondary)',
                            }}>
                                {range === 'today' ? 'Today' : range === '7d' ? '7 Days' : '30 Days'}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleExportCSV} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--odoo-border)',
                        backgroundColor: 'var(--odoo-surface)', cursor: 'pointer',
                        fontSize: '12px', fontWeight: 600, color: 'var(--odoo-text-secondary)',
                        transition: 'all 0.2s',
                    }}>
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ─── KPI STRIP (4 cards) ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <KpiCard
                    icon={<Activity className="w-5 h-5" />}
                    label="Total Tasks Today"
                    value={kpis.totalUnits}
                    color="var(--odoo-purple)"
                    bgColor="rgba(113,75,103,0.08)"
                />
                <KpiCard
                    icon={<Zap className="w-5 h-5" />}
                    label="Average UPH"
                    value={kpis.avgUph}
                    trend={kpis.uphTrend}
                    color="var(--odoo-success)"
                    bgColor="rgba(1,126,132,0.08)"
                />
                <KpiCard
                    icon={<Trophy className="w-5 h-5" />}
                    label="Top Performer"
                    value={kpis.topPerformer?.name || '--'}
                    sub={kpis.topPerformer ? `${kpis.topPerformer.uph} UPH` : ''}
                    color="var(--odoo-warning)"
                    bgColor="rgba(232,169,64,0.08)"
                />
                <KpiCard
                    icon={<Target className="w-5 h-5" />}
                    label="Efficiency Rate"
                    value={`${kpis.teamEfficiency}%`}
                    sub={`Target: ${TARGET_UPH} UPH`}
                    color={kpis.teamEfficiency >= 80 ? 'var(--odoo-success)' : kpis.teamEfficiency >= 50 ? 'var(--odoo-warning)' : 'var(--odoo-danger)'}
                    bgColor={kpis.teamEfficiency >= 80 ? 'rgba(1,126,132,0.08)' : kpis.teamEfficiency >= 50 ? 'rgba(232,169,64,0.08)' : 'rgba(228,111,120,0.08)'}
                />
            </div>

            {/* ─── MAIN GRID: 8-col Table + 4-col Sidebar ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }} className="lg:!grid-cols-[2fr_1fr]">

                {/* LEFT: Performance Table */}
                <div style={{
                    borderRadius: '12px', overflow: 'hidden',
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                }}>
                    {/* Table header */}
                    <div style={{
                        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid var(--odoo-border-ghost)',
                        backgroundColor: 'var(--odoo-surface-low)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))', color: '#fff',
                            }}>
                                <Award className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Team Leaderboard</h3>
                                <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', margin: 0 }}>{workerStats.length} active members today</p>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                    {[
                                        { key: 'rank', label: 'Rank', sortable: false },
                                        { key: 'name', label: 'Member', sortable: true },
                                        { key: 'role', label: 'Role', sortable: false },
                                        { key: 'pick', label: 'Pick', sortable: true },
                                        { key: 'pack', label: 'Pack', sortable: true },
                                        { key: 'scan', label: 'Scan', sortable: true },
                                        { key: 'total', label: 'Total', sortable: true },
                                        { key: 'uph', label: 'UPH', sortable: true },
                                        { key: 'trend', label: 'Trend', sortable: false },
                                    ].map(col => (
                                        <th
                                            key={col.key}
                                            onClick={() => col.sortable && handleSort(col.key)}
                                            style={{
                                                padding: '10px 14px', textAlign: col.key === 'rank' || col.key === 'trend' ? 'center' : 'left',
                                                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                color: 'var(--odoo-text-muted)', whiteSpace: 'nowrap',
                                                cursor: col.sortable ? 'pointer' : 'default',
                                                userSelect: 'none',
                                            }}
                                        >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                                {col.label}
                                                {sortCol === col.key && (
                                                    sortAsc
                                                        ? <ChevronUp style={{ width: '12px', height: '12px' }} />
                                                        : <ChevronDown style={{ width: '12px', height: '12px' }} />
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.length === 0 && (
                                    <tr>
                                        <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--odoo-text-muted)', fontSize: '13px' }}>
                                            No activity data yet. Performance data will appear as team members complete tasks.
                                        </td>
                                    </tr>
                                )}
                                {leaderboard.map((w, i) => {
                                    const rank = i + 1;
                                    const isTop = kpis.topPerformer && w.username === kpis.topPerformer.username;
                                    const avgFromHistory = historicalData.length > 1
                                        ? Math.round(historicalData.slice(0, -1).reduce((a, d) => a + d.avgUph, 0) / (historicalData.length - 1))
                                        : 0;
                                    const trendUp = w.uph >= avgFromHistory;

                                    return (
                                        <tr
                                            key={w.username}
                                            onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}
                                            style={{
                                                borderBottom: '1px solid var(--odoo-border-ghost)',
                                                cursor: 'pointer',
                                                backgroundColor: isTop ? 'rgba(232,169,64,0.04)' : 'transparent',
                                                transition: 'background-color 0.15s',
                                            }}
                                            onMouseEnter={e => { if (!isTop) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { if (!isTop) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>
                                                {rank <= 3 ? (
                                                    <span style={{
                                                        display: 'inline-flex', width: '26px', height: '26px', borderRadius: '50%',
                                                        alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800,
                                                        backgroundColor: rank === 1 ? 'rgba(232,169,64,0.15)' : rank === 2 ? 'rgba(113,75,103,0.10)' : 'rgba(1,126,132,0.10)',
                                                        color: rank === 1 ? 'var(--odoo-warning)' : rank === 2 ? 'var(--odoo-purple)' : 'var(--odoo-success)',
                                                    }}>
                                                        {rank}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--odoo-text-muted)' }}>{rank}</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '12px', fontWeight: 700, color: '#fff',
                                                        backgroundColor: w.roleConfig?.color || 'var(--odoo-purple)',
                                                    }}>
                                                        {w.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: 600, color: 'var(--odoo-text)' }}>{w.name}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                                                    backgroundColor: (w.roleConfig?.color || '#714B67') + '15',
                                                    color: w.roleConfig?.color || 'var(--odoo-purple)',
                                                }}>
                                                    {w.roleConfig?.label || w.role}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', color: 'var(--odoo-purple)', fontWeight: 600 }}>{w.pick}</td>
                                            <td style={{ padding: '12px 14px', color: 'var(--odoo-success)', fontWeight: 600 }}>{w.pack}</td>
                                            <td style={{ padding: '12px 14px', color: 'var(--odoo-warning)', fontWeight: 600 }}>{w.scan}</td>
                                            <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--odoo-text)' }}>{w.total}</td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '56px', height: '6px', borderRadius: '3px', overflow: 'hidden',
                                                        backgroundColor: 'var(--odoo-surface-high)',
                                                    }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: '3px', transition: 'width 0.5s',
                                                            width: `${Math.min(w.efficiency, 100)}%`,
                                                            backgroundColor: getGaugeHex(w.uph),
                                                        }} />
                                                    </div>
                                                    <span style={{ fontWeight: 800, color: getGaugeColor(w.uph), fontSize: '13px' }}>{w.uph}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                {trendUp
                                                    ? <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--odoo-success)', display: 'inline' }} />
                                                    : <TrendingDown style={{ width: '16px', height: '16px', color: 'var(--odoo-danger)', display: 'inline' }} />
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT: Sidebar (Speed Gauge + Hourly Chart + Badges) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Speed Gauges */}
                    <div style={{
                        borderRadius: '12px', padding: '16px',
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <Users className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>Live Speed</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                            {workerStats.length > 0 ? (
                                workerStats.slice(0, 4).map(w => (
                                    <SpeedGauge key={w.username} name={w.name} uph={w.uph} />
                                ))
                            ) : (
                                <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', padding: '20px 0', textAlign: 'center', width: '100%' }}>
                                    No active workers
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Hourly Throughput mini chart */}
                    <div style={{
                        borderRadius: '12px', padding: '16px',
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <Clock className="w-4 h-4" style={{ color: 'var(--odoo-success)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>Hourly Throughput</span>
                        </div>
                        {hourlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--odoo-border-ghost)" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--odoo-text-muted)' }} stroke="var(--odoo-border-ghost)" />
                                    <YAxis tick={{ fontSize: 9, fill: 'var(--odoo-text-muted)' }} stroke="var(--odoo-border-ghost)" />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Area type="monotone" dataKey="Pick" stackId="1" stroke="#714B67" fill="#714B67" fillOpacity={0.3} />
                                    <Area type="monotone" dataKey="Pack" stackId="1" stroke="#017E84" fill="#017E84" fillOpacity={0.3} />
                                    <Area type="monotone" dataKey="Scan" stackId="1" stroke="#E8A940" fill="#E8A940" fillOpacity={0.3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--odoo-text-muted)', fontSize: '12px' }}>
                                No hourly data yet
                            </div>
                        )}
                    </div>

                    {/* Badges / Action Distribution */}
                    <div style={{
                        borderRadius: '12px', padding: '16px',
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <Target className="w-4 h-4" style={{ color: 'var(--odoo-warning)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>Action Mix</span>
                        </div>
                        {actionDistribution.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={160}>
                                    <PieChart>
                                        <Pie
                                            data={actionDistribution}
                                            cx="50%" cy="50%"
                                            innerRadius={40} outerRadius={65}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {actionDistribution.map((entry, idx) => (
                                                <Cell key={idx} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={tooltipStyle} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
                                    {actionDistribution.map(d => (
                                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: d.color }} />
                                            <span style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', fontWeight: 600 }}>{d.name}</span>
                                            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--odoo-text)' }}>{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--odoo-text-muted)', fontSize: '12px' }}>
                                No data
                            </div>
                        )}
                    </div>

                    {/* Performance Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <MiniStat icon={<Clock className="w-4 h-4" />} label="Peak Hour" value={summaryStats.peakHour} color="var(--odoo-purple)" />
                        <MiniStat icon={<Zap className="w-4 h-4" />} label="Avg / Order" value={summaryStats.avgTimePerOrder} color="var(--odoo-warning)" />
                        <MiniStat icon={<Award className="w-4 h-4" />} label="Best Day" value={summaryStats.bestDay} color="var(--odoo-success)" />
                        <MiniStat icon={<Target className="w-4 h-4" />} label="Quality" value={summaryStats.qualityScore} color="var(--odoo-purple)" />
                    </div>
                </div>
            </div>

            {/* ─── OKR SCORECARD ─── */}
            {(() => {
                const displayWorkers = workerStats.length > 0
                    ? workerStats.map(w => ({ ...w, role: w.role || 'admin' }))
                    : [];
                const roles = ['picker', 'packer', 'outbound', 'accounting'];

                const allWorkerOkrs = displayWorkers.map(w => {
                    const wLogs = workerStats.length > 0 ? todayLogs.filter(l => l.username === w.username) : [];
                    const okr = computeOkrResults(w.role, wLogs, orders || []);
                    const rc = ROLE_KPI_CONFIG[w.role] || ROLE_KPI_CONFIG.admin;
                    return { ...w, okr, rc };
                });

                const ViewBtn = ({ mode, icon, label }) => (
                    <button onClick={() => setOkrView(mode)} title={label} style={{
                        padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                        backgroundColor: okrView === mode ? 'var(--odoo-purple)' : 'transparent',
                        color: okrView === mode ? '#fff' : 'var(--odoo-text-muted)',
                        display: 'flex', alignItems: 'center',
                    }}>
                        {icon}
                    </button>
                );

                return (
                    <div style={{
                        borderRadius: '12px', padding: '20px',
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        {/* Header with view switcher */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))', color: '#fff',
                                }}>
                                    <Target className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>OKR Scorecard</h3>
                                    <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', margin: 0 }}>Objectives & Key Results -- role-based performance</p>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '2px', padding: '3px',
                                borderRadius: '8px', backgroundColor: 'var(--odoo-surface-low)',
                                border: '1px solid var(--odoo-border-ghost)',
                            }}>
                                <ViewBtn mode="scorecard" icon={<Columns className="w-3.5 h-3.5" />} label="Scorecard" />
                                <ViewBtn mode="kanban" icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Kanban" />
                                <ViewBtn mode="list" icon={<List className="w-3.5 h-3.5" />} label="List" />
                            </div>
                        </div>

                        {/* VIEW: Scorecard */}
                        {okrView === 'scorecard' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                                {roles.map(roleKey => {
                                    const rc = ROLE_KPI_CONFIG[roleKey];
                                    if (!rc?.keyResults) return null;
                                    const roleWorkers = allWorkerOkrs.filter(w => w.role === roleKey);
                                    if (roleWorkers.length === 0) return null;
                                    const roleLogs = workerStats.length > 0 ? todayLogs.filter(l => roleWorkers.some(w => w.username === l.username)) : [];
                                    const teamOkr = computeOkrResults(roleKey, roleLogs, orders || []);
                                    return (
                                        <div key={roleKey} style={{
                                            borderRadius: '10px', overflow: 'hidden',
                                            backgroundColor: 'var(--odoo-surface-low)',
                                            border: '1px solid var(--odoo-border-ghost)',
                                            display: 'flex', flexDirection: 'column',
                                        }}>
                                            {/* Role header */}
                                            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: `2px solid ${rc.color}22` }}>
                                                <span style={{
                                                    width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '14px', fontWeight: 900, backgroundColor: rc.color + '15', color: rc.color,
                                                }}>
                                                    {rc.label.charAt(0)}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: rc.color }}>{rc.label}</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <span style={{ fontSize: '22px', fontWeight: 900, color: teamOkr.grade.color }}>{teamOkr.totalScore}%</span>
                                                    <div style={{
                                                        fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', marginTop: '2px',
                                                        backgroundColor: teamOkr.grade.bg, color: teamOkr.grade.color,
                                                    }}>{teamOkr.grade.grade}</div>
                                                </div>
                                            </div>

                                            {/* KR bars */}
                                            <div style={{ padding: '10px 14px', flex: 1 }}>
                                                {teamOkr.results.slice(0, 5).map(kr => {
                                                    const barColor = kr.score >= 100 ? 'var(--odoo-success)' : kr.score >= 75 ? 'var(--odoo-warning)' : 'var(--odoo-danger)';
                                                    return (
                                                        <div key={kr.key} style={{ marginBottom: '8px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                                                                <span style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)' }}>{kr.label}</span>
                                                                <span style={{ fontSize: '10px', fontWeight: 700, color: barColor }}>{kr.score}%</span>
                                                            </div>
                                                            <div style={{ height: '4px', backgroundColor: 'var(--odoo-surface-high)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(kr.score, 100)}%`, backgroundColor: barColor, transition: 'width 0.5s' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Workers */}
                                            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface)' }}>
                                                {roleWorkers.map(w => (
                                                    <div key={w.username}
                                                        onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            padding: '5px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.15s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{
                                                                width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '9px', fontWeight: 700, color: '#fff', backgroundColor: rc.color,
                                                            }}>{w.name?.charAt(0)}</span>
                                                            <span style={{ fontSize: '11px', color: 'var(--odoo-text)' }}>{w.name}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontSize: '10px', fontWeight: 800, color: getGaugeColor(w.uph) }}>{w.uph}</span>
                                                            <span style={{
                                                                fontSize: '8px', fontWeight: 700, padding: '2px 4px', borderRadius: '3px',
                                                                backgroundColor: w.okr.grade.bg, color: w.okr.grade.color,
                                                            }}>{w.okr.grade.grade}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* VIEW: Kanban */}
                        {okrView === 'kanban' && (
                            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', minHeight: '200px' }}>
                                {[
                                    { grade: 'S', label: 'Outstanding', color: '#7c3aed', bg: '#ede9fe' },
                                    { grade: 'A', label: 'Excellent', color: '#059669', bg: '#d1fae5' },
                                    { grade: 'B', label: 'Good', color: '#2563eb', bg: '#dbeafe' },
                                    { grade: 'C', label: 'Needs Improvement', color: '#d97706', bg: '#fef3c7' },
                                    { grade: 'D', label: 'Below Standard', color: '#dc2626', bg: '#fee2e2' },
                                ].map(col => {
                                    const colWorkers = allWorkerOkrs.filter(w => w.okr.grade.grade === col.grade);
                                    return (
                                        <div key={col.grade} style={{
                                            flex: 1, minWidth: '180px',
                                            backgroundColor: 'var(--odoo-surface-low)', borderRadius: '10px',
                                            border: '1px solid var(--odoo-border-ghost)',
                                            display: 'flex', flexDirection: 'column',
                                        }}>
                                            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--odoo-border-ghost)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 900, color: col.color }}>{col.grade}</span>
                                                <span style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', flex: 1 }}>{col.label}</span>
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                                                    backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-muted)',
                                                }}>{colWorkers.length}</span>
                                            </div>
                                            <div style={{ flex: 1, padding: '8px', overflowY: 'auto', maxHeight: '400px' }}>
                                                {colWorkers.map(w => (
                                                    <div key={w.username}
                                                        onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}
                                                        style={{
                                                            backgroundColor: 'var(--odoo-surface)', borderRadius: '8px',
                                                            padding: '12px', marginBottom: '8px',
                                                            border: '1px solid var(--odoo-border-ghost)',
                                                            cursor: 'pointer', transition: 'border-color 0.15s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--odoo-border)'}
                                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--odoo-border-ghost)'}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>{w.name}</span>
                                                            <span style={{ fontSize: '14px', fontWeight: 900, color: col.color }}>{w.okr.totalScore}%</span>
                                                        </div>
                                                        <span style={{
                                                            fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                                            backgroundColor: w.rc.color + '15', color: w.rc.color,
                                                        }}>{w.rc.label}</span>
                                                        <div style={{ marginTop: '8px' }}>
                                                            {w.okr.results.slice(0, 3).map(kr => (
                                                                <div key={kr.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                                    <div style={{ flex: 1, height: '3px', backgroundColor: 'var(--odoo-surface-high)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                        <div style={{
                                                                            height: '100%', borderRadius: '2px', transition: 'width 0.5s',
                                                                            width: `${Math.min(kr.score, 100)}%`,
                                                                            backgroundColor: kr.score >= 100 ? '#017E84' : kr.score >= 75 ? '#E8A940' : '#E46F78',
                                                                        }} />
                                                                    </div>
                                                                    <span style={{ fontSize: '8px', color: 'var(--odoo-text-muted)', width: '24px', textAlign: 'right' }}>{kr.score}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                {colWorkers.length === 0 && (
                                                    <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--odoo-text-muted)', padding: '24px 0' }}>No workers</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* VIEW: List */}
                        {okrView === 'list' && (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                            {['Employee', 'Role', 'Score', 'Grade', 'UPH', 'KR1', 'KR2', 'KR3'].map(h => (
                                                <th key={h} style={{
                                                    padding: '10px 14px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                                                    letterSpacing: '0.06em', color: 'var(--odoo-text-muted)',
                                                    textAlign: ['Score', 'Grade', 'UPH', 'KR1', 'KR2', 'KR3'].includes(h) ? 'center' : 'left',
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allWorkerOkrs.sort((a, b) => b.okr.totalScore - a.okr.totalScore).map(w => (
                                            <tr key={w.username}
                                                onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}
                                                style={{ borderBottom: '1px solid var(--odoo-border-ghost)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--odoo-text)' }}>{w.name}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{
                                                        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                                        backgroundColor: w.rc.color + '15', color: w.rc.color,
                                                    }}>{w.rc.label}</span>
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: w.okr.grade.color }}>{w.okr.totalScore}%</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                    <span style={{
                                                        fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                                                        backgroundColor: w.okr.grade.bg, color: w.okr.grade.color,
                                                    }}>{w.okr.grade.grade}</span>
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: getGaugeColor(w.uph) }}>{w.uph}</td>
                                                {w.okr.results.slice(0, 3).map(kr => (
                                                    <td key={kr.key} style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                        <span style={{
                                                            fontSize: '11px', fontWeight: 700,
                                                            color: kr.score >= 100 ? 'var(--odoo-success)' : kr.score >= 75 ? 'var(--odoo-warning)' : 'var(--odoo-danger)',
                                                        }}>{kr.score}%</span>
                                                    </td>
                                                ))}
                                                {w.okr.results.length < 3 && Array.from({ length: 3 - w.okr.results.length }).map((_, i) => <td key={`e${i}`} style={{ padding: '10px 14px' }} />)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ─── TASK DIFFICULTY DISTRIBUTION ─── */}
            {hasLogs && tierDistribution && (
                <div style={{
                    borderRadius: '12px', padding: '20px',
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))', color: '#fff',
                        }}>
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Task Difficulty Breakdown</h3>
                            <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', margin: 0 }}>{tierDistribution.total} total orders analyzed</p>
                        </div>
                    </div>

                    {/* Tier overview bar */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', height: '32px', borderRadius: '8px', overflow: 'hidden' }}>
                            {[1, 2, 3, 4, 5].map(tier => {
                                const d = tierDistribution.dist[tier];
                                if (d.pct === 0) return null;
                                return (
                                    <div
                                        key={tier}
                                        title={`Tier ${tier}: ${TIER_CONFIG[tier].label} -- ${d.count} orders (${d.pct}%)`}
                                        style={{
                                            width: `${d.pct}%`, minWidth: d.pct > 0 ? '40px' : 0,
                                            backgroundColor: TIER_CONFIG[tier].color, transition: 'all 0.3s',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '12px', fontWeight: 700, color: '#fff',
                                        }}
                                    >
                                        {d.pct >= 8 && `${TIER_CONFIG[tier].icon} ${d.pct}%`}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                            {[1, 2, 3, 4, 5].map(tier => (
                                <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--odoo-text-muted)' }}>
                                    <span>{TIER_CONFIG[tier].icon}</span>
                                    <span>{TIER_CONFIG[tier].label}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--odoo-text-secondary)' }}>({tierDistribution.dist[tier].count})</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Per-worker tier table */}
                    {tierDistribution.workerTiers.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--odoo-text-muted)' }}>Employee</th>
                                        {[1, 2, 3, 4, 5].map(tier => (
                                            <th key={tier} style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px' }} title={TIER_CONFIG[tier].label}>
                                                {TIER_CONFIG[tier].icon}
                                            </th>
                                        ))}
                                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--odoo-text-muted)' }}>Weighted</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--odoo-text-muted)' }}>Profile</th>
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
                                            return (
                                                <tr key={w.username}
                                                    onClick={() => onSelectWorker?.({ username: w.username, name: w.name })}
                                                    style={{ borderBottom: '1px solid var(--odoo-border-ghost)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--odoo-text)' }}>{w.name}</td>
                                                    {[1, 2, 3, 4, 5].map(tier => (
                                                        <td key={tier} style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                            {w.tiers[tier] > 0 ? (
                                                                <span style={{
                                                                    display: 'inline-block', minWidth: '24px', padding: '2px 4px',
                                                                    borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                                                                    backgroundColor: TIER_CONFIG[tier].color + '15', color: TIER_CONFIG[tier].color,
                                                                }}>
                                                                    {w.tiers[tier]}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--odoo-surface-high)' }}>-</span>
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--odoo-purple)' }}>{w.weightedTotal.toFixed(1)}</td>
                                                    <td style={{ padding: '10px 14px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ display: 'flex', height: '10px', width: '96px', borderRadius: '5px', overflow: 'hidden', backgroundColor: 'var(--odoo-surface-high)' }}>
                                                                {[1, 2, 3, 4, 5].map(tier => {
                                                                    const pct = totalTasks > 0 ? (w.tiers[tier] / totalTasks) * 100 : 0;
                                                                    if (pct === 0) return null;
                                                                    return <div key={tier} style={{ width: `${pct}%`, backgroundColor: TIER_CONFIG[tier].color }} />;
                                                                })}
                                                            </div>
                                                            <span style={{ fontSize: '10px', color: 'var(--odoo-text-muted)' }}>avg {avgTier}</span>
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

            {/* ─── 7-DAY TREND + HEATMAP ─── */}
            {hasLogs && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }} className="lg:!grid-cols-[2fr_1fr]">

                    {/* 7-Day Performance Trend */}
                    <div style={{
                        borderRadius: '12px', padding: '20px',
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))', color: '#fff',
                            }}>
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>7-Day Performance Trend</h3>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', margin: 0 }}>Average UPH vs daily target</p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={historicalData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--odoo-border-ghost)" />
                                <XAxis dataKey="day" stroke="var(--odoo-text-muted)" tick={{ fontSize: 11 }} />
                                <YAxis stroke="var(--odoo-text-muted)" tick={{ fontSize: 11 }} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend />
                                <Line type="monotone" dataKey="avgUph" name="Avg UPH" stroke="#714B67" strokeWidth={2} dot={{ r: 4, fill: '#714B67' }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="totalUnits" name="Total Units" stroke="#017E84" strokeWidth={2} dot={{ r: 4, fill: '#017E84' }} />
                                <Line type="monotone" dataKey="target" name="Target" stroke="#E8A940" strokeWidth={2} strokeDasharray="8 4" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Performance Heatmap */}
                    <div style={{
                        borderRadius: '12px', padding: '20px',
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))', color: '#fff',
                            }}>
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)', margin: 0 }}>Activity Heatmap</h3>
                                <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', margin: 0 }}>Hourly activity distribution</p>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <div style={{
                                display: 'inline-grid', gap: '3px',
                                gridTemplateColumns: `52px repeat(${historicalData.length}, 30px)`,
                            }}>
                                {/* Header row */}
                                <div />
                                {historicalData.map(d => (
                                    <div key={d.day} style={{ fontSize: '9px', color: 'var(--odoo-text-muted)', textAlign: 'center', fontWeight: 600 }}>{d.day}</div>
                                ))}
                                {/* Data rows */}
                                {heatmapData.map(row => (
                                    <React.Fragment key={row.hour}>
                                        <div style={{ fontSize: '9px', color: 'var(--odoo-text-muted)', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                                            {`${row.hour.toString().padStart(2, '0')}:00`}
                                        </div>
                                        {historicalData.map(d => {
                                            const value = row[d.day] || 0;
                                            const intensity = heatmapMax > 0 ? value / heatmapMax : 0;
                                            const bgColor = intensity === 0
                                                ? 'var(--odoo-surface-low)'
                                                : intensity < 0.25 ? 'rgba(1,126,132,0.15)'
                                                : intensity < 0.5 ? 'rgba(1,126,132,0.30)'
                                                : intensity < 0.75 ? 'rgba(1,126,132,0.50)'
                                                : 'rgba(1,126,132,0.70)';
                                            return (
                                                <div
                                                    key={`${row.hour}-${d.day}`}
                                                    title={`${value} actions`}
                                                    style={{
                                                        width: '30px', height: '24px', borderRadius: '4px',
                                                        backgroundColor: bgColor,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'background-color 0.2s',
                                                    }}
                                                >
                                                    {value > 0 && <span style={{ fontSize: '8px', color: intensity > 0.5 ? '#fff' : 'var(--odoo-text-muted)', fontWeight: 600 }}>{value}</span>}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Sub-components ─── */

function KpiCard({ icon, label, value, sub, trend, color, bgColor }) {
    return (
        <div style={{
            borderRadius: '12px', padding: '18px 20px',
            backgroundColor: 'var(--odoo-surface)',
            border: '1px solid var(--odoo-border-ghost)',
            display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'box-shadow 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(113,75,103,0.08)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
            <div style={{
                width: '44px', height: '44px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: bgColor, color: color,
            }}>
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--odoo-text-muted)', margin: 0 }}>
                    {label}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <p style={{
                        fontSize: '24px', fontWeight: 800, color: color, margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {value}
                    </p>
                    {trend !== undefined && trend !== null && (
                        <span style={{
                            fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px',
                            color: trend >= 0 ? 'var(--odoo-success)' : 'var(--odoo-danger)',
                        }}>
                            {trend >= 0 ? <TrendingUp style={{ width: '12px', height: '12px' }} /> : <TrendingDown style={{ width: '12px', height: '12px' }} />}
                            {trend >= 0 ? '+' : ''}{trend}
                        </span>
                    )}
                </div>
                {sub && <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', margin: '2px 0 0 0' }}>{sub}</p>}
            </div>
        </div>
    );
}

function MiniStat({ icon, label, value, color }) {
    return (
        <div style={{
            borderRadius: '10px', padding: '12px',
            backgroundColor: 'var(--odoo-surface)',
            border: '1px solid var(--odoo-border-ghost)',
            display: 'flex', alignItems: 'center', gap: '10px',
        }}>
            <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--odoo-surface-low)', color: color,
            }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--odoo-text-muted)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--odoo-text)', margin: 0 }}>{value}</p>
            </div>
        </div>
    );
}
