import React from 'react';
import { ScanLine, Truck, CheckCircle2, XCircle, Clock } from 'lucide-react';

const Scan = ({ currentBatchId, totalScanned, totalExpected, progressPercent, inputRef, scanInput, setScanInput, handleScan, scanBinHint, lastScans, orderData }) => {
    const pending = (orderData || []).filter(i => i.scannedQty < i.expectedQty);
    const done = (orderData || []).filter(i => i.scannedQty >= i.expectedQty);

    return (
        <div className="max-w-3xl mx-auto flex flex-col items-center animate-slide-up pt-4 pb-20 w-full">
            <div className="w-full mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ fontSize: '11px', fontWeight: 700, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Batch
                    <span style={{ fontFamily: 'monospace', backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', padding: '2px 10px', color: '#212529', fontWeight: 700 }}>{currentBatchId || 'READY'}</span>
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: '11px', fontWeight: 700, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Progress
                    <span style={{ fontWeight: 800, fontSize: '15px', color: '#714B67' }}>{totalScanned}/{totalExpected}</span>
                </div>
            </div>

            <div className="w-full text-center relative overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', padding: '32px 40px' }}>
                {/* Progress bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', backgroundColor: '#e9ecef' }}>
                    <div style={{ height: '100%', backgroundColor: '#714B67', width: `${progressPercent}%`, transition: 'width 0.5s ease-out' }}></div>
                </div>

                <h2 className="flex items-center justify-center gap-2" style={{ fontSize: '11px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '24px', marginTop: '8px' }}>
                    <ScanLine className="w-4 h-4" /> Scan AWB Barcode
                </h2>

                <div className="relative max-w-lg mx-auto">
                    <input ref={inputRef} type="text" autoFocus id="main-scan-input" value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={handleScan} placeholder="SCAN..." className="industrial-input w-full" />
                </div>

                {scanBinHint && (
                    <div className="mt-8 animate-slide-up" style={{ padding: '24px 32px', borderRadius: '4px', backgroundColor: '#212529', border: '1px solid #343a40' }}>
                        <div className="flex items-center justify-center gap-2" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#adb5bd', marginBottom: '8px' }}>
                            <Truck className="w-4 h-4" /> {scanBinHint.label}
                        </div>
                        <div style={{ fontSize: '56px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>BIN {scanBinHint.bin}</div>
                    </div>
                )}
            </div>

            {/* Order status list */}
            {(orderData || []).length > 0 && (
                <div className="w-full mt-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {pending.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 px-1 mb-3" style={{ fontSize: '10px', fontWeight: 700, color: '#ffac00', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                <Clock className="w-3.5 h-3.5" /> Awaiting Scan ({pending.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {pending.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between" style={{ padding: '12px 16px', border: '1px solid #ffc107', borderLeft: '3px solid #ffac00', borderRadius: '4px', backgroundColor: '#fff8e1' }}>
                                        <div>
                                            <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: '#212529' }}>{item.barcode}</p>
                                            <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>{item.orderNumber} • {item.courier}</p>
                                        </div>
                                        <span className="odoo-badge" style={{ backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffc107' }}>Not Scanned</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {done.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 px-1 mb-3" style={{ fontSize: '10px', fontWeight: 700, color: '#28a745', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Scanned ({done.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {done.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between" style={{ padding: '12px 16px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff', opacity: 0.65 }}>
                                        <div>
                                            <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: '#6c757d', textDecoration: 'line-through' }}>{item.barcode}</p>
                                            <p style={{ fontSize: '11px', color: '#adb5bd', marginTop: '2px' }}>{item.orderNumber} • {item.courier}</p>
                                        </div>
                                        <CheckCircle2 className="w-5 h-5" style={{ color: '#28a745' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recent Scans */}
            <div className="w-full mt-6">
                <div className="px-1 mb-3" style={{ fontSize: '10px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Recent Scans</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {lastScans.length > 0 ? lastScans.map((item, i) => (
                        <div key={i} className="flex items-center justify-between"
                            style={{ padding: '12px 16px', border: '1px solid #dee2e6', borderLeft: `3px solid ${item.status === 'OK' ? '#28a745' : '#dc3545'}`, borderRadius: '4px', backgroundColor: '#ffffff' }}
                        >
                            <div className="flex items-center gap-3">
                                <div style={{ color: item.status === 'OK' ? '#28a745' : '#dc3545' }}>
                                    {item.status === 'OK' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                </div>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#212529' }}>{item.barcode}</span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6c757d', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', padding: '2px 8px' }}>{item.time}</span>
                        </div>
                    )) : (
                        <div className="text-center py-12" style={{ fontSize: '13px', fontWeight: 500, color: '#adb5bd', border: '2px dashed #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff' }}>
                            Waiting for scan...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Scan;
