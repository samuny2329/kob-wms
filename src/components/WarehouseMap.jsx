import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    Map, Upload, Save, Edit3, Package, BarChart3, ClipboardCheck, X,
    ChevronRight, ChevronDown, MapPin, Trash2, Settings, RotateCcw, Minimize2, Maximize2,
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

// ── Utility functions (unchanged) ───────────────────────────────────────────

function parseLocation(loc) {
    if (!loc) return null;
    if (/^FLG-\d+$/.test(loc)) return { zone: 'FLG', rack: 0, position: parseInt(loc.split('-')[1], 10) };
    if (/^FLFG/.test(loc)) return { zone: 'FLG', rack: 0, position: 0 };
    if (/PICKFACE/.test(loc)) return { zone: 'PF', rack: 0, position: 1 };
    const parts = loc.split('-');
    if (parts.length === 3) {
        if (/\d/.test(parts[0])) {
            const zoneRack = parts[1];
            const zone = zoneRack.replace(/\d+/g, '');
            const rack = parseInt(zoneRack.replace(/\D/g, ''), 10);
            const position = parseInt(parts[2], 10);
            return { zone, rack, position, prefix: parts[0] };
        }
        return { zone: parts[0], rack: parseInt(parts[1], 10), position: parseInt(parts[2], 10) };
    }
    return null;
}

function buildZoneRackStructure(inventory) {
    const zones = {};
    Object.entries(PRODUCT_CATALOG).forEach(([sku, product]) => {
        const parsed = parseLocation(product.location);
        if (!parsed) return;
        const { zone, rack, position } = parsed;
        if (!zones[zone]) zones[zone] = {};
        if (!zones[zone][rack]) zones[zone][rack] = {};
        zones[zone][rack][position] = {
            sku, location: product.location,
            name: product.shortName || product.name,
            barcode: product.barcode, brand: product.brand,
        };
    });
    const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
    invItems.forEach((item) => {
        const parsed = parseLocation(item.location);
        if (!parsed) return;
        const { zone, rack, position } = parsed;
        if (!zones[zone]) zones[zone] = {};
        if (!zones[zone][rack]) zones[zone][rack] = {};
        if (!zones[zone][rack][position]) {
            zones[zone][rack][position] = {
                sku: item.sku || item.default_code || '', location: item.location,
                name: item.name || item.sku || '', barcode: item.barcode || '', brand: '',
            };
        }
    });
    return zones;
}

function getBinStock(binId, inventory) {
    const catalogEntry = Object.entries(PRODUCT_CATALOG).find(([, p]) => p.location === binId);
    const sku = catalogEntry?.[0];
    const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
    const item = invItems.find((i) => i.location === binId || i.sku === sku || i.default_code === sku);
    const qty = item?.onHand ?? item?.qty_available ?? item?.quantity ?? item?.qty ?? 0;
    const capacity = item?.capacity ?? 500;
    const pct = capacity > 0 ? Math.min((qty / capacity) * 100, 100) : 0;
    return {
        qty, capacity, pct, sku: sku || item?.sku || '',
        name: catalogEntry?.[1]?.shortName || catalogEntry?.[1]?.name || item?.name || '',
        barcode: catalogEntry?.[1]?.barcode || item?.barcode || '',
        brand: catalogEntry?.[1]?.brand || '',
        lots: item?.lots || [],
    };
}

function getStockColor(pct) {
    if (pct <= 0) return '#6b7280';
    if (pct <= 15) return '#dc2626';
    if (pct <= 35) return '#f97316';
    if (pct <= 60) return '#eab308';
    if (pct <= 85) return '#22c55e';
    return '#16a34a';
}

function getCountColor(binId, fullCountSession) {
    if (!fullCountSession) return '#6b7280';
    const entry = (fullCountSession.counts || []).find((c) => c.location === binId);
    if (!entry) return '#6b7280';
    if (entry.countedQty !== null && entry.variance === 0) return '#22c55e';
    if (entry.countedQty !== null) return entry.needsRecount ? '#dc2626' : '#eab308';
    return '#818cf8';
}

