import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    MapPin, Package, Eye, Edit3, Upload, Save, RotateCcw, ZoomIn, ZoomOut,
    Layers, Grid, Image, X, Check, ChevronDown, AlertTriangle, CheckCircle2,
    Clock, Maximize2, Move, Trash2, Plus, Settings
} from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';

// ── Color scales ─────────────────────────────────────────────────────────────
const STOCK_COLORS = {
    full:     { bg: '#dcfce7', border: '#16a34a', text: '#15803d' },  // >50%
    medium:   { bg: '#fef9c3', border: '#ca8a04', text: '#a16207' },  // 30-50%
    low:      { bg: '#fee2e2', border: '#dc2626', text: '#b91c1c' },  // 10-30%
    critical: { bg: '#fecaca', border: '#991b1b', text: '#7f1d1d' },  // <10%
    empty:    { bg: '#f3f4f6', border: '#d1d5db', text: '#9ca3af' },  // 0
};

const COUNT_COLORS = {
    matched:  { bg: '#dcfce7', border: '#16a34a', icon: '✅' },
    variance: { bg: '#fef3c7', border: '#d97706', icon: '⚠️' },
    pending:  { bg: '#e0e7ff', border: '#6366f1', icon: '⏳' },
    recount:  { bg: '#fee2e2', border: '#dc2626', icon: '🔄' },
    frozen:   { bg: '#e0f2fe', border: '#0284c7', icon: '🔒' },
};

const ZONE_COLORS = {
    A: '#3b82f6', B: '#10b981', C: '#f59e0b', D: '#8b5cf6',
    E: '#ec4899', F: '#06b6d4', BULK: '#6b7280',
};

