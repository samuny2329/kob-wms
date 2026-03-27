import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Package, LogOut, ChevronLeft, ScanLine, User, RefreshCw, Wifi, WifiOff, Settings, X, Check } from 'lucide-react';
import Pick from './Pick';
import HandheldPack from './HandheldPack';
import { fetchAllOrders, authenticateOdoo } from '../services/odooApi';

const HandheldLayout = ({
    user, handleLogout,
    salesOrders, setSalesOrders,
    selectedPickOrder, setSelectedPickOrder,
    handlePickScanSubmit, pickScanInput, setPickScanInput, pickInputRef,
    playSound, logActivity, addToast,
    handleFulfillmentAndAWB, isProcessingAPI,
    apiConfigs, setApiConfigs, inventory, printAwbLabel,
    syncPlatformOrders, isProcessingImport,
    syncStatus, syncNow,
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

    const isLiveMode = apiConfigs?.odoo?.enabled && apiConfigs?.odoo?.useMock === false;

    // Build effective odoo config (live-forced)
    const liveConfig = {
        ...apiConfigs?.odoo,
        url: odooUrl, db: odooDB, username: odooUser, password: odooPass,
        enabled: true, useMock: false,
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
                useMock: false,
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

                    {/* PICK */}
                    <button
                        onClick={() => setScreen('pick')}
                        className="flex-1 min-h-[130px] flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#714B67]/20 border-2 border-[#714B67] active:scale-95 transition-all"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[#714B67] flex items-center justify-center">
                            <ShoppingCart className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="font-black text-xl text-white">PICK</p>
                            <p className="text-xs mt-0.5">
                                {pendingPick > 0
                                    ? <span className="text-amber-400 font-bold">{pendingPick} orders pending Pick</span>
                                    : <span className="text-zinc-500">No tasks</span>
                                }
                            </p>
                        </div>
                    </button>

                    {/* PACK */}
                    <button
                        onClick={() => setScreen('pack')}
                        className="flex-1 min-h-[130px] flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#00A09D]/10 border-2 border-[#00A09D] active:scale-95 transition-all"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[#00A09D] flex items-center justify-center">
                            <Package className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="font-black text-xl text-white">PACK</p>
                            <p className="text-xs mt-0.5">
                                {readyPack > 0
                                    ? <span className="text-emerald-400 font-bold">{readyPack} orders pending Pack</span>
                                    : <span className="text-zinc-500">No tasks</span>
                                }
                            </p>
                        </div>
                    </button>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Pending', val: salesOrders.filter(o => o.status === 'pending').length, color: 'text-amber-400' },
                            { label: 'Picking', val: salesOrders.filter(o => o.status === 'picking').length, color: 'text-blue-400' },
                            { label: 'Shipped', val: salesOrders.filter(o => ['rts','locked'].includes(o.status)).length, color: 'text-emerald-400' },
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
                        salesOrders={salesOrders}
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

export default HandheldLayout;
