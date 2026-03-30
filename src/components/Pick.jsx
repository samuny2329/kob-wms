import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShoppingCart, RefreshCw, ClipboardList, ChevronRight, ChevronLeft, CheckSquare, Box, Printer, X, ScanLine, Search, MapPin, List, LayoutGrid, Columns } from 'lucide-react';
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
    const getLocation = (sku) => inventory?.find(i => i.sku === sku)?.location || PRODUCT_CATALOG[sku]?.location || null;
    const [showPickingList, setShowPickingList] = useState(null);
    const [scanFlash, setScanFlash] = useState(null);
    const [debugScan, setDebugScan] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const listScanRef = useRef(null);
    const pendingOrdersRef = useRef([]);

    const pendingOrders = salesOrders.filter(o => o.status === 'pending' || o.status === 'picking');

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
    const generateBatchPickingList = () => setShowPickingList({ batch: true, orders: pendingOrders });

    // HTML escape to prevent XSS in print window
    const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // BiM-style print
    const handlePrint = () => {
        const orders = showPickingList.batch ? showPickingList.orders : [showPickingList];
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
        const total = orders.length;

        const pages = orders.map((order, idx) => {
            const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
            const platformName = pl?.name || order.platform || 'WMS';
            const storeName = 'KissMyBody';
            return `
<div class="page">
  <div class="page-header">
    <div class="page-title">[Pick] ${esc(platformName)} · ${esc(storeName)}</div>
    <div class="page-sub">${idx+1}/${total} &nbsp;|&nbsp; ${dateStr} &nbsp;|&nbsp; <strong>${esc(order.ref)}</strong>${order.customer ? ' · ' + esc(order.customer) : ''}</div>
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
      ${order.items.map((item, i) => {
          const loc = getLocation(item.sku);
          return `
      <tr>
        <td class="num">${i+1}</td>
        <td><div class="item-name">${esc(PRODUCT_CATALOG[item.sku]?.shortName || item.name)}</div><div class="item-sku">${esc(item.sku)}</div></td>
        <td class="${loc ? 'loc' : 'loc-miss'}">${loc || '-'}</td>
        <td class="qty">${item.expected}</td>
        <td class="check"></td>
      </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="footer">WMS Pro · ${dateStr}</div>
</div>`;
        }).join('');

        const barcodeInits = orders.map((order, idx) =>
            `JsBarcode("#bc-${idx}","${order.ref}",{format:"CODE128",width:1.8,height:40,displayValue:false,margin:1});`
        ).join('\n    ');

        const win = window.open('', '_blank', 'width=400,height=600');
        if (!win) return;
        win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Picking List</title>
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
${pages}
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
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div className="px-5 py-3 flex flex-wrap gap-3 justify-between items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded flex items-center justify-center text-white shrink-0" style={{ backgroundColor: '#714B67' }}>
                                <ShoppingCart className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold" style={{ color: '#212529' }}>Pick List</h2>
                                <p className="text-[11px]" style={{ color: '#6c757d' }}>{pendingOrders.length} orders waiting</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Odoo-style view switcher */}
                            <div className="flex items-center gap-0.5 rounded p-0.5" style={{ backgroundColor: '#e9ecef', border: '1px solid #dee2e6' }}>
                                {[
                                    { mode: 'list', icon: <List className="w-3.5 h-3.5" />, label: 'List' },
                                    { mode: 'kanban', icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Kanban' },
                                    { mode: 'card', icon: <Columns className="w-3.5 h-3.5" />, label: 'Card' },
                                ].map(v => (
                                    <button key={v.mode} onClick={() => setViewMode(v.mode)} title={v.label}
                                        className="p-1.5 rounded transition-colors"
                                        style={{ backgroundColor: viewMode === v.mode ? '#714B67' : 'transparent', color: viewMode === v.mode ? '#fff' : '#6c757d' }}>
                                        {v.icon}
                                    </button>
                                ))}
                            </div>
                            {pendingOrders.length > 0 && (
                                <button onClick={generateBatchPickingList} className="odoo-btn odoo-btn-secondary flex items-center gap-1.5">
                                    <Printer className="w-3.5 h-3.5" /> Print List
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sync loading banner */}
                    {isSyncingOrders && (
                        <div className="px-5 py-2 flex items-center gap-2" style={{ backgroundColor: '#e8f4fd', borderBottom: '1px solid #b8daff' }}>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: '#17a2b8' }} />
                            <p className="text-xs font-medium" style={{ color: '#17a2b8' }}>Loading orders from Odoo...</p>
                        </div>
                    )}

                    {/* Scan box */}
                    <div
                        className={`px-5 py-3 cursor-pointer transition-colors`}
                        style={{ borderBottom: '1px solid #dee2e6', backgroundColor: scanFlash === 'notfound' ? '#fff5f5' : '#fafafa' }}
                        onClick={() => listScanRef.current?.focus()}
                    >
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#adb5bd' }} />
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
                                onBlur={() => setTimeout(() => focusScanInput(listScanRef), 300)}
                                placeholder="Tap here, then scan Pick list barcode..."
                                className="w-full pl-9 pr-4 py-2 text-sm font-mono outline-none transition-all"
                                style={{
                                    border: `1px solid ${scanFlash === 'notfound' ? '#dc3545' : '#dee2e6'}`,
                                    borderRadius: '4px',
                                    backgroundColor: '#ffffff',
                                    color: '#212529',
                                }}
                            />
                            <ScanLine className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" style={{ color: '#714B67' }} />
                        </div>
                        {scanFlash === 'notfound' && debugScan && (
                            <div className="mt-2 p-2 rounded" style={{ backgroundColor: '#fff5f5', border: '1px solid #f5c6cb' }}>
                                <p className="text-xs font-semibold" style={{ color: '#dc3545' }}>Work order not found ({debugScan.count} orders)</p>
                                <p className="text-[10px] font-mono mt-0.5" style={{ color: '#dc3545' }}>Scanned: <span className="font-bold">"{debugScan.val}"</span></p>
                                <p className="text-[10px] font-mono" style={{ color: '#adb5bd' }}>First ref: "{debugScan.firstRef}"</p>
                                {onSyncOrders && (
                                    <button onClick={onSyncOrders} className="mt-1.5 text-[10px] underline" style={{ color: '#17a2b8' }}>
                                        Sync Orders again
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        {pendingOrders.length === 0 ? (
                            <div className="text-center py-16 flex flex-col items-center" style={{ color: '#adb5bd' }}>
                                <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No active picking tasks</p>
                            </div>
                        ) : (
                            <>
                            {/* ── LIST VIEW ── */}
                            {viewMode === 'list' && (
                                <div>
                                    {pendingOrders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(order => {
                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                        const isFlash = scanFlash === order.id;
                                        return (
                                            <div key={order.id} className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                                                style={{ borderBottom: '1px solid #f1f3f5', backgroundColor: isFlash ? '#f9f5f8' : '#ffffff' }}
                                                onMouseEnter={e => { if (!isFlash) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                                                onMouseLeave={e => { if (!isFlash) e.currentTarget.style.backgroundColor = '#ffffff'; }}>
                                                <div className="flex items-center gap-3 flex-1" onClick={() => setSelectedPickOrder(order)}>
                                                    {pl ? <PlatformBadge name={order.courier || order.platform} size={32} /> : (() => { const av = getAvatarColor(order.customer || order.ref); return <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: av.bg, color: av.text }}>{(order.customer || order.ref || '?')[0].toUpperCase()}</div>; })()}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <h3 className="font-semibold text-sm" style={{ color: '#212529' }}>{order.ref}</h3>
                                                            <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
                                                        </div>
                                                        <p className="text-xs truncate" style={{ color: '#6c757d' }}>{order.customer} &bull; {order.items.reduce((s, i) => s + i.expected, 0)} items</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={(e) => { e.stopPropagation(); generatePickingList(order); }} className="p-1.5 rounded transition-colors" style={{ color: '#adb5bd' }} title="Print Picking List"><Printer className="w-4 h-4" /></button>
                                                    <ChevronRight className="w-4 h-4" style={{ color: '#dee2e6' }} />
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
                                        { status: 'pending', label: 'Pending', color: '#ffac00', borderColor: '#ffac00' },
                                        { status: 'picking', label: 'In Progress', color: '#17a2b8', borderColor: '#17a2b8' },
                                        { status: 'picked', label: 'Picked', color: '#714B67', borderColor: '#714B67' },
                                    ].map(col => {
                                        const colOrders = pendingOrders.filter(o => o.status === col.status);
                                        return (
                                            <div key={col.status} className="flex-1 min-w-[220px] rounded-lg flex flex-col" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                                                <div className="px-3 py-2.5 flex items-center gap-2 rounded-t-lg" style={{ borderBottom: `3px solid ${col.borderColor}` }}>
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                                                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#212529' }}>{col.label}</span>
                                                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#dee2e6', color: '#6c757d' }}>{colOrders.length}</span>
                                                </div>
                                                <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '500px' }}>
                                                    {colOrders.map(order => {
                                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                                        const itemCount = order.items.reduce((s, i) => s + i.expected, 0);
                                                        return (
                                                            <div key={order.id} onClick={() => setSelectedPickOrder(order)}
                                                                className="rounded-lg p-3 cursor-pointer transition-all hover:shadow-md"
                                                                style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderLeft: `3px solid ${col.borderColor}` }}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-bold" style={{ color: '#212529' }}>{order.ref}</span>
                                                                    {pl && <PlatformBadge name={order.courier || order.platform} size={20} />}
                                                                </div>
                                                                <p className="text-[11px] truncate mb-2" style={{ color: '#6c757d' }}>{order.customer}</p>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-medium" style={{ color: '#714B67' }}>{itemCount} items &bull; {order.items.length} SKUs</span>
                                                                    <ChevronRight className="w-3 h-3" style={{ color: '#dee2e6' }} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {colOrders.length === 0 && <div className="text-center py-8 text-xs" style={{ color: '#adb5bd' }}>No orders</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── CARD VIEW (grid) ── */}
                            {viewMode === 'card' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                                    {pendingOrders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(order => {
                                        const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                        const itemCount = order.items.reduce((s, i) => s + i.expected, 0);
                                        const picked = order.items.reduce((s, i) => s + (i.picked || 0), 0);
                                        const progress = itemCount > 0 ? Math.round((picked / itemCount) * 100) : 0;
                                        const statusColors = { pending: '#ffac00', picking: '#17a2b8', picked: '#714B67' };
                                        return (
                                            <div key={order.id} onClick={() => setSelectedPickOrder(order)}
                                                className="rounded-lg cursor-pointer transition-all hover:shadow-md overflow-hidden"
                                                style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6' }}>
                                                <div className="h-1" style={{ backgroundColor: statusColors[order.status] || '#dee2e6' }} />
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="text-sm font-bold" style={{ color: '#212529' }}>{order.ref}</h3>
                                                        <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        {pl ? <PlatformBadge name={order.courier || order.platform} size={24} /> : (() => { const av = getAvatarColor(order.customer || order.ref); return <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: av.bg, color: av.text }}>{(order.customer || '?')[0].toUpperCase()}</div>; })()}
                                                        <span className="text-xs truncate" style={{ color: '#6c757d' }}>{order.customer}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                                                            <div className="text-sm font-bold" style={{ color: '#714B67' }}>{itemCount}</div>
                                                            <div className="text-[9px] uppercase tracking-wider" style={{ color: '#adb5bd' }}>Items</div>
                                                        </div>
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                                                            <div className="text-sm font-bold" style={{ color: '#017E84' }}>{order.items.length}</div>
                                                            <div className="text-[9px] uppercase tracking-wider" style={{ color: '#adb5bd' }}>SKUs</div>
                                                        </div>
                                                        <div className="text-center py-1.5 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                                                            <div className="text-sm font-bold" style={{ color: progress === 100 ? '#28a745' : '#ffac00' }}>{progress}%</div>
                                                            <div className="text-[9px] uppercase tracking-wider" style={{ color: '#adb5bd' }}>Done</div>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e9ecef' }}>
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#28a745' : '#714B67' }} />
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
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        <button onClick={() => setSelectedPickOrder(null)} className="text-sm font-medium flex items-center gap-1 transition-colors" style={{ color: '#714B67' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#5a3d52'}
                            onMouseLeave={e => e.currentTarget.style.color = '#714B67'}
                        >
                            <ChevronLeft className="w-4 h-4" /> Pick List
                        </button>
                        <div className="flex items-center gap-2">
                            <button onClick={() => generatePickingList(selectedPickOrder)} className="p-1.5 rounded transition-colors" style={{ color: '#6c757d' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#714B67'; e.currentTarget.style.backgroundColor = '#f0e8ed'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#6c757d'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                title="Print">
                                <Printer className="w-4 h-4" />
                            </button>
                            <span className="font-mono font-semibold text-sm px-2.5 py-1" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', color: '#212529' }}>
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
                                <ScanLine className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#dee2e6' }} />
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest mt-2 animate-pulse" style={{ color: '#adb5bd' }}>Waiting for barcode scan...</p>
                        </div>
                        <div className="space-y-1.5">
                            {selectedPickOrder.items.map((item, idx) => {
                                const isComplete = item.picked === item.expected;
                                const catalog = PRODUCT_CATALOG[item.sku];
                                return (
                                    <div key={idx} className="p-3 flex items-center gap-3 transition-all rounded" style={{
                                        border: `1px solid ${isComplete ? '#b8e0c4' : '#dee2e6'}`,
                                        backgroundColor: isComplete ? '#f0fdf4' : '#ffffff',
                                    }}>
                                        <div className="w-11 h-11 rounded overflow-hidden shrink-0" style={{ border: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                            {catalog?.image ? (
                                                <img src={catalog.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center" style={{ color: '#dee2e6' }}><Box className="w-4 h-4" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: isComplete ? '#28a745' : '#212529' }}>{catalog?.shortName || item.name}</p>
                                            <p className="text-[10px] font-mono uppercase" style={{ color: '#adb5bd' }}>{item.sku}</p>
                                            {getLocation(item.sku) && (
                                                <p className="text-[11px] font-bold flex items-center gap-1 mt-0.5" style={{ color: '#ffac00' }}>
                                                    <MapPin className="w-3 h-3" />{getLocation(item.sku)}
                                                </p>
                                            )}
                                            {!getLocation(item.sku) && item.barcode && (
                                                <p className="text-[10px] font-mono" style={{ color: '#dee2e6' }}>{item.barcode}</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0 flex items-center gap-2">
                                            {isComplete && <CheckSquare className="w-4 h-4" style={{ color: '#28a745' }} />}
                                            <div>
                                                <span className="text-xl font-bold tabular-nums" style={{ color: isComplete ? '#28a745' : '#212529' }}>{item.picked}</span>
                                                <span className="mx-0.5" style={{ color: '#dee2e6' }}>/</span>
                                                <span className="text-sm font-semibold" style={{ color: '#6c757d' }}>{item.expected}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Print Picking List Modal */}
            {showPickingList && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in" style={{ backgroundColor: 'rgba(33,37,41,0.55)' }}>
                    <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#212529' }}>
                                <Printer className="w-4 h-4" style={{ color: '#714B67' }} /> Picking List (BiM Format)
                            </h2>
                            <button onClick={() => setShowPickingList(null)} className="p-1 rounded transition-colors hover:bg-gray-200" style={{ color: '#6c757d' }}><X className="w-4 h-4" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar font-mono text-sm">
                            {(() => {
                                const orders = showPickingList.batch ? showPickingList.orders : [showPickingList];
                                const total = orders.length;
                                const today = new Date();
                                const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
                                return orders.map((order, idx) => {
                                    const pl = PLATFORM_LABELS[order.courier] || PLATFORM_LABELS[order.platform];
                                    return (
                                        <div key={idx} className="mb-6 pb-5 last:border-0" style={{ borderBottom: '2px dashed #dee2e6' }}>
                                            <div className="font-bold text-sm" style={{ color: '#212529' }}>[Picking List] {pl?.name || order.platform}_KissMyBody</div>
                                            <div className="text-xs mt-0.5" style={{ color: '#6c757d' }}>Set_NO No.{idx+1} / Total {total}</div>
                                            <div className="mt-2 px-3 py-1.5 rounded inline-block text-xs tracking-widest font-mono" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', color: '#212529' }}>{order.ref}</div>
                                            <div className="text-xs mt-1 mb-3" style={{ color: '#6c757d' }}>{order.customer && `Customer: ${order.customer}`}</div>
                                            <div className="space-y-1 mb-3">
                                                {order.items.map((item, i) => {
                                                    const loc = getLocation(item.sku);
                                                    return (
                                                    <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid #f1f3f5' }}>
                                                        <span className="text-xs" style={{ color: '#495057' }}>
                                                            {PRODUCT_CATALOG[item.sku]?.shortName || item.name}
                                                            {loc && <span className="ml-2 font-bold" style={{ color: '#ffac00' }}>[{loc}]</span>}
                                                        </span>
                                                        <span className="font-bold text-sm ml-4" style={{ color: '#212529' }}>{item.sku}~{item.expected}</span>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="text-[10px] text-center italic mt-3" style={{ color: '#adb5bd' }}>
                                                [Operation Date {dateStr}]<br/>Power By WMS Pro @ Since {Date.now()} UnixTimeStamp
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
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
