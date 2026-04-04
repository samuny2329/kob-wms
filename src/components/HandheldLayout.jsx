import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Package, LogOut, ChevronLeft, ScanLine, User, RefreshCw, Wifi, WifiOff, Settings, X, Check, ClipboardCheck, Clock, Gift, Truck, CheckCircle2, AlertTriangle, Activity, Zap, Award } from 'lucide-react';
import Pick from './Pick';
import HandheldPack from './HandheldPack';
import CycleCount from './CycleCount';
import TimeAttendance, { isClockedIn } from './TimeAttendance';
import { HandheldGWPQuickAdd } from './GWPManager';
import { fetchAllOrders, authenticateOdoo } from '../services/odooApi';

const HandheldLayout = ({
    user, handleLogout,
    salesOrders, setSalesOrders, allSalesOrders, totalOrderCount,
    selectedPickOrder, setSelectedPickOrder,
    handlePickScanSubmit, pickScanInput, setPickScanInput, pickInputRef,
    playSound, logActivity, addToast,
    handleFulfillmentAndAWB, isProcessingAPI,
    apiConfigs, setApiConfigs, inventory, printAwbLabel,
    syncPlatformOrders, isProcessingImport,
    syncStatus, syncNow, activityLogs,
}) => {
    const [screen, setScreen] = useState('home');
    const [isSyncingOrders, setIsSyncingOrders] = useState(false);
    const syncingRef = useRef(false); // sync ref for immediate check (avoids stale state)
    const [showSetup, setShowSetup] = useState(false);

    // Odoo quick-setup state (read from current apiConfigs or defaults)
    const [odooUrl, setOdooUrl] = useState(() => apiConfigs?.odoo?.url || import.meta.env.VITE_ODOO_URL || '');
    const [odooDB, setOdooDB] = useState(() => apiConfigs?.odoo?.db || '');
    const [odooUser, setOdooUser] = useState(() => apiConfigs?.odoo?.username || '');
    const [odooPass, setOdooPass] = useState(() => apiConfigs?.odoo?.password || '');
    const [setupStatus, setSetupStatus] = useState(null); // null | 'testing' | 'ok' | 'error'

    const isLiveMode = apiConfigs?.odoo?.enabled && !!apiConfigs?.odoo?.enabled;

    // Build effective odoo config (live-forced)
    const liveConfig = {
        ...apiConfigs?.odoo,
        url: odooUrl, db: odooDB, username: odooUser, password: odooPass,
        enabled: true, /* live mode */
    };

    // Manual "Sync Orders" button available to force-pull from Odoo

    const handleSyncOrders = async () => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        setIsSyncingOrders(true);
        try {
            // Always use real credentials from apiConfigs
            const base = apiConfigs?.odoo || {};
            const cfg = {
                ...base,
                url: base.url || odooUrl,
                db: base.db || odooDB,
                username: base.username || odooUser,
                password: base.password || odooPass,
                enabled: true,
                /* live mode */
            };
            const orders = await fetchAllOrders(cfg);
            if (orders && Array.isArray(orders) && orders.length > 0) {
                setSalesOrders(prev => {
                    // Merge Odoo orders — keep local progress if higher
                    const merged = orders.map(remote => {
                        const local = prev.find(l => l.id === remote.id);
                        if (local) {
                            const lp = local.items?.reduce((s, i) => s + (i.picked || 0) + (i.packed || 0), 0) || 0;
                            const rp = remote.items?.reduce((s, i) => s + (i.picked || 0) + (i.packed || 0), 0) || 0;
                            return lp > rp ? local : remote;
                        }
                        return remote;
                    });
                    // Preserve existing orders not in this Odoo fetch
                    prev.forEach(l => { if (!merged.find(m => m.id === l.id)) merged.push(l); });
                    return merged;
                });
                addToast('Orders loaded successfully');
            } else {
                addToast('No new orders from Odoo');
            }
        } catch (err) {
            addToast('Sync failed: ' + err.message, 'error');
        } finally {
            syncingRef.current = false;
            setIsSyncingOrders(false);
        }
    };

    const handleQuickSetup = async () => {
        setSetupStatus('testing');
        try {
            await authenticateOdoo(liveConfig);
            // Save to apiConfigs
            if (setApiConfigs) {
                setApiConfigs(prev => ({
                    ...prev,
                    odoo: { ...prev.odoo, ...liveConfig }
                }));
            }
            setSetupStatus('ok');
            setShowSetup(false);
            addToast('Connected to Odoo successfully');
            // Sync orders immediately
            setTimeout(handleSyncOrders, 500);
        } catch (err) {
            setSetupStatus('error');
        }
    };

    const goBack = () => {
        if (selectedPickOrder) { setSelectedPickOrder(null); return; }
        setScreen('home');
    };

    const pendingPick = salesOrders.filter(o => o.status === 'pending' || o.status === 'picking').length;
    const readyPack = salesOrders.filter(o => ['picked', 'packing', 'packed'].includes(o.status)).length;

    return (
        <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#714B67] shrink-0">
                <div className="flex items-center gap-2">
                    {screen !== 'home' ? (
                        <button onClick={goBack} className="p-2 rounded-lg bg-white/10 active:bg-white/20">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <ScanLine className="w-4 h-4" />
                        </div>
                    )}
                    <span className="font-black text-sm tracking-tight">KOB&amp;BTV</span>
                </div>
                <div className="flex items-center gap-2">
                    {isLiveMode
                        ? <Wifi className="w-3.5 h-3.5 text-emerald-300" />
                        : <WifiOff className="w-3.5 h-3.5 text-amber-300" />
                    }
                    <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <User className="w-3.5 h-3.5" />{user.name}
                    </div>
                    {screen === 'home' && (
                        <button onClick={() => setShowSetup(true)} className="p-2 rounded-lg bg-white/10 active:bg-white/20">
                            <Settings className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={handleLogout} className="p-2 rounded-lg bg-white/10 active:bg-white/20">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Home screen */}
            {screen === 'home' && (
                <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
                    <div className="flex items-center justify-between pt-2 pb-2">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Select task</p>
                        <button
                            onClick={handleSyncOrders}
                            disabled={isSyncingOrders}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 active:bg-zinc-700 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOrders ? 'animate-spin' : ''}`} />
                            {isSyncingOrders ? 'Syncing...' : 'Sync Orders'}
                        </button>
                    </div>

                    {/* Not configured warning */}
                    {!isLiveMode && (
                        <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3 flex items-center gap-3">
                            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-amber-300 text-xs font-bold">Not connected to Odoo</p>
                                <p className="text-amber-400/70 text-[10px] mt-0.5">Press ⚙ Settings to load orders</p>
                            </div>
                            <button
                                onClick={() => setShowSetup(true)}
                                className="shrink-0 bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:bg-amber-700"
                            >
                                Settings
                            </button>
                        </div>
                    )}

                    {/* PICK, PACK & OUT — main row */}
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setScreen('pick')}
                            className="min-h-[130px] flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#714B67]/20 border-2 border-[#714B67] active:scale-95 transition-all"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-[#714B67] flex items-center justify-center">
                                <ShoppingCart className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-lg text-white">PICK</p>
                                <p className="text-[9px] mt-0.5">
                                    {pendingPick > 0
                                        ? <span className="text-amber-400 font-bold">{pendingPick} pending</span>
                                        : <span className="text-zinc-500">No tasks</span>
                                    }
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setScreen('pack')}
                            className="min-h-[130px] flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#00A09D]/10 border-2 border-[#00A09D] active:scale-95 transition-all"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-[#00A09D] flex items-center justify-center">
                                <Package className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-lg text-white">PACK</p>
                                <p className="text-[9px] mt-0.5">
                                    {readyPack > 0
                                        ? <span className="text-emerald-400 font-bold">{readyPack} pending</span>
                                        : <span className="text-zinc-500">No tasks</span>
                                    }
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setScreen('out')}
                            className="min-h-[130px] flex flex-col items-center justify-center gap-2 rounded-2xl bg-orange-500/10 border-2 border-orange-500 active:scale-95 transition-all"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center">
                                <Truck className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-lg text-white">OUT</p>
                                <p className="text-[9px] mt-0.5">
                                    {(() => { const rts = salesOrders.filter(o => ['packed','rts'].includes(o.status)).length; return rts > 0 ? <span className="text-orange-400 font-bold">{rts} ready</span> : <span className="text-zinc-500">No tasks</span>; })()}
                                </p>
                            </div>
                        </button>
                    </div>

                    {/* COUNT, GWP & CLOCK — row 2 */}
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setScreen('count')}
                            className="min-h-[120px] flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#714B67]/10 border-2 border-[#714B67]/60 active:scale-95 transition-all"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-[#714B67]/80 flex items-center justify-center">
                                <ClipboardCheck className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-base text-white">COUNT</p>
                                <p className="text-[9px] text-zinc-500">Cycle Count</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setScreen('gwp')}
                            className="min-h-[120px] flex flex-col items-center justify-center gap-2 rounded-2xl bg-amber-500/10 border-2 border-amber-500/60 active:scale-95 transition-all"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-amber-600/80 flex items-center justify-center">
                                <Gift className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-base text-white">GWP</p>
                                <p className="text-[9px] text-zinc-500">Freebie</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setScreen('clock')}
                            className="min-h-[120px] flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#00A09D]/5 border-2 border-[#00A09D]/60 active:scale-95 transition-all"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-[#00A09D]/80 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-base text-white">CLOCK</p>
                                <p className="text-[9px]">
                                    {isClockedIn(user?.username) ? <span className="text-emerald-400">Auto ✓</span> : <span className="text-zinc-500">Auto on login</span>}
                                </p>
                            </div>
                        </button>
                    </div>

                    {/* My Performance */}
                    {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const myLogs = (activityLogs || []).filter(l => l.username === user?.username && new Date(l.timestamp).toISOString().split('T')[0] === today);
                        const pick = myLogs.filter(l => l.action === 'pick').length;
                        const pack = myLogs.filter(l => ['pack','box-handheld','box-pos'].includes(l.action)).length;
                        const scan = myLogs.filter(l => l.action === 'scan').length;
                        const total = pick + pack + scan;
                        const first = myLogs.length ? Math.min(...myLogs.map(l => l.timestamp)) : null;
                        const last = myLogs.length ? Math.max(...myLogs.map(l => l.timestamp)) : null;
                        let hrs = first && last ? (last - first) / 3600000 : 0;
                        if (hrs < 0.016) hrs = 0.016;
                        const myUph = total > 0 ? Math.round(total / hrs) : 0;
                        const target = 50;
                        return (
                        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity className="w-4 h-4 text-[#714B67]" />
                                <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">My Performance</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div>
                                    <p className={`text-2xl font-black ${myUph >= target ? 'text-emerald-400' : myUph > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{myUph}</p>
                                    <p className="text-[8px] text-zinc-500 uppercase">UPH</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-white">{total}</p>
                                    <p className="text-[8px] text-zinc-500 uppercase">Done</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-[#714B67]">{pick}</p>
                                    <p className="text-[8px] text-zinc-500 uppercase">Pick</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-[#00A09D]">{pack}</p>
                                    <p className="text-[8px] text-zinc-500 uppercase">Pack</p>
                                </div>
                            </div>
                            {total === 0 && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
                                    <Zap className="w-3.5 h-3.5 text-zinc-600" />
                                    <p className="text-[10px] text-zinc-600">Start your first task!</p>
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    {/* Order Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Pending', val: salesOrders.filter(o => o.status === 'pending').length, color: 'text-amber-400' },
                            { label: 'Picking', val: salesOrders.filter(o => o.status === 'picking').length, color: 'text-blue-400' },
                            { label: 'Total', val: totalOrderCount || salesOrders.length, color: 'text-zinc-300' },
                        ].map(s => (
                            <div key={s.label} className="bg-zinc-900 rounded-xl p-3 text-center border border-zinc-800">
                                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pick screen */}
            {screen === 'pick' && (
                <div className="flex-1 overflow-y-auto">
                    <Pick
                        salesOrders={allSalesOrders || salesOrders}
                        selectedPickOrder={selectedPickOrder}
                        setSelectedPickOrder={setSelectedPickOrder}
                        syncPlatformOrders={syncPlatformOrders}
                        isProcessingImport={isProcessingImport}
                        handlePickScanSubmit={handlePickScanSubmit}
                        pickScanInput={pickScanInput}
                        setPickScanInput={setPickScanInput}
                        pickInputRef={pickInputRef}
                        inventory={inventory}
                        isSyncingOrders={isSyncingOrders}
                        onSyncOrders={handleSyncOrders}
                    />
                </div>
            )}

            {/* Pack screen */}
            {screen === 'pack' && (
                <div className="flex-1 overflow-y-auto">
                    <HandheldPack
                        salesOrders={salesOrders}
                        setSalesOrders={setSalesOrders}
                        playSound={playSound}
                        logActivity={logActivity}
                        addToast={addToast}
                        handleFulfillmentAndAWB={handleFulfillmentAndAWB}
                        isProcessingAPI={isProcessingAPI}
                        apiConfigs={apiConfigs}
                        printAwbLabel={printAwbLabel}
                    />
                </div>
            )}

            {/* Count screen */}
            {screen === 'count' && (
                <div className="flex-1 overflow-y-auto p-3" style={{ color: '#111827', backgroundColor: '#f9fafb' }}>
                    <CycleCount
                        inventory={inventory}
                        activityLogs={activityLogs || []}
                        salesOrders={salesOrders}
                        addToast={addToast}
                        user={user}
                        users={[]}
                        logActivity={logActivity}
                    />
                </div>
            )}

            {/* GWP screen */}
            {screen === 'gwp' && (
                <div className="flex-1 overflow-y-auto p-3" style={{ color: '#111827', backgroundColor: '#f9fafb' }}>
                    <HandheldGWPQuickAdd
                        addToast={addToast}
                        logActivity={logActivity}
                        user={user}
                    />
                </div>
            )}

            {/* Outbound Scan screen */}
            {screen === 'out' && (
                <div className="flex-1 overflow-y-auto p-3" style={{ color: '#111827', backgroundColor: '#f9fafb' }}>
                    <HandheldOutbound
                        salesOrders={salesOrders}
                        setSalesOrders={setSalesOrders}
                        addToast={addToast}
                        logActivity={logActivity}
                        user={user}
                    />
                </div>
            )}

            {/* Clock screen */}
            {screen === 'clock' && (
                <div className="flex-1 overflow-y-auto p-3" style={{ color: '#111827', backgroundColor: '#f9fafb' }}>
                    <TimeAttendance
                        user={user}
                        users={[]}
                        addToast={addToast}
                        logActivity={logActivity}
                    />
                </div>
            )}

            {/* Quick Setup Modal */}
            {showSetup && (
                <div className="fixed inset-0 bg-black/80 flex items-end z-50">
                    <div className="w-full bg-zinc-900 rounded-t-3xl border-t border-zinc-800 p-6 pb-8">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <Settings className="w-4 h-4 text-[#714B67]" /> Odoo Connection
                            </h3>
                            <button onClick={() => { setShowSetup(false); setSetupStatus(null); }} className="p-2 rounded-xl bg-zinc-800">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text" value={odooUrl} onChange={e => setOdooUrl(e.target.value)}
                                placeholder="Odoo URL (http://...)"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#714B67]"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text" value={odooDB} onChange={e => setOdooDB(e.target.value)}
                                    placeholder="Database"
                                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#714B67]"
                                />
                                <input
                                    type="text" value={odooUser} onChange={e => setOdooUser(e.target.value)}
                                    placeholder="Username"
                                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#714B67]"
                                />
                            </div>
                            <input
                                type="password" value={odooPass} onChange={e => setOdooPass(e.target.value)}
                                placeholder="Password"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#714B67]"
                            />
                        </div>
                        {setupStatus === 'error' && (
                            <p className="text-red-400 text-xs mt-3 font-semibold">❌ Connection failed — check URL/Password</p>
                        )}
                        {setupStatus === 'ok' && (
                            <p className="text-emerald-400 text-xs mt-3 font-semibold">✓ Connected successfully!</p>
                        )}
                        <button
                            onClick={handleQuickSetup}
                            disabled={setupStatus === 'testing' || !odooPass}
                            className="w-full mt-5 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                            style={{ backgroundColor: '#714B67' }}
                        >
                            {setupStatus === 'testing'
                                ? <><RefreshCw className="w-5 h-5 animate-spin" /> Connecting...</>
                                : <><Check className="w-5 h-5" /> Connect &amp; Load Orders</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Handheld Outbound Scan ──────────────────────────────────────────────────
const COURIER_BINS = {
    'Flash': { color: '#f59e0b', bin: 'BIN-A' },
    'Kerry': { color: '#f97316', bin: 'BIN-B' },
    'J&T': { color: '#ef4444', bin: 'BIN-C' },
    'Thai Post': { color: '#dc2626', bin: 'BIN-D' },
    'Shopee Express': { color: '#ee4d2d', bin: 'BIN-E' },
    'Lazada Express': { color: '#0f146d', bin: 'BIN-F' },
};

function HandheldOutbound({ salesOrders, setSalesOrders, addToast, logActivity, user }) {
    const [scanInput, setScanInput] = useState('');
    const [lastScan, setLastScan] = useState(null);
    const [scanFlash, setScanFlash] = useState(null); // 'ok'|'error'|'duplicate'
    const [scannedIds, setScannedIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem('wms_handheld_outbound_scanned') || '[]'); } catch { return []; }
    });
    const inputRef = useRef(null);

    // Auto-focus scan input (same pattern as Pick)
    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, []);
    useEffect(() => { localStorage.setItem('wms_handheld_outbound_scanned', JSON.stringify(scannedIds)); }, [scannedIds]);

    // Re-focus after any scan result
    useEffect(() => {
        if (lastScan) {
            const timer = setTimeout(() => inputRef.current?.focus(), 200);
            return () => clearTimeout(timer);
        }
    }, [lastScan]);

    const readyOrders = salesOrders.filter(o => ['packed', 'rts'].includes(o.status));

    const handleScanKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const val = scanInput.trim();
        if (!val) return;
        setScanInput('');

        const order = salesOrders.find(o =>
            o.awb === val || o.trackingNumber === val || o.id === val ||
            o.orderId === val || o.name === val
        );

        if (!order) {
            setLastScan({ order: null, status: 'error', msg: `Not found: ${val}` });
            setScanFlash('error');
            setTimeout(() => setScanFlash(null), 600);
            return;
        }

        if (scannedIds.includes(order.id)) {
            setLastScan({ order, status: 'duplicate', msg: 'Already scanned' });
            setScanFlash('duplicate');
            setTimeout(() => setScanFlash(null), 600);
            return;
        }

        if (!['packed', 'rts', 'picked'].includes(order.status)) {
            setLastScan({ order, status: 'error', msg: `Status: ${order.status} — not ready` });
            setScanFlash('error');
            setTimeout(() => setScanFlash(null), 600);
            return;
        }

        setScannedIds(prev => [...prev, order.id]);
        setSalesOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'rts', outboundScannedAt: new Date().toISOString() } : o));
        logActivity?.('scan', user?.username || 'handheld', { orderId: order.id, awb: order.awb || val });
        setLastScan({ order, status: 'ok', msg: 'Scanned OK' });
        setScanFlash('ok');
        setTimeout(() => setScanFlash(null), 600);
        addToast?.(`Outbound: ${order.orderId || order.id}`, 'success');
    };

    const courierInfo = lastScan?.order?.courier ? COURIER_BINS[lastScan.order.courier] || { color: '#6b7280', bin: 'BIN-X' } : null;

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-base font-black flex items-center gap-2" style={{ color: '#111827' }}>
                    <Truck className="w-5 h-5" style={{ color: '#f97316' }} />
                    Outbound Scan
                </h2>
                <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
                    {readyOrders.length} ready / {scannedIds.length} scanned
                </span>
            </div>

            {/* Industrial Scan Input — same style as Pick/Pack */}
            <div className="text-center">
                <div className="relative group"
                    style={{
                        transition: 'all 0.3s',
                        borderRadius: '1rem',
                        boxShadow: scanFlash === 'ok' ? '0 0 0 6px rgba(34,197,94,0.25)'
                            : scanFlash === 'error' ? '0 0 0 6px rgba(239,68,68,0.25)'
                            : scanFlash === 'duplicate' ? '0 0 0 6px rgba(245,158,11,0.25)'
                            : 'none',
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        autoFocus
                        value={scanInput}
                        onChange={e => setScanInput(e.target.value)}
                        onKeyDown={handleScanKeyDown}
                        onFocus={e => {
                            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
                            if (isMobile) {
                                e.target.setAttribute('readonly', 'readonly');
                                setTimeout(() => e.target.removeAttribute('readonly'), 200);
                            }
                        }}
                        placeholder="SCAN AWB..."
                        className="industrial-input w-full text-2xl focus:ring-0"
                    />
                    <ScanLine className="w-8 h-8 absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-[#f97316] transition-colors" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 animate-pulse" style={{ color: '#adb5bd' }}>
                    Waiting for barcode scan...
                </p>
            </div>

            {/* Last Scan Result */}
            {lastScan && (
                <div className="rounded-xl p-4 animate-fade-in" style={{
                    backgroundColor: lastScan.status === 'ok' ? '#f0fdf4' : lastScan.status === 'duplicate' ? '#fffbeb' : '#fef2f2',
                    border: `2px solid ${lastScan.status === 'ok' ? '#22c55e' : lastScan.status === 'duplicate' ? '#f59e0b' : '#ef4444'}`,
                }}>
                    <div className="flex items-center gap-3">
                        {lastScan.status === 'ok' ? <CheckCircle2 className="w-8 h-8" style={{ color: '#22c55e' }} />
                            : lastScan.status === 'duplicate' ? <AlertTriangle className="w-8 h-8" style={{ color: '#f59e0b' }} />
                            : <X className="w-8 h-8" style={{ color: '#ef4444' }} />}
                        <div className="flex-1">
                            <p className="text-sm font-bold" style={{ color: '#111827' }}>{lastScan.msg}</p>
                            {lastScan.order && (
                                <>
                                    <p className="text-xs mt-0.5" style={{ color: '#374151' }}>
                                        {lastScan.order.orderId || lastScan.order.id} — {lastScan.order.platform || 'N/A'}
                                    </p>
                                    <p className="text-xs" style={{ color: '#6b7280' }}>
                                        {lastScan.order.items?.length || 0} items — {lastScan.order.courier || 'No courier'}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Courier Bin Assignment */}
                    {lastScan.status === 'ok' && courierInfo && (
                        <div className="mt-3 p-3 rounded-lg text-center" style={{ backgroundColor: courierInfo.color + '15', border: `2px dashed ${courierInfo.color}` }}>
                            <p className="text-[10px] font-bold uppercase" style={{ color: courierInfo.color }}>Place in</p>
                            <p className="text-2xl font-black" style={{ color: courierInfo.color }}>{courierInfo.bin}</p>
                            <p className="text-xs font-semibold" style={{ color: courierInfo.color }}>{lastScan.order.courier}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Ready Orders List */}
            <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>
                    Ready for Outbound ({readyOrders.length})
                </p>
                {readyOrders.length === 0 ? (
                    <div className="text-center py-8 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <Truck className="w-8 h-8 mx-auto mb-2" style={{ color: '#d1d5db' }} />
                        <p className="text-xs" style={{ color: '#9ca3af' }}>No orders ready for outbound</p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {readyOrders.slice(0, 20).map(order => {
                            const isScanned = scannedIds.includes(order.id);
                            return (
                                <div key={order.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{
                                    backgroundColor: isScanned ? '#f0fdf4' : '#ffffff',
                                    border: `1px solid ${isScanned ? '#86efac' : '#e5e7eb'}`,
                                }}>
                                    {isScanned
                                        ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#22c55e' }} />
                                        : <ScanLine className="w-5 h-5 shrink-0" style={{ color: '#d1d5db' }} />}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate" style={{ color: '#111827' }}>
                                            {order.orderId || order.id}
                                        </p>
                                        <p className="text-[10px] truncate" style={{ color: '#6b7280' }}>
                                            {order.platform || 'N/A'} — {order.courier || 'No courier'} — {order.items?.length || 0} items
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{
                                        backgroundColor: isScanned ? '#dcfce7' : '#f3f4f6',
                                        color: isScanned ? '#16a34a' : '#6b7280',
                                    }}>
                                        {isScanned ? 'DONE' : order.status.toUpperCase()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Clear today's scans */}
            {scannedIds.length > 0 && (
                <button onClick={() => { setScannedIds([]); setLastScan(null); addToast?.('Scan history cleared'); }}
                    className="w-full py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                    Clear Today's Scans ({scannedIds.length})
                </button>
            )}
        </div>
    );
}

export default HandheldLayout;
