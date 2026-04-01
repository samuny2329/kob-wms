import React, { useState, useMemo } from 'react';
import { X, ClipboardList, Package, Printer, AlertTriangle, CheckCircle2, ArrowRight, RotateCcw, TrendingDown } from 'lucide-react';
import { BOX_TYPES, PACKING_MATERIALS, PACKING_SPEC } from '../constants';
import { autoClockOut } from './TimeAttendance';

const ALL_ITEMS = [...BOX_TYPES.map(b => ({ ...b, category: 'box' })), ...PACKING_MATERIALS];

export default function PackStation({ isOpen, onClose, boxUsageLog = [], addToast, logActivity, user }) {
    const [tab, setTab] = useState('count'); // 'count' | 'requisition' | 'history'
    const [counts, setCounts] = useState(() => {
        try { return JSON.parse(localStorage.getItem('wms_station_counts') || '[]'); } catch (e) { return []; }
    });
    const [reqItems, setReqItems] = useState({});
    const [countInputs, setCountInputs] = useState({});
    const [showCountForm, setShowCountForm] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const todayCount = counts.find(c => c.date === today && c.status === 'completed');

    // Calculate expected usage from boxUsageLog today
    const todayUsage = useMemo(() => {
        const usage = {};
        const todayStart = new Date(today).getTime();
        const todayEnd = todayStart + 86400000;
        (boxUsageLog || []).forEach(log => {
            if (log.timestamp >= todayStart && log.timestamp < todayEnd) {
                const boxId = log.boxType;
                usage[boxId] = (usage[boxId] || 0) + 1;
                // Add material usage based on PACKING_SPEC
                const spec = PACKING_SPEC[boxId];
                if (spec) {
                    usage['BUBBLE-WRAP'] = (usage['BUBBLE-WRAP'] || 0) + spec.bubble;
                    usage['TAPE-CLEAR'] = (usage['TAPE-CLEAR'] || 0) + spec.tape;
                    usage['STRETCH'] = (usage['STRETCH'] || 0) + spec.stretch;
                    usage['FILL-PAPER'] = (usage['FILL-PAPER'] || 0) + spec.fill;
                }
            }
        });
        return usage;
    }, [boxUsageLog, today]);

    const saveCounts = (updated) => {
        setCounts(updated);
        localStorage.setItem('wms_station_counts', JSON.stringify(updated));
    };

    const handleEndDayCount = () => {
        const remaining = {};
        ALL_ITEMS.forEach(item => { remaining[item.id] = parseInt(countInputs[item.id] || '0', 10); });
        const newCount = {
            id: `SC-${today}-${Date.now()}`,
            date: today,
            user: user?.username || 'admin',
            remaining,
            todayUsage: { ...todayUsage },
            status: 'completed',
            createdAt: new Date().toISOString(),
        };
        saveCounts([newCount, ...counts.filter(c => c.date !== today)]);
        setCountInputs({});
        setShowCountForm(false);
        addToast?.('End-of-day count saved — clocked out', 'success');
        logActivity?.('station-count', { date: today, items: Object.entries(remaining).filter(([,v]) => v > 0).length });
        // Auto clock-out on end-of-day count
        autoClockOut(user?.username);
    };

    const handleRequisition = () => {
        const items = Object.entries(reqItems).filter(([, qty]) => qty > 0);
        if (items.length === 0) { addToast?.('Select items to requisition', 'warning'); return; }
        const reqId = `REQ-${today}-${String(counts.length + 1).padStart(3, '0')}`;
        addToast?.(`Requisition ${reqId} created — ${items.length} items`, 'success');
        logActivity?.('material-requisition', { reqId, items: items.map(([id, qty]) => ({ id, qty })) });
        // Print
        const printContent = items.map(([id, qty]) => {
            const item = ALL_ITEMS.find(i => i.id === id);
            return `${item?.name || id}: ${qty} ${item?.unit || 'pcs'}`;
        }).join('\n');
        const w = window.open('', '_blank', 'width=400,height=600');
        if (w) {
            w.document.write(`<html><head><title>${reqId}</title><style>body{font-family:sans-serif;padding:20px}h1{font-size:16px;border-bottom:2px solid #714B67;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f8f9fa}tr:nth-child(even){background:#fafafa}.sig{margin-top:40px;display:flex;gap:40px}.sig div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:11px}</style></head><body>`);
            w.document.write(`<h1>Material Requisition — ${reqId}</h1>`);
            w.document.write(`<p style="font-size:12px;color:#666">Date: ${today} | Shift: ${new Date().getHours() < 12 ? 'AM' : 'PM'} | Requested by: ${user?.name || user?.username || 'Admin'}</p>`);
            w.document.write(`<table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>`);
            items.forEach(([id, qty], i) => {
                const item = ALL_ITEMS.find(it => it.id === id);
                w.document.write(`<tr><td>${i + 1}</td><td>${item?.name || id}</td><td>${qty}</td><td>${item?.unit || 'pcs'}</td></tr>`);
            });
            w.document.write(`</tbody></table>`);
            w.document.write(`<div class="sig"><div>Requester Sign</div><div>Store Sign</div></div>`);
            w.document.write(`</body></html>`);
            w.document.close();
            w.print();
        }
        setReqItems({});
    };

    // Auto-suggest requisition from pending orders
    const autoSuggest = (pendingCount = 50) => {
        const suggested = {};
        // Estimate: pendingCount orders, average BOX-M
        const avgSpec = PACKING_SPEC['BOX-M'];
        suggested['BOX-S'] = Math.ceil(pendingCount * 0.2);
        suggested['BOX-M'] = Math.ceil(pendingCount * 0.5);
        suggested['BOX-L'] = Math.ceil(pendingCount * 0.2);
        suggested['BOX-XL'] = Math.ceil(pendingCount * 0.05);
        suggested['ENV-A4'] = Math.ceil(pendingCount * 0.05);
        suggested['BUBBLE-WRAP'] = Math.ceil(pendingCount * (avgSpec?.bubble || 2));
        suggested['TAPE-CLEAR'] = Math.ceil(pendingCount * (avgSpec?.tape || 3) / 50); // strips per roll
        suggested['STRETCH'] = Math.ceil(pendingCount * 0.02);
        suggested['FILL-PAPER'] = Math.ceil(pendingCount * (avgSpec?.fill || 2));
        setReqItems(suggested);
    };

    if (!isOpen) return null;

    const completedCount = todayCount?.status === 'completed' ? todayCount : null;

    return (
        <>
        <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[700px] max-w-[95vw] max-h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: '#dee2e6', backgroundColor: '#f8f9fa' }}>
                <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" style={{ color: '#714B67' }} />
                    <h2 className="text-sm font-bold" style={{ color: '#212529' }}>Pack Station</h2>
                    {todayCount && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Counted</span>}
                </div>
                <div className="flex items-center gap-2">
                    {/* Tabs */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                        {[{ id: 'count', label: 'Station Count' }, { id: 'requisition', label: 'Requisition' }, { id: 'history', label: 'History' }].map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${tab === t.id ? 'bg-white dark:bg-gray-600 shadow-sm text-purple-700' : 'text-gray-500'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-200"><X className="w-4 h-4 text-gray-500" /></button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
                {/* ── TAB: STATION COUNT ── */}
                {tab === 'count' && (
                    <div className="space-y-4">
                        {/* Action bar */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {!todayCount && (
                                <button onClick={() => { setShowCountForm(true); setCountInputs({}); }}
                                    className="odoo-btn odoo-btn-primary text-xs">
                                    <Package className="w-3.5 h-3.5" /> End-of-Day Count
                                </button>
                            )}
                            {todayCount && (
                                <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                                    <CheckCircle2 className="w-4 h-4" /> Counted today
                                    <button onClick={() => { setShowCountForm(true); setCountInputs({}); }}
                                        className="odoo-btn odoo-btn-secondary text-[10px] ml-2">
                                        <RotateCcw className="w-3 h-3" /> Recount
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Count form — just count remaining */}
                        {showCountForm && (
                            <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                                <div className="px-4 py-2 text-xs font-bold uppercase" style={{ backgroundColor: '#f8f9fa', color: '#6c757d', borderBottom: '1px solid #dee2e6' }}>
                                    Count Remaining Stock at Station
                                </div>
                                <div className="divide-y" style={{ borderColor: '#f1f3f5' }}>
                                    {ALL_ITEMS.map(item => (
                                        <div key={item.id} className="flex items-center justify-between px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                {item.icon && <span className="text-lg">{item.icon}</span>}
                                                <div>
                                                    <p className="text-xs font-medium" style={{ color: '#212529' }}>{item.name}</p>
                                                    <p className="text-[10px]" style={{ color: '#adb5bd' }}>{item.unit || 'pcs'}</p>
                                                </div>
                                            </div>
                                            <input type="number" min="0" value={countInputs[item.id] || ''}
                                                onChange={e => setCountInputs({ ...countInputs, [item.id]: e.target.value })}
                                                placeholder="0" className="odoo-input w-20 text-center text-sm" />
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 py-3 flex gap-2" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                    <button onClick={handleEndDayCount} className="odoo-btn odoo-btn-primary text-xs">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Save Count
                                    </button>
                                    <button onClick={() => setShowCountForm(false)} className="odoo-btn odoo-btn-secondary text-xs">Cancel</button>
                                </div>
                            </div>
                        )}

                        {/* Today's result */}
                        {todayCount && (
                            <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                                <div className="px-4 py-2 text-xs font-bold uppercase" style={{ backgroundColor: '#f8f9fa', color: '#6c757d', borderBottom: '1px solid #dee2e6' }}>
                                    Today's Count — {todayCount.date}
                                </div>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                                            <th className="px-3 py-2 text-left font-semibold" style={{ color: '#6c757d' }}>Item</th>
                                            <th className="px-3 py-2 text-center" style={{ color: '#6c757d' }}>Remaining</th>
                                            <th className="px-3 py-2 text-center" style={{ color: '#6c757d' }}>Used Today</th>
                                            <th className="px-3 py-2 text-center" style={{ color: '#6c757d' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ALL_ITEMS.map(item => {
                                            const remaining = todayCount.remaining?.[item.id] || 0;
                                            const used = todayCount.todayUsage?.[item.id] || 0;
                                            const isLow = remaining > 0 && remaining < (item.reorderPoint || 10);
                                            if (remaining === 0 && used === 0) return null;
                                            return (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                                                    <td className="px-3 py-2 font-medium" style={{ color: '#212529' }}>{item.icon} {item.name}</td>
                                                    <td className="px-3 py-2 text-center font-bold" style={{ color: '#212529' }}>{remaining}</td>
                                                    <td className="px-3 py-2 text-center" style={{ color: '#6c757d' }}>{used}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        {isLow ? (
                                                            <span className="text-[10px] font-bold text-amber-600 flex items-center justify-center gap-0.5">
                                                                <AlertTriangle className="w-3 h-3" /> Low
                                                            </span>
                                                        ) : remaining > 0 ? (
                                                            <span className="text-[10px] font-bold text-green-600">OK</span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {/* Low stock alerts */}
                                {ALL_ITEMS.filter(item => {
                                    const r = todayCount.remaining?.[item.id] || 0;
                                    return r > 0 && r < (item.reorderPoint || 10);
                                }).length > 0 && (
                                    <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                                        <p className="text-xs font-bold text-amber-700 flex items-center gap-1 mb-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Low Stock — Reorder Needed
                                        </p>
                                        {ALL_ITEMS.filter(item => {
                                            const r = todayCount.remaining?.[item.id] || 0;
                                            return r > 0 && r < (item.reorderPoint || 10);
                                        }).map(item => (
                                            <p key={item.id} className="text-[10px] text-amber-600">
                                                {item.name}: {todayCount.remaining[item.id]} remaining (reorder at {item.reorderPoint || 10})
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: REQUISITION ── */}
                {tab === 'requisition' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs" style={{ color: '#6c757d' }}>Select items and quantities to requisition from main store</p>
                            <button onClick={() => autoSuggest(50)} className="odoo-btn odoo-btn-secondary text-xs">
                                <RotateCcw className="w-3 h-3" /> Auto-suggest (50 orders)
                            </button>
                        </div>
                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                            <div className="divide-y" style={{ borderColor: '#f1f3f5' }}>
                                {ALL_ITEMS.map(item => (
                                    <div key={item.id} className="flex items-center justify-between px-4 py-2">
                                        <div className="flex items-center gap-2">
                                            {item.icon && <span className="text-lg">{item.icon}</span>}
                                            <div>
                                                <p className="text-xs font-medium" style={{ color: '#212529' }}>{item.name}</p>
                                                <p className="text-[10px]" style={{ color: '#adb5bd' }}>{item.size || item.unit}</p>
                                            </div>
                                        </div>
                                        <input type="number" min="0" value={reqItems[item.id] || ''}
                                            onChange={e => setReqItems({ ...reqItems, [item.id]: parseInt(e.target.value || '0', 10) })}
                                            placeholder="0" className="odoo-input w-20 text-center text-sm" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleRequisition} className="odoo-btn odoo-btn-primary text-xs">
                                <Printer className="w-3.5 h-3.5" /> Create & Print Requisition
                            </button>
                            <button onClick={() => setReqItems({})} className="odoo-btn odoo-btn-secondary text-xs">Clear</button>
                        </div>
                    </div>
                )}

                {/* ── TAB: HISTORY ── */}
                {tab === 'history' && (
                    <div className="space-y-3">
                        {counts.length === 0 ? (
                            <p className="text-center py-8 text-sm" style={{ color: '#adb5bd' }}>No station counts yet</p>
                        ) : counts.slice(0, 14).map(c => (
                            <div key={c.id} className="border rounded-lg p-3 flex items-center justify-between" style={{ borderColor: '#dee2e6' }}>
                                <div>
                                    <p className="text-xs font-bold" style={{ color: '#212529' }}>{c.date} — {c.shift}</p>
                                    <p className="text-[10px]" style={{ color: '#6c757d' }}>By {c.user} | {c.status}</p>
                                </div>
                                <div className="text-right">
                                    {c.status === 'completed' && c.used && (
                                        <p className="text-xs font-medium" style={{ color: '#212529' }}>
                                            {Object.values(c.used).reduce((a, b) => a + b, 0)} items used
                                        </p>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'completed' ? 'bg-green-100 text-green-700' : c.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {c.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </>
    );
}
