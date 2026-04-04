import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Box, CheckCircle2, ChevronLeft, ArrowLeft, Package, ScanLine, ScanBarcode, AlertTriangle, CheckSquare, Barcode, Printer, Tag, PackageCheck, Smartphone, RefreshCw, Truck, SkipForward, ChevronDown } from 'lucide-react';
import { PRODUCT_CATALOG, BOX_TYPES, PLATFORM_LABELS, PACKING_SPEC, suggestBox } from '../constants';
import { PlatformBadge } from './PlatformLogo';
import { fetchAiSuggestion } from '../services/odooApi';
import { sanitizeBarcode } from '../utils/barcode';

const PAGE_SIZE = 20;

const HandheldPack = React.memo(({ salesOrders, setSalesOrders, playSound, logActivity, addToast, boxUsageLog, setBoxUsageLog, handleFulfillmentAndAWB, isProcessingAPI, apiConfigs }) => {
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [scanInput, setScanInput] = useState('');
    const [selectedBoxType, setSelectedBoxType] = useState(null);
    const [lastScanStatus, setLastScanStatus] = useState(null);
    const [showLabel, setShowLabel] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const scanRef = useRef(null);
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [isAskingAi, setIsAskingAi] = useState(false);
    const [awbInput, setAwbInput] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const packableOrders = useMemo(() =>
        salesOrders.filter(o => o.status === 'picked' || o.status === 'packing'),
        [salesOrders]
    );

    const sortedOrders = useMemo(() =>
        [...packableOrders].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
        [packableOrders]
    );

    // Reset pagination when order list changes significantly
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [packableOrders.length]);

    useEffect(() => {
        if (selectedOrder) {
            const updated = salesOrders.find(o => o.id === selectedOrder.id);
            if (updated && updated !== selectedOrder) setSelectedOrder(updated);
        }
    }, [salesOrders]);

    useEffect(() => {
        if (selectedOrder && selectedOrder.status !== 'packed') {
            const allVerified = (selectedOrder.items || []).every(i => (i.packed || 0) >= (i.picked || 0));
            if (!allVerified) {
                setTimeout(() => scanRef.current?.focus(), 100);
            }
        }
    }, [selectedOrder]);

    const [flashStatus, setFlashStatus] = useState(null);

    const findSkuByBarcode = (barcode) => {
        for (const [sku, catalog] of Object.entries(PRODUCT_CATALOG)) {
            if (catalog.barcode === barcode) return sku;
        }
        return null;
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
            logActivity('pack-handheld', { order: selectedOrder.ref, sku: item.sku });
            const catalog = PRODUCT_CATALOG[item.sku];
            setLastScanStatus({ type: 'success', sku: item.sku, name: item.name, packed: item.packed, total: item.picked, image: catalog?.image });
        } else {
            playSound('error');
            setFlashStatus('error');
            setLastScanStatus({ type: 'error', message: `Barcode "${input}" not recognized or fully packed` });
        }
        setScanInput('');
        setTimeout(() => setFlashStatus(null), 500);
    };

    const completePack = (boxType) => {
        const box = boxType || selectedBoxType;
        if (!box) return;

        const updatedOrders = salesOrders.map(o =>
            o.id === selectedOrder.id ? { ...o, boxType: box.id, status: 'packed' } : o
        );
        setSalesOrders(updatedOrders);
        playSound('success');
        logActivity('box-handheld', { order: selectedOrder.ref, boxType: box.id });

        if (setBoxUsageLog) {
            setBoxUsageLog(prev => [...prev, { boxType: box.id, boxName: box.name, order: selectedOrder.ref, timestamp: Date.now() }]);
        }

        addToast(`${selectedOrder.ref} packed`);

        const platformLabel = PLATFORM_LABELS[selectedOrder.courier] || PLATFORM_LABELS[selectedOrder.platform];
        const awb = (platformLabel?.prefix || 'TH') + Math.floor(Math.random() * 88888888 + 10000000);
        setShowLabel({ order: selectedOrder, awb, platform: platformLabel, boxType: box });
        setLastScanStatus(null);
        setSelectedBoxType(null);

        handleFulfillmentAndAWB(selectedOrder);
    };

    const askAiBrain = async () => {
        if (!selectedOrder) return;
        setIsAskingAi(true);
        setAiSuggestion(null);
        try {
            const odooConfig = apiConfigs?.odoo || {};
            const result = await fetchAiSuggestion(odooConfig, selectedOrder.id, "How should I pack this order efficiently?");
            if (result && result.suggestion) {
                setAiSuggestion(result.suggestion);
                addToast('AI Brain: Suggestion received');
            } else {
                throw new Error('No suggestion returned');
            }
        } catch (err) {
            console.error('AI Error:', err);
            addToast('AI Brain is offline. Starting up...', 'error');
            setAiSuggestion("AI Brain (SOPs) is currently syncing with Odoo. Please try again in 30 seconds.");
        } finally {
            setIsAskingAi(false);
        }
    };

    const handlePrintLabel = () => {
        const element = document.getElementById(`shipping-label-handheld`);
        if (!element || !window.html2pdf) return;

        setIsPrinting(true);
        const opt = {
            margin: 5,
            filename: `Label_${showLabel.order.ref}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' }
        };

        window.html2pdf().set(opt).from(element).save().then(() => {
            setIsPrinting(false);
            addToast('Label generated successfully');
        }).catch((err) => {
            setIsPrinting(false);
            console.error('Print Error:', err);
            addToast('Print failed', 'error');
        });
    };

    const closeLabelAndNext = () => {
        setShowLabel(null);
        setSelectedOrder(null);
    };

    const totalItems = selectedOrder ? selectedOrder.items.reduce((s, i) => s + i.picked, 0) : 0;
    const packedItems = selectedOrder ? selectedOrder.items.reduce((s, i) => s + i.packed, 0) : 0;
    const progress = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

    // --- Shared inline styles ---
    const sectionLabel = {
        fontSize: '0.6875rem',
        fontWeight: 700,
        color: 'var(--odoo-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
    };

    const cardBase = {
        backgroundColor: 'var(--odoo-surface)',
        borderRadius: 'var(--odoo-radius)',
        boxShadow: 'var(--odoo-shadow-sm)',
    };

    // =========================================================
    // Shipping label popup (preserved from original)
    // =========================================================
    if (showLabel) {
        const pl = showLabel.platform || { color: 'var(--odoo-purple)', logo: '?', name: 'Unknown' };
        return (
            <div className="max-w-md mx-auto w-full pb-20" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div style={{ ...cardBase, overflow: 'hidden', border: '1px solid var(--odoo-border-ghost)' }}>
                    {/* Label header */}
                    <div className="text-center py-3 font-bold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: pl.color, color: pl.textColor || '#fff' }}>
                        <Printer className="w-4 h-4" />
                        Shipping Label - {pl.name}
                    </div>

                    {/* Label content for printing */}
                    <div className="p-1" style={{ backgroundColor: 'var(--odoo-surface)' }}>
                        <div id="shipping-label-handheld" className="p-6" style={{ border: '2px dashed var(--odoo-border)', borderRadius: 'var(--odoo-radius)', backgroundColor: 'var(--odoo-surface)', color: 'var(--odoo-text)' }}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>FROM</p>
                                    <p className="text-sm font-bold">SKINOXY (Kiss of Beauty)</p>
                                    <p className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>Bangkok, Thailand</p>
                                </div>
                                <PlatformBadge name={showLabel.order?.courier || showLabel.order?.platform} size={56} rounded="lg" />
                            </div>

                            <div className="mb-4">
                                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TO</p>
                                <p className="text-base font-bold">{showLabel.order.customer}</p>
                            </div>

                            <div className="p-4 mb-4 text-center" style={{ backgroundColor: 'var(--odoo-surface-low)', borderRadius: 'var(--odoo-radius)', border: '1px solid var(--odoo-border-ghost)' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>AWB / Tracking</p>
                                <p className="text-2xl font-black font-mono tracking-wider">{showLabel.awb}</p>
                                <div className="mt-2 flex justify-center">
                                    <div className="h-12 flex items-end gap-px">
                                        {showLabel.awb.split('').map((c, i) => (
                                            <div key={i} style={{ backgroundColor: 'var(--odoo-text)', width: (parseInt(c) || 3) > 5 ? 3 : 2, height: 32 + (parseInt(c) || 3) * 2 }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                {[
                                    { label: 'ORDER', value: showLabel.order.ref },
                                    { label: 'BOX', value: showLabel.boxType?.name },
                                    { label: 'ITEMS', value: showLabel.order.items.reduce((s, i) => s + i.picked, 0) },
                                ].map((d, i) => (
                                    <div key={i} className="p-2" style={{ backgroundColor: 'var(--odoo-surface-low)', borderRadius: 'var(--odoo-radius)', border: '1px solid var(--odoo-border-ghost)' }}>
                                        <p style={{ fontSize: 9, color: 'var(--odoo-text-muted)', fontWeight: 700 }}>{d.label}</p>
                                        <p className="font-bold">{d.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pb-6 flex gap-3 mt-4">
                        <button
                            onClick={handlePrintLabel}
                            disabled={isPrinting}
                            className="flex-1 py-3.5 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))', color: '#fff', borderRadius: 'var(--odoo-radius)' }}
                        >
                            {isPrinting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                            Print Label
                        </button>
                        <button onClick={closeLabelAndNext} className="flex-1 py-3.5 font-bold text-sm active:scale-[0.97] transition-all" style={{ border: '2px solid var(--odoo-border)', borderRadius: 'var(--odoo-radius)', color: 'var(--odoo-text)', backgroundColor: 'transparent' }}>
                            Next Order
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================
    // Order list view (no order selected)
    // =========================================================
    if (!selectedOrder) {
        return (
            <div className="max-w-md mx-auto w-full pb-20 px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                {/* Header card */}
                <div className="p-5 mb-4" style={{ ...cardBase, border: '1px solid var(--odoo-border-ghost)' }}>
                    <div className="flex items-center gap-4 mb-1">
                        <div className="w-12 h-12 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))', color: '#fff', borderRadius: 'var(--odoo-radius)' }}>
                            <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-tight" style={{ color: 'var(--odoo-purple)' }}>Pack (Handheld)</h1>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>KOB&amp;BTV-Online</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5" style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'var(--odoo-purple-light)', color: 'var(--odoo-purple)', borderRadius: 'var(--odoo-radius)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Package className="w-3.5 h-3.5" /> {packableOrders.length} Ready
                        </span>
                    </div>
                    {/* Quick scan to jump to any order — works even if order is not in visible page */}
                    <div className="mt-3 relative">
                        <input
                            type="text"
                            placeholder="Scan/search order ref..."
                            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold pl-10"
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;
                                const q = e.target.value.trim().toUpperCase();
                                if (!q) return;
                                const match = packableOrders.find(o =>
                                    o.ref?.toUpperCase() === q ||
                                    o.ref?.toUpperCase().includes(q) ||
                                    o.odooPickingId?.toString() === q
                                );
                                if (match) {
                                    setSelectedOrder(match);
                                    setLastScanStatus(null);
                                }
                                e.target.value = '';
                            }}
                        />
                        <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    </div>
                </div>

                {packableOrders.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center" style={{ ...cardBase, border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-muted)' }}>
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                            <Package className="w-10 h-10" style={{ opacity: 0.2 }} />
                        </div>
                        <p className="text-sm font-bold" style={{ color: 'var(--odoo-text-secondary)' }}>All orders are packed!</p>
                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4, opacity: 0.5 }}>Checking for new orders...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedOrders
                            .slice(0, visibleCount)
                            .map(order => {
                                const oTotal = order.items.reduce((s, i) => s + i.picked, 0);
                                const oPacked = order.items.reduce((s, i) => s + i.packed, 0);
                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => { setSelectedOrder(order); setLastScanStatus(null); }}
                                        className="w-full p-4 flex items-center justify-between active:scale-[0.98] transition-all"
                                        style={{ ...cardBase, border: '1px solid var(--odoo-border-ghost)', boxShadow: 'var(--odoo-shadow-sm)' }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <PlatformBadge name={order?.courier || order?.platform} size={48} rounded="lg" />
                                            <div className="text-left">
                                                <p className="font-bold text-base leading-tight" style={{ color: 'var(--odoo-text)' }}>{order.ref}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer}</p>
                                                <p className="mt-1" style={{ fontSize: '9px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{order.courier} &bull; {oTotal} items</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold px-2 py-1 uppercase tracking-wider mb-2" style={{
                                                borderRadius: 'var(--odoo-radius)',
                                                backgroundColor: order.status === 'packing' ? 'var(--odoo-warning-light)' : 'var(--odoo-purple-light)',
                                                color: order.status === 'packing' ? 'var(--odoo-warning-dark)' : 'var(--odoo-purple)',
                                            }}>
                                                {order.status === 'packing' ? 'Packing' : 'Ready'}
                                            </div>
                                            <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{oPacked}/{oTotal}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        {visibleCount < sortedOrders.length && (
                            <button
                                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                                className="w-full py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm font-bold text-[#714B67] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                            >
                                <ChevronDown className="w-4 h-4" />
                                Load more ({sortedOrders.length - visibleCount} remaining)
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // =========================================================
    // Pack & Verify detail view (Stitch design)
    // =========================================================
    const allVerified = selectedOrder.items.every(i => i.packed === i.picked);
    const platformLabel = PLATFORM_LABELS[selectedOrder.courier] || PLATFORM_LABELS[selectedOrder.platform];
    const platformName = platformLabel?.name || selectedOrder.courier || selectedOrder.platform || 'Direct';

    return (
        <div className="min-h-screen pb-36" style={{ backgroundColor: 'var(--odoo-bg)', fontFamily: 'Inter, sans-serif' }}>
            {/* ---- Top App Bar ---- */}
            <nav className="flex items-center px-4 py-3 w-full sticky top-0 z-50" style={{ backgroundColor: 'var(--odoo-bg)' }}>
                <div className="flex items-center gap-4 w-full">
                    <button
                        onClick={() => { setSelectedOrder(null); setLastScanStatus(null); setSelectedBoxType(null); setAiSuggestion(null); }}
                        className="p-2 rounded transition-colors"
                        style={{ color: 'var(--odoo-purple)' }}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="font-bold tracking-tight text-xl" style={{ color: 'var(--odoo-purple)' }}>Pack &amp; Verify</h1>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 1, backgroundColor: 'var(--odoo-surface-high)' }} />
            </nav>

            <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
                {/* ---- Scanner Input Card ---- */}
                <section className="p-6" style={{ ...cardBase, borderRadius: '6px' }}>
                    <div className="flex flex-col items-center justify-center space-y-3">
                        <ScanBarcode className="w-9 h-9" style={{ color: 'var(--odoo-purple)' }} />
                        {!allVerified ? (
                            <>
                                <input
                                    ref={scanRef}
                                    type="text"
                                    autoFocus
                                    value={scanInput}
                                    onChange={e => setScanInput(e.target.value)}
                                    onKeyDown={handleScanSubmit}
                                    placeholder="Scan Order or AWB..."
                                    className="w-full text-center text-lg py-2"
                                    style={{
                                        fontFamily: 'Source Code Pro, monospace',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderBottom: `2px solid ${flashStatus === 'success' ? 'var(--odoo-success)' : flashStatus === 'error' ? 'var(--odoo-danger)' : 'var(--odoo-surface-high)'}`,
                                        outline: 'none',
                                        color: 'var(--odoo-text)',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => { if (!flashStatus) e.target.style.borderBottomColor = 'var(--odoo-purple)'; }}
                                    onBlur={e => { if (!flashStatus) e.target.style.borderBottomColor = 'var(--odoo-surface-high)'; }}
                                />
                                <p style={{ ...sectionLabel, fontSize: '0.6875rem' }}>
                                    Awaiting Scanner Input
                                </p>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5" style={{ backgroundColor: 'var(--odoo-success-light)', color: 'var(--odoo-success)', borderRadius: 'var(--odoo-radius)', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <PackageCheck className="w-3.5 h-3.5" /> All items verified
                            </div>
                        )}
                    </div>
                </section>

                {/* ---- Last Scan Feedback ---- */}
                {lastScanStatus && (
                    <div className="px-3 py-2.5 flex items-center gap-2" style={{
                        borderRadius: 'var(--odoo-radius)',
                        backgroundColor: lastScanStatus.type === 'success' ? 'var(--odoo-success-light)' : 'var(--odoo-danger-light)',
                        border: `1px solid ${lastScanStatus.type === 'success' ? 'var(--odoo-success-border)' : 'var(--odoo-danger)'}`,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: lastScanStatus.type === 'success' ? 'var(--odoo-success-dark)' : 'var(--odoo-danger)',
                    }}>
                        {lastScanStatus.type === 'success' ? (
                            <><CheckCircle2 className="w-4 h-4 shrink-0" /> {lastScanStatus.sku} verified ({lastScanStatus.packed}/{lastScanStatus.total})</>
                        ) : (
                            <><AlertTriangle className="w-4 h-4 shrink-0" /> {lastScanStatus.message}</>
                        )}
                    </div>
                )}

                {/* ---- AI Suggestion Box ---- */}
                {aiSuggestion && (
                    <div className="p-4 relative overflow-hidden" style={{ borderRadius: 'var(--odoo-radius)', backgroundColor: 'var(--odoo-warning-light)', border: '2px solid var(--odoo-warning)' }}>
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded shrink-0" style={{ backgroundColor: 'var(--odoo-warning)', color: '#fff' }}>
                                <Smartphone className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-warning-dark)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>AI Smart Suggestion</p>
                                <p className="text-xs font-semibold leading-relaxed italic" style={{ color: 'var(--odoo-text-secondary)' }}>"{aiSuggestion}"</p>
                            </div>
                            <button onClick={() => setAiSuggestion(null)} className="p-1 transition-colors" style={{ color: 'var(--odoo-text-muted)' }}>
                                <CheckSquare className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ---- Order Detail Card (left purple border) ---- */}
                <div className="p-4" style={{ ...cardBase, borderLeft: '4px solid var(--odoo-purple)' }}>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span style={sectionLabel}>Order ID</span>
                            <h2 className="text-xl font-bold leading-tight" style={{ color: 'var(--odoo-text)' }}>#{selectedOrder.ref}</h2>
                        </div>
                        <div style={{
                            backgroundColor: 'rgba(113, 75, 103, 0.1)',
                            color: 'var(--odoo-purple)',
                            borderRadius: 'var(--odoo-radius)',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '-0.02em',
                        }}>
                            {platformName}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <span style={sectionLabel}>Customer</span>
                            <p className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>{selectedOrder.customer}</p>
                        </div>
                        <div className="text-right">
                            <span style={sectionLabel}>Items</span>
                            <p className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>{String(totalItems).padStart(2, '0')} Units</p>
                        </div>
                    </div>
                </div>

                {/* ---- Items To Pack ---- */}
                <section className="space-y-2">
                    <h3 className="px-1" style={sectionLabel}>Items To Pack</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {selectedOrder.items.map((item, idx) => {
                            const done = item.packed === item.picked;
                            const catalog = PRODUCT_CATALOG[item.sku];
                            return (
                                <div
                                    key={idx}
                                    className="p-3 flex items-center gap-3 transition-colors"
                                    style={{
                                        backgroundColor: done ? 'var(--odoo-success-light)' : 'var(--odoo-surface)',
                                        borderRadius: 'var(--odoo-radius)',
                                        border: done ? '1px solid var(--odoo-success)' : '1px solid transparent',
                                        boxShadow: 'var(--odoo-shadow-sm)',
                                    }}
                                >
                                    {/* Product thumbnail */}
                                    <div className="w-12 h-12 overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--odoo-surface-high)', borderRadius: 'var(--odoo-radius)' }}>
                                        {catalog?.image ? (
                                            <img src={catalog.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--odoo-border)' }}>
                                                <Box className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    {/* Product info */}
                                    <div className="flex-grow min-w-0">
                                        <p className="text-xs font-bold" style={{ fontFamily: 'Source Code Pro, monospace', color: 'var(--odoo-purple)' }}>
                                            SKU: {item.sku}
                                        </p>
                                        <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--odoo-text)' }}>
                                            {catalog?.shortName || item.name}
                                        </p>
                                        {done && (
                                            <span className="inline-flex items-center gap-1 mt-1" style={{ fontSize: '8px', fontWeight: 700, color: 'var(--odoo-success)', textTransform: 'uppercase' }}>
                                                <CheckSquare className="w-2.5 h-2.5" /> VERIFIED
                                            </span>
                                        )}
                                    </div>
                                    {/* Qty counter */}
                                    <div className="text-right flex flex-col items-end">
                                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase' }}>Qty</span>
                                        <p className="text-lg font-bold" style={{
                                            color: done ? 'var(--odoo-success)' : item.packed === 0 ? 'var(--odoo-danger)' : 'var(--odoo-text)',
                                        }}>
                                            {item.packed}/{item.picked}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ---- Box Selection (2x2 grid) ---- */}
                <section className="space-y-2">
                    <h3 className="px-1" style={sectionLabel}>Select Shipping Container</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {BOX_TYPES.map(box => {
                            const isSelected = selectedBoxType?.id === box.id;
                            return (
                                <button
                                    key={box.id}
                                    onClick={() => setSelectedBoxType(box)}
                                    className="p-3 text-left transition-all active:scale-[0.97]"
                                    style={{
                                        backgroundColor: 'var(--odoo-surface)',
                                        borderRadius: 'var(--odoo-radius)',
                                        border: isSelected ? '2px solid var(--odoo-purple)' : '2px solid transparent',
                                        boxShadow: isSelected ? '0 0 0 2px rgba(113, 75, 103, 0.15)' : 'none',
                                    }}
                                >
                                    <span className="block text-sm font-bold" style={{ color: isSelected ? 'var(--odoo-purple)' : 'var(--odoo-text)' }}>
                                        {box.name}
                                    </span>
                                    <span className="block" style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', color: 'var(--odoo-text-muted)' }}>
                                        {box.size}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* ---- AWB Verification ---- */}
                <section className="p-4" style={{ backgroundColor: 'var(--odoo-surface-high)', borderRadius: '6px' }}>
                    <div className="flex items-center gap-3">
                        <Truck className="w-5 h-5" style={{ color: 'var(--odoo-text-muted)' }} />
                        <div className="flex-grow">
                            <span style={{ ...sectionLabel, display: 'block' }}>AWB Verification</span>
                            <input
                                type="text"
                                value={awbInput}
                                onChange={e => setAwbInput(e.target.value)}
                                placeholder="Scan AWB to finalize courier..."
                                className="w-full text-sm p-0"
                                style={{
                                    fontFamily: 'Source Code Pro, monospace',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: 'var(--odoo-text)',
                                }}
                            />
                        </div>
                    </div>
                </section>

                {/* ---- AI Brain button ---- */}
                <button
                    onClick={askAiBrain}
                    disabled={isAskingAi}
                    className="w-full py-2 flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                    style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--odoo-text-muted)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    {isAskingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Box className="w-3.5 h-3.5" />}
                    {isAskingAi ? 'Thinking...' : 'Ask AI for packing suggestion'}
                </button>
            </main>

            {/* ---- Fixed Footer Buttons ---- */}
            <div className="fixed bottom-0 left-0 w-full p-4 flex flex-col gap-2 z-50" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 -4px 12px rgba(113, 75, 103, 0.08)',
            }}>
                <button
                    onClick={() => {
                        if (allVerified && selectedBoxType) {
                            completePack(selectedBoxType);
                        } else if (allVerified) {
                            const rec = suggestBox(selectedOrder?.items || []);
                            const recBox = BOX_TYPES.find(b => b.id === rec);
                            if (recBox) completePack(recBox);
                        }
                    }}
                    disabled={!allVerified}
                    className="w-full flex items-center justify-center gap-2 font-bold active:scale-[0.98] transition-transform"
                    style={{
                        height: 50,
                        background: allVerified
                            ? 'linear-gradient(135deg, var(--odoo-success), var(--odoo-purple-dark))'
                            : 'var(--odoo-surface-high)',
                        color: allVerified ? '#fff' : 'var(--odoo-text-muted)',
                        borderRadius: 'var(--odoo-radius)',
                        border: 'none',
                        cursor: allVerified ? 'pointer' : 'not-allowed',
                        opacity: allVerified ? 1 : 0.6,
                    }}
                >
                    <CheckCircle2 className="w-5 h-5" />
                    COMPLETE PACK
                </button>
                <button
                    onClick={() => { setSelectedOrder(null); setLastScanStatus(null); setSelectedBoxType(null); setAiSuggestion(null); }}
                    className="w-full flex items-center justify-center font-semibold active:scale-[0.98] transition-colors"
                    style={{
                        height: 44,
                        border: '2px solid var(--odoo-border)',
                        borderRadius: 'var(--odoo-radius)',
                        color: 'var(--odoo-text)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                    }}
                >
                    SKIP ORDER
                </button>
            </div>
        </div>
    );
});

HandheldPack.displayName = 'HandheldPack';
export default HandheldPack;
