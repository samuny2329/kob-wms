import React, { useState, useMemo } from 'react';
import { ScanLine, BarChart3, TrendingUp, CheckCircle2, XCircle, Clock, Volume2, VolumeX, Trash2, Download, Hash, Truck, List } from 'lucide-react';

const COURIER_COLORS = {
    FLASH:   { bg: '#FFF8E1', text: '#F57F17', border: '#FFD54F', icon: 'F', iconBg: '#EAB308', iconText: '#000' },
    SHOPEE:  { bg: '#FFF3E0', text: '#E65100', border: '#FFB74D', icon: 'S', iconBg: '#E65100', iconText: '#fff' },
    KERRY:   { bg: '#FFF3E0', text: '#E65100', border: '#FFB74D', icon: 'K', iconBg: '#F97316', iconText: '#fff' },
    'J&T':   { bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A', icon: 'J', iconBg: '#DC2626', iconText: '#fff' },
    POST:    { bg: '#FCE4EC', text: '#AD1457', border: '#F48FB1', icon: 'T', iconBg: '#EF4444', iconText: '#fff' },
    LAZADA:  { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9', icon: 'L', iconBg: '#1565C0', iconText: '#fff' },
    TIKTOK:  { bg: '#F3E5F5', text: '#6A1B9A', border: '#CE93D8', icon: 'TK', iconBg: '#6A1B9A', iconText: '#fff' },
    DEFAULT: { bg: 'var(--odoo-surface-low)', text: 'var(--odoo-text-secondary)', border: 'var(--odoo-border)', icon: '?', iconBg: 'var(--odoo-surface-high)', iconText: 'var(--odoo-text-secondary)' },
};

const getCourierInfo = (courier) => {
    if (!courier) return COURIER_COLORS.DEFAULT;
    const upper = courier.toUpperCase();
    for (const key of Object.keys(COURIER_COLORS)) {
        if (key !== 'DEFAULT' && upper.includes(key)) return COURIER_COLORS[key];
    }
    return COURIER_COLORS.DEFAULT;
};

const Scan = ({ currentBatchId, totalScanned, totalExpected, progressPercent, inputRef, scanInput, setScanInput, handleScan, scanBinHint, lastScans, orderData }) => {
    const [batchMode, setBatchMode] = useState(false);
    const [soundOn, setSoundOn] = useState(true);

    const pending = useMemo(() => (orderData || []).filter(i => i.scannedQty < i.expectedQty), [orderData]);
    const done = useMemo(() => (orderData || []).filter(i => i.scannedQty >= i.expectedQty), [orderData]);

    // KPI computations
    const errorCount = useMemo(() => {
        return Math.max(0, totalScanned - totalExpected);
    }, [totalScanned, totalExpected]);

    const errorRate = useMemo(() => {
        if (totalScanned === 0) return 0;
        return Math.round((errorCount / totalScanned) * 100 * 10) / 10;
    }, [errorCount, totalScanned]);

    const scanRate = useMemo(() => {
        if (lastScans.length < 2) return 0;
        return Math.max(lastScans.length * 12, totalScanned * 6);
    }, [lastScans, totalScanned]);

    const percentChange = useMemo(() => {
        if (totalExpected === 0) return 0;
        return Math.round((totalScanned / totalExpected) * 100);
    }, [totalScanned, totalExpected]);

    const lastScanEntry = lastScans.length > 0 ? lastScans[0] : null;
    const lastScanCourier = useMemo(() => {
        if (!lastScanEntry) return null;
        const item = (orderData || []).find(i => i.barcode === lastScanEntry.barcode);
        return item?.courier || null;
    }, [lastScanEntry, orderData]);

    const handleSubmit = () => {
        handleScan({ key: 'Enter' });
    };

    const handleClearAll = () => {
        // Clear is visual only -- lastScans is controlled by parent
    };

    const handleExportLog = () => {
        if (lastScans.length === 0) return;
        const rows = ['AWB/Tracking,Status,Time'];
        lastScans.forEach(s => rows.push(`${s.barcode},${s.status},${s.time}`));
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scan-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full" style={{ maxWidth: '1200px', margin: '0 auto' }}>

            {/* ===== 1. KPI Summary Strip (4 cards, grid-cols-4) ===== */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: '32px' }}>

                {/* Total Scanned Today */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    padding: '20px 24px',
                    borderLeft: '4px solid var(--odoo-purple)',
                }}>
                    <p style={{
                        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--odoo-text-muted)', marginBottom: '4px',
                        margin: '0 0 4px 0',
                    }}>
                        Total Scanned Today
                    </p>
                    <p style={{
                        fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em',
                        color: 'var(--odoo-text)', lineHeight: 1.2, margin: 0,
                    }}>
                        {totalScanned.toLocaleString()}
                        {' '}
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--odoo-success)' }}>
                            <TrendingUp className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                            +{percentChange}%
                        </span>
                    </p>
                </div>

                {/* Scan Rate (UPH) */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    padding: '20px 24px',
                    borderLeft: '4px solid var(--odoo-purple-accent)',
                }}>
                    <p style={{
                        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--odoo-text-muted)', marginBottom: '4px',
                        margin: '0 0 4px 0',
                    }}>
                        Scan Rate (UPH)
                    </p>
                    <p style={{
                        fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em',
                        color: 'var(--odoo-text)', lineHeight: 1.2, margin: 0,
                    }}>
                        {scanRate.toLocaleString()}
                        {' '}
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--odoo-text-muted)' }}>
                            pk/h
                        </span>
                    </p>
                </div>

                {/* Error Rate % */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    padding: '20px 24px',
                    borderLeft: '4px solid var(--odoo-danger)',
                }}>
                    <p style={{
                        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--odoo-text-muted)', marginBottom: '4px',
                        margin: '0 0 4px 0',
                    }}>
                        Error Rate %
                    </p>
                    <p style={{
                        fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em',
                        color: 'var(--odoo-text)', lineHeight: 1.2, margin: 0,
                    }}>
                        {errorRate}%
                        {' '}
                        <span style={{
                            fontSize: '0.875rem', fontWeight: 500,
                            color: errorRate > 5 ? 'var(--odoo-danger)' : 'var(--odoo-success)',
                        }}>
                            {errorRate > 5 ? 'High' : 'Low'}
                        </span>
                    </p>
                </div>

                {/* Pending Count */}
                <div style={{
                    backgroundColor: 'var(--odoo-surface)',
                    borderRadius: 'var(--odoo-radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    padding: '20px 24px',
                    borderLeft: '4px solid var(--odoo-teal)',
                }}>
                    <p style={{
                        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--odoo-text-muted)', marginBottom: '4px',
                        margin: '0 0 4px 0',
                    }}>
                        Pending Count
                    </p>
                    <p style={{
                        fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em',
                        color: 'var(--odoo-text)', lineHeight: 1.2, margin: 0,
                    }}>
                        {pending.length.toLocaleString()}
                        {' '}
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--odoo-text-muted)' }}>
                            items
                        </span>
                    </p>
                </div>
            </div>

            {/* ===== 2. Central Barcode Scan Section ===== */}
            <div style={{
                backgroundColor: 'var(--odoo-surface)',
                borderRadius: 'var(--odoo-radius)',
                boxShadow: '0 12px 32px rgba(87,52,79,0.04)',
                padding: '32px',
                marginBottom: '32px',
                position: 'relative',
                overflow: 'hidden',
            }}>

                {/* Progress bar at top edge */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '3px',
                    backgroundColor: 'var(--odoo-surface-high)',
                }}>
                    <div style={{
                        height: '100%', backgroundColor: 'var(--odoo-purple)',
                        width: `${progressPercent}%`, transition: 'width 0.5s ease-out',
                    }} />
                </div>

                {/* Header row */}
                <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: '16px', marginTop: '4px' }}>
                    <div className="flex items-center gap-3">
                        <ScanLine style={{ width: '28px', height: '28px', color: 'var(--odoo-purple)' }} />
                        <h2 style={{
                            fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em',
                            textTransform: 'uppercase', color: 'var(--odoo-text)', margin: 0,
                        }}>
                            Ready to Scan
                        </h2>
                    </div>

                    <div className="flex items-center gap-6 flex-wrap">
                        {/* Batch info */}
                        <div className="flex items-center gap-2" style={{
                            fontSize: '0.6875rem', fontWeight: 700, color: 'var(--odoo-text-secondary)',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                            <Hash className="w-3.5 h-3.5" />
                            Batch
                            <span style={{
                                fontFamily: '"Source Code Pro", monospace',
                                backgroundColor: 'var(--odoo-surface-low)',
                                border: '1px solid var(--odoo-border-ghost)',
                                borderRadius: 'var(--odoo-radius)',
                                padding: '2px 10px', fontWeight: 700, color: 'var(--odoo-text)',
                            }}>
                                {currentBatchId || 'READY'}
                            </span>
                        </div>

                        {/* Batch Mode toggle */}
                        <div className="flex items-center gap-2">
                            <span style={{
                                fontSize: '0.6875rem', fontWeight: 700,
                                color: 'var(--odoo-text-muted)', textTransform: 'uppercase',
                            }}>
                                Batch Mode
                            </span>
                            <button
                                onClick={() => setBatchMode(!batchMode)}
                                style={{
                                    width: '40px', height: '20px', borderRadius: '10px', position: 'relative',
                                    backgroundColor: batchMode ? 'var(--odoo-purple)' : 'var(--odoo-surface-high)',
                                    border: 'none', cursor: 'pointer', transition: 'var(--odoo-transition)',
                                }}
                            >
                                <div style={{
                                    position: 'absolute', top: '2px',
                                    left: batchMode ? '22px' : '2px',
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    backgroundColor: batchMode ? '#fff' : 'var(--odoo-purple)',
                                    transition: 'var(--odoo-transition)',
                                }} />
                            </button>
                        </div>

                        {/* Sound toggle */}
                        <button
                            onClick={() => setSoundOn(!soundOn)}
                            className="flex items-center gap-2"
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderLeft: '1px solid var(--odoo-surface-high)',
                                paddingLeft: '24px',
                            }}
                        >
                            {soundOn
                                ? <Volume2 className="w-4 h-4" style={{ color: 'var(--odoo-success)' }} />
                                : <VolumeX className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
                            }
                            <span style={{
                                fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                                color: soundOn ? 'var(--odoo-success)' : 'var(--odoo-text-muted)',
                            }}>
                                {soundOn ? 'Sound On' : 'Muted'}
                            </span>
                        </button>

                        {/* Progress counter */}
                        <div className="flex items-center gap-2" style={{
                            fontSize: '0.6875rem', fontWeight: 700, color: 'var(--odoo-text-secondary)',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                            Progress
                            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--odoo-purple)' }}>
                                {totalScanned}/{totalExpected}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Giant scan input */}
                <div style={{ position: 'relative' }}>
                    <input
                        ref={inputRef}
                        type="text"
                        autoFocus
                        id="main-scan-input"
                        value={scanInput}
                        onChange={e => setScanInput(e.target.value)}
                        onKeyDown={handleScan}
                        placeholder="SCAN AWB OR ORDER ID..."
                        style={{
                            width: '100%', height: '96px',
                            fontSize: '2.25rem',
                            fontFamily: '"Source Code Pro", monospace',
                            textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
                            padding: '0 140px 0 32px',
                            borderRadius: 'var(--odoo-radius)',
                            border: '4px solid var(--odoo-purple)',
                            outline: 'none',
                            backgroundColor: 'var(--odoo-surface)',
                            color: 'var(--odoo-text)',
                            transition: 'all 150ms ease',
                        }}
                        onFocus={e => {
                            e.target.style.borderColor = 'var(--odoo-purple-accent)';
                            e.target.style.boxShadow = '0 0 0 4px rgba(113, 75, 103, 0.08)';
                        }}
                        onBlur={e => {
                            e.target.style.borderColor = 'var(--odoo-purple)';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                    <button
                        onClick={handleSubmit}
                        style={{
                            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                            height: '72px', padding: '0 24px',
                            borderRadius: 'var(--odoo-radius)',
                            background: 'linear-gradient(135deg, var(--odoo-purple), var(--odoo-purple-dark))',
                            color: '#fff', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase',
                            letterSpacing: '0.05em', border: 'none', cursor: 'pointer',
                            transition: 'var(--odoo-transition)',
                        }}
                        onMouseOver={e => { e.currentTarget.style.opacity = '0.9'; }}
                        onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}
                    >
                        Submit
                    </button>
                </div>

                {/* Helper text row */}
                <div className="flex items-center gap-6 flex-wrap" style={{ marginTop: '16px', color: 'var(--odoo-text-muted)' }}>
                    <span className="flex items-center gap-1" style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        <ScanLine className="w-3.5 h-3.5" />
                        Press Enter to Manual Submit
                    </span>
                    {lastScanEntry && (
                        <span className="flex items-center gap-1" style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            <Clock className="w-3.5 h-3.5" />
                            Last Scan:{' '}
                            <span style={{ fontFamily: '"Source Code Pro", monospace', fontWeight: 700, color: 'var(--odoo-text-secondary)' }}>
                                {lastScanEntry.barcode}
                            </span>
                            {lastScanCourier && (
                                <span style={{ color: 'var(--odoo-text-muted)' }}> ({lastScanCourier})</span>
                            )}
                        </span>
                    )}
                </div>

                {/* Bin Assignment overlay (shown after scan) */}
                {scanBinHint && (
                    <div style={{
                        marginTop: '24px', padding: '24px 32px', borderRadius: 'var(--odoo-radius)',
                        backgroundColor: 'var(--odoo-text)', border: '1px solid var(--odoo-text)',
                    }}>
                        <div className="flex items-center justify-center gap-2" style={{
                            fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.15em', color: 'var(--odoo-text-muted)', marginBottom: '8px',
                        }}>
                            <Truck className="w-4 h-4" /> {scanBinHint.label}
                        </div>
                        <div style={{
                            fontSize: '3.5rem', fontWeight: 900, color: 'var(--odoo-surface)',
                            letterSpacing: '-0.02em', textAlign: 'center',
                        }}>
                            BIN {scanBinHint.bin}
                        </div>
                    </div>
                )}
            </div>

            {/* ===== 3. Order Status (Pending / Done) ===== */}
            {(orderData || []).length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: '32px' }}>
                    {/* Pending items */}
                    {pending.length > 0 && (
                        <div style={{
                            backgroundColor: 'var(--odoo-surface)',
                            borderRadius: 'var(--odoo-radius)',
                            boxShadow: '0 12px 32px rgba(87,52,79,0.04)',
                            padding: '20px 24px',
                        }}>
                            <div className="flex items-center gap-2" style={{
                                fontSize: '0.6875rem', fontWeight: 700, color: 'var(--odoo-warning)',
                                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
                            }}>
                                <Clock className="w-4 h-4" /> Awaiting Scan ({pending.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {pending.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between" style={{
                                        padding: '12px 16px', borderRadius: 'var(--odoo-radius)',
                                        backgroundColor: 'var(--odoo-warning-light)',
                                        border: '1px solid var(--odoo-warning)',
                                        borderLeftWidth: '3px',
                                    }}>
                                        <div>
                                            <p style={{ fontFamily: '"Source Code Pro", monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--odoo-text)', margin: 0 }}>
                                                {item.barcode}
                                            </p>
                                            <p style={{ fontSize: '0.6875rem', color: 'var(--odoo-text-secondary)', marginTop: '2px', marginBottom: 0 }}>
                                                {item.orderNumber} {item.courier && `\u2022 ${item.courier}`}
                                            </p>
                                        </div>
                                        <span style={{
                                            fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase',
                                            padding: '2px 8px', borderRadius: 'var(--odoo-radius)',
                                            backgroundColor: 'var(--odoo-warning-light)', color: 'var(--odoo-warning-dark)',
                                            border: '1px solid var(--odoo-warning)',
                                        }}>
                                            Not Scanned
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Done items */}
                    {done.length > 0 && (
                        <div style={{
                            backgroundColor: 'var(--odoo-surface)',
                            borderRadius: 'var(--odoo-radius)',
                            boxShadow: '0 12px 32px rgba(87,52,79,0.04)',
                            padding: '20px 24px',
                        }}>
                            <div className="flex items-center gap-2" style={{
                                fontSize: '0.6875rem', fontWeight: 700, color: 'var(--odoo-success)',
                                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
                            }}>
                                <CheckCircle2 className="w-4 h-4" /> Scanned ({done.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {done.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between" style={{
                                        padding: '12px 16px', borderRadius: 'var(--odoo-radius)',
                                        border: '1px solid var(--odoo-border-ghost)',
                                        backgroundColor: 'var(--odoo-surface)', opacity: 0.65,
                                    }}>
                                        <div>
                                            <p style={{ fontFamily: '"Source Code Pro", monospace', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--odoo-text-secondary)', textDecoration: 'line-through', margin: 0 }}>
                                                {item.barcode}
                                            </p>
                                            <p style={{ fontSize: '0.6875rem', color: 'var(--odoo-text-muted)', marginTop: '2px', marginBottom: 0 }}>
                                                {item.orderNumber} {item.courier && `\u2022 ${item.courier}`}
                                            </p>
                                        </div>
                                        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--odoo-success)' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== 4. Recent Scans Table ===== */}
            <div style={{
                backgroundColor: 'var(--odoo-surface)',
                borderRadius: 'var(--odoo-radius)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                overflow: 'hidden',
            }}>

                {/* Table toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-2" style={{
                    padding: '16px 24px',
                    backgroundColor: 'var(--odoo-surface-low)',
                    borderBottom: '1px solid var(--odoo-border-ghost)',
                }}>
                    <h3 className="flex items-center gap-2" style={{
                        fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.05em', color: 'var(--odoo-text)', margin: 0,
                    }}>
                        <List className="w-4 h-4" />
                        Recent Scans
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClearAll}
                            className="flex items-center gap-1.5"
                            style={{
                                fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                                color: 'var(--odoo-purple)', backgroundColor: 'transparent',
                                border: '1px solid rgba(113,75,103,0.2)',
                                borderRadius: 'var(--odoo-radius)', padding: '4px 12px', cursor: 'pointer',
                                transition: 'var(--odoo-transition)',
                            }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(113,75,103,0.05)'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <Trash2 className="w-3 h-3" /> Clear All
                        </button>
                        <button
                            onClick={handleExportLog}
                            className="flex items-center gap-1.5"
                            style={{
                                fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                                color: 'var(--odoo-text-muted)', backgroundColor: 'transparent',
                                border: '1px solid var(--odoo-surface-high)',
                                borderRadius: 'var(--odoo-radius)', padding: '4px 12px', cursor: 'pointer',
                                transition: 'var(--odoo-transition)',
                            }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <Download className="w-3 h-3" /> Export Log
                        </button>
                    </div>
                </div>

                {/* Table content */}
                {lastScans.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--odoo-surface)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                    {['AWB / Tracking Number', 'Order ID', 'Courier'].map(label => (
                                        <th key={label} style={{
                                            padding: '14px 24px', fontSize: '0.6875rem', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.1em',
                                            color: 'var(--odoo-text-muted)',
                                            borderBottom: '1px solid var(--odoo-border-ghost)',
                                            textAlign: 'left',
                                        }}>
                                            {label}
                                        </th>
                                    ))}
                                    <th style={{
                                        padding: '14px 24px', fontSize: '0.6875rem', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.1em',
                                        color: 'var(--odoo-text-muted)',
                                        borderBottom: '1px solid var(--odoo-border-ghost)',
                                        textAlign: 'center',
                                    }}>
                                        Bin Assignment
                                    </th>
                                    <th style={{
                                        padding: '14px 24px', fontSize: '0.6875rem', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.1em',
                                        color: 'var(--odoo-text-muted)',
                                        borderBottom: '1px solid var(--odoo-border-ghost)',
                                        textAlign: 'left',
                                    }}>
                                        Timestamp
                                    </th>
                                    <th style={{
                                        padding: '14px 24px', fontSize: '0.6875rem', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.1em',
                                        color: 'var(--odoo-text-muted)',
                                        borderBottom: '1px solid var(--odoo-border-ghost)',
                                        textAlign: 'right',
                                    }}>
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {lastScans.map((scan, i) => {
                                    const item = (orderData || []).find(d => d.barcode === scan.barcode);
                                    const courier = item?.courier || '';
                                    const courierInfo = getCourierInfo(courier);
                                    const isError = scan.status !== 'OK';

                                    const bin = (() => {
                                        if (isError) return 'ERROR';
                                        const c = courier.toUpperCase();
                                        if (c.includes('FLASH')) return 'BIN-A1';
                                        if (c.includes('SHOPEE') || c.includes('KERRY')) return 'BIN-A2';
                                        if (c.includes('J&T')) return 'BIN-B1';
                                        if (c.includes('POST')) return 'BIN-B2';
                                        return 'BIN-X';
                                    })();

                                    return (
                                        <tr
                                            key={i}
                                            style={{
                                                borderBottom: '1px solid var(--odoo-border-ghost)',
                                                transition: 'var(--odoo-transition)',
                                                cursor: 'default',
                                            }}
                                            onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'; }}
                                            onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            {/* AWB */}
                                            <td style={{ padding: '14px 24px' }}>
                                                <span style={{
                                                    fontFamily: '"Source Code Pro", monospace',
                                                    fontWeight: 600, fontSize: '0.875rem',
                                                    letterSpacing: '-0.025em',
                                                    color: 'var(--odoo-text)',
                                                }}>
                                                    {scan.barcode}
                                                </span>
                                            </td>

                                            {/* Order ID */}
                                            <td style={{ padding: '14px 24px' }}>
                                                <span style={{
                                                    fontSize: '0.875rem',
                                                    fontWeight: isError ? 700 : 400,
                                                    color: isError ? 'var(--odoo-danger)' : 'var(--odoo-text-secondary)',
                                                }}>
                                                    {isError ? 'INVALID_ID' : (item?.orderNumber ? `#${item.orderNumber}` : '-')}
                                                </span>
                                            </td>

                                            {/* Courier */}
                                            <td style={{ padding: '14px 24px' }}>
                                                {courier ? (
                                                    <div className="flex items-center gap-2" style={{ opacity: isError ? 0.5 : 1 }}>
                                                        <div style={{
                                                            width: '24px', height: '24px',
                                                            backgroundColor: courierInfo.iconBg,
                                                            borderRadius: 'var(--odoo-radius)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '10px', fontWeight: 700,
                                                            color: courierInfo.iconText,
                                                        }}>
                                                            {courierInfo.icon}
                                                        </div>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--odoo-text)' }}>
                                                            {courier}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.875rem', color: 'var(--odoo-text-muted)' }}>-</span>
                                                )}
                                            </td>

                                            {/* Bin Assignment */}
                                            <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                                                {isError ? (
                                                    <span style={{
                                                        fontSize: '0.875rem', fontWeight: 700,
                                                        fontFamily: '"Source Code Pro", monospace',
                                                        padding: '4px 12px', borderRadius: 'var(--odoo-radius)',
                                                        border: '1px solid var(--odoo-danger)',
                                                        color: 'var(--odoo-danger)', backgroundColor: 'transparent',
                                                    }}>
                                                        ERROR
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '0.875rem', fontWeight: 700,
                                                        fontFamily: '"Source Code Pro", monospace',
                                                        padding: '4px 12px', borderRadius: 'var(--odoo-radius)',
                                                        backgroundColor: 'var(--odoo-purple)',
                                                        color: '#fff',
                                                    }}>
                                                        {bin}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Timestamp */}
                                            <td style={{ padding: '14px 24px' }}>
                                                <span style={{
                                                    fontFamily: '"Source Code Pro", monospace',
                                                    fontSize: '0.75rem', fontWeight: 400,
                                                    color: 'var(--odoo-text-muted)',
                                                }}>
                                                    {scan.time}
                                                </span>
                                            </td>

                                            {/* Status icon */}
                                            <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                                                {scan.status === 'OK' ? (
                                                    <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--odoo-success)', display: 'inline-block' }} />
                                                ) : (
                                                    <XCircle className="w-5 h-5" style={{ color: 'var(--odoo-danger)', display: 'inline-block' }} />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center" style={{ padding: '64px 0', color: 'var(--odoo-text-muted)' }}>
                        <ScanLine style={{ width: '40px', height: '40px', opacity: 0.3, marginBottom: '12px' }} />
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>No scans recorded yet</p>
                        <p style={{ fontSize: '0.75rem', marginTop: '4px', margin: '4px 0 0' }}>Scan a barcode to get started</p>
                    </div>
                )}
            </div>

            {/* ===== 5. Footer Status Bar ===== */}
            <div className="flex items-center justify-between flex-wrap gap-2" style={{
                marginTop: '16px', padding: '10px 20px', borderRadius: 'var(--odoo-radius)',
                backgroundColor: 'var(--odoo-surface-low)',
                border: '1px solid var(--odoo-border-ghost)',
                fontSize: '0.6875rem', fontWeight: 600, color: 'var(--odoo-text-muted)',
                fontFamily: '"Source Code Pro", monospace', textTransform: 'uppercase',
            }}>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" />
                        {totalScanned} scanned / {totalExpected} expected
                    </span>
                    <span style={{ color: 'var(--odoo-border)' }}>|</span>
                    <span>{done.length} completed</span>
                    <span style={{ color: 'var(--odoo-border)' }}>|</span>
                    <span>{pending.length} pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        backgroundColor: 'var(--odoo-success)',
                    }} />
                    Scanner Active
                </div>
            </div>
        </div>
    );
};

export default Scan;
