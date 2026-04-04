import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, RefreshCw, ClipboardList, ChevronRight, ChevronLeft, CheckSquare, Box, Printer, X, ScanLine, Search, MapPin, List, LayoutGrid, Columns, ArrowUpDown, AlertTriangle, Route, Zap, ChevronDown, ChevronUp, Package, Hash, Users, TrendingUp, Filter } from 'lucide-react';
import { PRODUCT_CATALOG, PLATFORM_LABELS } from '../constants';
import { PlatformBadge } from './PlatformLogo';

// Odoo 18 avatar color palette (12 colors, same as kissgroupdatacenter.com)
const ODOO_AVATAR_COLORS = [
    { bg: '#a2a2a2', text: '#fff' }, // gray
    { bg: '#ee2d2d', text: '#fff' }, // red
    { bg: '#dc8534', text: '#fff' }, // orange
    { bg: '#e8bb1d', text: '#212529' }, // yellow
    { bg: '#5794dd', text: '#fff' }, // blue
    { bg: '#9f628f', text: '#fff' }, // purple
    { bg: '#db8865', text: '#fff' }, // salmon
    { bg: '#41a9a2', text: '#fff' }, // teal
    { bg: '#304be0', text: '#fff' }, // indigo
    { bg: '#ee2f8a', text: '#fff' }, // pink
    { bg: '#61c36e', text: '#fff' }, // green
    { bg: '#9872e6', text: '#fff' }, // violet
];
const getAvatarColor = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    return ODOO_AVATAR_COLORS[Math.abs(hash) % ODOO_AVATAR_COLORS.length];
};

const statusBadgeClass = (status) => ({
    pending: 'odoo-badge odoo-badge-pending',
    picking: 'odoo-badge odoo-badge-picking',
    picked:  'odoo-badge odoo-badge-picked',
    packing: 'odoo-badge odoo-badge-packing',
    packed:  'odoo-badge odoo-badge-packed',
    rts:     'odoo-badge odoo-badge-rts',
    cancelled: 'odoo-badge odoo-badge-cancelled',
}[status] || 'odoo-badge odoo-badge-pending');

const statusLabel = (status) => ({
    pending: 'Pending', picking: 'In Progress', picked: 'Picked',
    packing: 'Packing', packed: 'Packed', rts: 'Ready to Ship', cancelled: 'Cancelled',
}[status] || status);

const ITEMS_PER_PAGE = 50;

