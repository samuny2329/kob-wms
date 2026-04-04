import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    Map, Upload, Save, Edit3, Package, BarChart3, ClipboardCheck, X,
    ChevronRight, MapPin, Trash2, Settings, RotateCcw, Minimize2, Maximize2,
} from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';

const ZONE_COLORS = {
    A: '#dc2626', B: '#d97706', C: '#2563eb', D: '#16a34a',
    E: '#9333ea', F: '#e11d48', G: '#0891b2', H: '#65a30d',
    I: '#475569', FLG: '#78716c', PF: '#0ea5e9',
};

const VIEW_MODES = [
    { id: 'stock', label: 'Stock Level', Icon: Package },
    { id: 'count', label: 'Count Status', Icon: ClipboardCheck },
    { id: 'frequency', label: 'Pick Frequency', Icon: BarChart3 },
];

// Warehouse layout — matches Odoo stock.location (KOB-WH2)
const WAREHOUSE_LAYOUT = {
    A: { racks: 4, positions: 8 },
    B: { racks: 4, positions: 8 },
    C: { racks: 4, positions: 8 },
    D: { racks: 4, positions: 10 },
    E: { racks: 4, positions: 10 },
    F: { racks: 4, positions: 10 },
    G: { racks: 4, positions: 10 },
    H: { racks: 4, positions: 10 },
    I: { racks: 4, positions: 10 },
};

// ── Utility functions ──────────────────────────────────────────────────────

function parseLocation(loc) {
    if (!loc) return null;
    if (/^FLG-\d+$/.test(loc)) return { zone: 'FLG', rack: 0, position: parseInt(loc.split('-')[1], 10) };
    if (/^FLFG/.test(loc)) return { zone: 'FLG', rack: 0, position: 0 };
    if (/PICKFACE/.test(loc)) return { zone: 'PF', rack: 0, position: 1 };
    const parts = loc.split('-');
    if (parts.length === 3) {
        if (/\d/.test(parts[0])) {
            const zoneRack = parts[1];
            return { zone: zoneRack.replace(/\d+/g, ''), rack: parseInt(zoneRack.replace(/\D/g, ''), 10), position: parseInt(parts[2], 10), prefix: parts[0] };
        }
        return { zone: parts[0], rack: parseInt(parts[1], 10), position: parseInt(parts[2], 10) };
    }
    return null;
}

function buildZoneRackStructure(inventory) {
    const zones = {};
    // Generate all bins
    Object.entries(WAREHOUSE_LAYOUT).forEach(([zone, cfg]) => {
        zones[zone] = {};
        for (let r = 1; r <= cfg.racks; r++) {
            zones[zone][r] = {};
            for (let p = 1; p <= cfg.positions; p++) {
                const loc = `K2-${zone}${String(r).padStart(2, '0')}-${String(p).padStart(2, '0')}`;
                zones[zone][r][p] = { sku: '', location: loc, name: '', barcode: '', brand: '' };
            }
        }
    });
    zones['FLG'] = { 0: {} };
    for (let p = 1; p <= 10; p++) zones['FLG'][0][p] = { sku: '', location: `FLG-${String(p).padStart(2, '0')}`, name: '', barcode: '', brand: '' };
    zones['PF'] = { 0: { 1: { sku: '', location: 'PICKFACE', name: 'Pick Face Zone', barcode: '', brand: '' } } };

    // Overlay PRODUCT_CATALOG
    Object.entries(PRODUCT_CATALOG).forEach(([sku, product]) => {
        const parsed = parseLocation(product.location);
        if (!parsed) return;
        const { zone, rack, position } = parsed;
        if (zones[zone]?.[rack]?.[position]) {
            zones[zone][rack][position] = { sku, location: product.location, name: product.shortName || product.name, barcode: product.barcode, brand: product.brand };
        }
    });
    // Overlay inventory
    const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
    invItems.forEach((item) => {
        const parsed = parseLocation(item.location);
        if (!parsed) return;
        const { zone, rack, position } = parsed;
        if (zones[zone]?.[rack]?.[position] && !zones[zone][rack][position].sku) {
            zones[zone][rack][position] = { sku: item.sku || item.default_code || '', location: item.location, name: item.name || '', barcode: item.barcode || '', brand: '' };
        }
    });
    return zones;
}

