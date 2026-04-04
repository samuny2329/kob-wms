import React, { useMemo } from 'react';
import { ShoppingCart, Package, PackageCheck, Truck, Clock, Zap, Activity, BarChart3, Filter, Download, MoreVertical, AlertTriangle, CheckCircle2, ScanLine, Search, Printer, ScanBarcode } from 'lucide-react';
import { PRODUCT_CATALOG, PLATFORM_LABELS } from '../constants';

const Dashboard = ({ t, totalExpected, totalScanned, uph, dailyBoxUsage, totalDelayed, courierDistributionData, progressPercent, delayedOrdersData, userRole, activityLogs, isDarkMode, salesOrders = [], inventory = null, waves = [], invoices = [], user }) => {
    const isWorker = ['picker', 'packer', 'outbound'].includes(userRole);

    // ── Data computations ──
    const kpiPerformanceData = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = activityLogs.filter(log => {
            if (!log.timestamp) return false;
            return new Date(log.timestamp).toISOString().split('T')[0] === today;
        });
        const stats = {};
        todayLogs.forEach(log => {
            if (!stats[log.username]) {
                stats[log.username] = { name: log.name, username: log.username, pick: 0, pack: 0, scan: 0, total: 0, firstAction: log.timestamp, lastAction: log.timestamp };
            }
            if (log.action === 'pick') stats[log.username].pick++;
            if (log.action === 'pack') stats[log.username].pack++;
            if (log.action === 'scan') stats[log.username].scan++;
            stats[log.username].total++;
            if (log.timestamp < stats[log.username].firstAction) stats[log.username].firstAction = log.timestamp;
            if (log.timestamp > stats[log.username].lastAction) stats[log.username].lastAction = log.timestamp;
        });
        return Object.values(stats).map(stat => {
            let hours = (stat.lastAction - stat.firstAction) / 3600000;
            if (hours < 0.016) hours = 0.016;
            stat.uph = Math.round(stat.total / hours);
            return stat;
        }).sort((a, b) => b.total - a.total);
    }, [activityLogs]);

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
        const allWorkers = kpiPerformanceData || [];
        const myRank = allWorkers.findIndex(w => w.username === user.username) + 1;
        const totalWorkers = allWorkers.length;
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

    const orderStats = useMemo(() => {
        const pending = salesOrders.filter(o => o.status === 'pending').length;
        const picking = salesOrders.filter(o => o.status === 'picking').length;
        const picked = salesOrders.filter(o => o.status === 'picked').length;
        const packing = salesOrders.filter(o => o.status === 'packing').length;
        const packed = salesOrders.filter(o => o.status === 'packed').length;
        const rts = salesOrders.filter(o => o.status === 'rts').length;
        const total = salesOrders.length;
        const rtsPercent = total > 0 ? Math.round(((packed + rts) / total) * 100) : 0;
        return { pending: pending + picking, picked, packing: picked + packing, packed, rts, total, rtsPercent };
    }, [salesOrders]);

    // Split orders into 3 columns
    const pickOrders = salesOrders.filter(o => o.status === 'pending' || o.status === 'picking').slice(0, 8);
    const packOrders = salesOrders.filter(o => o.status === 'picked' || o.status === 'packing').slice(0, 8);
    const shipOrders = salesOrders.filter(o => o.status === 'packed' || o.status === 'rts').slice(0, 8);

    const getPlatformBadge = (order) => {
        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
        if (!pl) return null;
        return pl.name || order.platform;
    };

    const getProgress = (order) => {
        if (!order.items) return 0;
        const total = order.items.reduce((s, i) => s + (i.expected || 0), 0);
        const done = order.items.reduce((s, i) => s + (i.picked || 0), 0);
        return total > 0 ? Math.round((done / total) * 100) : 0;
    };

    return (
        <div className="animate-fade-in flex flex-col">

            {/* ═══════ HEADER SECTION ═══════ */}
            {!isWorker && (
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--odoo-text)' }}>E-commerce Fulfillment</h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--odoo-text-secondary)' }}>High-Velocity Operations: BTV-WH2 Warehouse</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center rounded-lg shadow-sm px-1" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                            <ScanBarcode className="w-4 h-4 ml-3" style={{ color: 'var(--odoo-text-secondary)' }} />
                            <input
                                className="bg-transparent border-none py-2.5 px-3 text-sm focus:ring-0 focus:outline-none w-64 placeholder:text-gray-400"
                                placeholder="Scan SKU or Order ID..."
                                type="text"
                                style={{ color: 'var(--odoo-text)' }}
                            />
                        </div>
                        <button onClick={() => window.print()} className="text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 hover:opacity-90"
                            style={{ backgroundColor: 'var(--odoo-purple)' }}>
                            <Printer className="w-4 h-4" />
                            Batch Print
                        </button>
                    </div>
                </div>
            )}

            {/* ── Worker: My Performance Strip ── */}
            {isWorker && myPerf && (
                <div className="mb-6 rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                    <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: 'var(--odoo-purple)' }}><Activity className="w-4 h-4" /></div>
                            <div>
                                <h2 className="font-bold text-sm" style={{ color: 'var(--odoo-text)' }}>My Performance</h2>
                                <p className="text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>Today — {user?.name || user?.username} ({userRole})</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px]" style={{ color: 'var(--odoo-text-secondary)' }}>Shift: {myPerf.shiftStart}</p>
                            <p className="text-xs font-bold" style={{ color: 'var(--odoo-purple)' }}>{myPerf.shiftDuration}</p>
                        </div>
                    </div>
                    <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="text-center">
                            <div className="relative w-16 h-16 mx-auto mb-1">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={myPerf.uphPct >= 80 ? 'var(--odoo-success)' : myPerf.uphPct >= 50 ? 'var(--odoo-warning)' : 'var(--odoo-danger)'} strokeWidth="3" strokeDasharray={`${myPerf.uphPct * 0.975} 97.5`} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-base font-black" style={{ color: 'var(--odoo-text)' }}>{myPerf.myUph}</span>
                                </div>
                            </div>
                            <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--odoo-text-secondary)' }}>UPH</p>
                        </div>
                        <div className="text-center flex flex-col justify-center">
                            <p className="text-2xl font-extrabold" style={{ color: 'var(--odoo-purple)' }}>{myPerf.total}</p>
                            <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--odoo-text-secondary)' }}>Done</p>
                        </div>
                        <div className="text-center flex flex-col justify-center">
                            <p className="text-2xl font-extrabold" style={{ color: myPerf.myRank <= 3 ? 'var(--odoo-success)' : 'var(--odoo-text)' }}>{myPerf.myRank > 0 ? `#${myPerf.myRank}` : '—'}</p>
                            <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--odoo-text-secondary)' }}>Rank</p>
                        </div>
                        <div className="text-center flex flex-col justify-center">
                            <p className="text-2xl font-extrabold" style={{ color: myPerf.count > 0 ? 'var(--odoo-success)' : 'var(--odoo-text-muted)' }}>{myPerf.count}</p>
                            <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--odoo-text-secondary)' }}>Counts</p>
                        </div>
                        <div className="flex flex-col justify-center">
                            <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--odoo-text-secondary)' }}>7-Day</p>
                            <div className="flex items-end gap-0.5 h-8">
                                {myPerf.trend.map((d, i) => {
                                    const maxVal = Math.max(...myPerf.trend.map(t => t.val), 1);
                                    const h = Math.max((d.val / maxVal) * 100, 8);
                                    const isToday = i === myPerf.trend.length - 1;
                                    return <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, minHeight: '2px', backgroundColor: isToday ? 'var(--odoo-purple)' : 'var(--odoo-surface-high)' }} />;
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ KPI SUMMARY STRIP ═══════ */}
            <div className="flex gap-4 mb-6">
                {[
                    { label: 'Pending Pick', val: orderStats.pending, color: '#714B67', bgIcon: '#ffd7f1', icon: <ShoppingCart className="w-5 h-5" style={{ color: '#714B67' }} /> },
                    { label: 'Packaging', val: orderStats.packing, color: '#00696e', bgIcon: '#95f1f8', icon: <PackageCheck className="w-5 h-5" style={{ color: '#00696e' }} /> },
                    { label: 'RTS Rate', val: `${orderStats.rtsPercent}%`, color: '#791e2a', bgIcon: '#ffdada', icon: <Zap className="w-5 h-5" style={{ color: '#791e2a' }} /> },
                    { label: 'Shipped Today', val: orderStats.rts, color: 'var(--odoo-text)', bgIcon: 'var(--odoo-surface-high)', icon: <Truck className="w-5 h-5" style={{ color: '#4e444a' }} /> },
                ].map((kpi, i) => (
                    <div key={i} className="flex-1 p-6 rounded-xl shadow-sm flex items-center justify-between"
                        style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                        <div>
                            <div className="text-[10px] font-bold tracking-wider uppercase mb-1" style={{ color: 'var(--odoo-text-muted)' }}>{kpi.label}</div>
                            <div className="text-3xl font-extrabold" style={{ color: kpi.color }}>{typeof kpi.val === 'number' ? kpi.val.toLocaleString() : kpi.val}</div>
                        </div>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: kpi.bgIcon }}>
                            {kpi.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══════ FULFILLMENT FLOW (3 COLUMNS) ═══════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" style={{ minHeight: '340px' }}>

                {/* Column: Orders to Pick */}
                <div className="flex flex-col rounded-xl p-4 gap-3 overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#714B67' }} />
                            <h3 className="font-bold uppercase text-xs tracking-widest" style={{ color: 'var(--odoo-text)' }}>Orders to Pick</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: 'rgba(113, 75, 103, 0.15)', color: '#714B67' }}>
                            {pickOrders.length} {pickOrders.length > 0 ? 'NEW' : ''}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3" style={{ maxHeight: '400px' }}>
                        {pickOrders.length === 0 ? (
                            <div className="text-center py-12 opacity-40">
                                <ShoppingCart className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--odoo-text-muted)' }} />
                                <p className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>No orders to pick</p>
                            </div>
                        ) : pickOrders.map(order => {
                            const progress = getProgress(order);
                            const platform = getPlatformBadge(order);
                            return (
                                <div key={order.id} className="p-4 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--odoo-surface)', borderLeft: '4px solid #714B67' }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold" style={{ color: '#714B67' }}>{order.ref}</span>
                                        {platform && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)' }}>{platform}</span>}
                                    </div>
                                    <p className="text-xs mb-3" style={{ color: 'var(--odoo-text-secondary)' }}>
                                        {order.customer} &bull; {order.items?.length || 0} SKUs &bull; {order.items?.reduce((s, i) => s + (i.expected || 0), 0)} pcs
                                    </p>
                                    <div className="h-1.5 w-full rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: '#714B67' }} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>{progress}% picked</span>
                                        <span className="text-[10px] font-bold cursor-pointer" style={{ color: '#714B67' }}>START PICKING</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Column: Orders to Pack */}
                <div className="flex flex-col rounded-xl p-4 gap-3 overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00696e' }} />
                            <h3 className="font-bold uppercase text-xs tracking-widest" style={{ color: 'var(--odoo-text)' }}>Orders to Pack</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: 'rgba(0, 105, 110, 0.15)', color: '#00696e' }}>
                            {packOrders.length} ACTIVE
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3" style={{ maxHeight: '400px' }}>
                        {packOrders.length === 0 ? (
                            <div className="text-center py-12 opacity-40">
                                <PackageCheck className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--odoo-text-muted)' }} />
                                <p className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>No orders to pack</p>
                            </div>
                        ) : packOrders.map(order => {
                            const platform = getPlatformBadge(order);
                            const itemCount = order.items?.reduce((s, i) => s + (i.expected || 0), 0) || 0;
                            return (
                                <div key={order.id} className="p-4 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--odoo-surface)', borderLeft: '4px solid #00696e' }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold" style={{ color: '#00696e' }}>{order.ref}</span>
                                        {platform && <span className="text-[10px] font-bold" style={{ color: 'var(--odoo-text-muted)' }}>{platform}</span>}
                                    </div>
                                    <div className="space-y-1 mb-3">
                                        {(order.items || []).slice(0, 3).map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-[10px]">
                                                <span style={{ color: 'var(--odoo-text-muted)' }}>{PRODUCT_CATALOG[item.sku]?.shortName || item.name}</span>
                                                <span className="font-bold" style={{ color: 'var(--odoo-text)' }}>x{item.expected}</span>
                                            </div>
                                        ))}
                                        {(order.items || []).length > 3 && <p className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>+{order.items.length - 3} more items</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => alert(`Generate label for ${order.ref}`)} className="flex-1 py-2 rounded font-bold text-[10px] text-white shadow-sm" style={{ backgroundColor: '#00696e' }}>GENERATE LABEL</button>
                                        <button onClick={() => alert(`Scan ${order.ref}`)} className="w-9 flex items-center justify-center rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)' }}>
                                            <ScanLine className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Column: Ready to Ship */}
                <div className="flex flex-col rounded-xl p-4 gap-3 overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9ca3af' }} />
                            <h3 className="font-bold uppercase text-xs tracking-widest" style={{ color: 'var(--odoo-text)' }}>Ready to Ship</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: '#e5e7eb', color: '#4b5563' }}>
                            {shipOrders.length} WAIT
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: '400px' }}>
                        {shipOrders.length === 0 ? (
                            <div className="text-center py-12 opacity-40">
                                <Truck className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--odoo-text-muted)' }} />
                                <p className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>No orders ready to ship</p>
                            </div>
                        ) : (
                            <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                                <table className="w-full text-left text-[10px]">
                                    <thead style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                        <tr>
                                            <th className="px-3 py-2 font-bold uppercase tracking-tight" style={{ color: 'var(--odoo-text-muted)' }}>Order</th>
                                            <th className="px-3 py-2 font-bold uppercase tracking-tight" style={{ color: 'var(--odoo-text-muted)' }}>Carrier</th>
                                            <th className="px-3 py-2 font-bold uppercase tracking-tight" style={{ color: 'var(--odoo-text-muted)' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shipOrders.map(order => (
                                            <tr key={order.id} className="hover:opacity-80 transition-colors" style={{ borderBottom: '1px solid var(--odoo-surface-low)' }}>
                                                <td className="px-3 py-3 font-bold" style={{ color: 'var(--odoo-text)' }}>{order.ref}</td>
                                                <td className="px-3 py-3" style={{ color: 'var(--odoo-text-secondary)' }}>{getPlatformBadge(order) || order.courier || '—'}</td>
                                                <td className="px-3 py-3">
                                                    <span className="px-2 py-0.5 rounded font-bold uppercase" style={{
                                                        backgroundColor: order.status === 'rts' ? '#dcfce7' : '#fef9c3',
                                                        color: order.status === 'rts' ? '#15803d' : '#a16207',
                                                    }}>{order.status === 'rts' ? 'MANIFESTED' : 'PACKED'}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {shipOrders.length > 0 && (
                                    <div className="p-3" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                        <button onClick={() => alert(`Confirming shipment for ${shipOrders.length} orders`)} className="w-full py-2.5 rounded font-bold text-xs text-white shadow-md transition-all" style={{ backgroundColor: '#57344f' }}>
                                            CONFIRM SHIPMENT ({shipOrders.length})
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════ ACTIVE ORDER SKU DETAILS TABLE ═══════ */}
            {!isWorker && salesOrders.length > 0 && (
                <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                    <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        <h4 className="font-bold" style={{ color: 'var(--odoo-text)' }}>Active Order SKU Details</h4>
                        <div className="flex gap-3">
                            <button onClick={() => alert('Filter options coming soon')} className="text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-70" style={{ color: 'var(--odoo-text-muted)' }}>
                                <Filter className="w-3.5 h-3.5" /> Filter
                            </button>
                            <button onClick={() => { const csv = ['Order,Customer,Items,Qty,Status', ...salesOrders.slice(0,10).map(o => `${o.ref},${o.customer||''},${o.items?.length||0},${o.items?.reduce((s,i)=>s+(i.expected||0),0)||0},${o.status}`)].join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'orders.csv'; a.click(); }} className="text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-70" style={{ color: 'var(--odoo-text-muted)' }}>
                                <Download className="w-3.5 h-3.5" /> Export
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Order ID</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Customer</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Items</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Qty</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>SLA Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesOrders.slice(0, 10).map(order => {
                                    const totalQty = order.items?.reduce((s, i) => s + (i.expected || 0), 0) || 0;
                                    const slaOk = order.status !== 'pending'; // simplified
                                    return (
                                        <tr key={order.id} className="hover:opacity-90 transition-colors text-sm" style={{ borderBottom: '1px solid var(--odoo-surface-low)' }}>
                                            <td className="px-6 py-4 font-bold" style={{ color: '#714B67' }}>{order.ref}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{order.customer || '—'}</div>
                                                <div className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>{getPlatformBadge(order) || ''}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium" style={{ color: 'var(--odoo-text)' }}>{order.items?.length || 0} SKUs</div>
                                                <div className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>{order.items?.[0]?.sku || ''}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold" style={{ color: '#00696e' }}>{totalQty}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-high)', minWidth: '60px' }}>
                                                        <div className="h-full rounded-full" style={{ width: slaOk ? '85%' : '30%', backgroundColor: slaOk ? '#00696e' : '#791e2a' }} />
                                                    </div>
                                                    <span className="text-[10px] font-bold" style={{ color: slaOk ? '#00696e' : '#791e2a' }}>{slaOk ? 'OK' : 'URGENT'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <MoreVertical className="w-4 h-4 cursor-pointer" style={{ color: 'var(--odoo-text-muted)' }} />
                                            </td>
                                        </tr>
                                    );
                                })}
                                {salesOrders.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-16 text-center">
                                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: 'var(--odoo-text-muted)' }} />
                                            <p className="text-sm" style={{ color: 'var(--odoo-text-muted)' }}>No active orders</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════ TEAM PERFORMANCE (admin only, no orders) ═══════ */}
            {!isWorker && salesOrders.length === 0 && (
                <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                    <div className="px-6 py-4 flex justify-between items-center" style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        <h3 className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--odoo-text-secondary)' }}>{t('kpiSpeed')} — Team Performance</h3>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 text-[10px] font-bold rounded shadow-sm uppercase flex items-center gap-1" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}>
                                <Download className="w-3 h-3" /> Export CSV
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                    <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Member</th>
                                    <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-center" style={{ color: 'var(--odoo-text-muted)' }}>Pick</th>
                                    <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-center" style={{ color: 'var(--odoo-text-muted)' }}>Pack</th>
                                    <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-center" style={{ color: 'var(--odoo-text-muted)' }}>Scan</th>
                                    <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-center" style={{ color: 'var(--odoo-text-muted)' }}>Total</th>
                                    <th className="px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-right" style={{ color: 'var(--odoo-text-muted)' }}>UPH</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kpiPerformanceData.map(stat => (
                                    <tr key={stat.username} className="hover:opacity-90 transition-colors" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                        <td className="px-6 py-3 font-semibold text-sm" style={{ color: 'var(--odoo-text)' }}>{stat.name}</td>
                                        <td className="px-6 py-3 text-sm text-center" style={{ color: 'var(--odoo-text-secondary)' }}>{stat.pick}</td>
                                        <td className="px-6 py-3 text-sm text-center" style={{ color: 'var(--odoo-text-secondary)' }}>{stat.pack}</td>
                                        <td className="px-6 py-3 text-sm text-center" style={{ color: 'var(--odoo-text-secondary)' }}>{stat.scan}</td>
                                        <td className="px-6 py-3 text-sm text-center font-bold" style={{ color: '#714B67' }}>{stat.total}</td>
                                        <td className="px-6 py-3 text-sm text-right font-bold" style={{ color: '#00696e' }}>{stat.uph}</td>
                                    </tr>
                                ))}
                                {kpiPerformanceData.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-16 text-center">
                                            <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: 'var(--odoo-text-muted)' }} />
                                            <p className="text-sm" style={{ color: 'var(--odoo-text-muted)' }}>No data available for today</p>
                                            <p className="text-[10px] uppercase mt-1" style={{ color: 'var(--odoo-text-muted)' }}>Performance sync every 15 minutes</p>
                                        </td>
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
