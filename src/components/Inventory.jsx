import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Minus, AlertTriangle, Package, Tag, X, Check, RefreshCw, ChevronDown, ChevronRight, Filter, ArrowUpDown, MapPin, Hash, Boxes, TrendingDown, CheckSquare, Square, History, RotateCcw, ChevronLeft, ArrowUpCircle, Truck, PackageCheck, Settings, Plus, Eye, ShoppingCart, BarChart2, TrendingUp, ArrowRightLeft, Layers, DollarSign, Clock, Calendar, ExternalLink, Shield, Info } from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';
import {
    fetchStockHistory, fetchAllLocations, getStoredAllowedLocations, saveAllowedLocations,
    fetchFullInventory, fetchProductDetail, fetchSupplierInfo, fetchSalesHistory,
    fetchStockByLocation, fetchStockForecast, fetchReorderRules, createReorderRule,
    updateReorderRule, createInternalTransfer,
} from '../services/odooApi';

// ── Warehouse / Category filter data ──────────────────────────────────────────
const WAREHOUSES = ['All', 'WH - Main', 'WH - Store B'];
const CATEGORIES = ['All', 'Skincare', 'Serum', 'Toner', 'Sunscreen', 'Mask', 'Body Care'];
const VIEW_MODES = { PICKFACE: 'pickface', ALL: 'all' };

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
    // Modals
    const [productModal, setProductModal] = useState(null);
    const [productDetailTab, setProductDetailTab] = useState('general');
    const [productDetailData, setProductDetailData] = useState({});
    const [historyModal, setHistoryModal] = useState(null);
    const [replenishModal, setReplenishModal] = useState(null);
    const [replenishQty, setReplenishQty] = useState(50);
    // View mode & full inventory
    const [viewMode, setViewMode] = useState(VIEW_MODES.PICKFACE);
    const [allLocationInventory, setAllLocationInventory] = useState(null);
    const [loadingAllLoc, setLoadingAllLoc] = useState(false);
    // Internal Transfer
    const [transferModal, setTransferModal] = useState(null);
    const [transferLines, setTransferLines] = useState([]);
    const [transferSrc, setTransferSrc] = useState('');
    const [transferDest, setTransferDest] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);
    // Reorder Rules
    const [showReorderPanel, setShowReorderPanel] = useState(false);
    const [reorderRules, setReorderRules] = useState([]);
    const [reorderLoading, setReorderLoading] = useState(false);
    // Location config
    const [allowedLocations, setAllowedLocations] = useState(() => getStoredAllowedLocations());
    const [showLocConfig, setShowLocConfig] = useState(false);
    const [allOdooLocations, setAllOdooLocations] = useState([]);
    const [newLocInput, setNewLocInput] = useState('');
    const PAGE_SIZE = 80;

    const odooConfig = apiConfigs?.odoo;
    const isLiveMode = odooConfig?.useMock === false;

    // Load Odoo locations when config panel opens
    useEffect(() => {
        if (showLocConfig || transferModal) {
            fetchAllLocations(odooConfig || {}).then(locs => setAllOdooLocations(locs)).catch(() => {});
        }
    }, [showLocConfig, transferModal, odooConfig]);

    // Fetch full inventory when switching to All Locations view
    useEffect(() => {
        if (viewMode === VIEW_MODES.ALL && !allLocationInventory) {
            setLoadingAllLoc(true);
            fetchFullInventory(odooConfig || {})
                .then(data => { setAllLocationInventory(data); setLoadingAllLoc(false); })
                .catch(() => setLoadingAllLoc(false));
        }
    }, [viewMode, odooConfig]);

    const saveLocations = (list) => {
        setAllowedLocations(list);
        saveAllowedLocations(list);
    };

    // ── No mock history — return empty when not connected to Odoo ────────────
    const getMockHistory = () => [];

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
        if (viewMode === VIEW_MODES.ALL) return true;
        if (!loc) return true;
        if (allowedLocations.length === 0) return true;
        return allowedLocations.some(kw => loc.toLowerCase().includes(kw.toLowerCase()));
    };

    // ── active inventory source based on view mode ──────────────────────────
    const activeInventory = viewMode === VIEW_MODES.ALL ? (allLocationInventory || []) : (inventory || []);

    // ── flatten inventory rows ────────────────────────────────────────────────
    const flatRows = useMemo(() => {
        if (!activeInventory || !Array.isArray(activeInventory)) return [];
        const rows = [];
        let idx = 0;
        for (const item of activeInventory) {
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
    }, [activeInventory, viewMode, allowedLocations]);

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

    // ── grouping ──────────────────────────────────────────────────────────────
    const grouped = useMemo(() => {
        if (groupBy === 'none') return { '': pagedRows };
        const g = {};
        for (const row of pagedRows) {
            const key = groupBy === 'product' ? (row.shortName || row.name) : groupBy === 'location' ? row.location : groupBy === 'lot' ? (row.lotNumber || '(No Lot)') : '';
            if (!g[key]) g[key] = [];
            g[key].push(row);
        }
        return g;
    }, [pagedRows, groupBy]);

    // ── Dashboard stats ───────────────────────────────────────────────────────
    const dashStats = useMemo(() => {
        const rows = flatRows;
        const uniqueSkus = new Set(rows.map(r => r.sku)).size;
        let totalOnHand = 0, totalReserved = 0, totalValue = 0, lowStock = 0, expiringLots = 0;
        let pickfaceUnits = 0, bulkUnits = 0;
        const now = Date.now();
        const thirtyDays = 30 * 86400000;
        for (const r of rows) {
            totalOnHand += r.onHand;
            totalReserved += r.reserved;
            totalValue += r.onHand * r.unitCost;
            if (r.available <= r.reorderPoint) lowStock++;
            if (r.expiryDate && new Date(r.expiryDate).getTime() < now + thirtyDays) expiringLots++;
            if (r.location.toLowerCase().includes('pickface')) pickfaceUnits += r.onHand;
            else bulkUnits += r.onHand;
        }
        return { uniqueSkus, totalOnHand, totalReserved, totalValue, lowStock, expiringLots, pickfaceUnits, bulkUnits, available: totalOnHand - totalReserved };
    }, [flatRows]);

    const allPageIds  = pagedRows.map(r => r.id);
    const allSelected = allPageIds.length > 0 && allPageIds.every(id => selected.includes(id));
    const toggleAll   = () => setSelected(allSelected ? [] : allPageIds);
    const toggleRow   = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    const SortIcon = ({ col }) => (
        <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-60"
            style={{ color: sortBy.col === col ? '#017E84' : '#dee2e6' }} />
    );

    // ── Open history ──────────────────────────────────────────────────────────
    const openHistory = useCallback(async (item) => {
        setHistoryModal({ item, rows: [], loading: true });
        if (isLiveMode && item.productId) {
            const rows = await fetchStockHistory(odooConfig, item.productId, allowedLocations, 50);
            if (rows) { setHistoryModal({ item, rows, loading: false, isLive: true }); return; }
        }
        setHistoryModal({ item, rows: getMockHistory(item), loading: false, isLive: false });
    }, [isLiveMode, odooConfig, allowedLocations]);

    // ── Open product detail with tab data ──────────────────────────────────────
    const openProductDetail = useCallback(async (item) => {
        setProductModal(item);
        setProductDetailTab('general');
        setProductDetailData({ loading: true });
        if (item.productId) {
            const detail = await fetchProductDetail(odooConfig || {}, item.productId);
            setProductDetailData(prev => ({ ...prev, general: detail, loading: false }));
        } else {
            setProductDetailData({ loading: false });
        }
    }, [odooConfig]);

    // Lazy-load tab data
    const loadTabData = useCallback(async (tab, item) => {
        if (!item?.productId || productDetailData[tab]) return;
        setProductDetailData(prev => ({ ...prev, [`${tab}Loading`]: true }));
        let data;
        switch (tab) {
            case 'purchase': data = await fetchSupplierInfo(odooConfig || {}, item.productId); break;
            case 'sale': data = await fetchSalesHistory(odooConfig || {}, item.productId); break;
            case 'inventory': data = await fetchStockByLocation(odooConfig || {}, item.productId); break;
            case 'forecast': data = await fetchStockForecast(odooConfig || {}, item.productId); break;
            default: return;
        }
        setProductDetailData(prev => ({ ...prev, [tab]: data, [`${tab}Loading`]: false }));
    }, [odooConfig, productDetailData]);

    // Load reorder rules
    const loadReorderRules = useCallback(async () => {
        setReorderLoading(true);
        const rules = await fetchReorderRules(odooConfig || {});
        setReorderRules(rules);
        setReorderLoading(false);
    }, [odooConfig]);

    // ── Open internal transfer ────────────────────────────────────────────────
    const openTransfer = (item) => {
        setTransferModal(item);
        setTransferLines([{ productId: item?.productId, name: item?.shortName || item?.name || '', sku: item?.sku || '', qty: 50 }]);
        setTransferSrc('');
        setTransferDest('');
    };

    const executeTransfer = async () => {
        if (!transferSrc || !transferDest || transferLines.length === 0) {
            addToast('Please fill all fields', 'error'); return;
        }
        setTransferLoading(true);
        const result = await createInternalTransfer(odooConfig || {}, {
            srcLocationId: parseInt(transferSrc), destLocationId: parseInt(transferDest),
            lines: transferLines.map(l => ({ productId: l.productId, qty: l.qty, name: l.name })),
        });
        setTransferLoading(false);
        if (result.status === 'success') {
            addToast(`Internal transfer created: ${result.picking_id}`, 'success');
            setTransferModal(null);
            // Refresh full inventory if in that view
            if (viewMode === VIEW_MODES.ALL) {
                fetchFullInventory(odooConfig || {}).then(d => setAllLocationInventory(d)).catch(() => {});
            }
        } else {
            addToast(`Transfer failed: ${result.error || 'Unknown error'}`, 'error');
        }
    };

    // ── Left panel section ────────────────────────────────────────────────────
    const LeftSection = ({ title, options, value, onChange }) => {
        const [open, setOpen] = useState(true);
        return (
            <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                <button onClick={() => setOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-2.5"
                    style={{ color: '#6c757d', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {title}
                    <ChevronDown className={`w-3 h-3 transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>
                {open && (
                    <div className="pb-1.5">
                        {options.map(opt => {
                            const isActive = value === opt;
                            return (
                                <button key={opt} onClick={() => { onChange(opt); setPage(1); }}
                                    className="w-full text-left px-4 py-1.5 text-xs transition-colors"
                                    style={{ color: isActive ? '#714B67' : '#495057', fontWeight: isActive ? 600 : 400,
                                        backgroundColor: isActive ? '#f5f0f4' : 'transparent',
                                        borderLeft: isActive ? '3px solid #714B67' : '3px solid transparent' }}
                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}>
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
                    <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #dee2e6' }}>
                        <span className="text-xs font-semibold" style={{ color: '#212529' }}>Filters</span>
                        <button onClick={() => setLeftPanelOpen(false)} style={{ color: '#adb5bd' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#495057'}
                            onMouseLeave={e => e.currentTarget.style.color = '#adb5bd'}>
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* View Mode Switcher */}
                    <div style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 12px' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6c757d' }}>View Mode</p>
                        <div className="flex rounded overflow-hidden" style={{ border: '1px solid #dee2e6' }}>
                            {[{ key: VIEW_MODES.PICKFACE, label: 'PICKFACE' }, { key: VIEW_MODES.ALL, label: 'All Loc.' }].map(v => (
                                <button key={v.key}
                                    onClick={() => { setViewMode(v.key); setPage(1); }}
                                    className="flex-1 py-1.5 text-[10px] font-semibold transition-colors"
                                    style={{
                                        backgroundColor: viewMode === v.key ? '#714B67' : '#ffffff',
                                        color: viewMode === v.key ? '#ffffff' : '#6c757d',
                                        border: 'none',
                                    }}>
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <LeftSection title="Warehouses" options={WAREHOUSES} value={warehouseFilter} onChange={setWarehouseFilter} />
                    <LeftSection title="Category" options={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} />

                    {/* Location config */}
                    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <button onClick={() => setShowLocConfig(s => !s)}
                            className="w-full flex items-center justify-between px-4 py-2.5"
                            style={{ color: '#6c757d', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            <span className="flex items-center gap-1.5"><Settings className="w-3 h-3" /> Locations</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${showLocConfig ? '' : '-rotate-90'}`} />
                        </button>
                        {showLocConfig && (
                            <div className="px-3 pb-3 space-y-1.5">
                                <p className="text-[10px] mb-2" style={{ color: '#adb5bd' }}>
                                    {isLiveMode ? 'Live — pulling from Odoo' : 'Mock mode'}
                                </p>
                                {allowedLocations.map((loc, i) => (
                                    <div key={i} className="flex items-center gap-1.5 group">
                                        <span className="flex-1 text-[11px] font-mono px-2 py-1 rounded truncate"
                                            style={{ backgroundColor: '#f0e8ed', color: '#714B67', border: '1px solid #d9c0d3' }}>{loc}</span>
                                        <button onClick={() => saveLocations(allowedLocations.filter((_, j) => j !== i))}
                                            className="opacity-50 hover:opacity-100 shrink-0" style={{ color: '#dc3545' }} title="Remove">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {allOdooLocations.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#adb5bd' }}>Add from Odoo</p>
                                        <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                            {allOdooLocations.filter(l => !allowedLocations.includes(l.complete_name)).map(l => (
                                                <button key={l.id}
                                                    onClick={() => saveLocations([...allowedLocations, l.complete_name])}
                                                    className="w-full text-left text-[11px] font-mono px-2 py-1 rounded mb-0.5 transition-colors truncate"
                                                    style={{ color: '#495057', backgroundColor: 'transparent' }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e8f8fb'; e.currentTarget.style.color = '#017E84'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#495057'; }}>
                                                    + {l.complete_name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-1 mt-2">
                                    <input value={newLocInput} onChange={e => setNewLocInput(e.target.value)}
                                        placeholder="Type keyword..."
                                        className="flex-1 text-[11px] px-2 py-1 outline-none font-mono"
                                        style={{ border: '1px solid #dee2e6', borderRadius: '3px', color: '#212529' }}
                                        onKeyDown={e => { if (e.key === 'Enter' && newLocInput.trim()) { saveLocations([...allowedLocations, newLocInput.trim()]); setNewLocInput(''); } }} />
                                    <button onClick={() => { if (newLocInput.trim()) { saveLocations([...allowedLocations, newLocInput.trim()]); setNewLocInput(''); }}}
                                        className="px-2 py-1 text-xs rounded" style={{ backgroundColor: '#017E84', color: '#fff', border: 'none' }}>
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                {allowedLocations.length > 0 && (
                                    <button onClick={() => saveLocations([])} className="text-[10px] underline mt-1" style={{ color: '#dc3545' }}>Clear all (show everything)</button>
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
                                <button key={f.key} onClick={() => { toggleFilter(f.key); setPage(1); }}
                                    className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors"
                                    style={{ color: isActive ? '#714B67' : '#495057', fontWeight: isActive ? 600 : 400,
                                        backgroundColor: isActive ? '#f5f0f4' : 'transparent',
                                        borderLeft: isActive ? '3px solid #714B67' : '3px solid transparent' }}
                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                    {f.icon} {f.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tools */}
                    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6c757d' }}>Tools</p>
                        <button onClick={() => { setShowReorderPanel(true); loadReorderRules(); }}
                            className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors"
                            style={{ color: '#495057' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <Shield className="w-3.5 h-3.5" /> Min/Max Rules
                        </button>
                        <button onClick={() => openTransfer(null)}
                            className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors"
                            style={{ color: '#495057' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Internal Transfer
                        </button>
                    </div>
                </div>
            )}

            {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col" style={{ minWidth: 0, overflowY: 'auto' }}>

                {/* ── Dashboard Summary Cards ── */}
                <div className="grid grid-cols-4 gap-3 mb-3" style={{ padding: '0' }}>
                    {[
                        { label: 'Total SKUs', value: dashStats.uniqueSkus.toLocaleString(), icon: <Package className="w-4 h-4" />, color: '#714B67', bg: '#f9f5f8' },
                        { label: 'Stock Value', value: `${(dashStats.totalValue / 1000).toFixed(0)}K`, icon: <DollarSign className="w-4 h-4" />, color: '#017E84', bg: '#e8f8fb' },
                        { label: 'Low Stock', value: dashStats.lowStock.toLocaleString(), icon: <TrendingDown className="w-4 h-4" />, color: dashStats.lowStock > 0 ? '#dc3545' : '#28a745', bg: dashStats.lowStock > 0 ? '#fff5f5' : '#f0fdf4' },
                        { label: 'Expiring (<30d)', value: dashStats.expiringLots.toLocaleString(), icon: <AlertTriangle className="w-4 h-4" />, color: dashStats.expiringLots > 0 ? '#ffac00' : '#28a745', bg: dashStats.expiringLots > 0 ? '#fff8e6' : '#f0fdf4' },
                    ].map((c, i) => (
                        <div key={i} className="rounded p-3 flex items-center gap-3" style={{ backgroundColor: c.bg, border: '1px solid #dee2e6' }}>
                            <div className="p-2 rounded" style={{ backgroundColor: `${c.color}15`, color: c.color }}>{c.icon}</div>
                            <div>
                                <p className="text-lg font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#adb5bd' }}>{c.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Second row: PICKFACE / Bulk / Reserved / Available */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                    {[
                        { label: 'PICKFACE', value: dashStats.pickfaceUnits.toLocaleString(), color: '#714B67' },
                        { label: 'Bulk / WH', value: dashStats.bulkUnits.toLocaleString(), color: '#495057' },
                        { label: 'Reserved', value: dashStats.totalReserved.toLocaleString(), color: '#ffac00' },
                        { label: 'Available', value: dashStats.available.toLocaleString(), color: '#017E84' },
                    ].map((c, i) => (
                        <div key={i} className="rounded px-3 py-2 text-center" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6' }}>
                            <p className="text-base font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#adb5bd' }}>{c.label}</p>
                        </div>
                    ))}
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', margin: '0 0 1rem 0', overflow: 'visible' }}>

                    {/* ── Toolbar ── */}
                    <div className="px-4 py-2.5 flex flex-wrap gap-2 items-center" style={{ borderBottom: '1px solid #dee2e6' }}>
                        {!leftPanelOpen && (
                            <button onClick={() => setLeftPanelOpen(true)}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: '#6c757d', border: '1px solid #dee2e6' }} title="Show Filters Panel"
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#714B67'; e.currentTarget.style.color = '#714B67'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.color = '#6c757d'; }}>
                                <Filter className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {/* View mode badge */}
                        <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{
                            backgroundColor: viewMode === VIEW_MODES.ALL ? '#e8f8fb' : '#f9f5f8',
                            color: viewMode === VIEW_MODES.ALL ? '#017E84' : '#714B67',
                            border: `1px solid ${viewMode === VIEW_MODES.ALL ? '#b2e0e4' : '#d9c0d3'}`,
                        }}>
                            {viewMode === VIEW_MODES.ALL ? 'ALL LOCATIONS' : 'PICKFACE'}
                        </span>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[160px] max-w-xs">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#adb5bd' }} />
                            <input type="text" value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                placeholder="Search products, lots, locations..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm outline-none"
                                style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529', backgroundColor: '#ffffff' }}
                                onFocus={e => e.currentTarget.style.borderColor = '#017E84'}
                                onBlur={e => e.currentTarget.style.borderColor = '#dee2e6'} />
                        </div>

                        {/* Filters dropdown */}
                        <div className="relative">
                            <button onClick={() => { setShowFilters(s => !s); setShowGroupBy(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
                                style={{ border: '1px solid #dee2e6', color: '#495057', backgroundColor: 'transparent',
                                    ...(activeFilters.length > 0 ? { color: '#714B67', borderColor: '#714B67', backgroundColor: '#f9f5f8' } : {}) }}>
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
                                            onMouseLeave={e => { if (!activeFilters.includes(f.key)) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            {f.icon} {f.label}
                                            {activeFilters.includes(f.key) && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Group By */}
                        <div className="relative">
                            <button onClick={() => { setShowGroupBy(s => !s); setShowFilters(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
                                style={{ border: '1px solid #dee2e6', color: '#495057', backgroundColor: 'transparent',
                                    ...(groupBy !== 'none' ? { color: '#017E84', borderColor: '#017E84', backgroundColor: '#e8f8fb' } : {}) }}>
                                Group By{groupBy !== 'none' && <span className="font-semibold">: {groupOptions.find(g => g.key === groupBy)?.label}</span>}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showGroupBy && (
                                <div className="absolute top-full mt-1 left-0 z-50 min-w-[160px] py-1" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5" style={{ color: '#adb5bd' }}>Group By</p>
                                    {groupOptions.map(g => (
                                        <button key={g.key} onClick={() => { setGroupBy(g.key); setShowGroupBy(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                                            style={{ backgroundColor: groupBy === g.key ? '#e8f8fb' : 'transparent', color: groupBy === g.key ? '#017E84' : '#212529', fontWeight: groupBy === g.key ? 600 : 400 }}>
                                            {g.label} {groupBy === g.key && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right side */}
                        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: '#6c757d' }}>
                            {selected.length > 0 && (
                                <span className="px-2 py-0.5 font-semibold rounded" style={{ backgroundColor: '#f9f5f8', color: '#714B67', border: '1px solid #e0cfe0' }}>{selected.length} selected</span>
                            )}
                            <span className="tabular-nums">
                                {totalRecords === 0 ? '0' : `${pageStart + 1}-${pageEnd}`}{' / '}
                                <span className="font-semibold" style={{ color: '#212529' }}>{totalRecords}</span>
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                    className="p-1 rounded disabled:opacity-30 transition-colors" style={{ color: '#6c757d' }}>
                                    <ChevronLeft className="w-3 h-3" />
                                </button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    className="p-1 rounded disabled:opacity-30 transition-colors" style={{ color: '#6c757d' }}>
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                            {(syncStatus?.isSyncing || loadingAllLoc) && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: '#714B67' }} />}
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

                    {/* ── Table ── */}
                    <div className="overflow-x-auto" onClick={() => { setShowFilters(false); setShowGroupBy(false); }}>
                        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                    <th className="w-10 px-4 py-2.5">
                                        <button onClick={toggleAll} style={{ color: allSelected ? '#714B67' : '#adb5bd' }}>
                                            {allSelected ? <CheckSquare className="w-4 h-4" style={{ color: '#714B67' }} /> : <Square className="w-4 h-4" />}
                                        </button>
                                    </th>
                                    {[
                                        { label: 'Product',   col: 'name',      align: 'left' },
                                        { label: 'Location',  col: 'location',  align: 'left' },
                                        { label: 'Lot / S/N', col: 'lotNumber', align: 'left' },
                                        { label: 'On Hand',   col: 'onHand',    align: 'right' },
                                        { label: 'Reserved',  col: 'reserved',  align: 'right' },
                                        { label: 'Available', col: 'available', align: 'right' },
                                        { label: 'Expiry',    col: 'expiryDate',align: 'right' },
                                    ].map(h => (
                                        <th key={h.col} className={`px-3 py-2.5 text-${h.align} cursor-pointer select-none`}
                                            style={{ color: '#6c757d', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}
                                            onClick={() => toggleSort(h.col)}>
                                            {h.label}<SortIcon col={h.col} />
                                        </th>
                                    ))}
                                    <th className="px-4 py-2.5" style={{ color: '#6c757d', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', minWidth: '160px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(grouped).map(([groupKey, rows]) => (
                                    <React.Fragment key={groupKey}>
                                        {groupBy !== 'none' && (
                                            <tr className="cursor-pointer" style={{ backgroundColor: '#f8f9fa' }}
                                                onClick={() => toggleGroup(groupKey)}>
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
                                        {isGroupExpanded(groupKey) && rows.map(row => {
                                            const catalog = PRODUCT_CATALOG[row.sku];
                                            const isLow = row.available <= row.reorderPoint;
                                            const isExpiring = row.expiryDate && new Date(row.expiryDate) < new Date(Date.now() + 90 * 86400000);
                                            const isSel = selected.includes(row.id);
                                            return (
                                                <tr key={row.id}
                                                    style={{ backgroundColor: isSel ? '#f9f5f8' : '#ffffff', borderBottom: '1px solid #f0f0f0',
                                                        borderLeft: isLow ? '2px solid #dc3545' : '2px solid transparent' }}
                                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#ffffff'; }}>
                                                    <td className="px-4 py-2.5">
                                                        <button onClick={() => toggleRow(row.id)} style={{ color: isSel ? '#714B67' : '#adb5bd' }}>
                                                            {isSel ? <CheckSquare className="w-4 h-4" style={{ color: '#714B67' }} /> : <Square className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded overflow-hidden shrink-0" style={{ border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                                                {catalog?.image ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Package className="w-3 h-3" /></div>}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium leading-tight cursor-pointer hover:underline"
                                                                    style={{ color: '#017E84' }}
                                                                    onClick={e => { e.stopPropagation(); openProductDetail(row._item); }}>
                                                                    {row.shortName || row.name}
                                                                </p>
                                                                {row.sku && <p className="text-[10px] font-mono leading-tight" style={{ color: '#adb5bd' }}>[{row.sku}]</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                                                            style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}>
                                                            <MapPin className="w-2.5 h-2.5" />{row.location}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        {row.lotNumber
                                                            ? <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                                                                style={{ backgroundColor: '#f0e8ed', color: '#714B67' }}>
                                                                <Hash className="w-2.5 h-2.5" />{row.lotNumber}</span>
                                                            : <span style={{ color: '#dee2e6' }}>—</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-semibold tabular-nums text-xs" style={{ color: '#212529' }}>{row.onHand.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.reserved > 0
                                                            ? <span className="font-semibold tabular-nums text-xs" style={{ color: '#ffac00' }}>{row.reserved.toLocaleString()}</span>
                                                            : <span className="text-xs" style={{ color: '#dee2e6' }}>0</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-semibold tabular-nums text-xs" style={{ color: isLow ? '#dc3545' : '#017E84' }}>
                                                            {row.available.toLocaleString()}
                                                            {isLow && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.expiryDate
                                                            ? <span className="text-xs font-mono"
                                                                style={{ color: isExpiring ? '#ffac00' : '#adb5bd', fontWeight: isExpiring ? 600 : 400 }}>
                                                                {row.expiryDate}{isExpiring && <AlertTriangle className="w-2.5 h-2.5 inline ml-1" />}</span>
                                                            : <span className="text-xs" style={{ color: '#dee2e6' }}>—</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <button onClick={e => { e.stopPropagation(); openProductDetail(row._item); }}
                                                                className="text-[11px] flex items-center gap-1 transition-colors" style={{ color: '#6c757d' }} title="Details"
                                                                onMouseEnter={e => e.currentTarget.style.color = '#017E84'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#6c757d'}>
                                                                <Eye className="w-3 h-3" /> Detail
                                                            </button>
                                                            <button onClick={e => { e.stopPropagation(); openHistory(row._item); }}
                                                                className="text-[11px] flex items-center gap-1 transition-colors" style={{ color: '#6c757d' }} title="History"
                                                                onMouseEnter={e => e.currentTarget.style.color = '#017E84'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#6c757d'}>
                                                                <History className="w-3 h-3" /> History
                                                            </button>
                                                            <button onClick={e => { e.stopPropagation(); openTransfer(row._item); }}
                                                                className="text-[11px] flex items-center gap-1 transition-colors" style={{ color: '#6c757d' }} title="Transfer"
                                                                onMouseEnter={e => e.currentTarget.style.color = '#017E84'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#6c757d'}>
                                                                <ArrowRightLeft className="w-3 h-3" /> Transfer
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
                                            <p className="text-sm">{loadingAllLoc ? 'Loading all locations...' : 'No inventory records found'}</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom pagination */}
                    {totalRecords > PAGE_SIZE && (
                        <div className="px-4 py-2.5 flex items-center justify-between text-xs" style={{ borderTop: '1px solid #dee2e6', color: '#6c757d' }}>
                            <span>{pageStart + 1}–{pageEnd} of {totalRecords} records</span>
                            <div className="flex items-center gap-1">
                                {[{ label: '«', p: 1 }, { label: '‹', p: Math.max(1, safePage - 1) }].map((b, i) => (
                                    <button key={i} onClick={() => setPage(b.p)} disabled={safePage === 1}
                                        className="px-2 py-1 rounded disabled:opacity-30 transition-colors" style={{ border: '1px solid #dee2e6' }}>{b.label}</button>
                                ))}
                                <span className="px-3 py-1 rounded font-semibold" style={{ border: '1px solid #017E84', color: '#017E84' }}>{safePage}</span>
                                {[{ label: '›', p: Math.min(totalPages, safePage + 1) }, { label: '»', p: totalPages }].map((b, i) => (
                                    <button key={i} onClick={() => setPage(b.p)} disabled={safePage === totalPages}
                                        className="px-2 py-1 rounded disabled:opacity-30 transition-colors" style={{ border: '1px solid #dee2e6' }}>{b.label}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* ── PRODUCT DETAIL MODAL (Odoo-style with tabs) ────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {productModal && (() => {
                const pm = productModal;
                const catalog = PRODUCT_CATALOG[pm.sku] || {};
                const detail = productDetailData.general || {};
                const stockValue = (pm.onHand || 0) * (pm.unitCost || detail.standard_price || 0);
                const isLow = (pm.available ?? pm.onHand) <= (pm.reorderPoint || 10);
                const tabs = [
                    { key: 'general', label: 'General Information', icon: <Info className="w-3 h-3" /> },
                    { key: 'purchase', label: 'Purchase', icon: <ShoppingCart className="w-3 h-3" /> },
                    { key: 'sale', label: 'Sales', icon: <BarChart2 className="w-3 h-3" /> },
                    { key: 'inventory', label: 'Inventory', icon: <Layers className="w-3 h-3" /> },
                    { key: 'forecast', label: 'Forecast', icon: <TrendingUp className="w-3 h-3" /> },
                ];

                return (
                    <div className="fixed inset-0 flex items-start justify-center z-[110] pt-8 px-4"
                        style={{ backgroundColor: 'rgba(33,37,41,0.55)' }} onClick={() => setProductModal(null)}>
                        <div className="w-full max-w-3xl overflow-hidden"
                            style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                <div className="flex items-center gap-2 text-xs" style={{ color: '#6c757d' }}>
                                    <span style={{ color: '#adb5bd' }}>Inventory</span>
                                    <span style={{ color: '#dee2e6' }}>/</span>
                                    <span className="font-semibold" style={{ color: '#212529' }}>{pm.shortName || pm.name}</span>
                                    {pm.sku && <span className="font-mono text-[10px]" style={{ color: '#adb5bd' }}>[{pm.sku}]</span>}
                                </div>
                                <button onClick={() => setProductModal(null)} className="p-1.5 rounded transition-colors" style={{ color: '#6c757d' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Product header */}
                            <div className="px-5 py-4 flex gap-4 shrink-0" style={{ borderBottom: '1px solid #dee2e6' }}>
                                <div className="w-20 h-20 rounded overflow-hidden shrink-0" style={{ border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                    {catalog.image ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Package className="w-8 h-8" /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-semibold mb-1" style={{ color: '#212529' }}>{pm.name}</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {pm.sku && <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}><Hash className="w-3 h-3" />{pm.sku}</span>}
                                        {pm.location && <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}><MapPin className="w-3 h-3" />{pm.location}</span>}
                                        {isLow && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffc107' }}><AlertTriangle className="w-3 h-3" /> Low Stock</span>}
                                    </div>
                                    {/* Quick KPIs */}
                                    <div className="flex gap-4 mt-2">
                                        {[
                                            { label: 'On Hand', value: (pm.onHand || 0).toLocaleString(), color: '#212529' },
                                            { label: 'Reserved', value: (pm.reserved || 0).toLocaleString(), color: '#ffac00' },
                                            { label: 'Available', value: ((pm.available ?? pm.onHand) || 0).toLocaleString(), color: '#017E84' },
                                            { label: 'Value', value: `฿${stockValue.toLocaleString()}`, color: '#495057' },
                                        ].map((k, i) => (
                                            <div key={i}>
                                                <p className="text-sm font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                <p className="text-[9px] font-semibold uppercase" style={{ color: '#adb5bd' }}>{k.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex shrink-0" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                {tabs.map(t => (
                                    <button key={t.key}
                                        onClick={() => { setProductDetailTab(t.key); loadTabData(t.key, pm); }}
                                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
                                        style={{
                                            color: productDetailTab === t.key ? '#714B67' : '#6c757d',
                                            borderBottom: productDetailTab === t.key ? '2px solid #714B67' : '2px solid transparent',
                                            backgroundColor: productDetailTab === t.key ? '#ffffff' : 'transparent',
                                        }}>
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>

                                {/* GENERAL TAB */}
                                {productDetailTab === 'general' && (
                                    <div>
                                        {productDetailData.loading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: '#017E84' }} /><p className="text-xs mt-2" style={{ color: '#adb5bd' }}>Loading from Odoo...</p></div>}
                                        {!productDetailData.loading && (
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                                {[
                                                    { label: 'Category', value: detail.categ_id?.[1] || pm.category || '—' },
                                                    { label: 'Product Type', value: detail.detailed_type === 'product' ? 'Storable' : detail.detailed_type === 'consu' ? 'Consumable' : detail.detailed_type || 'Storable' },
                                                    { label: 'Tracking', value: detail.tracking === 'lot' ? 'By Lots' : detail.tracking === 'serial' ? 'By Serial' : detail.tracking || '—' },
                                                    { label: 'UoM', value: detail.uom_id?.[1] || 'Units' },
                                                    { label: 'Sales Price', value: detail.list_price ? `฿${detail.list_price.toLocaleString()}` : (pm.unitCost ? `฿${(pm.unitCost * 1.5).toFixed(0)}` : '—') },
                                                    { label: 'Cost', value: detail.standard_price ? `฿${detail.standard_price.toLocaleString()}` : (pm.unitCost ? `฿${pm.unitCost.toLocaleString()}` : '—') },
                                                    { label: 'Internal Reference', value: detail.default_code || pm.sku || '—' },
                                                    { label: 'Barcode', value: detail.barcode || catalog?.barcode || '—' },
                                                    { label: 'Sales Taxes', value: detail.taxes_id?.length ? detail.taxes_id.map(t => typeof t === 'object' ? t[1] : t).join(', ') : '7% Output VAT' },
                                                    { label: 'Purchase Taxes', value: detail.supplier_taxes_id?.length ? detail.supplier_taxes_id.map(t => typeof t === 'object' ? t[1] : t).join(', ') : '7% Input VAT' },
                                                    { label: 'Weight', value: detail.weight ? `${detail.weight} kg` : '—' },
                                                    { label: 'Volume', value: detail.volume ? `${detail.volume} m³` : '—' },
                                                    { label: 'Reorder Point', value: (pm.reorderPoint || 10).toLocaleString() },
                                                    { label: 'Product ID', value: pm.productId || detail.id || '—' },
                                                ].map((f, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0 pt-0.5" style={{ color: '#adb5bd', minWidth: '120px' }}>{f.label}</span>
                                                        <span className="text-xs font-medium" style={{ color: '#212529' }}>{f.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Lot table */}
                                        {pm.lots?.length > 0 && (
                                            <div className="mt-5">
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#adb5bd' }}>Lot / Serial Numbers</p>
                                                <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                            {['Lot / S/N', 'Qty', 'Received', 'Expiry'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Lot / S/N' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: '#6c757d' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {pm.lots.map((lot, li) => {
                                                                const expiring = lot.expiryDate && new Date(lot.expiryDate) < new Date(Date.now() + 90 * 86400000);
                                                                return (
                                                                    <tr key={li} style={{ borderBottom: li < pm.lots.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                                                        <td className="px-3 py-2"><span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0e8ed', color: '#714B67' }}>{lot.lotNumber}</span></td>
                                                                        <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: '#212529' }}>{(lot.qty || 0).toLocaleString()}</td>
                                                                        <td className="px-3 py-2 text-right font-mono" style={{ color: '#adb5bd' }}>{lot.receivedDate || '—'}</td>
                                                                        <td className="px-3 py-2 text-right font-mono" style={{ color: expiring ? '#ffac00' : '#adb5bd', fontWeight: expiring ? 600 : 400 }}>{lot.expiryDate || '—'}{expiring && <AlertTriangle className="w-3 h-3 inline ml-1" />}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* PURCHASE TAB */}
                                {productDetailTab === 'purchase' && (
                                    <div>
                                        {productDetailData.purchaseLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: '#017E84' }} /></div>}
                                        {!productDetailData.purchaseLoading && productDetailData.purchase && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#adb5bd' }}>Vendors / Suppliers</p>
                                                {productDetailData.purchase.length === 0
                                                    ? <p className="text-sm" style={{ color: '#adb5bd' }}>No supplier info found</p>
                                                    : <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                            <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                                {['Vendor', 'Price', 'Min Qty', 'Lead Time'].map(h => (
                                                                    <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: '#6c757d' }}>{h}</th>
                                                                ))}
                                                            </tr></thead>
                                                            <tbody>
                                                                {productDetailData.purchase.map((v, i) => (
                                                                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                        <td className="px-3 py-2 font-medium" style={{ color: '#212529' }}>{v.partner_id?.[1] || '—'}</td>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: '#017E84' }}>฿{(v.price || 0).toLocaleString()}</td>
                                                                        <td className="px-3 py-2 tabular-nums">{v.min_qty || 0}</td>
                                                                        <td className="px-3 py-2">{v.delay || 0} days</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>}
                                            </div>
                                        )}
                                        {!productDetailData.purchaseLoading && !productDetailData.purchase && (
                                            <p className="text-sm text-center py-4" style={{ color: '#adb5bd' }}>Click to load purchase data</p>
                                        )}
                                    </div>
                                )}

                                {/* SALES TAB */}
                                {productDetailTab === 'sale' && (
                                    <div>
                                        {productDetailData.saleLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: '#017E84' }} /></div>}
                                        {!productDetailData.saleLoading && productDetailData.sale && (
                                            <div>
                                                {/* Sales summary */}
                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    {(() => {
                                                        const sales = productDetailData.sale;
                                                        const totalQty = sales.reduce((s, o) => s + (o.product_uom_qty || 0), 0);
                                                        const totalRev = sales.reduce((s, o) => s + (o.price_subtotal || 0), 0);
                                                        return [
                                                            { label: 'Total Orders', value: sales.length, color: '#714B67' },
                                                            { label: 'Total Qty Sold', value: totalQty.toLocaleString(), color: '#017E84' },
                                                            { label: 'Total Revenue', value: `฿${totalRev.toLocaleString()}`, color: '#28a745' },
                                                        ].map((k, i) => (
                                                            <div key={i} className="rounded p-3 text-center" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                                                                <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                                <p className="text-[10px] font-semibold uppercase" style={{ color: '#adb5bd' }}>{k.label}</p>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#adb5bd' }}>Recent Sales</p>
                                                <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                            {['Order', 'Date', 'Qty', 'Unit Price', 'Subtotal'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Order' || h === 'Date' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: '#6c757d' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {productDetailData.sale.map((s, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                    <td className="px-3 py-2 font-mono" style={{ color: '#017E84' }}>{s.order_id?.[1] || '—'}</td>
                                                                    <td className="px-3 py-2 font-mono" style={{ color: '#6c757d' }}>{s.create_date ? new Date(s.create_date).toLocaleDateString() : '—'}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{s.product_uom_qty || 0}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums">฿{(s.price_unit || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: '#28a745' }}>฿{(s.price_subtotal || 0).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* INVENTORY TAB (Stock by Location) */}
                                {productDetailTab === 'inventory' && (
                                    <div>
                                        {productDetailData.inventoryLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: '#017E84' }} /></div>}
                                        {!productDetailData.inventoryLoading && productDetailData.inventory && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#adb5bd' }}>Stock by Location (All Warehouses)</p>
                                                <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                            {['Location', 'Lot', 'On Hand', 'Reserved', 'Available'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Location' || h === 'Lot' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: '#6c757d' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {productDetailData.inventory.map((q, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}><MapPin className="w-2.5 h-2.5" />{q.location_id?.[1] || '—'}</span></td>
                                                                    <td className="px-3 py-2">{q.lot_id ? <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0e8ed', color: '#714B67' }}>{q.lot_id[1]}</span> : <span style={{ color: '#dee2e6' }}>—</span>}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{(q.quantity || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: q.reserved_quantity > 0 ? '#ffac00' : '#dee2e6' }}>{(q.reserved_quantity || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: '#017E84' }}>{((q.quantity || 0) - (q.reserved_quantity || 0)).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                                                <td colSpan={2} className="px-3 py-2 font-semibold" style={{ color: '#6c757d' }}>Total</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: '#212529' }}>{productDetailData.inventory.reduce((s, q) => s + (q.quantity || 0), 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: '#ffac00' }}>{productDetailData.inventory.reduce((s, q) => s + (q.reserved_quantity || 0), 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: '#017E84' }}>{productDetailData.inventory.reduce((s, q) => s + (q.quantity || 0) - (q.reserved_quantity || 0), 0).toLocaleString()}</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* FORECAST TAB */}
                                {productDetailTab === 'forecast' && (
                                    <div>
                                        {productDetailData.forecastLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: '#017E84' }} /></div>}
                                        {!productDetailData.forecastLoading && productDetailData.forecast && (
                                            <div>
                                                {/* Forecast KPI cards */}
                                                <div className="grid grid-cols-4 gap-3 mb-4">
                                                    {[
                                                        { label: 'On Hand', value: (productDetailData.forecast.qty_available || 0).toLocaleString(), color: '#212529', bg: '#f8f9fa' },
                                                        { label: 'Incoming', value: `+${(productDetailData.forecast.incoming_qty || 0).toLocaleString()}`, color: '#28a745', bg: '#f0fdf4' },
                                                        { label: 'Outgoing', value: `-${(productDetailData.forecast.outgoing_qty || 0).toLocaleString()}`, color: '#dc3545', bg: '#fff5f5' },
                                                        { label: 'Forecasted', value: (productDetailData.forecast.virtual_available || 0).toLocaleString(), color: '#017E84', bg: '#e8f8fb' },
                                                    ].map((k, i) => (
                                                        <div key={i} className="rounded p-3 text-center" style={{ backgroundColor: k.bg, border: '1px solid #dee2e6' }}>
                                                            <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                            <p className="text-[10px] font-semibold uppercase" style={{ color: '#adb5bd' }}>{k.label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Upcoming moves */}
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#adb5bd' }}>Upcoming Moves</p>
                                                {productDetailData.forecast.upcoming_moves?.length > 0 ? (
                                                    <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                            <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                                {['Date', 'Direction', 'Reference', 'Qty', 'Status'].map(h => (
                                                                    <th key={h} className={`px-3 py-2 ${h === 'Qty' ? 'text-right' : 'text-left'} font-semibold`} style={{ color: '#6c757d' }}>{h}</th>
                                                                ))}
                                                            </tr></thead>
                                                            <tbody>
                                                                {productDetailData.forecast.upcoming_moves.map((m, i) => (
                                                                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: '#6c757d' }}>{m.date ? new Date(m.date).toLocaleDateString() : '—'}</td>
                                                                        <td className="px-3 py-2">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                                                                                style={{ backgroundColor: m.direction === 'in' ? '#f0fdf4' : '#fff5f5', color: m.direction === 'in' ? '#28a745' : '#dc3545' }}>
                                                                                {m.direction === 'in' ? <PackageCheck className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                                                                {m.direction === 'in' ? 'Incoming' : 'Outgoing'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: '#017E84' }}>{m.origin || '—'}</td>
                                                                        <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: m.direction === 'in' ? '#28a745' : '#dc3545' }}>
                                                                            {m.direction === 'in' ? '+' : '-'}{m.product_uom_qty || 0}
                                                                        </td>
                                                                        <td className="px-3 py-2"><span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: '#f8f9fa', color: '#6c757d' }}>{m.state}</span></td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : <p className="text-sm" style={{ color: '#adb5bd' }}>No upcoming moves</p>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer actions */}
                            <div className="px-5 py-3 flex items-center gap-4 shrink-0" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                <button onClick={() => { setProductModal(null); openHistory(pm); }}
                                    className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#017E84' }}>
                                    <History className="w-3.5 h-3.5" /> Stock History
                                </button>
                                <button onClick={() => { setProductModal(null); openTransfer(pm); }}
                                    className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#017E84' }}>
                                    <ArrowRightLeft className="w-3.5 h-3.5" /> Internal Transfer
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── History Modal ─────────────────────────────────────────────── */}
            {historyModal && (
                <div className="fixed inset-0 flex items-start justify-center z-[120] pt-16 px-4"
                    style={{ backgroundColor: 'rgba(33,37,41,0.55)' }} onClick={() => setHistoryModal(null)}>
                    <div className="w-full max-w-2xl overflow-hidden"
                        style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <div className="flex items-center gap-2 text-xs" style={{ color: '#6c757d' }}>
                                <span style={{ color: '#adb5bd' }}>Inventory</span><span style={{ color: '#dee2e6' }}>/</span>
                                <span className="font-semibold" style={{ color: '#212529' }}>{historyModal.item.shortName || historyModal.item.name}</span>
                                <span style={{ color: '#dee2e6' }}>/</span><span style={{ color: '#017E84' }}>Stock History</span>
                            </div>
                            <button onClick={() => setHistoryModal(null)} className="p-1.5 rounded" style={{ color: '#6c757d' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid #dee2e6' }}>
                            <div className="w-9 h-9 rounded overflow-hidden shrink-0" style={{ border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                {PRODUCT_CATALOG[historyModal.item.sku]?.image ? <img src={PRODUCT_CATALOG[historyModal.item.sku].image} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Package className="w-4 h-4" /></div>}
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#212529' }}>{historyModal.item.name}</p>
                                <p className="text-[10px] font-mono" style={{ color: '#adb5bd' }}>{historyModal.item.sku} · On-hand: <span className="font-semibold" style={{ color: '#017E84' }}>{(historyModal.item.onHand || 0).toLocaleString()}</span></p>
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {historyModal.loading && <div className="flex items-center justify-center py-16" style={{ color: '#adb5bd' }}><RefreshCw className="w-5 h-5 animate-spin mr-2" style={{ color: '#017E84' }} /><span className="text-sm">Fetching from Odoo...</span></div>}
                            {!historyModal.loading && historyModal.rows.length === 0 && <div className="py-16 text-center" style={{ color: '#adb5bd' }}><History className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-sm">No movement history found</p></div>}
                            {!historyModal.loading && historyModal.rows.length > 0 && (
                                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0 }}><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                        {['Date', 'Type', 'Reference', 'Partner', 'Qty', 'Balance'].map(h => (
                                            <th key={h} className={`px-4 py-2.5 ${h === 'Qty' || h === 'Balance' ? 'text-right' : 'text-left'} font-semibold`} style={{ color: '#6c757d' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {historyModal.rows.map((mv, i) => {
                                            const tc = { delivery: { label: 'Delivery', icon: <Truck className="w-3 h-3" />, color: '#dc3545', bg: '#fff5f5' },
                                                receipt: { label: 'Receipt', icon: <PackageCheck className="w-3 h-3" />, color: '#28a745', bg: '#f0fdf4' },
                                                adjustment: { label: 'Adjustment', icon: <Check className="w-3 h-3" />, color: '#6c757d', bg: '#f8f9fa' } }[mv.type] || { label: mv.type, icon: null, color: '#6c757d', bg: 'transparent' };
                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <td className="px-4 py-2.5 font-mono" style={{ color: '#6c757d' }}>{mv.date}</td>
                                                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.icon} {tc.label}</span></td>
                                                    <td className="px-4 py-2.5 font-mono" style={{ color: '#017E84' }}>{mv.ref}</td>
                                                    <td className="px-4 py-2.5" style={{ color: '#495057' }}>{mv.partner}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: mv.qty > 0 ? '#28a745' : '#dc3545' }}>{mv.qty > 0 ? '+' : ''}{mv.qty.toLocaleString()}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: '#212529' }}>{mv.balance.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-5 py-2.5 text-xs shrink-0 flex items-center gap-2" style={{ borderTop: '1px solid #dee2e6', color: '#adb5bd', backgroundColor: '#f8f9fa' }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: historyModal.isLive ? '#28a745' : '#ffac00' }} />
                            {historyModal.isLive ? `Live from Odoo · ${historyModal.rows.length} movements` : `Mock data · ${historyModal.rows.length} movements`}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Internal Transfer Modal ─────────────────────────────────── */}
            {transferModal !== null && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[120]"
                    style={{ backgroundColor: 'rgba(33,37,41,0.55)' }} onClick={() => setTransferModal(null)}>
                    <div className="w-full max-w-lg overflow-hidden"
                        style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                                <ArrowRightLeft className="w-4 h-4" style={{ color: '#017E84' }} /> Internal Transfer
                            </h3>
                            <button onClick={() => setTransferModal(null)} className="p-1.5 rounded" style={{ color: '#6c757d' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Source Location */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#6c757d' }}>Source Location</label>
                                <select value={transferSrc} onChange={e => setTransferSrc(e.target.value)}
                                    className="w-full px-3 py-2 text-sm outline-none" style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529', backgroundColor: '#ffffff' }}>
                                    <option value="">Select source...</option>
                                    {allOdooLocations.map(l => <option key={l.id} value={l.id}>{l.complete_name}</option>)}
                                    {allOdooLocations.length === 0 && <option value="1">WH/Stock/BULK (Mock)</option>}
                                </select>
                            </div>
                            {/* Destination Location */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#6c757d' }}>Destination Location</label>
                                <select value={transferDest} onChange={e => setTransferDest(e.target.value)}
                                    className="w-full px-3 py-2 text-sm outline-none" style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529', backgroundColor: '#ffffff' }}>
                                    <option value="">Select destination...</option>
                                    {allOdooLocations.map(l => <option key={l.id} value={l.id}>{l.complete_name}</option>)}
                                    {allOdooLocations.length === 0 && <option value="2">WH/Stock/PICKFACE (Mock)</option>}
                                </select>
                            </div>
                            {/* Transfer lines */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#6c757d' }}>Products</label>
                                {transferLines.map((line, i) => (
                                    <div key={i} className="flex items-center gap-2 mb-2">
                                        <span className="flex-1 text-xs font-mono px-2 py-1.5 rounded truncate" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#495057' }}>
                                            {line.sku || line.name || 'Product'}
                                        </span>
                                        <input type="number" value={line.qty} onChange={e => {
                                            const lines = [...transferLines]; lines[i].qty = Math.max(1, parseInt(e.target.value) || 1); setTransferLines(lines);
                                        }} className="w-20 text-center text-sm py-1.5 outline-none" style={{ border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529' }} />
                                        {transferLines.length > 1 && (
                                            <button onClick={() => setTransferLines(transferLines.filter((_, j) => j !== i))} className="p-1" style={{ color: '#dc3545' }}><X className="w-3.5 h-3.5" /></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <button onClick={() => setTransferModal(null)}
                                className="px-4 py-1.5 text-xs rounded transition-colors" style={{ border: '1px solid #dee2e6', color: '#495057' }}>Cancel</button>
                            <button onClick={executeTransfer} disabled={transferLoading}
                                className="px-4 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5"
                                style={{ backgroundColor: '#017E84', color: '#ffffff', border: 'none', opacity: transferLoading ? 0.7 : 1 }}>
                                {transferLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                {transferLoading ? 'Processing...' : 'Create Transfer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reorder Rules Panel ─────────────────────────────────────── */}
            {showReorderPanel && (
                <div className="fixed inset-0 flex items-start justify-center z-[120] pt-16 px-4"
                    style={{ backgroundColor: 'rgba(33,37,41,0.55)' }} onClick={() => setShowReorderPanel(false)}>
                    <div className="w-full max-w-2xl overflow-hidden"
                        style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                                <Shield className="w-4 h-4" style={{ color: '#714B67' }} /> Min/Max Reorder Rules
                            </h3>
                            <button onClick={() => setShowReorderPanel(false)} className="p-1.5 rounded" style={{ color: '#6c757d' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {reorderLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: '#017E84' }} /></div>}
                            {!reorderLoading && reorderRules.length === 0 && (
                                <div className="py-16 text-center" style={{ color: '#adb5bd' }}>
                                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-sm">No reorder rules configured</p>
                                </div>
                            )}
                            {!reorderLoading && reorderRules.length > 0 && (
                                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                    <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                        {['Product', 'Location', 'Min', 'Max', 'To Order', 'Trigger'].map(h => (
                                            <th key={h} className={`px-4 py-2.5 ${h === 'Min' || h === 'Max' || h === 'To Order' ? 'text-right' : 'text-left'} font-semibold`} style={{ color: '#6c757d' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {reorderRules.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td className="px-4 py-2.5 font-medium" style={{ color: '#212529' }}>{r.product_id?.[1] || r.sku || '—'}</td>
                                                <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: '#6c757d' }}>{r.location_id?.[1] || 'PICKFACE'}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: '#dc3545' }}>{r.product_min_qty || 0}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: '#017E84' }}>{r.product_max_qty || 0}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.qty_to_order > 0 ? '#ffac00' : '#adb5bd' }}>{r.qty_to_order || 0}</td>
                                                <td className="px-4 py-2.5"><span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f8f9fa', color: '#6c757d' }}>{r.trigger || 'auto'}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-5 py-2.5 text-xs shrink-0" style={{ borderTop: '1px solid #dee2e6', color: '#adb5bd', backgroundColor: '#f8f9fa' }}>
                            {reorderRules.length} rules · Odoo stock.warehouse.orderpoint
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