function getBinStock(binId, inventory) {
    const isPF = binId?.startsWith('PF-');
    const catalogEntry = isPF ? null : Object.entries(PRODUCT_CATALOG).find(([, p]) => p.location === binId);
    const sku = catalogEntry?.[0];
    const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
    // PF bins: match by location only. Rack bins: match by location or SKU
    const item = isPF
        ? invItems.find((i) => i.location === binId)
        : invItems.find((i) => i.location === binId || i.sku === sku || i.default_code === sku);
    const qty = item?.onHand ?? item?.qty_available ?? item?.quantity ?? item?.qty ?? 0;
    const capacity = item?.capacity ?? 500;
    const pct = capacity > 0 ? Math.min((qty / capacity) * 100, 100) : 0;
    return { qty, capacity, pct, sku: sku || item?.sku || '', name: catalogEntry?.[1]?.shortName || catalogEntry?.[1]?.name || item?.name || '', barcode: catalogEntry?.[1]?.barcode || item?.barcode || '', brand: catalogEntry?.[1]?.brand || '', lots: item?.lots || [] };
}

function getStockColor(pct) {
    if (pct <= 0) return '#9ca3af';
    if (pct <= 15) return '#dc2626';
    if (pct <= 35) return '#f97316';
    if (pct <= 60) return '#eab308';
    if (pct <= 85) return '#22c55e';
    return '#16a34a';
}

function getCountColor(binId, fcs) {
    if (!fcs) return '#9ca3af';
    const e = (fcs.counts || []).find((c) => c.location === binId);
    if (!e) return '#9ca3af';
    if (e.countedQty !== null && e.variance === 0) return '#22c55e';
    if (e.countedQty !== null) return e.needsRecount ? '#dc2626' : '#eab308';
    return '#818cf8';
}

function getCountLabel(binId, fcs) {
    if (!fcs) return '--';
    const e = (fcs.counts || []).find((c) => c.location === binId);
    if (!e) return '--';
    if (e.countedQty !== null) return e.variance === 0 ? 'Match' : `${e.variance > 0 ? '+' : ''}${e.variance}`;
    return 'Pending';
}

function getFrequencyData(binId, sku, logs) {
    if (!logs?.length) return { count: 0, color: '#1e293b' };
    const count = logs.filter((l) => l.location === binId || l.binId === binId || l.details?.sku === sku).length;
    if (count === 0) return { count, color: '#1e293b' };
    if (count <= 3) return { count, color: '#3b82f6' };
    if (count <= 8) return { count, color: '#8b5cf6' };
    return { count, color: '#ec4899' };
}

// ── BinCell — single position cell (bird's eye view) ───────────────────────

