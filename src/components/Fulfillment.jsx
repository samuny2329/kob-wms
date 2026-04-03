import React, { useState, useMemo } from 'react';
import { PackageCheck, Search, CheckCircle2, Clock, Truck, Package, ChevronRight, Printer, RefreshCw, ExternalLink, Check, Filter } from 'lucide-react';
import { PLATFORM_LABELS } from '../constants';
import { getTrackingUrl } from '../utils';
import { PlatformBadge } from './PlatformLogo';

const Fulfillment = ({ salesOrders, handleFulfillmentAndAWB, isProcessingAPI, addToast }) => {
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [expandedOrder, setExpandedOrder] = useState(null);

    const filteredOrders = useMemo(() => {
        let orders = [...salesOrders];
        if (statusFilter !== 'all') {
            const filterMap = {
                'pending': ['pending'],
                'processing': ['picking', 'picked', 'packing'],
                'packed': ['packed'],
                'shipped': ['rts', 'locked'],
            };
            orders = orders.filter(o => filterMap[statusFilter]?.includes(o.status));
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            orders = orders.filter(o =>
                o.ref?.toLowerCase().includes(q) ||
                o.customer?.toLowerCase().includes(q) ||
                o.awb?.toLowerCase().includes(q)
            );
        }
        return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [salesOrders, statusFilter, searchQuery]);

    const stats = useMemo(() => {
        const total = salesOrders.length;
        const shipped = salesOrders.filter(o => ['rts', 'locked'].includes(o.status)).length;
        const packed = salesOrders.filter(o => o.status === 'packed').length;
        const processing = salesOrders.filter(o => ['picking', 'picked', 'packing'].includes(o.status)).length;
        const pending = salesOrders.filter(o => o.status === 'pending').length;
        const rate = total > 0 ? Math.round((shipped / total) * 100) : 0;
        return { total, shipped, packed, processing, pending, rate };
    }, [salesOrders]);

    const toggleSelect = (orderId) => {
        setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
    };

    const selectAll = () => {
        const packableIds = filteredOrders.filter(o => o.status === 'packed').map(o => o.id);
        if (selectedOrders.length === packableIds.length) {
            setSelectedOrders([]);
        } else {
            setSelectedOrders(packableIds);
        }
    };

    const handleBulkRTS = () => {
        selectedOrders.forEach(id => {
            const order = salesOrders.find(o => o.id === id && o.status === 'packed');
            if (order) handleFulfillmentAndAWB(order);
        });
        addToast(`Bulk RTS: ${selectedOrders.length} orders processed`);
        setSelectedOrders([]);
    };

    const getStatusTimeline = (order) => {
        const steps = [
            { key: 'confirmed', label: 'Confirmed', done: true },
            { key: 'picked', label: 'Picked', done: ['picked', 'packing', 'packed', 'rts', 'locked'].includes(order.status) },
            { key: 'packed', label: 'Packed', done: ['packed', 'rts', 'locked'].includes(order.status) },
            { key: 'rts', label: 'Shipped', done: ['rts', 'locked'].includes(order.status) },
        ];
        return steps;
    };

    const statusColors = {
        pending: { style: { backgroundColor: '#fff8e1', color: '#856404', border: '1px solid var(--odoo-warning)' }, label: 'Pending' },
        picking: { style: { backgroundColor: '#e8f4fd', color: '#0c5460', border: '1px solid #17a2b8' }, label: 'Picking' },
        picked: { style: { backgroundColor: '#e8e8f5', color: '#3730a3', border: '1px solid #c7d2fe' }, label: 'Picked' },
        packing: { style: { backgroundColor: '#f3edf7', color: 'var(--odoo-purple)', border: '1px solid #c9a8bc' }, label: 'Packing' },
        packed: { style: { backgroundColor: '#e0f5f5', color: 'var(--odoo-teal)', border: '1px solid #00A09D' }, label: 'Packed' },
        rts: { style: { backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' }, label: 'Shipped' },
        locked: { style: { backgroundColor: '#fff5f5', color: '#721c24', border: '1px solid #f5c6cb' }, label: 'Locked' },
    };

    return (
        <div className="w-full animate-slide-up">
            {/* Stats Row */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
                {[
                    { label: 'Total', val: stats.total, color: 'var(--odoo-text)' },
                    { label: 'Pending', val: stats.pending, color: 'var(--odoo-warning)' },
                    { label: 'Processing', val: stats.processing, color: 'var(--odoo-info)' },
                    { label: 'Packed', val: stats.packed, color: 'var(--odoo-teal)' },
                    { label: 'Shipped', val: stats.shipped, color: 'var(--odoo-success)' },
                    { label: 'Rate', val: `${stats.rate}%`, color: 'var(--odoo-purple)' },
                ].map((s, i) => (
                    <div key={i} style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid #dee2e6', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
                        <p style={{ fontSize: '20px', fontWeight: 800, color: s.color, lineHeight: 1.2, marginTop: '2px' }}>{s.val}</p>
                    </div>
                ))}
            </div>

            <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Header */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: 'var(--odoo-surface-low)' }}>
                    <div className="flex flex-wrap gap-4 justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div style={{ width: '34px', height: '34px', borderRadius: '4px', backgroundColor: 'var(--odoo-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--odoo-surface)' }}>
                                <PackageCheck className="w-5 h-5" />
                            </div>
                            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)' }}>Fulfillment</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            {selectedOrders.length > 0 && (
                                <button onClick={handleBulkRTS} disabled={isProcessingAPI} className="odoo-btn flex items-center gap-1.5"
                                    style={{ backgroundColor: 'var(--odoo-purple)', color: 'var(--odoo-surface)', borderColor: 'var(--odoo-purple)', opacity: isProcessingAPI ? 0.5 : 1 }}>
                                    {isProcessingAPI ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                                    Bulk RTS ({selectedOrders.length})
                                </button>
                            )}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..."
                                    className="odoo-input" style={{ paddingLeft: '32px', width: '192px' }} />
                            </div>
                        </div>
                    </div>
                    {/* Status Filter Tabs */}
                    <div className="flex gap-1 mt-3">
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'pending', label: 'Pending' },
                            { key: 'processing', label: 'Processing' },
                            { key: 'packed', label: 'Packed' },
                            { key: 'shipped', label: 'Shipped' },
                        ].map(f => (
                            <button key={f.key} onClick={() => setStatusFilter(f.key)}
                                style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: statusFilter === f.key ? 'var(--odoo-purple)' : 'transparent', color: statusFilter === f.key ? 'var(--odoo-surface)' : 'var(--odoo-text-secondary)', transition: 'background-color 0.15s' }}
                                onMouseEnter={e => { if (statusFilter !== f.key) e.currentTarget.style.backgroundColor = '#f3edf7'; }}
                                onMouseLeave={e => { if (statusFilter !== f.key) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Orders List */}
                <div>
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-16" style={{ color: 'var(--odoo-text-muted)' }}>
                            <PackageCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p style={{ fontSize: '13px', fontWeight: 600 }}>No orders found</p>
                        </div>
                    ) : (
                        filteredOrders.map(order => {
                            const sc = statusColors[order.status] || statusColors.pending;
                            const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                            const timeline = getStatusTimeline(order);
                            const isExpanded = expandedOrder === order.id;
                            const isSelectable = order.status === 'packed';

                            return (
                                <div key={order.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <div className="flex items-center gap-3" style={{ padding: '12px 16px' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                                    >
                                        {/* Checkbox */}
                                        {isSelectable && (
                                            <button onClick={() => toggleSelect(order.id)}
                                                style={{ width: '18px', height: '18px', borderRadius: '3px', border: `2px solid ${selectedOrders.includes(order.id) ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: selectedOrders.includes(order.id) ? 'var(--odoo-purple)' : 'var(--odoo-surface)', cursor: 'pointer' }}>
                                                {selectedOrders.includes(order.id) && <Check className="w-3 h-3" style={{ color: 'var(--odoo-surface)' }} />}
                                            </button>
                                        )}
                                        {!isSelectable && <div style={{ width: '18px' }} />}

                                        {/* Platform icon */}
                                        <PlatformBadge name={order.courier || order.platform} size={30} rounded="sm" />

                                        {/* Order info */}
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--odoo-text)' }}>{order.ref}</span>
                                                <span className="odoo-badge" style={sc.style}>{sc.label}</span>
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }} className="truncate">{order.customer} | {order.items?.reduce((s, i) => s + i.expected, 0)} items</p>
                                        </div>

                                        {/* Timeline mini */}
                                        <div className="hidden md:flex items-center gap-1" style={{ flexShrink: 0 }}>
                                            {timeline.map((step, si) => (
                                                <React.Fragment key={step.key}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: step.done ? 'var(--odoo-teal)' : 'var(--odoo-border-ghost)' }} title={step.label} />
                                                    {si < timeline.length - 1 && <div style={{ width: '16px', height: '2px', backgroundColor: step.done ? 'var(--odoo-teal)' : 'var(--odoo-border-ghost)' }} />}
                                                </React.Fragment>
                                            ))}
                                        </div>

                                        {/* AWB */}
                                        {order.awb && (
                                            <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--odoo-teal)', backgroundColor: '#e0f5f5', border: '1px solid #00A09D', borderRadius: '4px', padding: '2px 8px', flexShrink: 0 }}>{order.awb}</span>
                                        )}

                                        {/* Actions */}
                                        {order.status === 'packed' && (
                                            <button onClick={() => handleFulfillmentAndAWB(order)} disabled={isProcessingAPI}
                                                className="odoo-btn flex items-center gap-1"
                                                style={{ backgroundColor: 'var(--odoo-purple)', color: 'var(--odoo-surface)', borderColor: 'var(--odoo-purple)', fontSize: '11px', flexShrink: 0, opacity: isProcessingAPI ? 0.5 : 1 }}>
                                                <Printer className="w-3 h-3" /> RTS
                                            </button>
                                        )}

                                        <ChevronRight className="w-4 h-4 shrink-0 transition-transform" style={{ color: 'var(--odoo-text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'none' }} />
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className="animate-slide-up" style={{ padding: '16px 24px 20px', backgroundColor: 'var(--odoo-surface-low)', borderTop: '1px solid #dee2e6' }}>
                                            {/* Full Timeline */}
                                            <div className="flex items-center justify-center gap-0 mb-5 py-4">
                                                {timeline.map((step, si) => (
                                                    <React.Fragment key={step.key}>
                                                        <div className="flex flex-col items-center">
                                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: step.done ? 'var(--odoo-teal)' : 'var(--odoo-surface-high)', color: step.done ? 'var(--odoo-surface)' : 'var(--odoo-text-muted)', fontSize: '12px', fontWeight: 700 }}>
                                                                {step.done ? <CheckCircle2 className="w-4 h-4" /> : si + 1}
                                                            </div>
                                                            <p style={{ fontSize: '10px', fontWeight: 700, marginTop: '6px', color: step.done ? 'var(--odoo-teal)' : 'var(--odoo-text-muted)' }}>{step.label}</p>
                                                        </div>
                                                        {si < timeline.length - 1 && (
                                                            <div style={{ width: '64px', height: '2px', marginTop: '-16px', backgroundColor: step.done ? 'var(--odoo-teal)' : 'var(--odoo-border-ghost)' }} />
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>

                                            {/* Order Items */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {order.items?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid #dee2e6', borderRadius: '4px', padding: '10px 12px' }}>
                                                        <div>
                                                            <p style={{ fontWeight: 700, fontSize: '12px', color: 'var(--odoo-text)' }}>{item.name}</p>
                                                            <p style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--odoo-text-muted)', marginTop: '2px' }}>{item.sku}</p>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <p style={{ fontWeight: 800, fontSize: '13px', color: 'var(--odoo-text)' }}>{item.packed || 0}/{item.picked || 0}/{item.expected}</p>
                                                            <p style={{ fontSize: '9px', color: 'var(--odoo-text-muted)' }}>packed/picked/expected</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* AWB & Tracking */}
                                            {order.awb && (
                                                <div className="mt-4 flex items-center justify-between" style={{ backgroundColor: '#e0f5f5', border: '1px solid #00A09D', borderRadius: '4px', padding: '14px 16px' }}>
                                                    <div>
                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-teal)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AWB / Tracking Number</p>
                                                        <p style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '16px', color: '#014d50', marginTop: '4px' }}>{order.awb}</p>
                                                    </div>
                                                    {getTrackingUrl && (
                                                        <a href={getTrackingUrl(order.courier, order.awb) || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-teal)', textDecoration: 'none' }}
                                                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                                        >
                                                            Track <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default Fulfillment;
