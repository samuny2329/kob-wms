import React, { useState, useRef, useEffect } from 'react';
import { Box, CheckCircle2, ChevronLeft, Package, ScanLine, AlertTriangle, CheckSquare, Barcode, Printer, Tag, PackageCheck, Smartphone, RefreshCw } from 'lucide-react';
import { PRODUCT_CATALOG, BOX_TYPES, PLATFORM_LABELS, PACKING_SPEC, suggestBox } from '../constants';
import { PlatformBadge } from './PlatformLogo';
import { fetchAiSuggestion } from '../services/odooApi';

const HandheldPack = ({ salesOrders, setSalesOrders, playSound, logActivity, addToast, boxUsageLog, setBoxUsageLog, handleFulfillmentAndAWB, isProcessingAPI, apiConfigs }) => {
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [scanInput, setScanInput] = useState('');
    const [selectedBoxType, setSelectedBoxType] = useState(null);
    const [lastScanStatus, setLastScanStatus] = useState(null);
    const [showLabel, setShowLabel] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const scanRef = useRef(null);
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [isAskingAi, setIsAskingAi] = useState(false);

    const packableOrders = salesOrders.filter(o => o.status === 'picked' || o.status === 'packing');

    useEffect(() => {
        if (selectedOrder) {
            const updated = salesOrders.find(o => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
        }
    }, [salesOrders]);

    useEffect(() => {
        if (selectedOrder && selectedOrder.status !== 'packed') {
            const allVerified = selectedOrder.items.every(i => i.packed === i.picked);
            if (!allVerified) {
                setTimeout(() => scanRef.current?.focus(), 100);
            }
        }
    }, [selectedOrder]);

    const [flashStatus, setFlashStatus] = useState(null); // 'success' or 'error'

    // Reverse lookup: find SKU from barcode across entire PRODUCT_CATALOG
    const findSkuByBarcode = (barcode) => {
        for (const [sku, catalog] of Object.entries(PRODUCT_CATALOG)) {
            if (catalog.barcode === barcode) return sku;
        }
        return null;
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

    // Shipping label popup
    if (showLabel) {
        const pl = showLabel.platform || { color: '#714B67', logo: '?', name: 'Unknown' };
        return (
            <div className="max-w-lg mx-auto w-full animate-slide-up pb-20">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
                    {/* Label header */}
                    <div className="text-center py-3 font-bold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: pl.color, color: pl.textColor || '#fff' }}>
                        <Printer className="w-4 h-4" />
                        Shipping Label - {pl.name}
                    </div>

                    {/* Label content for printing */}
                    <div className="p-1 bg-white">
                        <div id="shipping-label-handheld" className="p-6 border-2 border-dashed border-slate-300 rounded-xl bg-white text-slate-900">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FROM</p>
                                    <p className="text-sm font-bold">SKINOXY (Kiss of Beauty)</p>
                                    <p className="text-xs text-slate-500">Bangkok, Thailand</p>
                                </div>
                                <PlatformBadge name={order?.courier || order?.platform} size={56} rounded="lg" />
                            </div>

                            <div className="mb-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TO</p>
                                <p className="text-base font-bold">{showLabel.order.customer}</p>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg mb-4 text-center border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">AWB / Tracking</p>
                                <p className="text-2xl font-black font-mono tracking-wider">{showLabel.awb}</p>
                                <div className="mt-2 flex justify-center">
                                    <div className="h-12 flex items-end gap-px">
                                        {showLabel.awb.split('').map((c, i) => (
                                            <div key={i} className="bg-slate-900" style={{ width: (parseInt(c) || 3) > 5 ? 3 : 2, height: 32 + (parseInt(c) || 3) * 2 }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <p className="text-[9px] text-slate-400 font-bold">ORDER</p>
                                    <p className="font-bold">{showLabel.order.ref}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <p className="text-[9px] text-slate-400 font-bold">BOX</p>
                                    <p className="font-bold">{showLabel.boxType?.name}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <p className="text-[9px] text-slate-400 font-bold">ITEMS</p>
                                    <p className="font-bold">{showLabel.order.items.reduce((s, i) => s + i.picked, 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pb-6 flex gap-3 mt-4">
                        <button 
                            onClick={handlePrintLabel} 
                            disabled={isPrinting}
                            className="flex-1 bg-[#714B67] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
                        >
                            {isPrinting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                            Print Label
                        </button>
                        <button onClick={closeLabelAndNext} className="flex-1 border-2 border-slate-200 dark:border-zinc-700 py-3.5 rounded-xl font-bold text-sm active:scale-[0.97] transition-all">
                            Next Order
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Order list view
    if (!selectedOrder) {
        return (
            <div className="max-w-lg mx-auto w-full animate-slide-up pb-20 px-4">
                {/* Odoo-style breadcrumb header */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 mb-4 shadow-sm">
                    <div className="flex items-center gap-4 mb-1">
                        <div className="w-12 h-12 rounded-xl bg-[#714B67] flex items-center justify-center text-white shadow-lg shadow-[#714B67]/20">
                            <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Pack (Handheld)</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KOB&amp;BTV-Online</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black bg-[#714B67]/10 text-[#714B67] px-3 py-1.5 rounded-lg uppercase tracking-wider">
                            <Package className="w-3.5 h-3.5" /> {packableOrders.length} Ready
                        </span>
                    </div>
                </div>

                {packableOrders.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 flex flex-col items-center bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                            <Package className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">All orders are packed!</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-50">Checking for new orders...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {packableOrders
                            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                            .map(order => {
                                const oTotal = order.items.reduce((s, i) => s + i.picked, 0);
                                const oPacked = order.items.reduce((s, i) => s + i.packed, 0);
                                const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => { setSelectedOrder(order); setLastScanStatus(null); }}
                                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-all shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-4">
                                            <PlatformBadge name={order?.courier || order?.platform} size={48} rounded="lg" />
                                            <div className="text-left">
                                                <p className="font-black text-base text-slate-800 dark:text-white leading-tight">{order.ref}</p>
                                                <p className="text-xs font-medium text-slate-500 mt-0.5">{order.customer}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{order.courier} • {oTotal} items</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xs font-black px-2 py-1 rounded-lg uppercase tracking-wider mb-2 ${order.status === 'packing' ? 'bg-amber-100 text-amber-700' : 'bg-[#714B67]/10 text-[#714B67]'}`}>
                                                {order.status === 'packing' ? 'Packing' : 'Ready'}
                                            </div>
                                            <p className="text-sm font-black tabular-nums">{oPacked}/{oTotal}</p>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                )}
            </div>
        );
    }

    const allVerified = selectedOrder.items.every(i => i.packed === i.picked);

    return (
        <div className="max-w-lg mx-auto w-full animate-slide-up pb-20 px-4">
            {/* Odoo Dark Header */}
            <div className="bg-[#714B67] rounded-2xl p-4 mb-4 shadow-lg shadow-[#714B67]/20 flex items-center justify-between text-white">
                <button onClick={() => { setSelectedOrder(null); setLastScanStatus(null); setSelectedBoxType(null); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <h2 className="font-black text-lg uppercase tracking-tight leading-none">{selectedOrder.ref}</h2>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1.5">{selectedOrder.customer}</p>
                </div>
                <button 
                    onClick={askAiBrain}
                    disabled={isAskingAi}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-90 ${isAskingAi ? 'bg-zinc-800 animate-pulse' : 'bg-amber-400 text-[#714B67] hover:bg-amber-300'}`}
                >
                    {isAskingAi ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Box className="w-5 h-5" />}
                </button>
            </div>

            {/* AI Suggestion Box */}
            {aiSuggestion && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 mb-4 shadow-sm animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-200/20 rounded-bl-full -mr-4 -mt-4" />
                    <div className="flex items-start gap-3 relative">
                        <div className="bg-amber-400 p-2 rounded-lg text-[#714B67] shrink-0">
                            <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">AI Smart Suggestion</p>
                            <p className="text-xs font-bold text-slate-700 leading-relaxed italic">"{aiSuggestion}"</p>
                        </div>
                        <button onClick={() => setAiSuggestion(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                            <CheckSquare className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Progress - Odoo Teal */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 mb-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                    <span className="text-base font-black tabular-nums" style={{ color: '#00A09D' }}>{packedItems}/{totalItems}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,160,157,0.4)]" style={{ width: `${progress}%`, backgroundColor: '#00A09D' }} />
                </div>
            </div>

            {/* Industrial Scan Area */}
            <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 mb-4 shadow-sm text-center transition-colors duration-300 ${flashStatus === 'success' ? 'animate-scan-flash' : flashStatus === 'error' ? 'animate-scan-error' : ''}`}>
                {!allVerified ? (
                    <div className="space-y-4">
                        <div className="relative group">
                            <input
                                ref={scanRef}
                                type="text"
                                autoFocus
                                value={scanInput}
                                onChange={e => setScanInput(e.target.value)}
                                onKeyDown={handleScanSubmit}
                                placeholder="SCAN SKU..."
                                className="industrial-input w-full md:text-3xl text-2xl focus:ring-0"
                            />
                            <ScanLine className="w-8 h-8 absolute right-4 top-1/2 -translate-y-1/2 text-slate-100 group-focus-within:text-[#714B67] transition-colors" />
                        </div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] animate-pulse">Waiting for scan...</p>
                    </div>
                ) : (
                    <div className="animate-fade-in py-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-[#00A09D] rounded-full text-[10px] font-black mb-4 border border-emerald-100 uppercase tracking-wider">
                            <PackageCheck className="w-3.5 h-3.5" /> All items verified
                        </div>
                        {(() => {
                            const rec = suggestBox(selectedOrder?.items || []);
                            return (
                            <>
                            <h3 className="text-sm font-black text-slate-500 mb-4 uppercase">Select Box</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {BOX_TYPES.map(box => {
                                    const isRec = box.id === rec;
                                    const spec = PACKING_SPEC[box.id];
                                    return (
                                    <button
                                        key={box.id}
                                        onClick={() => completePack(box)}
                                        className={`p-4 rounded-xl border-2 active:scale-[0.97] transition-all text-center flex flex-col items-center gap-1 shadow-sm relative ${isRec ? 'border-[#00A09D] bg-emerald-50 ring-1 ring-emerald-200' : 'border-slate-50 dark:border-zinc-800 hover:border-[#00A09D] bg-slate-50/50'}`}
                                    >
                                        {isRec && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black text-white bg-[#00A09D] px-2 py-0.5 rounded-full uppercase">Best</span>}
                                        <span className="text-2xl">{box.icon}</span>
                                        <p className="font-black text-xs uppercase tracking-tight mt-1">{box.name}</p>
                                        <p className="text-[9px] font-mono text-slate-400">{box.size}</p>
                                        {spec && (spec.bubble > 0 || spec.tape > 0) && (
                                            <p className="text-[8px] text-slate-400 mt-0.5">
                                                {spec.bubble > 0 && `B${spec.bubble}`}{spec.tape > 0 && ` T${spec.tape}`}{spec.stretch > 0 && ` S${spec.stretch}`}
                                            </p>
                                        )}
                                    </button>
                                    );
                                })}
                            </div>
                            </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Item list - Odoo Style Cards */}
            <div className="space-y-3">
                {selectedOrder.items.map((item, idx) => {
                    const done = item.packed === item.picked;
                    const catalog = PRODUCT_CATALOG[item.sku];
                    return (
                        <div key={idx} className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${done ? 'border-[#00A09D] bg-emerald-50/10 shadow-sm' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 shadow-sm'}`}>
                            <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-100 shrink-0 bg-white">
                                {catalog?.image ? (
                                    <img src={catalog.image} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-100"><Box className="w-7 h-7" /></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-black text-sm leading-tight mb-1 truncate ${done ? 'text-[#00A09D]' : 'text-slate-800 dark:text-white'}`}>{catalog?.shortName || item.name}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                        <Barcode className="w-2.5 h-2.5" /> {item.sku}
                                    </p>
                                    {done && (
                                        <span className="text-[8px] font-black text-[#00A09D] bg-emerald-50 px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                                            <CheckSquare className="w-2.5 h-2.5" /> VERIFIED
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-xl font-black tabular-nums ${done ? 'text-[#00A09D]' : 'text-slate-800 dark:text-white'}`}>
                                    {item.packed}<span className="text-slate-300 mx-0.5 text-xs">/</span><span className="text-xs text-slate-400">{item.picked}</span>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HandheldPack;
