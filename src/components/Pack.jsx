import React, { useState, useRef } from 'react';
import {
    Package, Box, ScanLine, Search, Scale, MapPin, Truck, Tag,
    Printer, CheckCircle2, ChevronRight, Pause, BarChart3,
    Lock, ChevronLeft, RefreshCw, ClipboardList, Plus, Minus, User
} from 'lucide-react';
import { BOX_TYPES, PACKING_SPEC, PRODUCT_CATALOG, suggestBox } from '../constants.jsx';
import PackStation from './PackStation';
import { formatTime } from '../utils/dateFormat';

const Pack = ({
    salesOrders, selectedPackOrder, setSelectedPackOrder,
    handlePackScanSubmit, packScanInput, setPackScanInput, packInputRef,
    handleBoxSelect, isProcessingAPI,
    packAwbInput, setPackAwbInput, packAwbRef, handleAwbConfirmScan,
    printAwbLabel, stockFrozen, boxUsageLog, addToast, logActivity, user,
    // New props merged from POSPack
    setSalesOrders, playSound, handleFulfillmentAndAWB,
}) => {
    const [showBoxOverride, setShowBoxOverride] = useState(false);
    const [showStation, setShowStation] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [workOrderInput, setWorkOrderInput] = useState('');
    const workOrderRef = useRef(null);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const readyOrders = salesOrders.filter(o => ['picked', 'packing', 'packed'].includes(o.status));

    // Search/filter orders
    const filteredReadyOrders = searchFilter
        ? readyOrders.filter(o =>
            o.ref?.toLowerCase().includes(searchFilter.toLowerCase()) ||
            (o.customer || '').toLowerCase().includes(searchFilter.toLowerCase())
        )
        : readyOrders;

    // Recent completed orders (last 5)
    const recentOrders = salesOrders
        .filter(o => ['locked', 'packed', 'rts'].includes(o.status))
        .sort((a, b) => (b.packedAt || b.createdAt || 0) - (a.packedAt || a.createdAt || 0))
        .slice(0, 5);

    // Compute shift stats
    const packedToday = salesOrders.filter(o => {
        const today = new Date().toDateString();
        return o.status === 'locked' && o.packedAt && new Date(o.packedAt).toDateString() === today;
    }).length;
    const shiftTarget = 200;
    const shiftProgress = Math.min((packedToday / shiftTarget) * 100, 100);
    const remainingOrders = shiftTarget - packedToday;
    const estimatedMinutes = remainingOrders > 0 ? Math.round(remainingOrders * 1.2) : 0;
    const estHours = Math.floor(estimatedMinutes / 60);
    const estMins = estimatedMinutes % 60;

    // Next in queue
    const nextOrder = readyOrders.find(o => o.id !== selectedPackOrder?.id && o.status === 'picked');

    // Work order scan handler
    const handleWorkOrderScan = (e) => {
        if (e.key !== 'Enter' || !workOrderInput.trim()) return;
        const input = workOrderInput.trim().toUpperCase();
        const order = readyOrders.find(o =>
            o.ref?.toUpperCase() === input ||
            o.odooPickingId?.toString() === input
        );
        if (order) {
            setSelectedPackOrder(order);
            playSound?.('success');
        } else {
            playSound?.('error');
            addToast?.(`Order "${input}" not found in pack queue`, 'error');
        }
        setWorkOrderInput('');
    };

    // Manual quantity adjust for item verification
    const handleManualAdjust = (itemIdx, delta) => {
        if (!selectedPackOrder || !setSalesOrders) return;
        const items = [...selectedPackOrder.items];
        const item = items[itemIdx];
        const newVal = (item.packed || 0) + delta;
        if (newVal < 0 || newVal > (item.picked || item.expected || 0)) return;
        item.packed = newVal;
        const updatedOrders = salesOrders.map(o =>
            o.id === selectedPackOrder.id ? { ...o, items, status: 'packing' } : o
        );
        setSalesOrders(updatedOrders);
        setSelectedPackOrder({ ...selectedPackOrder, items, status: 'packing' });
        logActivity?.('pack-adjust', { order: selectedPackOrder.ref, sku: item.sku, qty: newVal });
    };

    // ──────────────────────────────────────────────
    // ORDER LIST VIEW (no order selected)
    // ──────────────────────────────────────────────
    if (!selectedPackOrder) {
        return (
            <div className="w-full animate-slide-up">
                {stockFrozen && (
                    <div className={`mb-4 p-3 flex items-center gap-3`} style={{
                        backgroundColor: 'var(--odoo-danger-light)',
                        border: '1px solid var(--odoo-danger)',
                        borderRadius: '4px',
                    }}>
                        <Lock className="w-5 h-5" style={{ color: 'var(--odoo-danger)' }} />
                        <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--odoo-danger)' }}>Stock Frozen</p>
                            <p className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                Packing is blocked during Full Count. Please wait until the count is completed.
                            </p>
                        </div>
                    </div>
                )}

                {/* Top Row: Work Order Scan + Shift Target */}
                <div className={isMobile ? 'flex flex-col gap-4 mb-5' : 'grid grid-cols-3 gap-4 mb-5'}>
                    {/* Left: Operational Focus — Work Order Scan */}
                    <div className={isMobile ? '' : 'col-span-2'} style={{
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                        borderLeft: '4px solid var(--odoo-purple)',
                        borderRadius: '4px',
                        padding: isMobile ? '16px' : '24px 28px',
                    }}>
                        <p style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: 'var(--odoo-purple)',
                            marginBottom: '16px',
                        }}>Operational Focus</p>
                        <div className="flex items-center gap-3" style={{
                            border: '2px solid var(--odoo-border-ghost)',
                            borderRadius: '4px',
                            padding: isMobile ? '8px 12px' : '4px',
                            backgroundColor: 'var(--odoo-surface)',
                        }}>
                            <div style={{ padding: isMobile ? '4px' : '10px 12px', display: 'flex', alignItems: 'center' }}>
                                <ScanLine className="w-5 h-5" style={{ color: 'var(--odoo-text-muted)' }} />
                            </div>
                            <input
                                ref={workOrderRef}
                                type="text"
                                value={workOrderInput}
                                onChange={e => setWorkOrderInput(e.target.value)}
                                onKeyDown={handleWorkOrderScan}
                                placeholder="Scan Work Order / Order ID to Start Packing..."
                                style={{
                                    flex: 1, border: 'none', outline: 'none',
                                    fontSize: isMobile ? '16px' : '14px',
                                    fontFamily: 'monospace', fontWeight: 600,
                                    padding: isMobile ? '12px 0' : '10px 0',
                                    backgroundColor: 'transparent', color: 'var(--odoo-text)',
                                    minHeight: isMobile ? '48px' : 'auto',
                                }}
                            />
                            {!isMobile && (
                                <span style={{
                                    fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                                    backgroundColor: 'var(--odoo-surface)',
                                    border: '1px solid var(--odoo-border-ghost)',
                                    borderRadius: '3px', padding: '2px 8px',
                                    letterSpacing: '0.05em', marginRight: '8px',
                                }}>ENTER TO SCAN</span>
                            )}
                        </div>
                    </div>

                    {/* Right: Shift Target */}
                    <div style={{
                        background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))',
                        borderRadius: '4px',
                        padding: isMobile ? '16px' : '24px',
                        color: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                    }}>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, marginBottom: '8px' }}>
                            Shift Packing Target
                        </p>
                        <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 800, marginBottom: '12px' }}>
                            {packedToday} <span style={{ fontSize: '16px', fontWeight: 500, opacity: 0.7 }}>/ {shiftTarget}</span>
                        </div>
                        <div style={{
                            height: '6px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '8px',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${shiftProgress}%`,
                                backgroundColor: 'var(--odoo-success)',
                                borderRadius: '3px',
                                transition: 'width 0.5s ease',
                            }} />
                        </div>
                        <p style={{ fontSize: '11px', opacity: 0.7 }}>
                            {remainingOrders > 0
                                ? `Estimated finish in ${estHours}h ${estMins}m`
                                : 'Target reached!'
                            }
                        </p>
                    </div>
                </div>

                {/* Order list card */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                }}>
                    <div className={`px-6 py-4 flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`} style={{
                        backgroundColor: 'var(--odoo-surface-low)',
                        borderBottom: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div>
                            <h2 className="font-bold" style={{ fontSize: '14px', color: 'var(--odoo-text)' }}>
                                Pack & Verify
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)', marginTop: '2px' }}>
                                {readyOrders.length} orders ready for packing validation
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search filter */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                                <input
                                    type="text"
                                    value={searchFilter}
                                    onChange={e => setSearchFilter(e.target.value)}
                                    placeholder="Search orders..."
                                    style={{
                                        paddingLeft: '32px', paddingRight: '12px',
                                        paddingTop: '6px', paddingBottom: '6px',
                                        fontSize: '12px',
                                        backgroundColor: 'var(--odoo-surface)',
                                        border: '1px solid var(--odoo-border-ghost)',
                                        borderRadius: '4px',
                                        color: 'var(--odoo-text)',
                                        outline: 'none',
                                        width: isMobile ? '100%' : '200px',
                                        minHeight: isMobile ? '44px' : 'auto',
                                    }}
                                />
                            </div>
                            <button onClick={() => setShowStation(true)}
                                className="odoo-btn odoo-btn-secondary text-xs flex items-center gap-1.5"
                                style={{ minHeight: isMobile ? '44px' : 'auto' }}>
                                <ClipboardList className="w-3.5 h-3.5" /> Station
                            </button>
                        </div>
                    </div>
                    <div>
                        {filteredReadyOrders.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                <Package className="w-12 h-12 mb-4 opacity-30" />
                                <p style={{ fontSize: '13px', fontWeight: 500 }}>
                                    {searchFilter ? 'No orders match your search' : 'No orders ready to pack'}
                                </p>
                            </div>
                        ) : (
                            <div>
                                {filteredReadyOrders
                                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                                    .map(order => {
                                        const statusStyle = order.status === 'packing'
                                            ? { backgroundColor: 'var(--odoo-warning-light)', color: 'var(--odoo-warning-dark)', border: '1px solid var(--odoo-warning)' }
                                            : order.status === 'packed'
                                            ? { backgroundColor: 'var(--odoo-info-light)', color: 'var(--odoo-info-dark)', border: '1px solid var(--odoo-info)' }
                                            : { backgroundColor: 'var(--odoo-purple-light)', color: 'var(--odoo-purple)', border: '1px solid var(--odoo-purple-border)' };
                                        const statusLabel = order.status === 'packing' ? 'Packing' : order.status === 'packed' ? 'Select Box' : 'Ready';
                                        return (
                                            <div key={order.id} onClick={() => !stockFrozen && setSelectedPackOrder(order)}
                                                className="flex items-center justify-between cursor-pointer"
                                                style={{
                                                    padding: isMobile ? '16px' : '14px 20px',
                                                    borderBottom: '1px solid var(--odoo-border-ghost)',
                                                    opacity: stockFrozen ? 0.5 : 1,
                                                    pointerEvents: stockFrozen ? 'none' : 'auto',
                                                    minHeight: isMobile ? '64px' : 'auto',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div style={{
                                                        backgroundColor: 'var(--odoo-purple-light)',
                                                        padding: '10px',
                                                        borderRadius: '4px',
                                                        color: 'var(--odoo-purple)',
                                                    }}>
                                                        <Box className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 style={{ fontWeight: 600, fontSize: '13px', color: 'var(--odoo-text)' }}>
                                                                {order.ref}
                                                            </h3>
                                                            <span className="odoo-badge" style={statusStyle}>{statusLabel}</span>
                                                        </div>
                                                        <p style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>
                                                            {order.customer && <span style={{ fontWeight: 500 }}>{order.customer} - </span>}
                                                            {order.courier} - {order.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0)} Items
                                                            {order.createdAt && (
                                                                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>
                                                                    {formatTime(order.createdAt)}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Orders Section */}
                {recentOrders.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                        <p style={{
                            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.1em', color: 'var(--odoo-text-secondary)',
                            marginBottom: '12px',
                        }}>Recent Completed Orders</p>
                        <div className={isMobile ? 'flex flex-col gap-2' : 'grid grid-cols-5 gap-3'}>
                            {recentOrders.map((order, i) => {
                                const orderTotal = order.items.reduce((s, item) => {
                                    const cat = PRODUCT_CATALOG[item.sku];
                                    return s + (cat?.price || item.price || 0) * (item.picked || item.expected || 0);
                                }, 0);
                                return (
                                    <div
                                        key={order.id}
                                        className={isMobile ? 'flex items-center gap-3' : ''}
                                        style={{
                                            backgroundColor: 'var(--odoo-surface)',
                                            border: '1px solid var(--odoo-border-ghost)',
                                            padding: '12px',
                                            borderRadius: '4px',
                                            display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '4px',
                                            borderTop: !isMobile && i === 0 ? '2px solid var(--odoo-purple)' : 'none',
                                            opacity: 1 - i * 0.12,
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => setSelectedPackOrder(order)}
                                    >
                                        <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--odoo-text)' }}>{order.ref}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)' }}>
                                            {order.packedAt ? formatTime(order.packedAt)
                                                : order.createdAt ? formatTime(order.createdAt)
                                                : '--:--'}
                                            {orderTotal > 0 && ` - ${orderTotal.toLocaleString()}`}
                                        </span>
                                        {isMobile && (
                                            <span className="ml-auto" style={{
                                                fontSize: '10px', fontWeight: 600,
                                                color: 'var(--odoo-success)',
                                                backgroundColor: 'var(--odoo-success-light)',
                                                padding: '2px 8px', borderRadius: '4px',
                                            }}>Done</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <PackStation isOpen={showStation} onClose={() => setShowStation(false)} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} user={user} />
            </div>
        );
    }

    // ──────────────────────────────────────────────
    // PACKING DETAIL VIEW (order selected)
    // ──────────────────────────────────────────────
    const allPacked = selectedPackOrder.items.every(i => (i.packed || 0) >= (i.picked || i.expected || 0));
    const hasAwb = !!selectedPackOrder.awb;
    const isLocked = selectedPackOrder.status === 'locked';
    const totalItems = selectedPackOrder.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0);
    const packedItems = selectedPackOrder.items.reduce((s, i) => s + (i.packed || 0), 0);
    const totalWeight = selectedPackOrder.items.reduce((s, i) => s + (i.weight || 0.2) * (i.picked || i.qty || 1), 0);
    const recommended = suggestBox(selectedPackOrder?.items || []);
    const recBox = BOX_TYPES.find(b => b.id === recommended);
    // Volumetric weight estimate
    const volWeight = recBox
        ? (() => {
            const dims = recBox.size.replace(/ cm/i, '').split('x').map(Number);
            return dims.length === 3 ? (dims[0] * dims[1] * dims[2]) / 5000 : totalWeight;
        })()
        : totalWeight;

    // ──────────────────────────────────────────────
    // LOCKED STATE
    // ──────────────────────────────────────────────
    if (isLocked) {
        return (
            <div className="w-full animate-slide-up">
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                }}>
                    <div className="px-5 py-3 flex justify-between items-center" style={{
                        backgroundColor: 'var(--odoo-surface-low)',
                        borderBottom: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div className="flex items-center gap-2" style={{ color: 'var(--odoo-danger)', fontSize: '13px', fontWeight: 700 }}>
                            <Lock className="w-4 h-4" /> LOCKED
                        </div>
                        <div className="flex items-center gap-2">
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ORDER</span>
                            <span style={{
                                fontSize: '13px', fontWeight: 700, fontFamily: 'monospace',
                                backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)',
                                borderRadius: '4px', padding: '2px 8px', color: 'var(--odoo-text)',
                            }}>{selectedPackOrder.ref}</span>
                        </div>
                    </div>
                    <div className={`${isMobile ? 'p-8' : 'p-16'} text-center flex flex-col items-center animate-fade-in`} style={{ gap: '16px' }}>
                        <div style={{
                            width: '80px', height: '80px',
                            backgroundColor: 'var(--odoo-danger-light)', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Lock className="w-10 h-10" style={{ color: 'var(--odoo-danger)' }} />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-text)' }}>Order Locked</h2>
                        <p style={{ fontSize: '13px', color: 'var(--odoo-text-secondary)' }}>
                            AWB confirmed -- this order is locked for editing
                        </p>
                        {/* Customer name */}
                        {selectedPackOrder.customer && (
                            <div className="flex items-center gap-2" style={{ color: 'var(--odoo-text-secondary)', fontSize: '13px' }}>
                                <User className="w-4 h-4" />
                                <span style={{ fontWeight: 600 }}>{selectedPackOrder.customer}</span>
                            </div>
                        )}
                        <div style={{
                            backgroundColor: 'var(--odoo-surface-low)',
                            border: '1px solid var(--odoo-border-ghost)',
                            borderRadius: '4px', padding: '16px 24px',
                            textAlign: 'left', width: '100%', maxWidth: '320px', marginTop: '8px',
                        }}>
                            {[
                                ['AWB', selectedPackOrder.awb, true],
                                ['Box', selectedPackOrder.boxType || '-', false],
                                ['Courier', selectedPackOrder.courier, false],
                                ['Items', `${totalItems} pcs`, false],
                            ].map(([label, val, mono]) => (
                                <div key={label} className="flex justify-between" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--odoo-text-secondary)' }}>{label}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--odoo-text)', fontFamily: mono ? 'monospace' : undefined }}>{val}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setSelectedPackOrder(null)} style={{
                            fontSize: '13px', color: 'var(--odoo-text-secondary)', textDecoration: 'underline',
                            background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px',
                            minHeight: isMobile ? '48px' : 'auto',
                        }}>
                            Back to list
                        </button>
                    </div>
                </div>
                <PackStation isOpen={showStation} onClose={() => setShowStation(false)} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} user={user} />
            </div>
        );
    }

    // ──────────────────────────────────────────────
    // AWB SCAN STAGE
    // ──────────────────────────────────────────────
    if (hasAwb) {
        return (
            <div className="w-full animate-slide-up">
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                    borderRadius: '4px', overflow: 'hidden',
                }}>
                    <div className="px-5 py-3 flex justify-between items-center" style={{
                        backgroundColor: 'var(--odoo-surface-low)',
                        borderBottom: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <button onClick={() => setSelectedPackOrder(null)} className="odoo-btn odoo-btn-secondary" style={{ fontSize: '12px', padding: '4px 10px', minHeight: isMobile ? '44px' : 'auto' }}>
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <div className="flex items-center gap-2">
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ORDER</span>
                            <span style={{
                                fontSize: '13px', fontWeight: 700, fontFamily: 'monospace',
                                backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)',
                                borderRadius: '4px', padding: '2px 8px', color: 'var(--odoo-text)',
                            }}>{selectedPackOrder.ref}</span>
                        </div>
                    </div>
                    <div className={`${isMobile ? 'p-5' : 'p-8'} flex flex-col items-center`} style={{ gap: '20px' }}>
                        {/* Customer name */}
                        {selectedPackOrder.customer && (
                            <div className="flex items-center gap-2" style={{
                                padding: '6px 16px', backgroundColor: 'var(--odoo-surface-low)',
                                borderRadius: '4px', border: '1px solid var(--odoo-border-ghost)',
                            }}>
                                <User className="w-4 h-4" style={{ color: 'var(--odoo-text-secondary)' }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--odoo-text)' }}>{selectedPackOrder.customer}</span>
                            </div>
                        )}
                        <div className="text-center">
                            <p style={{
                                fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px',
                            }}>AWB printed -- scan label to confirm</p>
                            <div style={{
                                backgroundColor: 'var(--odoo-surface)',
                                border: '2px dashed var(--odoo-border-ghost)',
                                borderRadius: '4px', padding: isMobile ? '16px 24px' : '20px 40px', display: 'inline-block',
                            }}>
                                <ScanLine className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--odoo-text-muted)' }} />
                                <div style={{
                                    fontSize: isMobile ? '18px' : '22px', fontWeight: 800, fontFamily: 'monospace',
                                    color: 'var(--odoo-text)', letterSpacing: '0.1em',
                                }}>{selectedPackOrder.awb}</div>
                                <div style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)', marginTop: '6px' }}>
                                    {selectedPackOrder.boxType} {selectedPackOrder.courier}
                                </div>
                            </div>
                        </div>
                        <div className="w-full" style={{ maxWidth: '420px' }}>
                            <input
                                ref={packAwbRef}
                                type="text"
                                autoFocus
                                value={packAwbInput}
                                onChange={e => setPackAwbInput(e.target.value)}
                                onKeyDown={handleAwbConfirmScan}
                                placeholder="Scan AWB label to lock order..."
                                style={{
                                    width: '100%', border: '2px solid var(--odoo-border-ghost)',
                                    borderRadius: '4px', fontSize: isMobile ? '18px' : '16px', fontFamily: 'monospace',
                                    fontWeight: 700, textAlign: 'center',
                                    padding: isMobile ? '16px' : '12px 16px',
                                    outline: 'none', boxSizing: 'border-box',
                                    minHeight: isMobile ? '56px' : 'auto',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--odoo-purple)'}
                                onBlur={e => e.target.style.borderColor = 'var(--odoo-border-ghost)'}
                            />
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)' }}>
                            Scan AWB to match display -- system will lock order immediately
                        </p>
                        {printAwbLabel && (
                            <button
                                onClick={() => printAwbLabel(selectedPackOrder, selectedPackOrder.awb)}
                                className="odoo-btn odoo-btn-secondary"
                                style={{ minHeight: isMobile ? '48px' : 'auto' }}
                            >
                                <Printer className="w-4 h-4" /> Reprint AWB
                            </button>
                        )}
                    </div>
                </div>
                <PackStation isOpen={showStation} onClose={() => setShowStation(false)} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} user={user} />
            </div>
        );
    }

    // ──────────────────────────────────────────────
    // MAIN PACKING VIEW (item scan + box select)
    // ──────────────────────────────────────────────
    return (
        <div className="w-full animate-slide-up">
            {/* Top Row: Operational Focus + Shift Target */}
            <div className={isMobile ? 'flex flex-col gap-4 mb-5' : 'grid grid-cols-3 gap-4 mb-5'}>
                {/* Left: Scan input */}
                <div className={isMobile ? '' : 'col-span-2'} style={{
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                    borderLeft: '4px solid var(--odoo-purple)',
                    borderRadius: '4px',
                    padding: isMobile ? '16px' : '24px 28px',
                }}>
                    {/* Customer details header */}
                    {selectedPackOrder.customer && (
                        <div className="flex items-center gap-2 mb-3" style={{
                            padding: '8px 12px',
                            backgroundColor: 'var(--odoo-surface-low)',
                            borderRadius: '4px',
                            border: '1px solid var(--odoo-border-ghost)',
                        }}>
                            <User className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                {selectedPackOrder.customer}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', marginLeft: 'auto' }}>
                                {selectedPackOrder.courier}
                            </span>
                        </div>
                    )}
                    <p style={{
                        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--odoo-purple)', marginBottom: '16px',
                    }}>Operational Focus</p>
                    <div className="flex items-center gap-3" style={{
                        border: '2px solid var(--odoo-purple)',
                        borderRadius: '4px', padding: '4px',
                        backgroundColor: 'var(--odoo-surface)',
                    }}>
                        <div style={{ padding: isMobile ? '8px' : '10px 12px', display: 'flex', alignItems: 'center' }}>
                            <ScanLine className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} />
                        </div>
                        <input
                            ref={packInputRef}
                            type="text"
                            autoFocus
                            value={packScanInput}
                            onChange={e => {
                                const val = e.target.value;
                                // Block spaces and long text (product names) — barcode scanner only
                                if (val.includes(' ') || val.length > 30) return;
                                setPackScanInput(val);
                            }}
                            onPaste={e => e.preventDefault()}
                            onKeyDown={handlePackScanSubmit}
                            placeholder="Scan barcode only..."
                            style={{
                                flex: 1, border: 'none', outline: 'none',
                                fontSize: isMobile ? '16px' : '14px',
                                fontFamily: 'monospace', fontWeight: 600,
                                padding: isMobile ? '14px 0' : '10px 0',
                                backgroundColor: 'transparent', color: 'var(--odoo-text)',
                                minHeight: isMobile ? '48px' : 'auto',
                            }}
                        />
                        {!isMobile && (
                            <span style={{
                                fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)',
                                backgroundColor: 'var(--odoo-surface-low)',
                                border: '1px solid var(--odoo-border-ghost)',
                                borderRadius: '3px', padding: '4px 10px',
                                marginRight: '8px', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                            }}>ENTER TO SCAN</span>
                        )}
                    </div>
                </div>

                {/* Right: Shift Target */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))',
                    borderRadius: '4px', padding: isMobile ? '16px' : '24px', color: '#fff',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                    <p style={{
                        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', opacity: 0.8, marginBottom: '8px',
                    }}>Shift Packing Target</p>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 800, marginBottom: '12px' }}>
                        {packedToday} <span style={{ fontSize: '16px', fontWeight: 500, opacity: 0.7 }}>/ {shiftTarget}</span>
                    </div>
                    <div style={{
                        height: '6px', backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: '3px', overflow: 'hidden', marginBottom: '8px',
                    }}>
                        <div style={{
                            height: '100%', width: `${shiftProgress}%`,
                            backgroundColor: 'var(--odoo-success)', borderRadius: '3px',
                            transition: 'width 0.5s ease',
                        }} />
                    </div>
                    <p style={{ fontSize: '11px', opacity: 0.7 }}>
                        {remainingOrders > 0
                            ? `Estimated finish in ${estHours}h ${estMins}m`
                            : 'Target reached!'}
                    </p>
                </div>
            </div>

            {/* Main Content: responsive grid */}
            <div className={isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-12 gap-4'}>
                {/* Left column */}
                <div className={isMobile ? '' : 'col-span-8'} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Item Verification Checklist */}
                    <div style={{
                        backgroundColor: 'var(--odoo-surface)',
                        border: '1px solid var(--odoo-border-ghost)',
                        borderRadius: '4px', overflow: 'hidden',
                    }}>
                        <div className={`px-5 py-3.5 flex items-center ${isMobile ? 'flex-wrap gap-2' : 'justify-between'}`} style={{
                            borderBottom: '1px solid var(--odoo-border-ghost)',
                            backgroundColor: 'var(--odoo-surface-low)',
                        }}>
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 className="w-4.5 h-4.5" style={{ color: 'var(--odoo-purple)' }} />
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                    Item Verification Checklist
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span style={{
                                    fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
                                    backgroundColor: 'var(--odoo-purple-light)',
                                    color: 'var(--odoo-purple)',
                                    border: '1px solid var(--odoo-purple-border)',
                                    borderRadius: '4px', padding: '3px 10px',
                                }}>ORDER #{selectedPackOrder.ref}</span>
                                <button onClick={() => setSelectedPackOrder(null)} className="odoo-btn odoo-btn-secondary" style={{ fontSize: '11px', padding: '3px 8px' }}>
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 space-y-2.5">
                            {selectedPackOrder.items.map((item, idx) => {
                                const expected = item.picked || item.expected || 0;
                                const packed = item.packed || 0;
                                const isComplete = packed >= expected;
                                return (
                                    <div key={idx} className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'}`}
                                        style={{
                                            padding: isMobile ? '10px 12px' : '12px 16px',
                                            border: `1px solid ${isComplete ? 'var(--odoo-success)' : 'var(--odoo-border-ghost)'}`,
                                            borderRadius: '4px',
                                            backgroundColor: isComplete ? 'var(--odoo-success-light)' : 'var(--odoo-surface)',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        {/* Product image placeholder */}
                                        {!isMobile && (
                                            <div style={{
                                                width: '56px', height: '56px', borderRadius: '4px',
                                                backgroundColor: 'var(--odoo-surface-low)',
                                                border: '1px solid var(--odoo-border-ghost)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <Package className="w-6 h-6" style={{ color: 'var(--odoo-text-muted)', opacity: 0.5 }} />
                                            </div>
                                        )}

                                        {/* Product info */}
                                        <div className="flex-1 min-w-0">
                                            <p style={{
                                                fontWeight: 600, fontSize: '13px',
                                                color: isComplete ? 'var(--odoo-success-dark)' : 'var(--odoo-text)',
                                                marginBottom: '4px',
                                            }}>{item.name}</p>
                                            <div className="flex items-center gap-3">
                                                <span style={{
                                                    fontSize: '11px', fontFamily: 'monospace', fontWeight: 500,
                                                    color: 'var(--odoo-text-secondary)',
                                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                                }}>SKU: {item.sku}</span>
                                                {item.bin && (
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: 600,
                                                        color: 'var(--odoo-text-muted)',
                                                        backgroundColor: 'var(--odoo-surface-low)',
                                                        padding: '1px 6px', borderRadius: '3px',
                                                    }}>BIN: {item.bin}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Manual +/- Qty Adjust — REMOVED: scan-only policy */}
                                        {false && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleManualAdjust(idx, -1)}
                                                    disabled={packed <= 0}
                                                    style={{
                                                        width: isMobile ? '36px' : '28px', height: isMobile ? '36px' : '28px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--odoo-border-ghost)',
                                                        backgroundColor: 'var(--odoo-surface-low)',
                                                        cursor: packed <= 0 ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--odoo-text-secondary)',
                                                        opacity: packed <= 0 ? 0.3 : 1,
                                                    }}
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleManualAdjust(idx, 1)}
                                                    disabled={packed >= expected}
                                                    style={{
                                                        width: isMobile ? '36px' : '28px', height: isMobile ? '36px' : '28px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--odoo-border-ghost)',
                                                        backgroundColor: 'var(--odoo-surface-low)',
                                                        cursor: packed >= expected ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--odoo-text-secondary)',
                                                        opacity: packed >= expected ? 0.3 : 1,
                                                    }}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Quantity */}
                                        <div style={{
                                            fontSize: isMobile ? '14px' : '16px', fontWeight: 800, fontFamily: 'monospace',
                                            color: isComplete ? 'var(--odoo-success)' : 'var(--odoo-text)',
                                            minWidth: '50px', textAlign: 'center',
                                        }}>
                                            {packed} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--odoo-text-muted)' }}>/ {expected}</span>
                                        </div>

                                        {/* Check icon */}
                                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{
                                            color: isComplete ? 'var(--odoo-success)' : 'var(--odoo-border-ghost)',
                                            transition: 'color 0.2s ease',
                                        }} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Packaging Selection */}
                    {allPacked && (
                        <div style={{
                            backgroundColor: 'var(--odoo-surface)',
                            border: '1px solid var(--odoo-border-ghost)',
                            borderRadius: '4px', overflow: 'hidden',
                        }}>
                            <div className="px-5 py-3.5 flex items-center justify-between" style={{
                                borderBottom: '1px solid var(--odoo-border-ghost)',
                                backgroundColor: 'var(--odoo-surface-low)',
                            }}>
                                <div className="flex items-center gap-2.5">
                                    <Box className="w-4.5 h-4.5" style={{ color: 'var(--odoo-purple)' }} />
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                        Packaging Selection
                                    </span>
                                </div>
                                {showBoxOverride && (
                                    <button onClick={() => setShowBoxOverride(false)} style={{
                                        fontSize: '11px', color: 'var(--odoo-purple)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontWeight: 600,
                                    }}>
                                        Back to recommended
                                    </button>
                                )}
                            </div>
                            <div className="p-5">
                                {isProcessingAPI ? (
                                    <div className="flex flex-col items-center py-10" style={{ gap: '12px', color: 'var(--odoo-text-secondary)' }}>
                                        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--odoo-purple)' }} />
                                        <p style={{ fontSize: '13px', fontWeight: 500 }}>Generating AWB...</p>
                                    </div>
                                ) : !showBoxOverride ? (
                                    /* Recommended box - prominent display */
                                    <div className="flex flex-col items-center">
                                        <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', marginBottom: '20px' }}>
                                            {totalItems} item{totalItems > 1 ? 's' : ''} / {totalWeight.toFixed(2)} kg -- Recommended packaging:
                                        </p>
                                        <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2'} gap-3 w-full`} style={{ maxWidth: '400px' }}>
                                            {BOX_TYPES.slice(0, 4).map(box => {
                                                const isRec = box.id === recommended;
                                                return (
                                                    <button
                                                        key={box.id}
                                                        onClick={() => isRec ? handleBoxSelect(selectedPackOrder, box.id) : setShowBoxOverride(true)}
                                                        className="flex flex-col items-center"
                                                        style={{
                                                            padding: isMobile ? '16px 12px' : '20px 16px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s',
                                                            border: isRec ? '2px solid var(--odoo-purple)' : '2px solid var(--odoo-border-ghost)',
                                                            backgroundColor: isRec ? 'var(--odoo-purple-light)' : 'var(--odoo-surface)',
                                                            position: 'relative',
                                                            minHeight: isMobile ? '80px' : 'auto',
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.borderColor = 'var(--odoo-purple)';
                                                            e.currentTarget.style.backgroundColor = 'var(--odoo-purple-light)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            if (!isRec) {
                                                                e.currentTarget.style.borderColor = 'var(--odoo-border-ghost)';
                                                                e.currentTarget.style.backgroundColor = 'var(--odoo-surface)';
                                                            }
                                                        }}
                                                    >
                                                        {isRec && (
                                                            <span style={{
                                                                position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                                                                fontSize: '9px', fontWeight: 700, color: '#fff',
                                                                backgroundColor: 'var(--odoo-purple)',
                                                                padding: '1px 8px', borderRadius: '4px',
                                                            }}>Best Fit</span>
                                                        )}
                                                        <Box className="w-7 h-7 mb-2" style={{ color: isRec ? 'var(--odoo-purple)' : 'var(--odoo-text-secondary)' }} />
                                                        <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--odoo-text)' }}>
                                                            {box.name}
                                                        </span>
                                                        <span style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)', marginTop: '2px' }}>
                                                            {box.size}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => setShowBoxOverride(true)}
                                            style={{
                                                marginTop: '16px', fontSize: '12px', color: 'var(--odoo-text-secondary)',
                                                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
                                            }}
                                        >
                                            Show all box types
                                        </button>
                                    </div>
                                ) : (
                                    /* All box types grid */
                                    <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-3`}>
                                        {BOX_TYPES.map(box => {
                                            const isRec = box.id === recommended;
                                            const spec = PACKING_SPEC[box.id];
                                            return (
                                                <button
                                                    key={box.id}
                                                    onClick={() => handleBoxSelect(selectedPackOrder, box.id)}
                                                    className="flex flex-col items-center relative"
                                                    style={{
                                                        padding: isMobile ? '14px 10px' : '16px 12px', borderRadius: '4px',
                                                        cursor: 'pointer', transition: 'all 0.15s',
                                                        border: isRec ? '2px solid var(--odoo-purple)' : '2px solid var(--odoo-border-ghost)',
                                                        backgroundColor: isRec ? 'var(--odoo-purple-light)' : 'var(--odoo-surface)',
                                                        minHeight: isMobile ? '80px' : 'auto',
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.borderColor = 'var(--odoo-purple)';
                                                        e.currentTarget.style.backgroundColor = 'var(--odoo-purple-light)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (!isRec) {
                                                            e.currentTarget.style.borderColor = 'var(--odoo-border-ghost)';
                                                            e.currentTarget.style.backgroundColor = 'var(--odoo-surface)';
                                                        }
                                                    }}
                                                >
                                                    {isRec && (
                                                        <span style={{
                                                            position: 'absolute', top: '-7px', left: '50%', transform: 'translateX(-50%)',
                                                            fontSize: '8px', fontWeight: 700, color: '#fff',
                                                            backgroundColor: 'var(--odoo-purple)',
                                                            padding: '1px 6px', borderRadius: '4px',
                                                        }}>Best</span>
                                                    )}
                                                    <Box className="w-6 h-6 mb-1" style={{ color: isRec ? 'var(--odoo-purple)' : 'var(--odoo-text-secondary)' }} />
                                                    <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--odoo-text)' }}>{box.name}</span>
                                                    <span style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)' }}>{box.size}</span>
                                                    {spec && (spec.bubble > 0 || spec.tape > 0) && (
                                                        <span style={{ fontSize: '8px', color: 'var(--odoo-text-muted)', marginTop: '2px' }}>
                                                            {spec.bubble > 0 ? `B${spec.bubble} ` : ''}{spec.tape > 0 ? `T${spec.tape}` : ''}{spec.stretch > 0 ? ` S${spec.stretch}` : ''}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right sidebar */}
                <div className={isMobile ? '' : 'col-span-4'}>
                    <div className={isMobile ? 'space-y-4' : 'sticky top-5 space-y-4'}>
                        {/* Weight & Measurement */}
                        <div style={{
                            backgroundColor: 'var(--odoo-surface)',
                            border: '1px solid var(--odoo-border-ghost)',
                            borderRadius: '4px', padding: '20px',
                        }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Scale className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                    Weight & Measurement
                                </span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between" style={{
                                    padding: '10px 12px', borderRadius: '4px',
                                    backgroundColor: 'var(--odoo-surface-low)',
                                }}>
                                    <span style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)' }}>Actual Weight</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--odoo-text)' }}>
                                        {totalWeight.toFixed(2)} kg
                                    </span>
                                </div>
                                <div className="flex items-center justify-between" style={{
                                    padding: '10px 12px', borderRadius: '4px',
                                    backgroundColor: 'var(--odoo-surface-low)',
                                }}>
                                    <span style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)' }}>Volumetric</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--odoo-text)' }}>
                                        {volWeight.toFixed(2)} kg
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Destination */}
                        <div style={{
                            backgroundColor: 'var(--odoo-surface)',
                            border: '1px solid var(--odoo-border-ghost)',
                            borderRadius: '4px', padding: '20px',
                        }}>
                            <div className="flex items-center gap-2 mb-3">
                                <MapPin className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>Destination</span>
                            </div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--odoo-text)', marginBottom: '4px' }}>
                                {selectedPackOrder.customer || selectedPackOrder.partner || 'Customer'}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', lineHeight: '1.5' }}>
                                {selectedPackOrder.address || selectedPackOrder.shippingAddress || 'Shipping address not available'}
                            </p>
                        </div>

                        {/* Shipping Method */}
                        <div style={{
                            backgroundColor: 'var(--odoo-surface)',
                            border: '1px solid var(--odoo-border-ghost)',
                            borderRadius: '4px', padding: '20px',
                        }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Truck className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>Shipping Method</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--odoo-text)' }}>
                                    {selectedPackOrder.courier || 'Not assigned'}
                                </span>
                                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--odoo-success)' }} />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {allPacked && !isProcessingAPI && (
                            <div className="space-y-2.5">
                                <button
                                    onClick={() => handleBoxSelect(selectedPackOrder, recommended)}
                                    style={{
                                        width: '100%',
                                        padding: isMobile ? '16px 20px' : '14px 20px',
                                        background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'opacity 0.15s',
                                        minHeight: isMobile ? '48px' : 'auto',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    <Tag className="w-4 h-4" />
                                    GENERATE LABEL
                                </button>
                                <button
                                    onClick={() => setSelectedPackOrder(null)}
                                    style={{
                                        width: '100%',
                                        padding: isMobile ? '14px 20px' : '12px 20px',
                                        backgroundColor: 'transparent',
                                        color: 'var(--odoo-text-secondary)',
                                        border: '1px solid var(--odoo-border-ghost)',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.15s',
                                        minHeight: isMobile ? '48px' : 'auto',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'var(--odoo-warning)';
                                        e.currentTarget.style.color = 'var(--odoo-warning-dark)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'var(--odoo-border-ghost)';
                                        e.currentTarget.style.color = 'var(--odoo-text-secondary)';
                                    }}
                                >
                                    <Pause className="w-4 h-4" />
                                    Hold Order
                                </button>
                            </div>
                        )}

                        {/* Progress indicator when items not all packed */}
                        {!allPacked && (
                            <div style={{
                                backgroundColor: 'var(--odoo-surface)',
                                border: '1px solid var(--odoo-border-ghost)',
                                borderRadius: '4px', padding: '20px',
                            }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <BarChart3 className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                        Scan Progress
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: '24px', fontWeight: 800, color: 'var(--odoo-text)',
                                    textAlign: 'center', marginBottom: '8px',
                                }}>
                                    {packedItems} <span style={{ fontSize: '14px', color: 'var(--odoo-text-muted)' }}>/ {totalItems}</span>
                                </div>
                                <div style={{
                                    height: '6px', backgroundColor: 'var(--odoo-surface-low)',
                                    borderRadius: '3px', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${totalItems > 0 ? (packedItems / totalItems) * 100 : 0}%`,
                                        backgroundColor: 'var(--odoo-purple)',
                                        borderRadius: '3px',
                                        transition: 'width 0.3s ease',
                                    }} />
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', textAlign: 'center', marginTop: '8px' }}>
                                    {totalItems - packedItems} item{totalItems - packedItems !== 1 ? 's' : ''} remaining
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Active Packer Widget (desktop only) */}
            {!isMobile && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    backgroundColor: 'var(--odoo-surface)',
                    border: '1px solid var(--odoo-border-ghost)',
                    borderRadius: '4px',
                    padding: '16px 20px',
                    minWidth: '240px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 40,
                }}>
                    <div className="flex items-center justify-between mb-2.5">
                        <span style={{
                            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.1em', color: 'var(--odoo-text-muted)',
                        }}>Active Packer</span>
                        <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: 'var(--odoo-success)',
                        }} />
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)', marginBottom: '12px' }}>
                        {user?.name || user?.username || 'Packer'}
                    </p>

                    {nextOrder && (
                        <>
                            <div style={{
                                height: '1px', backgroundColor: 'var(--odoo-border-ghost)', marginBottom: '10px',
                            }} />
                            <div className="flex items-center justify-between">
                                <div>
                                    <span style={{
                                        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: '0.1em', color: 'var(--odoo-text-muted)',
                                        display: 'block', marginBottom: '4px',
                                    }}>Next in Queue</span>
                                    <span style={{
                                        fontSize: '12px', fontWeight: 600, fontFamily: 'monospace',
                                        color: 'var(--odoo-text)',
                                    }}>{nextOrder.ref}</span>
                                </div>
                                <button
                                    onClick={() => setSelectedPackOrder(nextOrder)}
                                    style={{
                                        padding: '6px',
                                        backgroundColor: 'var(--odoo-purple-light)',
                                        border: '1px solid var(--odoo-purple-border)',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        color: 'var(--odoo-purple)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-purple)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--odoo-purple-light)'}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            <PackStation isOpen={showStation} onClose={() => setShowStation(false)} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} user={user} />
        </div>
    );
};

export default Pack;