const VIEW_MODES = [
    { key: 'stock', label: 'Stock Level', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'count', label: 'Count Status', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { key: 'frequency', label: 'Pick Frequency', icon: <Layers className="w-3.5 h-3.5" /> },
];

// ── Auto-generate layout from PRODUCT_CATALOG locations ──────────────────────
const autoGenerateLayout = (inventory) => {
    const locations = {};

    // Collect locations from PRODUCT_CATALOG
    Object.entries(PRODUCT_CATALOG).forEach(([sku, product]) => {
        if (!product.location) return;
        const loc = product.location;
        const parts = loc.split('-');
        if (parts.length < 3) return;
        const [zone, rack, pos] = parts;
        if (!locations[zone]) locations[zone] = {};
        if (!locations[zone][rack]) locations[zone][rack] = {};
        locations[zone][rack][pos] = {
            id: loc, sku, name: product.shortName || product.name,
            barcode: product.barcode || '',
            capacity: 500,
        };
    });

    // Add from real inventory if available
    const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
    invItems.forEach(item => {
        const loc = item.location;
        if (!loc) return;
        const parts = loc.split('-');
        if (parts.length < 3) return;
        const [zone, rack, pos] = parts;
        const sku = item.sku || item.default_code || '';
        if (!locations[zone]) locations[zone] = {};
        if (!locations[zone][rack]) locations[zone][rack] = {};
        if (!locations[zone][rack][pos]) {
            locations[zone][rack][pos] = {
                id: loc, sku, name: item.name || sku,
                barcode: item.barcode || '', capacity: 500,
            };
        }
    });

    // Build zones array
    const zones = [];
    const zoneKeys = Object.keys(locations).sort();
    const ZONE_NAMES = { A: 'Skincare', B: 'Body Care', C: 'Lotion & Mist', D: 'Accessories', BULK: 'Bulk Storage' };

    zoneKeys.forEach((zoneKey, zi) => {
        const racks = Object.keys(locations[zoneKey]).sort();
        const rackList = racks.map((rackId, ri) => {
            const bins = Object.keys(locations[zoneKey][rackId]).sort();
            return {
                id: `${zoneKey}-${rackId}`,
                label: `Rack ${zoneKey}-${rackId}`,
                bins: bins.map(pos => ({
                    ...locations[zoneKey][rackId][pos],
                    id: `${zoneKey}-${rackId}-${pos}`,
                })),
            };
        });

        zones.push({
            id: zoneKey,
            name: `Zone ${zoneKey} — ${ZONE_NAMES[zoneKey] || 'General'}`,
            color: ZONE_COLORS[zoneKey] || '#6b7280',
            racks: rackList,
        });
    });

    return { zones, elements: [] };
};

// ── Get stock level for a bin ─────────────────────────────────────────────────
const getBinStock = (binId, inventory) => {
    const invItems = inventory?.items || (Array.isArray(inventory) ? inventory : []);
    const item = invItems.find(i => (i.location === binId) || (i.sku === PRODUCT_CATALOG[Object.keys(PRODUCT_CATALOG).find(k => PRODUCT_CATALOG[k].location === binId)]?.sku));
    if (!item) {
        // Fallback to PRODUCT_CATALOG
        const catEntry = Object.entries(PRODUCT_CATALOG).find(([_, p]) => p.location === binId);
        if (catEntry) return { sku: catEntry[0], name: catEntry[1].shortName || catEntry[1].name, qty: 0, capacity: 500, pct: 0 };
        return null;
    }
    const qty = item.onHand ?? item.quantity ?? 0;
    const capacity = 500;
    return { sku: item.sku || item.default_code, name: item.name, qty, capacity, pct: capacity > 0 ? (qty / capacity) * 100 : 0, lots: item.lots || [] };
};

const getStockColor = (pct) => {
    if (pct <= 0) return STOCK_COLORS.empty;
    if (pct < 10) return STOCK_COLORS.critical;
    if (pct < 30) return STOCK_COLORS.low;
    if (pct < 50) return STOCK_COLORS.medium;
    return STOCK_COLORS.full;
};

// ── Bin Component ─────────────────────────────────────────────────────────────
const BinCell = ({ bin, viewMode, inventory, countStatus, pickFreq, onClick, isSelected }) => {
    const stock = getBinStock(bin.id, inventory);
    const pct = stock?.pct || 0;
    const qty = stock?.qty || 0;

    let colors, label, sublabel;
    if (viewMode === 'stock') {
        colors = getStockColor(pct);
        label = qty > 0 ? qty : '—';
        sublabel = pct > 0 ? `${Math.round(pct)}%` : '';
    } else if (viewMode === 'count') {
        const status = countStatus?.[bin.id] || 'pending';
        colors = COUNT_COLORS[status] || COUNT_COLORS.pending;
        label = COUNT_COLORS[status]?.icon || '⏳';
        sublabel = status;
    } else {
        const freq = pickFreq?.[bin.sku || stock?.sku] || 0;
        const maxFreq = Math.max(1, ...Object.values(pickFreq || {}));
        const intensity = freq / maxFreq;
        colors = {
            bg: `rgba(59,130,246,${0.05 + intensity * 0.4})`,
            border: `rgba(59,130,246,${0.3 + intensity * 0.7})`,
            text: intensity > 0.5 ? '#1e40af' : '#6b7280',
        };
        label = freq || '0';
        sublabel = 'picks';
    }

    return (
        <div
            onClick={() => onClick?.(bin, stock)}
            className={`relative cursor-pointer rounded-lg p-2 transition-all hover:shadow-md hover:scale-105 ${isSelected ? 'ring-2 ring-blue-500 shadow-lg scale-105' : ''}`}
            style={{ backgroundColor: colors.bg, border: `1.5px solid ${colors.border}`, minWidth: 80, minHeight: 70 }}
        >
            <div className="text-[10px] font-bold text-gray-500 mb-0.5">{bin.id}</div>
            <div className="text-lg font-bold" style={{ color: colors.text }}>{label}</div>
            {sublabel && <div className="text-[9px]" style={{ color: colors.text }}>{sublabel}</div>}
            {stock?.sku && <div className="text-[9px] text-gray-400 truncate mt-0.5" title={stock.name}>{stock.sku}</div>}
        </div>
    );
};

// ── Main WarehouseMap Component ───────────────────────────────────────────────
export default function WarehouseMap({
    inventory, activityLogs = [], countData = null, fullCountSession = null,
    onBinClick, onCountBin, isEmbedded = false, language = 'en',
}) {
    const isEn = language === 'en';
    const [viewMode, setViewMode] = useState('stock');
    const [selectedBin, setSelectedBin] = useState(null);
    const [selectedStock, setSelectedStock] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [showEditor, setShowEditor] = useState(false);
    const [bgImage, setBgImage] = useState(() => localStorage.getItem('wms_map_bg') || null);
    const [bgOpacity, setBgOpacity] = useState(0.15);
    const fileRef = useRef(null);

    // Auto-generate layout
    const layout = useMemo(() => {
        const stored = localStorage.getItem('wms_warehouse_layout');
        if (stored) {
            try { return JSON.parse(stored); } catch {}
        }
        return autoGenerateLayout(inventory);
    }, [inventory]);

    // Pick frequency from activity logs
    const pickFreq = useMemo(() => {
        const freq = {};
        const thirtyDays = Date.now() - 30 * 86400000;
        activityLogs.forEach(l => {
            if (l.action === 'pick' && l.timestamp >= thirtyDays) {
                const sku = l.details?.sku || l.details?.barcode || '';
                if (sku) freq[sku] = (freq[sku] || 0) + 1;
            }
        });
        return freq;
    }, [activityLogs]);

    // Count status from countData or fullCountSession
    const countStatus = useMemo(() => {
        const status = {};
        if (fullCountSession?.counts) {
            fullCountSession.counts.forEach(c => {
                status[`${c.location}`] = c.status === 'counted'
                    ? (c.variance === 0 ? 'matched' : 'variance')
                    : c.needsRecount ? 'recount' : 'pending';
            });
        }
        if (countData) {
            countData.forEach(r => {
                if (r.location && !status[r.location]) {
                    status[r.location] = r.status === 'matched' || (r.countedQty === r.systemQty) ? 'matched'
                        : r.needsRecount ? 'recount' : 'variance';
                }
            });
        }
        // Mark frozen bins
        if (fullCountSession?.status === 'frozen' || fullCountSession?.status === 'counting') {
            layout.zones.forEach(z => z.racks.forEach(r => r.bins.forEach(b => {
                if (!status[b.id]) status[b.id] = fullCountSession?.status === 'frozen' ? 'frozen' : 'pending';
            })));
        }
        return status;
    }, [countData, fullCountSession, layout]);

    const handleBinClick = useCallback((bin, stock) => {
        setSelectedBin(bin);
        setSelectedStock(stock);
        onBinClick?.(bin, stock);
    }, [onBinClick]);

    const handleBgUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setBgImage(ev.target.result);
            localStorage.setItem('wms_map_bg', ev.target.result);
        };
        reader.readAsDataURL(file);
    };

    const saveLayout = () => {
        localStorage.setItem('wms_warehouse_layout', JSON.stringify(layout));
    };

    // Summary stats
    const mapStats = useMemo(() => {
        let totalBins = 0, occupied = 0, lowStock = 0, empty = 0;
        layout.zones.forEach(z => z.racks.forEach(r => r.bins.forEach(b => {
            totalBins++;
            const stock = getBinStock(b.id, inventory);
            if (!stock || stock.qty <= 0) empty++;
            else if (stock.pct < 30) { lowStock++; occupied++; }
            else occupied++;
        })));
        return { totalBins, occupied, lowStock, empty };
    }, [layout, inventory]);

    return (
        <div className={`${isEmbedded ? '' : 'space-y-4'}`}>
            {/* Header */}
            {!isEmbedded && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">{isEn ? 'Warehouse Map' : 'แผนผังคลัง'}</h2>
                        <span className="text-xs text-gray-400">{mapStats.totalBins} bins</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View mode toggle */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                            {VIEW_MODES.map(vm => (
                                <button key={vm.key} onClick={() => setViewMode(vm.key)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === vm.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                    {vm.icon} {vm.label}
                                </button>
                            ))}
                        </div>
                        {/* Zoom */}
                        <div className="flex items-center gap-1 border rounded-lg px-1">
                            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 text-gray-400 hover:text-gray-600"><ZoomOut className="w-3.5 h-3.5" /></button>
                            <span className="text-xs text-gray-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 text-gray-400 hover:text-gray-600"><ZoomIn className="w-3.5 h-3.5" /></button>
                        </div>
                        {/* Editor toggle */}
                        <button onClick={() => setShowEditor(!showEditor)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${showEditor ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            <Settings className="w-3.5 h-3.5" /> {isEn ? 'Edit Layout' : 'แก้ไข'}
                        </button>
                    </div>
                </div>
            )}

            {/* Embedded mode: compact view toggle */}
            {isEmbedded && (
                <div className="flex items-center justify-between mb-3">
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        {VIEW_MODES.map(vm => (
                            <button key={vm.key} onClick={() => setViewMode(vm.key)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${viewMode === vm.key ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>
                                {vm.icon} {vm.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Editor panel */}
            {showEditor && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-blue-800 flex items-center gap-1.5">
                        <Edit3 className="w-4 h-4" /> {isEn ? 'Layout Editor' : 'แก้ไข Layout'}
                    </h3>
                    <div className="flex items-center gap-3">
                        <button onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-xs font-medium hover:bg-gray-50">
                            <Upload className="w-3.5 h-3.5" /> {isEn ? 'Upload Floor Plan' : 'อัปโหลดแบบแปลน'}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                        {bgImage && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">{isEn ? 'Opacity' : 'ความโปร่งใส'}:</span>
                                    <input type="range" min="5" max="50" value={bgOpacity * 100}
                                        onChange={e => setBgOpacity(e.target.value / 100)}
                                        className="w-24 h-1" />
                                    <span className="text-xs text-gray-400">{Math.round(bgOpacity * 100)}%</span>
                                </div>
                                <button onClick={() => { setBgImage(null); localStorage.removeItem('wms_map_bg'); }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                                    <Trash2 className="w-3 h-3" /> {isEn ? 'Remove' : 'ลบ'}
                                </button>
                            </>
                        )}
                        <button onClick={saveLayout}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 ml-auto">
                            <Save className="w-3.5 h-3.5" /> {isEn ? 'Save Layout' : 'บันทึก'}
                        </button>
                    </div>
                    <p className="text-[10px] text-blue-600">
                        {isEn
                            ? 'Upload your warehouse floor plan as background. Bins are auto-generated from product locations.'
                            : 'อัปโหลดแบบแปลนคลังเป็น background ตำแหน่ง Bin สร้างอัตโนมัติจาก location สินค้า'}
                    </p>
                </div>
            )}

            {/* Summary stats bar */}
            <div className="grid grid-cols-4 gap-2">
                <div className="bg-white border rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-gray-900">{mapStats.totalBins}</p>
                    <p className="text-[10px] text-gray-400">{isEn ? 'Total Bins' : 'ทั้งหมด'}</p>
                </div>
                <div className="bg-white border rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-green-600">{mapStats.occupied}</p>
                    <p className="text-[10px] text-gray-400">{isEn ? 'In Stock' : 'มีสต็อค'}</p>
                </div>
                <div className="bg-white border rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-orange-600">{mapStats.lowStock}</p>
                    <p className="text-[10px] text-gray-400">{isEn ? 'Low Stock' : 'สต็อคต่ำ'}</p>
                </div>
                <div className="bg-white border rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-gray-400">{mapStats.empty}</p>
                    <p className="text-[10px] text-gray-400">{isEn ? 'Empty' : 'ว่าง'}</p>
                </div>
            </div>

            {/* Map container */}
            <div className="relative bg-white border rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
                {/* Background image */}
                {bgImage && (
                    <img src={bgImage} alt="Floor plan" className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        style={{ opacity: bgOpacity }} />
                )}

                {/* Zones */}
                <div className="relative p-4 space-y-4" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                    {layout.zones.map(zone => (
                        <div key={zone.id} className="rounded-xl border-2 p-3" style={{ borderColor: zone.color + '60', backgroundColor: zone.color + '08' }}>
                            {/* Zone header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                                    <span className="text-sm font-bold text-gray-700">{zone.name}</span>
                                    <span className="text-[10px] text-gray-400">
                                        {zone.racks.reduce((s, r) => s + r.bins.length, 0)} bins
                                    </span>
                                </div>
                                {/* Zone count progress for full count */}
                                {fullCountSession && (() => {
                                    const zoneBins = zone.racks.flatMap(r => r.bins.map(b => b.id));
                                    const counted = zoneBins.filter(id => countStatus[id] === 'matched' || countStatus[id] === 'variance').length;
                                    const total = zoneBins.length;
                                    const pct = total > 0 ? Math.round((counted / total) * 100) : 0;
                                    return (
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className={`text-xs font-medium ${pct === 100 ? 'text-green-600' : 'text-blue-600'}`}>{pct}%</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Racks */}
                            <div className="space-y-3">
                                {zone.racks.map(rack => (
                                    <div key={rack.id}>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">{rack.label}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {rack.bins.map(bin => (
                                                <BinCell
                                                    key={bin.id} bin={bin} viewMode={viewMode}
                                                    inventory={inventory} countStatus={countStatus} pickFreq={pickFreq}
                                                    onClick={handleBinClick} isSelected={selectedBin?.id === bin.id}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Empty state */}
                    {layout.zones.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <MapPin className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm font-medium">{isEn ? 'No locations configured' : 'ยังไม่มีตำแหน่ง'}</p>
                            <p className="text-xs mt-1">{isEn ? 'Connect Odoo or add products to generate map' : 'เชื่อมต่อ Odoo หรือเพิ่มสินค้าเพื่อสร้างแผนผัง'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-gray-500 px-1">
                {viewMode === 'stock' && <>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: STOCK_COLORS.full.bg, border: `1px solid ${STOCK_COLORS.full.border}` }} /> &gt;50%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: STOCK_COLORS.medium.bg, border: `1px solid ${STOCK_COLORS.medium.border}` }} /> 30-50%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: STOCK_COLORS.low.bg, border: `1px solid ${STOCK_COLORS.low.border}` }} /> &lt;30%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: STOCK_COLORS.empty.bg, border: `1px solid ${STOCK_COLORS.empty.border}` }} /> Empty</span>
                </>}
                {viewMode === 'count' && <>
                    <span>✅ Matched</span> <span>⚠️ Variance</span> <span>⏳ Pending</span> <span>🔄 Recount</span> <span>🔒 Frozen</span>
                </>}
                {viewMode === 'frequency' && <span>Color intensity = pick frequency (30 days)</span>}
            </div>

            {/* Bin Detail Panel */}
            {selectedBin && selectedStock && (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            <span className="font-bold text-gray-900">{selectedBin.id}</span>
                            {selectedBin.sku && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{selectedBin.sku || selectedStock.sku}</span>}
                        </div>
                        <button onClick={() => { setSelectedBin(null); setSelectedStock(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase">{isEn ? 'Product' : 'สินค้า'}</p>
                            <p className="text-sm font-medium text-gray-900">{selectedStock.name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase">{isEn ? 'On Hand' : 'คงเหลือ'}</p>
                            <p className="text-sm font-bold text-gray-900">{selectedStock.qty ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase">{isEn ? 'Capacity' : 'ความจุ'}</p>
                            <p className="text-sm text-gray-600">{selectedStock.capacity || 500}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase">{isEn ? 'Fill %' : 'เติม %'}</p>
                            <p className={`text-sm font-bold ${selectedStock.pct > 50 ? 'text-green-600' : selectedStock.pct > 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {Math.round(selectedStock.pct || 0)}%
                            </p>
                        </div>
                    </div>
                    {selectedStock.lots?.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <p className="text-[10px] text-gray-400 uppercase mb-1">{isEn ? 'Lots' : 'ล็อต'}</p>
                            <div className="flex flex-wrap gap-2">
                                {selectedStock.lots.map((lot, i) => (
                                    <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">
                                        {lot.lotNumber || lot.lot_id?.[1] || `Lot ${i + 1}`} — {lot.qty ?? '?'} pcs
                                        {lot.expiryDate && <span className="text-purple-400 ml-1">exp: {lot.expiryDate}</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                        {onCountBin && (
                            <button onClick={() => onCountBin(selectedBin, selectedStock)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {isEn ? 'Count Now' : 'นับ'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
