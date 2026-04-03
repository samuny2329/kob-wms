import React, { useState } from 'react';
import { Box, ChevronLeft, ChevronRight, CheckSquare, Lock, Package, RefreshCw, Barcode, Printer, ClipboardList } from 'lucide-react';
import { BOX_TYPES, PACKING_SPEC, suggestBox } from '../constants.jsx';
import PackStation from './PackStation';

const Pack = ({
    salesOrders, selectedPackOrder, setSelectedPackOrder,
    handlePackScanSubmit, packScanInput, setPackScanInput, packInputRef,
    handleBoxSelect, isProcessingAPI,
    packAwbInput, setPackAwbInput, packAwbRef, handleAwbConfirmScan,
    printAwbLabel, stockFrozen, boxUsageLog, addToast, logActivity, user,
}) => {
    const [showBoxOverride, setShowBoxOverride] = useState(false);
    const [showStation, setShowStation] = useState(false);
    const readyOrders = salesOrders.filter(o => ['picked', 'packing', 'packed'].includes(o.status));

    if (!selectedPackOrder) {
        return (
            <div className="max-w-4xl mx-auto w-full animate-slide-up">
                {stockFrozen && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                        <span className="text-2xl">🔒</span>
                        <div>
                            <p className="text-sm font-bold text-red-800">Stock Frozen</p>
                            <p className="text-xs text-red-600">Packing is blocked during Full Count. Please wait until the count is completed.</p>
                        </div>
                    </div>
                )}
                <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        <div>
                            <h2 className="font-bold" style={{ fontSize: '14px', color: 'var(--odoo-text)' }}>Pack & Verify</h2>
                            <p style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)', marginTop: '2px' }}>Orders ready for packing validation</p>
                        </div>
                        <button onClick={() => setShowStation(true)}
                            className="odoo-btn odoo-btn-secondary text-xs flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5" /> Station
                        </button>
                    </div>
                    <div className="p-0">
                        {readyOrders.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                <Box className="w-12 h-12 mb-4 opacity-30" />
                                <p style={{ fontSize: '13px', fontWeight: 500 }}>No orders ready to pack</p>
                            </div>
                        ) : (
                            <div style={{ borderTop: 'none' }}>
                                {readyOrders
                                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                                    .map(order => {
                                        const statusStyle = order.status === 'packing'
                                            ? { backgroundColor: 'var(--odoo-warning-light)', color: 'var(--odoo-warning-dark)', border: '1px solid var(--odoo-warning)' }
                                            : order.status === 'packed'
                                            ? { backgroundColor: 'var(--odoo-info-light)', color: 'var(--odoo-info-dark)', border: '1px solid var(--odoo-info)' }
                                            : { backgroundColor: 'var(--odoo-purple-light)', color: 'var(--odoo-purple)', border: '1px solid var(--odoo-purple-border)' };
                                        const statusLabel = order.status === 'packing' ? 'Packing' : order.status === 'packed' ? 'Select Box' : 'Ready';
                                        return (
                                            <div key={order.id} onClick={() => setSelectedPackOrder(order)}
                                                className="flex items-center justify-between cursor-pointer"
                                                style={{ padding: '14px 20px', borderBottom: '1px solid var(--odoo-border-ghost)' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div style={{ backgroundColor: 'var(--odoo-purple-light)', padding: '10px', borderRadius: '4px', color: 'var(--odoo-purple)' }}>
                                                        <Box className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 style={{ fontWeight: 600, fontSize: '13px', color: 'var(--odoo-text)' }}>{order.ref}</h3>
                                                            <span className="odoo-badge" style={statusStyle}>{statusLabel}</span>
                                                        </div>
                                                        <p style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>
                                                            {order.courier} • {order.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0)} Items
                                                            {order.createdAt && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--odoo-text-muted)' }}>{new Date(order.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>}
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
                <PackStation isOpen={showStation} onClose={() => setShowStation(false)} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} user={user} />
            </div>
        );
    }

    const allPacked = selectedPackOrder.items.every(i => (i.packed || 0) >= (i.picked || i.expected || 0));
    const hasAwb = !!selectedPackOrder.awb;
    const isLocked = selectedPackOrder.status === 'locked';

    return (
        <div className="max-w-4xl mx-auto w-full animate-slide-up">
            <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Header */}
                <div className="px-5 py-3 flex justify-between items-center" style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                    {isLocked ? (
                        <div className="flex items-center gap-2" style={{ color: 'var(--odoo-danger)', fontSize: '13px', fontWeight: 700 }}>
                            <Lock className="w-4 h-4" /> LOCKED
                        </div>
                    ) : (
                        <button onClick={() => setSelectedPackOrder(null)} className="odoo-btn odoo-btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ORDER</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', padding: '2px 8px', color: 'var(--odoo-text)' }}>{selectedPackOrder.ref}</span>
                    </div>
                </div>

                {/* Stage: LOCKED */}
                {isLocked && (
                    <div className="p-16 text-center flex flex-col items-center animate-fade-in" style={{ gap: '16px' }}>
                        <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--odoo-danger-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Lock className="w-10 h-10" style={{ color: 'var(--odoo-danger)' }} />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--odoo-text)' }}>Order Locked</h2>
                        <p style={{ fontSize: '13px', color: 'var(--odoo-text-secondary)' }}>AWB confirmed — this order is locked for editing</p>
                        <div style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', padding: '16px 24px', textAlign: 'left', width: '100%', maxWidth: '320px', marginTop: '8px' }}>
                            {[['AWB', selectedPackOrder.awb, true], ['Box', selectedPackOrder.boxType || '-', false], ['Courier', selectedPackOrder.courier, false], ['Items', `${selectedPackOrder.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0)} pcs`, false]].map(([label, val, mono]) => (
                                <div key={label} className="flex justify-between" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--odoo-text-secondary)' }}>{label}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--odoo-text)', fontFamily: mono ? 'monospace' : undefined }}>{val}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setSelectedPackOrder(null)} style={{ fontSize: '13px', color: 'var(--odoo-text-secondary)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px' }}>
                            Back to list
                        </button>
                    </div>
                )}

                {/* Stage: AWB SCAN */}
                {!isLocked && hasAwb && (
                    <div className="p-8 flex flex-col items-center" style={{ gap: '20px' }}>
                        <div className="text-center">
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--odoo-text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>AWB printed — scan label to confirm</p>
                            <div style={{ backgroundColor: 'var(--odoo-surface)', border: '2px dashed var(--odoo-border-ghost)', borderRadius: '4px', padding: '20px 40px', display: 'inline-block' }}>
                                <Barcode className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--odoo-text-muted)' }} />
                                <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--odoo-text)', letterSpacing: '0.1em' }}>{selectedPackOrder.awb}</div>
                                <div style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)', marginTop: '6px' }}>{selectedPackOrder.boxType} • {selectedPackOrder.courier}</div>
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
                                style={{ width: '100%', border: '2px solid var(--odoo-border-ghost)', borderRadius: '4px', fontSize: '16px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'center', padding: '12px 16px', outline: 'none', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = 'var(--odoo-purple)'}
                                onBlur={e => e.target.style.borderColor = 'var(--odoo-border-ghost)'}
                            />
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)' }}>Scan AWB to match display → system will lock order immediately</p>
                        {printAwbLabel && (
                            <button
                                onClick={() => printAwbLabel(selectedPackOrder, selectedPackOrder.awb)}
                                className="odoo-btn odoo-btn-secondary"
                            >
                                <Printer className="w-4 h-4" /> Reprint AWB
                            </button>
                        )}
                    </div>
                )}

                {/* Stage: BOX SELECT */}
                {!isLocked && !hasAwb && allPacked && (
                    <div className="p-8">
                        {(() => {
                            const recommended = suggestBox(selectedPackOrder?.items || []);
                            const recBox = BOX_TYPES.find(b => b.id === recommended);
                            const recSpec = PACKING_SPEC[recommended];
                            const totalItems = (selectedPackOrder?.items || []).reduce((s, i) => s + (i.picked || i.qty || 1), 0);
                            const totalWeight = (selectedPackOrder?.items || []).reduce((s, i) => s + (i.weight || 0.2) * (i.picked || i.qty || 1), 0);
                            return (
                            <>
                            {isProcessingAPI ? (
                                <div className="flex flex-col items-center py-10" style={{ gap: '12px', color: 'var(--odoo-text-secondary)' }}>
                                    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--odoo-purple)' }} />
                                    <p style={{ fontSize: '13px', fontWeight: 500 }}>Generating AWB...</p>
                                </div>
                            ) : !showBoxOverride ? (
                                <div className="flex flex-col items-center">
                                    <p style={{ fontSize: '11px', color: 'var(--odoo-text-secondary)', marginBottom: '16px' }}>
                                        {totalItems} item{totalItems > 1 ? 's' : ''} / {totalWeight.toFixed(2)} kg
                                    </p>
                                    <button
                                        onClick={() => handleBoxSelect(selectedPackOrder, recommended)}
                                        style={{ padding: '28px 48px', border: '3px solid var(--odoo-purple)', borderRadius: '12px', backgroundColor: 'var(--odoo-purple-light)', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 4px 16px rgba(113,75,103,0.2)', maxWidth: '320px', width: '100%' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-purple-lighter)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(113,75,103,0.3)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-purple-light)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(113,75,103,0.2)'; }}
                                    >
                                        <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>{recBox?.icon || '📦'}</span>
                                        <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--odoo-purple)', display: 'block' }}>{recBox?.name || recommended}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)', display: 'block', marginTop: '4px' }}>{recBox?.size} / {recBox?.maxWeight} kg max</span>
                                        {recSpec && (
                                            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--odoo-purple)', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {recSpec.bubble > 0 && <span>Bubble x{recSpec.bubble}</span>}
                                                {recSpec.tape > 0 && <span>Tape x{recSpec.tape}</span>}
                                                {recSpec.stretch > 0 && <span>Stretch x{recSpec.stretch}</span>}
                                                {recSpec.fill > 0 && <span>Fill x{recSpec.fill}</span>}
                                            </div>
                                        )}
                                        <div style={{ marginTop: '16px', padding: '8px 24px', backgroundColor: 'var(--odoo-purple)', color: 'var(--odoo-surface)', borderRadius: '6px', fontSize: '13px', fontWeight: 700 }}>
                                            Confirm & Print AWB
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowBoxOverride(true)}
                                        style={{ marginTop: '16px', fontSize: '12px', color: 'var(--odoo-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Change box type
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)' }}>Select Box Type</h3>
                                        <button onClick={() => setShowBoxOverride(false)} style={{ fontSize: '12px', color: 'var(--odoo-purple)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            Back to recommended
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {BOX_TYPES.map(box => {
                                            const isRec = box.id === recommended;
                                            const spec = PACKING_SPEC[box.id];
                                            return (
                                            <button
                                                key={box.id}
                                                onClick={() => handleBoxSelect(selectedPackOrder, box.id)}
                                                className="flex flex-col items-center relative"
                                                style={{ padding: '14px 10px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s', border: isRec ? '2px solid var(--odoo-purple)' : '2px solid var(--odoo-border-ghost)', backgroundColor: isRec ? 'var(--odoo-purple-light)' : 'var(--odoo-surface)' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--odoo-purple)'; e.currentTarget.style.backgroundColor = 'var(--odoo-purple-light)'; }}
                                                onMouseLeave={e => { if (!isRec) { e.currentTarget.style.borderColor = 'var(--odoo-border-ghost)'; e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}}
                                            >
                                                {isRec && <span style={{ position: 'absolute', top: '-7px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', fontWeight: 700, color: 'var(--odoo-surface)', backgroundColor: 'var(--odoo-purple)', padding: '1px 6px', borderRadius: '4px' }}>Best</span>}
                                                <span style={{ fontSize: '24px', marginBottom: '4px' }}>{box.icon}</span>
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
                                </div>
                            )}
                            </>
                            );
                        })()}
                    </div>
                )}

                {/* Stage: ITEM SCAN */}
                {!isLocked && !hasAwb && !allPacked && (
                    <div className="p-6 sm:p-8">
                        <div className="max-w-md mx-auto mb-8">
                            <input
                                ref={packInputRef}
                                type="text"
                                autoFocus
                                value={packScanInput}
                                onChange={e => setPackScanInput(e.target.value)}
                                onKeyDown={handlePackScanSubmit}
                                placeholder="Scan SKU to verify..."
                                style={{ width: '100%', border: '2px solid var(--odoo-border-ghost)', borderRadius: '4px', fontSize: '16px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'center', padding: '12px 16px', outline: 'none', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = 'var(--odoo-purple)'}
                                onBlur={e => e.target.style.borderColor = 'var(--odoo-border-ghost)'}
                            />
                        </div>
                        <div className="mt-8 space-y-3">
                            {selectedPackOrder.items.map((item, idx) => {
                                const isComplete = (item.packed || 0) >= (item.picked || item.expected || 0);
                                return (
                                    <div key={idx} className="flex items-center justify-between"
                                        style={{ padding: '14px 16px', border: `1px solid ${isComplete ? 'var(--odoo-success-border)' : 'var(--odoo-border-ghost)'}`, borderRadius: '4px', backgroundColor: isComplete ? 'var(--odoo-success-light)' : 'var(--odoo-surface)', borderLeft: isComplete ? '3px solid var(--odoo-success)' : '1px solid var(--odoo-border-ghost)' }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: isComplete ? 'var(--odoo-success-bg)' : 'var(--odoo-surface-low)', color: isComplete ? 'var(--odoo-success)' : 'var(--odoo-text-secondary)' }}>
                                                {isComplete ? <CheckSquare className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 600, fontSize: '13px', color: isComplete ? 'var(--odoo-success-dark)' : 'var(--odoo-text)' }}>{item.name}</p>
                                                <p style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 500, color: 'var(--odoo-text-secondary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU: {item.sku}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span style={{ fontSize: '22px', fontWeight: 800, color: isComplete ? 'var(--odoo-success)' : 'var(--odoo-text)' }}>{item.packed || 0}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--odoo-text-muted)', margin: '0 4px' }}>/</span>
                                            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--odoo-text-muted)' }}>{item.picked || item.expected || 0}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            <PackStation isOpen={showStation} onClose={() => setShowStation(false)} boxUsageLog={boxUsageLog} addToast={addToast} logActivity={logActivity} user={user} />
        </div>
    );
};

export default Pack;
