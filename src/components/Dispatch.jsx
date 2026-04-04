import React, { useState, useMemo } from 'react';
import { Truck, Package, Eraser, PenLine, Printer, CheckCircle, ScanLine, FileText, TrendingUp, Clock, AlertTriangle, Eye, RefreshCw, MapPin, Check } from 'lucide-react';

const Dispatch = ({ readyToDispatchCouriers, dispatchCourier, setDispatchCourier, clearSignature, canvasRef, startDrawing, draw, endDrawing, signatureEmpty, handleDispatchSubmit }) => {

    const [selectedCarrierFilter, setSelectedCarrierFilter] = useState('all');

    // Derive stats from readyToDispatchCouriers
    const totalPackages = useMemo(() =>
        readyToDispatchCouriers.reduce((sum, c) => sum + c.count, 0),
        [readyToDispatchCouriers]
    );

    const carrierCount = readyToDispatchCouriers.length;

    // Carrier abbreviation helper
    const getCarrierAbbr = (name) => {
        if (!name) return '??';
        const words = name.split(/[\s-]+/);
        if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    // Carrier badge color based on index
    const getCarrierColor = (index) => {
        const colors = ['var(--odoo-purple)', 'var(--odoo-teal, #017E84)', 'var(--odoo-coral, #E46F78)', '#6366f1'];
        return colors[index % colors.length];
    };

    // Mock manifest data derived from actual couriers
    const manifestQueue = useMemo(() => {
        return readyToDispatchCouriers.map((c, i) => ({
            id: `MNF-${new Date().getFullYear()}-${(9980 + i).toString().padStart(4, '0')}`,
            carrier: c.name,
            count: c.count,
            created: new Date(Date.now() - (i * 27 * 60000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: i === 0 ? 'generated' : i === readyToDispatchCouriers.length - 1 && readyToDispatchCouriers.length > 2 ? 'error' : 'pending',
            index: i
        }));
    }, [readyToDispatchCouriers]);

    return (
        <div className="animate-slide-up pb-12 w-full">
            {/* ── Dashboard Summary Strip ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Ready for Handover */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    borderLeft: '4px solid var(--odoo-purple)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                }}>
                    <p style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                        color: 'var(--odoo-text-secondary)',
                        marginBottom: '4px',
                    }}>Ready for Handover</p>
                    <h2 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--odoo-text)', lineHeight: 1.1 }}>
                        {totalPackages.toLocaleString() || '0'}
                    </h2>
                    <p className="flex items-center gap-1 mt-2" style={{ fontSize: '12px', color: 'var(--odoo-success)', fontWeight: 500 }}>
                        <TrendingUp className="w-3.5 h-3.5" /> +12% from yesterday
                    </p>
                </div>

                {/* Carrier En-Route */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    borderLeft: '4px solid var(--odoo-teal, #017E84)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                }}>
                    <p style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                        color: 'var(--odoo-text-secondary)',
                        marginBottom: '4px',
                    }}>Carrier En-Route</p>
                    <h2 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--odoo-text)', lineHeight: 1.1 }}>
                        {String(carrierCount).padStart(2, '0')}
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                        {carrierCount > 0 ? `ETA: 14:30 (${readyToDispatchCouriers[0]?.name || 'Carrier'})` : 'No carriers scheduled'}
                    </p>
                </div>

                {/* Manifest Errors */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    borderLeft: '4px solid var(--odoo-danger)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                }}>
                    <p style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                        color: 'var(--odoo-text-secondary)',
                        marginBottom: '4px',
                    }}>Manifest Errors</p>
                    <h2 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--odoo-text)', lineHeight: 1.1 }}>
                        {String(manifestQueue.filter(m => m.status === 'error').length).padStart(2, '0')}
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--odoo-danger)', fontWeight: 500, marginTop: '8px' }}>
                        {manifestQueue.filter(m => m.status === 'error').length > 0 ? 'Requires immediate re-print' : 'All clear'}
                    </p>
                </div>

                {/* Avg. Dispatch Time */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    padding: '24px',
                    borderRadius: '12px',
                    borderLeft: '4px solid var(--odoo-text-muted)',
                    boxShadow: 'var(--odoo-shadow-sm)',
                }}>
                    <p style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                        color: 'var(--odoo-text-secondary)',
                        marginBottom: '4px',
                    }}>Avg. Dispatch Time</p>
                    <h2 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--odoo-text)', lineHeight: 1.1 }}>14m</h2>
                    <p style={{ fontSize: '12px', color: 'var(--odoo-text-muted)', marginTop: '8px' }}>
                        Optimal range ({'<'} 20m)
                    </p>
                </div>
            </div>

            {/* ── Main Content Grid ── */}
            <div className="grid grid-cols-12 gap-8">
                {/* ── Left Column: Batch Manifest + Queue ── */}
                <div className="col-span-12 lg:col-span-8 space-y-8">

                    {/* Batch Manifest Dispatch */}
                    <section style={{
                        backgroundColor: 'var(--odoo-surface)',
                        padding: '32px',
                        borderRadius: '12px',
                        boxShadow: 'var(--odoo-shadow-sm)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--odoo-text)' }}>Batch Manifest Dispatch</h3>
                                <p style={{ fontSize: '14px', color: 'var(--odoo-text-secondary)', marginTop: '2px' }}>
                                    Select carrier and generate manifests for pending shipments.
                                </p>
                            </div>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 shrink-0"
                                style={{
                                    background: 'linear-gradient(to right, var(--odoo-purple), var(--odoo-purple-dark))',
                                    color: '#fff',
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: 'var(--odoo-shadow-sm)',
                                    transition: 'var(--odoo-transition)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                <Printer className="w-4 h-4" /> Print Batch Manifests
                            </button>
                        </div>

                        {readyToDispatchCouriers.length === 0 ? (
                            <div className="text-center py-16 flex flex-col items-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                <Package className="w-12 h-12 mb-4 opacity-30" />
                                <p style={{ fontSize: '13px', fontWeight: 500 }}>No packages ready for dispatch</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-4">
                                {readyToDispatchCouriers.map((c, i) => {
                                    const isSelected = dispatchCourier === c.name;
                                    const abbr = getCarrierAbbr(c.name);
                                    return (
                                        <button
                                            key={c.name}
                                            onClick={() => setDispatchCourier(c.name)}
                                            className="flex-1 min-w-[180px] flex items-center gap-4"
                                            style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                border: isSelected ? '1px solid var(--odoo-purple)' : '1px solid var(--odoo-border-ghost)',
                                                backgroundColor: isSelected ? 'var(--odoo-surface-low)' : 'var(--odoo-surface)',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'var(--odoo-transition)',
                                            }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? 'var(--odoo-surface-low)' : 'var(--odoo-surface)'; }}
                                        >
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '8px',
                                                backgroundColor: isSelected ? 'var(--odoo-surface)' : 'var(--odoo-surface-low)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: isSelected ? 'var(--odoo-shadow-sm)' : 'none',
                                                flexShrink: 0,
                                            }}>
                                                <span style={{
                                                    fontSize: '20px',
                                                    fontWeight: 700,
                                                    color: isSelected ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)',
                                                }}>{abbr}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)' }}>{c.name}</p>
                                                <p style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>{c.count} Parcels Pending</p>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--odoo-purple)' }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Ready to Ship Queue */}
                    <section style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderRadius: '12px',
                        boxShadow: 'var(--odoo-shadow-sm)',
                        overflow: 'hidden',
                    }}>
                        <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--odoo-text)' }}>Ready to Ship Queue</h3>
                            <div className="flex gap-2 flex-wrap">
                                <span style={{
                                    padding: '4px 12px',
                                    backgroundColor: 'var(--odoo-surface-low)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    borderRadius: '9999px',
                                    color: 'var(--odoo-text-secondary)',
                                    textTransform: 'uppercase',
                                }}>Filter: All Carriers</span>
                                <span style={{
                                    padding: '4px 12px',
                                    backgroundColor: 'var(--odoo-success-light)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    borderRadius: '9999px',
                                    color: 'var(--odoo-success)',
                                    textTransform: 'uppercase',
                                }}>Auto-Sync: ON</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {manifestQueue.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                    <FileText className="w-10 h-10 mb-3 opacity-30" />
                                    <p style={{ fontSize: '13px', fontWeight: 500 }}>No manifests in queue</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                            {['Manifest ID', 'Carrier', 'Count', 'Created', 'Status', 'Action'].map((h, i) => (
                                                <th key={i} className={`px-6 py-3 ${h === 'Action' ? 'text-right' : ''}`} style={{
                                                    fontSize: '11px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em',
                                                    fontWeight: 700,
                                                    color: 'var(--odoo-text-secondary)',
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {manifestQueue.map((m) => (
                                            <tr
                                                key={m.id}
                                                style={{ borderBottom: '1px solid var(--odoo-surface-low)', transition: 'var(--odoo-transition)' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <td className="px-6 py-4" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--odoo-purple)', fontSize: '13px' }}>
                                                    {m.id}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '4px',
                                                            backgroundColor: getCarrierColor(m.index),
                                                            color: '#fff',
                                                            fontSize: '8px',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}>{getCarrierAbbr(m.carrier)}</div>
                                                        <span style={{ color: 'var(--odoo-text)', fontSize: '13px' }}>{m.carrier}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4" style={{ fontWeight: 500, color: 'var(--odoo-text)', fontSize: '13px' }}>{m.count}</td>
                                                <td className="px-6 py-4" style={{ color: 'var(--odoo-text-secondary)', fontSize: '13px' }}>{m.created}</td>
                                                <td className="px-6 py-4">
                                                    {m.status === 'generated' && (
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            backgroundColor: 'var(--odoo-success-light)',
                                                            color: 'var(--odoo-success)',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                        }}>Generated</span>
                                                    )}
                                                    {m.status === 'pending' && (
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            backgroundColor: 'var(--odoo-surface-high)',
                                                            color: 'var(--odoo-text-secondary)',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                        }}>Pending</span>
                                                    )}
                                                    {m.status === 'error' && (
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            backgroundColor: 'var(--odoo-danger-light)',
                                                            color: 'var(--odoo-danger)',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                        }}>Error</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {m.status === 'error' ? (
                                                        <button onClick={() => alert(`Re-generating manifest ${m.id}`)} className="flex items-center gap-1 ml-auto" style={{ color: 'var(--odoo-danger)', fontWeight: 700, fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            <RefreshCw className="w-3 h-3" /> Re-generate
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => alert(`Viewing items for manifest ${m.id}`)} style={{ color: 'var(--odoo-purple)', fontWeight: 700, fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            View Items
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                </div>

                {/* ── Right Column: Handover + Hub + Logs ── */}
                <div className="col-span-12 lg:col-span-4 space-y-8">

                    {/* Carrier Handover */}
                    <section style={{
                        backgroundColor: 'var(--odoo-surface)',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: 'var(--odoo-shadow-sm)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }} className="flex flex-col items-center text-center">
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--odoo-surface-low)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '16px',
                        }}>
                            <Truck className="w-9 h-9" style={{ color: 'var(--odoo-purple)' }} />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--odoo-text)', marginBottom: '4px' }}>Carrier Handover</h3>
                        <p style={{ fontSize: '14px', color: 'var(--odoo-text-secondary)', marginBottom: '24px' }}>
                            Scan driver ID or Manifest to complete handover
                        </p>

                        {/* Signature / Scan Area */}
                        <div className="w-full relative" style={{
                            backgroundColor: 'var(--odoo-surface-low)',
                            border: '2px dashed var(--odoo-border)',
                            borderRadius: '12px',
                            marginBottom: '24px',
                            overflow: 'hidden',
                        }}>
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={endDrawing}
                                onMouseOut={endDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={endDrawing}
                                className="signature-canvas w-full cursor-crosshair"
                                style={{
                                    height: '160px',
                                    display: 'block',
                                    backgroundColor: 'transparent',
                                }}
                            />
                            {signatureEmpty && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                    <ScanLine className="w-10 h-10 mb-2" style={{ color: 'var(--odoo-text-muted)', opacity: 0.3 }} />
                                    <span style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)', fontWeight: 500 }}>Waiting for Scan...</span>
                                </div>
                            )}
                        </div>

                        {/* Clear Signature (small) */}
                        {!signatureEmpty && (
                            <button
                                onClick={clearSignature}
                                className="mb-4 flex items-center gap-1.5 mx-auto"
                                style={{
                                    fontSize: '12px',
                                    color: 'var(--odoo-text-secondary)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                }}
                            >
                                <Eraser className="w-3.5 h-3.5" /> Clear Signature
                            </button>
                        )}

                        {/* Handover Complete Button */}
                        <button
                            onClick={handleDispatchSubmit}
                            disabled={!dispatchCourier || signatureEmpty}
                            className="w-full flex items-center justify-center gap-2"
                            style={{
                                padding: '12px',
                                borderRadius: '8px',
                                background: 'linear-gradient(to right, var(--odoo-purple), var(--odoo-purple-dark))',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '14px',
                                border: 'none',
                                cursor: (!dispatchCourier || signatureEmpty) ? 'not-allowed' : 'pointer',
                                opacity: (!dispatchCourier || signatureEmpty) ? 0.5 : 1,
                                boxShadow: 'var(--odoo-shadow-md)',
                                transition: 'var(--odoo-transition)',
                            }}
                            onMouseEnter={e => { if (dispatchCourier && !signatureEmpty) e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = (!dispatchCourier || signatureEmpty) ? '0.5' : '1'; }}
                        >
                            <PenLine className="w-4 h-4" /> Handover Complete
                            {dispatchCourier && (
                                <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: '4px' }}>
                                    ({readyToDispatchCouriers.find(c => c.name === dispatchCourier)?.count || 0} items)
                                </span>
                            )}
                        </button>

                        <p style={{ fontSize: '10px', color: 'var(--odoo-text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
                            Driver signature will be requested on next screen
                        </p>
                    </section>

                    {/* Local Hub Distribution */}
                    <section style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderRadius: '12px',
                        boxShadow: 'var(--odoo-shadow-sm)',
                        overflow: 'hidden',
                    }}>
                        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)' }}>Local Hub Distribution</h3>
                        </div>

                        {/* Map placeholder */}
                        <div className="relative" style={{ height: '192px', backgroundColor: 'var(--odoo-surface-high)', overflow: 'hidden' }}>
                            {/* Abstract distribution map */}
                            <div className="absolute inset-0" style={{
                                background: 'radial-gradient(ellipse at 30% 40%, var(--odoo-purple-light) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(1,126,132,0.15) 0%, transparent 50%)',
                                opacity: 0.6,
                            }} />
                            <div className="absolute inset-0 p-4 pointer-events-none">
                                {/* Hub dots */}
                                <div className="absolute" style={{ top: '25%', left: '33%', width: '12px', height: '12px', backgroundColor: 'var(--odoo-teal, #017E84)', borderRadius: '50%', boxShadow: '0 0 0 6px rgba(1,126,132,0.2)' }} />
                                <div className="absolute" style={{ bottom: '50%', right: '25%', width: '12px', height: '12px', backgroundColor: 'var(--odoo-teal, #017E84)', borderRadius: '50%', boxShadow: '0 0 0 6px rgba(1,126,132,0.2)' }} />
                                <div className="absolute" style={{ top: '50%', right: '50%', width: '12px', height: '12px', backgroundColor: 'var(--odoo-purple)', borderRadius: '50%', boxShadow: '0 0 0 6px rgba(113,75,103,0.2)' }} />
                            </div>
                            <div className="absolute bottom-2 right-2">
                                <MapPin className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)', opacity: 0.5 }} />
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            {/* Hub 1 */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>West Coast Hub</span>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                        {Math.round(totalPackages * 0.35) || 452} items
                                    </span>
                                </div>
                                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--odoo-surface-low)', borderRadius: '9999px', overflow: 'hidden' }}>
                                    <div style={{ width: '65%', height: '100%', backgroundColor: 'var(--odoo-purple)', borderRadius: '9999px', transition: 'width 0.5s ease' }} />
                                </div>
                            </div>

                            {/* Hub 2 */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span style={{ fontSize: '12px', color: 'var(--odoo-text-secondary)' }}>East Changi Node</span>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                        {Math.round(totalPackages * 0.63) || 812} items
                                    </span>
                                </div>
                                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--odoo-surface-low)', borderRadius: '9999px', overflow: 'hidden' }}>
                                    <div style={{ width: '88%', height: '100%', backgroundColor: 'var(--odoo-teal, #017E84)', borderRadius: '9999px', transition: 'width 0.5s ease' }} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Handover Logs */}
                    <section style={{
                        backgroundColor: 'var(--odoo-surface)',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: 'var(--odoo-shadow-sm)',
                        border: '1px solid var(--odoo-border-ghost)',
                    }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--odoo-text)', marginBottom: '16px' }}>Handover Logs</h3>
                        <div className="space-y-4">
                            {readyToDispatchCouriers.length > 0 ? (
                                readyToDispatchCouriers.slice(0, 3).map((c, i) => (
                                    <div key={c.name} className="flex gap-3">
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '4px',
                                            backgroundColor: 'var(--odoo-surface-low)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {i === 0 ? (
                                                <Check className="w-4 h-4" style={{ color: 'var(--odoo-success)' }} />
                                            ) : (
                                                <Truck className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                            )}
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>
                                                {getCarrierAbbr(c.name)} #{(Math.random() * 9999).toFixed(0).padStart(4, '0')} {i === 0 ? 'Handover' : 'Arriving'}
                                            </p>
                                            <p style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)' }}>
                                                {i === 0 ? `Completed by Admin ${i + 2}m ago` : `Vehicle detected at Dock ${i + 3}`}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex gap-3">
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--odoo-surface-low)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Clock className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--odoo-text)' }}>No recent activity</p>
                                        <p style={{ fontSize: '10px', color: 'var(--odoo-text-secondary)' }}>Handover logs will appear here</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Dispatch;
