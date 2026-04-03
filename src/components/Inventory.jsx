import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Minus, AlertTriangle, Package, Tag, X, Check, RefreshCw, ChevronDown, ChevronRight, Filter, ArrowUpDown, MapPin, Hash, Boxes, TrendingDown, CheckSquare, Square, History, RotateCcw, ChevronLeft, ArrowUpCircle, Truck, PackageCheck, Settings, Plus, Eye, ShoppingCart, BarChart2, TrendingUp, ArrowRightLeft, Layers, DollarSign, Clock, Calendar, ExternalLink, Shield, Info } from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';
import {
    fetchStockHistory, fetchAllLocations, getStoredAllowedLocations, saveAllowedLocations,
    fetchFullInventory, fetchProductDetail, fetchSupplierInfo, fetchSalesHistory,
    fetchStockByLocation, fetchStockForecast, fetchReorderRules, createReorderRule,
    updateReorderRule, createInternalTransfer,
} from '../services/odooApi';

// ── View modes ──
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

    // Dynamic warehouses + categories from actual inventory data
    const invItems = useMemo(() => Array.isArray(inventory) ? inventory : [], [inventory]);
    const dynamicWarehouses = useMemo(() => {
        const whs = new Set();
        invItems.forEach(i => {
            const loc = i.location || '';
            // Extract warehouse from location path: "K-On/Stock/PICKFACE" → "K-On"
            const wh = loc.split('/')[0];
            if (wh) whs.add(wh);
        });
        return ['All', ...Array.from(whs).sort()];
    }, [invItems]);
    const dynamicCategories = useMemo(() => {
        const cats = new Set();
        invItems.forEach(i => { if (i.category) cats.add(i.category); });
        return ['All', ...Array.from(cats).sort()];
    }, [invItems]);
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
        // PICKFACE mode: show only locations containing "PICKFACE"
        return loc.toLowerCase().includes('pickface');
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
        if (warehouseFilter !== 'All') rows = rows.filter(r => (r.location || '').includes(warehouseFilter));
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
            style={{ color: sortBy.col === col ? 'var(--odoo-teal)' : 'var(--odoo-border)' }} />
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
                    style={{ color: 'var(--odoo-text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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
                                    style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)', fontWeight: isActive ? 600 : 400,
                                        backgroundColor: isActive ? '#f5f0f4' : 'transparent',
                                        borderLeft: isActive ? '3px solid var(--odoo-purple)' : '3px solid transparent' }}
                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
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
                <div className="shrink-0 flex flex-col" style={{ width: '180px', backgroundColor: 'var(--odoo-surface)', borderRight: '1px solid var(--odoo-border-ghost)', overflowY: 'auto' }}>
                    <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        <span className="text-xs font-semibold" style={{ color: 'var(--odoo-text)' }}>Filters</span>
                        <button onClick={() => setLeftPanelOpen(false)} style={{ color: 'var(--odoo-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-text)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-text-muted)'}>
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* View Mode Switcher */}
                    <div style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 12px' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--odoo-text-secondary)' }}>View Mode</p>
                        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
                            {[{ key: VIEW_MODES.PICKFACE, label: 'PICKFACE' }, { key: VIEW_MODES.ALL, label: 'All Loc.' }].map(v => (
                                <button key={v.key}
                                    onClick={() => { setViewMode(v.key); setPage(1); }}
                                    className="flex-1 py-1.5 text-[10px] font-semibold transition-colors"
                                    style={{
                                        backgroundColor: viewMode === v.key ? 'var(--odoo-purple)' : 'var(--odoo-surface)',
                                        color: viewMode === v.key ? 'var(--odoo-surface)' : 'var(--odoo-text-secondary)',
                                        border: 'none',
                                    }}>
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <LeftSection title="Warehouses" options={dynamicWarehouses} value={warehouseFilter} onChange={setWarehouseFilter} />
                    {dynamicCategories.length > 1 && (
                        <LeftSection title="Category" options={dynamicCategories} value={categoryFilter} onChange={setCategoryFilter} />
                    )}

                    {/* Location summary */}
                    <div style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 12px' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--odoo-text-secondary)' }}>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Locations</span>
                        </p>
                        <p className="text-[10px]" style={{ color: isLiveMode ? 'var(--odoo-success)' : 'var(--odoo-text-muted)' }}>
                            {isLiveMode ? '● Online warehouse (live)' : '○ Mock mode'}
                        </p>
                        <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--odoo-purple)' }}>
                            {invItems.length} products loaded
                        </p>
                    </div>

                    {/* Quick filters */}
                    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-secondary)' }}>Quick Filters</p>
                        {filterOptions.map(f => {
                            const isActive = activeFilters.includes(f.key);
                            return (
                                <button key={f.key} onClick={() => { toggleFilter(f.key); setPage(1); }}
                                    className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors"
                                    style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)', fontWeight: isActive ? 600 : 400,
                                        backgroundColor: isActive ? '#f5f0f4' : 'transparent',
                                        borderLeft: isActive ? '3px solid var(--odoo-purple)' : '3px solid transparent' }}
                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                    {f.icon} {f.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tools */}
                    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-secondary)' }}>Tools</p>
                        <button onClick={() => { setShowReorderPanel(true); loadReorderRules(); }}
                            className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors"
                            style={{ color: 'var(--odoo-text)' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <Shield className="w-3.5 h-3.5" /> Min/Max Rules
                        </button>
                        <button onClick={() => openTransfer(null)}
                            className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs transition-colors"
                            style={{ color: 'var(--odoo-text)' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
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
                        { label: 'Total SKUs', value: dashStats.uniqueSkus.toLocaleString(), icon: <Package className="w-4 h-4" />, color: 'var(--odoo-purple)', bg: '#f9f5f8' },
                        { label: 'Stock Value', value: `${(dashStats.totalValue / 1000).toFixed(0)}K`, icon: <DollarSign className="w-4 h-4" />, color: 'var(--odoo-teal)', bg: '#e8f8fb' },
                        { label: 'Low Stock', value: dashStats.lowStock.toLocaleString(), icon: <TrendingDown className="w-4 h-4" />, color: dashStats.lowStock > 0 ? 'var(--odoo-danger)' : 'var(--odoo-success)', bg: dashStats.lowStock > 0 ? '#fff5f5' : '#f0fdf4' },
                        { label: 'Expiring (<30d)', value: dashStats.expiringLots.toLocaleString(), icon: <AlertTriangle className="w-4 h-4" />, color: dashStats.expiringLots > 0 ? 'var(--odoo-warning)' : 'var(--odoo-success)', bg: dashStats.expiringLots > 0 ? '#fff8e6' : '#f0fdf4' },
                    ].map((c, i) => (
                        <div key={i} className="rounded p-3 flex items-center gap-3" style={{ backgroundColor: c.bg, border: '1px solid var(--odoo-border-ghost)' }}>
                            <div className="p-2 rounded" style={{ backgroundColor: `${c.color}15`, color: c.color }}>{c.icon}</div>
                            <div>
                                <p className="text-lg font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--odoo-text-muted)' }}>{c.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Second row: PICKFACE / Bulk / Reserved / Available */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                    {[
                        { label: 'PICKFACE', value: dashStats.pickfaceUnits.toLocaleString(), color: 'var(--odoo-purple)' },
                        { label: 'Bulk / WH', value: dashStats.bulkUnits.toLocaleString(), color: 'var(--odoo-text)' },
                        { label: 'Reserved', value: dashStats.totalReserved.toLocaleString(), color: 'var(--odoo-warning)' },
                        { label: 'Available', value: dashStats.available.toLocaleString(), color: 'var(--odoo-teal)' },
                    ].map((c, i) => (
                        <div key={i} className="rounded px-3 py-2 text-center" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                            <p className="text-base font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--odoo-text-muted)' }}>{c.label}</p>
                        </div>
                    ))}
                </div>

                <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', margin: '0 0 1rem 0', overflow: 'visible' }}>

                    {/* ── Toolbar ── */}
                    <div className="px-4 py-2.5 flex flex-wrap gap-2 items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                        {!leftPanelOpen && (
                            <button onClick={() => setLeftPanelOpen(true)}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: 'var(--odoo-text-secondary)', border: '1px solid var(--odoo-border-ghost)' }} title="Show Filters Panel"
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--odoo-purple)'; e.currentTarget.style.color = 'var(--odoo-purple)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--odoo-border)'; e.currentTarget.style.color = 'var(--odoo-text-secondary)'; }}>
                                <Filter className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {/* View mode badge */}
                        <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{
                            backgroundColor: viewMode === VIEW_MODES.ALL ? '#e8f8fb' : '#f9f5f8',
                            color: viewMode === VIEW_MODES.ALL ? 'var(--odoo-teal)' : 'var(--odoo-purple)',
                            border: `1px solid ${viewMode === VIEW_MODES.ALL ? '#b2e0e4' : '#d9c0d3'}`,
                        }}>
                            {viewMode === VIEW_MODES.ALL ? 'ALL LOCATIONS' : 'PICKFACE'}
                        </span>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[160px] max-w-xs">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                            <input type="text" value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                placeholder="Search products, lots, locations..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm outline-none"
                                style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', color: 'var(--odoo-text)', backgroundColor: 'var(--odoo-surface)' }}
                                onFocus={e => e.currentTarget.style.borderColor = 'var(--odoo-teal)'}
                                onBlur={e => e.currentTarget.style.borderColor = 'var(--odoo-border)'} />
                        </div>

                        {/* Filters dropdown */}
                        <div className="relative">
                            <button onClick={() => { setShowFilters(s => !s); setShowGroupBy(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
                                style={{ border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)', backgroundColor: 'transparent',
                                    ...(activeFilters.length > 0 ? { color: 'var(--odoo-purple)', borderColor: 'var(--odoo-purple)', backgroundColor: '#f9f5f8' } : {}) }}>
                                Filters
                                {activeFilters.length > 0 && (
                                    <span className="text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center" style={{ backgroundColor: 'var(--odoo-purple)' }}>{activeFilters.length}</span>
                                )}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showFilters && (
                                <div className="absolute top-full mt-1 left-0 z-50 min-w-[180px] py-1" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5" style={{ color: 'var(--odoo-text-muted)' }}>Filters</p>
                                    {filterOptions.map(f => (
                                        <button key={f.key} onClick={() => { toggleFilter(f.key); setPage(1); }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                                            style={{ backgroundColor: activeFilters.includes(f.key) ? '#f9f5f8' : 'transparent', color: activeFilters.includes(f.key) ? 'var(--odoo-purple)' : 'var(--odoo-text)', fontWeight: activeFilters.includes(f.key) ? 600 : 400 }}
                                            onMouseEnter={e => { if (!activeFilters.includes(f.key)) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
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
                                style={{ border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)', backgroundColor: 'transparent',
                                    ...(groupBy !== 'none' ? { color: 'var(--odoo-teal)', borderColor: 'var(--odoo-teal)', backgroundColor: '#e8f8fb' } : {}) }}>
                                Group By{groupBy !== 'none' && <span className="font-semibold">: {groupOptions.find(g => g.key === groupBy)?.label}</span>}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showGroupBy && (
                                <div className="absolute top-full mt-1 left-0 z-50 min-w-[160px] py-1" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5" style={{ color: 'var(--odoo-text-muted)' }}>Group By</p>
                                    {groupOptions.map(g => (
                                        <button key={g.key} onClick={() => { setGroupBy(g.key); setShowGroupBy(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                                            style={{ backgroundColor: groupBy === g.key ? '#e8f8fb' : 'transparent', color: groupBy === g.key ? 'var(--odoo-teal)' : 'var(--odoo-text)', fontWeight: groupBy === g.key ? 600 : 400 }}>
                                            {g.label} {groupBy === g.key && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right side */}
                        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                            {selected.length > 0 && (
                                <span className="px-2 py-0.5 font-semibold rounded" style={{ backgroundColor: '#f9f5f8', color: 'var(--odoo-purple)', border: '1px solid #e0cfe0' }}>{selected.length} selected</span>
                            )}
                            <span className="tabular-nums">
                                {totalRecords === 0 ? '0' : `${pageStart + 1}-${pageEnd}`}{' / '}
                                <span className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{totalRecords}</span>
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                    className="p-1 rounded disabled:opacity-30 transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}>
                                    <ChevronLeft className="w-3 h-3" />
                                </button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    className="p-1 rounded disabled:opacity-30 transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}>
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                            {(syncStatus?.isSyncing || loadingAllLoc) && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--odoo-purple)' }} />}
                        </div>
                    </div>

                    {/* Active filter chips */}
                    {(activeFilters.length > 0 || warehouseFilter !== 'All' || categoryFilter !== 'All') && (
                        <div className="px-4 py-2 flex flex-wrap gap-1.5 items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            {activeFilters.map(f => {
                                const opt = filterOptions.find(o => o.key === f);
                                return (
                                    <span key={f} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded" style={{ backgroundColor: '#f0e8ed', color: 'var(--odoo-purple)', border: '1px solid #d9c0d3' }}>
                                        {opt?.icon} {opt?.label}
                                        <button onClick={() => toggleFilter(f)} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                    </span>
                                );
                            })}
                            {warehouseFilter !== 'All' && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded" style={{ backgroundColor: '#e8f8fb', color: 'var(--odoo-teal)', border: '1px solid #b2e0e4' }}>
                                    {warehouseFilter}
                                    <button onClick={() => setWarehouseFilter('All')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                </span>
                            )}
                            {categoryFilter !== 'All' && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded" style={{ backgroundColor: '#e8f8fb', color: 'var(--odoo-teal)', border: '1px solid #b2e0e4' }}>
                                    {categoryFilter}
                                    <button onClick={() => setCategoryFilter('All')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                </span>
                            )}
                            <button onClick={() => { setActiveFilters([]); setWarehouseFilter('All'); setCategoryFilter('All'); setPage(1); }}
                                className="text-xs underline ml-1" style={{ color: 'var(--odoo-text-secondary)' }}>Clear all</button>
                        </div>
                    )}

                    {/* ── Table ── */}
                    <div className="overflow-x-auto" onClick={() => { setShowFilters(false); setShowGroupBy(false); }}>
                        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                    <th className="w-10 px-4 py-2.5">
                                        <button onClick={toggleAll} style={{ color: allSelected ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                                            {allSelected ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> : <Square className="w-4 h-4" />}
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
                                            style={{ color: 'var(--odoo-text-secondary)', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}
                                            onClick={() => toggleSort(h.col)}>
                                            {h.label}<SortIcon col={h.col} />
                                        </th>
                                    ))}
                                    <th className="px-4 py-2.5" style={{ color: 'var(--odoo-text-secondary)', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', minWidth: '160px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(grouped).map(([groupKey, rows]) => (
                                    <React.Fragment key={groupKey}>
                                        {groupBy !== 'none' && (
                                            <tr className="cursor-pointer" style={{ backgroundColor: 'var(--odoo-surface-low)' }}
                                                onClick={() => toggleGroup(groupKey)}>
                                                <td></td>
                                                <td colSpan={7} className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isGroupExpanded(groupKey) ? '' : '-rotate-90'}`} style={{ color: 'var(--odoo-text-secondary)' }} />
                                                        <span className="font-semibold text-xs" style={{ color: 'var(--odoo-text)' }}>{groupKey}</span>
                                                        <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>({rows.length})</span>
                                                        <span className="ml-auto text-xs tabular-nums font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>
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
                                                    style={{ backgroundColor: isSel ? '#f9f5f8' : 'var(--odoo-surface)', borderBottom: '1px solid #f0f0f0',
                                                        borderLeft: isLow ? '2px solid var(--odoo-danger)' : '2px solid transparent' }}
                                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}>
                                                    <td className="px-4 py-2.5">
                                                        <button onClick={() => toggleRow(row.id)} style={{ color: isSel ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>
                                                            {isSel ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> : <Square className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                                                {catalog?.image ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--odoo-border)' }}><Package className="w-3 h-3" /></div>}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium leading-tight cursor-pointer hover:underline"
                                                                    style={{ color: 'var(--odoo-teal)' }}
                                                                    onClick={e => { e.stopPropagation(); openProductDetail(row._item); }}>
                                                                    {row.shortName || row.name}
                                                                </p>
                                                                {row.sku && <p className="text-[10px] font-mono leading-tight" style={{ color: 'var(--odoo-text-muted)' }}>[{row.sku}]</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                                                            style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}>
                                                            <MapPin className="w-2.5 h-2.5" />{row.location}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        {row.lotNumber
                                                            ? <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                                                                style={{ backgroundColor: '#f0e8ed', color: 'var(--odoo-purple)' }}>
                                                                <Hash className="w-2.5 h-2.5" />{row.lotNumber}</span>
                                                            : <span style={{ color: 'var(--odoo-border)' }}>—</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-semibold tabular-nums text-xs" style={{ color: 'var(--odoo-text)' }}>{row.onHand.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.reserved > 0
                                                            ? <span className="font-semibold tabular-nums text-xs" style={{ color: 'var(--odoo-warning)' }}>{row.reserved.toLocaleString()}</span>
                                                            : <span className="text-xs" style={{ color: 'var(--odoo-border)' }}>0</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <span className="font-semibold tabular-nums text-xs" style={{ color: isLow ? 'var(--odoo-danger)' : 'var(--odoo-teal)' }}>
                                                            {row.available.toLocaleString()}
                                                            {isLow && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        {row.expiryDate
                                                            ? <span className="text-xs font-mono"
                                                                style={{ color: isExpiring ? 'var(--odoo-warning)' : 'var(--odoo-text-muted)', fontWeight: isExpiring ? 600 : 400 }}>
                                                                {row.expiryDate}{isExpiring && <AlertTriangle className="w-2.5 h-2.5 inline ml-1" />}</span>
                                                            : <span className="text-xs" style={{ color: 'var(--odoo-border)' }}>—</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <button onClick={e => { e.stopPropagation(); openProductDetail(row._item); }}
                                                                className="text-[11px] flex items-center gap-1 transition-colors" style={{ color: 'var(--odoo-text-secondary)' }} title="Details"
                                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-teal)'}
                                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-text-secondary)'}>
                                                                <Eye className="w-3 h-3" /> Detail
                                                            </button>
                                                            <button onClick={e => { e.stopPropagation(); openHistory(row._item); }}
                                                                className="text-[11px] flex items-center gap-1 transition-colors" style={{ color: 'var(--odoo-text-secondary)' }} title="History"
                                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-teal)'}
                                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-text-secondary)'}>
                                                                <History className="w-3 h-3" /> History
                                                            </button>
                                                            <button onClick={e => { e.stopPropagation(); openTransfer(row._item); }}
                                                                className="text-[11px] flex items-center gap-1 transition-colors" style={{ color: 'var(--odoo-text-secondary)' }} title="Transfer"
                                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-teal)'}
                                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-text-secondary)'}>
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
                                        <td colSpan={9} className="px-5 py-16 text-center" style={{ color: 'var(--odoo-text-muted)' }}>
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
                        <div className="px-4 py-2.5 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}>
                            <span>{pageStart + 1}–{pageEnd} of {totalRecords} records</span>
                            <div className="flex items-center gap-1">
                                {[{ label: '«', p: 1 }, { label: '‹', p: Math.max(1, safePage - 1) }].map((b, i) => (
                                    <button key={i} onClick={() => setPage(b.p)} disabled={safePage === 1}
                                        className="px-2 py-1 rounded disabled:opacity-30 transition-colors" style={{ border: '1px solid var(--odoo-border-ghost)' }}>{b.label}</button>
                                ))}
                                <span className="px-3 py-1 rounded font-semibold" style={{ border: '1px solid var(--odoo-teal)', color: 'var(--odoo-teal)' }}>{safePage}</span>
                                {[{ label: '›', p: Math.min(totalPages, safePage + 1) }, { label: '»', p: totalPages }].map((b, i) => (
                                    <button key={i} onClick={() => setPage(b.p)} disabled={safePage === totalPages}
                                        className="px-2 py-1 rounded disabled:opacity-30 transition-colors" style={{ border: '1px solid var(--odoo-border-ghost)' }}>{b.label}</button>
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
                        <div className="w-full max-w-3xl overflow-y-auto"
                            style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '85vh' }}
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                    <span style={{ color: 'var(--odoo-text-muted)' }}>Inventory</span>
                                    <span style={{ color: 'var(--odoo-border)' }}>/</span>
                                    <span className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{pm.shortName || pm.name}</span>
                                    {pm.sku && <span className="font-mono text-[10px]" style={{ color: 'var(--odoo-text-muted)' }}>[{pm.sku}]</span>}
                                </div>
                                <button onClick={() => setProductModal(null)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Product header */}
                            <div className="px-5 py-4 flex gap-4 shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                <div className="w-20 h-20 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                    {catalog.image ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--odoo-border)' }}><Package className="w-8 h-8" /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--odoo-text)' }}>{pm.name}</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {pm.sku && <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}><Hash className="w-3 h-3" />{pm.sku}</span>}
                                        {pm.location && <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}><MapPin className="w-3 h-3" />{pm.location}</span>}
                                        {isLow && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffc107' }}><AlertTriangle className="w-3 h-3" /> Low Stock</span>}
                                    </div>
                                    {/* Quick KPIs */}
                                    <div className="flex gap-4 mt-2">
                                        {[
                                            { label: 'On Hand', value: (pm.onHand || 0).toLocaleString(), color: 'var(--odoo-text)' },
                                            { label: 'Reserved', value: (pm.reserved || 0).toLocaleString(), color: 'var(--odoo-warning)' },
                                            { label: 'Available', value: ((pm.available ?? pm.onHand) || 0).toLocaleString(), color: 'var(--odoo-teal)' },
                                            { label: 'Value', value: `฿${stockValue.toLocaleString()}`, color: 'var(--odoo-text)' },
                                        ].map((k, i) => (
                                            <div key={i}>
                                                <p className="text-sm font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                <p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>{k.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                {tabs.map(t => (
                                    <button key={t.key}
                                        onClick={() => { setProductDetailTab(t.key); loadTabData(t.key, pm); }}
                                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
                                        style={{
                                            color: productDetailTab === t.key ? 'var(--odoo-purple)' : 'var(--odoo-text-secondary)',
                                            borderBottom: productDetailTab === t.key ? '2px solid var(--odoo-purple)' : '2px solid transparent',
                                            backgroundColor: productDetailTab === t.key ? 'var(--odoo-surface)' : 'transparent',
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
                                        {productDetailData.loading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-teal)' }} /><p className="text-xs mt-2" style={{ color: 'var(--odoo-text-muted)' }}>Loading from Odoo...</p></div>}
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
                                                        <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0 pt-0.5" style={{ color: 'var(--odoo-text-muted)', minWidth: '120px' }}>{f.label}</span>
                                                        <span className="text-xs font-medium" style={{ color: 'var(--odoo-text)' }}>{f.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Lot table */}
                                        {pm.lots?.length > 0 && (
                                            <div className="mt-5">
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--odoo-text-muted)' }}>Lot / Serial Numbers</p>
                                                <div style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                            {['Lot / S/N', 'Qty', 'Received', 'Expiry'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Lot / S/N' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {pm.lots.map((lot, li) => {
                                                                const expiring = lot.expiryDate && new Date(lot.expiryDate) < new Date(Date.now() + 90 * 86400000);
                                                                return (
                                                                    <tr key={li} style={{ borderBottom: li < pm.lots.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                                                        <td className="px-3 py-2"><span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0e8ed', color: 'var(--odoo-purple)' }}>{lot.lotNumber}</span></td>
                                                                        <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{(lot.qty || 0).toLocaleString()}</td>
                                                                        <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--odoo-text-muted)' }}>{lot.receivedDate || '—'}</td>
                                                                        <td className="px-3 py-2 text-right font-mono" style={{ color: expiring ? 'var(--odoo-warning)' : 'var(--odoo-text-muted)', fontWeight: expiring ? 600 : 400 }}>{lot.expiryDate || '—'}{expiring && <AlertTriangle className="w-3 h-3 inline ml-1" />}</td>
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
                                        {productDetailData.purchaseLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-teal)' }} /></div>}
                                        {!productDetailData.purchaseLoading && productDetailData.purchase && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--odoo-text-muted)' }}>Vendors / Suppliers</p>
                                                {productDetailData.purchase.length === 0
                                                    ? <p className="text-sm" style={{ color: 'var(--odoo-text-muted)' }}>No supplier info found</p>
                                                    : <div style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                            <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                {['Vendor', 'Price', 'Min Qty', 'Lead Time'].map(h => (
                                                                    <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                                ))}
                                                            </tr></thead>
                                                            <tbody>
                                                                {productDetailData.purchase.map((v, i) => (
                                                                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--odoo-text)' }}>{v.partner_id?.[1] || '—'}</td>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-teal)' }}>฿{(v.price || 0).toLocaleString()}</td>
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
                                            <p className="text-sm text-center py-4" style={{ color: 'var(--odoo-text-muted)' }}>Click to load purchase data</p>
                                        )}
                                    </div>
                                )}

                                {/* SALES TAB */}
                                {productDetailTab === 'sale' && (
                                    <div>
                                        {productDetailData.saleLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-teal)' }} /></div>}
                                        {!productDetailData.saleLoading && productDetailData.sale && (
                                            <div>
                                                {/* Sales summary */}
                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    {(() => {
                                                        const sales = productDetailData.sale;
                                                        const totalQty = sales.reduce((s, o) => s + (o.product_uom_qty || 0), 0);
                                                        const totalRev = sales.reduce((s, o) => s + (o.price_subtotal || 0), 0);
                                                        return [
                                                            { label: 'Total Orders', value: sales.length, color: 'var(--odoo-purple)' },
                                                            { label: 'Total Qty Sold', value: totalQty.toLocaleString(), color: 'var(--odoo-teal)' },
                                                            { label: 'Total Revenue', value: `฿${totalRev.toLocaleString()}`, color: 'var(--odoo-success)' },
                                                        ].map((k, i) => (
                                                            <div key={i} className="rounded p-3 text-center" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)' }}>
                                                                <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                                <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>{k.label}</p>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--odoo-text-muted)' }}>Recent Sales</p>
                                                <div style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                            {['Order', 'Date', 'Qty', 'Unit Price', 'Subtotal'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Order' || h === 'Date' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {productDetailData.sale.map((s, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-teal)' }}>{s.order_id?.[1] || '—'}</td>
                                                                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>{s.create_date ? new Date(s.create_date).toLocaleDateString() : '—'}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{s.product_uom_qty || 0}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums">฿{(s.price_unit || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--odoo-success)' }}>฿{(s.price_subtotal || 0).toLocaleString()}</td>
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
                                        {productDetailData.inventoryLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-teal)' }} /></div>}
                                        {!productDetailData.inventoryLoading && productDetailData.inventory && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--odoo-text-muted)' }}>Stock by Location (All Warehouses)</p>
                                                <div style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                            {['Location', 'Lot', 'On Hand', 'Reserved', 'Available'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Location' || h === 'Lot' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {productDetailData.inventory.map((q, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}><MapPin className="w-2.5 h-2.5" />{q.location_id?.[1] || '—'}</span></td>
                                                                    <td className="px-3 py-2">{q.lot_id ? <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0e8ed', color: 'var(--odoo-purple)' }}>{q.lot_id[1]}</span> : <span style={{ color: 'var(--odoo-border)' }}>—</span>}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{(q.quantity || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: q.reserved_quantity > 0 ? 'var(--odoo-warning)' : 'var(--odoo-border)' }}>{(q.reserved_quantity || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-teal)' }}>{((q.quantity || 0) - (q.reserved_quantity || 0)).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                                                <td colSpan={2} className="px-3 py-2 font-semibold" style={{ color: 'var(--odoo-text-secondary)' }}>Total</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{productDetailData.inventory.reduce((s, q) => s + (q.quantity || 0), 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: 'var(--odoo-warning)' }}>{productDetailData.inventory.reduce((s, q) => s + (q.reserved_quantity || 0), 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: 'var(--odoo-teal)' }}>{productDetailData.inventory.reduce((s, q) => s + (q.quantity || 0) - (q.reserved_quantity || 0), 0).toLocaleString()}</td>
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
                                        {productDetailData.forecastLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-teal)' }} /></div>}
                                        {!productDetailData.forecastLoading && productDetailData.forecast && (
                                            <div>
                                                {/* Forecast KPI cards */}
                                                <div className="grid grid-cols-4 gap-3 mb-4">
                                                    {[
                                                        { label: 'On Hand', value: (productDetailData.forecast.qty_available || 0).toLocaleString(), color: 'var(--odoo-text)', bg: 'var(--odoo-surface-low)' },
                                                        { label: 'Incoming', value: `+${(productDetailData.forecast.incoming_qty || 0).toLocaleString()}`, color: 'var(--odoo-success)', bg: '#f0fdf4' },
                                                        { label: 'Outgoing', value: `-${(productDetailData.forecast.outgoing_qty || 0).toLocaleString()}`, color: 'var(--odoo-danger)', bg: '#fff5f5' },
                                                        { label: 'Forecasted', value: (productDetailData.forecast.virtual_available || 0).toLocaleString(), color: 'var(--odoo-teal)', bg: '#e8f8fb' },
                                                    ].map((k, i) => (
                                                        <div key={i} className="rounded p-3 text-center" style={{ backgroundColor: k.bg, border: '1px solid var(--odoo-border-ghost)' }}>
                                                            <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                            <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>{k.label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Upcoming moves */}
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--odoo-text-muted)' }}>Upcoming Moves</p>
                                                {productDetailData.forecast.upcoming_moves?.length > 0 ? (
                                                    <div style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                            <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                {['Date', 'Direction', 'Reference', 'Qty', 'Status'].map(h => (
                                                                    <th key={h} className={`px-3 py-2 ${h === 'Qty' ? 'text-right' : 'text-left'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                                ))}
                                                            </tr></thead>
                                                            <tbody>
                                                                {productDetailData.forecast.upcoming_moves.map((m, i) => (
                                                                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>{m.date ? new Date(m.date).toLocaleDateString() : '—'}</td>
                                                                        <td className="px-3 py-2">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                                                                                style={{ backgroundColor: m.direction === 'in' ? '#f0fdf4' : '#fff5f5', color: m.direction === 'in' ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                                                                                {m.direction === 'in' ? <PackageCheck className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                                                                {m.direction === 'in' ? 'Incoming' : 'Outgoing'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-teal)' }}>{m.origin || '—'}</td>
                                                                        <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: m.direction === 'in' ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                                                                            {m.direction === 'in' ? '+' : '-'}{m.product_uom_qty || 0}
                                                                        </td>
                                                                        <td className="px-3 py-2"><span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)' }}>{m.state}</span></td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : <p className="text-sm" style={{ color: 'var(--odoo-text-muted)' }}>No upcoming moves</p>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer actions */}
                            <div className="px-5 py-3 flex items-center gap-4 shrink-0" style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                <button onClick={() => { setProductModal(null); openHistory(pm); }}
                                    className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--odoo-teal)' }}>
                                    <History className="w-3.5 h-3.5" /> Stock History
                                </button>
                                <button onClick={() => { setProductModal(null); openTransfer(pm); }}
                                    className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--odoo-teal)' }}>
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
                        style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                <span style={{ color: 'var(--odoo-text-muted)' }}>Inventory</span><span style={{ color: 'var(--odoo-border)' }}>/</span>
                                <span className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{historyModal.item.shortName || historyModal.item.name}</span>
                                <span style={{ color: 'var(--odoo-border)' }}>/</span><span style={{ color: 'var(--odoo-teal)' }}>Stock History</span>
                            </div>
                            <button onClick={() => setHistoryModal(null)} className="p-1.5 rounded" style={{ color: 'var(--odoo-text-secondary)' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                            <div className="w-9 h-9 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                {PRODUCT_CATALOG[historyModal.item.sku]?.image ? <img src={PRODUCT_CATALOG[historyModal.item.sku].image} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--odoo-border)' }}><Package className="w-4 h-4" /></div>}
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>{historyModal.item.name}</p>
                                <p className="text-[10px] font-mono" style={{ color: 'var(--odoo-text-muted)' }}>{historyModal.item.sku} · On-hand: <span className="font-semibold" style={{ color: 'var(--odoo-teal)' }}>{(historyModal.item.onHand || 0).toLocaleString()}</span></p>
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {historyModal.loading && <div className="flex items-center justify-center py-16" style={{ color: 'var(--odoo-text-muted)' }}><RefreshCw className="w-5 h-5 animate-spin mr-2" style={{ color: 'var(--odoo-teal)' }} /><span className="text-sm">Fetching from Odoo...</span></div>}
                            {!historyModal.loading && historyModal.rows.length === 0 && <div className="py-16 text-center" style={{ color: 'var(--odoo-text-muted)' }}><History className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-sm">No movement history found</p></div>}
                            {!historyModal.loading && historyModal.rows.length > 0 && (
                                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0 }}><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                        {['Date', 'Type', 'Reference', 'Partner', 'Qty', 'Balance'].map(h => (
                                            <th key={h} className={`px-4 py-2.5 ${h === 'Qty' || h === 'Balance' ? 'text-right' : 'text-left'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {historyModal.rows.map((mv, i) => {
                                            const tc = { delivery: { label: 'Delivery', icon: <Truck className="w-3 h-3" />, color: 'var(--odoo-danger)', bg: '#fff5f5' },
                                                receipt: { label: 'Receipt', icon: <PackageCheck className="w-3 h-3" />, color: 'var(--odoo-success)', bg: '#f0fdf4' },
                                                adjustment: { label: 'Adjustment', icon: <Check className="w-3 h-3" />, color: 'var(--odoo-text-secondary)', bg: 'var(--odoo-surface-low)' } }[mv.type] || { label: mv.type, icon: null, color: 'var(--odoo-text-secondary)', bg: 'transparent' };
                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>{mv.date}</td>
                                                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.icon} {tc.label}</span></td>
                                                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--odoo-teal)' }}>{mv.ref}</td>
                                                    <td className="px-4 py-2.5" style={{ color: 'var(--odoo-text)' }}>{mv.partner}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: mv.qty > 0 ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>{mv.qty > 0 ? '+' : ''}{mv.qty.toLocaleString()}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{mv.balance.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-5 py-2.5 text-xs shrink-0 flex items-center gap-2" style={{ borderTop: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-muted)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: historyModal.isLive ? 'var(--odoo-success)' : 'var(--odoo-warning)' }} />
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
                        style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <ArrowRightLeft className="w-4 h-4" style={{ color: 'var(--odoo-teal)' }} /> Internal Transfer
                            </h3>
                            <button onClick={() => setTransferModal(null)} className="p-1.5 rounded" style={{ color: 'var(--odoo-text-secondary)' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Source Location */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Source Location</label>
                                <select value={transferSrc} onChange={e => setTransferSrc(e.target.value)}
                                    className="w-full px-3 py-2 text-sm outline-none" style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', color: 'var(--odoo-text)', backgroundColor: 'var(--odoo-surface)' }}>
                                    <option value="">Select source...</option>
                                    {allOdooLocations.map(l => <option key={l.id} value={l.id}>{l.complete_name}</option>)}
                                    {allOdooLocations.length === 0 && <option value="" disabled>Connect Odoo to load locations</option>}
                                </select>
                            </div>
                            {/* Destination Location */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Destination Location</label>
                                <select value={transferDest} onChange={e => setTransferDest(e.target.value)}
                                    className="w-full px-3 py-2 text-sm outline-none" style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', color: 'var(--odoo-text)', backgroundColor: 'var(--odoo-surface)' }}>
                                    <option value="">Select destination...</option>
                                    {allOdooLocations.map(l => <option key={l.id} value={l.id}>{l.complete_name}</option>)}
                                    {allOdooLocations.length === 0 && <option value="" disabled>Connect Odoo to load locations</option>}
                                </select>
                            </div>
                            {/* Transfer lines */}
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Products</label>
                                {transferLines.map((line, i) => (
                                    <div key={i} className="flex items-center gap-2 mb-2">
                                        <span className="flex-1 text-xs font-mono px-2 py-1.5 rounded truncate" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }}>
                                            {line.sku || line.name || 'Product'}
                                        </span>
                                        <input type="number" value={line.qty} onChange={e => {
                                            const lines = [...transferLines]; lines[i].qty = Math.max(1, parseInt(e.target.value) || 1); setTransferLines(lines);
                                        }} className="w-20 text-center text-sm py-1.5 outline-none" style={{ border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', color: 'var(--odoo-text)' }} />
                                        {transferLines.length > 1 && (
                                            <button onClick={() => setTransferLines(transferLines.filter((_, j) => j !== i))} className="p-1" style={{ color: 'var(--odoo-danger)' }}><X className="w-3.5 h-3.5" /></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <button onClick={() => setTransferModal(null)}
                                className="px-4 py-1.5 text-xs rounded transition-colors" style={{ border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }}>Cancel</button>
                            <button onClick={executeTransfer} disabled={transferLoading}
                                className="px-4 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5"
                                style={{ backgroundColor: 'var(--odoo-teal)', color: 'var(--odoo-surface)', border: 'none', opacity: transferLoading ? 0.7 : 1 }}>
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
                        style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <Shield className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Min/Max Reorder Rules
                            </h3>
                            <button onClick={() => setShowReorderPanel(false)} className="p-1.5 rounded" style={{ color: 'var(--odoo-text-secondary)' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {reorderLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-teal)' }} /></div>}
                            {!reorderLoading && reorderRules.length === 0 && (
                                <div className="py-16 text-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-sm">No reorder rules configured</p>
                                </div>
                            )}
                            {!reorderLoading && reorderRules.length > 0 && (
                                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                    <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                        {['Product', 'Location', 'Min', 'Max', 'To Order', 'Trigger'].map(h => (
                                            <th key={h} className={`px-4 py-2.5 ${h === 'Min' || h === 'Max' || h === 'To Order' ? 'text-right' : 'text-left'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {reorderRules.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--odoo-text)' }}>{r.product_id?.[1] || r.sku || '—'}</td>
                                                <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>{r.location_id?.[1] || 'PICKFACE'}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-danger)' }}>{r.product_min_qty || 0}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-teal)' }}>{r.product_max_qty || 0}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.qty_to_order > 0 ? 'var(--odoo-warning)' : 'var(--odoo-text-muted)' }}>{r.qty_to_order || 0}</td>
                                                <td className="px-4 py-2.5"><span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)' }}>{r.trigger || 'auto'}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-5 py-2.5 text-xs shrink-0" style={{ borderTop: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-muted)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            {reorderRules.length} rules · Odoo stock.warehouse.orderpoint
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
