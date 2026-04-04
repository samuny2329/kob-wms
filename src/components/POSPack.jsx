import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, CheckCircle2, Package, ScanLine, AlertTriangle, CheckSquare, Barcode, Monitor, Plus, Minus, Printer, RefreshCw, PackageCheck, Search, Tag, X, Lock, ClipboardList, Trash2, ChevronDown } from 'lucide-react';
import { PRODUCT_CATALOG, BOX_TYPES, PLATFORM_LABELS, PACKING_SPEC, suggestBox } from '../constants';
import { PlatformBadge } from './PlatformLogo';
import PackStation from './PackStation';
import { sanitizeBarcode } from '../utils/barcode';

const PAGE_SIZE = 30;

const POSPack = React.memo(({ salesOrders, setSalesOrders, playSound, logActivity, addToast, handleFulfillmentAndAWB, isProcessingAPI, boxUsageLog, setBoxUsageLog, printAwbLabel }) => {
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [scanInput, setScanInput] = useState('');
    const [awbInput, setAwbInput] = useState('');
    const [lastScanStatus, setLastScanStatus] = useState(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const scanRef = useRef(null);
    const awbRef = useRef(null);
    const workOrderRef = useRef(null);
    const [workOrderInput, setWorkOrderInput] = useState('');
    const [showStation, setShowStation] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Debounce search filter (300ms)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchFilter), 300);
        return () => clearTimeout(timer);
    }, [searchFilter]);

    const packableOrders = useMemo(() =>
        salesOrders.filter(o => ['picked', 'packing', 'packed', 'rts'].includes(o.status)),
        [salesOrders]
    );

    const filteredOrders = useMemo(() => {
        const q = debouncedSearch.toLowerCase();
        if (!q) return packableOrders;
        return packableOrders.filter(o =>
            o.ref.toLowerCase().includes(q) || (o.customer || '').toLowerCase().includes(q)
        );
    }, [packableOrders, debouncedSearch]);

    const sortedOrders = useMemo(() =>
        [...filteredOrders].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
        [filteredOrders]
    );

    // Reset pagination when filter changes
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedSearch]);

    useEffect(() => {
        if (selectedOrder) {
            const updated = salesOrders.find(o => o.id === selectedOrder.id);
            if (updated && updated !== selectedOrder) setSelectedOrder(updated);
        }
    }, [salesOrders]);

    useEffect(() => {
        if (!selectedOrder) return;
        if (selectedOrder.status === 'rts' && selectedOrder.awb) {
            setTimeout(() => awbRef.current?.focus(), 100);
        } else {
            const done = (selectedOrder.items || []).every(i => (i.packed || 0) >= (i.picked || i.expected || 0));
            if (!done) setTimeout(() => scanRef.current?.focus(), 100);
        }
    }, [selectedOrder?.status, selectedOrder?.awb, selectedOrder?.items]);

    const [flashStatus, setFlashStatus] = useState(null);

    const findSkuByBarcode = (barcode) => {
        for (const [sku, catalog] of Object.entries(PRODUCT_CATALOG)) {
            if (catalog.barcode === barcode) return sku;
        }
        return null;
    };

    const handleWorkOrderScan = (e) => {
        if (e.key !== 'Enter' || !workOrderInput.trim()) return;
        const input = workOrderInput.trim().toUpperCase();
        const order = packableOrders.find(o =>
            o.ref?.toUpperCase() === input ||
            o.odooPickingId?.toString() === input
        );
        if (order) {
            setSelectedOrder(order);
            setLastScanStatus(null);
            setScanInput('');
            setAwbInput('');
            setTimeout(() => scanRef.current?.focus(), 150);
        } else {
            playSound?.('error');
        }
        setWorkOrderInput('');
    };

    const handleScanSubmit = (e) => {
        if (e.key !== 'Enter' || !scanInput.trim()) return;
        const input = sanitizeBarcode(scanInput);
        const inputUpper = input.toUpperCase();
        const items = (selectedOrder.items || []).map(i => ({ ...i }));

        const isBarcode = /^\d{8,14}$/.test(input);
        const resolvedSku = isBarcode ? findSkuByBarcode(input) : null;

        const item = items.find(i => {
            const catalog = PRODUCT_CATALOG[i.sku];
            const skuMatch = i.sku.toUpperCase() === inputUpper;
            const catalogBarcodeMatch = catalog && catalog.barcode === input;
            const itemBarcodeMatch = i.barcode && i.barcode === input;
            const resolvedMatch = resolvedSku && i.sku === resolvedSku;
            return (skuMatch || catalogBarcodeMatch || itemBarcodeMatch || resolvedMatch) && (i.packed || 0) < (i.picked || 0);
        });

        if (item) {
            item.packed = (item.packed || 0) + 1;
            const updatedOrders = salesOrders.map(o =>
                o.id === selectedOrder.id ? { ...o, items, status: 'packing' } : o
            );
            setSalesOrders(updatedOrders);
            playSound('success');
            setFlashStatus('success');
            logActivity('pack-pos', { order: selectedOrder.ref, sku: item.sku });
            const catalog = PRODUCT_CATALOG[item.sku];
            setLastScanStatus({ type: 'success', sku: item.sku, name: item.name, packed: item.packed, total: item.picked, image: catalog?.image });
        } else {
            playSound('error');
            setFlashStatus('error');
            setLastScanStatus({ type: 'error', message: `Barcode "${input}" not recognized or item fully packed` });
        }
        setScanInput('');
        setTimeout(() => setFlashStatus(null), 500);
    };

    const handleManualAdjust = (itemIdx, delta) => {
        const items = [...selectedOrder.items];
        const item = items[itemIdx];
        const newVal = item.packed + delta;
        if (newVal < 0 || newVal > item.picked) return;
        item.packed = newVal;
        const updatedOrders = salesOrders.map(o =>
            o.id === selectedOrder.id ? { ...o, items, status: 'packing' } : o
        );
        setSalesOrders(updatedOrders);
        logActivity('pack-pos-adjust', { order: selectedOrder.ref, sku: item.sku, qty: newVal });
    };

    const handleBoxSelect = (box) => {
        if (setBoxUsageLog) {
            setBoxUsageLog(prev => [...prev, { boxType: box.id, boxName: box.name, order: selectedOrder.ref, timestamp: Date.now() }]);
        }
        logActivity('box-pos', { order: selectedOrder.ref, boxType: box.id });
        handleFulfillmentAndAWB({ ...selectedOrder, boxType: box.id });
    };

    const confirmAwbLock = (awb) => {
        const finalAwb = awb || selectedOrder.awb;
        const updatedOrders = salesOrders.map(o =>
            o.id === selectedOrder.id ? { ...o, status: 'locked', awb: finalAwb } : o
        );
        setSalesOrders(updatedOrders);
        playSound('success');
        logActivity('awb-confirm-pos', { order: selectedOrder.ref, awb: finalAwb });
        setTimeout(() => {
            setSelectedOrder(null);
            setLastScanStatus(null);
            setScanInput('');
            setAwbInput('');
            setTimeout(() => workOrderRef.current?.focus(), 100);
        }, 600);
    };

    const handlePosAwbConfirm = (e) => {
        if (e.key !== 'Enter' || !awbInput.trim()) return;
        const input = awbInput.trim().toUpperCase();
        const orderAwb = selectedOrder.awb?.toUpperCase();
        const isMatch = input === orderAwb ||
            (orderAwb && input.includes(orderAwb)) ||
            (orderAwb && orderAwb.includes(input));
        if (isMatch) {
            confirmAwbLock(input);
        } else {
            playSound('error');
            setLastScanStatus({ type: 'error', message: `AWB mismatch: scanned "${input}" but expected "${orderAwb}"` });
        }
        setAwbInput('');
    };

    const totalItems = selectedOrder ? selectedOrder.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0) : 0;
    const packedItems = selectedOrder ? selectedOrder.items.reduce((s, i) => s + (i.packed || 0), 0) : 0;
    const progress = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;
    const allVerified = selectedOrder ? selectedOrder.items.every(i => (i.packed || 0) >= (i.picked || i.expected || 0)) : false;
    const isLocked = selectedOrder?.status === 'locked';
    const hasAwb = !!(selectedOrder?.awb);

    const orderSubtotal = selectedOrder ? selectedOrder.items.reduce((s, i) => {
        const catalog = PRODUCT_CATALOG[i.sku];
        const price = catalog?.price || i.price || 0;
        return s + price * (i.picked || i.expected || 0);
    }, 0) : 0;

    const recentPosOrders = salesOrders
        .filter(o => ['locked', 'packed', 'rts'].includes(o.status))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5);

    /* ---------- shared inline-style objects ---------- */
    const sectionCard = {
        backgroundColor: 'var(--odoo-surface)',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    };

    const sectionHeading = {
        fontWeight: 700,
        fontSize: '11px',
        color: 'var(--odoo-purple)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
    };

    const labelStyle = {
        display: 'block',
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--odoo-text-secondary)',
        textTransform: 'uppercase',
    };

    const inputBase = {
        width: '100%',
        backgroundColor: 'var(--odoo-surface-high)',
        border: 'none',
        borderBottom: '2px solid transparent',
        padding: '10px 16px',
        fontSize: '13px',
        borderRadius: '4px 4px 0 0',
        color: 'var(--odoo-text)',
        outline: 'none',
    };

    const scanInputStyle = {
        width: '100%',
        backgroundColor: 'var(--odoo-surface-high)',
        border: 'none',
        borderBottom: '2px solid transparent',
        paddingLeft: '48px',
        paddingRight: '16px',
        paddingTop: '16px',
        paddingBottom: '16px',
        fontFamily: 'monospace',
        fontSize: '18px',
        letterSpacing: '0.15em',
        borderRadius: '4px 4px 0 0',
        color: 'var(--odoo-text)',
        outline: 'none',
    };

    const thStyle = {
        paddingBottom: '12px',
        paddingLeft: '8px',
        paddingRight: '8px',
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--odoo-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
    };

    return (
        <div className="w-full animate-slide-up h-full relative flex flex-col overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex gap-6 overflow-hidden" style={{ padding: '24px' }}>

                {/* ============ LEFT COLUMN ============ */}
                <div className="flex-[3] flex flex-col gap-6 min-w-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredOrders.length === 0 ? (
                            <div className="text-center py-16" style={{ color: 'var(--odoo-text-muted)' }}>
                                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p style={{ fontSize: '12px', fontWeight: 600 }}>No orders</p>
                            </div>
                        ) : (
                            <div>
                                {sortedOrders
                                    .slice(0, visibleCount)
                                    .map(order => {
                                        const oTotal = order.items.reduce((s, i) => s + i.picked, 0);
                                        const oPacked = order.items.reduce((s, i) => s + i.packed, 0);
                                        const isActive = selectedOrder?.id === order.id;
                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                        return (
                                            <button
                                                key={order.id}
                                                onClick={() => { setSelectedOrder(order); setLastScanStatus(null); setScanInput(''); setAwbInput(''); }}
                                                className="w-full p-3 text-left"
                                                style={{ borderBottom: '1px solid var(--odoo-border-ghost)', borderLeft: `3px solid ${isActive ? 'var(--odoo-purple)' : 'transparent'}`, backgroundColor: isActive ? '#f3edf7' : 'transparent', cursor: 'pointer' }}
                                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <PlatformBadge name={order.courier || order.platform} size={32} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center">
                                                            <p style={{ fontWeight: 700, fontSize: '13px', color: 'var(--odoo-text)' }} className="truncate">{order.ref}</p>
                                                            <span className="odoo-badge ml-2 shrink-0" style={order.status === 'packing' ? { backgroundColor: '#fff8e1', color: '#856404', border: '1px solid var(--odoo-warning)' } : { backgroundColor: '#f3edf7', color: 'var(--odoo-purple)', border: '1px solid #c9a8bc' }}>
                                                                {oPacked}/{oTotal}
                                                            </span>
                                                        </div>
                                                        <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)' }} className="truncate">{order.customer}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                {visibleCount < sortedOrders.length && (
                                    <button
                                        onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                                        className="w-full p-3 text-center"
                                        style={{ borderBottom: '1px solid var(--odoo-border-ghost)', fontSize: '12px', fontWeight: 700, color: 'var(--odoo-purple)', cursor: 'pointer', backgroundColor: 'var(--odoo-surface-low)' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3edf7'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                    >
                                        <ChevronDown className="w-4 h-4 inline mr-1" style={{ verticalAlign: 'middle' }} />
                                        Load more ({sortedOrders.length - visibleCount} remaining)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* --- Customer Details Section --- */}
                    <section style={{
                        ...sectionCard,
                        padding: '24px',
                        borderLeft: '4px solid var(--odoo-purple)',
                    }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                            <h3 style={sectionHeading}>Customer Details</h3>
                            <span style={{
                                padding: '4px 12px',
                                backgroundColor: 'var(--odoo-surface-high)',
                                color: 'var(--odoo-text-secondary)',
                                fontSize: '10px',
                                fontWeight: 700,
                                borderRadius: '999px',
                                textTransform: 'uppercase',
                            }}>
                                {selectedOrder ? (selectedOrder.customer || 'Walk-in Customer') : 'Walk-in Customer'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={labelStyle}>Full Name</label>
                                <input
                                    type="text"
                                    value={selectedOrder?.customer || ''}
                                    readOnly
                                    placeholder="e.g. John Doe"
                                    style={inputBase}
                                    onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--odoo-purple)'; }}
                                    onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={labelStyle}>Phone Number</label>
                                <input
                                    type="text"
                                    value={selectedOrder?.phone || ''}
                                    readOnly
                                    placeholder="e.g. 081-234-5678"
                                    style={inputBase}
                                    onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--odoo-purple)'; }}
                                    onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                                />
                            </div>
                        </div>
                    </section>

                    {/* --- Product Scan & Table Section --- */}
                    <section className="flex-1 flex flex-col overflow-hidden" style={sectionCard}>

                        {/* Scan Input */}
                        <div style={{ padding: '24px 24px 8px' }}>
                            {!selectedOrder ? (
                                <div className="relative">
                                    <ScanLine className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                                    <input
                                        ref={workOrderRef}
                                        type="text"
                                        autoFocus
                                        value={workOrderInput}
                                        onChange={e => setWorkOrderInput(e.target.value)}
                                        onKeyDown={handleWorkOrderScan}
                                        placeholder="SCAN WORK ORDER OR SKU..."
                                        style={scanInputStyle}
                                        onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--odoo-purple)'; }}
                                        onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                                    />
                                </div>
                            ) : hasAwb ? (
                                <div className="relative">
                                    <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-danger)' }} />
                                    <input
                                        ref={awbRef}
                                        type="text"
                                        autoFocus
                                        value={awbInput}
                                        onChange={e => setAwbInput(e.target.value)}
                                        onKeyDown={handlePosAwbConfirm}
                                        placeholder="SCAN AWB LABEL TO CONFIRM..."
                                        style={{ ...scanInputStyle, borderBottomColor: 'var(--odoo-danger)' }}
                                    />
                                </div>
                            ) : (
                                <div className={`relative ${flashStatus === 'success' ? 'animate-scan-flash' : flashStatus === 'error' ? 'animate-scan-error' : ''}`}>
                                    <ScanLine className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                                    <input
                                        ref={scanRef}
                                        type="text"
                                        autoFocus
                                        value={scanInput}
                                        onChange={e => setScanInput(e.target.value)}
                                        onKeyDown={handleScanSubmit}
                                        placeholder="SCAN SKU OR SERIAL..."
                                        style={scanInputStyle}
                                        onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--odoo-purple)'; }}
                                        onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Scan Status Feedback */}
                        {lastScanStatus && (
                            <div style={{ padding: '0 24px', paddingTop: '8px' }}>
                                <div className="inline-flex items-center gap-3 animate-slide-up" style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    border: `1px solid ${lastScanStatus.type === 'success' ? 'var(--odoo-success)' : 'var(--odoo-danger)'}`,
                                    backgroundColor: lastScanStatus.type === 'success' ? 'var(--color-success-light, #d4edda)' : 'var(--color-danger-light, #fff5f5)',
                                    color: lastScanStatus.type === 'success' ? '#155724' : '#721c24',
                                }}>
                                    {lastScanStatus.type === 'success' && lastScanStatus.image && (
                                        <img src={lastScanStatus.image} alt="" className="w-8 h-8 rounded object-cover" style={{ border: '1px solid var(--odoo-border-ghost)' }} />
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {lastScanStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                            <span>{lastScanStatus.type === 'success' ? 'ITEM SCANNED' : 'INVALID PRODUCT'}</span>
                                        </div>
                                        <p style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7, marginTop: '2px' }}>
                                            {lastScanStatus.type === 'success' ? `${lastScanStatus.sku} • ${lastScanStatus.name}` : lastScanStatus.message}
                                        </p>
                                    </div>
                                    {lastScanStatus.type === 'success' && (
                                        <div className="tabular-nums" style={{ marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid var(--odoo-success)', fontSize: '20px', fontWeight: 800 }}>
                                            {lastScanStatus.packed}<span style={{ fontSize: '12px', opacity: 0.5, margin: '0 4px' }}>/</span>{lastScanStatus.total}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* AWB Info Banner */}
                        {selectedOrder && hasAwb && !isLocked && (
                            <div style={{ padding: '12px 24px' }}>
                                <div className="flex items-center gap-3" style={{
                                    padding: '12px 20px',
                                    backgroundColor: 'var(--color-info-light, #e0f5f5)',
                                    borderRadius: '4px',
                                    border: '1px solid #00A09D',
                                }}>
                                    <PackageCheck className="w-5 h-5" style={{ color: '#00A09D' }} />
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#00A09D' }}>AWB ready — scan label to confirm</p>
                                        <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--odoo-text)', letterSpacing: '0.1em', marginTop: '2px' }}>{selectedOrder.awb}</p>
                                        <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', marginTop: '2px' }}>{selectedOrder.boxType} • {selectedOrder.courier}</p>
                                    </div>
                                    {printAwbLabel && (
                                        <button
                                            onClick={() => printAwbLabel(selectedOrder, selectedOrder.awb)}
                                            className="ml-auto flex items-center gap-1.5"
                                            style={{
                                                padding: '6px 14px',
                                                border: '1px solid var(--odoo-purple)',
                                                borderRadius: '4px',
                                                color: 'var(--odoo-purple)',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                backgroundColor: 'transparent',
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            <Printer className="w-3.5 h-3.5" /> Reprint
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Product Table / States */}
                        <div className="flex-1 overflow-auto" style={{ padding: '16px 24px', scrollbarWidth: 'none' }}>
                            {!selectedOrder ? (
                                /* Empty state — no order selected */
                                <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--odoo-text-muted)' }}>
                                    <ScanLine className="w-14 h-14 mb-4 opacity-20" />
                                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text)', marginBottom: '4px' }}>Scan work order to start packing</p>
                                    <p style={{ fontSize: '12px' }}>Scan work order ref (e.g. WH/OUT/00050)</p>
                                </div>
                            ) : isLocked ? (
                                /* Locked state */
                                <div className="flex flex-col items-center justify-center h-full">
                                    <div style={{
                                        width: '72px', height: '72px',
                                        backgroundColor: 'var(--color-danger-light, #fff5f5)',
                                        borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: '20px',
                                    }}>
                                        <Lock className="w-9 h-9" style={{ color: 'var(--odoo-danger)' }} />
                                    </div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--odoo-text)', marginBottom: '4px' }}>Order Locked</h2>
                                    <p style={{ fontSize: '13px', color: 'var(--odoo-text-secondary)', marginBottom: '4px' }}>{selectedOrder.ref} • AWB confirmed</p>
                                    <p style={{
                                        fontFamily: 'monospace', fontWeight: 700, fontSize: '13px',
                                        backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)',
                                        borderRadius: '4px', padding: '4px 12px', display: 'inline-block',
                                        marginBottom: '6px', color: 'var(--odoo-text)',
                                    }}>{selectedOrder.awb}</p>
                                    <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', marginBottom: '20px' }}>{selectedOrder.boxType} • {selectedOrder.courier}</p>
                                    <button
                                        onClick={() => { setSelectedOrder(null); setLastScanStatus(null); }}
                                        style={{
                                            padding: '8px 24px',
                                            background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
                                            color: '#fff', fontWeight: 700, fontSize: '13px',
                                            borderRadius: '4px', border: 'none', cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(87,52,79,0.2)',
                                        }}
                                    >
                                        Next Order
                                    </button>
                                </div>
                            ) : allVerified && !hasAwb ? (
                                /* Box Selection Stage */
                                <div className="flex flex-col items-center justify-center h-full">
                                    <div className="inline-flex items-center gap-2" style={{
                                        padding: '6px 14px',
                                        backgroundColor: 'var(--color-success-light, #d4edda)',
                                        color: '#155724',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        border: '1px solid #c3e6cb',
                                        marginBottom: '20px',
                                    }}>
                                        <PackageCheck className="w-4 h-4" /> ALL ITEMS VERIFIED
                                    </div>
                                    <h4 style={{ ...sectionHeading, color: 'var(--odoo-text-secondary)', marginBottom: '12px' }}>Select box type</h4>
                                    <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', marginBottom: '20px' }}>System will generate AWB automatically after selecting box</p>
                                    {isProcessingAPI ? (
                                        <div className="flex flex-col items-center gap-3 py-4" style={{ color: 'var(--odoo-text-secondary)' }}>
                                            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--odoo-purple)' }} />
                                            <p style={{ fontSize: '13px', fontWeight: 600 }}>Generating AWB...</p>
                                        </div>
                                    ) : (
                                        (() => {
                                            const rec = suggestBox(selectedOrder?.items || []);
                                            const recBox = BOX_TYPES.find(b => b.id === rec);
                                            const recSpec = PACKING_SPEC[rec];
                                            return (
                                                <button
                                                    onClick={() => handleBoxSelect(recBox)}
                                                    style={{
                                                        padding: '24px 40px',
                                                        border: '3px solid var(--odoo-purple)',
                                                        borderRadius: '8px',
                                                        backgroundColor: 'var(--odoo-surface-low)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s',
                                                        boxShadow: '0 4px 12px rgba(87,52,79,0.12)',
                                                        maxWidth: '280px', width: '100%',
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                >
                                                    <span style={{ fontSize: '40px', marginBottom: '6px' }}>{recBox?.icon || '📦'}</span>
                                                    <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--odoo-purple)' }}>{recBox?.name}</span>
                                                    <span style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', marginTop: '2px' }}>{recBox?.size}</span>
                                                    {recSpec && (
                                                        <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--odoo-purple)', display: 'flex', gap: '8px' }}>
                                                            {recSpec.bubble > 0 && <span>Bubble x{recSpec.bubble}</span>}
                                                            {recSpec.tape > 0 && <span>Tape x{recSpec.tape}</span>}
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        marginTop: '12px', padding: '6px 20px',
                                                        background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
                                                        color: '#fff', borderRadius: '4px',
                                                        fontSize: '12px', fontWeight: 700,
                                                    }}>
                                                        Confirm & Print AWB
                                                    </div>
                                                </button>
                                            );
                                        })()
                                    )}
                                </div>
                            ) : (
                                /* Product Items Table */
                                <table className="w-full text-left" style={{ borderSpacing: '0 8px', borderCollapse: 'separate' }}>
                                    <thead className="sticky top-0" style={{ backgroundColor: 'var(--odoo-surface)', zIndex: 10 }}>
                                        <tr>
                                            <th style={thStyle}>SKU</th>
                                            <th style={thStyle}>Product</th>
                                            <th style={{ ...thStyle, textAlign: 'center' }}>Qty</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Packed</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrder.items.map((item, idx) => {
                                            const done = item.packed === item.picked;
                                            const catalog = PRODUCT_CATALOG[item.sku];
                                            const price = catalog?.price || item.price || 0;
                                            return (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        backgroundColor: done ? 'var(--odoo-surface-low)' : 'var(--odoo-surface)',
                                                        borderRadius: '4px',
                                                        borderLeft: done ? '4px solid var(--odoo-purple)' : '4px solid transparent',
                                                        transition: 'background-color 0.15s',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = done ? 'var(--odoo-surface-low)' : 'var(--odoo-surface)'; }}
                                                >
                                                    <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {item.sku}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div className="flex flex-col">
                                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--odoo-text)' }}>
                                                                {catalog?.shortName || item.name}
                                                            </span>
                                                            <span style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)' }}>
                                                                {catalog?.variant || (catalog?.barcode ? `EAN: ${catalog.barcode}` : '')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => handleManualAdjust(idx, -1)}
                                                                disabled={item.packed <= 0}
                                                                style={{
                                                                    width: '24px', height: '24px', borderRadius: '4px',
                                                                    border: '1px solid var(--odoo-border-ghost)',
                                                                    backgroundColor: 'var(--odoo-surface-low)',
                                                                    cursor: item.packed <= 0 ? 'not-allowed' : 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    color: 'var(--odoo-text-secondary)',
                                                                    opacity: item.packed <= 0 ? 0.3 : 1,
                                                                }}
                                                            >
                                                                <Minus className="w-3 h-3" />
                                                            </button>
                                                            <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.picked}</span>
                                                            <button
                                                                onClick={() => handleManualAdjust(idx, 1)}
                                                                disabled={item.packed >= item.picked}
                                                                style={{
                                                                    width: '24px', height: '24px', borderRadius: '4px',
                                                                    border: '1px solid var(--odoo-border-ghost)',
                                                                    backgroundColor: 'var(--odoo-surface-low)',
                                                                    cursor: item.packed >= item.picked ? 'not-allowed' : 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    color: 'var(--odoo-text-secondary)',
                                                                    opacity: item.packed >= item.picked ? 0.3 : 1,
                                                                }}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 700, color: done ? 'var(--odoo-success)' : 'var(--odoo-text)' }}>
                                                            {item.packed}<span style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', margin: '0 2px' }}>/</span>{item.picked}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                        {done ? (
                                                            <span className="inline-flex items-center gap-1" style={{
                                                                fontSize: '10px', fontWeight: 700,
                                                                color: 'var(--odoo-success)',
                                                                textTransform: 'uppercase',
                                                            }}>
                                                                <CheckSquare className="w-3.5 h-3.5" /> Verified
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                fontSize: '10px', fontWeight: 700,
                                                                color: 'var(--odoo-text-muted)',
                                                                textTransform: 'uppercase',
                                                            }}>
                                                                Pending
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>

                    {/* --- Recent POS Orders Footer --- */}
                    <section>
                        <h4 style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: 'var(--odoo-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '12px',
                        }}>Recent POS Orders</h4>
                        <div className="grid grid-cols-5 gap-3">
                            {recentPosOrders.length > 0 ? recentPosOrders.map((order, i) => {
                                const orderTotal = order.items.reduce((s, item) => {
                                    const cat = PRODUCT_CATALOG[item.sku];
                                    return s + (cat?.price || item.price || 0) * (item.picked || item.expected || 0);
                                }, 0);
                                return (
                                    <div
                                        key={order.id}
                                        style={{
                                            backgroundColor: 'var(--odoo-surface-low)',
                                            padding: '12px',
                                            borderRadius: '4px',
                                            display: 'flex', flexDirection: 'column', gap: '4px',
                                            borderTop: i === 0 ? '2px solid var(--odoo-purple)' : 'none',
                                            opacity: 1 - i * 0.15,
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => { setSelectedOrder(order); setLastScanStatus(null); setScanInput(''); setAwbInput(''); }}
                                    >
                                        <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>{order.ref}</span>
                                        <span style={{ fontSize: '9px', color: 'var(--odoo-text-secondary)' }}>
                                            {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'} • {orderTotal > 0 ? `฿${orderTotal.toLocaleString()}` : '--'}
                                        </span>
                                    </div>
                                );
                            }) : (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            backgroundColor: 'var(--odoo-surface-low)',
                                            padding: '12px',
                                            borderRadius: '4px',
                                            display: 'flex', flexDirection: 'column', gap: '4px',
                                            opacity: 0.3 - i * 0.05,
                                        }}
                                    >
                                        <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--odoo-text-muted)' }}>---</span>
                                        <span style={{ fontSize: '9px', color: 'var(--odoo-text-muted)' }}>--:-- • --</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* ============ RIGHT COLUMN ============ */}
                <div className="flex-1 flex flex-col gap-6" style={{ minWidth: '280px', maxWidth: '340px' }}>

                    {/* --- Order Summary Card --- */}
                    <div style={{
                        ...sectionCard,
                        padding: '24px',
                        boxShadow: '0 12px 32px rgba(87,52,79,0.06)',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        <h3 style={{ ...sectionHeading, marginBottom: '24px' }}>Order Summary</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                            <div className="flex justify-between" style={{ fontSize: '13px' }}>
                                <span style={{ color: 'var(--odoo-text-secondary)' }}>Items Count</span>
                                <span style={{ fontWeight: 700, color: 'var(--odoo-text)' }}>{totalItems}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '13px' }}>
                                <span style={{ color: 'var(--odoo-text-secondary)' }}>Subtotal</span>
                                <span style={{ color: 'var(--odoo-text)' }}>฿{orderSubtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '13px' }}>
                                <span style={{ color: 'var(--odoo-text-secondary)' }}>Progress</span>
                                <span style={{ fontWeight: 600, color: allVerified ? 'var(--odoo-success)' : 'var(--odoo-warning)' }}>{progress}%</span>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{
                            width: '100%', height: '6px',
                            backgroundColor: 'var(--odoo-surface-high)',
                            borderRadius: '3px', marginBottom: '24px',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: allVerified ? 'var(--odoo-success)' : 'linear-gradient(90deg, var(--odoo-purple-dark), var(--odoo-purple))',
                                borderRadius: '3px',
                                transition: 'width 0.5s',
                            }} />
                        </div>

                        <div style={{
                            paddingTop: '24px',
                            borderTop: '1px solid var(--odoo-border-ghost)',
                            display: 'flex', flexDirection: 'column',
                        }}>
                            <span style={{
                                fontSize: '10px', fontWeight: 700,
                                color: 'var(--odoo-text-secondary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginBottom: '4px',
                            }}>Packed Items</span>
                            <span style={{
                                fontSize: '28px', fontWeight: 900,
                                color: 'var(--odoo-purple-dark)',
                                lineHeight: 1.1,
                            }}>
                                {packedItems}<span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--odoo-text-muted)' }}> / {totalItems}</span>
                            </span>
                        </div>
                    </div>

                    {/* --- Order Details / Select Order Panel --- */}
                    <div style={{
                        ...sectionCard,
                        padding: '24px',
                        display: 'flex', flexDirection: 'column', gap: '12px',
                    }}>
                        <h3 style={{ ...sectionHeading, marginBottom: '4px' }}>
                            {selectedOrder ? 'Order Details' : 'Select Order'}
                        </h3>

                        {selectedOrder ? (
                            <>
                                {/* Order info card */}
                                <div style={{
                                    padding: '16px',
                                    background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))',
                                    borderRadius: '4px',
                                    color: '#fff',
                                }}>
                                    <div className="flex items-center gap-3">
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '4px',
                                            backgroundColor: 'rgba(255,255,255,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>{selectedOrder.ref}</p>
                                            <p style={{ fontSize: '10px', opacity: 0.7 }}>{selectedOrder.customer} • {selectedOrder.courier}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className="flex items-center gap-2" style={{
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--odoo-surface-low)',
                                    borderRadius: '4px',
                                }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        backgroundColor: isLocked ? 'var(--odoo-danger)' : allVerified ? 'var(--odoo-success)' : 'var(--odoo-warning)',
                                    }} />
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--odoo-text)' }}>
                                        {isLocked ? 'Locked' : allVerified ? (hasAwb ? 'AWB Ready' : 'All Verified') : 'Packing...'}
                                    </span>
                                    <span className="ml-auto" style={{ fontSize: '11px', color: 'var(--odoo-text-muted)', fontFamily: 'monospace' }}>
                                        {selectedOrder.items.length} SKU{selectedOrder.items.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {/* Station button */}
                                <button
                                    onClick={() => setShowStation(true)}
                                    className="flex items-center gap-3"
                                    style={{
                                        padding: '14px 16px',
                                        backgroundColor: 'var(--odoo-surface)',
                                        border: '1px solid var(--odoo-border-ghost)',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.15s',
                                        width: '100%',
                                        textAlign: 'left',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '4px',
                                        backgroundColor: 'var(--odoo-surface-high)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--odoo-purple)',
                                    }}>
                                        <ClipboardList className="w-5 h-5" />
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--odoo-text)' }}>Pack Station</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Search input */}
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                                    <input
                                        type="text"
                                        value={searchFilter}
                                        onChange={e => setSearchFilter(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const q = searchFilter.trim().toUpperCase();
                                                const match = packableOrders.find(o => o.ref?.toUpperCase() === q);
                                                if (match) {
                                                    setSelectedOrder(match);
                                                    setLastScanStatus(null);
                                                    setScanInput('');
                                                    setAwbInput('');
                                                    setSearchFilter('');
                                                    setTimeout(() => scanRef.current?.focus(), 150);
                                                }
                                            }
                                        }}
                                        placeholder="Search orders..."
                                        style={{
                                            width: '100%',
                                            paddingLeft: '36px',
                                            paddingRight: '12px',
                                            paddingTop: '10px',
                                            paddingBottom: '10px',
                                            fontSize: '13px',
                                            backgroundColor: 'var(--odoo-surface-high)',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: 'var(--odoo-text)',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                {/* Order list */}
                                <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '400px', scrollbarWidth: 'none' }}>
                                    {filteredOrders.length === 0 ? (
                                        <div className="text-center py-12" style={{ color: 'var(--odoo-text-muted)' }}>
                                            <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
                                            <p style={{ fontSize: '12px', fontWeight: 600 }}>No orders to pack</p>
                                        </div>
                                    ) : (
                                        filteredOrders
                                            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                                            .map(order => {
                                                const oTotal = order.items.reduce((s, i) => s + i.picked, 0);
                                                const oPacked = order.items.reduce((s, i) => s + i.packed, 0);
                                                return (
                                                    <button
                                                        key={order.id}
                                                        onClick={() => { setSelectedOrder(order); setLastScanStatus(null); setScanInput(''); setAwbInput(''); }}
                                                        className="w-full flex items-center gap-3"
                                                        style={{
                                                            padding: '12px',
                                                            backgroundColor: 'var(--odoo-surface)',
                                                            border: '1px solid var(--odoo-border-ghost)',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                            transition: 'background-color 0.15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}
                                                    >
                                                        <PlatformBadge name={order.courier || order.platform} size={28} />
                                                        <div className="flex-1 min-w-0">
                                                            <p style={{ fontWeight: 700, fontSize: '12px', color: 'var(--odoo-text)' }} className="truncate">{order.ref}</p>
                                                            <p style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)' }} className="truncate">{order.customer}</p>
                                                        </div>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            fontSize: '10px', fontWeight: 700,
                                                            borderRadius: '999px',
                                                            backgroundColor: oPacked === oTotal ? 'var(--color-success-light, #d4edda)' : 'var(--color-warning-light, #fff8e1)',
                                                            color: oPacked === oTotal ? '#155724' : '#856404',
                                                        }}>
                                                            {oPacked}/{oTotal}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex-1" />
                </div>
            </div>

            {/* ============ ACTION BAR (Sticky Bottom) ============ */}
            {selectedOrder && !isLocked && (
                <footer style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '16px 32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: '0 -4px 24px rgba(0,0,0,0.04)',
                    zIndex: 40,
                    borderTop: '1px solid var(--odoo-border-ghost)',
                }}>
                    <button
                        onClick={() => { setSelectedOrder(null); setLastScanStatus(null); setScanInput(''); setAwbInput(''); }}
                        className="flex items-center gap-2"
                        style={{
                            padding: '12px 24px',
                            fontWeight: 700,
                            color: 'var(--odoo-text-secondary)',
                            fontSize: '13px',
                            border: 'none', backgroundColor: 'transparent',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--odoo-danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--odoo-text-secondary)'; }}
                    >
                        <Trash2 className="w-4 h-4" /> Clear
                    </button>

                    <div className="flex items-center gap-4">
                        {printAwbLabel && selectedOrder.awb && (
                            <button
                                onClick={() => printAwbLabel(selectedOrder, selectedOrder.awb)}
                                className="flex items-center gap-2"
                                style={{
                                    padding: '12px 32px',
                                    fontWeight: 700,
                                    color: 'var(--odoo-purple)',
                                    border: '2px solid var(--odoo-purple)',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <Printer className="w-4 h-4" /> Print Receipt
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (allVerified && !hasAwb) {
                                    const rec = suggestBox(selectedOrder?.items || []);
                                    const recBox = BOX_TYPES.find(b => b.id === rec);
                                    if (recBox) handleBoxSelect(recBox);
                                }
                            }}
                            disabled={!allVerified || hasAwb || isProcessingAPI}
                            className="flex items-center gap-3"
                            style={{
                                padding: '14px 48px',
                                background: allVerified && !hasAwb ? 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' : 'var(--odoo-surface-high)',
                                color: allVerified && !hasAwb ? '#fff' : 'var(--odoo-text-muted)',
                                fontWeight: 900,
                                borderRadius: '4px',
                                border: 'none',
                                fontSize: '14px',
                                cursor: allVerified && !hasAwb ? 'pointer' : 'not-allowed',
                                boxShadow: allVerified && !hasAwb ? '0 4px 16px rgba(87,52,79,0.2)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            Create SO
                        </button>
                    </div>
                </footer>
            )}

            <PackStation isOpen={showStation} onClose={() => setShowStation(false)} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} />
        </div>
    );
});

POSPack.displayName = 'POSPack';
export default POSPack;