function BinCell({ slot, binColor, isSelected, onClick, compact, viewMode, label }) {
    const hasSku = !!slot?.sku;
    const sz = compact ? 'w-8 h-8' : 'w-11 h-11';
    return (
        <div onClick={onClick}
            className={`${sz} rounded-sm cursor-pointer relative group/cell transition-all flex items-center justify-center
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10 scale-110' : 'hover:scale-105 hover:z-10'}
            `}
            style={{ backgroundColor: hasSku ? binColor : undefined }}
            title={slot?.location || ''}>
            {hasSku ? (
                <span className={`${compact ? 'text-[6px]' : 'text-[7px]'} font-bold text-white/90 leading-none text-center`}>
                    {label}
                </span>
            ) : (
                <div className={`${sz} rounded-sm border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center`}>
                    <span className={`${compact ? 'text-[5px]' : 'text-[6px]'} text-gray-300 dark:text-gray-600`}>
                        {slot?.location?.split('-').pop() || ''}
                    </span>
                </div>
            )}
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[9px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover/cell:opacity-100 pointer-events-none transition-opacity z-20">
                <p className="font-bold">{slot?.location}</p>
                {hasSku && <p>{slot.sku} — {slot.name}</p>}
                {!hasSku && <p className="text-emerald-300">Available</p>}
            </div>
        </div>
    );
}

// ── Main WarehouseMap Component ─────────────────────────────────────────────

export default function WarehouseMap({
    inventory, activityLogs = [], countData = null, fullCountSession = null,
    onBinClick, onCountBin, isEmbedded = false, language = 'en',
}) {
    const isEn = language === 'en';
    const [viewMode, setViewMode] = useState('stock');
    const [selectedBin, setSelectedBin] = useState(null);
    const [compact, setCompact] = useState(false);
    const [editing, setEditing] = useState(false);
    const [bgImage, setBgImage] = useState(() => localStorage.getItem('wms_map_bg') || null);
    const [bgOpacity, setBgOpacity] = useState(0.15);
    const fileRef = useRef(null);

    const zoneStructure = useMemo(() => buildZoneRackStructure(inventory), [inventory]);
    const rackZones = Object.keys(WAREHOUSE_LAYOUT).sort(); // A→I top to bottom

    // Stats
    const stats = useMemo(() => {
        let total = 0, inStock = 0, low = 0, empty = 0, available = 0;
        rackZones.forEach((z) => {
            Object.values(zoneStructure[z] || {}).forEach((rack) => {
                Object.values(rack).forEach((slot) => {
                    total++;
                    if (!slot.sku) { available++; return; }
                    const { pct } = getBinStock(slot.location, inventory);
                    if (pct <= 0) empty++;
                    else if (pct < 30) { low++; inStock++; }
                    else inStock++;
                });
            });
        });
        return { total, inStock, low, empty, available };
    }, [zoneStructure, inventory, rackZones]);

    const handleSlotClick = useCallback((slot, zone, rack, pos) => {
        const bin = { id: slot.location, zone, rack, position: pos, sku: slot.sku, ...slot };
        setSelectedBin(bin);
        onBinClick?.(bin, getBinStock(slot.location, inventory));
    }, [onBinClick, inventory]);

    const handleBgUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file || file.size > 5 * 1024 * 1024) return;
        const reader = new FileReader();
        reader.onload = (ev) => { setBgImage(ev.target.result); localStorage.setItem('wms_map_bg', ev.target.result); };
        reader.readAsDataURL(file);
    };
    const handleRemoveBg = () => { setBgImage(null); localStorage.removeItem('wms_map_bg'); };

    const detail = useMemo(() => {
        if (!selectedBin) return null;
        const stock = getBinStock(selectedBin.id, inventory);
        const freq = getFrequencyData(selectedBin.id, selectedBin.sku, activityLogs);
        const countLabel = getCountLabel(selectedBin.id, fullCountSession);
        return { stock, freq, countLabel };
    }, [selectedBin, inventory, activityLogs, fullCountSession]);

    // Get color for a bin
    const getCellColor = (loc, sku) => {
        if (!sku) return '#9ca3af';
        if (viewMode === 'stock') return getStockColor(getBinStock(loc, inventory).pct);
        if (viewMode === 'count') return getCountColor(loc, fullCountSession);
        return getFrequencyData(loc, sku, activityLogs).color;
    };
    const getCellLabel = (loc, sku) => {
        if (!sku) return '';
        if (viewMode === 'stock') { const { qty } = getBinStock(loc, inventory); return qty > 0 ? `${qty}` : '0'; }
        if (viewMode === 'count') return getCountLabel(loc, fullCountSession);
        return `${getFrequencyData(loc, sku, activityLogs).count}x`;
    };

    return (
        <div className={`flex flex-col ${isEmbedded ? 'h-full' : 'space-y-3'}`}>
            {/* ── Toolbar ── */}
            {!isEmbedded && (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Map size={18} className="text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{isEn ? 'Warehouse Map' : 'แผนผังคลัง'}</h2>
                        <span className="text-xs text-gray-400">{stats.total} bins</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                            {VIEW_MODES.map((m) => (
                                <button key={m.id} onClick={() => setViewMode(m.id)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === m.id ? 'bg-white dark:bg-gray-600 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <m.Icon size={13} /> {m.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setCompact(!compact)} title={compact ? 'Normal' : 'Compact'}
                            className={`p-1.5 rounded-lg ${compact ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        </button>
                        <button onClick={() => setEditing(!editing)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${editing ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            <Settings size={13} /> {isEn ? 'Edit' : 'แก้ไข'}
                        </button>
                    </div>
                </div>
            )}

            {isEmbedded && (
                <div className="flex items-center justify-between mb-2">
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                        {VIEW_MODES.map((m) => (
                            <button key={m.id} onClick={() => setViewMode(m.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${viewMode === m.id ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>
                                <m.Icon size={11} /> {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Editor */}
            {editing && !isEmbedded && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl p-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs font-medium hover:bg-gray-50 text-gray-700">
                            <Upload size={13} /> {isEn ? 'Upload Floor Plan' : 'อัปโหลดแบบแปลน'}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                        {bgImage && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500">Opacity:</span>
                                    <input type="range" min="5" max="50" value={bgOpacity * 100} onChange={(e) => setBgOpacity(e.target.value / 100)} className="w-20 h-1" />
                                </div>
                                <button onClick={handleRemoveBg} className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                                    <Trash2 size={12} /> {isEn ? 'Remove' : 'ลบ'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Stats */}
            {!isEmbedded && (
                <div className="grid grid-cols-5 gap-2">
                    {[
                        { val: stats.total, label: isEn ? 'Total' : 'ทั้งหมด', color: 'text-gray-900 dark:text-gray-100' },
                        { val: stats.inStock, label: isEn ? 'In Stock' : 'มีสต็อค', color: 'text-green-600' },
                        { val: stats.low, label: isEn ? 'Low Stock' : 'สต็อคต่ำ', color: 'text-orange-600' },
                        { val: stats.empty, label: isEn ? 'Empty' : 'หมด', color: 'text-red-500' },
                        { val: stats.available, label: isEn ? 'Available' : 'ว่าง', color: 'text-emerald-500' },
                    ].map((s) => (
                        <div key={s.label} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-2 text-center">
                            <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                            <p className="text-[10px] text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Floor Plan View ── */}
            <div className={`flex gap-3 ${isEmbedded ? 'flex-1 overflow-hidden' : ''}`}>

                {/* ── Pick Face Shelf (Left) — vertical standing shelves like blueprint ── */}
                <div className={`bg-amber-50/80 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-700 rounded-xl p-4 overflow-auto shrink-0 self-end ${isEmbedded ? '' : 'max-h-[640px]'}`}>
                    <div className="text-center mb-3 pb-2 border-b-2 border-amber-300 dark:border-amber-700">
                        <span className="text-xs font-black text-stone-700 dark:text-stone-300 uppercase tracking-[0.2em]">Pick Face Zone</span>
                    </div>
                    {/* 5 shelf units side by side: A (left) → E (right) */}
                    <div className="flex gap-4">
                        {['A', 'B', 'C', 'D', 'E'].map((zone) => (
                            <div key={zone} className="flex flex-col items-center">
                                {/* Zone label on top */}
                                <span className="w-7 h-7 rounded flex items-center justify-center text-white text-[11px] font-black shadow mb-1.5"
                                    style={{ backgroundColor: ZONE_COLORS[zone] || '#6b7280' }}>{zone}</span>
                                {/* Shelf unit: 5 depth columns × 10 bins tall */}
                                <div className="relative bg-stone-200/60 dark:bg-stone-800/40 rounded-sm p-[2px]">
                                    {/* Vertical uprights (left + right) */}
                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-sm z-10" style={{ backgroundColor: '#78716c' }} />
                                    <div className="absolute right-0 top-0 bottom-0 w-[3px] rounded-sm z-10" style={{ backgroundColor: '#78716c' }} />
                                    {/* 5 columns (shelves 1-5 = depth) with dividers */}
                                    <div className="flex px-[3px]">
                                        {[5, 4, 3, 2, 1].map((shelf, si) => (
                                            <React.Fragment key={shelf}>
                                                {/* Vertical divider between shelves */}
                                                {si > 0 && <div className="w-[2px] shrink-0 my-[1px]" style={{ backgroundColor: '#a8a29e' }} />}
                                                {/* Column of 10 bins (top=01, bottom=10) */}
                                                <div className="flex flex-col gap-[1px] py-[1px]">
                                                    {Array.from({ length: 10 }, (_, bi) => {
                                                        const binNum = bi + 1;
                                                        const binId = `PF-${zone}${shelf}-${String(binNum).padStart(2, '0')}`;
                                                        const stock = getBinStock(binId, inventory);
                                                        const hasSku = !!stock.sku;
                                                        const color = hasSku ? getStockColor(stock.pct) : undefined;
                                                        return (
                                                            <div key={binNum}
                                                                onClick={() => {
                                                                    const slot = { sku: stock.sku, location: binId, name: stock.name, barcode: stock.barcode, brand: stock.brand };
                                                                    handleSlotClick(slot, zone, shelf, binNum);
                                                                }}
                                                                className={`w-8 h-8 rounded cursor-pointer relative group/pf transition-all flex items-center justify-center
                                                                    ${selectedBin?.id === binId ? 'ring-2 ring-blue-500 z-10 scale-110' : 'hover:scale-105 hover:z-10'}`}
                                                                style={{
                                                                    backgroundColor: hasSku ? color : '#d6d3d1',
                                                                    boxShadow: hasSku
                                                                        ? 'inset 0 -3px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)'
                                                                        : 'inset 0 1px 3px rgba(0,0,0,0.06)',
                                                                    borderRadius: '4px',
                                                                }}
                                                                title={binId}>
                                                                {hasSku && <span className="text-[7px] font-bold text-white drop-shadow-sm">{stock.qty}</span>}
                                                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-[9px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover/pf:opacity-100 pointer-events-none transition-opacity z-30">
                                                                    <p className="font-bold">{binId}</p>
                                                                    {hasSku ? <p>{stock.sku} — {stock.qty}pcs</p> : <p className="text-emerald-300">Empty</p>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    {/* Base/feet */}
                                    <div className="h-[4px] rounded-b-sm mt-[1px] -mx-[1px]" style={{ backgroundColor: '#78716c' }} />
                                </div>
                                {/* Shelf depth label */}
                                <span className="mt-1 text-[6px] text-stone-400 font-mono font-bold">5 → 1</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Rack Grid (Right) ── */}
                <div className={`bg-slate-50 dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-4 overflow-auto relative ${isEmbedded ? '' : 'max-h-[640px]'}`}>
                    {/* Background image */}
                    {bgImage && (
                        <img src={bgImage} alt="Floor plan" className="absolute inset-0 w-full h-full object-contain pointer-events-none" style={{ opacity: bgOpacity }} />
                    )}

                    {/* Warehouse floor layout */}
                    <div className="relative z-10 space-y-1">
                        {/* Column numbers header */}
                        <div className="flex items-end gap-0.5 pl-14 mb-1">
                            {Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className={`${compact ? 'w-8' : 'w-11'} text-center text-[8px] text-gray-400 font-mono`}>
                                    {String(i + 1).padStart(2, '0')}
                                </div>
                            ))}
                        </div>

                        {/* Rack rows — each rack is a horizontal row */}
                        {rackZones.map((zone) => {
                            const racks = zoneStructure[zone];
                            const sortedRacks = Object.keys(racks).map(Number).sort((a, b) => b - a); // 04→01 top to bottom (01 at bottom near Pick Face)
                            const cfg = WAREHOUSE_LAYOUT[zone];

                            return (
                                <div key={zone} className="space-y-0.5">
                                    {sortedRacks.map((rackNum, ri) => {
                                        const positions = racks[rackNum];
                                        const rackId = `${zone}${String(rackNum).padStart(2, '0')}`;
                                        return (
                                            <div key={rackId} className="flex items-center gap-1">
                                                {/* Rack label */}
                                                <div className={`${compact ? 'w-12' : 'w-14'} shrink-0 flex items-center gap-1`}>
                                                    <div className="w-4 h-4 rounded-sm flex items-center justify-center text-white text-[7px] font-black shrink-0"
                                                        style={{ backgroundColor: ZONE_COLORS[zone] || '#6b7280' }}>
                                                        {zone}
                                                    </div>
                                                    <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-mono font-bold text-gray-500 dark:text-gray-400`}>
                                                        {rackId}
                                                    </span>
                                                </div>

                                                {/* Position cells — horizontal row */}
                                                <div className="flex gap-0.5">
                                                    {Array.from({ length: cfg.positions }, (_, pi) => {
                                                        const pos = pi + 1;
                                                        const slot = positions[pos] || null;
                                                        const loc = slot?.location || '';
                                                        const color = getCellColor(loc, slot?.sku);
                                                        const label = getCellLabel(loc, slot?.sku);

                                                        return (
                                                            <BinCell key={pos} slot={slot} binColor={color}
                                                                isSelected={selectedBin?.id === loc}
                                                                onClick={() => slot && handleSlotClick(slot, zone, rackNum, pos)}
                                                                compact={compact} viewMode={viewMode} label={label} />
                                                        );
                                                    })}
                                                </div>

                                                {/* Rack fill indicator */}
                                                <div className={`${compact ? 'text-[7px]' : 'text-[8px]'} text-gray-400 ml-1 tabular-nums`}>
                                                    {Object.values(positions).filter(s => s.sku).length}/{cfg.positions}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {/* Zone separator */}
                                    <div className="h-1" />
                                </div>
                            );
                        })}

                        {/* Special areas at bottom */}
                        <div className="flex gap-4 mt-3 pt-3 border-t border-dashed border-gray-300 dark:border-gray-700">
                            {/* Pick Face Zone */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-white text-[8px] font-black">PF</div>
                                <div>
                                    <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Pick Face Zone</p>
                                    <p className="text-[8px] text-amber-600 dark:text-amber-400">PICKFACE</p>
                                </div>
                            </div>

                            {/* Floor Ground */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 dark:bg-stone-900/20 border border-stone-200 dark:border-stone-800 rounded-lg">
                                    <div className="w-5 h-5 rounded bg-stone-500 flex items-center justify-center text-white text-[8px] font-black">FL</div>
                                    <div>
                                        <p className="text-[10px] font-bold text-stone-700 dark:text-stone-300">Floor Ground</p>
                                        <p className="text-[8px] text-stone-500 dark:text-stone-400">FLG-01 ~ FLG-10</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Detail Modal Popup ── */}
                {selectedBin && detail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) setSelectedBin(null); }}>
                        {/* Backdrop blur */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        {/* Modal content */}
                        <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700"
                                style={{ backgroundColor: (ZONE_COLORS[selectedBin.zone] || '#6b7280') + '15' }}>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-black" style={{ backgroundColor: ZONE_COLORS[selectedBin.zone] || '#6b7280' }}>{selectedBin.zone}</span>
                                    <span className="font-bold text-base text-gray-800 dark:text-gray-100">{selectedBin.id}</span>
                                </div>
                                <button onClick={() => setSelectedBin(null)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 transition-colors"><X size={18} /></button>
                            </div>
                            {/* Body */}
                            <div className="p-5 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
                                {detail.stock.sku ? (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{isEn ? 'Product' : 'สินค้า'}</p>
                                        <p className="text-gray-800 dark:text-gray-100 font-semibold text-base">{detail.stock.name}</p>
                                        <p className="text-gray-500 font-mono text-xs">SKU: {detail.stock.sku}</p>
                                        {detail.stock.barcode && <p className="text-gray-500 font-mono text-xs">Barcode: {detail.stock.barcode}</p>}
                                        {detail.stock.brand && <p className="text-gray-500 text-xs">Brand: {detail.stock.brand}</p>}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-emerald-500 font-bold text-lg">Available</p>
                                        <p className="text-xs text-gray-400 mt-1">{isEn ? 'This bin is empty and ready for use' : 'ช่องนี้ว่างพร้อมใช้งาน'}</p>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{isEn ? 'Stock Level' : 'ระดับสต็อค'}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-700 dark:text-gray-200 font-medium">{detail.stock.qty} / {detail.stock.capacity}</span>
                                        <span className="font-bold text-lg" style={{ color: getStockColor(detail.stock.pct) }}>{Math.round(detail.stock.pct)}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${detail.stock.pct}%`, backgroundColor: getStockColor(detail.stock.pct) }} />
                                    </div>
                                </div>
                                {detail.stock.lots?.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{isEn ? 'Lots' : 'ล็อต'}</p>
                                        {detail.stock.lots.map((lot, i) => (
                                            <div key={i} className="flex justify-between bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 text-xs">
                                                <span className="font-mono">{lot.lotNumber || `Lot ${i + 1}`}</span>
                                                <span className="font-semibold">{lot.qty ?? '-'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{isEn ? 'Pick Frequency' : 'ความถี่หยิบ'}</p>
                                        <p className="text-gray-700 dark:text-gray-200 font-semibold">{detail.freq.count} picks</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{isEn ? 'Count Status' : 'สถานะนับ'}</p>
                                        <p className="text-gray-700 dark:text-gray-200 font-semibold">{detail.countLabel}</p>
                                    </div>
                                </div>
                                {onCountBin && (
                                    <button onClick={() => onCountBin(selectedBin, detail.stock)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors mt-2">
                                        <ClipboardCheck size={16} /> {isEn ? 'Count This Bin' : 'นับ Bin นี้'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 px-1 pt-1 flex-wrap">
                <span className="font-semibold">Legend:</span>
                {viewMode === 'stock' && [
                    { c: '#9ca3af', l: 'Empty' }, { c: '#dc2626', l: '0-15%' }, { c: '#f97316', l: '16-35%' },
                    { c: '#eab308', l: '36-60%' }, { c: '#22c55e', l: '61-85%' }, { c: '#16a34a', l: '86-100%' },
                ].map((i) => (
                    <span key={i.l} className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: i.c }} />{i.l}
                    </span>
                ))}
                {viewMode === 'count' && [
                    { c: '#22c55e', l: 'Match' }, { c: '#eab308', l: 'Variance' }, { c: '#dc2626', l: 'Recount' },
                    { c: '#818cf8', l: 'Pending' }, { c: '#9ca3af', l: 'Not Counted' },
                ].map((i) => (
                    <span key={i.l} className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: i.c }} />{i.l}
                    </span>
                ))}
                {viewMode === 'frequency' && [
                    { c: '#1e293b', l: 'None' }, { c: '#3b82f6', l: 'Low' },
                    { c: '#8b5cf6', l: 'Medium' }, { c: '#ec4899', l: 'High' },
                ].map((i) => (
                    <span key={i.l} className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: i.c }} />{i.l}
                    </span>
                ))}
                <span className="flex items-center gap-1 ml-2">
                    <span className="w-3 h-3 rounded-sm inline-block border border-dashed border-gray-300 bg-gray-50" />Available
                </span>
            </div>
        </div>
    );
}
