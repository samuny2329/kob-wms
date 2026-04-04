import React, { useState, useMemo } from 'react';
import { Search, CheckCircle2, Truck, TrendingUp, AlertTriangle, MoreHorizontal, GripVertical, Timer, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { PLATFORM_LABELS } from '../constants';
import { getTrackingUrl } from '../utils';

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

    const platformBreakdown = useMemo(() => {
        const counts = {};
        salesOrders.forEach(o => {
            const key = o.platform || o.courier || 'Other';
            counts[key] = (counts[key] || 0) + 1;
        });
        const total = salesOrders.length || 1;
        const platforms = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({
                name: PLATFORM_LABELS[name]?.name || name,
                count,
                pct: Math.round((count / total) * 100),
            }));
        return { platforms, total: salesOrders.length };
    }, [salesOrders]);

    const slaAlerts = useMemo(() => {
        const now = Date.now();
        return salesOrders
            .filter(o => ['pending', 'picking', 'picked', 'packing'].includes(o.status))
            .map(o => {
                const elapsed = o.createdAt ? Math.round((now - o.createdAt) / 60000) : 0;
                const slaLimit = 120;
                const remaining = slaLimit - elapsed;
                return { ...o, elapsed, remaining };
            })
            .sort((a, b) => a.remaining - b.remaining)
            .slice(0, 5);
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
        pending: { style: { backgroundColor: 'var(--odoo-warning-light)', color: 'var(--odoo-warning-dark)', border: '1px solid var(--odoo-warning)' }, label: 'Pending' },
        picking: { style: { backgroundColor: 'var(--odoo-info-light)', color: 'var(--odoo-info-dark)', border: '1px solid var(--odoo-info)' }, label: 'Picking' },
        picked: { style: { backgroundColor: 'var(--odoo-purple-light)', color: 'var(--odoo-purple)', border: '1px solid var(--odoo-purple-border)' }, label: 'Picked' },
        packing: { style: { backgroundColor: 'var(--odoo-purple-light)', color: 'var(--odoo-purple)', border: '1px solid var(--odoo-purple-border)' }, label: 'Packing' },
        packed: { style: { backgroundColor: '#e0f5f5', color: 'var(--odoo-teal)', border: '1px solid var(--odoo-teal)' }, label: 'Packed' },
        rts: { style: { backgroundColor: 'var(--odoo-success-bg)', color: 'var(--odoo-success-dark)', border: '1px solid var(--odoo-success-border)' }, label: 'Shipped' },
        locked: { style: { backgroundColor: 'var(--odoo-danger-light)', color: '#721c24', border: '1px solid #f5c6cb' }, label: 'Locked' },
    };

    const kanbanColumns = useMemo(() => {
        const cols = {
            pending: { label: 'Pending', orders: [], dotColor: 'var(--odoo-warning)' },
            processing: { label: 'Processing', orders: [], dotColor: 'var(--odoo-info)' },
            packed: { label: 'Packed', orders: [], dotColor: 'var(--odoo-teal)' },
            shipped: { label: 'Shipped', orders: [], dotColor: 'var(--odoo-success)' },
        };
        let ordersToShow = [...salesOrders];
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            ordersToShow = ordersToShow.filter(o =>
                o.ref?.toLowerCase().includes(q) ||
                o.customer?.toLowerCase().includes(q) ||
                o.awb?.toLowerCase().includes(q)
            );
        }
        ordersToShow.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        ordersToShow.forEach(o => {
            if (o.status === 'pending') cols.pending.orders.push(o);
            else if (['picking', 'picked', 'packing'].includes(o.status)) cols.processing.orders.push(o);
            else if (o.status === 'packed') cols.packed.orders.push(o);
            else if (['rts', 'locked'].includes(o.status)) cols.shipped.orders.push(o);
        });
        return cols;
    }, [salesOrders, searchQuery]);

    const donutColors = ['var(--odoo-teal)', 'var(--odoo-purple)', 'var(--odoo-coral-dark)', 'var(--odoo-teal-light)', 'var(--odoo-warning)', 'var(--odoo-info)'];

    const donutGradient = useMemo(() => {
        const platforms = platformBreakdown.platforms;
        if (platforms.length === 0) return 'var(--odoo-surface-high)';
        let segments = [];
        let cumulative = 0;
        platforms.forEach((p, i) => {
            const start = cumulative;
            cumulative += p.pct;
            const end = cumulative;
            segments.push(`${donutColors[i % donutColors.length]} ${start}% ${end}%`);
        });
        return `conic-gradient(${segments.join(', ')})`;
    }, [platformBreakdown]);

    const avgProcessingTime = useMemo(() => {
        const shipped = salesOrders.filter(o => ['rts', 'locked'].includes(o.status) && o.createdAt && o.shippedAt);
        if (shipped.length === 0) return '--';
        const totalMin = shipped.reduce((sum, o) => sum + Math.round((o.shippedAt - o.createdAt) / 60000), 0);
        return `${Math.round(totalMin / shipped.length)}m`;
    }, [salesOrders]);

    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* KPI Strip */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Fulfillment Rate */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '20px',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                    borderTop: '4px solid var(--odoo-teal)',
                }}>
                    <p style={{
                        fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px',
                    }}>
                        Fulfillment Rate
                    </p>
                    <div className="flex items-end gap-2">
                        <span style={{
                            fontSize: '30px', fontWeight: 800, color: 'var(--odoo-teal)',
                            letterSpacing: '-0.02em', lineHeight: 1,
                        }}>
                            {stats.rate}%
                        </span>
                        {stats.rate > 0 && (
                            <span className="flex items-center" style={{
                                color: 'var(--odoo-teal)', fontSize: '13px', fontWeight: 500, paddingBottom: '2px',
                            }}>
                                <TrendingUp className="w-4 h-4 mr-0.5" />
                                +{Math.min(stats.rate, 5)}%
                            </span>
                        )}
                    </div>
                </div>

                {/* Orders Processed Today */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '20px',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                }}>
                    <p style={{
                        fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px',
                    }}>
                        Orders Processed Today
                    </p>
                    <div className="flex items-end gap-2">
                        <span style={{
                            fontSize: '30px', fontWeight: 800, color: 'var(--odoo-text)',
                            letterSpacing: '-0.02em', lineHeight: 1,
                        }}>
                            {stats.shipped.toLocaleString()}
                        </span>
                        <span style={{ color: 'var(--odoo-text-muted)', fontSize: '12px', paddingBottom: '2px' }}>Units</span>
                    </div>
                </div>

                {/* Avg Processing Time */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '20px',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                }}>
                    <p style={{
                        fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px',
                    }}>
                        Avg Processing Time
                    </p>
                    <div className="flex items-end gap-2">
                        <span style={{
                            fontSize: '30px', fontWeight: 800, color: 'var(--odoo-text)',
                            letterSpacing: '-0.02em', lineHeight: 1,
                        }}>
                            {avgProcessingTime}
                        </span>
                        <span style={{ color: 'var(--odoo-text-muted)', fontSize: '12px', paddingBottom: '2px' }}>Per Order</span>
                    </div>
                </div>

                {/* Backlog Count */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '20px',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                    borderTop: '4px solid var(--odoo-coral-dark)',
                }}>
                    <p style={{
                        fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px',
                    }}>
                        Backlog Count
                    </p>
                    <div className="flex items-end gap-2">
                        <span style={{
                            fontSize: '30px', fontWeight: 800, color: 'var(--odoo-coral-dark)',
                            letterSpacing: '-0.02em', lineHeight: 1,
                        }}>
                            {stats.pending + stats.processing}
                        </span>
                        <span style={{
                            color: 'var(--odoo-danger)', fontSize: '11px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '-0.02em', paddingBottom: '2px',
                        }}>
                            Needs Action
                        </span>
                    </div>
                </div>
            </section>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6" style={{
                backgroundColor: 'var(--odoo-surface-low)',
                padding: '12px 16px',
                borderRadius: 'var(--odoo-radius)',
                fontSize: '13px',
                fontWeight: 500,
            }}>
                {/* Status Filter Tabs */}
                <div className="flex gap-1" style={{
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                    borderRadius: 'var(--odoo-radius)',
                    padding: '2px',
                }}>
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'pending', label: 'Pending' },
                        { key: 'processing', label: 'Processing' },
                        { key: 'packed', label: 'Packed' },
                        { key: 'shipped', label: 'Shipped' },
                    ].map(f => (
                        <button key={f.key} onClick={() => setStatusFilter(f.key)}
                            style={{
                                padding: '5px 14px',
                                borderRadius: 'var(--odoo-radius)',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: statusFilter === f.key ? 'var(--odoo-purple)' : 'transparent',
                                color: statusFilter === f.key ? '#fff' : 'var(--odoo-text-secondary)',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { if (statusFilter !== f.key) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'; }}
                            onMouseLeave={e => { if (statusFilter !== f.key) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative ml-auto">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search Order ID..."
                        style={{
                            paddingLeft: '34px',
                            paddingRight: '12px',
                            paddingTop: '7px',
                            paddingBottom: '7px',
                            width: '220px',
                            fontSize: '13px',
                            border: '1px solid var(--odoo-border-ghost)',
                            borderRadius: 'var(--odoo-radius)',
                            backgroundColor: 'var(--odoo-surface)',
                            color: 'var(--odoo-text)',
                            outline: 'none',
                        }}
                    />
                </div>

                {/* Bulk RTS button */}
                {selectedOrders.length > 0 && (
                    <button onClick={handleBulkRTS} disabled={isProcessingAPI}
                        className="flex items-center gap-1.5"
                        style={{
                            backgroundColor: 'var(--odoo-purple)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--odoo-radius)',
                            padding: '7px 16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            opacity: isProcessingAPI ? 0.5 : 1,
                            transition: 'opacity 0.15s ease',
                        }}>
                        {isProcessingAPI ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                        Bulk RTS ({selectedOrders.length})
                    </button>
                )}
            </div>

            {/* Main Grid: Kanban + Sidebar */}
            <div className="grid grid-cols-12 gap-6">

                {/* Kanban Orders Pipeline */}
                <div className="col-span-12 lg:col-span-9">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {Object.entries(kanbanColumns).map(([colKey, col]) => (
                            <div key={colKey} className="flex flex-col gap-3">
                                {/* Column Header */}
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="flex items-center gap-2" style={{
                                        fontWeight: 700, fontSize: '13px', color: 'var(--odoo-text)',
                                    }}>
                                        {col.label}
                                        <span style={{
                                            backgroundColor: 'var(--odoo-surface-high)',
                                            padding: '1px 8px',
                                            borderRadius: '999px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: 'var(--odoo-text-secondary)',
                                        }}>
                                            {col.orders.length}
                                        </span>
                                    </h3>
                                    <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
                                </div>

                                {/* Cards */}
                                <div className="space-y-3" style={{ opacity: colKey === 'shipped' ? 0.8 : 1 }}>
                                    {col.orders.length === 0 && (
                                        <div style={{
                                            padding: '24px 16px',
                                            textAlign: 'center',
                                            color: 'var(--odoo-text-muted)',
                                            fontSize: '12px',
                                            backgroundColor: 'var(--odoo-surface)',
                                            borderRadius: 'var(--odoo-radius)',
                                            border: '1px dashed var(--odoo-border)',
                                        }}>
                                            No orders
                                        </div>
                                    )}
                                    {col.orders.slice(0, 5).map(order => {
                                        const sc = statusColors[order.status] || statusColors.pending;
                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                        const itemCount = order.items?.reduce((s, i) => s + i.expected, 0) || 0;
                                        const isUrgent = colKey === 'pending' && order.createdAt && (Date.now() - order.createdAt) > 3600000;
                                        const isSelectable = order.status === 'packed';
                                        const isExpanded = expandedOrder === order.id;

                                        return (
                                            <div key={order.id}
                                                className="group"
                                                style={{
                                                    backgroundColor: 'var(--odoo-surface)',
                                                    padding: '14px 16px',
                                                    borderRadius: 'var(--odoo-radius)',
                                                    boxShadow: 'var(--odoo-shadow-sm)',
                                                    border: isUrgent ? '1px solid var(--odoo-coral-dark)' : '1px solid transparent',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    transition: 'box-shadow 0.15s ease',
                                                }}
                                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--odoo-shadow-md)'}
                                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--odoo-shadow-sm)'}
                                            >
                                                {/* Urgent left accent bar */}
                                                {isUrgent && (
                                                    <div style={{
                                                        position: 'absolute', top: 0, left: 0,
                                                        width: '3px', height: '100%',
                                                        backgroundColor: 'var(--odoo-danger)',
                                                    }} />
                                                )}

                                                {/* Card header: ref + platform badge */}
                                                <div className="flex justify-between items-start mb-2">
                                                    <span style={{
                                                        fontWeight: 700, fontSize: '12px',
                                                        color: isUrgent ? 'var(--odoo-danger)' : 'var(--odoo-purple)',
                                                    }}>
                                                        {order.ref}
                                                    </span>
                                                    {pl && (
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: 700,
                                                            padding: '2px 8px', borderRadius: '999px',
                                                            backgroundColor: colKey === 'processing' ? 'var(--odoo-purple)' : 'var(--odoo-surface-high)',
                                                            color: colKey === 'processing' ? '#fff' : 'var(--odoo-text-secondary)',
                                                        }}>
                                                            {pl.name}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Customer name */}
                                                <p style={{
                                                    fontSize: '13px', fontWeight: 600,
                                                    color: 'var(--odoo-text)', marginBottom: '2px',
                                                }}>
                                                    {order.customer || 'Unknown'}
                                                </p>
                                                <p style={{
                                                    fontSize: '11px', color: 'var(--odoo-text-muted)', marginBottom: '10px',
                                                }}>
                                                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                                                    {order.items?.some(i => i.fragile) ? ' \u2022 Fragile' : ''}
                                                    {colKey === 'processing' ? ' \u2022 Pick List Ready' : ''}
                                                    {colKey === 'packed' ? ' \u2022 Awaiting Courier' : ''}
                                                    {colKey === 'shipped' && order.courier ? ` \u2022 Shipped via ${PLATFORM_LABELS[order.courier]?.name || order.courier}` : ''}
                                                </p>

                                                {/* Card footer varies by column */}
                                                {colKey === 'pending' && (
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-1" style={{
                                                            color: isUrgent ? 'var(--odoo-danger)' : 'var(--odoo-text-muted)',
                                                            fontWeight: isUrgent ? 700 : 400,
                                                            fontSize: '11px',
                                                        }}>
                                                            <Timer className="w-3.5 h-3.5" />
                                                            <span>
                                                                {order.createdAt
                                                                    ? `${Math.max(0, Math.round((Date.now() - order.createdAt) / 60000))}m ago`
                                                                    : '--'
                                                                }
                                                            </span>
                                                        </div>
                                                        <GripVertical className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
                                                    </div>
                                                )}

                                                {colKey === 'processing' && (
                                                    <div className="flex items-center justify-between" style={{ fontSize: '11px', fontWeight: 500 }}>
                                                        <div className="flex -space-x-2">
                                                            <div style={{
                                                                width: '24px', height: '24px', borderRadius: '50%',
                                                                backgroundColor: 'var(--odoo-purple)', display: 'flex',
                                                                alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '8px', color: '#fff',
                                                                border: '2px solid var(--odoo-surface)',
                                                            }}>WK</div>
                                                        </div>
                                                        <span style={{ color: 'var(--odoo-teal)', fontWeight: 600 }}>
                                                            {order.status === 'picking' ? 'Picking...' : order.status === 'packing' ? 'Packing...' : 'Picked'}
                                                        </span>
                                                    </div>
                                                )}

                                                {colKey === 'packed' && (
                                                    <div className="flex items-center gap-2">
                                                        <div style={{
                                                            flex: 1, height: '6px', borderRadius: '999px',
                                                            backgroundColor: 'var(--odoo-surface-high)', overflow: 'hidden',
                                                        }}>
                                                            <div style={{
                                                                width: '100%', height: '100%',
                                                                backgroundColor: 'var(--odoo-teal)',
                                                            }} />
                                                        </div>
                                                        {isSelectable && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleFulfillmentAndAWB(order); }}
                                                                disabled={isProcessingAPI}
                                                                style={{
                                                                    backgroundColor: 'var(--odoo-purple)',
                                                                    color: '#fff', border: 'none',
                                                                    borderRadius: 'var(--odoo-radius)',
                                                                    padding: '3px 10px', fontSize: '10px',
                                                                    fontWeight: 700, cursor: 'pointer',
                                                                    opacity: isProcessingAPI ? 0.5 : 1,
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                RTS
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {colKey === 'shipped' && (
                                                    <div className="flex justify-between items-center mt-1">
                                                        {order.awb && (
                                                            <span style={{
                                                                fontSize: '10px', fontFamily: 'monospace',
                                                                fontWeight: 600, color: 'var(--odoo-teal)',
                                                            }}>
                                                                {order.awb}
                                                            </span>
                                                        )}
                                                        <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: 'var(--odoo-teal)' }} />
                                                    </div>
                                                )}

                                                {/* Expanded Detail */}
                                                {isExpanded && (
                                                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                                                        {/* Timeline */}
                                                        <div className="flex items-center justify-center gap-0 mb-3 py-2">
                                                            {getStatusTimeline(order).map((step, si, arr) => (
                                                                <React.Fragment key={step.key}>
                                                                    <div className="flex flex-col items-center">
                                                                        <div style={{
                                                                            width: '22px', height: '22px', borderRadius: '50%',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            backgroundColor: step.done ? 'var(--odoo-teal)' : 'var(--odoo-surface-high)',
                                                                            color: step.done ? '#fff' : 'var(--odoo-text-muted)',
                                                                            fontSize: '9px', fontWeight: 700,
                                                                        }}>
                                                                            {step.done ? <Check className="w-3 h-3" /> : si + 1}
                                                                        </div>
                                                                        <p style={{
                                                                            fontSize: '9px', fontWeight: 600, marginTop: '3px',
                                                                            color: step.done ? 'var(--odoo-teal)' : 'var(--odoo-text-muted)',
                                                                        }}>{step.label}</p>
                                                                    </div>
                                                                    {si < arr.length - 1 && (
                                                                        <div style={{
                                                                            width: '20px', height: '2px', marginTop: '-12px',
                                                                            backgroundColor: step.done ? 'var(--odoo-teal)' : 'var(--odoo-border-ghost)',
                                                                        }} />
                                                                    )}
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                        {/* Items */}
                                                        {order.items?.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center mb-1.5" style={{
                                                                backgroundColor: 'var(--odoo-surface-low)',
                                                                borderRadius: 'var(--odoo-radius)',
                                                                padding: '6px 10px', fontSize: '11px',
                                                            }}>
                                                                <div>
                                                                    <p style={{ fontWeight: 600, color: 'var(--odoo-text)' }}>{item.name}</p>
                                                                    <p style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--odoo-text-muted)' }}>{item.sku}</p>
                                                                </div>
                                                                <span style={{ fontWeight: 700, color: 'var(--odoo-text-secondary)' }}>
                                                                    {item.packed || 0}/{item.picked || 0}/{item.expected}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {/* AWB */}
                                                        {order.awb && (
                                                            <div className="mt-2 flex items-center justify-between" style={{
                                                                backgroundColor: '#e0f5f5',
                                                                border: '1px solid var(--odoo-teal)',
                                                                borderRadius: 'var(--odoo-radius)',
                                                                padding: '8px 12px',
                                                            }}>
                                                                <div>
                                                                    <p style={{
                                                                        fontSize: '9px', fontWeight: 700,
                                                                        color: 'var(--odoo-teal)', textTransform: 'uppercase',
                                                                        letterSpacing: '0.08em',
                                                                    }}>AWB</p>
                                                                    <p style={{
                                                                        fontFamily: 'monospace', fontWeight: 800,
                                                                        fontSize: '12px', color: '#014d50',
                                                                    }}>{order.awb}</p>
                                                                </div>
                                                                {getTrackingUrl && (
                                                                    <a href={getTrackingUrl(order.courier, order.awb) || '#'}
                                                                        target="_blank" rel="noopener noreferrer"
                                                                        className="flex items-center gap-1"
                                                                        style={{
                                                                            fontSize: '11px', fontWeight: 700,
                                                                            color: 'var(--odoo-teal)', textDecoration: 'none',
                                                                        }}
                                                                        onClick={e => e.stopPropagation()}
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
                                    })}

                                    {/* Show more indicator */}
                                    {col.orders.length > 5 && (
                                        <div style={{
                                            textAlign: 'center', padding: '8px',
                                            fontSize: '11px', fontWeight: 600,
                                            color: 'var(--odoo-purple)', cursor: 'pointer',
                                        }}>
                                            +{col.orders.length - 5} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Sidebar: Charts & Alerts */}
                <div className="col-span-12 lg:col-span-3 space-y-6">

                    {/* Platform Breakdown Donut */}
                    <div style={{
                        backgroundColor: 'var(--odoo-surface)',
                        padding: '20px',
                        borderRadius: 'var(--odoo-radius)',
                        boxShadow: 'var(--odoo-shadow-sm)',
                    }}>
                        <h4 style={{
                            fontSize: '13px', fontWeight: 700,
                            color: 'var(--odoo-text)', marginBottom: '24px',
                        }}>
                            Platform Breakdown
                        </h4>

                        {/* Donut Chart */}
                        <div style={{
                            position: 'relative', width: '160px', height: '160px',
                            margin: '0 auto 24px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <div style={{
                                width: '100%', height: '100%', borderRadius: '50%',
                                background: donutGradient,
                                border: '12px solid var(--odoo-surface-high)',
                            }} />
                            <div style={{
                                position: 'absolute', inset: '30px',
                                backgroundColor: 'var(--odoo-surface)', borderRadius: '50%',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
                            }}>
                                <span style={{
                                    fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '-0.02em',
                                }}>Total</span>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-text)' }}>
                                    {platformBreakdown.total >= 1000
                                        ? `${(platformBreakdown.total / 1000).toFixed(1)}k`
                                        : platformBreakdown.total}
                                </span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="space-y-2">
                            {platformBreakdown.platforms.slice(0, 5).map((p, i) => (
                                <div key={p.name} className="flex justify-between items-center" style={{ fontSize: '12px' }}>
                                    <div className="flex items-center gap-2">
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            backgroundColor: donutColors[i % donutColors.length],
                                        }} />
                                        <span style={{ color: 'var(--odoo-text-secondary)' }}>{p.name}</span>
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'var(--odoo-text)' }}>{p.pct}%</span>
                                </div>
                            ))}
                            {platformBreakdown.platforms.length === 0 && (
                                <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', textAlign: 'center' }}>No data</p>
                            )}
                        </div>
                    </div>

                    {/* SLA Alerts Panel */}
                    <div style={{
                        backgroundColor: 'var(--odoo-surface)',
                        padding: '20px',
                        borderRadius: 'var(--odoo-radius)',
                        boxShadow: 'var(--odoo-shadow-sm)',
                        borderTop: '4px solid var(--odoo-danger)',
                    }}>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="flex items-center gap-2" style={{
                                fontSize: '13px', fontWeight: 700, color: 'var(--odoo-danger)',
                            }}>
                                <AlertTriangle className="w-4 h-4" />
                                SLA Alerts
                            </h4>
                            {slaAlerts.some(a => a.remaining <= 0) && (
                                <span style={{
                                    fontSize: '10px', fontWeight: 700,
                                    color: 'var(--odoo-danger)',
                                    backgroundColor: 'var(--odoo-danger-light)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--odoo-radius)',
                                }}>
                                    CRITICAL
                                </span>
                            )}
                        </div>

                        <div className="space-y-3">
                            {slaAlerts.length === 0 && (
                                <p style={{
                                    fontSize: '12px', color: 'var(--odoo-text-muted)',
                                    textAlign: 'center', padding: '12px 0',
                                }}>
                                    No SLA breaches
                                </p>
                            )}
                            {slaAlerts.map((alert, idx) => (
                                <React.Fragment key={alert.id}>
                                    {idx > 0 && <div style={{ height: '1px', backgroundColor: 'var(--odoo-surface-high)' }} />}
                                    <div className="cursor-pointer group"
                                        onClick={() => setExpandedOrder(expandedOrder === alert.id ? null : alert.id)}
                                    >
                                        <div className="flex justify-between mb-1">
                                            <span style={{
                                                fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)',
                                            }}>
                                                {alert.ref}
                                            </span>
                                            <span style={{
                                                fontSize: '10px', fontWeight: 700, color: 'var(--odoo-danger)',
                                            }}>
                                                {alert.remaining <= 0
                                                    ? `${Math.abs(alert.remaining)}m Overdue`
                                                    : `${alert.remaining}m Remaining`
                                                }
                                            </span>
                                        </div>
                                        <div className="flex justify-between" style={{
                                            fontSize: '11px', color: 'var(--odoo-text-muted)',
                                        }}>
                                            <span>
                                                {alert.customer}
                                                {' \u2022 '}
                                                {alert.items?.reduce((s, i) => s + i.expected, 0) || 0} Items
                                            </span>
                                            <span className="underline" style={{ color: 'var(--odoo-text-muted)' }}>
                                                {alert.remaining <= 0 ? 'Escalate' : alert.remaining <= 15 ? 'Flash Pick' : 'Assign Now'}
                                            </span>
                                        </div>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>

                        {slaAlerts.length > 0 && (
                            <button
                                className="w-full mt-4"
                                style={{
                                    padding: '8px',
                                    border: '1px solid var(--odoo-danger)',
                                    borderRadius: 'var(--odoo-radius)',
                                    backgroundColor: 'transparent',
                                    color: 'var(--odoo-danger)',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-danger-light)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                View All Breaches
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Fulfillment;