const Pick = ({ salesOrders, selectedPickOrder, setSelectedPickOrder, syncPlatformOrders, isProcessingImport, handlePickScanSubmit, pickScanInput, setPickScanInput, pickInputRef, inventory, clearDummyOrders, isSyncingOrders, onSyncOrders, onCreateSOInOdoo, isCreatingSO, stockFrozen }) => {
    const getLocation = (sku, itemLoc) => itemLoc || inventory?.find(i => i.sku === sku)?.location || PRODUCT_CATALOG[sku]?.location || null;
    const [showPickingList, setShowPickingList] = useState(null);
    const [scanFlash, setScanFlash] = useState(null);
    const [debugScan, setDebugScan] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const [waveSorted, setWaveSorted] = useState(false);
    const listScanRef = useRef(null);
    const pendingOrdersRef = useRef([]);

    // New state for Stitch design
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedOrders, setSelectedOrders] = useState(new Set());
    const [statusFilter, setStatusFilter] = useState('all');
    const [platformFilter, setPlatformFilter] = useState(null);
    const [stockFilter, setStockFilter] = useState(null); // null | 'hasStock' | 'stockOut'

    const pendingOrders = salesOrders.filter(o => o.status === 'pending' || o.status === 'picking' || o.status === 'picked');

    // Check stock availability for an order
    const invItems = Array.isArray(inventory) ? inventory : (inventory?.items || []);
    const getOrderStockStatus = (order) => {
        if (!invItems.length || !order?.items) return { ok: true, outOfStock: [] };
        const outOfStock = order.items.filter(item => {
            const stockItem = invItems.find(inv => (inv.sku || inv.default_code) === item.sku);
            const onHand = stockItem?.onHand ?? stockItem?.quantity ?? 0;
            return onHand <= 0;
        });
        return { ok: outOfStock.length === 0, outOfStock };
    };

    // Keep pendingOrdersRef always fresh
    useEffect(() => { pendingOrdersRef.current = pendingOrders; }, [pendingOrders]);

    // Focus scan input when showing list
    const focusScanInput = (ref) => {
        if (!ref?.current) return;
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
            ref.current.setAttribute('readonly', 'readonly');
            ref.current.focus();
            setTimeout(() => ref.current?.removeAttribute('readonly'), 200);
        } else {
            ref.current.focus();
        }
    };

    useEffect(() => {
        if (!selectedPickOrder) {
            setTimeout(() => focusScanInput(listScanRef), 100);
        } else {
            setTimeout(() => focusScanInput(pickInputRef), 100);
        }
    }, [selectedPickOrder]);

    // Reset page when filters change
    useEffect(() => { setCurrentPage(1); }, [statusFilter, platformFilter, stockFilter]);

    const handleListScan = useCallback((e) => {
        if (e.key !== 'Enter') return;
        const raw = listScanRef.current?.value || '';
        const val = raw.replace(/[^\x20-\x7E\u0E00-\u0E7F]/g, '').trim().toUpperCase();
        if (listScanRef.current) listScanRef.current.value = '';
        if (!val) return;

        const orders = pendingOrdersRef.current;

        let found = orders.find(o =>
            o.ref?.toUpperCase() === val ||
            o.shopeeOrderNo?.toUpperCase() === val ||
            o.awb?.toUpperCase() === val ||
            o.items?.some(i => (i.barcode && i.barcode.toUpperCase() === val) || (i.sku && i.sku.toUpperCase() === val))
        );

        if (!found) {
            found = orders.find(o =>
                o.ref?.toUpperCase().endsWith(val) ||
                o.ref?.toUpperCase().includes(val)
            );
        }

        if (found) {
            setDebugScan(null);
            setScanFlash(found.id);
            setTimeout(() => {
                setScanFlash(null);
                setSelectedPickOrder(found);
            }, 350);
        } else {
            setDebugScan({ val, firstRef: orders[0]?.ref || '-', count: orders.length });
            setScanFlash('notfound');
            setTimeout(() => setScanFlash(null), 5000);
        }
    }, [setSelectedPickOrder]);

    const generatePickingList = (order) => setShowPickingList(order);
    const generateBatchPickingList = () => {
        const orders = waveSorted ? waveSort(pendingOrders) : pendingOrders;
        setShowPickingList({ batch: true, orders, waveSorted });
    };

    // Wave Sort
    const waveSort = (orders) => {
        const withKey = orders.map(o => {
            const skus = (o.items || []).map(i => i.sku).sort();
            const primarySku = skus[0] || '';
            const totalQty = (o.items || []).reduce((s, i) => s + (i.expected || 0), 0);
            return { order: o, primarySku, skus, totalQty };
        });
        withKey.sort((a, b) => {
            if (a.primarySku !== b.primarySku) return a.primarySku.localeCompare(b.primarySku);
            return a.totalQty - b.totalQty;
        });
        return withKey.map(w => w.order);
    };

    const computeSkuSummary = (orders) => {
        const map = {};
        orders.forEach(o => {
            (o.items || []).forEach(i => {
                if (!map[i.sku]) map[i.sku] = { sku: i.sku, name: PRODUCT_CATALOG[i.sku]?.shortName || i.name, qty: 0, orderCount: 0 };
                map[i.sku].qty += (i.expected || 0);
                map[i.sku].orderCount += 1;
            });
        });
        return Object.values(map).sort((a, b) => a.sku.localeCompare(b.sku));
    };

    // ── Pick Path Optimizer ──
    const parseLocation = (loc) => {
        if (!loc) return { zone: 'ZZZ', aisle: 999, shelf: 999 };
        const parts = loc.split('-');
        if (parts.length >= 3) return { zone: parts[0], aisle: parseInt(parts[1]) || 0, shelf: parseInt(parts[2]) || 0 };
        if (parts.length === 2) return { zone: parts[0], aisle: parseInt(parts[1]) || 0, shelf: 0 };
        return { zone: loc, aisle: 0, shelf: 0 };
    };

    const sortByPickPath = (items) => {
        return [...items].sort((a, b) => {
            const la = parseLocation(getLocation(a.sku, a.location));
            const lb = parseLocation(getLocation(b.sku, b.location));
            if (la.zone !== lb.zone) return la.zone.localeCompare(lb.zone);
            if (la.aisle !== lb.aisle) return la.aisle - lb.aisle;
            return la.aisle % 2 === 1 ? la.shelf - lb.shelf : lb.shelf - la.shelf;
        });
    };

    // ── Auto Wave Planner ──
    const WAVE_SIZE = 15;

    // Get zones touched by an order
    const getOrderZones = (order) => {
        const zones = new Set();
        (order.items || []).forEach(i => {
            const loc = getLocation(i.sku, i.location);
            const parsed = parseLocation(loc);
            if (parsed.zone !== 'ZZZ') zones.add(parsed.zone);
            // Also track zone+aisle for finer proximity
            if (parsed.zone !== 'ZZZ') zones.add(`${parsed.zone}-${String(parsed.aisle).padStart(2, '0')}`);
        });
        return zones;
    };

    const autoWavePlan = (orders) => {
        if (orders.length === 0) return [];
        // Build SKU set + zone set per order
        const remaining = orders.map((o, idx) => ({
            order: o, idx,
            skus: new Set((o.items || []).map(i => i.sku)),
            zones: getOrderZones(o),
            urgent: o.courierCutoff ? new Date(o.courierCutoff).getTime() : Infinity,
        }));
        remaining.sort((a, b) => a.urgent - b.urgent);

        const waves = [];
        const used = new Set();

        while (used.size < orders.length) {
            const wave = [];
            const waveSkus = new Set();
            const waveZones = new Set();

            const seed = remaining.find(r => !used.has(r.idx));
            if (!seed) break;
            wave.push(seed.order);
            used.add(seed.idx);
            seed.skus.forEach(s => waveSkus.add(s));
            seed.zones.forEach(z => waveZones.add(z));

            // Greedily add orders with highest combined score (SKU overlap + zone proximity)
            while (wave.length < WAVE_SIZE) {
                let bestIdx = -1, bestScore = -1;
                for (const r of remaining) {
                    if (used.has(r.idx)) continue;
                    // SKU overlap score (weight: 2 per match)
                    let skuScore = 0;
                    for (const s of r.skus) { if (waveSkus.has(s)) skuScore++; }
                    // Zone proximity score (weight: 1 per zone/aisle match)
                    let zoneScore = 0;
                    for (const z of r.zones) { if (waveZones.has(z)) zoneScore++; }
                    const totalScore = skuScore * 2 + zoneScore;
                    if (totalScore > bestScore) { bestScore = totalScore; bestIdx = r.idx; }
                }
                if (bestIdx === -1 || bestScore === 0) break; // no overlapping orders
                const picked = remaining.find(r => r.idx === bestIdx);
                wave.push(picked.order);
                used.add(picked.idx);
                picked.skus.forEach(s => waveSkus.add(s));
                picked.zones.forEach(z => waveZones.add(z));
            }

            while (wave.length < WAVE_SIZE && used.size < orders.length) {
                const next = remaining.find(r => !used.has(r.idx));
                if (!next) break;
                wave.push(next.order);
                used.add(next.idx);
            }

            waves.push(wave);
        }
        return waves;
    };

    const [showWavePlan, setShowWavePlan] = useState(false);
    const [wavePlan, setWavePlan] = useState(null);
    const [expandedWave, setExpandedWave] = useState(0);
    // Pick mode: 'off' → 'path' → 'wave' (cycle)
    const [pickMode, setPickMode] = useState('path');
    const pickPathEnabled = pickMode === 'path' || pickMode === 'wave';

    const cyclePickMode = () => {
        if (pickMode === 'off') {
            setPickMode('path');
        } else if (pickMode === 'path') {
            // Switch to wave: also open the wave plan
            setPickMode('wave');
            const waves = autoWavePlan(pendingOrders);
            setWavePlan(waves);
            setShowWavePlan(true);
            setExpandedWave(0);
        } else {
            setPickMode('off');
            setShowWavePlan(false);
        }
    };

    const handleAutoWave = () => {
        const waves = autoWavePlan(pendingOrders);
        setWavePlan(waves);
        setShowWavePlan(true);
        setExpandedWave(0);
        setPickMode('wave');
    };

    const printWave = (waveOrders, waveIdx) => {
        const sorted = waveOrders.map(o => ({
            ...o,
            items: pickPathEnabled ? sortByPickPath(o.items) : o.items,
        }));
        setShowPickingList({ batch: true, orders: sorted, waveSorted: true, waveLabel: `Wave ${waveIdx + 1}` });
    };

    const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // BiM-style print
    const handlePrint = () => {
        const orders = showPickingList.batch ? showPickingList.orders : [showPickingList];
        const isWave = showPickingList.waveSorted && showPickingList.batch;
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
        const total = orders.length;

        let summaryPage = '';
        if (isWave) {
            const summary = computeSkuSummary(orders);
            const grandTotal = summary.reduce((s, r) => s + r.qty, 0);
            summaryPage = `
<div class="page">
  <div class="page-header">
    <div class="page-title">[Wave Pick Summary] KissMyBody</div>
    <div class="page-sub">${dateStr} &nbsp;|&nbsp; ${total} orders &nbsp;|&nbsp; ${grandTotal} total pieces</div>
  </div>
  <table>
    <thead><tr>
      <th>#</th>
      <th>SKU</th>
      <th>Product</th>
      <th style="text-align:center">Orders</th>
      <th style="text-align:center">Total Qty</th>
    </tr></thead>
    <tbody>
      ${summary.map((r, i) => `
      <tr>
        <td class="num">${i+1}</td>
        <td style="font-family:monospace;font-size:10px;font-weight:600">${esc(r.sku)}</td>
        <td><div class="item-name">${esc(r.name)}</div></td>
        <td style="text-align:center;font-size:12px">${r.orderCount}</td>
        <td class="qty">${r.qty}</td>
      </tr>`).join('')}
      <tr style="border-top:2px solid #222;font-weight:bold">
        <td></td>
        <td colspan="2" style="padding:6px 2px;font-size:11px">GRAND TOTAL</td>
        <td style="text-align:center;font-size:12px">${total}</td>
        <td class="qty" style="font-size:16px">${grandTotal}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">WMS Pro · Wave Pick Summary · ${dateStr}</div>
</div>`;
        }

        const pages = orders.map((order, idx) => {
            const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
            const platformName = pl?.name || order.platform || 'WMS';
            const storeName = 'KissMyBody';
            const orderTotal = order.items.reduce((s, i) => s + (i.expected || 0), 0);
            const pathLabel = pickPathEnabled ? ' · Route' : '';
            const waveLabel = showPickingList.waveLabel ? ` · ${esc(showPickingList.waveLabel)}` : '';
            const sortedItems = pickPathEnabled ? sortByPickPath(order.items) : order.items;
            return `
<div class="page">
  <div class="page-header">
    <div class="page-title">[Pick] ${esc(platformName)} · ${esc(storeName)}${waveLabel}${pathLabel}</div>
    <div class="page-sub">${idx+1}/${total} &nbsp;|&nbsp; ${dateStr} &nbsp;|&nbsp; <strong>${esc(order.ref)}</strong>${order.customer ? ' · ' + esc(order.customer) : ''} &nbsp;|&nbsp; <strong>${orderTotal} pcs</strong></div>
  </div>
  <div class="bc-wrap"><svg id="bc-${idx}"></svg><div class="bc-label">${order.ref}</div></div>
  <table>
    <thead><tr>
      <th>#</th>
      <th>Product</th>
      <th style="text-align:center">Loc</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:center">\u2713</th>
    </tr></thead>
    <tbody>
      ${sortedItems.map((item, i) => {
          const loc = getLocation(item.sku, item.location);
          return `
      <tr>
        <td class="num">${i+1}</td>
        <td><div class="item-name">${esc(PRODUCT_CATALOG[item.sku]?.shortName || item.name)}</div><div class="item-sku">${esc(item.sku)}</div></td>
        <td class="${loc ? 'loc' : 'loc-miss'}">${loc || '-'}</td>
        <td class="qty">${item.expected}</td>
        <td class="check"></td>
      </tr>`;
      }).join('')}
      <tr style="border-top:1.5px solid #222">
        <td></td>
        <td colspan="2" style="font-weight:bold;font-size:10px;padding:4px 2px">Total</td>
        <td class="qty" style="font-size:13px;border-top:1.5px solid #222">${orderTotal}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">WMS Pro · ${dateStr}</div>
</div>`;
        }).join('');

        const barcodeInits = orders.map((order, idx) =>
            `JsBarcode("#bc-${idx}",${JSON.stringify(order.ref || '')},{format:"CODE128",width:1.8,height:40,displayValue:false,margin:1});`
        ).join('\n    ');

        const win = window.open('', '_blank', 'width=400,height=600');
        if (!win) return;
        win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${isWave ? 'Wave Picking List' : 'Picking List'}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  @page{size:100mm 150mm;margin:3mm}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:monospace;font-size:11px;background:#fff;width:94mm}
  .page{padding:2mm;page-break-after:always}
  .page-header{margin-bottom:6px;padding-bottom:5px;border-bottom:2px solid #222}
  .page-title{font-size:10px;font-weight:bold}
  .page-sub{font-size:8px;color:#666;margin:1px 0}
  .page-order{font-size:9px;color:#333;margin-top:2px}
  .bc-wrap{text-align:center;margin:4px 0}
  .bc-label{font-size:9px;font-weight:bold;text-align:center;letter-spacing:1px;font-family:monospace}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:6px}
  th{text-align:left;padding:3px 2px;border-bottom:1.5px solid #222;font-size:9px;background:#f8f8f8}
  td{padding:4px 2px;border-bottom:1px solid #e8e8e8;vertical-align:middle}
  .num{color:#aaa;font-size:9px;width:16px}
  .item-name{font-weight:600;font-size:10px}
  .item-sku{font-size:8px;color:#999;margin-top:1px;letter-spacing:1px}
  .loc{text-align:center;font-weight:bold;color:#d97706;font-size:11px;width:60px}
  .loc-miss{text-align:center;color:#ccc;font-size:9px;width:60px}
  .qty{text-align:center;font-weight:bold;font-size:14px;width:28px}
  .check{text-align:center;border:1px solid #ccc;width:22px;height:22px}
  .footer{font-size:7px;color:#bbb;text-align:center;border-top:1px solid #e0e0e0;padding-top:4px;margin-top:4px}
</style></head><body>
${summaryPage}${pages}
<script>
window.onload=function(){
  try{
    ${barcodeInits}
  }catch(e){console.error(e)}
  setTimeout(function(){window.print();window.close();},400);
};
<\/script>
</body></html>`);
        win.document.close();
        win.focus();
    };

    // ── Computed KPIs ──
    const totalItems = useMemo(() => pendingOrders.reduce((s, o) => s + (o.items?.reduce((a, i) => a + (i.expected || 0), 0) || 0), 0), [pendingOrders]);
    const uniqueSkus = useMemo(() => new Set(pendingOrders.flatMap(o => (o.items || []).map(i => i.sku))).size, [pendingOrders]);
    const stockOutCount = useMemo(() => pendingOrders.filter(o => !getOrderStockStatus(o).ok).length, [pendingOrders, invItems]);
    const platformCounts = useMemo(() => {
        const acc = {};
        pendingOrders.forEach(o => {
            const p = o.platform || o.courier || 'Other';
            acc[p] = (acc[p] || 0) + 1;
        });
        return Object.entries(acc).sort((a, b) => b[1] - a[1]);
    }, [pendingOrders]);
    const topPlatform = platformCounts[0] || ['--', 0];
    const avgItemsPerOrder = pendingOrders.length > 0 ? (totalItems / pendingOrders.length).toFixed(1) : '0';

    // ── Filtered + sorted orders ──
    const filteredOrders = useMemo(() => {
        let list = [...pendingOrders];
        // Status filter
        if (statusFilter !== 'all') {
            list = list.filter(o => o.status === statusFilter);
        }
        // Platform filter
        if (platformFilter) {
            list = list.filter(o => (o.platform || o.courier) === platformFilter);
        }
        // Stock filter
        if (stockFilter === 'hasStock') {
            list = list.filter(o => getOrderStockStatus(o).ok);
        } else if (stockFilter === 'stockOut') {
            list = list.filter(o => !getOrderStockStatus(o).ok);
        }
        // Sort
        if (waveSorted) {
            list = waveSort(list);
        } else {
            list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        }
        return list;
    }, [pendingOrders, statusFilter, platformFilter, stockFilter, waveSorted, invItems]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Checkbox helpers
    const toggleOrder = (id) => {
        setSelectedOrders(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleAll = () => {
        if (selectedOrders.size === paginatedOrders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(paginatedOrders.map(o => o.id)));
        }
    };

    // Unique platforms in current data for filter chips
    const availablePlatforms = useMemo(() => {
        const s = new Set();
        pendingOrders.forEach(o => { if (o.platform) s.add(o.platform); if (o.courier && o.courier !== o.platform) s.add(o.courier); });
        return [...s];
    }, [pendingOrders]);

    // Selection stats
    const selectedOrdersList = useMemo(() => pendingOrders.filter(o => selectedOrders.has(o.id)), [pendingOrders, selectedOrders]);
    const selectedWeight = useMemo(() => {
        return selectedOrdersList.reduce((s, o) => {
            return s + (o.items || []).reduce((a, i) => a + ((PRODUCT_CATALOG[i.sku]?.weight || 0.3) * (i.expected || 0)), 0);
        }, 0);
    }, [selectedOrdersList]);

    return (
        <div className="w-full animate-slide-up">
            {stockFrozen && (
                <div className="mb-4 p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--odoo-danger-light)', border: '1px solid var(--odoo-danger)', borderRadius: 'var(--odoo-radius)' }}>
                    <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--odoo-danger)' }} />
                    <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--odoo-danger)' }}>Stock Frozen</p>
                        <p className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>Picking is blocked during Full Count. Please wait until the count is completed.</p>
                    </div>
                </div>
            )}
            {!selectedPickOrder ? (
                <div className="space-y-4">

                {/* ══════════════════════════════════════════════════════════════════
                    SECTION 1 — KPI SUMMARY STRIP (6 cards)
                   ══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {/* Total Orders */}
                    <div className="p-4 rounded flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderLeft: '4px solid var(--odoo-purple)' }}>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Total Orders</div>
                            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--odoo-purple)' }}>{pendingOrders.length.toLocaleString()}</div>
                        </div>
                        <ShoppingCart className="w-5 h-5" style={{ color: 'var(--odoo-purple)', opacity: 0.25 }} />
                    </div>
                    {/* Total Items */}
                    <div className="p-4 rounded flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderLeft: '4px solid var(--odoo-text)' }}>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Total Items</div>
                            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{totalItems.toLocaleString()}</div>
                        </div>
                        <Package className="w-5 h-5" style={{ color: 'var(--odoo-text)', opacity: 0.25 }} />
                    </div>
                    {/* Unique SKUs */}
                    <div className="p-4 rounded flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderLeft: '4px solid var(--odoo-teal)' }}>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Unique SKUs</div>
                            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--odoo-teal)' }}>{uniqueSkus.toLocaleString()}</div>
                        </div>
                        <Hash className="w-5 h-5" style={{ color: 'var(--odoo-teal)', opacity: 0.25 }} />
                    </div>
                    {/* Stock Out */}
                    <div className="p-4 rounded flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderLeft: '4px solid var(--odoo-danger)' }}>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Stock Out</div>
                            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--odoo-danger)' }}>{stockOutCount}</div>
                        </div>
                        <AlertTriangle className="w-5 h-5" style={{ color: 'var(--odoo-danger)', opacity: 0.25 }} />
                    </div>
                    {/* Top Platform */}
                    <div className="p-4 rounded flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderLeft: '4px solid var(--odoo-purple-accent)' }}>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Top Platform</div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-lg font-bold uppercase" style={{ color: 'var(--odoo-text)' }}>{topPlatform[0]}</span>
                                <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--odoo-text-muted)' }}>{topPlatform[1]}</span>
                            </div>
                        </div>
                        <TrendingUp className="w-5 h-5" style={{ color: 'var(--odoo-purple-accent)', opacity: 0.25 }} />
                    </div>
                    {/* Avg Items/Order */}
                    <div className="p-4 rounded flex items-center justify-between" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderLeft: '4px solid var(--odoo-info)' }}>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Avg Items/Order</div>
                            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--odoo-info)' }}>{avgItemsPerOrder}</div>
                        </div>
                        <Filter className="w-5 h-5" style={{ color: 'var(--odoo-info)', opacity: 0.25 }} />
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════════
                    SECTION 2+3+4 — MAIN TABLE CARD (Toolbar + Filters + Table + Pagination)
                   ══════════════════════════════════════════════════════════════════ */}
                <div className="shadow-[var(--odoo-shadow-md)]" style={{ backgroundColor: 'var(--odoo-surface)', outline: '1px solid var(--odoo-border-ghost)', borderRadius: 'var(--odoo-radius)', overflow: 'hidden' }}>

                    {/* ── TOOLBAR ── */}
                    <div className="px-5 py-3 flex flex-wrap gap-3 justify-between items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                        {/* Left: Title */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                <ShoppingCart className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>Pick List</h2>
                                <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--odoo-text-secondary)' }}>{filteredOrders.length} orders waiting</p>
                            </div>
                        </div>
                        {/* Center: View switcher + action buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* View switcher */}
                            <div className="flex items-center gap-0.5 rounded p-0.5" style={{ backgroundColor: 'var(--odoo-surface-high)', border: '1px solid var(--odoo-border-ghost)' }}>
                                {[
                                    { mode: 'list', icon: <List className="w-3.5 h-3.5" />, label: 'List' },
                                    { mode: 'kanban', icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Kanban' },
                                    { mode: 'card', icon: <Columns className="w-3.5 h-3.5" />, label: 'Card' },
                                ].map(v => (
                                    <button key={v.mode} onClick={() => setViewMode(v.mode)} title={v.label}
                                        className="p-1.5 rounded transition-colors"
                                        style={{ backgroundColor: viewMode === v.mode ? 'var(--odoo-purple)' : 'transparent', color: viewMode === v.mode ? '#fff' : 'var(--odoo-text-secondary)' }}>
                                        {v.icon}
                                    </button>
                                ))}
                            </div>
                            {pendingOrders.length > 0 && (
                                <>
                                <button onClick={cyclePickMode}
                                    className="odoo-btn flex items-center gap-1.5"
                                    style={{
                                        backgroundColor: pickMode === 'off' ? 'var(--odoo-surface)' : pickMode === 'path' ? 'var(--odoo-teal)' : 'var(--odoo-purple)',
                                        color: pickMode === 'off' ? 'var(--odoo-text-secondary)' : '#fff',
                                        border: `1px solid ${pickMode === 'off' ? 'var(--odoo-border)' : pickMode === 'path' ? 'var(--odoo-teal)' : 'var(--odoo-purple)'}`,
                                    }}
                                    title="Cycle: Off → Path (sort by walk route) → Auto Wave (group + path)">
                                    {pickMode === 'wave' ? <Zap className="w-3.5 h-3.5" /> : <Route className="w-3.5 h-3.5" />}
                                    {pickMode === 'off' ? 'Off' : pickMode === 'path' ? 'Path' : 'Wave'}
                                </button>
                                <button onClick={() => setWaveSorted(!waveSorted)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded shadow-sm uppercase transition-colors"
                                    style={{
                                        backgroundColor: waveSorted ? 'var(--odoo-purple)' : 'var(--odoo-surface)',
                                        color: waveSorted ? '#fff' : 'var(--odoo-text-secondary)',
                                        border: `1px solid ${waveSorted ? 'var(--odoo-purple)' : 'var(--odoo-border)'}`,
                                    }}
                                    title="Wave Sort: group similar SKUs together, sorted by quantity">
                                    <ArrowUpDown className="w-3.5 h-3.5" /> Sort
                                </button>
                                <button onClick={generateBatchPickingList} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded shadow-sm uppercase transition-colors odoo-btn-secondary">
                                    <Printer className="w-3.5 h-3.5" /> Print
                                </button>
                                </>
                            )}
                        </div>
                        {/* Right: Scan input */}
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-text-muted)' }} />
                            <input
                                ref={listScanRef}
                                type="text"
                                defaultValue=""
                                onKeyDown={handleListScan}
                                onFocus={e => {
                                    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
                                    if (isMobile) {
                                        e.target.setAttribute('readonly', 'readonly');
                                        setTimeout(() => e.target.removeAttribute('readonly'), 200);
                                    }
                                }}
                                onBlur={(e) => { if (!e.relatedTarget || e.relatedTarget.closest?.('[data-scan-area]')) setTimeout(() => focusScanInput(listScanRef), 300); }}
                                onPaste={e => e.preventDefault()}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val.includes(' ') || val.length > 30) {
                                        e.target.value = val.replace(/\s/g, '').slice(0, 30);
                                    }
                                }}
                                placeholder="Search or scan barcode..."
                                className="w-full pl-9 pr-10 py-2 text-sm font-mono outline-none transition-all"
                                style={{
                                    border: `1px solid ${scanFlash === 'notfound' ? 'var(--odoo-danger)' : 'var(--odoo-border)'}`,
                                    borderRadius: 'var(--odoo-radius)',
                                    backgroundColor: 'var(--odoo-surface)',
                                    color: 'var(--odoo-text)',
                                }}
                            />
                            <ScanLine className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" style={{ color: 'var(--odoo-purple)' }} />
                        </div>
                    </div>

                    {/* Scan error banner */}
                    {scanFlash === 'notfound' && debugScan && (
                        <div className="px-5 py-2 flex items-center gap-3" style={{ backgroundColor: 'var(--odoo-danger-light)', borderBottom: '1px solid var(--odoo-danger)' }}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--odoo-danger)' }} />
                            <div className="flex-1">
                                <span className="text-xs font-semibold" style={{ color: 'var(--odoo-danger)' }}>Not found</span>
                                <span className="text-[10px] font-mono ml-2" style={{ color: 'var(--odoo-text-secondary)' }}>"{debugScan.val}" ({debugScan.count} orders searched)</span>
                            </div>
                            {onSyncOrders && (
                                <button onClick={onSyncOrders} className="text-[10px] underline font-medium" style={{ color: 'var(--odoo-info)' }}>Sync again</button>
                            )}
                        </div>
                    )}

                    {/* Sync loading banner */}
                    {isSyncingOrders && (
                        <div className="px-5 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--odoo-info-light)', borderBottom: '1px solid var(--odoo-info)' }}>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--odoo-info)' }} />
                            <p className="text-xs font-medium" style={{ color: 'var(--odoo-info)' }}>Loading orders from Odoo...</p>
                        </div>
                    )}

                    {/* ── QUICK FILTER CHIPS ── */}
                    <div className="px-5 py-2.5 flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface)' }}>
                        {/* Status group label */}
                        <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--odoo-text-muted)' }}>Status</span>
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'pending', label: 'Pending' },
                            { key: 'picking', label: 'In Progress' },
                            { key: 'picked', label: 'Picked' },
                        ].map(f => (
                            <button key={f.key} onClick={() => setStatusFilter(f.key)}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors"
                                style={{
                                    backgroundColor: statusFilter === f.key ? 'var(--odoo-purple)' : 'var(--odoo-surface-high)',
                                    color: statusFilter === f.key ? '#fff' : 'var(--odoo-text-secondary)',
                                    border: `1px solid ${statusFilter === f.key ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                }}>
                                {f.label}
                            </button>
                        ))}

                        {/* Divider */}
                        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--odoo-border)' }} />

                        {/* Platform chips */}
                        {availablePlatforms.slice(0, 6).map(p => (
                            <button key={p} onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors flex items-center gap-1"
                                style={{
                                    backgroundColor: platformFilter === p ? 'var(--odoo-purple)' : 'var(--odoo-surface-high)',
                                    color: platformFilter === p ? '#fff' : 'var(--odoo-text-secondary)',
                                    border: `1px solid ${platformFilter === p ? 'var(--odoo-purple)' : 'var(--odoo-border-ghost)'}`,
                                }}>
                                <PlatformBadge name={p} size={14} />
                                {(PLATFORM_LABELS[p]?.name || p).replace(/\s+Express$/, '')}
                            </button>
                        ))}

                        {/* Divider */}
                        {availablePlatforms.length > 0 && <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--odoo-border)' }} />}

                        {/* Inventory filter label */}
                        <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: 'var(--odoo-text-muted)' }}>Inventory</span>
                        <button onClick={() => setStockFilter(stockFilter === 'hasStock' ? null : 'hasStock')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors"
                            style={{
                                backgroundColor: stockFilter === 'hasStock' ? 'var(--odoo-success)' : 'var(--odoo-surface-high)',
                                color: stockFilter === 'hasStock' ? '#fff' : 'var(--odoo-text-secondary)',
                                border: `1px solid ${stockFilter === 'hasStock' ? 'var(--odoo-success)' : 'var(--odoo-border-ghost)'}`,
                            }}>
                            Has Stock
                        </button>
                        <button onClick={() => setStockFilter(stockFilter === 'stockOut' ? null : 'stockOut')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors"
                            style={{
                                backgroundColor: stockFilter === 'stockOut' ? 'var(--odoo-danger)' : 'var(--odoo-surface-high)',
                                color: stockFilter === 'stockOut' ? '#fff' : 'var(--odoo-text-secondary)',
                                border: `1px solid ${stockFilter === 'stockOut' ? 'var(--odoo-danger)' : 'var(--odoo-border-ghost)'}`,
                            }}>
                            Stock Out
                        </button>
                    </div>

                    {/* ── TABLE / VIEW CONTENT ── */}
                    <div>
                        {filteredOrders.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                <ClipboardList className="w-12 h-12 mb-4 opacity-40" />
                                <p className="text-sm font-medium">No active picking tasks</p>
                                <p className="text-[11px] uppercase tracking-tight mt-1" style={{ color: 'var(--odoo-text-muted)' }}>
                                    {statusFilter !== 'all' || platformFilter || stockFilter ? 'Try changing your filters' : 'Orders will appear here when available'}
                                </p>
                            </div>
                        ) : (
                            <>
                            {/* ── LIST VIEW (table) ── */}
                            {viewMode === 'list' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left" style={{ minWidth: '900px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                                <th className="px-4 py-3 w-10">
                                                    <input type="checkbox" checked={selectedOrders.size > 0 && selectedOrders.size === paginatedOrders.length} onChange={toggleAll}
                                                        className="w-4 h-4 rounded cursor-pointer accent-[var(--odoo-purple)]" />
                                                </th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)' }}>Order Ref</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)' }}>SO Ref</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)' }}>Platform</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Customer</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)' }}>Items/SKUs</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)' }}>Status</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)' }}>Stock Alert</th>
                                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-right whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedOrders.map((order, idx) => {
                                                const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                                const isFlash = scanFlash === order.id;
                                                const isSelected = selectedOrders.has(order.id);
                                                const stockStatus = getOrderStockStatus(order);
                                                const itemCount = order.items.reduce((s, i) => s + (i.expected || 0), 0);
                                                const skuCount = order.items.length;
                                                return (
                                                    <tr key={order.id}
                                                        className="transition-colors cursor-pointer group"
                                                        style={{
                                                            borderBottom: '1px solid var(--odoo-border-ghost)',
                                                            backgroundColor: isFlash ? '#f9f5f8' : isSelected ? 'var(--odoo-purple-light)' : idx % 2 === 1 ? 'var(--odoo-surface-low)' : 'var(--odoo-surface)',
                                                        }}
                                                        onMouseEnter={e => { if (!isFlash && !isSelected) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                        onMouseLeave={e => { if (!isFlash && !isSelected) e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'var(--odoo-surface-low)' : 'var(--odoo-surface)'; }}
                                                    >
                                                        {/* Checkbox */}
                                                        <td className="px-4 py-3">
                                                            <input type="checkbox" checked={isSelected} onChange={() => toggleOrder(order.id)}
                                                                className="w-4 h-4 rounded cursor-pointer accent-[var(--odoo-purple)]"
                                                                onClick={e => e.stopPropagation()} />
                                                        </td>
                                                        {/* Order Ref */}
                                                        <td className="px-4 py-3" onClick={() => setSelectedPickOrder(order)}>
                                                            <span className="font-mono text-xs font-semibold" style={{ color: 'var(--odoo-purple)' }}>{order.ref}</span>
                                                        </td>
                                                        {/* SO Ref (Odoo origin) */}
                                                        <td className="px-4 py-3" onClick={() => setSelectedPickOrder(order)}>
                                                            <span className="font-mono text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>{order.odooOrigin || order.shopeeOrderNo || '--'}</span>
                                                        </td>
                                                        {/* Platform */}
                                                        <td className="px-4 py-3" onClick={() => setSelectedPickOrder(order)}>
                                                            {pl ? <PlatformBadge name={order.courier || order.platform} size={24} /> : (
                                                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-secondary)' }}>
                                                                    {order.platform || '--'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        {/* Customer */}
                                                        <td className="px-4 py-3" onClick={() => setSelectedPickOrder(order)}>
                                                            <span className="text-xs truncate block max-w-[180px]" style={{ color: 'var(--odoo-text)' }}>{order.customer || '--'}</span>
                                                        </td>
                                                        {/* Items / SKUs */}
                                                        <td className="px-4 py-3" onClick={() => setSelectedPickOrder(order)}>
                                                            <span className="text-xs" style={{ color: 'var(--odoo-text)' }}>
                                                                {itemCount} Item{itemCount !== 1 ? 's' : ''} / {skuCount} SKU{skuCount !== 1 ? 's' : ''}
                                                            </span>
                                                        </td>
                                                        {/* Status */}
                                                        <td className="px-4 py-3" onClick={() => setSelectedPickOrder(order)}>
                                                            <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
                                                        </td>
                                                        {/* Stock Alert */}
                                                        <td className="px-4 py-3" onClick={() => setSelectedPickOrder(order)}>
                                                            {!stockStatus.ok ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--odoo-danger)' }}>
                                                                    <AlertTriangle className="w-3.5 h-3.5" />
                                                                    {stockStatus.outOfStock.length} OOS
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>&mdash;</span>
                                                            )}
                                                        </td>
                                                        {/* Actions */}
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button onClick={(e) => { e.stopPropagation(); generatePickingList(order); }}
                                                                    className="p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                    style={{ color: 'var(--odoo-text-muted)' }}
                                                                    title="Print Picking List">
                                                                    <Printer className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => setSelectedPickOrder(order)}
                                                                    className="p-1 rounded transition-colors"
                                                                    style={{ color: 'var(--odoo-border)' }}>
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ── KANBAN VIEW (columns by status) ── */}
                            {viewMode === 'kanban' && (
                                <div className="flex gap-3 p-4 overflow-x-auto" style={{ minHeight: '300px' }}>
                                    {[
                                        { status: 'pending', label: 'Pending', color: 'var(--odoo-warning)', borderColor: 'var(--odoo-warning)', filter: o => o.status === 'pending' },
                                        { status: 'picking', label: 'In Progress', color: 'var(--odoo-info)', borderColor: 'var(--odoo-info)', filter: o => o.status === 'picking' },
                                        { status: 'picked', label: 'Picked', color: 'var(--odoo-purple)', borderColor: 'var(--odoo-purple)', filter: o => o.status === 'picked' },
                                    ].map(col => {
                                        const colOrders = filteredOrders.filter(col.filter);
                                        const kanbanStockOutCount = col.status === 'pending' ? colOrders.filter(o => !getOrderStockStatus(o).ok).length : 0;
                                        return (
                                            <div key={col.status} className="flex-1 min-w-[220px] rounded flex flex-col outline outline-1 outline-[var(--odoo-border-ghost)]" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                <div className="px-3 py-2.5 flex items-center gap-2 rounded-t" style={{ borderBottom: `3px solid ${col.borderColor}` }}>
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                                                    <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--odoo-text)' }}>{col.label}</span>
                                                    <span className="ml-auto flex items-center gap-1.5">
                                                        {kanbanStockOutCount > 0 && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: 'var(--odoo-danger-light)', color: 'var(--odoo-danger)' }}>
                                                                <AlertTriangle className="w-2.5 h-2.5" />{kanbanStockOutCount} OOS
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--odoo-border)', color: 'var(--odoo-text-secondary)' }}>{colOrders.length}</span>
                                                    </span>
                                                </div>
                                                <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '500px' }}>
                                                    {colOrders.map(order => {
                                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                                        const itemCount = (order.items || []).reduce((s, i) => s + i.expected, 0);
                                                        const stockStatus = getOrderStockStatus(order);
                                                        return (
                                                            <div key={order.id} onClick={() => setSelectedPickOrder(order)}
                                                                className="rounded p-3 cursor-pointer transition-all hover:shadow-md border-l-[3px] outline outline-1 outline-[var(--odoo-border-ghost)]"
                                                                style={{ backgroundColor: stockStatus.ok ? 'var(--odoo-surface)' : 'var(--odoo-warning-light)', borderLeftColor: stockStatus.ok ? col.borderColor : 'var(--odoo-danger)' }}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--odoo-purple)' }}>{order.ref}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        {!stockStatus.ok && (
                                                                            <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--odoo-danger-light)', color: 'var(--odoo-danger)' }}>
                                                                                <AlertTriangle className="w-2.5 h-2.5" /> {stockStatus.outOfStock.length} OOS
                                                                            </span>
                                                                        )}
                                                                        {pl && <PlatformBadge name={order.courier || order.platform} size={20} />}
                                                                    </div>
                                                                </div>
                                                                <p className="text-[11px] truncate mb-1" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer}</p>
                                                                {!stockStatus.ok && (
                                                                    <div className="mb-1">
                                                                        {stockStatus.outOfStock.slice(0, 2).map(item => (
                                                                            <p key={item.sku} className="text-[9px] font-medium" style={{ color: 'var(--odoo-danger)' }}>
                                                                                {item.sku}: insufficient stock
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-medium" style={{ color: 'var(--odoo-purple)' }}>{itemCount} items &bull; {order.items.length} SKUs</span>
                                                                    <ChevronRight className="w-3 h-3" style={{ color: 'var(--odoo-border)' }} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {colOrders.length === 0 && <div className="text-center py-10 flex flex-col items-center" style={{ color: 'var(--odoo-text-muted)' }}><ClipboardList className="w-8 h-8 mb-2 opacity-40" /><p className="text-sm font-medium">No orders</p></div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── CARD VIEW (grid) ── */}
                            {viewMode === 'card' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                                    {paginatedOrders.map(order => {
                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                        const itemCount = (order.items || []).reduce((s, i) => s + i.expected, 0);
                                        const picked = (order.items || []).reduce((s, i) => s + (i.picked || 0), 0);
                                        const progress = itemCount > 0 ? Math.round((picked / itemCount) * 100) : 0;
                                        const statusColors = { pending: 'var(--odoo-warning)', picking: 'var(--odoo-info)', picked: 'var(--odoo-purple)' };
                                        return (
                                            <div key={order.id} onClick={() => setSelectedPickOrder(order)}
                                                className="rounded cursor-pointer transition-all hover:shadow-md overflow-hidden outline outline-1 outline-[var(--odoo-border-ghost)]"
                                                style={{ backgroundColor: 'var(--odoo-surface)' }}>
                                                <div className="h-1" style={{ backgroundColor: statusColors[order.status] || 'var(--odoo-border)' }} />
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="text-sm font-bold font-mono" style={{ color: 'var(--odoo-purple)' }}>{order.ref}</h3>
                                                        <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        {pl ? <PlatformBadge name={order.courier || order.platform} size={24} /> : (() => { const av = getAvatarColor(order.customer || order.ref); return <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: av.bg, color: av.text }}>{(order.customer || '?')[0].toUpperCase()}</div>; })()}
                                                        <span className="text-xs truncate" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                            <div className="text-sm font-bold" style={{ color: 'var(--odoo-purple)' }}>{itemCount}</div>
                                                            <div className="text-[10px] uppercase font-extrabold tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Items</div>
                                                        </div>
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                            <div className="text-sm font-bold" style={{ color: 'var(--odoo-teal)' }}>{order.items.length}</div>
                                                            <div className="text-[10px] uppercase font-extrabold tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>SKUs</div>
                                                        </div>
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                            <div className="text-sm font-bold" style={{ color: progress === 100 ? 'var(--odoo-success)' : 'var(--odoo-warning)' }}>{progress}%</div>
                                                            <div className="text-[10px] uppercase font-extrabold tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Done</div>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? 'var(--odoo-success)' : 'var(--odoo-purple)' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            </>
                        )}
                    </div>

                    {/* ── PAGINATION ── */}
                    {filteredOrders.length > 0 && (
                        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <span className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredOrders.length)} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30"
                                    style={{ color: 'var(--odoo-text-secondary)', border: '1px solid var(--odoo-border-ghost)' }}>
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                                            className="w-8 h-8 rounded text-xs font-semibold transition-colors"
                                            style={{
                                                backgroundColor: currentPage === pageNum ? 'var(--odoo-purple)' : 'transparent',
                                                color: currentPage === pageNum ? '#fff' : 'var(--odoo-text-secondary)',
                                                border: currentPage === pageNum ? 'none' : '1px solid var(--odoo-border-ghost)',
                                            }}>
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30"
                                    style={{ color: 'var(--odoo-text-secondary)', border: '1px solid var(--odoo-border-ghost)' }}>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════════════════════════════
                    SECTION 5 — STICKY BOTTOM ACTION BAR (visible when orders selected)
                   ══════════════════════════════════════════════════════════════════ */}
                {selectedOrders.size > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 px-6 py-3 flex items-center justify-between shadow-lg"
                        style={{ backgroundColor: 'var(--odoo-surface)', borderTop: '2px solid var(--odoo-purple)', backdropFilter: 'blur(8px)' }}>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold" style={{ color: 'var(--odoo-purple)' }}>{selectedOrders.size} orders selected</span>
                                <button onClick={() => setSelectedOrders(new Set())} className="p-0.5 rounded-full" style={{ color: 'var(--odoo-text-muted)' }}><X className="w-3.5 h-3.5" /></button>
                            </div>
                            <span className="text-xs hidden md:inline" style={{ color: 'var(--odoo-text-secondary)' }}>
                                Selected weight: {selectedWeight.toFixed(1)}kg | Estimated volume: {(selectedOrders.size * 0.06).toFixed(2)}m&sup3;
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => {
                                const orders = pendingOrders.filter(o => selectedOrders.has(o.id));
                                if (orders.length > 0) setShowPickingList({ batch: true, orders, waveSorted: false });
                            }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors"
                                style={{ backgroundColor: 'var(--odoo-surface)', color: 'var(--odoo-text)', border: '1px solid var(--odoo-border)' }}>
                                <Printer className="w-3.5 h-3.5" /> Batch Print
                            </button>
                            <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors"
                                style={{ backgroundColor: 'var(--odoo-teal)', color: '#fff' }}>
                                <Users className="w-3.5 h-3.5" /> Assign Picker
                            </button>
                            <button onClick={() => {
                                const orders = pendingOrders.filter(o => selectedOrders.has(o.id));
                                if (orders.length > 0) {
                                    const waves = autoWavePlan(orders);
                                    setWavePlan(waves);
                                    setShowWavePlan(true);
                                    setExpandedWave(0);
                                }
                            }}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded text-white transition-all active:scale-95"
                                style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                <Zap className="w-3.5 h-3.5" /> Create Wave
                            </button>
                        </div>
                    </div>
                )}

                </div>
            ) : (() => {
                /* ══════════════════════════════════════════════════════════════════
                   DETAIL VIEW — Active Picking Session (unchanged from original)
                   ══════════════════════════════════════════════════════════════════ */
                const items = pickPathEnabled ? sortByPickPath(selectedPickOrder.items) : selectedPickOrder.items;
                const totalExpected = items.reduce((s, i) => s + i.expected, 0);
                const totalPicked = items.reduce((s, i) => s + i.picked, 0);
                const progressPct = totalExpected > 0 ? Math.round((totalPicked / totalExpected) * 100) : 0;
                const remainingItems = totalExpected - totalPicked;
                return (
                <div className="max-w-4xl mx-auto w-full space-y-6">
                    {/* Header */}
                    <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <button onClick={() => setSelectedPickOrder(null)} className="text-sm font-medium flex items-center gap-1 mb-2 transition-colors" style={{ color: 'var(--odoo-purple)' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-purple-dark)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-purple)'}
                            >
                                <ChevronLeft className="w-4 h-4" /> Back to Pick List
                            </button>
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>Active Picking Session</h1>
                            <p className="text-sm" style={{ color: 'var(--odoo-text-secondary)' }}>
                                {selectedPickOrder.ref}{selectedPickOrder.customer ? ` \u00b7 ${selectedPickOrder.customer}` : ''} &bull; {items.length} SKU{items.length > 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => generatePickingList(selectedPickOrder)} className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm rounded transition-all active:scale-95" style={{ backgroundColor: 'var(--odoo-teal)', color: '#fff' }}>
                                <Printer className="w-4 h-4" /> Print Picklist
                            </button>
                            {progressPct === 100 && (
                                <button onClick={() => { setSelectedPickOrder(null); }} className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm rounded text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                    <CheckSquare className="w-4 h-4" /> Validate Wave
                                </button>
                            )}
                        </div>
                    </section>

                    {/* Scanning Hub + Progress */}
                    <section className="grid grid-cols-12 gap-4">
                        {/* Scan Input - 8 cols */}
                        <div className="col-span-12 lg:col-span-8 rounded shadow-[var(--odoo-shadow-md)] overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', outline: '1px solid var(--odoo-border-ghost)' }}>
                            <div className="px-5 pt-4 pb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Immediate Action</span>
                            </div>
                            <div className="px-5 pb-4">
                                <div className="relative flex items-center" style={{ backgroundColor: 'var(--odoo-surface-high)', borderRadius: 'var(--odoo-radius)' }}>
                                    <div className="absolute left-5 pointer-events-none" style={{ color: 'var(--odoo-purple)' }}>
                                        <ScanLine className="w-6 h-6" />
                                    </div>
                                    <input
                                        ref={pickInputRef}
                                        type="text"
                                        id="pick-scan"
                                        value={pickScanInput}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val.includes(' ') || val.length > 30) return;
                                            setPickScanInput(val);
                                        }}
                                        onPaste={e => e.preventDefault()}
                                        onKeyDown={handlePickScanSubmit}
                                        onFocus={e => {
                                            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
                                            if (isMobile) {
                                                e.target.setAttribute('readonly', 'readonly');
                                                setTimeout(() => e.target.removeAttribute('readonly'), 200);
                                            }
                                        }}
                                        placeholder="Scan barcode only..."
                                        className="w-full border-none py-5 pl-14 pr-20 text-lg font-medium focus:ring-2 focus:ring-[var(--odoo-purple)] transition-all"
                                        style={{ backgroundColor: 'transparent', color: 'var(--odoo-text)', borderRadius: 'var(--odoo-radius)', outline: 'none' }}
                                    />
                                    <div className="absolute right-5 flex items-center gap-2">
                                        <kbd className="px-2 py-1 text-[10px] font-bold rounded" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text-secondary)' }}>ENTER</kbd>
                                    </div>
                                </div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest mt-2 animate-pulse" style={{ color: 'var(--odoo-text-muted)' }}>Waiting for barcode scan...</p>
                            </div>
                        </div>
                        {/* Progress - 4 cols */}
                        <div className="col-span-12 lg:col-span-4 rounded shadow-[var(--odoo-shadow-md)] p-5" style={{ backgroundColor: 'var(--odoo-surface)', outline: '1px solid var(--odoo-border-ghost)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Overall Progress</span>
                                <span className="text-2xl font-bold tabular-nums" style={{ color: progressPct === 100 ? 'var(--odoo-success)' : 'var(--odoo-teal)' }}>{progressPct}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? 'var(--odoo-success)' : 'var(--odoo-teal)' }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded p-3" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--odoo-text-muted)' }}>Picked</div>
                                    <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--odoo-teal)' }}>{totalPicked}</div>
                                </div>
                                <div className="rounded p-3" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--odoo-text-muted)' }}>Remaining</div>
                                    <div className="text-xl font-bold tabular-nums" style={{ color: remainingItems > 0 ? 'var(--odoo-text)' : 'var(--odoo-success)' }}>{remainingItems}</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Picking Table */}
                    <section className="rounded shadow-[var(--odoo-shadow-md)] overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface)', outline: '1px solid var(--odoo-border-ghost)' }}>
                        <div className="overflow-x-auto">
                        <table className="w-full text-left" style={{ minWidth: '700px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)', width: '15%' }}>Location</th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)', width: '12%' }}>SKU</th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Product Name</th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-center whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)', width: '8%' }}>Target</th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-center whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)', width: '15%' }}>Picked</th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-right whitespace-nowrap" style={{ color: 'var(--odoo-text-muted)', width: '12%' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                            {items.map((item, idx) => {
                                const isComplete = item.picked === item.expected;
                                const isInProgress = item.picked > 0 && !isComplete;
                                const catalog = PRODUCT_CATALOG[item.sku];
                                const location = getLocation(item.sku, item.location);
                                const si = invItems.find(inv => (inv.sku || inv.default_code) === item.sku);
                                const onHand = si?.onHand ?? si?.quantity ?? 0;
                                const isOutOfStock = invItems.length > 0 && onHand <= 0;
                                const itemPct = item.expected > 0 ? Math.round((item.picked / item.expected) * 100) : 0;

                                let detailStatusLabel, statusBg, statusColor, statusBorder;
                                if (isComplete) {
                                    detailStatusLabel = 'PICKED'; statusBg = 'rgba(1,126,132,0.08)'; statusColor = 'var(--odoo-success)'; statusBorder = 'rgba(1,126,132,0.2)';
                                } else if (isOutOfStock) {
                                    detailStatusLabel = 'STOCK-OUT'; statusBg = 'rgba(228,111,120,0.08)'; statusColor = 'var(--odoo-danger)'; statusBorder = 'rgba(228,111,120,0.2)';
                                } else if (isInProgress) {
                                    detailStatusLabel = 'IN PROGRESS'; statusBg = 'var(--odoo-surface-high)'; statusColor = 'var(--odoo-text-secondary)'; statusBorder = 'var(--odoo-border-ghost)';
                                } else {
                                    detailStatusLabel = 'PENDING'; statusBg = 'var(--odoo-surface-low)'; statusColor = 'var(--odoo-text-muted)'; statusBorder = 'var(--odoo-border-ghost)';
                                }

                                return (
                                    <tr key={idx} className="transition-colors" style={{ backgroundColor: isComplete ? 'rgba(1,126,132,0.03)' : 'transparent', borderBottom: '1px solid var(--odoo-border-ghost)' }}
                                        onMouseEnter={e => { if (!isComplete) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = isComplete ? 'rgba(1,126,132,0.03)' : 'transparent'; }}
                                    >
                                        <td className="px-4 py-3">
                                            {isOutOfStock ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded uppercase whitespace-nowrap" style={{ backgroundColor: 'rgba(228,111,120,0.1)', color: 'var(--odoo-danger)' }}>
                                                    <AlertTriangle className="w-3 h-3" /> STOCK-OUT
                                                </span>
                                            ) : location ? (
                                                <span className="inline-block px-2 py-1 text-[10px] font-bold rounded uppercase" style={{ backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={location}>
                                                    {location}
                                                </span>
                                            ) : (
                                                <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>&mdash;</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-medium text-xs" style={{ color: isComplete ? 'var(--odoo-teal)' : 'var(--odoo-text)' }}>{item.sku}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-8 h-8 rounded overflow-hidden shrink-0 flex items-center justify-center" style={{ border: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                                    {(item.image || catalog?.image) ? (
                                                        <img src={item.image || catalog.image} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Box className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />
                                                    )}
                                                </div>
                                                <span className="font-medium text-xs truncate" style={{ color: 'var(--odoo-text)' }} title={catalog?.shortName || item.name}>{catalog?.shortName || item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-bold text-sm" style={{ color: 'var(--odoo-text)' }}>{item.expected}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2.5 py-0.5 rounded text-sm font-bold tabular-nums" style={{ backgroundColor: isComplete ? 'rgba(1,126,132,0.1)' : 'var(--odoo-surface-high)', color: isComplete ? 'var(--odoo-teal)' : 'var(--odoo-text)' }}>
                                                        {item.picked}
                                                    </span>
                                                    <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>/ {item.expected}</span>
                                                    {isComplete && <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--odoo-teal)' }} />}
                                                </div>
                                                <div className="w-16 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--odoo-surface-high)' }}>
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${itemPct}%`, backgroundColor: isComplete ? 'var(--odoo-success)' : 'var(--odoo-teal)' }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="px-2 py-1 text-[10px] font-bold rounded-full uppercase whitespace-nowrap" style={{ backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                                                {detailStatusLabel}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                        </div>
                        {/* Table Footer - Totals */}
                        <div className="px-5 py-4 flex justify-end" style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <div className="w-full md:w-72 space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>Total Expected:</span>
                                    <span className="font-semibold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{totalExpected} pcs</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium" style={{ color: 'var(--odoo-text-secondary)' }}>Total Picked:</span>
                                    <span className="font-semibold tabular-nums" style={{ color: 'var(--odoo-teal)' }}>{totalPicked} pcs</span>
                                </div>
                                <div className="pt-2 flex justify-between items-center" style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                                    <span className="text-base font-bold" style={{ color: 'var(--odoo-text)' }}>Completion:</span>
                                    <span className="text-xl font-bold" style={{ color: progressPct === 100 ? 'var(--odoo-success)' : 'var(--odoo-purple)' }}>{progressPct}%</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Session Intelligence - Floating Glass Panel */}
                    <div className="fixed bottom-6 right-6 z-30 hidden lg:block" style={{ width: '280px' }}>
                        <div className="rounded p-4 shadow-lg" style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid var(--odoo-border-ghost)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--odoo-text-muted)' }}>Session Intelligence</div>
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>Avg Pick Time</span>
                                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{totalPicked > 0 ? '~8s' : '--'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>Efficiency Rating</span>
                                    <span className="text-xs font-bold" style={{ color: progressPct >= 80 ? 'var(--odoo-success)' : progressPct >= 50 ? 'var(--odoo-warning)' : 'var(--odoo-text-muted)' }}>
                                        {progressPct >= 80 ? 'Excellent' : progressPct >= 50 ? 'Good' : progressPct > 0 ? 'In Progress' : 'Not Started'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>Est. Completion</span>
                                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--odoo-text)' }}>{remainingItems > 0 ? `~${Math.ceil(remainingItems * 0.15)}m` : 'Done'}</span>
                                </div>
                            </div>
                            {invItems.length > 0 && items.some(item => {
                                const si = invItems.find(inv => (inv.sku || inv.default_code) === item.sku);
                                return (si?.onHand ?? si?.quantity ?? 0) <= 0;
                            }) && (
                                <button onClick={() => alert('Inventory check requested for out-of-stock items')} className="w-full mt-3 py-2 text-xs font-bold rounded transition-all active:scale-95 flex items-center justify-center gap-1.5" style={{ backgroundColor: 'rgba(228,111,120,0.08)', color: 'var(--odoo-danger)', border: '1px solid rgba(228,111,120,0.15)' }}>
                                    <AlertTriangle className="w-3.5 h-3.5" /> Request Inventory Check
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Auto Wave Plan Modal */}
            {showWavePlan && wavePlan && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border)', borderRadius: 'var(--odoo-radius)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid var(--odoo-border)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <Zap className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Auto Wave Plan
                                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-secondary)' }}>
                                    {wavePlan.length} waves &middot; {pendingOrders.length} orders
                                </span>
                            </h2>
                            <button onClick={() => setShowWavePlan(false)} className="p-1 rounded transition-colors hover:bg-gray-200" style={{ color: 'var(--odoo-text-secondary)' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                            {wavePlan.map((wave, wIdx) => {
                                const waveSkus = {};
                                wave.forEach(o => (o.items || []).forEach(i => {
                                    waveSkus[i.sku] = (waveSkus[i.sku] || 0) + (i.expected || 0);
                                }));
                                const totalPcs = Object.values(waveSkus).reduce((s, v) => s + v, 0);
                                const waveUniqueSkus = Object.keys(waveSkus).length;
                                // Collect zones for this wave
                                const waveZoneSet = new Set();
                                wave.forEach(o => (o.items || []).forEach(i => {
                                    const loc = getLocation(i.sku, i.location);
                                    const p = parseLocation(loc);
                                    if (p.zone !== 'ZZZ') waveZoneSet.add(p.zone);
                                }));
                                const waveZoneList = [...waveZoneSet].sort();
                                const isExpanded = expandedWave === wIdx;
                                return (
                                    <div key={wIdx} className="rounded overflow-hidden" style={{ border: '1px solid var(--odoo-border)' }}>
                                        <div className="px-4 py-3 flex items-center justify-between cursor-pointer"
                                            style={{ backgroundColor: isExpanded ? 'var(--odoo-purple-light)' : 'var(--odoo-surface-low)' }}
                                            onClick={() => setExpandedWave(isExpanded ? -1 : wIdx)}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold" style={{ backgroundColor: 'var(--odoo-purple)', color: '#fff' }}>
                                                    {wIdx + 1}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>Wave {wIdx + 1}</div>
                                                    <div className="text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                        {wave.length} orders &middot; {waveUniqueSkus} SKUs &middot; {totalPcs} pcs
                                                        {waveZoneList.length > 0 && <span style={{ color: 'var(--odoo-teal)' }}> &middot; Zone {waveZoneList.join(', ')}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); printWave(wave, wIdx); }}
                                                    className="odoo-btn odoo-btn-primary flex items-center gap-1 text-xs">
                                                    <Printer className="w-3 h-3" /> Print
                                                </button>
                                                {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--odoo-text-secondary)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--odoo-text-secondary)' }} />}
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div style={{ borderTop: '1px solid var(--odoo-border)' }}>
                                                <div className="px-4 py-2" style={{ backgroundColor: 'var(--odoo-surface)', borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                    <div className="text-[11px] font-extrabold uppercase tracking-widest border-b border-outline-variant/10 pb-2 mb-1.5" style={{ color: 'var(--odoo-purple)' }}>SKU Summary</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.entries(waveSkus).sort((a, b) => a[0].localeCompare(b[0])).map(([sku, qty]) => (
                                                            <span key={sku} className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--odoo-surface-high)', color: 'var(--odoo-text-secondary)' }}>
                                                                {sku} <strong style={{ color: 'var(--odoo-purple)' }}>&times;{qty}</strong>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {wave.map((order, oIdx) => {
                                                    const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                                    const pcs = (order.items || []).reduce((s, i) => s + (i.expected || 0), 0);
                                                    return (
                                                        <div key={oIdx} className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono" style={{ color: 'var(--odoo-text-muted)' }}>{oIdx + 1}</span>
                                                                {pl && <PlatformBadge name={order.courier || order.platform} size={18} />}
                                                                <span className="text-xs font-semibold" style={{ color: 'var(--odoo-text)' }}>{order.ref}</span>
                                                                <span className="text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono" style={{ color: 'var(--odoo-text-secondary)' }}>{(order.items || []).length} SKU &middot; {pcs} pcs</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-5 py-3 flex justify-between items-center" style={{ borderTop: '1px solid var(--odoo-border)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPickMode(pickMode === 'wave' ? 'off' : 'wave')}
                                    className="odoo-btn flex items-center gap-1.5 text-xs"
                                    style={{
                                        backgroundColor: pickPathEnabled ? 'var(--odoo-teal)' : 'var(--odoo-surface)',
                                        color: pickPathEnabled ? '#fff' : 'var(--odoo-text-secondary)',
                                        border: `1px solid ${pickPathEnabled ? 'var(--odoo-teal)' : 'var(--odoo-border)'}`,
                                    }}>
                                    <Route className="w-3 h-3" /> {pickPathEnabled ? 'Path ON' : 'Path OFF'}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowWavePlan(false)} className="odoo-btn odoo-btn-secondary">Close</button>
                                <button onClick={() => {
                                    const allOrders = wavePlan.flat().map(o => ({
                                        ...o,
                                        items: pickPathEnabled ? sortByPickPath(o.items) : o.items,
                                    }));
                                    setShowWavePlan(false);
                                    setShowPickingList({ batch: true, orders: allOrders, waveSorted: true, waveLabel: 'All Waves' });
                                }} className="odoo-btn odoo-btn-primary flex items-center gap-1.5">
                                    <Printer className="w-3.5 h-3.5" /> Print All Waves
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Picking List Modal */}
            {showPickingList && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: 'var(--odoo-radius)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                                <Printer className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Picking List (BiM Format)
                            </h2>
                            <button onClick={() => setShowPickingList(null)} className="p-1 rounded transition-colors hover:bg-gray-200" style={{ color: 'var(--odoo-text-secondary)' }}><X className="w-4 h-4" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar font-mono text-sm">
                            {(() => {
                                const orders = showPickingList.batch ? showPickingList.orders : [showPickingList];
                                const isWave = showPickingList.waveSorted && showPickingList.batch;
                                const total = orders.length;
                                const today = new Date();
                                const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

                                const summarySection = isWave ? (() => {
                                    const summary = computeSkuSummary(orders);
                                    const grandTotal = summary.reduce((s, r) => s + r.qty, 0);
                                    return (
                                        <div className="mb-6 pb-5" style={{ borderBottom: '3px solid var(--odoo-purple)' }}>
                                            <div className="font-bold text-sm mb-1" style={{ color: 'var(--odoo-purple)' }}>[Wave Pick Summary]</div>
                                            <div className="text-xs mb-3" style={{ color: 'var(--odoo-text-secondary)' }}>{dateStr} | {total} orders | {grandTotal} total pieces</div>
                                            <div className="space-y-1">
                                                {summary.map((r, i) => (
                                                    <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid var(--odoo-border-ghost)' }}>
                                                        <span className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>
                                                            <span className="font-mono font-bold" style={{ color: 'var(--odoo-text)' }}>{r.sku}</span>
                                                            <span className="ml-2">{r.name}</span>
                                                            <span className="ml-2" style={{ color: 'var(--odoo-text-muted)' }}>({r.orderCount} orders)</span>
                                                        </span>
                                                        <span className="font-bold text-sm ml-4" style={{ color: 'var(--odoo-purple)' }}>{r.qty} pcs</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-center mt-2 pt-2" style={{ borderTop: '2px solid var(--odoo-text)' }}>
                                                <span className="text-xs font-bold" style={{ color: 'var(--odoo-text)' }}>GRAND TOTAL</span>
                                                <span className="font-bold text-base" style={{ color: 'var(--odoo-purple)' }}>{grandTotal} pcs</span>
                                            </div>
                                        </div>
                                    );
                                })() : null;

                                return <>{summarySection}{orders.map((order, idx) => {
                                    const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                    return (
                                        <div key={idx} className="mb-6 pb-5 last:border-0" style={{ borderBottom: '2px dashed var(--odoo-border)' }}>
                                            <div className="font-bold text-sm" style={{ color: 'var(--odoo-text)' }}>[Picking List] {pl?.name || order.platform}_KissMyBody</div>
                                            <div className="text-xs mt-0.5" style={{ color: 'var(--odoo-text-secondary)' }}>Set_NO No.{idx+1} / Total {total}</div>
                                            <div className="mt-2 px-3 py-1.5 rounded inline-block text-xs tracking-widest font-mono" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }}>{order.ref}</div>
                                            <div className="text-xs mt-1 mb-3" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer && `Customer: ${order.customer}`}</div>
                                            <div className="space-y-1 mb-3">
                                                {order.items.map((item, i) => {
                                                    const loc = getLocation(item.sku, item.location);
                                                    return (
                                                    <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid var(--odoo-surface-high)' }}>
                                                        <span className="text-xs" style={{ color: 'var(--odoo-text)' }}>
                                                            {PRODUCT_CATALOG[item.sku]?.shortName || item.name}
                                                            {loc && <span className="ml-2 font-bold" style={{ color: 'var(--odoo-warning)' }}>[{loc}]</span>}
                                                        </span>
                                                        <span className="font-bold text-sm ml-4" style={{ color: 'var(--odoo-text)' }}>{item.sku}~{item.expected}</span>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="text-[10px] text-center italic mt-3" style={{ color: 'var(--odoo-text-muted)' }}>
                                                [Operation Date {dateStr}]<br/>Power By WMS Pro @ Since {Date.now()} UnixTimeStamp
                                            </div>
                                        </div>
                                    );
                                })}</>;
                            })()}
                        </div>

                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                            <button onClick={() => setShowPickingList(null)} className="odoo-btn odoo-btn-secondary">Close</button>
                            <button onClick={handlePrint} className="odoo-btn odoo-btn-primary flex items-center gap-1.5">
                                <Printer className="w-3.5 h-3.5" /> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pick;
