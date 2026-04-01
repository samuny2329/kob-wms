import React, { useState, useRef, useEffect } from 'react';
import { Box, CheckCircle2, Package, ScanLine, AlertTriangle, CheckSquare, Barcode, Monitor, Plus, Minus, Printer, RefreshCw, PackageCheck, Search, Tag, X, Lock } from 'lucide-react';
import { PRODUCT_CATALOG, BOX_TYPES, PLATFORM_LABELS, PACKING_SPEC, suggestBox } from '../constants';
import { PlatformBadge } from './PlatformLogo';

const POSPack = ({ salesOrders, setSalesOrders, playSound, logActivity, addToast, handleFulfillmentAndAWB, isProcessingAPI, boxUsageLog, setBoxUsageLog, printAwbLabel }) => {
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [scanInput, setScanInput] = useState('');
    const [awbInput, setAwbInput] = useState('');
    const [lastScanStatus, setLastScanStatus] = useState(null);
    const [searchFilter, setSearchFilter] = useState('');
    const scanRef = useRef(null);
    const awbRef = useRef(null);
    const workOrderRef = useRef(null);
    const [workOrderInput, setWorkOrderInput] = useState('');


    const packableOrders = salesOrders.filter(o => ['picked', 'packing', 'packed', 'rts'].includes(o.status));
    const filteredOrders = searchFilter
        ? packableOrders.filter(o => o.ref.toLowerCase().includes(searchFilter.toLowerCase()) || (o.customer || '').toLowerCase().includes(searchFilter.toLowerCase()))
        : packableOrders;

    useEffect(() => {
        if (selectedOrder) {
            const updated = salesOrders.find(o => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
        }
    }, [salesOrders]);

    useEffect(() => {
        if (!selectedOrder) return;
        if (selectedOrder.status === 'rts' && selectedOrder.awb) {
            setTimeout(() => awbRef.current?.focus(), 100);
        } else if (!allVerified) {
            setTimeout(() => scanRef.current?.focus(), 100);
        }
    }, [selectedOrder?.status, selectedOrder?.awb]);

    const [flashStatus, setFlashStatus] = useState(null); // 'success' or 'error'

    // Reverse lookup: find SKU from barcode across entire PRODUCT_CATALOG
    const findSkuByBarcode = (barcode) => {
        for (const [sku, catalog] of Object.entries(PRODUCT_CATALOG)) {
            if (catalog.barcode === barcode) return sku;
        }
        return null;
    };

    // Auto-select when scanning work order ref (e.g. WH/OUT/00050)
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
        const input = scanInput.trim();
        const inputUpper = input.toUpperCase();
        const items = [...selectedOrder.items];

        // Resolve SKU from barcode if input looks like a barcode (all digits)
        const isBarcode = /^\d{8,14}$/.test(input);
        const resolvedSku = isBarcode ? findSkuByBarcode(input) : null;

        // Find item by: SKU match, barcode from PRODUCT_CATALOG, barcode on item itself, or resolved SKU
        const item = items.find(i => {
            const catalog = PRODUCT_CATALOG[i.sku];
            const skuMatch = i.sku.toUpperCase() === inputUpper;
            const catalogBarcodeMatch = catalog && catalog.barcode === input;
            const itemBarcodeMatch = i.barcode && i.barcode === input;
            const resolvedMatch = resolvedSku && i.sku === resolvedSku;
            return (skuMatch || catalogBarcodeMatch || itemBarcodeMatch || resolvedMatch) && i.packed < i.picked;
        });

        if (item) {
            item.packed++;
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
        // Auto-return to work order scan screen
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
        // Accept: exact match OR scanned value contains stored AWB OR stored AWB contains scanned value
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

    return (
        <div className="w-full animate-slide-up h-full relative">
            <div className="flex gap-4 h-full">
                {/* LEFT: Order List Panel - Odoo style */}
                <div className="w-80 shrink-0 flex flex-col overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                    {/* Header */}
                    <div className="p-4" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: '#714B67', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                                <Monitor className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 style={{ fontWeight: 700, fontSize: '13px', color: '#212529' }}>Pack Station (POS)</h2>
                                <p style={{ fontSize: '11px', color: '#6c757d' }}>{packableOrders.length} orders to pack</p>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#adb5bd' }} />
                            <input
                                type="text"
                                value={searchFilter}
                                onChange={e => {
                                    setSearchFilter(e.target.value);
                                }}
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
                                placeholder="Search..."
                                className="odoo-input"
                                style={{ paddingLeft: '32px', width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredOrders.length === 0 ? (
                            <div className="text-center py-16" style={{ color: '#adb5bd' }}>
                                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p style={{ fontSize: '12px', fontWeight: 600 }}>No orders</p>
                            </div>
                        ) : (
                            <div>
                                {filteredOrders
                                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
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
                                                style={{ borderBottom: '1px solid #dee2e6', borderLeft: `3px solid ${isActive ? '#714B67' : 'transparent'}`, backgroundColor: isActive ? '#f3edf7' : 'transparent', cursor: 'pointer' }}
                                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <PlatformBadge name={order.courier || order.platform} size={32} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center">
                                                            <p style={{ fontWeight: 700, fontSize: '13px', color: '#212529' }} className="truncate">{order.ref}</p>
                                                            <span className="odoo-badge ml-2 shrink-0" style={order.status === 'packing' ? { backgroundColor: '#fff8e1', color: '#856404', border: '1px solid #ffc107' } : { backgroundColor: '#f3edf7', color: '#714B67', border: '1px solid #c9a8bc' }}>
                                                                {oPacked}/{oTotal}
                                                            </span>
                                                        </div>
                                                        <p style={{ fontSize: '11px', color: '#6c757d' }} className="truncate">{order.customer}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Pack Detail Panel */}
                <div className="flex-1 flex flex-col min-w-0">
                    {!selectedOrder ? (
                        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <div className="text-center max-w-sm w-full px-8" style={{ color: '#adb5bd' }}>
                                <ScanLine className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#212529', marginBottom: '4px' }}>Scan work order to start packing</p>
                                <p style={{ fontSize: '12px', marginBottom: '20px' }}>Scan work order ref (e.g. WH/OUT/00050)</p>
                                <div className="relative">
                                    <input
                                        ref={workOrderRef}
                                        type="text"
                                        autoFocus
                                        value={workOrderInput}
                                        onChange={e => setWorkOrderInput(e.target.value)}
                                        onKeyDown={handleWorkOrderScan}
                                        placeholder="SCAN WORK ORDER..."
                                        className="industrial-input w-full"
                                    />
                                    <ScanLine className="w-6 h-6 absolute right-4 top-1/2 -translate-y-1/2 text-slate-200" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            {/* Order header - Odoo Dark Style */}
                            <div className="px-5 py-4 bg-[#714B67] text-white flex justify-between items-center shadow-lg relative z-10">
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="text-center flex-1">
                                    <h3 className="font-black text-lg tracking-tight uppercase">{selectedOrder.ref}</h3>
                                    <p className="text-[10px] font-bold text-white/60 tracking-widest uppercase">{selectedOrder.customer} • {selectedOrder.courier}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-2xl font-black tabular-nums">{progress}%</p>
                                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-tighter">{packedItems}/{totalItems} Items</p>
                                    </div>
                                </div>
                            </div>

                            {/* Progress bar - Odoo secondary color (Teal) */}
                            <div className="w-full h-1.5 bg-black/20">
                                <div className="h-full transition-all duration-500 shadow-[0_0_10px_rgba(0,160,157,0.5)]" style={{ width: `${progress}%`, backgroundColor: '#00A09D' }} />
                            </div>

                            {/* LOCKED stage */}
                            {isLocked ? (
                                <div className="flex-1 flex items-center justify-center p-8">
                                    <div className="text-center animate-fade-in max-w-sm">
                                        <div style={{ width: '80px', height: '80px', backgroundColor: '#fff5f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                            <Lock className="w-10 h-10" style={{ color: '#dc3545' }} />
                                        </div>
                                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#212529', marginBottom: '4px' }}>Order Locked</h2>
                                        <p style={{ fontSize: '13px', color: '#6c757d', marginBottom: '4px' }}>{selectedOrder.ref} • AWB confirmed</p>
                                        <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', padding: '4px 12px', display: 'inline-block', marginBottom: '6px', color: '#212529' }}>{selectedOrder.awb}</p>
                                        <p style={{ fontSize: '12px', color: '#adb5bd', marginBottom: '20px' }}>{selectedOrder.boxType} • {selectedOrder.courier}</p>
                                        <button onClick={() => { setSelectedOrder(null); setLastScanStatus(null); }} className="odoo-btn odoo-btn-secondary">
                                            Next Order
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Scan area */}
                                    <div className={`px-8 py-10 flex flex-col items-center ${flashStatus === 'success' ? 'animate-scan-flash' : flashStatus === 'error' ? 'animate-scan-error' : ''}`} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #dee2e6' }}>
                                        {/* Stage: AWB confirm scan */}
                                        {hasAwb ? (
                                            <div className="w-full max-w-xl text-center space-y-5">
                                                <div className="inline-flex items-center gap-2" style={{ padding: '6px 14px', backgroundColor: '#e0f5f5', color: '#017E84', borderRadius: '4px', fontSize: '12px', fontWeight: 700, border: '1px solid #00A09D' }}>
                                                    <PackageCheck className="w-4 h-4" /> AWB ready — scan label to confirm
                                                </div>
                                                <div style={{ border: '2px dashed #dee2e6', borderRadius: '4px', padding: '16px 32px', display: 'inline-block' }}>
                                                    <Barcode className="w-6 h-6 mx-auto mb-1" style={{ color: '#adb5bd' }} />
                                                    <p style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', color: '#212529', letterSpacing: '0.1em' }}>{selectedOrder.awb}</p>
                                                    <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>{selectedOrder.boxType} • {selectedOrder.courier}</p>
                                                </div>
                                                <div className="relative group">
                                                    <input
                                                        ref={awbRef}
                                                        type="text"
                                                        autoFocus
                                                        value={awbInput}
                                                        onChange={e => setAwbInput(e.target.value)}
                                                        onKeyDown={handlePosAwbConfirm}
                                                        placeholder="SCAN AWB LABEL TO CONFIRM..."
                                                        className="industrial-input w-full border-red-400 focus:border-red-500 caret-red-500"
                                                    />
                                                    <Lock className="w-6 h-6 absolute right-4 top-1/2 -translate-y-1/2 text-red-300" />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Scan matching AWB → system locks order immediately</p>
                                                {printAwbLabel && (
                                                    <button
                                                        onClick={() => printAwbLabel(selectedOrder, selectedOrder.awb)}
                                                        className="odoo-btn odoo-btn-secondary"
                                                    >
                                                        <Printer className="w-4 h-4" /> Reprint AWB
                                                    </button>
                                                )}
                                            </div>
                                        /* Stage: Box select */
                                        ) : allVerified ? (
                                            <div className="animate-fade-in text-center w-full">
                                                <div className="inline-flex items-center gap-2 mb-5" style={{ padding: '6px 14px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', fontSize: '12px', fontWeight: 700, border: '1px solid #c3e6cb' }}>
                                                    <PackageCheck className="w-4 h-4" /> ALL ITEMS VERIFIED
                                                </div>
                                                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#6c757d', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Select box type</h4>
                                                <p style={{ fontSize: '12px', color: '#adb5bd', marginBottom: '20px' }}>System will generate AWB automatically after selecting box</p>
                                                {isProcessingAPI ? (
                                                    <div className="flex flex-col items-center gap-3 py-4" style={{ color: '#6c757d' }}>
                                                        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#017E84' }} />
                                                        <p style={{ fontSize: '13px', fontWeight: 600 }}>Generating AWB...</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-3 justify-center flex-wrap">
                                                        {(() => { const rec = suggestBox(selectedOrder?.items || []); return BOX_TYPES.map(box => {
                                                            const isRec = box.id === rec;
                                                            const spec = PACKING_SPEC[box.id];
                                                            return (
                                                            <button
                                                                key={box.id}
                                                                onClick={() => handleBoxSelect(box)}
                                                                className="relative"
                                                                style={{ padding: '14px 20px', border: isRec ? '2px solid #017E84' : '2px solid #dee2e6', borderRadius: '4px', fontSize: '13px', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', backgroundColor: isRec ? '#e0f5f5' : '#ffffff', transition: 'all 0.15s' }}
                                                                onMouseEnter={e => { if (!isRec) { e.currentTarget.style.borderColor = '#017E84'; e.currentTarget.style.backgroundColor = '#e0f5f5'; }}}
                                                                onMouseLeave={e => { if (!isRec) { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.backgroundColor = '#ffffff'; }}}
                                                            >
                                                                {isRec && <span style={{ position: 'absolute', top: '-7px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', fontWeight: 800, color: '#fff', backgroundColor: '#017E84', padding: '1px 6px', borderRadius: '8px' }}>Best</span>}
                                                                <span style={{ fontSize: '24px' }}>{box.icon}</span>
                                                                <span style={{ color: '#212529' }}>{box.name}</span>
                                                                <span style={{ fontSize: '10px', color: '#adb5bd', fontFamily: 'monospace' }}>{box.size}</span>
                                                                {spec && (spec.bubble > 0 || spec.tape > 0) && (
                                                                    <span style={{ fontSize: '8px', color: '#adb5bd' }}>{spec.bubble > 0 ? `B${spec.bubble} ` : ''}{spec.tape > 0 ? `T${spec.tape}` : ''}</span>
                                                                )}
                                                            </button>
                                                            );
                                                        }); })()}
                                                    </div>
                                                )}
                                            </div>
                                        /* Stage: Item scan */
                                        ) : (
                                             <div className="w-full max-w-xl text-center space-y-4">
                                                 <div className="relative group">
                                                     <input
                                                         ref={scanRef}
                                                         type="text"
                                                         autoFocus
                                                         value={scanInput}
                                                         onChange={e => setScanInput(e.target.value)}
                                                         onKeyDown={handleScanSubmit}
                                                         placeholder="SCAN PRODUCT BARCODE..."
                                                         className="industrial-input w-full focus:ring-0 caret-[#714B67]"
                                                     />
                                                     <ScanLine className="w-8 h-8 absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 group-hover:text-primary-500 transition-colors duration-500" />
                                                 </div>
                                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Waiting for barcode scan...</p>
                                             </div>
                                        )}

                                        {lastScanStatus && (
                                            <div className="mt-8 inline-flex items-center gap-4 animate-slide-up" style={{ padding: '12px 20px', borderRadius: '4px', fontSize: '15px', fontWeight: 800, border: `1px solid ${lastScanStatus.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`, backgroundColor: lastScanStatus.type === 'success' ? '#d4edda' : '#fff5f5', color: lastScanStatus.type === 'success' ? '#155724' : '#721c24' }}>
                                                {lastScanStatus.type === 'success' && lastScanStatus.image && <img src={lastScanStatus.image} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm ring-2 ring-emerald-200" />}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        {lastScanStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5 font-bold" />}
                                                        <span>{lastScanStatus.type === 'success' ? 'ITEM SCANNED' : 'INVALID PRODUCT'}</span>
                                                    </div>
                                                    <p className="text-xs font-bold opacity-60 mt-0.5">{lastScanStatus.type === 'success' ? `${lastScanStatus.sku} • ${lastScanStatus.name}` : lastScanStatus.message}</p>
                                                </div>
                                                {lastScanStatus.type === 'success' && (
                                                    <div className="ml-4 pl-4 border-l border-emerald-200 dark:border-emerald-800 text-2xl tabular-nums">
                                                        {lastScanStatus.packed}<span className="text-sm opacity-50 mx-1">/</span>{lastScanStatus.total}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6" style={{ backgroundColor: '#f8f9fa' }}>
                                        <div className="grid grid-cols-1 gap-3">
                                            {selectedOrder.items.map((item, idx) => {
                                                const done = item.packed === item.picked;
                                                const catalog = PRODUCT_CATALOG[item.sku];
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-4"
                                                        style={{ backgroundColor: '#ffffff', padding: '14px 16px', border: `2px solid ${done ? '#00A09D' : '#dee2e6'}`, borderRadius: '4px', borderLeft: done ? '3px solid #017E84' : '2px solid #dee2e6' }}
                                                    >
                                                        <div className="flex-shrink-0" style={{ width: '56px', height: '56px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                                            {catalog?.image ? (
                                                                <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Box className="w-8 h-8" /></div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p style={{ fontWeight: 800, fontSize: '14px', color: '#212529', marginBottom: '2px' }}>{catalog?.shortName || item.name}</p>
                                                                    <p style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, color: '#adb5bd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <Barcode className="w-3 h-3" /> {item.sku}
                                                                        {catalog?.barcode && <span style={{ opacity: 0.6 }}>• EAN: {catalog.barcode}</span>}
                                                                        {catalog?.variant && <span style={{ opacity: 0.6 }}>• {catalog.variant}</span>}
                                                                    </p>
                                                                </div>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <div style={{ fontSize: '22px', fontWeight: 800, color: done ? '#017E84' : '#212529' }}>
                                                                        {item.packed}
                                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#dee2e6', margin: '0 4px' }}>/</span>
                                                                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#adb5bd' }}>{item.picked}</span>
                                                                    </div>
                                                                    <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px', color: done ? '#017E84' : '#adb5bd' }}>
                                                                        {done ? 'VERIFIED' : 'PENDING'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleManualAdjust(idx, -1)}
                                                                        disabled={item.packed <= 0}
                                                                        style={{ width: '32px', height: '28px', borderRadius: '4px', border: '1px solid #dee2e6', backgroundColor: '#f8f9fa', cursor: item.packed <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', opacity: item.packed <= 0 ? 0.3 : 1 }}
                                                                        onMouseEnter={e => { if (item.packed > 0) { e.currentTarget.style.backgroundColor = '#fff5f5'; e.currentTarget.style.color = '#dc3545'; } }}
                                                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.color = '#6c757d'; }}
                                                                    >
                                                                        <Minus className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleManualAdjust(idx, 1)}
                                                                        disabled={item.packed >= item.picked}
                                                                        style={{ width: '32px', height: '28px', borderRadius: '4px', border: '1px solid #dee2e6', backgroundColor: '#f8f9fa', cursor: item.packed >= item.picked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', opacity: item.packed >= item.picked ? 0.3 : 1 }}
                                                                        onMouseEnter={e => { if (item.packed < item.picked) { e.currentTarget.style.backgroundColor = '#d4edda'; e.currentTarget.style.color = '#28a745'; } }}
                                                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.color = '#6c757d'; }}
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                {done && (
                                                                    <div className="flex items-center gap-1 ml-auto" style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#017E84' }}>
                                                                        <CheckSquare className="w-4 h-4" /> Line Complete
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default POSPack;
