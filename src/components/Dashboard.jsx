import React, { useMemo } from 'react';
import { Package, CheckCircle2, Clock, TrendingUp, Box, AlertTriangle, PieChart as PieChartIcon, Target, ShoppingCart, PackageCheck, Truck, ScanLine, Warehouse, Layers, Receipt, Award, Zap, Activity } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const Dashboard = ({ t, totalExpected, totalScanned, uph, dailyBoxUsage, totalDelayed, courierDistributionData, progressPercent, delayedOrdersData, userRole, activityLogs, isDarkMode, salesOrders = [], inventory = null, waves = [], invoices = [], user }) => {
    const isWorker = ['picker', 'packer', 'outbound'].includes(userRole);

    const kpiPerformanceData = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = activityLogs.filter(log => {
            if (!log.timestamp) return false;
            return new Date(log.timestamp).toISOString().split('T')[0] === today;
        });

        const stats = {};
        todayLogs.forEach(log => {
            if (!stats[log.username]) {
                stats[log.username] = {
                    name: log.name, username: log.username,
                    pick: 0, pack: 0, scan: 0, total: 0,
                    firstAction: log.timestamp, lastAction: log.timestamp
                };
            }
            if (log.action === 'pick') stats[log.username].pick++;
            if (log.action === 'pack') stats[log.username].pack++;
            if (log.action === 'scan') stats[log.username].scan++;
            stats[log.username].total++;

            if (log.timestamp < stats[log.username].firstAction) stats[log.username].firstAction = log.timestamp;
            if (log.timestamp > stats[log.username].lastAction) stats[log.username].lastAction = log.timestamp;
        });

        const result = Object.values(stats).map(stat => {
            let hours = (stat.lastAction - stat.firstAction) / 3600000;
            if (hours < 0.016) hours = 0.016;
            stat.uph = Math.round(stat.total / hours);
            return stat;
        }).sort((a, b) => b.total - a.total);

        // No mock data — return empty when no real activity
        return result;
    }, [activityLogs]);

    // My Performance (for worker roles)
    const myPerf = useMemo(() => {
        if (!isWorker || !user?.username) return null;
        const today = new Date().toISOString().split('T')[0];
        const myLogs = activityLogs.filter(l => l.username === user.username && new Date(l.timestamp).toISOString().split('T')[0] === today);
        const pick = myLogs.filter(l => l.action === 'pick').length;
        const pack = myLogs.filter(l => l.action === 'pack' || l.action === 'box-handheld' || l.action === 'box-pos').length;
        const scan = myLogs.filter(l => l.action === 'scan').length;
        const count = myLogs.filter(l => l.action === 'count' || l.action === 'cycle-count').length;
        const total = pick + pack + scan;
        const firstLog = myLogs.length > 0 ? Math.min(...myLogs.map(l => l.timestamp)) : null;
        const lastLog = myLogs.length > 0 ? Math.max(...myLogs.map(l => l.timestamp)) : null;
        let hours = firstLog && lastLog ? (lastLog - firstLog) / 3600000 : 0;
        if (hours < 0.016) hours = 0.016;
        const myUph = total > 0 ? Math.round(total / hours) : 0;
        const target = userRole === 'picker' ? 60 : userRole === 'packer' ? 45 : 55;
        const uphPct = Math.min(Math.round((myUph / target) * 100), 100);
        // Rank among peers
        const allWorkers = kpiPerformanceData || [];
        const myRank = allWorkers.findIndex(w => w.username === user.username) + 1;
        const totalWorkers = allWorkers.length;
        // 7-day trend
        const trend = [];
        for (let d = 6; d >= 0; d--) {
            const date = new Date(); date.setDate(date.getDate() - d);
            const ds = date.toISOString().split('T')[0];
            const dayLogs = activityLogs.filter(l => l.username === user.username && new Date(l.timestamp).toISOString().split('T')[0] === ds);
            const dayTotal = dayLogs.filter(l => ['pick','pack','scan','box-handheld','box-pos'].includes(l.action)).length;
            trend.push({ day: ds.substring(5), val: dayTotal });
        }
        const shiftStart = firstLog ? new Date(firstLog).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const shiftDuration = firstLog ? `${Math.floor((Date.now() - firstLog) / 3600000)}h ${Math.floor(((Date.now() - firstLog) % 3600000) / 60000)}m` : '--';
        return { pick, pack, scan, count, total, myUph, target, uphPct, myRank, totalWorkers, trend, shiftStart, shiftDuration };
    }, [isWorker, user, activityLogs, userRole, kpiPerformanceData]);

    // Sales Order Pipeline Stats
    const orderStats = useMemo(() => {
        const pending = salesOrders.filter(o => o.status === 'pending').length;
        const picked = salesOrders.filter(o => o.status === 'picked' || o.status === 'picking').length;
        const packed = salesOrders.filter(o => o.status === 'packed' || o.status === 'packing').length;
        const rts = salesOrders.filter(o => o.status === 'rts').length;
        const total = salesOrders.length;
        const totalItems = salesOrders.reduce((s, o) => s + (o.items ? o.items.reduce((si, i) => si + (i.expected || 0), 0) : 0), 0);
        return { pending, picked, packed, rts, total, totalItems };
    }, [salesOrders]);

    const pipelineData = useMemo(() => {
        if (!salesOrders.length) return [];
        const courierMap = {};
        salesOrders.forEach(o => {
            const c = o.courier || o.platform || 'Unknown';
            if (!courierMap[c]) courierMap[c] = 0;
            courierMap[c]++;
        });
        return Object.entries(courierMap).map(([name, value]) => ({ name, value }));
    }, [salesOrders]);

    // Odoo-style stat card
    const StatCard = ({ label, val, icon, borderColor, textColor }) => (
        <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #dee2e6',
            borderLeft: `3px solid ${borderColor}`,
            borderRadius: '4px',
            padding: '1rem 1.25rem',
        }}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6c757d' }}>{label}</p>
                    <p className="text-2xl font-bold" style={{ color: textColor || '#212529' }}>{val}</p>
                </div>
                <div className="p-2.5 rounded" style={{ backgroundColor: '#f8f9fa', color: borderColor }}>
                    {icon}
                </div>
            </div>
        </div>
    );

    // Pipeline mini card
    const PipelineCard = ({ label, val, icon, color, bgColor }) => (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', padding: '0.875rem 1rem' }}>
            <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color }}>{icon}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6c757d' }}>{label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color }}>{val}</p>
        </div>
    );

    return (
        <div className="space-y-5 animate-fade-in">

            {/* ── My Performance (worker roles) ── */}
            {isWorker && myPerf && (
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded flex items-center justify-center text-white shrink-0" style={{ backgroundColor: '#714B67' }}>
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="font-bold" style={{ fontSize: '14px', color: '#212529' }}>My Performance</h2>
                                <p style={{ fontSize: '11px', color: '#6c757d' }}>Today — {user?.name || user?.username} ({userRole})</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px]" style={{ color: '#6c757d' }}>Shift: {myPerf.shiftStart}</p>
                            <p className="text-xs font-bold" style={{ color: '#714B67' }}>{myPerf.shiftDuration}</p>
                        </div>
                    </div>
                    <div className="p-5">
                        {/* KPI gauges */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                            {/* UPH */}
                            <div className="text-center">
                                <div className="relative w-20 h-20 mx-auto mb-2">
                                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.5" fill="none" stroke={myPerf.uphPct >= 80 ? '#28a745' : myPerf.uphPct >= 50 ? '#ffac00' : '#dc3545'} strokeWidth="3"
                                            strokeDasharray={`${myPerf.uphPct * 0.975} 97.5`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-lg font-black" style={{ color: '#212529' }}>{myPerf.myUph}</span>
                                    </div>
                                </div>
                                <p className="text-[11px] font-bold uppercase" style={{ color: '#6c757d' }}>UPH</p>
                                <p className="text-[10px]" style={{ color: '#adb5bd' }}>Target: {myPerf.target}</p>
                            </div>
                            {/* Orders Done */}
                            <div className="text-center">
                                <p className="text-3xl font-black mb-1" style={{ color: '#714B67' }}>{myPerf.total}</p>
                                <p className="text-[11px] font-bold uppercase" style={{ color: '#6c757d' }}>Orders Done</p>
                                <div className="flex justify-center gap-3 mt-1 text-[10px]" style={{ color: '#adb5bd' }}>
                                    {myPerf.pick > 0 && <span>Pick: {myPerf.pick}</span>}
                                    {myPerf.pack > 0 && <span>Pack: {myPerf.pack}</span>}
                                    {myPerf.scan > 0 && <span>Scan: {myPerf.scan}</span>}
                                </div>
                            </div>
                            {/* Rank */}
                            <div className="text-center">
                                <p className="text-3xl font-black mb-1" style={{ color: myPerf.myRank <= 3 ? '#28a745' : '#212529' }}>
                                    {myPerf.myRank > 0 ? `#${myPerf.myRank}` : '—'}
                                </p>
                                <p className="text-[11px] font-bold uppercase" style={{ color: '#6c757d' }}>Rank</p>
                                <p className="text-[10px]" style={{ color: '#adb5bd' }}>of {myPerf.totalWorkers} workers</p>
                            </div>
                            {/* Count Tasks */}
                            <div className="text-center">
                                <p className="text-3xl font-black mb-1" style={{ color: myPerf.count > 0 ? '#28a745' : '#adb5bd' }}>
                                    {myPerf.count}
                                </p>
                                <p className="text-[11px] font-bold uppercase" style={{ color: '#6c757d' }}>Counts Done</p>
                                <p className="text-[10px]" style={{ color: '#adb5bd' }}>Cycle Count tasks</p>
                            </div>
                        </div>
                        {/* 7-day trend */}
                        <div>
                            <p className="text-[11px] font-bold uppercase mb-2" style={{ color: '#6c757d' }}>7-Day Trend</p>
                            <div className="flex items-end gap-1 h-12">
                                {myPerf.trend.map((d, i) => {
                                    const maxVal = Math.max(...myPerf.trend.map(t => t.val), 1);
                                    const h = Math.max((d.val / maxVal) * 100, 4);
                                    const isToday = i === myPerf.trend.length - 1;
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                            <div className="w-full rounded-t-sm transition-all" style={{
                                                height: `${h}%`, minHeight: '2px',
                                                backgroundColor: isToday ? '#714B67' : '#dee2e6',
                                            }} />
                                            <span className="text-[8px]" style={{ color: isToday ? '#714B67' : '#adb5bd' }}>{d.day}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {/* No activity message */}
                        {myPerf.total === 0 && (
                            <div className="text-center py-4 mt-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                <Zap className="w-6 h-6 mx-auto mb-2" style={{ color: '#adb5bd' }} />
                                <p className="text-xs" style={{ color: '#6c757d' }}>No activity yet today — start your first task!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Order Pipeline */}
            {salesOrders.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    {[
                        { label: 'Pending', val: orderStats.pending, icon: <Clock className="w-4 h-4" />, color: '#ffac00' },
                        { label: 'Picked', val: orderStats.picked, icon: <ShoppingCart className="w-4 h-4" />, color: '#17a2b8' },
                        { label: 'Packed', val: orderStats.packed, icon: <PackageCheck className="w-4 h-4" />, color: '#714B67' },
                        { label: 'RTS / Shipped', val: orderStats.rts, icon: <Truck className="w-4 h-4" />, color: '#017E84' },
                        { label: 'Total Orders', val: orderStats.total, icon: <Package className="w-4 h-4" />, color: '#6c757d' },
                    ].map((stat, i) => (
                        <PipelineCard key={i} {...stat} />
                    ))}
                </div>
            )}

            {/* Inventory / Wave / Invoice KPI */}
            {(inventory || waves.length > 0 || invoices.length > 0) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Stock Value', val: inventory ? `฿${inventory.reduce((s, i) => s + i.onHand * i.unitCost, 0).toLocaleString()}` : '—', icon: <Warehouse className="w-4 h-4" />, borderColor: '#714B67', textColor: '#714B67' },
                        { label: 'Low Stock SKUs', val: inventory ? inventory.filter(i => i.available <= i.reorderPoint).length : '—', icon: <AlertTriangle className="w-4 h-4" />, borderColor: '#dc3545', textColor: '#dc3545' },
                        { label: 'Active Waves', val: waves.filter(w => w.status === 'active').length, icon: <Layers className="w-4 h-4" />, borderColor: '#17a2b8', textColor: '#17a2b8' },
                        { label: 'Invoiced Today', val: invoices.filter(i => new Date(i.createdAt).toDateString() === new Date().toDateString()).length, icon: <Receipt className="w-4 h-4" />, borderColor: '#28a745', textColor: '#28a745' },
                    ].map((stat, i) => (
                        <StatCard key={i} {...stat} />
                    ))}
                </div>
            )}

            {/* Outbound KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                    { label: t('statExpected'), val: totalExpected, icon: <Package className="w-4 h-4" />, borderColor: '#714B67' },
                    { label: t('statScanned'), val: totalScanned, icon: <CheckCircle2 className="w-4 h-4" />, borderColor: '#017E84' },
                    { label: t('statUPH'), val: uph, icon: <TrendingUp className="w-4 h-4" />, borderColor: '#17a2b8' },
                    { label: t('statSLA'), val: totalDelayed, icon: <AlertTriangle className="w-4 h-4" />, borderColor: '#dc3545', textColor: totalDelayed > 0 ? '#dc3545' : '#212529' }
                ].map((stat, i) => (
                    <StatCard key={i} {...stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Distribution Chart */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                    <div className="px-5 py-3" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                            <PieChartIcon className="w-4 h-4" style={{ color: '#714B67' }} /> {t('chartCourier')}
                        </h3>
                    </div>
                    <div className="p-5 h-64">
                        {courierDistributionData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie data={courierDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={2}>
                                        {courierDistributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#714B67', '#017E84', '#00A09D', '#ffac00', '#dc3545'][index % 5]} />)}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center" style={{ color: '#adb5bd' }}>
                                <PieChartIcon className="w-10 h-10 mb-2 opacity-20" />
                                <span className="text-sm">{t('insufficientData')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Delay Chart */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                    <div className="px-5 py-3" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                            <AlertTriangle className="w-4 h-4" style={{ color: '#dc3545' }} /> {t('chartDelayed')}
                        </h3>
                    </div>
                    <div className="p-5 h-64">
                        {delayedOrdersData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={delayedOrdersData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f5" />
                                    <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#6c757d' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#6c757d' }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip cursor={{ fill: '#f8f9fa' }} />
                                    <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={40}>
                                        {delayedOrdersData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center" style={{ color: '#017E84' }}>
                                <CheckCircle2 className="w-10 h-10 mb-2 opacity-20" />
                                <span className="text-sm font-semibold italic">All clear!</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Performance Table */}
            {userRole === 'admin' && (
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="px-5 py-3" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                            <Target className="w-4 h-4" style={{ color: '#714B67' }} /> {t('kpiSpeed')} — Team Performance
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left odoo-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th className="text-center">Pick</th>
                                    <th className="text-center">Pack</th>
                                    <th className="text-center">Scan</th>
                                    <th className="text-center">Total</th>
                                    <th className="text-right">UPH</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kpiPerformanceData.map(stat => (
                                    <tr key={stat.username}>
                                        <td className="font-semibold" style={{ color: '#212529' }}>{stat.name}</td>
                                        <td className="text-center" style={{ color: '#6c757d' }}>{stat.pick}</td>
                                        <td className="text-center" style={{ color: '#6c757d' }}>{stat.pack}</td>
                                        <td className="text-center" style={{ color: '#6c757d' }}>{stat.scan}</td>
                                        <td className="text-center font-bold" style={{ color: '#714B67' }}>{stat.total}</td>
                                        <td className="text-right font-bold" style={{ color: '#017E84' }}>{stat.uph}</td>
                                    </tr>
                                ))}
                                {kpiPerformanceData.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="text-center py-10" style={{ color: '#adb5bd' }}>No data available for today.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
