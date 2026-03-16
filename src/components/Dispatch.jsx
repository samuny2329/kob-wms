import React from 'react';
import { Truck, Package, Eraser, PenLine } from 'lucide-react';

const Dispatch = ({ readyToDispatchCouriers, dispatchCourier, setDispatchCourier, clearSignature, canvasRef, startDrawing, draw, endDrawing, signatureEmpty, handleDispatchSubmit }) => {
    return (
        <div className="max-w-3xl mx-auto animate-slide-up pb-12 w-full">
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <h2 className="flex items-center gap-2" style={{ fontSize: '14px', fontWeight: 700, color: '#212529' }}>
                        <Truck className="w-5 h-5" style={{ color: '#714B67' }} /> Carrier Dispatch
                    </h2>
                    <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>Hand over scanned packages to courier drivers.</p>
                </div>
                <div className="p-6 sm:p-8">
                    {readyToDispatchCouriers.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center" style={{ color: '#adb5bd' }}>
                            <Package className="w-12 h-12 mb-4 opacity-30" />
                            <p style={{ fontSize: '13px', fontWeight: 500 }}>No packages ready for dispatch</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '10px' }}>1. Select Courier</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {readyToDispatchCouriers.map((c) => {
                                        const isSelected = dispatchCourier === c.name;
                                        return (
                                            <button key={c.name} onClick={() => setDispatchCourier(c.name)}
                                                className="flex flex-col items-center"
                                                style={{ padding: '14px 8px', border: `2px solid ${isSelected ? '#714B67' : '#dee2e6'}`, borderRadius: '4px', backgroundColor: isSelected ? '#f3edf7' : '#ffffff', cursor: 'pointer', gap: '8px', transition: 'border-color 0.15s' }}
                                                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#c9a8bc'; } }}
                                                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#dee2e6'; } }}
                                            >
                                                <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#714B67' : '#212529', width: '100%', textAlign: 'center' }}>{c.name}</span>
                                                <span className="odoo-badge" style={{ backgroundColor: isSelected ? '#e8d8e4' : '#f8f9fa', color: isSelected ? '#714B67' : '#6c757d', border: `1px solid ${isSelected ? '#c9a8bc' : '#dee2e6'}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.count} pkgs</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="flex justify-between items-end">
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', letterSpacing: '0.1em' }}>2. Driver Signature</label>
                                    <button onClick={clearSignature} className="odoo-btn odoo-btn-secondary" style={{ fontSize: '12px', padding: '3px 10px' }}>
                                        <Eraser className="w-3.5 h-3.5" /> Clear
                                    </button>
                                </div>
                                <div className="relative">
                                    <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseOut={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing}
                                        className="signature-canvas w-full h-40 cursor-crosshair"
                                        style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}
                                    />
                                    {signatureEmpty && (
                                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center" style={{ color: '#adb5bd', opacity: 0.7 }}>
                                            <PenLine className="w-8 h-8 mb-3" />
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>Driver: Sign here</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ paddingTop: '16px', borderTop: '1px solid #dee2e6' }}>
                                <button onClick={handleDispatchSubmit} disabled={!dispatchCourier || signatureEmpty}
                                    className="w-full flex items-center justify-center gap-2"
                                    style={{ padding: '12px', borderRadius: '4px', backgroundColor: '#714B67', color: '#ffffff', fontWeight: 700, fontSize: '14px', border: 'none', cursor: (!dispatchCourier || signatureEmpty) ? 'not-allowed' : 'pointer', opacity: (!dispatchCourier || signatureEmpty) ? 0.5 : 1, transition: 'background-color 0.15s' }}
                                    onMouseEnter={e => { if (dispatchCourier && !signatureEmpty) e.currentTarget.style.backgroundColor = '#5a3d52'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#714B67'; }}
                                >
                                    Confirm Dispatch <span style={{ opacity: 0.75, fontWeight: 400 }}>({readyToDispatchCouriers.find(c => c.name === dispatchCourier)?.count || 0} items)</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dispatch;
