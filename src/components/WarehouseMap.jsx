import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Map, ZoomIn, ZoomOut, RotateCcw, Upload, Save, Edit3,
    Package, BarChart3, ClipboardCheck, X, Maximize2,
    ChevronRight, MapPin, Trash2, Settings,
} from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';

const ZONE_COLORS = {
    A: '#dc2626', B: '#d97706', C: '#2563eb', D: '#16a34a',
    E: '#9333ea', F: '#e11d48', G: '#0891b2', H: '#65a30d',
};

const VIEW_MODES = [
    { id: 'stock', label: 'Stock Level', Icon: Package },
    { id: 'count', label: 'Count Status', Icon: ClipboardCheck },
    { id: 'frequency', label: 'Pick Frequency', Icon: BarChart3 },
];

const CELL_W = 72;
const CELL_H = 52;
const GAP = 8;
const RACK_GAP = 28;
const ZONE_GAP = 56;

// ── Utility functions ───────────────────────────────────────────────────────

function parseLocation(loc) {
    if (!loc) return null;
    const parts = loc.split('-');
    if (parts.length !== 3) return null;
    return { zone: parts[0], rack: parseInt(parts[1], 10), position: parseInt(parts[2], 10) };
}

function autoGenerateLayout(inventory) {
    const zones = {};

    // Build zone structure from PRODUCT_CATALOG
    Object.entries(PRODUCT_CATALOG).forEach(([sku, product]) => {
        const parsed = parseLocation(product.location);
        if (!parsed) return;
        const { zone, rack, position } = parsed;
        if (!zones[zone]) zones[zone] = {};
        if (!zones[zone][rack]) zones[zone][rack] = {};
        zones[zone][rack][position] = {
            sku, location: product.location,
            name: product.shortName || product.name,
            barcode: product.barcode,
        };
    });

    // Include bins from inventory not already in catalog
    const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
    invItems.forEach((item) => {
        const loc = item.location;
        const parsed = parseLocation(loc);
        if (!parsed) return;
        const { zone, rack, position } = parsed;
        if (!zones[zone]) zones[zone] = {};
        if (!zones[zone][rack]) zones[zone][rack] = {};
        if (!zones[zone][rack][position]) {
            zones[zone][rack][position] = {
                sku: item.sku || item.default_code || '',
                location: loc, name: item.name || item.sku || '',
                barcode: item.barcode || '',
            };
        }
    });

    // Convert to flat bin list with computed x/y positions
    const bins = [];
    const sortedZones = Object.keys(zones).sort();
    let zoneOffsetX = 24;

    sortedZones.forEach((zoneLetter) => {
        const racks = zones[zoneLetter];
        const sortedRacks = Object.keys(racks).map(Number).sort((a, b) => a - b);
        let maxRackWidth = 0;

        sortedRacks.forEach((rackNum, ri) => {
            const positions = racks[rackNum];
            const sortedPos = Object.keys(positions).map(Number).sort((a, b) => a - b);

            sortedPos.forEach((posNum, pi) => {
                const bin = positions[posNum];
                const x = zoneOffsetX + pi * (CELL_W + GAP);
                const y = 32 + ri * (CELL_H + RACK_GAP);
                bins.push({
                    ...bin, id: bin.location, zone: zoneLetter,
                    rack: rackNum, position: posNum, x, y,
                });
                maxRackWidth = Math.max(maxRackWidth, (pi + 1) * (CELL_W + GAP));
            });
        });

        zoneOffsetX += Math.max(maxRackWidth, CELL_W) + ZONE_GAP;
    });

    return bins;
}

function getBinStock(binId, inventory) {
    const catalogEntry = Object.entries(PRODUCT_CATALOG).find(([, p]) => p.location === binId);
    const sku = catalogEntry?.[0];
    // Try inventory items array
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
    if (pct <= 0)  return '#6b7280';
    if (pct <= 15) return '#dc2626';
    if (pct <= 35) return '#f97316';
    if (pct <= 60) return '#eab308';
    if (pct <= 85) return '#22c55e';
    return '#16a34a';
}

function getCountColor(binId, fullCountSession) {
    if (!fullCountSession) return '#6b7280';
    const counts = fullCountSession.counts || [];
    const entry = counts.find((c) => c.location === binId);
    if (!entry) return '#6b7280';
    if (entry.status === 'counted' && entry.variance === 0) return '#22c55e';
    if (entry.status === 'counted') return entry.needsRecount ? '#dc2626' : '#eab308';
    return '#818cf8';
}

function getCountLabel(binId, fullCountSession) {
    if (!fullCountSession) return '--';
    const counts = fullCountSession.counts || [];
    const entry = counts.find((c) => c.location === binId);
    if (!entry) return '--';
    if (entry.status === 'counted') return entry.variance === 0 ? 'OK' : `${entry.variance > 0 ? '+' : ''}${entry.variance}`;
    return 'Pending';
}

