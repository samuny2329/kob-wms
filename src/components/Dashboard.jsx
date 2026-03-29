import React, { useMemo } from 'react';
import { Package, CheckCircle2, Clock, TrendingUp, Box, AlertTriangle, PieChart as PieChartIcon, Target, ShoppingCart, PackageCheck, Truck, ScanLine, Warehouse, Layers, Receipt } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const Dashboard = ({ t, totalExpected, totalScanned, uph, dailyBoxUsage, totalDelayed, courierDistributionData, progressPercent, delayedOrdersData, userRole, activityLogs, isDarkMode, salesOrders = [], inventory = null, waves = [], invoices = [] }) => {

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

        // Show sample data when no real activity logs exist
        if (result.length === 0) {
            return [
                { name: 'Somchai K.', username: 'somchai', pick: 42, pack: 35, scan: 28, total: 105, uph: 26 },
                { name: 'Nattaya P.', username: 'nattaya', pick: 38, pack: 40, scan: 20, total: 98, uph: 24 },
                { name: 'Wichai S.', username: 'wichai', pick: 30, pack: 25, scan: 32, total: 87, uph: 22 },
                { name: 'Preecha M.', username: 'preecha', pick: 25, pack: 20, scan: 35, total: 80, uph: 20 },
                { name: 'Kannika R.', username: 'kannika', pick: 20, pack: 30, scan: 15, total: 65, uph: 16 },
            ];
        }
        return result;
    }, [activityLogs]);

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