function getCountLabel(binId, fullCountSession) {
    if (!fullCountSession) return '--';
    const entry = (fullCountSession.counts || []).find((c) => c.location === binId);
    if (!entry) return '--';
    if (entry.countedQty !== null) return entry.variance === 0 ? 'Match' : `${entry.variance > 0 ? '+' : ''}${entry.variance}`;
    return 'Pending';
}

function getFrequencyData(binId, sku, activityLogs) {
    if (!activityLogs?.length) return { count: 0, color: '#1e293b' };
    const count = activityLogs.filter(
        (l) => l.location === binId || l.binId === binId || l.details?.sku === sku
    ).length;
    if (count === 0) return { count, color: '#1e293b' };
    if (count <= 3) return { count, color: '#3b82f6' };
    if (count <= 8) return { count, color: '#8b5cf6' };
    return { count, color: '#ec4899' };
}

// ── SlotRow Component ──────────────────────────────────────────────────────

function SlotRow({ pos, slot, stock, color, label, isSelected, onClick, compact }) {
    const isEmpty = !slot?.sku;
    const h = compact ? 'h-7' : 'h-9';
    return (
        <div onClick={onClick}
            className={`flex items-center gap-1.5 px-2 ${h} cursor-pointer border-l-[3px] transition-all
                ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-blue-500 ring-1 ring-blue-300' :
                    isEmpty ? 'border-l-gray-200 dark:border-l-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50' :
                    'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
            `}
            style={!isSelected && !isEmpty ? { borderLeftColor: color } : undefined}>
            {/* Position number */}
            <span className={`${compact ? 'w-4 text-[9px]' : 'w-5 text-[10px]'} font-mono text-gray-400 dark:text-gray-500 shrink-0 text-center`}>
                {String(pos).padStart(2, '0')}
            </span>

            {isEmpty ? (
                <span className="flex-1 text-[10px] text-gray-300 dark:text-gray-600 italic">empty</span>
            ) : (
                <>
                    {/* SKU */}
                    <span className={`${compact ? 'w-16 text-[9px]' : 'w-20 text-[10px]'} font-mono font-semibold text-gray-700 dark:text-gray-200 truncate shrink-0`}>
                        {slot.sku}
                    </span>
                    {/* Stock bar */}
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mx-1">
                        <div className="h-full rounded-full transition-all" style={{ width: `${stock.pct}%`, backgroundColor: color }} />
                    </div>
                    {/* Label (qty / count / freq) */}
                    <span className={`${compact ? 'w-8 text-[9px]' : 'w-10 text-[10px]'} text-right font-medium shrink-0`}
                        style={{ color }}>
                        {label}
                    </span>
                </>
            )}
        </div>
    );
}

// ── RackCard Component ─────────────────────────────────────────────────────

