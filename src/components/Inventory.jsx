import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Search, Minus, AlertTriangle, Package, Tag, X, Check, RefreshCw,
    ChevronDown, ChevronRight, Filter, ArrowUpDown, MapPin, Hash, Boxes,
    TrendingDown, CheckSquare, Square, History, RotateCcw, ChevronLeft,
    Truck, PackageCheck, Plus, ShoppingCart, BarChart2, TrendingUp,
    ArrowRightLeft, Layers, Clock, Shield, Info, List, LayoutGrid,
    Star, PieChart,
} from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';
import { formatDate } from '../utils/dateFormat';
import {
    fetchStockHistory, fetchAllLocations, getStoredAllowedLocations, saveAllowedLocations,
    fetchFullInventory, fetchProductDetail, fetchSupplierInfo, fetchSalesHistory,
    fetchStockByLocation, fetchStockForecast, fetchReorderRules, createReorderRule,
    updateReorderRule, createInternalTransfer,
} from '../services/odooApi';

// ── View modes ──
const VIEW_MODES = { PICKFACE: 'pickface', ALL: 'all' };

const Inventory = ({ inventory, addToast, syncStatus, apiConfigs, activeCompanies = [] }) => {
    const [searchQuery, setSearchQuery]     = useState('');
    const [groupBy, setGroupBy]             = useState('none');
    const [activeFilters, setActiveFilters] = useState([]);
    const [sortBy, setSortBy]               = useState({ col: 'name', dir: 'asc' });
    const [selected, setSelected]           = useState([]);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [warehouseFilter, setWarehouseFilter] = useState('All');
    const [categoryFilter, setCategoryFilter]   = useState('All');
    const [companyFilter, setCompanyFilter]     = useState('All');

    // Dynamic warehouses + categories + companies from actual inventory data
    const invItems = useMemo(() => Array.isArray(inventory) ? inventory : [], [inventory]);

    // Company-aware filtering: filter by selected company first
    const companyFilteredItems = useMemo(() => {
        if (companyFilter === 'All') return invItems;
        return invItems.filter(i => i.companyName === companyFilter);
    }, [invItems, companyFilter]);

    const dynamicCompanies = useMemo(() => {
        const comps = new Set();
        invItems.forEach(i => { if (i.companyName) comps.add(i.companyName); });
        if (comps.size === 0) {
            activeCompanies.forEach(c => {
                const code = c === 'kob' ? 'KOB' : c === 'btv' ? 'BTV' : c.toUpperCase();
                comps.add(code);
            });
        }
        return ['All', ...Array.from(comps).sort()];
    }, [invItems, activeCompanies]);

    const dynamicWarehouses = useMemo(() => {
        const whs = new Set();
        companyFilteredItems.forEach(i => {
            const loc = i.location || '';
            const parts = loc.split('/');
            const wh = parts[0]?.trim();
            if (wh) whs.add(wh);
        });
        return ['All', ...Array.from(whs).sort()];
    }, [companyFilteredItems]);
    const dynamicCategories = useMemo(() => {
        const cats = new Set();
        companyFilteredItems.forEach(i => { if (i.category) cats.add(i.category); });
        return ['All', ...Array.from(cats).sort()];
    }, [companyFilteredItems]);
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
    // Sidebar section collapse
    const [collapsedSections, setCollapsedSections] = useState({});
    const PAGE_SIZE = 80;

    const odooConfig = apiConfigs?.odoo;
    const isLiveMode = !!odooConfig?.enabled;

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

    const getMockHistory = () => [];

    // ── filter / group options (Odoo 18 stock_quant search view) ─────────
    const filterOptions = [
        { key: 'internal',  label: 'Internal Locations', icon: <MapPin className="w-3.5 h-3.5" /> },
        { key: 'in_stock',  label: 'In Stock',           icon: <Package className="w-3.5 h-3.5" /> },
        { key: 'low_stock', label: 'Low Stock',          icon: <TrendingDown className="w-3.5 h-3.5" /> },
        { key: 'negative',  label: 'Negative Stock',     icon: <Minus className="w-3.5 h-3.5" /> },
        { key: 'reserved',  label: 'Reservations',       icon: <Tag className="w-3.5 h-3.5" /> },
        { key: 'has_lot',   label: 'Lot/Serial Number',  icon: <Hash className="w-3.5 h-3.5" /> },
        { key: 'starred',   label: 'Starred Products',   icon: <Star className="w-3.5 h-3.5" /> },
    ];
    const groupOptions = [
        { key: 'none',     label: 'No Grouping',      icon: null },
        { key: 'product',  label: 'Product',           icon: <Package className="w-3.5 h-3.5" /> },
        { key: 'category', label: 'Product Category',  icon: <Tag className="w-3.5 h-3.5" /> },
        { key: 'location', label: 'Location',          icon: <MapPin className="w-3.5 h-3.5" /> },
        { key: 'lot',      label: 'Lot/Serial Number', icon: <Hash className="w-3.5 h-3.5" /> },
    ];

    const toggleFilter  = (key) => setActiveFilters(f => f.includes(key) ? f.filter(x => x !== key) : [...f, key]);
    const toggleSort    = (col) => setSortBy(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    const toggleGroup   = (key) => setExpandedGroups(g => ({ ...g, [key]: !g[key] }));
    const isGroupExpanded = (key) => groupBy === 'none' ? true : expandedGroups[key] !== false;
    const toggleSection = (key) => setCollapsedSections(s => ({ ...s, [key]: !s[key] }));

    // ── location whitelist check ──────────────────────────────────────────────
    const isLocationAllowed = (loc) => {
        if (viewMode === VIEW_MODES.ALL) return true;
        if (!loc) return true;
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
                        companyName: item.companyName || '',
                        lotNumber: lot.lotNumber || '', expiryDate: lot.expiryDate || '',
                        receivedDate: lot.receivedDate || '',
                        onHand: lot.qty ?? item.onHand, reserved: item.reserved || 0,
                        available: (lot.qty ?? item.onHand) - (item.reserved || 0),
                        unitCost: item.unitCost || 0, reorderPoint: item.reorderPoint || 10,
                        uom: item.uom || 'Units',
                        _item: item,
                    });
                }
            } else {
                rows.push({
                    id: `row-${idx++}-${item.sku || item.productId || item.name || ''}`,
                    productId: item.productId, sku: item.sku || '',
                    name: item.name || '', shortName: item.shortName || item.name || '',
                    location: item.location || 'PICKFACE', category: item.category || 'Skincare',
                    companyName: item.companyName || '',
                    lotNumber: '', expiryDate: '', receivedDate: '',
                    onHand: item.onHand || 0, reserved: item.reserved || 0,
                    available: item.available ?? (item.onHand - item.reserved),
                    unitCost: item.unitCost || 0, reorderPoint: item.reorderPoint || 10,
                    uom: item.uom || 'Units',
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
        if (companyFilter !== 'All') rows = rows.filter(r => r.companyName === companyFilter);
        if (warehouseFilter !== 'All') rows = rows.filter(r => (r.location || '').includes(warehouseFilter));
        if (categoryFilter  !== 'All') rows = rows.filter(r => r.category === categoryFilter);
        if (activeFilters.includes('low_stock')) rows = rows.filter(r => r.available <= r.reorderPoint);
        if (activeFilters.includes('negative'))  rows = rows.filter(r => r.onHand < 0);
        if (activeFilters.includes('has_lot'))   rows = rows.filter(r => r.lotNumber);
        if (activeFilters.includes('reserved'))  rows = rows.filter(r => r.reserved > 0);
        if (activeFilters.includes('in_stock'))  rows = rows.filter(r => r.onHand > 0);
        if (activeFilters.includes('internal'))  rows = rows.filter(r => !r.location.toLowerCase().includes('transit'));
        rows.sort((a, b) => {
            let va = a[sortBy.col] ?? '', vb = b[sortBy.col] ?? '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortBy.dir === 'asc' ? -1 : 1;
            if (va > vb) return sortBy.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return rows;
    }, [flatRows, searchQuery, warehouseFilter, categoryFilter, companyFilter, activeFilters, sortBy]);

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
            const key = groupBy === 'product' ? (row.shortName || row.name)
                : groupBy === 'location' ? row.location
                : groupBy === 'lot' ? (row.lotNumber || '(No Lot)')
                : groupBy === 'category' ? (row.category || 'Uncategorized')
                : '';
            if (!g[key]) g[key] = [];
            g[key].push(row);
        }
        return g;
    }, [pagedRows, groupBy]);

    // ── Sums for footer ───────────────────────────────────────────────────────
    const columnSums = useMemo(() => {
        let onHand = 0, reserved = 0, available = 0;
        for (const r of filteredRows) {
            onHand += r.onHand;
            reserved += r.reserved;
            available += r.available;
        }
        return { onHand, reserved, available };
    }, [filteredRows]);

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

    // Category counts for sidebar
    const categoryCounts = useMemo(() => {
        const counts = {};
        flatRows.forEach(r => {
            const cat = r.category || 'Uncategorized';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [flatRows]);

    const allPageIds  = pagedRows.map(r => r.id);
    const allSelected = allPageIds.length > 0 && allPageIds.every(id => selected.includes(id));
    const toggleAll   = () => setSelected(allSelected ? [] : allPageIds);
    const toggleRow   = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

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
            if (viewMode === VIEW_MODES.ALL) {
                fetchFullInventory(odooConfig || {}).then(d => setAllLocationInventory(d)).catch(() => {});
            }
        } else {
            addToast(`Transfer failed: ${result.error || 'Unknown error'}`, 'error');
        }
    };

    // Active filter count for badge
    const totalActiveFilters = activeFilters.length
        + (warehouseFilter !== 'All' ? 1 : 0)
        + (categoryFilter !== 'All' ? 1 : 0)
        + (companyFilter !== 'All' ? 1 : 0);

    // ── Sort icon helper ──────────────────────────────────────────────────────
    const SortIcon = ({ col }) => {
        const isActive = sortBy.col === col;
        return (
            <ArrowUpDown className="w-3 h-3 inline ml-1"
                style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)', opacity: isActive ? 1 : 0.4 }} />
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="flex h-full" style={{ minHeight: 0 }}>

            {/* ═══════════════════════════════════════════════════════════════
                LEFT SIDEBAR — Odoo 18 Search Panel
                Vertical list of checkbox filters + group-by, matching
                stock_quant_views.xml search panel structure
            ═══════════════════════════════════════════════════════════════ */}
            {leftPanelOpen && (
                <aside className="shrink-0 flex flex-col h-full overflow-y-auto custom-scrollbar"
                    style={{
                        width: '248px',
                        backgroundColor: 'var(--odoo-surface)',
                        borderRight: '1px solid var(--odoo-border-ghost)',
                    }}>

                    {/* ── FILTERS section ── */}
                    <div className="pt-4 pb-2">
                        <button onClick={() => toggleSection('filters')}
                            className="flex items-center justify-between w-full px-4 py-1.5 text-left">
                            <span className="text-[11px] font-bold uppercase tracking-widest"
                                style={{ color: 'var(--odoo-text-muted)' }}>Filters</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.filters ? '-rotate-90' : ''}`}
                                style={{ color: 'var(--odoo-text-muted)' }} />
                        </button>
                        {!collapsedSections.filters && (
                            <div className="mt-1 space-y-0.5 px-2">
                                {filterOptions.map(f => {
                                    const isActive = activeFilters.includes(f.key);
                                    return (
                                        <button key={f.key}
                                            onClick={() => { toggleFilter(f.key); setPage(1); }}
                                            className="flex items-center gap-2.5 w-full px-2.5 py-[6px] text-[13px] rounded transition-colors"
                                            style={{
                                                color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)',
                                                fontWeight: isActive ? 600 : 400,
                                                backgroundColor: isActive ? 'rgba(113,75,103,0.06)' : 'transparent',
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(113,75,103,0.06)' : 'transparent'; }}>
                                            {/* Checkbox visual */}
                                            <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                                                style={{
                                                    borderColor: isActive ? 'var(--odoo-purple)' : 'var(--odoo-border)',
                                                    backgroundColor: isActive ? 'var(--odoo-purple)' : 'transparent',
                                                }}>
                                                {isActive && <Check className="w-2.5 h-2.5" style={{ color: '#fff' }} />}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>{f.icon}</span>
                                                {f.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--odoo-border-ghost)', margin: '4px 16px' }} />

                    {/* ── GROUP BY section ── */}
                    <div className="py-2">
                        <button onClick={() => toggleSection('groupby')}
                            className="flex items-center justify-between w-full px-4 py-1.5 text-left">
                            <span className="text-[11px] font-bold uppercase tracking-widest"
                                style={{ color: 'var(--odoo-text-muted)' }}>Group By</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.groupby ? '-rotate-90' : ''}`}
                                style={{ color: 'var(--odoo-text-muted)' }} />
                        </button>
                        {!collapsedSections.groupby && (
                            <div className="mt-1 space-y-0.5 px-2">
                                {groupOptions.filter(g => g.key !== 'none').map(g => {
                                    const isActive = groupBy === g.key;
                                    return (
                                        <button key={g.key}
                                            onClick={() => { setGroupBy(isActive ? 'none' : g.key); setPage(1); }}
                                            className="flex items-center gap-2.5 w-full px-2.5 py-[6px] text-[13px] rounded transition-colors"
                                            style={{
                                                color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)',
                                                fontWeight: isActive ? 600 : 400,
                                                backgroundColor: isActive ? 'rgba(113,75,103,0.06)' : 'transparent',
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(113,75,103,0.06)' : 'transparent'; }}>
                                            <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                                                style={{
                                                    borderColor: isActive ? 'var(--odoo-purple)' : 'var(--odoo-border)',
                                                    backgroundColor: isActive ? 'var(--odoo-purple)' : 'transparent',
                                                }}>
                                                {isActive && <Check className="w-2.5 h-2.5" style={{ color: '#fff' }} />}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                {g.icon && <span style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>{g.icon}</span>}
                                                {g.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--odoo-border-ghost)', margin: '4px 16px' }} />

                    {/* ── VIEW MODE section ── */}
                    <div className="py-2">
                        <button onClick={() => toggleSection('viewmode')}
                            className="flex items-center justify-between w-full px-4 py-1.5 text-left">
                            <span className="text-[11px] font-bold uppercase tracking-widest"
                                style={{ color: 'var(--odoo-text-muted)' }}>Location Scope</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.viewmode ? '-rotate-90' : ''}`}
                                style={{ color: 'var(--odoo-text-muted)' }} />
                        </button>
                        {!collapsedSections.viewmode && (
                            <div className="mt-1 space-y-0.5 px-2">
                                {[
                                    { key: VIEW_MODES.PICKFACE, label: 'Pickface Only', icon: <MapPin className="w-3.5 h-3.5" /> },
                                    { key: VIEW_MODES.ALL, label: 'All Locations', icon: <Layers className="w-3.5 h-3.5" /> },
                                ].map(v => {
                                    const isActive = viewMode === v.key;
                                    return (
                                        <button key={v.key}
                                            onClick={() => { setViewMode(v.key); setPage(1); }}
                                            className="flex items-center gap-2.5 w-full px-2.5 py-[6px] text-[13px] rounded transition-colors"
                                            style={{
                                                color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)',
                                                fontWeight: isActive ? 600 : 400,
                                                backgroundColor: isActive ? 'rgba(113,75,103,0.06)' : 'transparent',
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(113,75,103,0.06)' : 'transparent'; }}>
                                            <span className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                                                style={{
                                                    borderColor: isActive ? 'var(--odoo-purple)' : 'var(--odoo-border)',
                                                    borderWidth: isActive ? '5px' : '1px',
                                                }} />
                                            <span className="flex items-center gap-1.5">
                                                <span style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}>{v.icon}</span>
                                                {v.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--odoo-border-ghost)', margin: '4px 16px' }} />

                    {/* ── COMPANY section ── */}
                    {dynamicCompanies.length > 2 && (
                        <>
                            <div className="py-2">
                                <button onClick={() => toggleSection('company')}
                                    className="flex items-center justify-between w-full px-4 py-1.5 text-left">
                                    <span className="text-[11px] font-bold uppercase tracking-widest"
                                        style={{ color: 'var(--odoo-text-muted)' }}>Company</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.company ? '-rotate-90' : ''}`}
                                        style={{ color: 'var(--odoo-text-muted)' }} />
                                </button>
                                {!collapsedSections.company && (
                                    <div className="mt-1 space-y-0.5 px-2">
                                        {dynamicCompanies.map(comp => {
                                            const isActive = companyFilter === comp;
                                            const count = comp === 'All' ? invItems.length : invItems.filter(i => i.companyName === comp).length;
                                            return (
                                                <button key={comp}
                                                    onClick={() => { setCompanyFilter(comp); setWarehouseFilter('All'); setPage(1); }}
                                                    className="flex items-center justify-between w-full px-2.5 py-[6px] text-[13px] rounded transition-colors"
                                                    style={{
                                                        color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)',
                                                        fontWeight: isActive ? 600 : 400,
                                                        backgroundColor: isActive ? 'rgba(113,75,103,0.06)' : 'transparent',
                                                    }}
                                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(113,75,103,0.06)' : 'transparent'; }}>
                                                    <span className="flex items-center gap-2">
                                                        <Shield className="w-3.5 h-3.5" style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }} />
                                                        {comp}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                                                        style={{ backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-muted)' }}>{count}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div style={{ height: '1px', backgroundColor: 'var(--odoo-border-ghost)', margin: '4px 16px' }} />
                        </>
                    )}

                    {/* ── WAREHOUSE section ── */}
                    {dynamicWarehouses.length > 1 && (
                        <>
                            <div className="py-2">
                                <button onClick={() => toggleSection('warehouse')}
                                    className="flex items-center justify-between w-full px-4 py-1.5 text-left">
                                    <span className="text-[11px] font-bold uppercase tracking-widest"
                                        style={{ color: 'var(--odoo-text-muted)' }}>Warehouse</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.warehouse ? '-rotate-90' : ''}`}
                                        style={{ color: 'var(--odoo-text-muted)' }} />
                                </button>
                                {!collapsedSections.warehouse && (
                                    <div className="mt-1 space-y-0.5 px-2">
                                        {dynamicWarehouses.map(wh => {
                                            const isActive = warehouseFilter === wh;
                                            return (
                                                <button key={wh}
                                                    onClick={() => { setWarehouseFilter(wh); setPage(1); }}
                                                    className="flex items-center gap-2.5 w-full px-2.5 py-[6px] text-[13px] rounded transition-colors"
                                                    style={{
                                                        color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)',
                                                        fontWeight: isActive ? 600 : 400,
                                                        backgroundColor: isActive ? 'rgba(113,75,103,0.06)' : 'transparent',
                                                    }}
                                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(113,75,103,0.06)' : 'transparent'; }}>
                                                    <Package className="w-3.5 h-3.5" style={{ color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }} />
                                                    {wh}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div style={{ height: '1px', backgroundColor: 'var(--odoo-border-ghost)', margin: '4px 16px' }} />
                        </>
                    )}

                    {/* ── CATEGORY section ── */}
                    <div className="py-2 pb-4">
                        <button onClick={() => toggleSection('category')}
                            className="flex items-center justify-between w-full px-4 py-1.5 text-left">
                            <span className="text-[11px] font-bold uppercase tracking-widest"
                                style={{ color: 'var(--odoo-text-muted)' }}>Product Category</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.category ? '-rotate-90' : ''}`}
                                style={{ color: 'var(--odoo-text-muted)' }} />
                        </button>
                        {!collapsedSections.category && (
                            <div className="mt-1 space-y-0.5 px-2">
                                {dynamicCategories.map(cat => {
                                    const isActive = categoryFilter === cat;
                                    const count = cat === 'All' ? flatRows.length : (categoryCounts[cat] || 0);
                                    return (
                                        <button key={cat}
                                            onClick={() => { setCategoryFilter(cat); setPage(1); }}
                                            className="flex items-center justify-between w-full px-2.5 py-[6px] text-[13px] rounded transition-colors"
                                            style={{
                                                color: isActive ? 'var(--odoo-purple)' : 'var(--odoo-text)',
                                                fontWeight: isActive ? 600 : 400,
                                                backgroundColor: isActive ? 'rgba(113,75,103,0.06)' : 'transparent',
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(113,75,103,0.06)' : 'transparent'; }}>
                                            <span>{cat}</span>
                                            {cat !== 'All' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                                                    style={{ backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-muted)' }}>{count}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MAIN CONTENT — Odoo 18 Control Panel + List View
            ═══════════════════════════════════════════════════════════════ */}
            <main className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'var(--odoo-bg)' }}>

                {/* ── Control Panel (Odoo 18 top bar) ────────────────────────── */}
                <header className="shrink-0"
                    style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderBottom: '1px solid var(--odoo-border-ghost)',
                    }}>
                    {/* Row 1: Breadcrumbs + Actions */}
                    <div className="flex items-center justify-between px-4 h-[44px]">
                        <div className="flex items-center gap-3">
                            {/* Sidebar toggle */}
                            <button onClick={() => setLeftPanelOpen(p => !p)}
                                className="p-1 rounded transition-colors"
                                style={{ color: leftPanelOpen ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                title={leftPanelOpen ? 'Hide search panel' : 'Show search panel'}>
                                <Filter className="w-4 h-4" />
                                {totalActiveFilters > 0 && (
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center"
                                        style={{ backgroundColor: 'var(--odoo-purple)', color: '#fff' }}>{totalActiveFilters}</span>
                                )}
                            </button>

                            {/* Breadcrumb */}
                            <nav className="flex items-center text-sm">
                                <span className="font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>Inventory</span>
                                <ChevronRight className="w-3.5 h-3.5 mx-1.5" style={{ color: 'var(--odoo-text-muted)' }} />
                                <span className="font-semibold" style={{ color: 'var(--odoo-text)' }}>Products</span>
                            </nav>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Action buttons: Relocate + New */}
                            <button onClick={() => openTransfer(null)}
                                className="odoo-btn-secondary odoo-btn text-xs"
                                style={{ padding: '0.3rem 0.75rem' }}>
                                <ArrowRightLeft className="w-3.5 h-3.5" /> Relocate
                            </button>
                            <button onClick={() => openTransfer(null)}
                                className="odoo-btn-primary odoo-btn text-xs"
                                style={{ padding: '0.3rem 0.75rem' }}>
                                <Plus className="w-3.5 h-3.5" /> New
                            </button>

                            {/* Divider */}
                            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--odoo-border-ghost)', margin: '0 4px' }} />

                            {/* View switcher: List / Kanban / Pivot / Graph */}
                            <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
                                {[
                                    { icon: <List className="w-4 h-4" />, title: 'List', active: true },
                                    { icon: <LayoutGrid className="w-4 h-4" />, title: 'Kanban', active: false },
                                    { icon: <BarChart2 className="w-4 h-4" />, title: 'Pivot', active: false },
                                    { icon: <PieChart className="w-4 h-4" />, title: 'Graph', active: false },
                                ].map((v, i) => (
                                    <button key={v.title}
                                        onClick={() => { if (!v.active) addToast(`${v.title} view coming soon`, 'info'); }}
                                        className="p-1.5 transition-colors"
                                        style={{
                                            backgroundColor: v.active ? 'var(--odoo-purple)' : 'transparent',
                                            color: v.active ? '#fff' : 'var(--odoo-text-muted)',
                                            borderRight: i < 3 ? '1px solid var(--odoo-border-ghost)' : 'none',
                                        }}
                                        onMouseEnter={e => { if (!v.active) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                        onMouseLeave={e => { if (!v.active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        title={v.title}>
                                        {v.icon}
                                    </button>
                                ))}
                            </div>

                            {/* Sync spinner */}
                            {(syncStatus?.isSyncing || loadingAllLoc) && (
                                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--odoo-purple)' }} />
                            )}
                        </div>
                    </div>

                    {/* Row 2: Search bar + active filter chips */}
                    <div className="flex items-center gap-2 px-4 pb-2">
                        {/* Search input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                            <input type="text" value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                placeholder="Search by SKU, name, location, lot..."
                                className="w-full pl-8 pr-3 py-[5px] text-[13px] rounded outline-none"
                                style={{
                                    backgroundColor: 'var(--odoo-surface-low)',
                                    border: '1px solid var(--odoo-border-ghost)',
                                    color: 'var(--odoo-text)',
                                }}
                                onFocus={e => e.currentTarget.style.borderColor = 'var(--odoo-purple)'}
                                onBlur={e => e.currentTarget.style.borderColor = 'var(--odoo-border-ghost)'} />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(''); setPage(1); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded"
                                    style={{ color: 'var(--odoo-text-muted)' }}>
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Active filter chips */}
                        {totalActiveFilters > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                                {activeFilters.map(f => {
                                    const opt = filterOptions.find(o => o.key === f);
                                    return (
                                        <span key={f} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded"
                                            style={{ backgroundColor: 'rgba(113,75,103,0.08)', color: 'var(--odoo-purple)' }}>
                                            {opt?.label}
                                            <button onClick={() => toggleFilter(f)} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                        </span>
                                    );
                                })}
                                {warehouseFilter !== 'All' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded"
                                        style={{ backgroundColor: 'rgba(113,75,103,0.08)', color: 'var(--odoo-purple)' }}>
                                        {warehouseFilter}
                                        <button onClick={() => setWarehouseFilter('All')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                    </span>
                                )}
                                {categoryFilter !== 'All' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded"
                                        style={{ backgroundColor: 'rgba(113,75,103,0.08)', color: 'var(--odoo-purple)' }}>
                                        {categoryFilter}
                                        <button onClick={() => setCategoryFilter('All')} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                    </span>
                                )}
                                {companyFilter !== 'All' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded"
                                        style={{ backgroundColor: 'rgba(113,75,103,0.08)', color: 'var(--odoo-purple)' }}>
                                        {companyFilter}
                                        <button onClick={() => { setCompanyFilter('All'); setWarehouseFilter('All'); }} className="ml-0.5 opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                                    </span>
                                )}
                                <button onClick={() => { setActiveFilters([]); setWarehouseFilter('All'); setCategoryFilter('All'); setCompanyFilter('All'); setPage(1); }}
                                    className="text-[11px] ml-1 transition-colors"
                                    style={{ color: 'var(--odoo-danger)' }}>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                {/* ── Table Container (Odoo 18 list view) ────────────────────── */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        {/* Sticky header */}
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr style={{ backgroundColor: 'var(--odoo-surface)' }}>
                                {/* Checkbox */}
                                <th className="w-10 px-3 py-2.5" style={{ borderBottom: '2px solid var(--odoo-border)' }}>
                                    <button onClick={toggleAll}>
                                        {allSelected
                                            ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                            : <Square className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />}
                                    </button>
                                </th>
                                {/* Column headers matching Odoo 18 stock.quant list */}
                                {[
                                    { label: 'Location',         col: 'location',  align: 'left',  minW: '120px' },
                                    { label: 'Product',          col: 'name',      align: 'left',  minW: '200px' },
                                    { label: 'Lot/Serial Number',col: 'lotNumber', align: 'left',  minW: '110px' },
                                    { label: 'On Hand Quantity', col: 'onHand',    align: 'right', minW: '110px' },
                                    { label: 'Reserved',         col: 'reserved',  align: 'right', minW: '90px' },
                                    { label: 'Available',        col: 'available', align: 'right', minW: '90px' },
                                    { label: 'Unit',             col: 'uom',       align: 'left',  minW: '60px' },
                                ].map(h => (
                                    <th key={h.col}
                                        className={`px-3 py-2.5 cursor-pointer select-none`}
                                        style={{
                                            color: 'var(--odoo-text-secondary)',
                                            fontWeight: 700,
                                            fontSize: '11px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            borderBottom: '2px solid var(--odoo-border)',
                                            whiteSpace: 'nowrap',
                                            textAlign: h.align,
                                            minWidth: h.minW,
                                        }}
                                        onClick={() => toggleSort(h.col)}>
                                        {h.label}<SortIcon col={h.col} />
                                    </th>
                                ))}
                                {/* Actions column */}
                                <th className="w-20 px-3 py-2.5" style={{ borderBottom: '2px solid var(--odoo-border)' }} />
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {Object.entries(grouped).map(([groupKey, rows]) => (
                                <React.Fragment key={groupKey}>
                                    {/* Group header row */}
                                    {groupBy !== 'none' && (
                                        <tr className="cursor-pointer"
                                            style={{ backgroundColor: 'var(--odoo-surface-low)' }}
                                            onClick={() => toggleGroup(groupKey)}>
                                            <td className="px-3 py-2">
                                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isGroupExpanded(groupKey) ? '' : '-rotate-90'}`}
                                                    style={{ color: 'var(--odoo-text-secondary)' }} />
                                            </td>
                                            <td colSpan={5} className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-[13px]" style={{ color: 'var(--odoo-text)' }}>{groupKey}</span>
                                                    <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>({rows.length})</span>
                                                </div>
                                            </td>
                                            {/* Aggregated sums in group header */}
                                            <td className="px-3 py-2 text-right">
                                                <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                    {rows.reduce((s, r) => s + r.onHand, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                    {rows.reduce((s, r) => s + r.reserved, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td colSpan={2} />
                                        </tr>
                                    )}
                                    {/* Data rows */}
                                    {isGroupExpanded(groupKey) && rows.map(row => {
                                        const catalog = PRODUCT_CATALOG[row.sku];
                                        const isLow = row.available <= row.reorderPoint;
                                        const isNegative = row.available < 0;
                                        const isSel = selected.includes(row.id);
                                        return (
                                            <tr key={row.id}
                                                className="group transition-colors"
                                                style={{
                                                    backgroundColor: isSel ? 'rgba(113,75,103,0.04)' : 'var(--odoo-surface)',
                                                    borderBottom: '1px solid var(--odoo-border-ghost)',
                                                }}
                                                onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = isSel ? 'rgba(113,75,103,0.04)' : 'var(--odoo-surface)'; }}>
                                                {/* Checkbox */}
                                                <td className="px-3 py-2.5">
                                                    <button onClick={() => toggleRow(row.id)}>
                                                        {isSel
                                                            ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                                                            : <Square className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />}
                                                    </button>
                                                </td>
                                                {/* Location */}
                                                <td className="px-3 py-2.5">
                                                    <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                                        style={{ backgroundColor: 'var(--odoo-surface-low)', color: 'var(--odoo-text-secondary)' }}>
                                                        {row.location}
                                                    </span>
                                                </td>
                                                {/* Product (name + category subtitle) */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded overflow-hidden shrink-0 flex items-center justify-center"
                                                            style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                                            {catalog?.image
                                                                ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                                                : <Package className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-medium truncate cursor-pointer"
                                                                style={{ color: 'var(--odoo-text)' }}
                                                                onClick={e => { e.stopPropagation(); openProductDetail(row._item); }}
                                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-purple)'}
                                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-text)'}>
                                                                {row.shortName || row.name}
                                                            </div>
                                                            <div className="text-[11px] flex items-center gap-1.5"
                                                                style={{ color: 'var(--odoo-text-muted)' }}>
                                                                <span className="font-mono">{row.sku || '---'}</span>
                                                                <span style={{ color: 'var(--odoo-border)' }}>|</span>
                                                                <span>{row.category || 'Product'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Lot/Serial Number */}
                                                <td className="px-3 py-2.5">
                                                    {row.lotNumber
                                                        ? <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                                                            style={{ backgroundColor: 'rgba(113,75,103,0.06)', color: 'var(--odoo-purple)' }}>
                                                            {row.lotNumber}
                                                        </span>
                                                        : <span style={{ color: 'var(--odoo-text-muted)' }}>---</span>}
                                                </td>
                                                {/* On Hand Quantity (editable-style highlight) */}
                                                <td className="px-3 py-2.5 text-right">
                                                    <span className="inline-block tabular-nums font-semibold px-2 py-0.5 rounded"
                                                        style={{
                                                            backgroundColor: row.onHand === 0 ? 'rgba(228,111,120,0.06)' : 'rgba(1,126,132,0.06)',
                                                            color: row.onHand === 0 ? 'var(--odoo-danger)' : 'var(--odoo-success)',
                                                            minWidth: '60px',
                                                            textAlign: 'right',
                                                        }}>
                                                        {row.onHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                {/* Reserved */}
                                                <td className="px-3 py-2.5 text-right">
                                                    <span className="tabular-nums" style={{ color: row.reserved > 0 ? 'var(--odoo-warning)' : 'var(--odoo-text-muted)' }}>
                                                        {row.reserved.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                {/* Available */}
                                                <td className="px-3 py-2.5 text-right">
                                                    <span className="tabular-nums font-medium"
                                                        style={{
                                                            color: isNegative ? 'var(--odoo-danger)' : isLow ? 'var(--odoo-warning)' : 'var(--odoo-text)',
                                                        }}>
                                                        {row.available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                {/* Unit */}
                                                <td className="px-3 py-2.5" style={{ color: 'var(--odoo-text-muted)' }}>
                                                    {row.uom}
                                                </td>
                                                {/* Row action buttons: History + Replenishment */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={e => { e.stopPropagation(); openHistory(row._item); }}
                                                            title="History"
                                                            className="p-1.5 rounded transition-colors"
                                                            style={{ color: 'var(--odoo-text-muted)' }}
                                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--odoo-purple)'; e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--odoo-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                                            <Clock className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={e => { e.stopPropagation(); setShowReorderPanel(true); loadReorderRules(); }}
                                                            title="Replenishment"
                                                            className="p-1.5 rounded transition-colors"
                                                            style={{ color: 'var(--odoo-text-muted)' }}
                                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--odoo-purple)'; e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--odoo-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            {/* Empty state */}
                            {filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-5 py-16 text-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                        <Boxes className="w-9 h-9 mx-auto mb-2.5 opacity-20" />
                                        <p className="text-sm">{loadingAllLoc ? 'Loading all locations...' : 'No inventory records found'}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {/* Table footer with SUMs (Odoo 18 pattern) */}
                        {filteredRows.length > 0 && (
                            <tfoot>
                                <tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderTop: '2px solid var(--odoo-border)' }}>
                                    <td className="px-3 py-2.5" />
                                    <td className="px-3 py-2.5" />
                                    <td className="px-3 py-2.5" />
                                    <td className="px-3 py-2.5" />
                                    {/* On Hand SUM */}
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>
                                            {columnSums.onHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    {/* Reserved SUM */}
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--odoo-warning)' }}>
                                            {columnSums.reserved.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    {/* Available SUM */}
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--odoo-success)' }}>
                                            {columnSums.available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5" />
                                    <td className="px-3 py-2.5" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* ── Pagination (Odoo 18 style: "1-80 / 481" with arrows) ─── */}
                <div className="shrink-0 flex items-center justify-between px-4 h-[40px]"
                    style={{
                        backgroundColor: 'var(--odoo-surface)',
                        borderTop: '1px solid var(--odoo-border-ghost)',
                    }}>
                    {/* Record count + selection info */}
                    <div className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                        {selected.length > 0
                            ? <span><span className="font-semibold" style={{ color: 'var(--odoo-purple)' }}>{selected.length}</span> selected</span>
                            : <span>{totalRecords} record{totalRecords !== 1 ? 's' : ''}</span>}
                    </div>

                    {/* Odoo pagination: "1-80 / 481" */}
                    {totalRecords > 0 && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                className="p-1 rounded transition-colors disabled:opacity-25"
                                style={{ color: 'var(--odoo-text-secondary)' }}
                                onMouseEnter={e => { if (safePage !== 1) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'; }}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="font-medium tabular-nums px-1">
                                <span className="font-semibold">{totalRecords === 0 ? '0' : `${pageStart + 1}-${pageEnd}`}</span>
                                <span style={{ color: 'var(--odoo-text-muted)' }}> / </span>
                                <span>{totalRecords}</span>
                            </span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                className="p-1 rounded transition-colors disabled:opacity-25"
                                style={{ color: 'var(--odoo-text-secondary)' }}
                                onMouseEnter={e => { if (safePage !== totalPages) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'; }}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* ══════════════════════════════════════════════════════════════════
                PRODUCT DETAIL MODAL (Odoo-style with tabs)
            ══════════════════════════════════════════════════════════════════ */}
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
                            style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '85vh' }}
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                    <span style={{ color: 'var(--odoo-text-muted)' }}>Inventory</span>
                                    <ChevronRight className="w-3 h-3" style={{ color: 'var(--odoo-text-muted)' }} />
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
                                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                    {catalog.image ? <img src={catalog.image} alt="" className="w-full h-full object-cover" />
                                        : <Package className="w-8 h-8" style={{ color: 'var(--odoo-text-muted)' }} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--odoo-text)' }}>{pm.name}</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {pm.sku && <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}><Hash className="w-3 h-3" />{pm.sku}</span>}
                                        {pm.location && <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}><MapPin className="w-3 h-3" />{pm.location}</span>}
                                        {isLow && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: 'rgba(255,172,0,0.12)', color: 'var(--odoo-warning)', border: '1px solid rgba(255,172,0,0.3)' }}><AlertTriangle className="w-3 h-3" /> Low Stock</span>}
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                        {[
                                            { label: 'On Hand', value: (pm.onHand || 0).toLocaleString(), color: 'var(--odoo-text)' },
                                            { label: 'Reserved', value: (pm.reserved || 0).toLocaleString(), color: 'var(--odoo-warning)' },
                                            { label: 'Available', value: ((pm.available ?? pm.onHand) || 0).toLocaleString(), color: 'var(--odoo-success)' },
                                            { label: 'Value', value: `${stockValue.toLocaleString()}`, color: 'var(--odoo-text)' },
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
                                        {productDetailData.loading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-purple)' }} /><p className="text-xs mt-2" style={{ color: 'var(--odoo-text-muted)' }}>Loading from Odoo...</p></div>}
                                        {!productDetailData.loading && (
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                                {[
                                                    { label: 'Category', value: detail.categ_id?.[1] || pm.category || '---' },
                                                    { label: 'Product Type', value: detail.detailed_type === 'product' ? 'Storable' : detail.detailed_type === 'consu' ? 'Consumable' : detail.detailed_type || 'Storable' },
                                                    { label: 'Tracking', value: detail.tracking === 'lot' ? 'By Lots' : detail.tracking === 'serial' ? 'By Serial' : detail.tracking || '---' },
                                                    { label: 'UoM', value: detail.uom_id?.[1] || 'Units' },
                                                    { label: 'Sales Price', value: detail.list_price ? `${detail.list_price.toLocaleString()}` : (pm.unitCost ? `${(pm.unitCost * 1.5).toFixed(0)}` : '---') },
                                                    { label: 'Cost', value: detail.standard_price ? `${detail.standard_price.toLocaleString()}` : (pm.unitCost ? `${pm.unitCost.toLocaleString()}` : '---') },
                                                    { label: 'Internal Reference', value: detail.default_code || pm.sku || '---' },
                                                    { label: 'Barcode', value: detail.barcode || catalog?.barcode || '---' },
                                                    { label: 'Sales Taxes', value: detail.taxes_id?.length ? detail.taxes_id.map(t => typeof t === 'object' ? t[1] : t).join(', ') : '7% Output VAT' },
                                                    { label: 'Purchase Taxes', value: detail.supplier_taxes_id?.length ? detail.supplier_taxes_id.map(t => typeof t === 'object' ? t[1] : t).join(', ') : '7% Input VAT' },
                                                    { label: 'Weight', value: detail.weight ? `${detail.weight} kg` : '---' },
                                                    { label: 'Volume', value: detail.volume ? `${detail.volume} m3` : '---' },
                                                    { label: 'Reorder Point', value: (pm.reorderPoint || 10).toLocaleString() },
                                                    { label: 'Product ID', value: pm.productId || detail.id || '---' },
                                                ].map((f, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0 pt-0.5" style={{ color: 'var(--odoo-text-muted)', minWidth: '120px' }}>{f.label}</span>
                                                        <span className="text-xs font-medium" style={{ color: 'var(--odoo-text)' }}>{f.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {pm.lots?.length > 0 && (
                                            <div className="mt-5">
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--odoo-text-muted)' }}>Lot / Serial Numbers</p>
                                                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
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
                                                                    <tr key={li} style={{ borderBottom: li < pm.lots.length - 1 ? '1px solid var(--odoo-border-ghost)' : 'none' }}>
                                                                        <td className="px-3 py-2"><span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(113,75,103,0.08)', color: 'var(--odoo-purple)' }}>{lot.lotNumber}</span></td>
                                                                        <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{(lot.qty || 0).toLocaleString()}</td>
                                                                        <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--odoo-text-muted)' }}>{lot.receivedDate ? formatDate(lot.receivedDate) : '---'}</td>
                                                                        <td className="px-3 py-2 text-right font-mono" style={{ color: expiring ? 'var(--odoo-warning)' : 'var(--odoo-text-muted)', fontWeight: expiring ? 600 : 400 }}>{lot.expiryDate ? formatDate(lot.expiryDate) : '---'}{expiring && <AlertTriangle className="w-3 h-3 inline ml-1" />}</td>
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
                                        {productDetailData.purchaseLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-purple)' }} /></div>}
                                        {!productDetailData.purchaseLoading && productDetailData.purchase && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--odoo-text-muted)' }}>Vendors / Suppliers</p>
                                                {productDetailData.purchase.length === 0
                                                    ? <p className="text-sm" style={{ color: 'var(--odoo-text-muted)' }}>No supplier info found</p>
                                                    : <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
                                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                            <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                {['Vendor', 'Price', 'Min Qty', 'Lead Time'].map(h => (
                                                                    <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                                ))}
                                                            </tr></thead>
                                                            <tbody>
                                                                {productDetailData.purchase.map((v, i) => (
                                                                    <tr key={i} style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--odoo-text)' }}>{v.partner_id?.[1] || '---'}</td>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-success)' }}>{(v.price || 0).toLocaleString()}</td>
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
                                        {productDetailData.saleLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-purple)' }} /></div>}
                                        {!productDetailData.saleLoading && productDetailData.sale && (
                                            <div>
                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    {(() => {
                                                        const sales = productDetailData.sale;
                                                        const totalQty = sales.reduce((s, o) => s + (o.product_uom_qty || 0), 0);
                                                        const totalRev = sales.reduce((s, o) => s + (o.price_subtotal || 0), 0);
                                                        return [
                                                            { label: 'Total Orders', value: sales.length, color: 'var(--odoo-purple)' },
                                                            { label: 'Total Qty Sold', value: totalQty.toLocaleString(), color: 'var(--odoo-success)' },
                                                            { label: 'Total Revenue', value: totalRev.toLocaleString(), color: 'var(--odoo-success)' },
                                                        ].map((k, i) => (
                                                            <div key={i} className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)' }}>
                                                                <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                                <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>{k.label}</p>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--odoo-text-muted)' }}>Recent Sales</p>
                                                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                            {['Order', 'Date', 'Qty', 'Unit Price', 'Subtotal'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Order' || h === 'Date' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {productDetailData.sale.map((s, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-purple)' }}>{s.order_id?.[1] || '---'}</td>
                                                                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>{s.create_date ? new Date(s.create_date).toLocaleDateString() : '---'}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{s.product_uom_qty || 0}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums">{(s.price_unit || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--odoo-success)' }}>{(s.price_subtotal || 0).toLocaleString()}</td>
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
                                        {productDetailData.inventoryLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-purple)' }} /></div>}
                                        {!productDetailData.inventoryLoading && productDetailData.inventory && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--odoo-text-muted)' }}>Stock by Location (All Warehouses)</p>
                                                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
                                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                        <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                            {['Location', 'Lot', 'On Hand', 'Reserved', 'Available'].map(h => (
                                                                <th key={h} className={`px-3 py-2 ${h === 'Location' || h === 'Lot' ? 'text-left' : 'text-right'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                            ))}
                                                        </tr></thead>
                                                        <tbody>
                                                            {productDetailData.inventory.map((q, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}><MapPin className="w-2.5 h-2.5" />{q.location_id?.[1] || '---'}</span></td>
                                                                    <td className="px-3 py-2">{q.lot_id ? <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(113,75,103,0.08)', color: 'var(--odoo-purple)' }}>{q.lot_id[1]}</span> : <span style={{ color: 'var(--odoo-text-muted)' }}>---</span>}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{(q.quantity || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: q.reserved_quantity > 0 ? 'var(--odoo-warning)' : 'var(--odoo-text-muted)' }}>{(q.reserved_quantity || 0).toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-success)' }}>{((q.quantity || 0) - (q.reserved_quantity || 0)).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                                                <td colSpan={2} className="px-3 py-2 font-semibold" style={{ color: 'var(--odoo-text-secondary)' }}>Total</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{productDetailData.inventory.reduce((s, q) => s + (q.quantity || 0), 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: 'var(--odoo-warning)' }}>{productDetailData.inventory.reduce((s, q) => s + (q.reserved_quantity || 0), 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: 'var(--odoo-success)' }}>{productDetailData.inventory.reduce((s, q) => s + (q.quantity || 0) - (q.reserved_quantity || 0), 0).toLocaleString()}</td>
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
                                        {productDetailData.forecastLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-purple)' }} /></div>}
                                        {!productDetailData.forecastLoading && productDetailData.forecast && (
                                            <div>
                                                <div className="grid grid-cols-4 gap-3 mb-4">
                                                    {[
                                                        { label: 'On Hand', value: (productDetailData.forecast.qty_available || 0).toLocaleString(), color: 'var(--odoo-text)', bg: 'var(--odoo-surface-low)' },
                                                        { label: 'Incoming', value: `+${(productDetailData.forecast.incoming_qty || 0).toLocaleString()}`, color: 'var(--odoo-success)', bg: 'rgba(40,167,69,0.06)' },
                                                        { label: 'Outgoing', value: `-${(productDetailData.forecast.outgoing_qty || 0).toLocaleString()}`, color: 'var(--odoo-danger)', bg: 'rgba(220,53,69,0.06)' },
                                                        { label: 'Forecasted', value: (productDetailData.forecast.virtual_available || 0).toLocaleString(), color: 'var(--odoo-success)', bg: 'rgba(0,105,110,0.06)' },
                                                    ].map((k, i) => (
                                                        <div key={i} className="rounded-lg p-3 text-center" style={{ backgroundColor: k.bg, border: '1px solid var(--odoo-border-ghost)' }}>
                                                            <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                                                            <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>{k.label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--odoo-text-muted)' }}>Upcoming Moves</p>
                                                {productDetailData.forecast.upcoming_moves?.length > 0 ? (
                                                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--odoo-border-ghost)' }}>
                                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                                            <thead><tr style={{ backgroundColor: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                {['Date', 'Direction', 'Reference', 'Qty', 'Status'].map(h => (
                                                                    <th key={h} className={`px-3 py-2 ${h === 'Qty' ? 'text-right' : 'text-left'} font-semibold`} style={{ color: 'var(--odoo-text-secondary)' }}>{h}</th>
                                                                ))}
                                                            </tr></thead>
                                                            <tbody>
                                                                {productDetailData.forecast.upcoming_moves.map((m, i) => (
                                                                    <tr key={i} style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>{m.date ? new Date(m.date).toLocaleDateString() : '---'}</td>
                                                                        <td className="px-3 py-2">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                                                                                style={{ backgroundColor: m.direction === 'in' ? 'rgba(40,167,69,0.08)' : 'rgba(220,53,69,0.08)', color: m.direction === 'in' ? 'var(--odoo-success)' : 'var(--odoo-danger)' }}>
                                                                                {m.direction === 'in' ? <PackageCheck className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                                                                {m.direction === 'in' ? 'Incoming' : 'Outgoing'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--odoo-purple)' }}>{m.origin || '---'}</td>
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
                                    className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                                    style={{ color: 'var(--odoo-purple)' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                    <History className="w-3.5 h-3.5" /> Stock History
                                </button>
                                <button onClick={() => { setProductModal(null); openTransfer(pm); }}
                                    className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                                    style={{ color: 'var(--odoo-purple)' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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
                        style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                <span style={{ color: 'var(--odoo-text-muted)' }}>Inventory</span>
                                <ChevronRight className="w-3 h-3" style={{ color: 'var(--odoo-text-muted)' }} />
                                <span className="font-semibold" style={{ color: 'var(--odoo-text)' }}>{historyModal.item.shortName || historyModal.item.name}</span>
                                <ChevronRight className="w-3 h-3" style={{ color: 'var(--odoo-text-muted)' }} />
                                <span style={{ color: 'var(--odoo-purple)' }}>Stock History</span>
                            </div>
                            <button onClick={() => setHistoryModal(null)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                {PRODUCT_CATALOG[historyModal.item.sku]?.image ? <img src={PRODUCT_CATALOG[historyModal.item.sku].image} alt="" className="w-full h-full object-cover" />
                                    : <Package className="w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />}
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>{historyModal.item.name}</p>
                                <p className="text-[10px] font-mono" style={{ color: 'var(--odoo-text-muted)' }}>{historyModal.item.sku} · On-hand: <span className="font-semibold" style={{ color: 'var(--odoo-success)' }}>{(historyModal.item.onHand || 0).toLocaleString()}</span></p>
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {historyModal.loading && <div className="flex items-center justify-center py-16" style={{ color: 'var(--odoo-text-muted)' }}><RefreshCw className="w-5 h-5 animate-spin mr-2" style={{ color: 'var(--odoo-purple)' }} /><span className="text-sm">Fetching from Odoo...</span></div>}
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
                                            const tc = { delivery: { label: 'Delivery', icon: <Truck className="w-3 h-3" />, color: 'var(--odoo-danger)', bg: 'rgba(220,53,69,0.08)' },
                                                receipt: { label: 'Receipt', icon: <PackageCheck className="w-3 h-3" />, color: 'var(--odoo-success)', bg: 'rgba(40,167,69,0.08)' },
                                                adjustment: { label: 'Adjustment', icon: <Check className="w-3 h-3" />, color: 'var(--odoo-text-secondary)', bg: 'var(--odoo-surface-low)' } }[mv.type] || { label: mv.type, icon: null, color: 'var(--odoo-text-secondary)', bg: 'transparent' };
                                            return (
                                                <tr key={i} className="transition-colors"
                                                    style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>{mv.date}</td>
                                                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.icon} {tc.label}</span></td>
                                                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--odoo-purple)' }}>{mv.ref}</td>
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
                        style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <ArrowRightLeft className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Internal Transfer
                            </h3>
                            <button onClick={() => setTransferModal(null)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Source Location</label>
                                <select value={transferSrc} onChange={e => setTransferSrc(e.target.value)}
                                    className="w-full px-3 py-2 text-sm outline-none rounded"
                                    style={{ border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)', backgroundColor: 'var(--odoo-surface)' }}>
                                    <option value="">Select source...</option>
                                    {allOdooLocations.map(l => <option key={l.id} value={l.id}>{l.complete_name}</option>)}
                                    {allOdooLocations.length === 0 && <option value="" disabled>Connect Odoo to load locations</option>}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Destination Location</label>
                                <select value={transferDest} onChange={e => setTransferDest(e.target.value)}
                                    className="w-full px-3 py-2 text-sm outline-none rounded"
                                    style={{ border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)', backgroundColor: 'var(--odoo-surface)' }}>
                                    <option value="">Select destination...</option>
                                    {allOdooLocations.map(l => <option key={l.id} value={l.id}>{l.complete_name}</option>)}
                                    {allOdooLocations.length === 0 && <option value="" disabled>Connect Odoo to load locations</option>}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--odoo-text-secondary)' }}>Products</label>
                                {transferLines.map((line, i) => (
                                    <div key={i} className="flex items-center gap-2 mb-2">
                                        <span className="flex-1 text-xs font-mono px-2 py-1.5 rounded truncate" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }}>
                                            {line.sku || line.name || 'Product'}
                                        </span>
                                        <input type="number" value={line.qty} onChange={e => {
                                            const lines = [...transferLines]; lines[i].qty = Math.max(1, parseInt(e.target.value) || 1); setTransferLines(lines);
                                        }} className="w-20 text-center text-sm py-1.5 outline-none rounded" style={{ border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }} />
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
                                style={{ backgroundColor: 'var(--odoo-purple)', color: '#fff', border: 'none', opacity: transferLoading ? 0.7 : 1 }}>
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
                        style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <Shield className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Min/Max Reorder Rules
                            </h3>
                            <button onClick={() => setShowReorderPanel(false)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-high)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {reorderLoading && <div className="text-center py-8"><RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--odoo-purple)' }} /></div>}
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
                                            <tr key={i} className="transition-colors"
                                                style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--odoo-text)' }}>{r.product_id?.[1] || r.sku || '---'}</td>
                                                <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>{r.location_id?.[1] || 'PICKFACE'}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-danger)' }}>{r.product_min_qty || 0}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: 'var(--odoo-success)' }}>{r.product_max_qty || 0}</td>
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
