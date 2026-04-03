import React, { useState, useMemo } from 'react';
import { Layers, Plus, ChevronRight, ChevronDown, Check, X, Package, Clock, Truck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { WAVE_TEMPLATES, PLATFORM_LABELS } from '../constants';
import { PlatformBadge } from './PlatformLogo';

const Sorting = ({ salesOrders, waves, setWaves, addToast }) => {
    const [showCreateWave, setShowCreateWave] = useState(false);
    const [newWaveName, setNewWaveName] = useState('');
    const [newWaveType, setNewWaveType] = useState('morning');
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [expandedWave, setExpandedWave] = useState(null);

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
        return { total, picked, packed, shipped, courierGroups };
    };

    return (
        <div className="w-full animate-slide-up">
            {/* Header */}
            <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div className="px-5 py-3 flex flex-wrap gap-3 justify-between items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: 'var(--odoo-surface-low)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded flex items-center justify-center text-white shrink-0" style={{ backgroundColor: 'var(--odoo-purple)' }}>
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>Wave Sorting</h2>
                            <p className="text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>{(waves || []).filter(w => w.status === 'active').length} active waves</p>
                        </div>
                    </div>
                    <button onClick={() => setShowCreateWave(true)} className="odoo-btn odoo-btn-primary flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Create Wave
                    </button>
                </div>

                {/* Active Waves */}
                <div>
                    {(!waves || waves.length === 0) ? (
                        <div className="text-center py-14" style={{ color: 'var(--odoo-text-muted)' }}>
                            <Layers className="w-9 h-9 mx-auto mb-2.5 opacity-20" />
                            <p className="text-sm">No waves created yet</p>
                            <p className="text-xs mt-1">Create a wave to group orders by batch</p>
                        </div>
                    ) : (
                        waves.map(wave => {
                            const stats = getWaveStats(wave);
                            const isExpanded = expandedWave === wave.id;
                            const pickProgress = stats.total > 0 ? Math.round((stats.picked / stats.total) * 100) : 0;
                            const packProgress = stats.total > 0 ? Math.round((stats.packed / stats.total) * 100) : 0;

                            return (
                                <div key={wave.id} style={{ borderBottom: '1px solid var(--odoo-surface-high)' }}>
                                    <div className="p-4 cursor-pointer transition-colors"
                                        style={{ backgroundColor: 'var(--odoo-surface)' }}
                                        onClick={() => setExpandedWave(isExpanded ? null : wave.id)}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xl">{wave.icon}</span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-sm" style={{ color: 'var(--odoo-text)' }}>{wave.name}</h3>
                                                        <span className="odoo-badge text-[10px]" style={{
                                                            backgroundColor: wave.status === 'active' ? '#e8f5e9' : 'var(--odoo-surface-low)',
                                                            color: wave.status === 'active' ? 'var(--odoo-success)' : 'var(--odoo-text-secondary)',
                                                            border: `1px solid ${wave.status === 'active' ? '#b8e0c4' : 'var(--odoo-border-ghost)'}`,
                                                        }}>
                                                            {wave.status === 'active' ? 'Active' : 'Closed'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                        <Clock className="w-3 h-3 inline mr-1" />{wave.timeRange} | {stats.total} orders
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="hidden sm:flex items-center gap-4 text-xs">
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>Picked</p>
                                                        <p className="font-bold" style={{ color: 'var(--odoo-purple)' }}>{pickProgress}%</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>Packed</p>
                                                        <p className="font-bold" style={{ color: 'var(--odoo-teal)' }}>{packProgress}%</p>
                                                    </div>
                                                </div>
                                                {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--odoo-border-ghost)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--odoo-border-ghost)' }} />}
                                            </div>
                                        </div>
                                        {/* Progress bars */}
                                        <div className="mt-3 flex gap-2">
                                            <div className="flex-1 h-1 rounded overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                <div className="h-full rounded transition-all" style={{ width: `${pickProgress}%`, backgroundColor: 'var(--odoo-purple)' }} />
                                            </div>
                                            <div className="flex-1 h-1 rounded overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                <div className="h-full rounded transition-all" style={{ width: `${packProgress}%`, backgroundColor: 'var(--odoo-teal)' }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded: Courier Groups */}
                                    {isExpanded && (
                                        <div className="px-5 pb-5 animate-slide-up" style={{ backgroundColor: 'var(--odoo-surface-low)', borderTop: '1px solid #dee2e6' }}>
                                            <div className="flex justify-between items-center py-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--odoo-text-secondary)' }}>Courier Groups</p>
                                                {wave.status === 'active' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleCloseWave(wave.id); }} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--odoo-danger)' }}>
                                                        <X className="w-3 h-3" /> Close Wave
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {Object.entries(stats.courierGroups).map(([courier, orders]) => {
                                                    const pl = PLATFORM_LABELS[courier];
                                                    const done = orders.filter(o => ['packed', 'rts'].includes(o.status)).length;
                                                    return (
                                                        <div key={courier} className="p-3" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <PlatformBadge name={order.courier || order.platform} size={28} />
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
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Create Wave Modal */}
            {showCreateWave && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3.5 flex justify-between items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <Layers className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Create Wave
                            </h3>
                            <button onClick={() => setShowCreateWave(false)} className="p-1 rounded hover:bg-gray-200" style={{ color: 'var(--odoo-text-secondary)' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Wave Name</label>
                                    <input type="text" value={newWaveName} onChange={e => setNewWaveName(e.target.value)} placeholder="e.g., Morning Wave 14-Mar" className="odoo-input w-full" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Wave Type</label>
                                    <div className="flex gap-2">
                                        {WAVE_TEMPLATES.map(t => (
                                            <button key={t.id} onClick={() => { setNewWaveType(t.id); if (!newWaveName) setNewWaveName(t.name); }}
                                                className="flex-1 p-2 text-center text-xs font-semibold transition-all"
                                                style={{
                                                    border: `2px solid ${newWaveType === t.id ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                                    borderRadius: '4px',
                                                    backgroundColor: newWaveType === t.id ? '#f9f5f8' : 'var(--odoo-surface)',
                                                    color: 'var(--odoo-text)',
                                                }}
                                            >
                                                <span className="text-base block mb-0.5">{t.icon}</span>
                                                {t.name.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--odoo-text-secondary)' }}>Select Orders ({selectedOrderIds.length} selected)</label>
                                    <button onClick={selectAllOrders} className="text-xs font-medium underline" style={{ color: 'var(--odoo-purple)' }}>
                                        {selectedOrderIds.length === assignableOrders.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {assignableOrders.length === 0 ? (
                                    <div className="text-center py-8 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid #dee2e6', color: 'var(--odoo-text-muted)' }}>
                                        <p className="text-sm">No orders available to assign</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                                        {assignableOrders.map(order => {
                                            const isSelected = selectedOrderIds.includes(order.id);
                                            const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                            return (
                                                <button key={order.id} onClick={() => toggleOrderSelect(order.id)}
                                                    className="w-full p-2.5 flex items-center gap-2.5 transition-all text-left"
                                                    style={{
                                                        border: `1px solid ${isSelected ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                                        borderRadius: '4px',
                                                        backgroundColor: isSelected ? '#f9f5f8' : 'var(--odoo-surface)',
                                                    }}
                                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}
                                                >
                                                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{
                                                        border: `2px solid ${isSelected ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                                        backgroundColor: isSelected ? 'var(--odoo-purple)' : 'var(--odoo-surface)',
                                                        color: 'var(--odoo-surface)',
                                                    }}>
                                                        {isSelected && <Check className="w-2.5 h-2.5" />}
                                                    </div>
                                                    <PlatformBadge name={order.courier || order.platform} size={24} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm" style={{ color: 'var(--odoo-text)' }}>{order.ref}</p>
                                                        <p className="text-xs truncate" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer} | {order.items?.reduce((s, i) => s + i.expected, 0)} items</p>
                                                    </div>
                                                    <span className="odoo-badge text-[10px] shrink-0" style={{
                                                        backgroundColor: order.status === 'picked' ? '#e8f4fd' : '#fff8e1',
                                                        color: order.status === 'picked' ? 'var(--odoo-info)' : '#856404',
                                                    }}>{order.status}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid #dee2e6', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <button onClick={() => setShowCreateWave(false)} className="odoo-btn odoo-btn-secondary">Cancel</button>
                            <button onClick={handleCreateWave} disabled={!newWaveName.trim() || selectedOrderIds.length === 0} className="odoo-btn odoo-btn-primary disabled:opacity-50 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" /> Create Wave ({selectedOrderIds.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sorting;
