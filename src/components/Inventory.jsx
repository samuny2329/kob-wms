import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Minus, AlertTriangle, Package, Tag, X, Check, RefreshCw, ChevronDown, ChevronRight, Filter, ArrowUpDown, MapPin, Hash, Boxes, TrendingDown, CheckSquare, Square, History, RotateCcw, ChevronLeft, ArrowUpCircle, Truck, PackageCheck, Settings, Plus } from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';
import { fetchStockHistory, fetchAllLocations, getStoredAllowedLocations, saveAllowedLocations } from '../services/odooApi';

// ── Warehouse / Category filter data ──────────────────────────────────────────
const WAREHOUSES = ['All', 'WH - Main', 'WH - Store B'];
const CATEGORIES = ['All', 'Skincare', 'Serum', 'Toner', 'Sunscreen', 'Mask', 'Body Care'];

const Inventory = ({ inventory, addToast, syncStatus, apiConfigs }) => {
    const [searchQuery, setSearchQuery]     = useState('');
    const [groupBy, setGroupBy]             = useState('none');
    const [activeFilters, setActiveFilters] = useState([]);
    const [sortBy, setSortBy]               = useState({ col: 'name', dir: 'asc' });
    const [selected, setSelected]           = useState([]);
    const [showFilters, setShowFilters]     = useState(false);
    const [showGroupBy, setShowGroupBy]     = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [warehouseFilter, setWarehouseFilter] = useState('All');
    const [categoryFilter, setCategoryFilter]   = useState('All');
    const [page, setPage]   = useState(1);
    const [productModal, setProductModal] = useState(null);
    const [historyModal, setHistoryModal] = useState(null);   // { item, rows[], loading }
    const [replenishModal, setReplenishModal] = useState(null);
    const [replenishQty, setReplenishQty] = useState(50);
    // Location config
    const [allowedLocations, setAllowedLocations] = useState(() => getStoredAllowedLocations());
    const [showLocConfig, setShowLocConfig] = useState(false);
    const [allOdooLocations, setAllOdooLocations] = useState([]);
    const [newLocInput, setNewLocInput] = useState('');
    const PAGE_SIZE = 80;

    const odooConfig = apiConfigs?.odoo;
    const isLiveMode = odooConfig?.useMock === false;

    // Load all Odoo locations when config panel opens
    useEffect(() => {
        if (showLocConfig) {
            fetchAllLocations(odooConfig || {}).then(locs => setAllOdooLocations(locs)).catch(() => {});
        }
    }, [showLocConfig, odooConfig]);

    const saveLocations = (list) => {
        setAllowedLocations(list);
        saveAllowedLocations(list);
    };

    // ── Mock history generator ────────────────────────────────────────────────
    const getMockHistory = (item) => {
        const now = Date.now();
        const day = 86400000;
        return [
            { date: new Date(now - 1 * day).toLocaleString(),  type: 'delivery',  ref: 'WH/OUT/00118', qty: -3,  balance: (item.onHand || 0) + 3,  partner: 'Customer A' },
            { date: new Date(now - 3 * day).toLocaleString(),  type: 'delivery',  ref: 'WH/OUT/00102', qty: -5,  balance: (item.onHand || 0) + 8,  partner: 'Customer B' },
            { date: new Date(now - 7 * day).toLocaleString(),  type: 'receipt',   ref: 'WH/IN/00045',  qty: +200, balance: (item.onHand || 0) + 13, partner: 'Supplier' },
            { date: new Date(now - 10 * day).toLocaleString(), type: 'delivery',  ref: 'WH/OUT/00095', qty: -8,  balance: (item.onHand || 0) - 187, partner: 'Customer C' },
            { date: new Date(now - 14 * day).toLocaleString(), type: 'adjustment',ref: 'WH/INV/00012', qty: +2,  balance: (item.onHand || 0) - 179, partner: '—' },
        ];
    };

    // ── filter / group options ────────────────────────────────────────────────
    const filterOptions = [
        { key: 'low_stock', label: 'Low Stock',      icon: <TrendingDown className="w-3.5 h-3.5" /> },
        { key: 'negative',  label: 'Negative Stock', icon: <Minus className="w-3.5 h-3.5" /> },
        { key: 'has_lot',   label: 'Has Lot/SN',     icon: <Hash className="w-3.5 h-3.5" /> },
        { key: 'reserved',  label: 'Has Reserved',   icon: <Tag className="w-3.5 h-3.5" /> },
    ];
    const groupOptions = [
        { key: 'none',     label: 'No Grouping' },
        { key: 'product',  label: 'Product' },
        { key: 'location', label: 'Location' },
        { key: 'lot',      label: 'Lot/Serial' },
    ];

    const toggleFilter  = (key) => setActiveFilters(f => f.includes(key) ? f.filter(x => x !== key) : [...f, key]);
    const toggleSort    = (col) => setSortBy(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    const toggleGroup   = (key) => setExpandedGroups(g => ({ ...g, [key]: !g[key] }));
    const isGroupExpanded = (key) => groupBy === 'none' ? true : expandedGroups[key] !== false;

    // ── location whitelist check ──────────────────────────────────────────────
    const isLocationAllowed = (loc) => {
        if (!loc) return true;
        if (allowedLocations.length === 0) return true;
        return allowedLocations.some(kw => loc.toLowerCase().includes(kw.toLowerCase()));
    };

    // ── flatten inventory rows ────────────────────────────────────────────────
    const flatRows = useMemo(() => {
        if (!inventory || !Array.isArray(inventory)) return [];
        const rows = [];
        let idx = 0;
        for (const item of inventory) {
            // Skip items from non-allowed locations
            if (!isLocationAllowed(item.location)) continue;
            if (item.lots && item.lots.length > 0) {
                for (const lot of item.lots) {
                    rows.push({
                        id: `row-${idx++}-${item.sku || item.productId || ''}-${lot.lotNumber || ''}`,
                        productId: item.productId, sku: item.sku || '',
                        name: item.name || '', shortName: item.shortName || item.name || '',
                        location: item.location || 'PICKFACE', category: item.category || 'Skincare',
                        lotNumber: lot.lotNumber || '', expiryDate: lot.expiryDate || '',
                        receivedDate: lot.receivedDate || '',
                        onHand: lot.qty ?? item.onHand, reserved: item.reserved || 0,
                        available: (lot.qty ?? item.onHand) - (item.reserved || 0),
                        unitCost: item.unitCost || 0, reorderPoint: item.reorderPoint || 10,
                        _item: item,
                    });
                }
            } else {
                rows.push({
                    id: `row-${idx++}-${item.sku || item.productId || item.name || ''}`,
                    productId: item.productId, sku: item.sku || '',
                    name: item.name || '', shortName: item.shortName || item.name || '',
                    location: item.location || 'PICKFACE', category: item.category || 'Skincare',
                    lotNumber: '', expiryDate: '', receivedDate: '',
                    onHand: item.onHand || 0, reserved: item.reserved || 0,
                    available: item.available ?? (item.onHand - item.reserved),
                    unitCost: item.unitCost || 0, reorderPoint: item.reorderPoint || 10,
                    _item: item,
                });
            }
        }
        return rows;
    }, [inventory]);

    // ── filter + sort ─────────────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        let rows = [...flatRows];
        const q = searchQuery.toLowerCase();
        if (q) rows = rows.filter(r =>
            r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) ||
            r.shortName.toLowerCase().includes(q) || r.lotNumber.toLowerCase().includes(q) ||
            r.location.toLowerCase().includes(q));
        if (warehouseFilter !== 'All') rows = rows.filter(r => r.location.includes(warehouseFilter.replace('WH - ', '')));
        if (categoryFilter  !== 'All') rows = rows.filter(r => r.category === categoryFilter);
        if (activeFilters.includes('low_stock')) rows = rows.filter(r => r.available <= r.reorderPoint);
        if (activeFilters.includes('negative'))  rows = rows.filter(r => r.onHand < 0);
        if (activeFilters.includes('has_lot'))   rows = rows.filter(r => r.lotNumber);
        if (activeFilters.includes('reserved'))  rows = rows.filter(r => r.reserved > 0);
        rows.sort((a, b) => {
            let va = a[sortBy.col] ?? '', vb = b[sortBy.col] ?? '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortBy.dir === 'asc' ? -1 : 1;
            if (va > vb) return sortBy.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return rows;
    }, [flatRows, searchQuery, warehouseFilter, categoryFilter, activeFilters, sortBy]);

    // ── pagination ────────────────────────────────────────────────────────────
    const totalRecords   = filteredRows.length;
    const totalPages     = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
    const safePage       = Math.min(page, totalPages);
    const pageStart      = (safePage - 1) * PAGE_SIZE;
    const pageEnd        = Math.min(pageStart + PAGE_SIZE, totalRecords);
    const pagedRows      = filteredRows.slice(pageStart, pageEnd);

    // ── grouping (on current page only) ──────────────────────────────────────
    const grouped = useMemo(() => {
        if (groupBy === 'none') return { '': pagedRows };
        const g = {};
        for (const row of pagedRows) {
            const key = groupBy === 'product'  ? (row.shortName || row.name)
                      : groupBy === 'location' ? row.location
                      : groupBy === 'lot'      ? (row.lotNumber || '(No Lot)')
                      : '';
            if (!g[key]) g[key] = [];
            g[key].push(row);
        }
        return g;
    }, [pagedRows, groupBy]);

    const totalStats = useMemo(() => filteredRows.reduce((acc, r) => ({
        totalOnHand:  acc.totalOnHand  + r.onHand,
        totalReserved: acc.totalReserved + r.reserved,
        lowStock:     acc.lowStock + (r.available <= r.reorderPoint ? 1 : 0),
    }), { totalOnHand: 0, totalReserved: 0, lowStock: 0 }), [filteredRows]);

    const allPageIds  = pagedRows.map(r => r.id);
    const allSelected = allPageIds.length > 0 && allPageIds.every(id => selected.includes(id));
    const toggleAll   = () => setSelected(allSelected ? [] : allPageIds);
    const toggleRow   = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    const SortIcon = ({ col }) => (
        <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60"
            style={{ color: sortBy.col === col ? '#017E84' : '#dee2e6' }} />
    );

    // ── Open history (live or mock) ────────────────────────────────────────────
    const openHistory = useCallback(async (item) => {
        setHistoryModal({ item, rows: [], loading: true });
        if (isLiveMode && item.productId) {
            const rows = await fetchStockHistory(odooConfig, item.productId, allowedLocations, 50);
            if (rows) {
                setHistoryModal({ item, rows, loading: false, isLive: true });
                return;
            }
        }
        // Fallback to mock
        setHistoryModal({ item, rows: getMockHistory(item), loading: false, isLive: false });
    }, [isLiveMode, odooConfig, allowedLocations]);

    // ── Left panel section ────────────────────────────────────────────────────
    const LeftSection = ({ title, options, value, onChange }) => {
        const [open, setOpen] = useState(true);
        return (
            <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                <button
                    onClick={() => setOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-2.5"
                    style={{ color: '#6c757d', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                >
                    {title}
                    <ChevronDown className={`w-3 h-3 transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>
                {open && (
                    <div className="pb-1.5">
                        {options.map(opt => {
                            const isActive = value === opt;
                            return (
                                <button
                                    key={opt}
                                    onClick={() => { onChange(opt); setPage(1); }}
                                    className="w-full text-left px-4 py-1.5 text-xs transition-colors"
                                    style={{
                                        color: isActive ? '#714B67' : '#495057',
                                        fontWeight: isActive ? 600 : 400,
                                        backgroundColor: isActive ? '#f5f0f4' : 'transparent',
                                        borderLeft: isActive ? '3px solid #714B67' : '3px solid transparent',
                                    }}
                                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#f8f9fa'; } }}
                                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full gap-0 animate-slide-up" style={{ minHeight: 0 }}>

            {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
            {leftPanelOpen && (
                <div className="shrink-0 flex flex-col" style={{ width: '180px', backgroundColor: '#ffffff', borderRight: '1px solid #dee2e6', overflowY: 'auto' }}>
                    {/* Panel header */}
                    <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #dee2e6' }}>
                        <span className="text-xs font-semibold" style={{ color: '#212529' }}>Filters</span>
                        <button onClick={() => setLeftPanelOpen(false)} style={{ color: '#adb5bd' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#495057'}
                            onMouseLeave={e => e.currentTarget.style.color = '#adb5bd'}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <LeftSection title="Warehouses"  options={WAREHOUSES}  value={warehouseFilter} onChange={setWarehouseFilter} />
                    <LeftSection title="Category"    options={CATEGORIES}  value={categoryFilter}  onChange={setCategoryFilter} />

                    {/* ── Allowed Locations config ── */}
                    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <button
                            onClick={() => setShowLocConfig(s => !s)}
                            className="w-full flex items-center justify-between px-4 py-2.5"
                            style={{ color: '#6c757d', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                        >
                            <span className="flex items-center gap-1.5"><Settings className="w-3 h-3" /> Locations</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${showLocConfig ? '' : '-rotate-90'}`} />
                        </button>
                        {showLocConfig && (
                            <div className="px-3 pb-3 space-y-1.5">
                                <p className="text-[10px] mb-2" style={{ color: '#adb5bd' }}>
                                    {isLiveMode ? 'Live — pulling from Odoo' : 'Mock mode'}
                                </p>
                                {/* Current whitelist */}
                                {allowedLocations.map((loc, i) => (
                                    <div key={i} className="flex items-center gap-1.5 group">
                                        <span className="flex-1 text-[11px] font-mono px-2 py-1 rounded truncate"
                                            style={{ backgroundColor: '#f0e8ed', color: '#714B67', border: '1px solid #d9c0d3' }}>
                                            {loc}
                                        </span>
                                        <button
                                            onClick={() => saveLocations(allowedLocations.filter((_, j) => j !== i))}
                                            className="opacity-50 hover:opacity-100 shrink-0"
                                            style={{ color: '#dc3545' }}
                                            title="Remove"
                                        ><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                {/* Odoo location suggestions */}
                                {allOdooLocations.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#adb5bd' }}>Add from Odoo</p>
                                        <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                            {allOdooLocations
                                                .filter(l => !allowedLocations.includes(l.complete_name))
                                                .map(l => (
                                                    <button key={l.id}
                                                        onClick={() => saveLocations([...allowedLocations, l.complete_name])}
                                                        className="w-full text-left text-[11px] font-mono px-2 py-1 rounded mb-0.5 transition-colors truncate"
                                                        style={{ color: '#495057', backgroundColor: 'transparent' }}
                                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e8f8fb'; e.currentTarget.style.color = '#017E84'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#495057'; }}
                                                    >+ {l.complete_name}</button>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                                {/* Manual input */}
                                <div className="flex gap-1 mt-2">
                                    <input
                                        value={newLocInput} onChange={e => setNewLocInput(e.target.value)}
                                        placeholder="Type keyword…"
                                        className="flex-1 text-[11px] px-2 py-1 outline-none font-mono"
                                        style={{ border: '1px solid #dee2e6', borderRadius: '3px', color: '#212529' }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newLocInput.trim()) {
                                                saveLocations([...allowedLocations, newLocInput.trim()]);
                                                setNewLocInput('');
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => { if (newLocInput.trim()) { saveLocations([...allowedLocations, newLocInput.trim()]); setNewLocInput(''); }}}
                                        className="px-2 py-1 text-xs rounded"
                                        style={{ backgroundColor: '#017E84', color: '#fff', border: 'none' }}
                                    ><Plus className="w-3 h-3" /></button>
                                </div>
                                {allowedLocations.length > 0 && (
                                    <button onClick={() => saveLocations([])}
                                        className="text-[10px] underline mt-1"
                                        style={{ color: '#dc3545' }}>Clear all (show everything)</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick filters */}
                    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6c757d' }}>Quick Filters</p>
                        {filterOptions.map(f => {
                            const isActive = activeFilters.includes(f.key);
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => { toggleFilter(f.key); setPage(1); }}
                                    className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors"
                                    style={{
                                        color: isActive ? '#714B67' : '#495057',
                                        fontWeight: isActive ? 600 : 400,
                                        backgroundColor: isActive ? '#f5f0f4' : 'transparent',
                                        borderLeft: isActive ? '3px solid #714B67' : '3px solid transparent',
                                    }}
                                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#f8f9fa'; } }}
                                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
                                >
                                    {f.icon} {f.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col" style={{ minWidth: 0, overflowY: 'auto' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', margin: '0 0 1rem 0', overflow: 'visible' }}>

                    {/* ── Toolbar ── */}
                    <div className="px-4 py-2.5 flex flex-wrap gap-2 items-center" style={{ borderBottom: '1px solid #dee2e6' }}>

                        {/* Open left panel (when closed) */}
                        {!leftPanelOpen && (
                            <button
                                onClick={() => setLeftPanelOpen(true)}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: '#6c757d', border: '1px solid #dee2e6' }}
                                title="Show Filters Panel"
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#714B67'; e.currentTarget.style.color = '#714B67'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.color = '#6c757d'; }}
                            >
                                <Filter className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {/* Search */}
                        <div className="relative flex-1 min-w-[160px] max-w-xs">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#adb5bd' }} />
                            <input
                                type="text" value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                placeholder="Search products, lots…"
                                className="w-full pl-8 pr-3 py-1.5 text-sm outline-none"
                                style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529', backgroundColor: '#ffffff' }}
                                onFocus={e => e.currentTarget.style.borderColor = '#017E84'}
                                onBlur={e => e.currentTarget.style.borderColor = '#dee2e6'}
                            />
                        </div>

                        {/* Filters dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowFilters(s => !s); setShowGroupBy(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
                                style={{
                                    border: '1px solid #dee2e6', color: '#495057', backgroundColor: 'transparent',
                                    ...(activeFilters.length > 0 ? { color: '#714B67', borderColor: '#714B67', backgroundColor: '#f9f5f8' } : {})
                                }}
                                onMouseEnter={e => { if (!activeFilters.length) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                onMouseLeave={e => { if (!activeFilters.length) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                Filters
                                {activeFilters.length > 0 && (
                                    <span className="text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center" style={{ backgroundColor: '#714B67' }}>{activeFilters.length}</span>
                                )}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showFilters && (
                                <div className="absolute top-full mt-1 left-0 z-50 min-w-[180px] py-1" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5" style={{ color: '#adb5bd' }}>Filters</p>
                                    {filterOptions.map(f => (
                                        <button key={f.key} onClick={() => { toggleFilter(f.key); setPage(1); }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                                            style={{ backgroundColor: activeFilters.includes(f.key) ? '#f9f5f8' : 'transparent', color: activeFilters.includes(f.key) ? '#714B67' : '#212529', fontWeight: activeFilters.includes(f.key) ? 600 : 400 }}
                                            onMouseEnter={e => { if (!activeFilters.includes(f.key)) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                            onMouseLeave={e => { if (!activeFilters.includes(f.key)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            {f.icon} {f.label}
                                            {activeFilters.includes(f.key) && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Group By dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowGroupBy(s => !s); setShowFilters(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
                                style={{
                                    border: '1px solid #dee2e6', color: '#495057', backgroundColor: 'transparent',
                                    ...(groupBy !== 'none' ? { color: '#017E84', borderColor: '#017E84', backgroundColor: '#e8f8fb' } : {})
                                }}
                                onMouseEnter={e => { if (groupBy === 'none') e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                onMouseLeave={e => { if (groupBy === 'none') e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                Group By{groupBy !== 'none' && <span className="font-semibold">: {groupOptions.find(g => g.key === groupBy)?.label}</span>}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showGroupBy && (
                                <div className="absolute top-full mt-1 left-0 z-50 min-w-[160px] py-1" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5" style={{ color: '#adb5bd' }}>Group By</p>
                                    {groupOptions.map(g => (
                                        <button key={g.key} onClick={() => { setGroupBy(g.key); setShowGroupBy(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                                            style={{ backgroundColor: groupBy === g.key ? '#e8f8fb' : 'transparent', color: groupBy === g.key ? '#017E84' : '#212529', fontWeight: groupBy === g.key ? 600 : 400 }}
                                            onMouseEnter={e => { if (groupBy !== g.key) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                            onMouseLeave={e => { if (groupBy !== g.key) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            {g.label} {groupBy === g.key && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right side: selection + record count + sync */}
                        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: '#6c757d' }}>
                            {selected.length > 0 && (
                                <span className="px-2 py-0.5 font-semibold rounded" style={{ backgroundColor: '#f9f5f8', color: '#714B67', border: '1px solid #e0cfe0' }}>{selected.length} selected</span>
                            )}
                            {/* Pagination count */}
                            <span className="tabular-nums">
                                {totalRecords === 0 ? '0' : `${pageStart + 1}-${pageEnd}`}
                                {' / '}
                                <span className="font-semibold" style={{ color: '#212529' }}>{totalRecords}</span>
                            </span>
                            {/* Paging arrows */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                    className="p-1 rounded disabled:opacity-30 transition-colors"
                                    style={{ color: '#6c757d' }}
                                    onMouseEnter={e => { if (safePage > 1) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                ><ChevronLeft className="w-3 h-3" /></button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    className="p-1 rounded disabled:opacity-30 transition-colors"
                                    style={{ color: '#6c757d' }}
                                    onMouseEnter={e => { if (safePage < totalPages) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                ><ChevronRight className="w-3 h-3" /></button>
                            </div>
                            {syncStatus?.isSyncing && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: '#714B67' }} />}
                        </div>
                    </div>

                    {/* Active filter chips */}
                    {(activeFilters.length > 0 || warehouseFilter !== 'All' || categoryFilter !== 'All') && (
                        <div className="px-4 py-2 flex flex-wrap gap-1.5 items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            {activeFilters.map(f => {
                                const opt = filterOptions.find(o => o.key === f);
                                return (
                                    <span key={f} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded" style={{ backgroundColor: '#f0e8ed', color: '#714B67', border: '1px solid #d9c0d3' }}>
                                        {opt?.icon} {opt?.label}
                                        <button onClick={() => toggleFilter(f)} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                    </span>
                                );
                            })}
                            {warehouseFilter !== 'All' && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded" style={{ backgroundColor: '#e8f8fb', color: '#017E84', border: '1px solid #b2e0e4' }}>
                                    {warehouseFilter}
                                    <button onClick={() => setWarehouseFilter('All')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                </span>
                            )}
                            {categoryFilter !== 'All' && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded" style={{ backgroundColor: '#e8f8fb', color: '#017E84', border: '1px solid #b2e0e4' }}>
                                    {categoryFilter}
                                    <button onClick={() => setCategoryFilter('All')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                </span>
                            )}
                            <button onClick={() => { setActiveFilters([]); setWarehouseFilter('All'); setCategoryFilter('All'); setPage(1); }}
                                className="text-xs underline ml-1" style={{ color: '#6c757d' }}>Clear all</button>
                        </div>
                    )}

                    {/* ── Summary stats ── */}
                    <div className="grid grid-cols-3" style={{ borderBottom: '1px solid #dee2e6' }}>
                        {[
                            { label: 'On Hand',   value: totalStats.totalOnHand.toLocaleString(),   color: '#212529' },
                            { label: 'Reserved',  value: totalStats.totalReserved.toLocaleString(),  color: '#ffac00' },
                            { label: 'Available', value: (totalStats.totalOnHand - totalStats.totalReserved).toLocaleString(), color: '#017E84' },
                        ].map((s, i) => (
                            <div key={i} className="px-4 py-2.5 text-center" style={{ borderRight: i < 2 ? '1px solid #dee2e6' : 'none' }}>
                                <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#adb5bd' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Table ── */}
                    <div className="overflow-x-auto" onClick={() => { setShowFilters(false); setShowGroupBy(false); }}>
                        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                    <th className="w-10 px-4 py-2.5">
                                        <button onClick={toggleAll} style={{ color: allSelected ? '#714B67' : '#adb5bd' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#714B67'}
                                            onMouseLeave={e => e.currentTarget.style.color = allSelected ? '#714B67' : '#adb5bd'}
                                        >
                                            {allSelected
                                                ? <CheckSquare className="w-4 h-4" style={{ color: '#714B67' }} />
                                                : <Square className="w-4 h-4" />}
                                        </button>
                                    </th>
                                    {[
                                        { label: 'Product',   col: 'name',      align: 'left'  },
                                        { label: 'Location',  col: 'location',  align: 'left'  },
                                        { label: 'Lot / S/N', col: 'lotNumber', align: 'left'  },
                                        { label: 'On Hand',   col: 'onHand',    align: 'right' },
                                        { label: 'Reserved',  col: 'reserved',  align: 'right' },
                                        { label: 'Available', col: 'available', align: 'right' },
                                        { label: 'Expiry',    col: 'expiryDate',align: 'right' },
                                    ].map(h => (
                                        <th key={h.col}
                                            className={`px-3 py-2.5 text-${h.align} cursor-pointer select-none`}
                                            style={{ color: '#6c757d', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}
                                            onClick={() => toggleSort(h.col)}
                                        >
                                            {h.label}<SortIcon col={h.col} />
                                        </th>
                                    ))}
                                    {/* Actions column */}
                                    <th className="px-4 py-2.5" style={{ color: '#6c757d', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', minWidth: '140px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(grouped).map(([groupKey, rows]) => (
                                    <React.Fragment key={groupKey}>
                                        {/* Group header */}
                                        {groupBy !== 'none' && (
                                            <tr className="cursor-pointer" style={{ backgroundColor: '#f8f9fa' }}
                                                onClick={() => toggleGroup(groupKey)}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f3f5'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            >
                                                <td></td>
                                                <td colSpan={7} className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isGroupExpanded(groupKey) ? '' : '-rotate-90'}`} style={{ color: '#6c757d' }} />
                                                        <span className="font-semibold text-xs" style={{ color: '#212529' }}>{groupKey}</span>
                                                        <span className="text-xs" style={{ color: '#adb5bd' }}>({rows.length})</span>
                                                        <span className="ml-auto text-xs tabular-nums font-mono" style={{ color: '#6c757d' }}>
                                                            {rows.reduce((s, r) => s + r.onHand, 0).toLocaleString()} on hand
                                                        </span>
                                                    </div>
                                                </td>
                                                <td></td>
                                            </tr>
                                        )}

                                        {/* Data rows */}
                                        {isGroupExpanded(groupKey) && rows.map(row => {
                                            const catalog   = PRODUCT_CATALOG[row.sku];
                                            const isLow     = row.available <= row.reorderPoint;
                                            const isExpiring = row.expiryDate && new Date(row.expiryDate) < new Date(Date.now() + 90 * 86400000);
                                            const isSel     = selected.includes(row.id);
                                            return (
                                                <tr key={row.id}
                                                    style={{
                                                        backgroundColor: isSel ? '#f9f5f8' : '#ffffff',
                                                        borderBottom: '1px solid #f0f0f0',
                                                        borderLeft: isLow ? '2px solid #dc3545' : '2px solid transparent',
                                                    }}
                                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                                >
                                                    {/* Checkbox */}
                                                    <td className="px-4 py-2.5">
                                                        <button onClick={() => toggleRow(row.id)} style={{ color: isSel ? '#714B67' : '#adb5bd' }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#714B67'}
                                                            onMouseLeave={e => e.currentTarget.style.color = isSel ? '#714B67' : '#adb5bd'}
                                                        >
                                                            {isSel ? <CheckSquare className="w-4 h-4" style={{ color: '#714B67' }} /> : <Square className="w-4 h-4" />}
                                                        </button>
                                                    </td>

                                                    {/* Product */}
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded overflow-hidden shrink-0" style={{ border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                                                {catalog?.image
                                                                    ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Package className="w-3 h-3" /></div>
                                                                }
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium leading-tight cursor-pointer hover:underline"
                                                                    style={{ color: '#017E84' }}
                                                                    onClick={e => { e.stopPropagation(); setProductModal(row._item); }}
                                                                >{row.shortName || row.name}</p>
                                                                {row.sku && <p className="text-[10px] font-mono leading-tight" style={{ color: '#adb5bd' }}>[{row.sku}]</p>}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Location */}
                                                    <td className="px-3 py-2.5">
                                                        <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                                                            style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}>
                                                            <MapPin className="w-2.5 h-2.5" />{row.location}
                                                        </span>
                                                    </td>

                                                    {/* Lot */}
                                                    <td className="px-3 py-2.5">
                                                        {row.lotNumber
                                                            ? <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                                                                style={{ backgroundColor: '#f0e8ed', color: '#714B67' }}>
                                                                <Hash className="w-2.5 h-2.5" />{row.lotNumber}
                                                              </span>
                                                            : <span style={{ color: '#dee2e6' }}>—</span>
                                                        }
                                                    </td>

                                                    {/* On Hand */}
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-semibold tabular-nums text-xs" style={{ color: '#212529' }}>{row.onHand.toLocaleString()}</span>
                                                    </td>

                                                    {/* Reserved */}
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.reserved > 0
                                                            ? <span className="font-semibold tabular-nums text-xs" style={{ color: '#ffac00' }}>{row.reserved.toLocaleString()}</span>
                                                            : <span className="text-xs" style={{ color: '#dee2e6' }}>0</span>
                                                        }
                                                    </td>

                                                    {/* Available */}
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-semibold tabular-nums text-xs" style={{ color: isLow ? '#dc3545' : '#017E84' }}>
                                                            {row.available.toLocaleString()}
                                                            {isLow && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                                                        </span>
                                                    </td>

                                                    {/* Expiry */}
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.expiryDate
                                                            ? <span className="text-xs font-mono"
                                                                style={{ color: isExpiring ? '#ffac00' : '#adb5bd', fontWeight: isExpiring ? 600 : 400 }}>
                                                                {row.expiryDate}
                                                                {isExpiring && <AlertTriangle className="w-2.5 h-2.5 inline ml-1" />}
                                                              </span>
                                                            : <span className="text-xs" style={{ color: '#dee2e6' }}>—</span>
                                                        }
                                                    </td>

                                                    {/* Row actions */}
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-3 justify-end">
                                                            <button
                                                                onClick={e => { e.stopPropagation(); openHistory(row._item); }}
                                                                className="text-xs flex items-center gap-1 transition-colors"
                                                                style={{ color: '#6c757d' }}
                                                                title="Stock History"
                                                                onMouseEnter={e => e.currentTarget.style.color = '#017E84'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#6c757d'}
                                                            >
                                                                <History className="w-3 h-3" /> History
                                                            </button>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setReplenishModal(row._item); setReplenishQty(50); }}
                                                                className="text-xs flex items-center gap-1 transition-colors"
                                                                style={{ color: '#6c757d' }}
                                                                title="Replenishment"
                                                                onMouseEnter={e => e.currentTarget.style.color = '#017E84'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#6c757d'}
                                                            >
                                                                <RotateCcw className="w-3 h-3" /> Replenish
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-5 py-16 text-center" style={{ color: '#adb5bd' }}>
                                            <Boxes className="w-9 h-9 mx-auto mb-2.5 opacity-20" />
                                            <p className="text-sm">No inventory records found</p>
                                            {(activeFilters.length > 0 || warehouseFilter !== 'All' || categoryFilter !== 'All') &&
                                                <p className="text-xs mt-1">Try clearing your filters</p>}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Bottom pagination bar ── */}
                    {totalRecords > PAGE_SIZE && (
                        <div className="px-4 py-2.5 flex items-center justify-between text-xs" style={{ borderTop: '1px solid #dee2e6', color: '#6c757d' }}>
                            <span>{pageStart + 1}–{pageEnd} of {totalRecords} records</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(1)} disabled={safePage === 1}
                                    className="px-2 py-1 rounded disabled:opacity-30 transition-colors"
                                    style={{ border: '1px solid #dee2e6' }}
                                    onMouseEnter={e => { if (safePage > 1) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >«</button>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                    className="px-2 py-1 rounded disabled:opacity-30 transition-colors"
                                    style={{ border: '1px solid #dee2e6' }}
                                    onMouseEnter={e => { if (safePage > 1) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >‹</button>
                                <span className="px-3 py-1 rounded font-semibold" style={{ border: '1px solid #017E84', color: '#017E84' }}>{safePage}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    className="px-2 py-1 rounded disabled:opacity-30 transition-colors"
                                    style={{ border: '1px solid #dee2e6' }}
                                    onMouseEnter={e => { if (safePage < totalPages) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >›</button>
                                <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                                    className="px-2 py-1 rounded disabled:opacity-30 transition-colors"
                                    style={{ border: '1px solid #dee2e6' }}
                                    onMouseEnter={e => { if (safePage < totalPages) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >»</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Product Detail Modal (Odoo form view style) ──────────────── */}
            {productModal && (() => {
                const pm      = productModal;
                const catalog = PRODUCT_CATALOG[pm.sku] || {};
                const totalLotQty = (pm.lots || []).reduce((s, l) => s + (l.qty || 0), 0);
                const stockValue  = (pm.onHand || 0) * (pm.unitCost || 0);
                const isLow       = (pm.available ?? pm.onHand) <= (pm.reorderPoint || 10);
                return (
                    <div className="fixed inset-0 flex items-start justify-center z-[110] pt-16 px-4"
                        style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}
                        onClick={() => setProductModal(null)}
                    >
                        <div className="w-full max-w-2xl overflow-hidden"
                            style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', overflowY: 'auto' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header breadcrumb */}
                            <div className="px-5 py-3 flex items-center justify-between shrink-0"
                                style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                <div className="flex items-center gap-2 text-xs" style={{ color: '#6c757d' }}>
                                    <span style={{ color: '#adb5bd' }}>Inventory</span>
                                    <span style={{ color: '#dee2e6' }}>/</span>
                                    <span className="font-semibold" style={{ color: '#212529' }}>{pm.shortName || pm.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setProductModal(null)}
                                        className="p-1.5 rounded transition-colors"
                                        style={{ color: '#6c757d' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    ><X className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-5">
                                {/* Product header row */}
                                <div className="flex gap-4 mb-5">
                                    <div className="w-20 h-20 rounded overflow-hidden shrink-0"
                                        style={{ border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                        {catalog.image
                                            ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Package className="w-8 h-8" /></div>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-base font-semibold mb-0.5" style={{ color: '#212529' }}>{pm.name}</h2>
                                        {pm.shortName && pm.shortName !== pm.name &&
                                            <p className="text-xs mb-1" style={{ color: '#6c757d' }}>{pm.shortName}</p>}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {pm.sku && (
                                                <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded"
                                                    style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}>
                                                    <Hash className="w-3 h-3" />{pm.sku}
                                                </span>
                                            )}
                                            {pm.location && (
                                                <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded"
                                                    style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}>
                                                    <MapPin className="w-3 h-3" />{pm.location}
                                                </span>
                                            )}
                                            {isLow && (
                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold"
                                                    style={{ backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffc107' }}>
                                                    <AlertTriangle className="w-3 h-3" /> Low Stock
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stock KPI cards */}
                                <div className="grid grid-cols-4 gap-3 mb-5">
                                    {[
                                        { label: 'On Hand',    value: (pm.onHand || 0).toLocaleString(),    color: '#212529',  bg: '#f8f9fa' },
                                        { label: 'Reserved',   value: (pm.reserved || 0).toLocaleString(),  color: '#ffac00',  bg: '#fff8e6' },
                                        { label: 'Available',  value: ((pm.available ?? pm.onHand) || 0).toLocaleString(), color: '#017E84', bg: '#e8f8fb' },
                                        { label: 'Stock Value',value: `฿${stockValue.toLocaleString()}`,    color: '#495057',  bg: '#f8f9fa' },
                                    ].map((k, i) => (
                                        <div key={i} className="rounded p-3 text-center"
                                            style={{ backgroundColor: k.bg, border: '1px solid #dee2e6' }}>
                                            <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: '#adb5bd' }}>{k.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Info fields — 2 columns */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5 text-sm">
                                    {[
                                        { label: 'Unit Cost',      value: pm.unitCost ? `฿${pm.unitCost.toLocaleString()}` : '—' },
                                        { label: 'Reorder Point',  value: (pm.reorderPoint || 10).toLocaleString() },
                                        { label: 'Category',       value: pm.category || '—' },
                                        { label: 'Product ID',     value: pm.productId || '—' },
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0 pt-0.5" style={{ color: '#adb5bd', minWidth: '100px' }}>{f.label}</span>
                                            <span className="text-xs font-medium" style={{ color: '#212529' }}>{f.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Lot table */}
                                {pm.lots && pm.lots.length > 0 && (
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#adb5bd' }}>
                                            Lot / Serial Numbers
                                        </p>
                                        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: '#6c757d' }}>Lot / S/N</th>
                                                        <th className="px-3 py-2 text-right font-semibold" style={{ color: '#6c757d' }}>Qty</th>
                                                        <th className="px-3 py-2 text-right font-semibold" style={{ color: '#6c757d' }}>Received</th>
                                                        <th className="px-3 py-2 text-right font-semibold" style={{ color: '#6c757d' }}>Expiry</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pm.lots.map((lot, li) => {
                                                        const expiring = lot.expiryDate && new Date(lot.expiryDate) < new Date(Date.now() + 90 * 86400000);
                                                        return (
                                                            <tr key={li} style={{ borderBottom: li < pm.lots.length - 1 ? '1px solid #f0f0f0' : 'none' }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >
                                                                <td className="px-3 py-2">
                                                                    <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0e8ed', color: '#714B67' }}>
                                                                        {lot.lotNumber}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: '#212529' }}>{(lot.qty || 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right font-mono" style={{ color: '#adb5bd' }}>{lot.receivedDate || '—'}</td>
                                                                <td className="px-3 py-2 text-right font-mono" style={{ color: expiring ? '#ffac00' : '#adb5bd', fontWeight: expiring ? 600 : 400 }}>
                                                                    {lot.expiryDate || '—'}
                                                                    {expiring && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                                        <td className="px-3 py-1.5 font-semibold" style={{ color: '#6c757d' }}>Total</td>
                                                        <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: '#212529' }}>{totalLotQty.toLocaleString()}</td>
                                                        <td colSpan={2}></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Action links row */}
                                <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid #dee2e6' }}>
                                    <button
                                        onClick={() => { setProductModal(null); openHistory(pm); }}
                                        className="flex items-center gap-1.5 text-xs transition-colors font-medium"
                                        style={{ color: '#017E84' }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#015f64'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#017E84'}>
                                        <History className="w-3.5 h-3.5" /> Stock History
                                    </button>
                                    <button
                                        onClick={() => { setProductModal(null); setReplenishModal(pm); setReplenishQty(50); }}
                                        className="flex items-center gap-1.5 text-xs transition-colors font-medium"
                                        style={{ color: '#017E84' }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#015f64'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#017E84'}>
                                        <RotateCcw className="w-3.5 h-3.5" /> Replenishment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── History Modal ─────────────────────────────────────────────── */}
            {historyModal && (
                <div className="fixed inset-0 flex items-start justify-center z-[120] pt-16 px-4"
                    style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}
                    onClick={() => setHistoryModal(null)}
                >
                    <div className="w-full max-w-2xl overflow-hidden"
                        style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-3 flex items-center justify-between shrink-0"
                            style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <div className="flex items-center gap-2 text-xs" style={{ color: '#6c757d' }}>
                                <span style={{ color: '#adb5bd' }}>Inventory</span>
                                <span style={{ color: '#dee2e6' }}>/</span>
                                <span className="font-semibold" style={{ color: '#212529' }}>{historyModal.item.shortName || historyModal.item.name}</span>
                                <span style={{ color: '#dee2e6' }}>/</span>
                                <span style={{ color: '#017E84' }}>Stock History</span>
                            </div>
                            <button onClick={() => setHistoryModal(null)}
                                className="p-1.5 rounded" style={{ color: '#6c757d' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            ><X className="w-4 h-4" /></button>
                        </div>

                        {/* Product info strip */}
                        <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid #dee2e6' }}>
                            <div className="w-9 h-9 rounded overflow-hidden shrink-0" style={{ border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                {PRODUCT_CATALOG[historyModal.item.sku]?.image
                                    ? <img src={PRODUCT_CATALOG[historyModal.item.sku].image} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Package className="w-4 h-4" /></div>
                                }
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#212529' }}>{historyModal.item.name}</p>
                                <p className="text-[10px] font-mono" style={{ color: '#adb5bd' }}>
                                    {historyModal.item.sku} · Current on-hand: <span className="font-semibold" style={{ color: '#017E84' }}>{(historyModal.item.onHand || 0).toLocaleString()}</span>
                                </p>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {historyModal.loading && (
                                <div className="flex items-center justify-center py-16" style={{ color: '#adb5bd' }}>
                                    <RefreshCw className="w-5 h-5 animate-spin mr-2" style={{ color: '#017E84' }} />
                                    <span className="text-sm">Fetching from Odoo…</span>
                                </div>
                            )}
                            {!historyModal.loading && historyModal.rows.length === 0 && (
                                <div className="py-16 text-center" style={{ color: '#adb5bd' }}>
                                    <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No movement history found</p>
                                </div>
                            )}
                            {!historyModal.loading && historyModal.rows.length > 0 && (
                            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0 }}>
                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                        <th className="px-4 py-2.5 text-left font-semibold" style={{ color: '#6c757d' }}>Date</th>
                                        <th className="px-4 py-2.5 text-left font-semibold" style={{ color: '#6c757d' }}>Type</th>
                                        <th className="px-4 py-2.5 text-left font-semibold" style={{ color: '#6c757d' }}>Reference</th>
                                        <th className="px-4 py-2.5 text-left font-semibold" style={{ color: '#6c757d' }}>Partner</th>
                                        <th className="px-4 py-2.5 text-right font-semibold" style={{ color: '#6c757d' }}>Qty</th>
                                        <th className="px-4 py-2.5 text-right font-semibold" style={{ color: '#6c757d' }}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyModal.rows.map((mv, i) => {
                                        const typeConfig = {
                                            delivery:   { label: 'Delivery',    icon: <Truck className="w-3 h-3" />,         color: '#dc3545', bg: '#fff5f5' },
                                            receipt:    { label: 'Receipt',     icon: <PackageCheck className="w-3 h-3" />,  color: '#28a745', bg: '#f0fdf4' },
                                            adjustment: { label: 'Adjustment',  icon: <Check className="w-3 h-3" />,         color: '#6c757d', bg: '#f8f9fa' },
                                        }[mv.type] || { label: mv.type, icon: null, color: '#6c757d', bg: 'transparent' };
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <td className="px-4 py-2.5 font-mono" style={{ color: '#6c757d' }}>{mv.date}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
                                                        style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}>
                                                        {typeConfig.icon} {typeConfig.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 font-mono" style={{ color: '#017E84' }}>{mv.ref}</td>
                                                <td className="px-4 py-2.5" style={{ color: '#495057' }}>{mv.partner}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums"
                                                    style={{ color: mv.qty > 0 ? '#28a745' : '#dc3545' }}>
                                                    {mv.qty > 0 ? '+' : ''}{mv.qty.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: '#212529' }}>
                                                    {mv.balance.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            )}
                        </div>

                        <div className="px-5 py-2.5 text-xs shrink-0 flex items-center gap-2" style={{ borderTop: '1px solid #dee2e6', color: '#adb5bd', backgroundColor: '#f8f9fa' }}>
                            {historyModal.loading
                                ? <><RefreshCw className="w-3 h-3 animate-spin" style={{ color: '#017E84' }} /> Loading from Odoo…</>
                                : <>
                                    <span className={`w-1.5 h-1.5 rounded-full inline-block`}
                                        style={{ backgroundColor: historyModal.isLive ? '#28a745' : '#ffac00' }} />
                                    {historyModal.isLive
                                        ? `Live from Odoo · ${historyModal.rows.length} movements`
                                        : `Mock data · ${historyModal.rows.length} movements`}
                                  </>
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* ── Replenish Modal ───────────────────────────────────────────── */}
            {replenishModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[120]"
                    style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}
                    onClick={() => setReplenishModal(null)}
                >
                    <div className="w-full max-w-sm overflow-hidden"
                        style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-3 flex items-center justify-between"
                            style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                                <RotateCcw className="w-4 h-4" style={{ color: '#017E84' }} /> Replenishment
                            </h3>
                            <button onClick={() => setReplenishModal(null)}
                                className="p-1.5 rounded" style={{ color: '#6c757d' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            ><X className="w-4 h-4" /></button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            {/* Product strip */}
                            <div className="flex items-center gap-3 p-3 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                                <div className="w-10 h-10 rounded overflow-hidden shrink-0" style={{ border: '1px solid #dee2e6' }}>
                                    {PRODUCT_CATALOG[replenishModal.sku]?.image
                                        ? <img src={PRODUCT_CATALOG[replenishModal.sku].image} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6', backgroundColor: '#f8f9fa' }}><Package className="w-4 h-4" /></div>
                                    }
                                </div>
                                <div>
                                    <p className="font-semibold text-sm" style={{ color: '#212529' }}>{replenishModal.shortName || replenishModal.name}</p>
                                    <p className="text-[10px] font-mono" style={{ color: '#adb5bd' }}>
                                        {replenishModal.sku} · Available: <span style={{ color: '#017E84', fontWeight: 600 }}>{(replenishModal.available ?? replenishModal.onHand ?? 0).toLocaleString()}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Qty */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#6c757d' }}>Quantity to Order</label>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setReplenishQty(q => Math.max(1, q - 10))}
                                        className="w-9 h-9 rounded flex items-center justify-center transition-colors"
                                        style={{ backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #dee2e6' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                    ><Minus className="w-4 h-4" /></button>
                                    <input type="number" value={replenishQty} onChange={e => setReplenishQty(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="flex-1 text-center text-xl font-bold py-2 outline-none"
                                        style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529' }} />
                                    <button onClick={() => setReplenishQty(q => q + 10)}
                                        className="w-9 h-9 rounded flex items-center justify-center transition-colors"
                                        style={{ backgroundColor: '#f8f9fa', color: '#495057', border: '1px solid #dee2e6' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                    ><ArrowUpCircle className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Route */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#6c757d' }}>Route</label>
                                <select className="w-full px-3 py-2 text-sm outline-none"
                                    style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529', backgroundColor: '#ffffff' }}>
                                    <option>Buy</option>
                                    <option>Manufacture</option>
                                    <option>Resupply Subcontractor</option>
                                </select>
                            </div>

                            {/* Scheduled date */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#6c757d' }}>Scheduled Date</label>
                                <input type="date"
                                    defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 text-sm outline-none"
                                    style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529' }} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <button onClick={() => setReplenishModal(null)}
                                className="px-4 py-1.5 text-xs rounded transition-colors"
                                style={{ border: '1px solid #dee2e6', color: '#495057', backgroundColor: 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >Cancel</button>
                            <button
                                onClick={() => {
                                    addToast(`Replenishment order created: ${replenishModal.sku || replenishModal.name} × ${replenishQty}`);
                                    setReplenishModal(null);
                                }}
                                className="px-4 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                                style={{ backgroundColor: '#017E84', color: '#ffffff', border: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#015f64'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#017E84'}
                            >
                                <Check className="w-3.5 h-3.5" /> Confirm Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
