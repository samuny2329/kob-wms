import React from 'react';
import { Box, ChevronLeft, ChevronRight, CheckSquare, Lock, Package, RefreshCw, Barcode, Printer } from 'lucide-react';
import { BOX_TYPES } from '../constants.jsx';

const Pack = ({
    salesOrders, selectedPackOrder, setSelectedPackOrder,
    handlePackScanSubmit, packScanInput, setPackScanInput, packInputRef,
    handleBoxSelect, isProcessingAPI,
    packAwbInput, setPackAwbInput, packAwbRef, handleAwbConfirmScan,
    printAwbLabel,
}) => {
    const readyOrders = salesOrders.filter(o => ['picked', 'packing', 'packed'].includes(o.status));

    if (!selectedPackOrder) {
        return (
            <div className="max-w-4xl mx-auto w-full animate-slide-up">
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                        <div>
                            <h2 className="font-bold" style={{ fontSize: '14px', color: '#212529' }}>Pack & Verify</h2>
                            <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>Orders ready for packing validation</p>
                        </div>
                    </div>
                    <div className="p-0">
                        {readyOrders.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center" style={{ color: '#adb5bd' }}>
                                <Box className="w-12 h-12 mb-4 opacity-30" />
                                <p style={{ fontSize: '13px', fontWeight: 500 }}>No orders ready to pack</p>
                            </div>
                        ) : (
                            <div style={{ borderTop: 'none' }}>
                                {readyOrders
                                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                                    .map(order => {
                                        const statusStyle = order.status === 'packing'
                                            ? { backgroundColor: '#fff8e1', color: '#856404', border: '1px solid #ffc107' }
                                            : order.status === 'packed'
                                            ? { backgroundColor: '#e8f4fd', color: '#0c5460', border: '1px solid #17a2b8' }
                                            : { backgroundColor: '#f3edf7', color: '#714B67', border: '1px solid #c9a8bc' };
                                        const statusLabel = order.status === 'packing' ? 'Packing' : order.status === 'packed' ? 'Select Box' : 'Ready';
                                        return (
                                            <div key={order.id} onClick={() => setSelectedPackOrder(order)}
                                                className="flex items-center justify-between cursor-pointer"
                                                style={{ padding: '14px 20px', borderBottom: '1px solid #dee2e6' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div style={{ backgroundColor: '#f3edf7', padding: '10px', borderRadius: '4px', color: '#714B67' }}>
                                                        <Box className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 style={{ fontWeight: 600, fontSize: '13px', color: '#212529' }}>{order.ref}</h3>
                                                            <span className="odoo-badge" style={statusStyle}>{statusLabel}</span>
                                                        </div>
                                                        <p style={{ fontSize: '12px', color: '#6c757d' }}>
                                                            {order.courier} • {order.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0)} Items
                                                            {order.createdAt && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#adb5bd' }}>{new Date(order.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4" style={{ color: '#adb5bd' }} />
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const allPacked = selectedPackOrder.items.every(i => (i.packed || 0) >= (i.picked || i.expected || 0));
    const hasAwb = !!selectedPackOrder.awb;
    const isLocked = selectedPackOrder.status === 'locked';

    return (
        <div className="max-w-4xl mx-auto w-full animate-slide-up">
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Header */}
                <div className="px-5 py-3 flex justify-between items-center" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                    {isLocked ? (
                        <div className="flex items-center gap-2" style={{ color: '#dc3545', fontSize: '13px', fontWeight: 700 }}>
                            <Lock className="w-4 h-4" /> LOCKED
                        </div>
                    ) : (
                        <button onClick={() => setSelectedPackOrder(null)} className="odoo-btn odoo-btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ORDER</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', padding: '2px 8px', color: '#212529' }}>{selectedPackOrder.ref}</span>
                    </div>
                </div>

                {/* Stage: LOCKED */}
                {isLocked && (
                    <div className="p-16 text-center flex flex-col items-center animate-fade-in" style={{ gap: '16px' }}>
                        <div style={{ width: '80px', height: '80px', backgroundColor: '#fff5f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Lock className="w-10 h-10" style={{ color: '#dc3545' }} />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#212529' }}>Order Locked</h2>
                        <p style={{ fontSize: '13px', color: '#6c757d' }}>AWB confirmed — this order is locked for editing</p>
                        <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', padding: '16px 24px', textAlign: 'left', width: '100%', maxWidth: '320px', marginTop: '8px' }}>
                            {[['AWB', selectedPackOrder.awb, true], ['Box', selectedPackOrder.boxType || '-', false], ['Courier', selectedPackOrder.courier, false], ['Items', `${selectedPackOrder.items.reduce((s, i) => s + (i.picked || i.expected || 0), 0)} pcs`, false]].map(([label, val, mono]) => (
                                <div key={label} className="flex justify-between" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                    <span style={{ color: '#6c757d' }}>{label}</span>
                                    <span style={{ fontWeight: 600, color: '#212529', fontFamily: mono ? 'monospace' : undefined }}>{val}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setSelectedPackOrder(null)} style={{ fontSize: '13px', color: '#6c757d', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px' }}>
                            Back to list
                        </button>
                    </div>
                )}

                {/* Stage: AWB SCAN */}
                {!isLocked && hasAwb && (
                    <div className="p-8 flex flex-col items-center" style={{ gap: '20px' }}>
                        <div className="text-center">
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>AWB printed — scan label to confirm</p>
                            <div style={{ backgroundColor: '#ffffff', border: '2px dashed #dee2e6', borderRadius: '4px', padding: '20px 40px', display: 'inline-block' }}>
                                <Barcode className="w-8 h-8 mx-auto mb-2" style={{ color: '#adb5bd' }} />
                                <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace', color: '#212529', letterSpacing: '0.1em' }}>{selectedPackOrder.awb}</div>
                                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '6px' }}>{selectedPackOrder.boxType} • {selectedPackOrder.courier}</div>
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
                                style={{ width: '100%', border: '2px solid #dee2e6', borderRadius: '4px', fontSize: '16px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'center', padding: '12px 16px', outline: 'none', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = '#714B67'}
                                onBlur={e => e.target.style.borderColor = '#dee2e6'}
                            />
                        </div>
                        <p style={{ fontSize: '12px', color: '#adb5bd' }}>Scan AWB to match display → system will lock order immediately</p>
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
                        <div className="text-center mb-6">
                            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#212529' }}>Select box type</h3>
                            <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>System will generate AWB automatically after selecting box</p>
                        </div>
                        {isProcessingAPI ? (
                            <div className="flex flex-col items-center py-10" style={{ gap: '12px', color: '#6c757d' }}>
                                <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#714B67' }} />
                                <p style={{ fontSize: '13px', fontWeight: 500 }}>Generating AWB...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {BOX_TYPES.map(box => (
                                    <button
                                        key={box.id}
                                        onClick={() => handleBoxSelect(selectedPackOrder, box.id)}
                                        className="flex flex-col items-center"
                                        style={{ padding: '16px', border: '2px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff', cursor: 'pointer', transition: 'border-color 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#714B67'; e.currentTarget.style.backgroundColor = '#f3edf7'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                    >
                                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>{box.icon}</span>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#212529' }}>{box.name}</span>
                                        <span style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>{box.size}</span>
                                        <span style={{ fontSize: '11px', color: '#6c757d' }}>≤ {box.maxWeight} kg</span>
                                    </button>
                                ))}
                            </div>
                        )}
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
                                style={{ width: '100%', border: '2px solid #dee2e6', borderRadius: '4px', fontSize: '16px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'center', padding: '12px 16px', outline: 'none', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = '#714B67'}
                                onBlur={e => e.target.style.borderColor = '#dee2e6'}
                            />
                        </div>
                        <div className="mt-8 space-y-3">
                            {selectedPackOrder.items.map((item, idx) => {
                                const isComplete = (item.packed || 0) >= (item.picked || item.expected || 0);
                                return (
                                    <div key={idx} className="flex items-center justify-between"
                                        style={{ padding: '14px 16px', border: `1px solid ${isComplete ? '#b8e0c4' : '#dee2e6'}`, borderRadius: '4px', backgroundColor: isComplete ? '#f0faf4' : '#ffffff', borderLeft: isComplete ? '3px solid #28a745' : '1px solid #dee2e6' }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: isComplete ? '#d4edda' : '#f8f9fa', color: isComplete ? '#28a745' : '#6c757d' }}>
                                                {isComplete ? <CheckSquare className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 600, fontSize: '13px', color: isComplete ? '#155724' : '#212529' }}>{item.name}</p>
                                                <p style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 500, color: '#6c757d', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU: {item.sku}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span style={{ fontSize: '22px', fontWeight: 800, color: isComplete ? '#28a745' : '#212529' }}>{item.packed || 0}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#adb5bd', margin: '0 4px' }}>/</span>
                                            <span style={{ fontSize: '16px', fontWeight: 700, color: '#adb5bd' }}>{item.picked || item.expected || 0}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Pack;