function RackCard({ zone, rackNum, positions, inventory, viewMode, fullCountSession, activityLogs, selectedBin, onSlotClick, compact }) {
    const sortedPositions = Object.keys(positions).map(Number).sort((a, b) => a - b);
    const maxPos = sortedPositions.length > 0 ? Math.max(...sortedPositions) : 0;
    const allPositions = [];
    for (let p = 1; p <= Math.max(maxPos, 1); p++) allPositions.push(p);

    const rackLabel = zone === 'FLG' ? 'Floor' : zone === 'PF' ? 'Pickface' : `${zone}${String(rackNum).padStart(2, '0')}`;

    return (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Rack header */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b dark:border-gray-700"
                style={{ backgroundColor: (ZONE_COLORS[zone] || '#6b7280') + '12' }}>
                <div className="w-2 h-full min-h-[16px] rounded-sm" style={{ backgroundColor: ZONE_COLORS[zone] || '#6b7280' }} />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100">Rack {rackLabel}</span>
                <span className="text-[9px] text-gray-400 ml-auto">{sortedPositions.length} slots</span>
            </div>
            {/* Position rows */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {allPositions.map((pos) => {
                    const slot = positions[pos] || null;
                    const binId = slot?.location || '';
                    const stock = slot ? getBinStock(binId, inventory) : { qty: 0, capacity: 0, pct: 0 };
                    let color = '#6b7280';
                    let label = '';
                    if (viewMode === 'stock') { color = getStockColor(stock.pct); label = stock.qty > 0 ? `${stock.qty}` : ''; }
                    else if (viewMode === 'count') { color = getCountColor(binId, fullCountSession); label = getCountLabel(binId, fullCountSession); }
                    else { const f = getFrequencyData(binId, slot?.sku, activityLogs); color = f.color; label = f.count > 0 ? `${f.count}x` : ''; }

                    return (
                        <SlotRow key={pos} pos={pos} slot={slot} stock={stock} color={color} label={label}
                            isSelected={selectedBin?.id === binId}
                            onClick={() => slot && onSlotClick({ id: binId, zone, rack: rackNum, position: pos, sku: slot.sku, ...slot })}
                            compact={compact} />
                    );
                })}
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
    const [collapsedZones, setCollapsedZones] = useState({});

    const toggleZone = (z) => setCollapsedZones((prev) => ({ ...prev, [z]: !prev[z] }));

    // Build zone → rack → position structure
    const zoneStructure = useMemo(() => buildZoneRackStructure(inventory), [inventory]);
    const sortedZones = useMemo(() => Object.keys(zoneStructure).sort(), [zoneStructure]);

    // Flat bin list for stats
    const allBins = useMemo(() => {
        const bins = [];
        sortedZones.forEach((z) => {
            Object.entries(zoneStructure[z]).forEach(([rack, positions]) => {
                Object.entries(positions).forEach(([pos, slot]) => {
                    bins.push({ ...slot, zone: z, rack: Number(rack), position: Number(pos) });
                });
            });
        });
        return bins;
    }, [zoneStructure, sortedZones]);

    // Stats
    const stats = useMemo(() => {
        let total = allBins.length, inStock = 0, low = 0, empty = 0;
        allBins.forEach((b) => {
            const { pct } = getBinStock(b.location, inventory);
            if (pct <= 0) empty++;
            else if (pct < 30) { low++; inStock++; }
            else inStock++;
        });
        return { total, inStock, low, empty };
    }, [allBins, inventory]);

    // Bin click handler
    const handleSlotClick = useCallback((bin) => {
        setSelectedBin(bin);
        onBinClick?.(bin, getBinStock(bin.id, inventory));
    }, [onBinClick, inventory]);

    // Background upload
    const handleBgUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file || file.size > 5 * 1024 * 1024) return;
        const reader = new FileReader();
        reader.onload = (ev) => { setBgImage(ev.target.result); localStorage.setItem('wms_map_bg', ev.target.result); };
        reader.readAsDataURL(file);
    };
    const handleRemoveBg = () => { setBgImage(null); localStorage.removeItem('wms_map_bg'); };

    // Detail data
    const detail = useMemo(() => {
        if (!selectedBin) return null;
        const stock = getBinStock(selectedBin.id, inventory);
        const freq = getFrequencyData(selectedBin.id, selectedBin.sku, activityLogs);
        const countLabel = getCountLabel(selectedBin.id, fullCountSession);
        return { stock, freq, countLabel };
    }, [selectedBin, inventory, activityLogs, fullCountSession]);

    return (
        <div className={`flex flex-col ${isEmbedded ? 'h-full' : 'space-y-3'}`}>
            {/* ── Toolbar ── */}
            {!isEmbedded && (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Map size={18} className="text-blue-600 dark:text-blue-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {isEn ? 'Warehouse Map' : 'แผนผังคลัง'}
                        </h2>
                        <span className="text-xs text-gray-400">{stats.total} bins</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                            {VIEW_MODES.map((m) => (
                                <button key={m.id} onClick={() => setViewMode(m.id)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                        viewMode === m.id ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                                    <m.Icon size={13} /> {m.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setCompact(!compact)}
                            className={`p-1.5 rounded-lg text-xs ${compact ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}
                            title={compact ? 'Normal view' : 'Compact view'}>
                            {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        </button>
                        <button onClick={() => setEditing(!editing)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${editing ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}>
                            <Settings size={13} /> {isEn ? 'Edit' : 'แก้ไข'}
                        </button>
                    </div>
                </div>
            )}

            {/* Embedded: compact toggle */}
            {isEmbedded && (
                <div className="flex items-center justify-between mb-2">
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                        {VIEW_MODES.map((m) => (
                            <button key={m.id} onClick={() => setViewMode(m.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${viewMode === m.id ? 'bg-white dark:bg-gray-600 shadow text-blue-700' : 'text-gray-500'}`}>
                                <m.Icon size={11} /> {m.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setCompact(!compact)} className="p-1 text-gray-400 hover:text-gray-600">
                        {compact ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                    </button>
                </div>
            )}

            {/* ── Editor Panel ── */}
            {editing && !isEmbedded && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-2">
                    <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <Edit3 size={13} /> {isEn ? 'Layout Editor' : 'แก้ไข Layout'}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 text-gray-700 dark:text-gray-200">
                            <Upload size={13} /> {isEn ? 'Upload Floor Plan' : 'อัปโหลดแบบแปลน'}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                        {bgImage && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500">Opacity:</span>
                                    <input type="range" min="5" max="50" value={bgOpacity * 100}
                                        onChange={(e) => setBgOpacity(e.target.value / 100)} className="w-20 h-1" />
                                    <span className="text-[10px] text-gray-400">{Math.round(bgOpacity * 100)}%</span>
                                </div>
                                <button onClick={handleRemoveBg} className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                                    <Trash2 size={12} /> {isEn ? 'Remove' : 'ลบ'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Stats Bar ── */}
            {!isEmbedded && (
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { val: stats.total, label: isEn ? 'Total Bins' : 'ทั้งหมด', color: 'text-gray-900 dark:text-gray-100' },
                        { val: stats.inStock, label: isEn ? 'In Stock' : 'มีสต็อค', color: 'text-green-600' },
                        { val: stats.low, label: isEn ? 'Low Stock' : 'สต็อคต่ำ', color: 'text-orange-600' },
                        { val: stats.empty, label: isEn ? 'Empty' : 'ว่าง', color: 'text-gray-400' },
                    ].map((s) => (
                        <div key={s.label} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-2.5 text-center">
                            <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                            <p className="text-[10px] text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Main: Rack Shelf View + Detail Panel ── */}
            <div className={`flex gap-3 ${isEmbedded ? 'flex-1 overflow-hidden' : ''}`}>
                {/* Scrollable rack area */}
                <div className={`flex-1 overflow-y-auto space-y-4 ${isEmbedded ? '' : 'max-h-[600px]'} pr-1 relative`}
                    style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } : undefined}>
                    {bgImage && <div className="absolute inset-0 bg-white/85 dark:bg-gray-900/85 pointer-events-none" style={{ opacity: 1 - bgOpacity }} />}

                    {sortedZones.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm">{isEn ? 'No locations configured' : 'ยังไม่มีตำแหน่ง'}</p>
                        </div>
                    )}

                    {sortedZones.map((zone) => {
                        const racks = zoneStructure[zone];
                        const sortedRacks = Object.keys(racks).map(Number).sort((a, b) => a - b);
                        const totalSlots = Object.values(racks).reduce((sum, r) => sum + Object.keys(r).length, 0);
                        const isCollapsed = collapsedZones[zone];

                        return (
                            <div key={zone} className="relative z-10">
                                {/* Zone header */}
                                <button onClick={() => toggleZone(zone)}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors mb-2">
                                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                                        style={{ backgroundColor: ZONE_COLORS[zone] || '#6b7280' }}>
                                        {zone}
                                    </div>
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                        Zone {zone}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {sortedRacks.length} rack{sortedRacks.length > 1 ? 's' : ''} · {totalSlots} slots
                                    </span>
                                    <ChevronDown size={14} className={`ml-auto text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                </button>

                                {/* Racks grid */}
                                {!isCollapsed && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pl-2">
                                        {sortedRacks.map((rackNum) => (
                                            <RackCard key={`${zone}-${rackNum}`}
                                                zone={zone} rackNum={rackNum} positions={racks[rackNum]}
                                                inventory={inventory} viewMode={viewMode}
                                                fullCountSession={fullCountSession} activityLogs={activityLogs}
                                                selectedBin={selectedBin} onSlotClick={handleSlotClick}
                                                compact={compact} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Detail Side Panel ── */}
                {selectedBin && detail && (
                    <div className="w-64 border dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl overflow-y-auto flex-shrink-0 self-start sticky top-0">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: ZONE_COLORS[selectedBin.zone] || '#6b7280' }} />
                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{selectedBin.id}</span>
                            </div>
                            <button onClick={() => setSelectedBin(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X size={14} /></button>
                        </div>
                        <div className="p-3 space-y-3 text-xs">
                            {detail.stock.sku && (
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{isEn ? 'Product' : 'สินค้า'}</p>
                                    <p className="text-gray-800 dark:text-gray-100 font-medium">{detail.stock.name}</p>
                                    <p className="text-gray-500">SKU: {detail.stock.sku}</p>
                                    {detail.stock.barcode && <p className="text-gray-500">Barcode: {detail.stock.barcode}</p>}
                                    {detail.stock.brand && <p className="text-gray-500">Brand: {detail.stock.brand}</p>}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{isEn ? 'Stock Level' : 'ระดับสต็อค'}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-700 dark:text-gray-200">{detail.stock.qty} / {detail.stock.capacity}</span>
                                    <span className="font-bold" style={{ color: getStockColor(detail.stock.pct) }}>{Math.round(detail.stock.pct)}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${detail.stock.pct}%`, backgroundColor: getStockColor(detail.stock.pct) }} />
                                </div>
                            </div>
                            {detail.stock.lots?.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{isEn ? 'Lots' : 'ล็อต'}</p>
                                    {detail.stock.lots.map((lot, i) => (
                                        <div key={i} className="flex justify-between bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                            <span>{lot.lotNumber || lot.lot_id?.[1] || `Lot ${i + 1}`}</span>
                                            <span>{lot.qty ?? lot.quantity ?? '-'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{isEn ? 'Pick Frequency' : 'ความถี่หยิบ'}</p>
                                <p className="text-gray-700 dark:text-gray-200">{detail.freq.count} picks</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{isEn ? 'Count Status' : 'สถานะนับ'}</p>
                                <p className="text-gray-700 dark:text-gray-200">{detail.countLabel}</p>
                            </div>
                            <div className="pt-2 space-y-1.5 border-t dark:border-gray-700">
                                {onCountBin && (
                                    <button onClick={() => onCountBin(selectedBin, detail.stock)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
                                        <ClipboardCheck size={13} /> {isEn ? 'Count This Bin' : 'นับ Bin นี้'}
                                    </button>
                                )}
                                {onBinClick && (
                                    <button onClick={() => onBinClick(selectedBin, detail.stock)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium">
                                        <ChevronRight size={13} /> {isEn ? 'View Details' : 'ดูรายละเอียด'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Legend Bar ── */}
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 px-1 pt-1">
                <span className="font-semibold">Legend:</span>
                {viewMode === 'stock' && [
                    { c: '#6b7280', l: 'Empty' }, { c: '#dc2626', l: '0-15%' }, { c: '#f97316', l: '16-35%' },
                    { c: '#eab308', l: '36-60%' }, { c: '#22c55e', l: '61-85%' }, { c: '#16a34a', l: '86-100%' },
                ].map((i) => (
                    <span key={i.l} className="flex items-center gap-1">
                        <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: i.c }} />{i.l}
                    </span>
                ))}
                {viewMode === 'count' && [
                    { c: '#22c55e', l: 'Match' }, { c: '#eab308', l: 'Variance' }, { c: '#dc2626', l: 'Recount' },
                    { c: '#818cf8', l: 'Pending' }, { c: '#6b7280', l: 'Not Counted' },
                ].map((i) => (
                    <span key={i.l} className="flex items-center gap-1">
                        <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: i.c }} />{i.l}
                    </span>
                ))}
                {viewMode === 'frequency' && [
                    { c: '#1e293b', l: 'None' }, { c: '#3b82f6', l: 'Low (1-3)' },
                    { c: '#8b5cf6', l: 'Med (4-8)' }, { c: '#ec4899', l: 'High (9+)' },
                ].map((i) => (
                    <span key={i.l} className="flex items-center gap-1">
                        <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: i.c }} />{i.l}
                    </span>
                ))}
            </div>
        </div>
    );
}
