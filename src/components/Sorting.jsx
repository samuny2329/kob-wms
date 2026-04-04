import React, { useState, useMemo } from 'react';
import {
    Layers, Plus, Check, X, Clock, ChevronDown, ChevronRight,
    BarChart3, Activity, Package, CheckCircle2, Truck,
    TrendingUp, MoreVertical, ListFilter
} from 'lucide-react';
import { WAVE_TEMPLATES, PLATFORM_LABELS } from '../constants';
import { PlatformBadge } from './PlatformLogo';

const Sorting = ({ salesOrders, waves, setWaves, addToast }) => {
    const [showCreateWave, setShowCreateWave] = useState(false);
    const [newWaveName, setNewWaveName] = useState('');
    const [newWaveType, setNewWaveType] = useState('morning');
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [expandedWave, setExpandedWave] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState('platform');

    const assignableOrders = useMemo(() => {
        const assignedIds = new Set();
        (waves || []).forEach(w => {
            if (w.status === 'active') w.orderIds?.forEach(id => assignedIds.add(id));
        });
        return salesOrders.filter(o =>
            (o.status === 'pending' || o.status === 'picking' || o.status === 'picked' || o.status === 'packing') &&
            !assignedIds.has(o.id)
        );
    }, [salesOrders, waves]);

    const handleCreateWave = () => {
        if (!newWaveName.trim() || selectedOrderIds.length === 0) return;
        const template = WAVE_TEMPLATES.find(t => t.id === newWaveType);
        const newWave = {
            id: 'WAVE-' + Date.now(),
            name: newWaveName.trim(),
            type: newWaveType,
            timeRange: template?.timeRange || 'Custom',
            icon: template?.icon || '⚡',
            orderIds: selectedOrderIds,
            status: 'active',
            createdAt: Date.now()
        };
        setWaves(prev => [newWave, ...(prev || [])]);
        addToast(`Wave "${newWaveName}" created with ${selectedOrderIds.length} orders`);
        setShowCreateWave(false);
        setNewWaveName('');
        setSelectedOrderIds([]);
    };

    const handleCloseWave = (waveId) => {
        setWaves(prev => (prev || []).map(w => w.id === waveId ? { ...w, status: 'closed', closedAt: Date.now() } : w));
        addToast('Wave closed');
    };

    const toggleOrderSelect = (orderId) => {
        setSelectedOrderIds(prev =>
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };

    const selectAllOrders = () => {
        if (selectedOrderIds.length === assignableOrders.length) {
            setSelectedOrderIds([]);
        } else {
            setSelectedOrderIds(assignableOrders.map(o => o.id));
        }
    };

    const getWaveStats = (wave) => {
        const orders = salesOrders.filter(o => wave.orderIds?.includes(o.id));
        const total = orders.length;
        const picked = orders.filter(o => ['picked', 'packing', 'packed', 'rts'].includes(o.status)).length;
        const packed = orders.filter(o => ['packed', 'rts'].includes(o.status)).length;
        const shipped = orders.filter(o => o.status === 'rts').length;
        const courierGroups = {};
        orders.forEach(o => {
            const c = o.courier || o.platform || 'Unknown';
            if (!courierGroups[c]) courierGroups[c] = [];
            courierGroups[c].push(o);
        });
        return { total, picked, packed, shipped, courierGroups, orders };
    };

    // Compute summary KPIs
    const allWaves = waves || [];
    const activeWaves = allWaves.filter(w => w.status === 'active');
    const activeWave = activeWaves[0] || null;
    const activeWaveStats = activeWave ? getWaveStats(activeWave) : null;
    const completionPct = activeWaveStats && activeWaveStats.total > 0
        ? ((activeWaveStats.packed / activeWaveStats.total) * 100).toFixed(1)
        : '0.0';

    // Status helpers
    const getStatusInfo = (status) => {
        switch (status) {
            case 'rts': return { label: 'Shipped', color: 'var(--odoo-success)', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
            case 'packed': return { label: 'Ready', color: 'var(--odoo-teal)', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
            case 'picked': return { label: 'Picked', color: 'var(--odoo-info)', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
            case 'picking': return { label: 'Picking', color: 'var(--odoo-text-secondary)', icon: <Clock className="w-3.5 h-3.5" /> };
            case 'packing': return { label: 'Packing', color: 'var(--odoo-warning)', icon: <Package className="w-3.5 h-3.5" /> };
            default: return { label: 'Queued', color: 'var(--odoo-text-muted)', icon: <Clock className="w-3.5 h-3.5" /> };
        }
    };

    const getWaveStatusBadge = (wave) => {
        if (wave.status === 'active') {
            return { label: 'In Progress', bg: 'rgba(0,105,110,0.1)', color: 'var(--odoo-teal)' };
        }
        if (wave.status === 'closed') {
            return { label: 'Completed', bg: 'var(--odoo-surface-high)', color: 'var(--odoo-text-secondary)' };
        }
        return { label: 'Draft', bg: 'var(--odoo-surface-high)', color: 'var(--odoo-text-muted)' };
    };

    // Courier badge color map
    const courierColors = {
        'Flash Express': '#FF8C00',
        'Kerry Express': '#2E7D32',
        'J&T Express': '#D32F2F',
        'Thai Post': '#1976D2',
        'Shopee Express': '#EE4D2D',
        'Lazada Express': '#0F146D',
        'TikTok Shop': '#010101',
    };

    return (
        <div className="w-full animate-slide-up" style={{ maxWidth: 1600, margin: '0 auto' }}>
            <div className="space-y-8">
                {/* ── Action Bar & Header ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--odoo-text)' }}>
                            Wave Sorting
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--odoo-text-secondary)' }}>
                            Optimize warehouse throughput with intelligent grouping
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Template Select */}
                        <div className="relative">
                            <select
                                value={selectedTemplate}
                                onChange={e => setSelectedTemplate(e.target.value)}
                                className="appearance-none text-sm font-medium px-4 py-2.5 pr-10 rounded-lg"
                                style={{
                                    backgroundColor: 'var(--odoo-surface)',
                                    border: 'none',
                                    color: 'var(--odoo-text)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px var(--odoo-border-ghost)',
                                }}
                            >
                                <option value="platform">Platform Template</option>
                                <option value="courier">Courier Template</option>
                                <option value="zone">Zone Template</option>
                                <option value="custom">Custom Template</option>
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none" style={{ color: 'var(--odoo-text-secondary)' }} />
                        </div>
                        {/* Create Wave Button */}
                        <button
                            onClick={() => setShowCreateWave(true)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                            style={{ background: 'linear-gradient(to right, #57344f, var(--odoo-purple))' }}
                        >
                            <Plus className="w-5 h-5" /> Create Wave
                        </button>
                    </div>
                </div>

                {/* ── Wave Summary Strip (KPIs) ── */}
                <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Total Waves */}
                    <div className="p-5 rounded-lg flex items-center gap-4" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(113,75,103,0.1)' }}>
                            <BarChart3 className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Total Waves</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--odoo-text)' }}>{allWaves.length}</div>
                        </div>
                    </div>
                    {/* Active Wave */}
                    <div className="p-5 rounded-lg flex items-center gap-4" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,105,110,0.1)' }}>
                            <Activity className="w-5 h-5" style={{ color: 'var(--odoo-teal)' }} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Active Wave</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--odoo-text)' }}>{activeWave?.name || '—'}</div>
                        </div>
                    </div>
                    {/* Orders in Wave */}
                    <div className="p-5 rounded-lg flex items-center gap-4" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(113,75,103,0.08)' }}>
                            <Package className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Orders in Wave</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--odoo-text)' }}>{activeWaveStats?.total || 0}</div>
                        </div>
                    </div>
                    {/* Completion % */}
                    <div className="p-5 rounded-lg flex items-center gap-4" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(121,30,42,0.08)' }}>
                            <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--odoo-danger)' }} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Completion %</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--odoo-text)' }}>{completionPct}%</div>
                        </div>
                    </div>
                </section>

                {/* ── Main Content: Left (Wave List) + Right (Active Wave Detail) ── */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                    {/* ─── Left Column: Recent Waves ─── */}
                    <div className="xl:col-span-4 space-y-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--odoo-text-muted)' }}>
                            <ListFilter className="w-4 h-4" /> Recent Waves
                        </h2>

                        {(!waves || waves.length === 0) ? (
                            <div className="text-center py-14 rounded-lg" style={{ backgroundColor: 'var(--odoo-surface)', color: 'var(--odoo-text-muted)' }}>
                                <Layers className="w-9 h-9 mx-auto mb-2.5 opacity-20" />
                                <p className="text-sm">No waves created yet</p>
                                <p className="text-xs mt-1">Create a wave to group orders by batch</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {allWaves.map(wave => {
                                    const stats = getWaveStats(wave);
                                    const isActive = expandedWave === wave.id || (activeWave?.id === wave.id && !expandedWave);
                                    const badge = getWaveStatusBadge(wave);
                                    const templateName = WAVE_TEMPLATES.find(t => t.id === wave.type)?.name?.replace(' Wave', ' Sort') || wave.type;
                                    const createdDate = wave.createdAt ? new Date(wave.createdAt) : null;

                                    return (
                                        <div
                                            key={wave.id}
                                            className="p-4 rounded-lg cursor-pointer transition-colors"
                                            style={{
                                                backgroundColor: 'var(--odoo-surface)',
                                                borderLeft: isActive ? '4px solid var(--odoo-purple)' : '4px solid transparent',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                            }}
                                            onClick={() => setExpandedWave(wave.id === expandedWave ? null : wave.id)}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'}
                                        >
                                            {/* Wave ID + Status Badge */}
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-bold text-sm" style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)' }}>
                                                    {wave.name}
                                                </span>
                                                <span
                                                    className="px-2 py-0.5 text-[10px] font-bold rounded uppercase"
                                                    style={{ backgroundColor: badge.bg, color: badge.color }}
                                                >
                                                    {badge.label}
                                                </span>
                                            </div>
                                            {/* Wave Metadata Grid */}
                                            <div className="grid grid-cols-2 gap-y-3 text-[13px]">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--odoo-text-muted)' }}>Template</p>
                                                    <p className="font-medium" style={{ color: 'var(--odoo-text)' }}>{templateName}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--odoo-text-muted)' }}>Orders</p>
                                                    <p className="font-medium" style={{ color: 'var(--odoo-text)' }}>{stats.total} Units</p>
                                                </div>
                                                {wave.status === 'active' && createdDate && (
                                                    <>
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--odoo-text-muted)' }}>Created By</p>
                                                            <p className="font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>Admin</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--odoo-text-muted)' }}>Time</p>
                                                            <p className="font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                                {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ─── Right Column: Active Wave Detail ─── */}
                    <div className="xl:col-span-8 space-y-6">
                        {activeWave || expandedWave ? (() => {
                            const displayWave = expandedWave ? allWaves.find(w => w.id === expandedWave) : activeWave;
                            if (!displayWave) return null;
                            const stats = getWaveStats(displayWave);
                            const pickPct = stats.total > 0 ? Math.round((stats.picked / stats.total) * 100) : 0;
                            const packPct = stats.total > 0 ? Math.round((stats.packed / stats.total) * 100) : 0;
                            const shipPct = stats.total > 0 ? Math.round((stats.shipped / stats.total) * 100) : 0;
                            const timeSince = displayWave.createdAt
                                ? Math.round((Date.now() - displayWave.createdAt) / 60000)
                                : 0;

                            return (
                                <>
                                    {/* Wave Detail Card */}
                                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

                                        {/* ── Progress Header ── */}
                                        <div className="p-6" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <h2 className="text-lg font-bold" style={{ color: 'var(--odoo-text)' }}>
                                                        Active Wave Details: {displayWave.name}
                                                    </h2>
                                                    <p className="text-sm" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                        {timeSince > 0 ? `Last updated ${timeSince} min${timeSince !== 1 ? 's' : ''} ago` : 'Just created'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold" style={{ color: 'var(--odoo-purple)' }}>
                                                        {stats.packed}{' '}
                                                        <span className="text-sm font-normal" style={{ color: 'var(--odoo-text-secondary)' }}>/ {stats.total}</span>
                                                    </div>
                                                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                                                        Units Processed
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ── Progress Visualization ── */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] font-bold uppercase" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                    <span>Picked ({stats.picked})</span>
                                                    <span>Packed ({stats.packed})</span>
                                                    <span>Shipped ({stats.shipped})</span>
                                                </div>
                                                <div className="h-3 w-full rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                                    <div className="h-full transition-all" style={{ width: `${pickPct}%`, backgroundColor: 'var(--odoo-purple)' }} />
                                                    <div className="h-full transition-all" style={{ width: `${Math.max(0, packPct - pickPct)}%`, backgroundColor: 'var(--odoo-teal)', opacity: 0.5 }} />
                                                    <div className="h-full transition-all" style={{ width: `${Math.max(0, shipPct - packPct)}%`, backgroundColor: 'var(--odoo-teal)' }} />
                                                </div>
                                                {/* Legend */}
                                                <div className="flex gap-4 pt-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--odoo-purple)' }} />
                                                        <span className="text-[10px]" style={{ color: 'var(--odoo-text-secondary)' }}>Picked</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--odoo-teal)', opacity: 0.5 }} />
                                                        <span className="text-[10px]" style={{ color: 'var(--odoo-text-secondary)' }}>Packed</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--odoo-teal)' }} />
                                                        <span className="text-[10px]" style={{ color: 'var(--odoo-text-secondary)' }}>Shipped</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Orders Table ── */}
                                        <div className="p-6 overflow-x-auto">
                                            <table className="w-full text-left" style={{ borderSpacing: '0 12px', borderCollapse: 'separate' }}>
                                                <thead>
                                                    <tr>
                                                        {['Order ID', 'SKU Count', 'Courier', 'Destination', 'Status', ''].map((h, i) => (
                                                            <th
                                                                key={h || 'actions'}
                                                                className="pb-2 text-[11px] font-bold uppercase tracking-widest"
                                                                style={{
                                                                    color: 'var(--odoo-text-muted)',
                                                                    paddingLeft: i === 0 ? 16 : 0,
                                                                    paddingRight: i === 5 ? 16 : 0,
                                                                    textAlign: i === 5 ? 'right' : 'left',
                                                                }}
                                                            >
                                                                {h || 'Actions'}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {stats.orders.map(order => {
                                                        const statusInfo = getStatusInfo(order.status);
                                                        const courierName = order.courier || order.platform || 'Unknown';
                                                        const pl = PLATFORM_LABELS[courierName];
                                                        const cColor = courierColors[courierName] || pl?.color || 'var(--odoo-text-secondary)';
                                                        const itemCount = order.items?.reduce((s, i) => s + i.expected, 0) || 0;

                                                        return (
                                                            <tr
                                                                key={order.id}
                                                                className="group transition-colors"
                                                                style={{ backgroundColor: 'var(--odoo-surface-low)' }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                            >
                                                                <td className="py-4 pl-4 font-semibold text-sm" style={{ color: 'var(--odoo-purple)', borderRadius: '8px 0 0 8px' }}>
                                                                    {order.ref || `#${order.id}`}
                                                                </td>
                                                                <td className="py-4 text-sm" style={{ color: 'var(--odoo-text)' }}>
                                                                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                                                                </td>
                                                                <td className="py-4">
                                                                    <span className="px-2 py-1 text-[11px] font-bold rounded" style={{
                                                                        backgroundColor: `${cColor}15`,
                                                                        color: cColor,
                                                                    }}>
                                                                        {pl?.name || courierName}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 text-sm" style={{ color: 'var(--odoo-text)' }}>
                                                                    {order.destination || order.customer || '—'}
                                                                </td>
                                                                <td className="py-4">
                                                                    <div className="flex items-center gap-1.5" style={{ color: statusInfo.color }}>
                                                                        {statusInfo.icon}
                                                                        <span className="text-xs font-medium">{statusInfo.label}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-4 pr-4 text-right" style={{ borderRadius: '0 8px 8px 0' }}>
                                                                    <button className="p-1 rounded transition-colors hover:bg-white/50" style={{ color: 'var(--odoo-text-muted)' }}>
                                                                        <MoreVertical className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {stats.orders.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="text-center py-10 text-sm" style={{ color: 'var(--odoo-text-muted)' }}>
                                                                No orders in this wave
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* ── Bottom Insight Cards ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Efficiency Insight */}
                                        <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                                            <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                                <TrendingUp className="w-5 h-5" style={{ color: 'var(--odoo-teal)' }} />
                                                Efficiency Insight
                                            </h3>
                                            <p className="text-sm leading-relaxed" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                {stats.total > 0
                                                    ? `Current wave ${displayWave.name} has ${stats.total} orders with ${Object.keys(stats.courierGroups).length} courier group${Object.keys(stats.courierGroups).length !== 1 ? 's' : ''}. ${pickPct}% picked, ${packPct}% packed. ${stats.total - stats.packed > 0 ? `${stats.total - stats.packed} orders remaining to process.` : 'All orders processed!'}`
                                                    : 'No orders to analyze. Add orders to this wave to see efficiency insights.'
                                                }
                                            </p>
                                        </div>
                                        {/* Next Pickup */}
                                        <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                                    <Truck className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                                                    Next Pickup
                                                </h3>
                                                <span className="text-[10px] font-bold animate-pulse" style={{ color: 'var(--odoo-danger)' }}>
                                                    EST. {new Date(Date.now() + 2 * 3600000).getHours().toString().padStart(2, '0')}:00
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                {/* Courier avatars */}
                                                <div className="flex -space-x-2">
                                                    {Object.entries(stats.courierGroups).slice(0, 4).map(([courier]) => {
                                                        const cColor = courierColors[courier] || PLATFORM_LABELS[courier]?.color || 'var(--odoo-purple)';
                                                        const initial = (PLATFORM_LABELS[courier]?.name || courier)?.[0] || '?';
                                                        return (
                                                            <div key={courier} className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{
                                                                backgroundColor: cColor,
                                                                border: '2px solid var(--odoo-surface)',
                                                            }}>
                                                                {initial}
                                                            </div>
                                                        );
                                                    })}
                                                    {Object.keys(stats.courierGroups).length === 0 && (
                                                        <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>No couriers</span>
                                                    )}
                                                </div>
                                                {displayWave.status === 'active' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleCloseWave(displayWave.id); }}
                                                        className="text-xs font-bold transition-colors"
                                                        style={{ color: 'var(--odoo-purple)' }}
                                                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                                    >
                                                        Close Wave
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {Object.entries(stats.courierGroups).map(([courier, orders]) => {
                                                    const pl = PLATFORM_LABELS[courier];
                                                    const done = orders.filter(o => ['packed', 'rts'].includes(o.status)).length;
                                                    return (
                                                        <div key={courier} className="p-3" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border)', borderRadius: 'var(--odoo-radius)' }}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <PlatformBadge name={courier} size={28} />
                                                                <div className="flex-1">
                                                                    <p className="font-semibold text-xs" style={{ color: 'var(--odoo-text)' }}>{pl?.name || courier}</p>
                                                                    <p className="text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>{orders.length} orders | {done} done</p>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {orders.map(o => (
                                                                    <div key={o.id} className="flex justify-between items-center text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                                        <span className="font-mono font-semibold" style={{ color: 'var(--odoo-text)' }}>{o.ref}</span>
                                                                        <span className="odoo-badge text-[10px]" style={{
                                                                            backgroundColor: o.status === 'rts' ? '#e8f5e9' : o.status === 'packed' ? '#e0f4f3' : o.status === 'picked' ? '#e8f4fd' : '#fff8e1',
                                                                            color: o.status === 'rts' ? 'var(--odoo-success)' : o.status === 'packed' ? 'var(--odoo-teal)' : o.status === 'picked' ? 'var(--odoo-info)' : '#856404',
                                                                        }}>{o.status}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })() : (
                            /* Empty state when no wave selected */
                            <div className="rounded-xl p-16 text-center" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                                <Layers className="w-12 h-12 mx-auto mb-4 opacity-15" style={{ color: 'var(--odoo-text-muted)' }} />
                                <p className="text-base font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>No active wave selected</p>
                                <p className="text-sm mt-1" style={{ color: 'var(--odoo-text-muted)' }}>Create a wave or select one from the list</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Create Wave Modal ── */}
            {showCreateWave && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl" style={{
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                        boxShadow: '0 8px 32px rgba(87,52,79,0.15)',
                    }}>
                        {/* Modal Header */}
                        <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <Layers className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} /> Create Wave
                            </h3>
                            <button onClick={() => setShowCreateWave(false)} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Wave Name</label>
                                    <input
                                        type="text"
                                        value={newWaveName}
                                        onChange={e => setNewWaveName(e.target.value)}
                                        placeholder="e.g., Morning Wave 14-Mar"
                                        className="w-full px-3.5 py-2.5 rounded-lg text-sm"
                                        style={{
                                            border: '1px solid var(--odoo-border-ghost)',
                                            backgroundColor: 'var(--odoo-surface)',
                                            color: 'var(--odoo-text)',
                                            outline: 'none',
                                        }}
                                        onFocus={e => e.target.style.borderColor = 'var(--odoo-purple)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--odoo-border-ghost)'}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Wave Type</label>
                                    <div className="flex gap-2">
                                        {WAVE_TEMPLATES.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => { setNewWaveType(t.id); if (!newWaveName) setNewWaveName(t.name); }}
                                                className="flex-1 p-2.5 text-center text-xs font-semibold rounded-lg transition-all"
                                                style={{
                                                    border: `2px solid ${newWaveType === t.id ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                                    backgroundColor: newWaveType === t.id ? 'rgba(113,75,103,0.06)' : 'var(--odoo-surface)',
                                                    color: newWaveType === t.id ? 'var(--odoo-purple)' : 'var(--odoo-text)',
                                                }}
                                            >
                                                <span className="text-base block mb-0.5">{t.icon}</span>
                                                {t.name.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Order Selection */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-secondary)' }}>
                                        Select Orders ({selectedOrderIds.length} selected)
                                    </label>
                                    <button onClick={selectAllOrders} className="text-xs font-medium" style={{ color: 'var(--odoo-purple)' }}
                                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                        {selectedOrderIds.length === assignableOrders.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {assignableOrders.length === 0 ? (
                                    <div className="text-center py-10 rounded-lg" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-muted)' }}>
                                        <p className="text-sm">No orders available to assign</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                                        {assignableOrders.map(order => {
                                            const isSelected = selectedOrderIds.includes(order.id);
                                            const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                            return (
                                                <button
                                                    key={order.id}
                                                    onClick={() => toggleOrderSelect(order.id)}
                                                    className="w-full p-3 flex items-center gap-3 transition-all text-left rounded-lg"
                                                    style={{
                                                        border: `1px solid ${isSelected ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                                        backgroundColor: isSelected ? 'rgba(113,75,103,0.06)' : 'var(--odoo-surface)',
                                                    }}
                                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? 'rgba(113,75,103,0.06)' : 'var(--odoo-surface)'; }}
                                                >
                                                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{
                                                        border: `2px solid ${isSelected ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                                        backgroundColor: isSelected ? 'var(--odoo-purple)' : 'var(--odoo-surface)',
                                                        color: 'white',
                                                    }}>
                                                        {isSelected && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <PlatformBadge name={order.courier || order.platform} size={24} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm" style={{ color: 'var(--odoo-text)' }}>{order.ref}</p>
                                                        <p className="text-xs truncate" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                            {order.customer} | {order.items?.reduce((s, i) => s + i.expected, 0)} items
                                                        </p>
                                                    </div>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded shrink-0" style={{
                                                        backgroundColor: order.status === 'picked' ? 'var(--odoo-info-light)' : '#fff8e1',
                                                        color: order.status === 'picked' ? 'var(--odoo-info)' : '#856404',
                                                    }}>
                                                        {order.status}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <button
                                onClick={() => setShowCreateWave(false)}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                style={{
                                    border: '1px solid var(--odoo-border-ghost)',
                                    color: 'var(--odoo-text-secondary)',
                                    backgroundColor: 'var(--odoo-surface)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateWave}
                                disabled={!newWaveName.trim() || selectedOrderIds.length === 0}
                                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 shadow-md transition-opacity disabled:opacity-40"
                                style={{ background: 'linear-gradient(to right, #57344f, var(--odoo-purple))' }}
                            >
                                <Layers className="w-4 h-4" /> Create Wave ({selectedOrderIds.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sorting;