function getFrequencyData(binId, sku, activityLogs) {
    if (!activityLogs?.length) return { count: 0, color: '#1e293b' };
    const count = activityLogs.filter(
        (l) => l.location === binId || l.binId === binId ||
               l.details?.sku === sku || l.details?.barcode === sku
    ).length;
    if (count === 0) return { count, color: '#1e293b' };
    if (count <= 3) return { count, color: '#3b82f6' };
    if (count <= 8) return { count, color: '#8b5cf6' };
    return { count, color: '#ec4899' };
}

// ── BinCell SVG component ───────────────────────────────────────────────────

function BinCell({ bin, color, isSelected, onClick, label }) {
    return (
        <g onClick={() => onClick(bin)} className="cursor-pointer" role="button" tabIndex={0}>
            <rect
                x={bin.x} y={bin.y} width={CELL_W} height={CELL_H} rx={5}
                fill={color} fillOpacity={0.88}
                stroke={isSelected ? '#ffffff' : (ZONE_COLORS[bin.zone] || '#6b7280')}
                strokeWidth={isSelected ? 2.5 : 1}
                strokeOpacity={isSelected ? 1 : 0.3}
            />
            <text x={bin.x + CELL_W / 2} y={bin.y + 18} textAnchor="middle"
                fill="#fff" fontSize={10} fontWeight="600" style={{ pointerEvents: 'none' }}>
                {bin.id}
            </text>
            {label && (
                <text x={bin.x + CELL_W / 2} y={bin.y + 36} textAnchor="middle"
                    fill="#ffffffcc" fontSize={9} style={{ pointerEvents: 'none' }}>
                    {label}
                </text>
            )}
        </g>
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
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });
    const [editing, setEditing] = useState(false);
    const [bgImage, setBgImage] = useState(() => localStorage.getItem('wms_map_bg') || null);
    const [bgOpacity, setBgOpacity] = useState(0.15);
    const fileRef = useRef(null);
    const [savedLayout, setSavedLayout] = useState(() => {
        try { return JSON.parse(localStorage.getItem('wms_map_layout')); } catch { return null; }
    });

    // Generate or load layout
    const bins = useMemo(() => {
        if (savedLayout?.length) return savedLayout;
        return autoGenerateLayout(inventory);
    }, [inventory, savedLayout]);

    // SVG dimensions
    const { svgW, svgH } = useMemo(() => {
        if (!bins.length) return { svgW: 600, svgH: 300 };
        const maxX = Math.max(...bins.map((b) => b.x)) + CELL_W + 48;
        const maxY = Math.max(...bins.map((b) => b.y)) + CELL_H + 48;
        return { svgW: maxX, svgH: maxY };
    }, [bins]);

    // Zone list for legend
    const zoneList = useMemo(() => [...new Set(bins.map((b) => b.zone))].sort(), [bins]);

    // Color and label getters
    const getBinColor = useCallback((bin) => {
        if (viewMode === 'stock') return getStockColor(getBinStock(bin.id, inventory).pct);
        if (viewMode === 'count') return getCountColor(bin.id, fullCountSession);
        return getFrequencyData(bin.id, bin.sku, activityLogs).color;
    }, [viewMode, inventory, fullCountSession, activityLogs]);

    const getBinLabel = useCallback((bin) => {
        if (viewMode === 'stock') { const { qty } = getBinStock(bin.id, inventory); return `${qty} pcs`; }
        if (viewMode === 'count') return getCountLabel(bin.id, fullCountSession);
        return `${getFrequencyData(bin.id, bin.sku, activityLogs).count}x`;
    }, [viewMode, inventory, fullCountSession, activityLogs]);

    // Summary stats
    const stats = useMemo(() => {
        let total = bins.length, inStock = 0, low = 0, empty = 0;
        bins.forEach((b) => {
            const { pct } = getBinStock(b.id, inventory);
            if (pct <= 0) empty++;
            else if (pct < 30) { low++; inStock++; }
            else inStock++;
        });
        return { total, inStock, low, empty };
    }, [bins, inventory]);

    // Bin click
    const handleBinClick = useCallback((bin) => {
        setSelectedBin(bin);
        onBinClick?.(bin, getBinStock(bin.id, inventory));
    }, [onBinClick, inventory]);

    // Zoom / pan
    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.5));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.4));
    const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    const handlePointerDown = (e) => {
        if (editing) return;
        setIsPanning(true);
        panRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    };
    useEffect(() => {
        if (!isPanning) return;
        const onMove = (e) => {
            setPan({
                x: panRef.current.panX + (e.clientX - panRef.current.startX) / zoom,
                y: panRef.current.panY + (e.clientY - panRef.current.startY) / zoom,
            });
        };
        const onUp = () => setIsPanning(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    }, [isPanning, zoom]);

    // Background upload
    const handleBgUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return;
        const reader = new FileReader();
        reader.onload = (ev) => { setBgImage(ev.target.result); localStorage.setItem('wms_map_bg', ev.target.result); };
        reader.readAsDataURL(file);
    };
    const handleRemoveBg = () => { setBgImage(null); localStorage.removeItem('wms_map_bg'); };

    // Layout save / reset
    const handleSaveLayout = () => { localStorage.setItem('wms_map_layout', JSON.stringify(bins)); setSavedLayout(bins); setEditing(false); };
    const handleResetLayout = () => { localStorage.removeItem('wms_map_layout'); setSavedLayout(null); setEditing(false); };

    // Detail data for selected bin
    const detail = useMemo(() => {
        if (!selectedBin) return null;
        const stock = getBinStock(selectedBin.id, inventory);
        const freq = getFrequencyData(selectedBin.id, selectedBin.sku, activityLogs);
        const countLabel = getCountLabel(selectedBin.id, fullCountSession);
        return { stock, freq, countLabel };
    }, [selectedBin, inventory, activityLogs, fullCountSession]);

    return (
        <div className={`flex flex-col ${isEmbedded ? 'h-full' : 'space-y-3'}`}>
            {/* Toolbar */}
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
                        {/* View mode tabs */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                            {VIEW_MODES.map((m) => (
                                <button key={m.id} onClick={() => setViewMode(m.id)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                        viewMode === m.id
                                            ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}>
                                    <m.Icon size={13} /> {m.label}
                                </button>
                            ))}
                        </div>
                        {/* Zoom controls */}
                        <div className="flex items-center gap-0.5 border dark:border-gray-600 rounded-lg px-1">
                            <button onClick={handleZoomOut} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><ZoomOut size={14} /></button>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={handleZoomIn} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><ZoomIn size={14} /></button>
                        </div>
                        <button onClick={handleResetView} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><Maximize2 size={14} /></button>
                        <button onClick={() => setEditing(!editing)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${editing ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                            <Settings size={13} /> {isEn ? 'Edit' : 'แก้ไข'}
                        </button>
                    </div>
                </div>
            )}

            {/* Embedded mode: compact toggle */}
            {isEmbedded && (
                <div className="flex items-center justify-between mb-2">
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                        {VIEW_MODES.map((m) => (
                            <button key={m.id} onClick={() => setViewMode(m.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${viewMode === m.id ? 'bg-white dark:bg-gray-600 shadow text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                <m.Icon size={11} /> {m.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-0.5">
                        <button onClick={handleZoomOut} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><ZoomOut size={12} /></button>
                        <button onClick={handleZoomIn} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><ZoomIn size={12} /></button>
                    </div>
                </div>
            )}

            {/* Editor panel */}
            {editing && !isEmbedded && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-2">
                    <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <Edit3 size={13} /> {isEn ? 'Layout Editor' : 'แก้ไข Layout'}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
                            <Upload size={13} /> {isEn ? 'Upload Floor Plan' : 'อัปโหลดแบบแปลน'}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                        {bgImage && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">Opacity:</span>
                                    <input type="range" min="5" max="50" value={bgOpacity * 100}
                                        onChange={(e) => setBgOpacity(e.target.value / 100)} className="w-20 h-1" />
                                    <span className="text-[10px] text-gray-400">{Math.round(bgOpacity * 100)}%</span>
                                </div>
                                <button onClick={handleRemoveBg}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                                    <Trash2 size={12} /> {isEn ? 'Remove' : 'ลบ'}
                                </button>
                            </>
                        )}
                        <div className="flex-1" />
                        <button onClick={handleSaveLayout}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                            <Save size={13} /> {isEn ? 'Save' : 'บันทึก'}
                        </button>
                        <button onClick={handleResetLayout}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-500">
                            <RotateCcw size={13} /> {isEn ? 'Reset' : 'รีเซ็ต'}
                        </button>
                    </div>
                </div>
            )}

            {/* Summary stats */}
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
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Main: SVG map + detail panel */}
            <div className={`flex ${isEmbedded ? 'flex-1' : ''} overflow-hidden`}>
                {/* Map canvas */}
                <div className="flex-1 relative bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden"
                    style={{ minHeight: isEmbedded ? 200 : 360, cursor: isPanning ? 'grabbing' : 'grab' }}
                    onPointerDown={handlePointerDown}>

                    {/* Zone legend chips */}
                    <div className="absolute top-2 left-2 z-10 flex gap-1 flex-wrap">
                        {zoneList.map((z) => (
                            <span key={z} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                                style={{ backgroundColor: ZONE_COLORS[z] || '#6b7280' }}>
                                <MapPin size={9} /> Zone {z}
                            </span>
                        ))}
                    </div>

                    {/* Zoom badge */}
                    <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded bg-black/40 text-white text-[10px] font-mono">
                        {Math.round(zoom * 100)}%
                    </div>

                    {/* Background image */}
                    {bgImage && (
                        <img src={bgImage} alt="Floor plan" className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                            style={{ opacity: bgOpacity }} />
                    )}

                    <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: '0 0' }}>

                        {/* Zone labels */}
                        {zoneList.map((z) => {
                            const zoneBins = bins.filter((b) => b.zone === z);
                            if (!zoneBins.length) return null;
                            const minX = Math.min(...zoneBins.map((b) => b.x));
                            const minY = Math.min(...zoneBins.map((b) => b.y));
                            return (
                                <text key={`zl-${z}`} x={minX} y={minY - 10} fontSize={12}
                                    fontWeight="700" fill={ZONE_COLORS[z] || '#6b7280'}>
                                    Zone {z}
                                </text>
                            );
                        })}

                        {/* Bin cells */}
                        {bins.map((bin) => (
                            <BinCell key={bin.id} bin={bin}
                                color={getBinColor(bin)} label={getBinLabel(bin)}
                                isSelected={selectedBin?.id === bin.id}
                                onClick={handleBinClick} />
                        ))}

                        {/* Empty state */}
                        {bins.length === 0 && (
                            <text x={svgW / 2} y={svgH / 2} textAnchor="middle" fill="#9ca3af" fontSize={14}>
                                {isEn ? 'No locations configured' : 'ยังไม่มีตำแหน่ง'}
                            </text>
                        )}
                    </svg>
                </div>

                {/* Detail side panel */}
                {selectedBin && detail && (
                    <div className="w-64 ml-2 border dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl overflow-y-auto flex-shrink-0">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: ZONE_COLORS[selectedBin.zone] || '#6b7280' }} />
                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{selectedBin.id}</span>
                            </div>
                            <button onClick={() => setSelectedBin(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X size={14} /></button>
                        </div>
                        <div className="p-3 space-y-3 text-xs">
                            {/* Product */}
                            {detail.stock.sku && (
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">{isEn ? 'Product' : 'สินค้า'}</p>
                                    <p className="text-gray-800 dark:text-gray-100 font-medium">{detail.stock.name}</p>
                                    <p className="text-gray-500 dark:text-gray-400">SKU: {detail.stock.sku}</p>
                                    {detail.stock.barcode && <p className="text-gray-500 dark:text-gray-400">Barcode: {detail.stock.barcode}</p>}
                                    {detail.stock.brand && <p className="text-gray-500 dark:text-gray-400">Brand: {detail.stock.brand}</p>}
                                </div>
                            )}
                            {/* Stock */}
                            <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">{isEn ? 'Stock Level' : 'ระดับสต็อค'}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-700 dark:text-gray-200">{detail.stock.qty} / {detail.stock.capacity}</span>
                                    <span className="font-bold" style={{ color: getStockColor(detail.stock.pct) }}>{Math.round(detail.stock.pct)}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${detail.stock.pct}%`, backgroundColor: getStockColor(detail.stock.pct) }} />
                                </div>
                            </div>
                            {/* Lots */}
                            {detail.stock.lots?.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">{isEn ? 'Lots' : 'ล็อต'}</p>
                                    {detail.stock.lots.map((lot, i) => (
                                        <div key={i} className="flex justify-between bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                            <span>{lot.lotNumber || lot.lot_id?.[1] || lot.name || `Lot ${i + 1}`}</span>
                                            <span>{lot.qty ?? lot.quantity ?? '-'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Picks */}
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">{isEn ? 'Pick Frequency' : 'ความถี่หยิบ'}</p>
                                <p className="text-gray-700 dark:text-gray-200">{detail.freq.count} picks</p>
                            </div>
                            {/* Count status */}
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">{isEn ? 'Count Status' : 'สถานะนับ'}</p>
                                <p className="text-gray-700 dark:text-gray-200">{detail.countLabel}</p>
                            </div>
                            {/* Actions */}
                            <div className="pt-2 space-y-1.5 border-t dark:border-gray-700">
                                {onCountBin && (
                                    <button onClick={() => onCountBin(selectedBin, detail.stock)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
                                        <ClipboardCheck size={13} /> {isEn ? 'Count This Bin' : 'นับ Bin นี้'}
                                    </button>
                                )}
                                {onBinClick && (
                                    <button onClick={() => onBinClick(selectedBin, detail.stock)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium">
                                        <ChevronRight size={13} /> {isEn ? 'View Details' : 'ดูรายละเอียด'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend bar */}
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
