import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShoppingCart, RefreshCw, ClipboardList, ChevronRight, ChevronLeft, CheckSquare, Box, Printer, X, ScanLine, Search, MapPin, List, LayoutGrid, Columns, ArrowUpDown, AlertTriangle, Route, Zap, ChevronDown, ChevronUp } from 'lucide-react';
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

// Platform config for Create SO
const Pick = ({ salesOrders, selectedPickOrder, setSelectedPickOrder, syncPlatformOrders, isProcessingImport, handlePickScanSubmit, pickScanInput, setPickScanInput, pickInputRef, inventory, clearDummyOrders, isSyncingOrders, onSyncOrders, onCreateSOInOdoo, isCreatingSO, stockFrozen }) => {
    const getLocation = (sku, itemLoc) => itemLoc || inventory?.find(i => i.sku === sku)?.location || PRODUCT_CATALOG[sku]?.location || null;
    const [showPickingList, setShowPickingList] = useState(null);
    const [scanFlash, setScanFlash] = useState(null);
    const [debugScan, setDebugScan] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const [waveSorted, setWaveSorted] = useState(false);
    const listScanRef = useRef(null);
    const pendingOrdersRef = useRef([]);

    const pendingOrders = salesOrders.filter(o => o.status === 'pending' || o.status === 'picking');

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

    // Keep pendingOrdersRef always fresh — avoids stale closure in handleListScan
    useEffect(() => { pendingOrdersRef.current = pendingOrders; }, [pendingOrders]);

    // Focus scan input when showing list — use readonly trick to prevent virtual keyboard on mobile
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

    const handleListScan = useCallback((e) => {
        if (e.key !== 'Enter') return;
        // Read directly from DOM ref — uncontrolled input, no React state interference
        const raw = listScanRef.current?.value || '';
        const val = raw.replace(/[^\x20-\x7E\u0E00-\u0E7F]/g, '').trim().toUpperCase();
        // Clear the DOM input immediately
        if (listScanRef.current) listScanRef.current.value = '';
        if (!val) return;

        const orders = pendingOrdersRef.current;

        // Exact match: ref, shopeeOrderNo, awb, item barcode/sku
        let found = orders.find(o =>
            o.ref?.toUpperCase() === val ||
            o.shopeeOrderNo?.toUpperCase() === val ||
            o.awb?.toUpperCase() === val ||
            o.items?.some(i => (i.barcode && i.barcode.toUpperCase() === val) || (i.sku && i.sku.toUpperCase() === val))
        );

        // Partial fallback: trailing number e.g. "00035" matches "WH/OUT/00035"
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

    // Wave Sort: group orders by primary SKU, then sort by total qty ascending within each group
    const waveSort = (orders) => {
        // Build SKU fingerprint for each order (sorted SKUs joined)
        const withKey = orders.map(o => {
            const skus = (o.items || []).map(i => i.sku).sort();
            const primarySku = skus[0] || '';
            const totalQty = (o.items || []).reduce((s, i) => s + (i.expected || 0), 0);
            return { order: o, primarySku, skus, totalQty };
        });
        // Sort: first by primary SKU alphabetically, then by total qty ascending
        withKey.sort((a, b) => {
            if (a.primarySku !== b.primarySku) return a.primarySku.localeCompare(b.primarySku);
            return a.totalQty - b.totalQty;
        });
        return withKey.map(w => w.order);
    };

    // Compute SKU summary for batch print
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
    // Parse location "A-01-03" → { zone: 'A', aisle: 1, shelf: 3 }
    const parseLocation = (loc) => {
        if (!loc) return { zone: 'ZZZ', aisle: 999, shelf: 999 }; // no-location items go last
        const parts = loc.split('-');
        if (parts.length >= 3) return { zone: parts[0], aisle: parseInt(parts[1]) || 0, shelf: parseInt(parts[2]) || 0 };
        if (parts.length === 2) return { zone: parts[0], aisle: parseInt(parts[1]) || 0, shelf: 0 };
        return { zone: loc, aisle: 0, shelf: 0 };
    };

    // Sort items by serpentine warehouse path: Zone → Aisle (serpentine) → Shelf
    const sortByPickPath = (items) => {
        return [...items].sort((a, b) => {
            const la = parseLocation(getLocation(a.sku, a.location));
            const lb = parseLocation(getLocation(b.sku, b.location));
            // Zone first
            if (la.zone !== lb.zone) return la.zone.localeCompare(lb.zone);
            // Aisle next
            if (la.aisle !== lb.aisle) return la.aisle - lb.aisle;
            // Serpentine: odd aisles ascending, even aisles descending
            return la.aisle % 2 === 1 ? la.shelf - lb.shelf : lb.shelf - la.shelf;
        });
    };

    // ── Auto Wave Planner ──
    const WAVE_SIZE = 15; // max orders per wave

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
        // Sort by urgency first (courier cutoff soonest first)
        remaining.sort((a, b) => a.urgent - b.urgent);

        const waves = [];
        const used = new Set();

        while (used.size < orders.length) {
            const wave = [];
            const waveSkus = new Set();
            const waveZones = new Set();

            // Seed: pick first unused order (most urgent)
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

            // If wave didn't fill with overlaps, fill with remaining (by urgency)
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
    const [wavePlan, setWavePlan] = useState(null); // array of waves
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

    // HTML escape to prevent XSS in print window
    const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // BiM-style print
    const handlePrint = () => {
        const orders = showPickingList.batch ? showPickingList.orders : [showPickingList];
        const isWave = showPickingList.waveSorted && showPickingList.batch;
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
        const total = orders.length;

        // Summary page (only for wave-sorted batch print)
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
      <th style="text-align:center">✓</th>
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

    return (
        <div className="max-w-4xl mx-auto w-full animate-slide-up">
            {stockFrozen && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <span className="text-2xl">🔒</span>
                    <div>
                        <p className="text-sm font-bold text-red-800">Stock Frozen</p>
                        <p className="text-xs text-red-600">Picking is blocked during Full Count. Please wait until the count is completed.</p>
                    </div>
                </div>
            )}
            {!selectedPickOrder ? (
                <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div className="px-5 py-3 flex flex-wrap gap-3 justify-between items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                <ShoppingCart className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>Pick List</h2>
                                <p className="text-[11px]" style={{ color: 'var(--odoo-text-secondary)' }}>{pendingOrders.length} orders waiting</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Odoo-style view switcher */}
                            <div className="flex items-center gap-0.5 rounded p-0.5" style={{ backgroundColor: '#e9ecef', border: '1px solid var(--odoo-border-ghost)' }}>
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
                                        backgroundColor: pickMode === 'off' ? '#fff' : pickMode === 'path' ? '#017E84' : '#714B67',
                                        color: pickMode === 'off' ? '#6c757d' : '#fff',
                                        border: `1px solid ${pickMode === 'off' ? '#dee2e6' : pickMode === 'path' ? '#017E84' : '#714B67'}`,
                                    }}
                                    title="Cycle: Off → Path (sort by walk route) → Auto Wave (group + path)">
                                    {pickMode === 'wave' ? <Zap className="w-3.5 h-3.5" /> : <Route className="w-3.5 h-3.5" />}
                                    {pickMode === 'off' ? 'Off' : pickMode === 'path' ? 'Path' : 'Wave'}
                                </button>
                                <button onClick={() => setWaveSorted(!waveSorted)}
                                    className="odoo-btn flex items-center gap-1.5"
                                    style={{
                                        backgroundColor: waveSorted ? '#714B67' : '#fff',
                                        color: waveSorted ? '#fff' : '#6c757d',
                                        border: `1px solid ${waveSorted ? '#714B67' : '#dee2e6'}`,
                                    }}
                                    title="Wave Sort: group similar SKUs together, sorted by quantity">
                                    <ArrowUpDown className="w-3.5 h-3.5" /> Sort
                                </button>
                                <button onClick={generateBatchPickingList} className="odoo-btn odoo-btn-secondary flex items-center gap-1.5">
                                    <Printer className="w-3.5 h-3.5" /> Print
                                </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Sync loading banner */}
                    {isSyncingOrders && (
                        <div className="px-5 py-2 flex items-center gap-2" style={{ backgroundColor: '#e8f4fd', borderBottom: '1px solid #b8daff' }}>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--odoo-info)' }} />
                            <p className="text-xs font-medium" style={{ color: 'var(--odoo-info)' }}>Loading orders from Odoo...</p>
                        </div>
                    )}

                    {/* Scan box */}
                    <div
                        className={`px-5 py-3 cursor-pointer transition-colors`}
                        style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: scanFlash === 'notfound' ? '#fff5f5' : '#fafafa' }}
                        onClick={() => listScanRef.current?.focus()}
                    >
                        <div className="relative">
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
                                placeholder="Tap here, then scan Pick list barcode..."
                                className="w-full pl-9 pr-4 py-2 text-sm font-mono outline-none transition-all"
                                style={{
                                    border: `1px solid ${scanFlash === 'notfound' ? 'var(--odoo-danger)' : 'var(--odoo-border)'}`,
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--odoo-surface)',
                                    color: 'var(--odoo-text)',
                                }}
                            />
                            <ScanLine className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" style={{ color: 'var(--odoo-purple)' }} />
                        </div>
                        {scanFlash === 'notfound' && debugScan && (
                            <div className="mt-2 p-2 rounded" style={{ backgroundColor: '#fff5f5', border: '1px solid #f5c6cb' }}>
                                <p className="text-xs font-semibold" style={{ color: 'var(--odoo-danger)' }}>Work order not found ({debugScan.count} orders)</p>
                                <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--odoo-danger)' }}>Scanned: <span className="font-bold">"{debugScan.val}"</span></p>
                                <p className="text-[10px] font-mono" style={{ color: 'var(--odoo-text-muted)' }}>First ref: "{debugScan.firstRef}"</p>
                                {onSyncOrders && (
                                    <button onClick={onSyncOrders} className="mt-1.5 text-[10px] underline" style={{ color: 'var(--odoo-info)' }}>
                                        Sync Orders again
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        {pendingOrders.length === 0 ? (
                            <div className="text-center py-16 flex flex-col items-center" style={{ color: 'var(--odoo-text-muted)' }}>
                                <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No active picking tasks</p>
                            </div>
                        ) : (
                            <>
                            {/* ── LIST VIEW ── */}
                            {viewMode === 'list' && (
                                <div>
                                    {(waveSorted ? waveSort(pendingOrders) : [...pendingOrders].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))).map(order => {
                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                        const isFlash = scanFlash === order.id;
                                        return (
                                            <div key={order.id} className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                                                style={{ borderBottom: '1px solid var(--odoo-surface-high)', backgroundColor: isFlash ? '#f9f5f8' : 'var(--odoo-surface)' }}
                                                onMouseEnter={e => { if (!isFlash) e.currentTarget.style.backgroundColor = 'var(--odoo-surface-low)'; }}
                                                onMouseLeave={e => { if (!isFlash) e.currentTarget.style.backgroundColor = 'var(--odoo-surface)'; }}>
                                                <div className="flex items-center gap-3 flex-1" onClick={() => setSelectedPickOrder(order)}>
                                                    {pl ? <PlatformBadge name={order.courier || order.platform} size={32} /> : (() => { const av = getAvatarColor(order.customer || order.ref); return <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: av.bg, color: av.text }}>{(order.customer || order.ref || '?')[0].toUpperCase()}</div>; })()}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <h3 className="font-semibold text-sm" style={{ color: 'var(--odoo-text)' }}>{order.ref}</h3>
                                                            <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
                                                        </div>
                                                        <p className="text-xs truncate" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer} &bull; {(order.items || []).reduce((s, i) => s + i.expected, 0)} pcs &bull; {(order.items || []).length} SKU{(order.items || []).length > 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={(e) => { e.stopPropagation(); generatePickingList(order); }} className="p-1.5 rounded transition-colors" style={{ color: 'var(--odoo-text-muted)' }} title="Print Picking List"><Printer className="w-4 h-4" /></button>
                                                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--odoo-border)' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── KANBAN VIEW (columns by status) ── */}
                            {viewMode === 'kanban' && (
                                <div className="flex gap-3 p-4 overflow-x-auto" style={{ minHeight: '300px' }}>
                                    {[
                                        { status: 'pending', label: 'Pending', color: 'var(--odoo-warning)', borderColor: 'var(--odoo-warning)' },
                                        { status: 'picking', label: 'In Progress', color: 'var(--odoo-info)', borderColor: 'var(--odoo-info)' },
                                        { status: 'picked', label: 'Picked', color: 'var(--odoo-purple)', borderColor: 'var(--odoo-purple)' },
                                    ].map(col => {
                                        const colOrders = pendingOrders.filter(o => o.status === col.status);
                                        return (
                                            <div key={col.status} className="flex-1 min-w-[220px] rounded-lg flex flex-col" style={{ backgroundColor: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)' }}>
                                                <div className="px-3 py-2.5 flex items-center gap-2 rounded-t-lg" style={{ borderBottom: `3px solid ${col.borderColor}` }}>
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                                                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text)' }}>{col.label}</span>
                                                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--odoo-border)', color: 'var(--odoo-text-secondary)' }}>{colOrders.length}</span>
                                                </div>
                                                <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '500px' }}>
                                                    {colOrders.map(order => {
                                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                                        const itemCount = (order.items || []).reduce((s, i) => s + i.expected, 0);
                                                        const stockStatus = getOrderStockStatus(order);
                                                        return (
                                                            <div key={order.id} onClick={() => setSelectedPickOrder(order)}
                                                                className="rounded-lg p-3 cursor-pointer transition-all hover:shadow-md"
                                                                style={{ backgroundColor: stockStatus.ok ? 'var(--odoo-surface)' : '#fff8f0', border: '1px solid var(--odoo-border-ghost)', borderLeft: `3px solid ${stockStatus.ok ? col.borderColor : 'var(--odoo-danger)'}` }}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-bold" style={{ color: 'var(--odoo-text)' }}>{order.ref}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        {!stockStatus.ok && (
                                                                            <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#fee2e2', color: 'var(--odoo-danger)' }}>
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
                                                    {colOrders.length === 0 && <div className="text-center py-8 text-xs" style={{ color: 'var(--odoo-text-muted)' }}>No orders</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── CARD VIEW (grid) ── */}
                            {viewMode === 'card' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                                    {(waveSorted ? waveSort(pendingOrders) : [...pendingOrders].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))).map(order => {
                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                        const itemCount = (order.items || []).reduce((s, i) => s + i.expected, 0);
                                        const picked = (order.items || []).reduce((s, i) => s + (i.picked || 0), 0);
                                        const progress = itemCount > 0 ? Math.round((picked / itemCount) * 100) : 0;
                                        const statusColors = { pending: 'var(--odoo-warning)', picking: 'var(--odoo-info)', picked: 'var(--odoo-purple)' };
                                        return (
                                            <div key={order.id} onClick={() => setSelectedPickOrder(order)}
                                                className="rounded-lg cursor-pointer transition-all hover:shadow-md overflow-hidden"
                                                style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                                                <div className="h-1" style={{ backgroundColor: statusColors[order.status] || 'var(--odoo-border)' }} />
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="text-sm font-bold" style={{ color: 'var(--odoo-text)' }}>{order.ref}</h3>
                                                        <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        {pl ? <PlatformBadge name={order.courier || order.platform} size={24} /> : (() => { const av = getAvatarColor(order.customer || order.ref); return <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: av.bg, color: av.text }}>{(order.customer || '?')[0].toUpperCase()}</div>; })()}
                                                        <span className="text-xs truncate" style={{ color: 'var(--odoo-text-secondary)' }}>{order.customer}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                            <div className="text-sm font-bold" style={{ color: 'var(--odoo-purple)' }}>{itemCount}</div>
                                                            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Items</div>
                                                        </div>
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                            <div className="text-sm font-bold" style={{ color: 'var(--odoo-teal)' }}>{order.items.length}</div>
                                                            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>SKUs</div>
                                                        </div>
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: 'var(--odoo-surface-low)' }}>
                                                            <div className="text-sm font-bold" style={{ color: progress === 100 ? 'var(--odoo-success)' : 'var(--odoo-warning)' }}>{progress}%</div>
                                                            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Done</div>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e9ecef' }}>
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
                </div>
            ) : (
                <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                        <button onClick={() => setSelectedPickOrder(null)} className="text-sm font-medium flex items-center gap-1 transition-colors" style={{ color: 'var(--odoo-purple)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--odoo-purple-dark)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--odoo-purple)'}
                        >
                            <ChevronLeft className="w-4 h-4" /> Pick List
                        </button>
                        <div className="flex items-center gap-2">
                            <button onClick={() => generatePickingList(selectedPickOrder)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--odoo-text-secondary)' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--odoo-purple)'; e.currentTarget.style.backgroundColor = 'var(--odoo-purple-light)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--odoo-text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                title="Print">
                                <Printer className="w-4 h-4" />
                            </button>
                            <span className="font-mono font-semibold text-sm px-2.5 py-1" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', color: 'var(--odoo-text)' }}>
                                {selectedPickOrder.ref}
                            </span>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="max-w-md mx-auto mb-6 text-center">
                            <div className="relative">
                                <input
                                    ref={pickInputRef}
                                    type="text"
                                    id="pick-scan"
                                    value={pickScanInput}
                                    onChange={e => setPickScanInput(e.target.value)}
                                    onKeyDown={handlePickScanSubmit}
                                    onFocus={e => {
                                        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
                                        if (isMobile) {
                                            e.target.setAttribute('readonly', 'readonly');
                                            setTimeout(() => e.target.removeAttribute('readonly'), 200);
                                        }
                                    }}
                                    placeholder="Scan Product Barcode..."
                                    className="industrial-input w-full text-center"
                                />
                                <ScanLine className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--odoo-border)' }} />
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest mt-2 animate-pulse" style={{ color: 'var(--odoo-text-muted)' }}>Waiting for barcode scan...</p>
                        </div>
                        <div className="space-y-1.5">
                            {(pickPathEnabled ? sortByPickPath(selectedPickOrder.items || []) : (selectedPickOrder.items || [])).map((item, idx) => {
                                const isComplete = item.picked === item.expected;
                                const catalog = PRODUCT_CATALOG[item.sku];
                                return (
                                    <div key={idx} className="p-3 flex items-center gap-3 transition-all rounded" style={{
                                        border: `1px solid ${isComplete ? '#b8e0c4' : 'var(--odoo-border)'}`,
                                        backgroundColor: isComplete ? '#f0fdf4' : 'var(--odoo-surface)',
                                    }}>
                                        <div className="w-11 h-11 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--odoo-border-ghost)', backgroundColor: 'var(--odoo-surface-low)' }}>
                                            {(item.image || catalog?.image) ? (
                                                <img src={item.image || catalog.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--odoo-border)' }}><Box className="w-4 h-4" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: isComplete ? 'var(--odoo-success)' : 'var(--odoo-text)' }}>{catalog?.shortName || item.name}</p>
                                            <p className="text-[10px] font-mono uppercase" style={{ color: 'var(--odoo-text-muted)' }}>{item.sku}</p>
                                            {getLocation(item.sku, item.location) && (
                                                <p className="text-[11px] font-bold flex items-center gap-1 mt-0.5" style={{ color: 'var(--odoo-warning)' }}>
                                                    <MapPin className="w-3 h-3" />{getLocation(item.sku, item.location)}
                                                </p>
                                            )}
                                            {!getLocation(item.sku, item.location) && item.barcode && (
                                                <p className="text-[10px] font-mono" style={{ color: 'var(--odoo-border)' }}>{item.barcode}</p>
                                            )}
                                            {(() => {
                                                const si = invItems.find(inv => (inv.sku || inv.default_code) === item.sku);
                                                const onHand = si?.onHand ?? si?.quantity ?? 0;
                                                if (invItems.length > 0 && onHand <= 0) {
                                                    return <p className="text-[10px] font-bold flex items-center gap-0.5 mt-0.5" style={{ color: 'var(--odoo-danger)' }}>
                                                        <AlertTriangle className="w-3 h-3" /> Out of Stock
                                                    </p>;
                                                }
                                                if (invItems.length > 0 && onHand > 0) {
                                                    return <p className="text-[10px] flex items-center gap-0.5 mt-0.5" style={{ color: 'var(--odoo-success)' }}>
                                                        Stock: {onHand}
                                                    </p>;
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <div className="text-right shrink-0 flex items-center gap-2">
                                            {isComplete && <CheckSquare className="w-4 h-4" style={{ color: 'var(--odoo-success)' }} />}
                                            <div>
                                                <span className="text-xl font-bold tabular-nums" style={{ color: isComplete ? 'var(--odoo-success)' : 'var(--odoo-text)' }}>{item.picked}</span>
                                                <span className="mx-0.5" style={{ color: 'var(--odoo-border)' }}>/</span>
                                                <span className="text-sm font-semibold" style={{ color: 'var(--odoo-text-secondary)' }}>{item.expected}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Auto Wave Plan Modal */}
            {showWavePlan && wavePlan && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                                <Zap className="w-4 h-4" style={{ color: '#714B67' }} /> Auto Wave Plan
                                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e9ecef', color: '#6c757d' }}>
                                    {wavePlan.length} waves · {pendingOrders.length} orders
                                </span>
                            </h2>
                            <button onClick={() => setShowWavePlan(false)} className="p-1 rounded transition-colors hover:bg-gray-200" style={{ color: '#6c757d' }}><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                            {wavePlan.map((wave, wIdx) => {
                                const waveSkus = {};
                                wave.forEach(o => (o.items || []).forEach(i => {
                                    waveSkus[i.sku] = (waveSkus[i.sku] || 0) + (i.expected || 0);
                                }));
                                const totalPcs = Object.values(waveSkus).reduce((s, v) => s + v, 0);
                                const uniqueSkus = Object.keys(waveSkus).length;
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
                                    <div key={wIdx} className="rounded-lg overflow-hidden" style={{ border: '1px solid #dee2e6' }}>
                                        <div className="px-4 py-3 flex items-center justify-between cursor-pointer"
                                            style={{ backgroundColor: isExpanded ? '#f0e8ed' : '#f8f9fa' }}
                                            onClick={() => setExpandedWave(isExpanded ? -1 : wIdx)}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold" style={{ backgroundColor: '#714B67', color: '#fff' }}>
                                                    {wIdx + 1}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold" style={{ color: '#212529' }}>Wave {wIdx + 1}</div>
                                                    <div className="text-[11px]" style={{ color: '#6c757d' }}>
                                                        {wave.length} orders · {uniqueSkus} SKUs · {totalPcs} pcs
                                                        {waveZoneList.length > 0 && <span style={{ color: '#017E84' }}> · Zone {waveZoneList.join(', ')}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); printWave(wave, wIdx); }}
                                                    className="odoo-btn odoo-btn-primary flex items-center gap-1 text-xs">
                                                    <Printer className="w-3 h-3" /> Print
                                                </button>
                                                {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: '#6c757d' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#6c757d' }} />}
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div style={{ borderTop: '1px solid #dee2e6' }}>
                                                {/* SKU Summary for this wave */}
                                                <div className="px-4 py-2" style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f1f3f5' }}>
                                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#714B67' }}>SKU Summary</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.entries(waveSkus).sort((a, b) => a[0].localeCompare(b[0])).map(([sku, qty]) => (
                                                            <span key={sku} className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e9ecef', color: '#495057' }}>
                                                                {sku} <strong style={{ color: '#714B67' }}>×{qty}</strong>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* Order list */}
                                                {wave.map((order, oIdx) => {
                                                    const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                                    const pcs = (order.items || []).reduce((s, i) => s + (i.expected || 0), 0);
                                                    return (
                                                        <div key={oIdx} className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f3f5' }}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono" style={{ color: '#adb5bd' }}>{oIdx + 1}</span>
                                                                {pl && <PlatformBadge name={order.courier || order.platform} size={18} />}
                                                                <span className="text-xs font-semibold" style={{ color: '#212529' }}>{order.ref}</span>
                                                                <span className="text-[11px]" style={{ color: '#6c757d' }}>{order.customer}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono" style={{ color: '#495057' }}>{(order.items || []).length} SKU · {pcs} pcs</span>
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
                        <div className="px-5 py-3 flex justify-between items-center" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPickMode(pickMode === 'wave' ? 'off' : 'wave')}
                                    className="odoo-btn flex items-center gap-1.5 text-xs"
                                    style={{
                                        backgroundColor: pickPathEnabled ? '#017E84' : '#fff',
                                        color: pickPathEnabled ? '#fff' : '#6c757d',
                                        border: `1px solid ${pickPathEnabled ? '#017E84' : '#dee2e6'}`,
                                    }}>
                                    <Route className="w-3 h-3" /> {pickPathEnabled ? 'Path ON' : 'Path OFF'}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowWavePlan(false)} className="odoo-btn odoo-btn-secondary">Close</button>
                                <button onClick={() => {
                                    // Print all waves as one batch
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
                    <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
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

                                // SKU summary section for wave-sorted batch
                                const summarySection = isWave ? (() => {
                                    const summary = computeSkuSummary(orders);
                                    const grandTotal = summary.reduce((s, r) => s + r.qty, 0);
                                    return (
                                        <div className="mb-6 pb-5" style={{ borderBottom: '3px solid #714B67' }}>
                                            <div className="font-bold text-sm mb-1" style={{ color: '#714B67' }}>[Wave Pick Summary]</div>
                                            <div className="text-xs mb-3" style={{ color: '#6c757d' }}>{dateStr} | {total} orders | {grandTotal} total pieces</div>
                                            <div className="space-y-1">
                                                {summary.map((r, i) => (
                                                    <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid #f1f3f5' }}>
                                                        <span className="text-xs" style={{ color: '#495057' }}>
                                                            <span className="font-mono font-bold" style={{ color: '#212529' }}>{r.sku}</span>
                                                            <span className="ml-2">{r.name}</span>
                                                            <span className="ml-2" style={{ color: '#adb5bd' }}>({r.orderCount} orders)</span>
                                                        </span>
                                                        <span className="font-bold text-sm ml-4" style={{ color: '#714B67' }}>{r.qty} pcs</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-center mt-2 pt-2" style={{ borderTop: '2px solid #212529' }}>
                                                <span className="text-xs font-bold" style={{ color: '#212529' }}>GRAND TOTAL</span>
                                                <span className="font-bold text-base" style={{ color: '#714B67' }}>{grandTotal} pcs</span>
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
