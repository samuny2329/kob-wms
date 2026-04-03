import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gift, Plus, Upload, Download, Trash2, Edit3, Printer, Search, X, Check, Package, BarChart2, AlertTriangle, Camera, FileSpreadsheet, Tag, ChevronDown, ChevronUp, Hash, Save, Loader2, RefreshCw, Database } from 'lucide-react';
import { PRODUCT_CATALOG } from '../constants';
import { fetchProductCategories, fetchProductBrands, fetchAllLocations, fetchProducts, createGWPProduct, setGWPInitialStock } from '../services/odooApi';

// ─── Config ──────────────────────────────────────────────────────────────────
const LS_KEY = 'wms_gwp_products';
const GWP_PREFIX = 'GWP';
// Fallback categories (used when Odoo is offline)
const FALLBACK_CATEGORIES = [
    { id: 'sample', label: 'Sample / Sachet', icon: '🧴' },
    { id: 'mini', label: 'Mini Size', icon: '🧪' },
    { id: 'gift', label: 'Gift / Premium', icon: '🎁' },
    { id: 'accessory', label: 'Accessory (Bag, Pouch)', icon: '👜' },
    { id: 'print', label: 'Print (Card, Sticker)', icon: '🏷️' },
    { id: 'bundle', label: 'Bundle / Set', icon: '📦' },
    { id: 'other', label: 'Other', icon: '📋' },
];
const FALLBACK_BRANDS = ['SKINOXY', 'KISS-MY-BODY', 'Other'];
const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

// ─── Barcode Generation (Code128-B SVG) ─────────────────────────────────────
const CODE128B = {
    START: [2,1,1,1,4,1], STOP: [2,3,3,1,1,1,2],
    chars: (() => {
        const patterns = [
            [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
            [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
            [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
            [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
            [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
            [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
            [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
            [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
            [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
            [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
            [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
            [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
            [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
            [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
            [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
            [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
            [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
            [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
            [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
            [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
            [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],
            [2,1,1,2,3,2],
        ];
        const map = {};
        for (let i = 0; i < 95; i++) map[String.fromCharCode(32 + i)] = { idx: i, bars: patterns[i] };
        return map;
    })(),
};

function escapeXml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function generateBarcodeSVG(text, w = 260, h = 60) {
    if (!text) return null;
    // Validate SVG dimensions to prevent DoS via excessively large values
    const safeW = (Number.isFinite(w) && w > 0 && w <= 2000) ? w : 260;
    const safeH = (Number.isFinite(h) && h > 0 && h <= 2000) ? h : 60;
    w = safeW;
    h = safeH;
    // Sanitize text to prevent XSS in SVG output
    const safeText = escapeXml(text);
    const encode = [];
    encode.push(...CODE128B.START);
    let checksum = 104; // START B value
    for (let i = 0; i < text.length; i++) {
        const ch = CODE128B.chars[text[i]];
        if (!ch) continue;
        encode.push(...ch.bars);
        checksum += ch.idx * (i + 1);
    }
    // checksum char
    const csIdx = checksum % 103;
    const csPatterns = Object.values(CODE128B.chars);
    if (csIdx < csPatterns.length) encode.push(...csPatterns[csIdx].bars);
    encode.push(...CODE128B.STOP);

    const totalUnits = encode.reduce((s, v) => s + v, 0);
    const barW = w / totalUnits;
    let rects = '', x = 0;
    for (let i = 0; i < encode.length; i++) {
        const bw = encode[i] * barW;
        if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${bw}" height="${h}" fill="#000"/>`;
        x += bw;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h + 18}" width="${w}" height="${h + 18}">
        <rect width="${w}" height="${h + 18}" fill="white"/>
        ${rects}
        <text x="${w / 2}" y="${h + 14}" text-anchor="middle" font-family="monospace" font-size="11" fill="#000">${safeText}</text>
    </svg>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadGwpProducts() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveGwpProducts(items) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
}
function getNextSku(items) {
    const nums = items.map(i => {
        const m = i.sku?.match(/GWP-(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `${GWP_PREFIX}-${String(max + 1).padStart(4, '0')}`;
}
function generateBarcode13(sku) {
    // Generate a pseudo-EAN-13 from SKU for scanning
    if (!sku || typeof sku !== 'string') return '0000000000000';
    const hash = sku.split('').reduce((h, c, i) => h + c.charCodeAt(0) * (i + 1), 0);
    const base = '885999' + String(hash % 1000000).padStart(6, '0');
    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return base + check;
}

// ─── Print Label ─────────────────────────────────────────────────────────────
function printLabel(item) {
    const svgBarcode = generateBarcodeSVG(item.sku, 240, 50);
    const win = window.open('', '_blank', 'width=400,height=350');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Label — ${item.sku}</title>
    <style>
        @page { size: 60mm 40mm; margin: 2mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 8px; }
        .label { border: 1px dashed #ccc; padding: 8px; width: 220px; text-align: center; }
        .sku { font-size: 16px; font-weight: 900; letter-spacing: 1px; margin-bottom: 4px; }
        .name { font-size: 10px; color: #555; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
        .barcode svg { width: 200px; height: 55px; }
        .meta { font-size: 8px; color: #999; margin-top: 4px; }
    </style></head><body>
    <div class="label">
        <div class="sku">${escapeXml(item.sku)}</div>
        <div class="name">${escapeXml(item.name)}</div>
        <div class="barcode">${svgBarcode || ''}</div>
        <div class="meta">${escapeXml(item.brand)} | ${escapeXml(item.category)}</div>
    </div>
    <script>setTimeout(() => { window.print(); }, 300);</script>
    </body></html>`);
    win.document.close();
}

function printBatchLabels(items) {
    if (!items.length) return;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const labels = items.map(item => {
        const svg = generateBarcodeSVG(item.sku, 200, 45);
        return `<div class="label">
            <div class="sku">${escapeXml(item.sku)}</div>
            <div class="name">${escapeXml(item.name)}</div>
            <div class="barcode">${svg || ''}</div>
            <div class="meta">${item.brand} | Qty: ${item.qty}</div>
        </div>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Batch Labels</title>
    <style>
        @page { margin: 5mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .label { border: 1px dashed #ccc; padding: 8px; text-align: center; page-break-inside: avoid; }
        .sku { font-size: 14px; font-weight: 900; letter-spacing: 1px; margin-bottom: 2px; }
        .name { font-size: 9px; color: #555; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .barcode svg { width: 170px; height: 50px; }
        .meta { font-size: 8px; color: #999; margin-top: 2px; }
    </style></head><body>
    <div class="grid">${labels}</div>
    <script>setTimeout(() => { window.print(); }, 400);</script>
    </body></html>`);
    win.document.close();
}

// ─── CSV Template & Parser ───────────────────────────────────────────────────
function downloadTemplate() {
    const headers = 'name,brand,category,qty,location,description';
    const example = [
        'Cream Sample 5ml,SKINOXY,sample,100,G-01-01,Free cream sachet',
        'Fabric Bag,KISS-MY-BODY,accessory,50,G-01-02,Branded tote bag',
        'Sheet Mask 1pc,SKINOXY,sample,200,G-02-01,Single mask sheet',
    ].join('\n');
    const csv = '\uFEFF' + headers + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'gwp_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => row[h] = vals[i] || '');
        return row;
    }).filter(r => r.name);
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function GWPManager({ inventory, addToast, logActivity, user, apiConfigs }) {
    const [items, setItems] = useState(loadGwpProducts);
    const [tab, setTab] = useState('list'); // list | add | import
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [sortBy, setSortBy] = useState('created'); // created | name | sku | qty
    const [sortDir, setSortDir] = useState('desc');
    const [filterCat, setFilterCat] = useState('all');
    const fileInputRef = useRef(null);

    // Odoo master data
    const [odooCategories, setOdooCategories] = useState([]);
    const [odooBrands, setOdooBrands] = useState([]);
    const [odooLocations, setOdooLocations] = useState([]);
    const [odooProducts, setOdooProducts] = useState([]);
    const [isLoadingOdoo, setIsLoadingOdoo] = useState(false);
    const [odooConnected, setOdooConnected] = useState(false);
    const [isSavingToOdoo, setIsSavingToOdoo] = useState(false);

    // Merged lists (Odoo data + fallback)
    const CATEGORIES = odooCategories.length > 0
        ? odooCategories.map(c => ({ id: String(c.id), label: c.complete_name || c.name, icon: '📂', odooId: c.id }))
        : FALLBACK_CATEGORIES;
    const BRANDS = odooBrands.length > 0 ? [...odooBrands, 'Other'] : FALLBACK_BRANDS;
    const LOCATIONS = odooLocations.length > 0
        ? odooLocations.map(l => ({ id: l.id, name: l.complete_name || l.name }))
        : [];

    // Form state
    const [form, setForm] = useState({ name: '', brand: 'SKINOXY', category: FALLBACK_CATEGORIES[0].id, qty: '', location: '', locationId: null, description: '', photo: null });
    // Import state
    const [importRows, setImportRows] = useState([]);
    const [importFile, setImportFile] = useState(null);

    // Persist
    useEffect(() => { saveGwpProducts(items); }, [items]);

    // Load Odoo master data on mount
    const loadOdooData = useCallback(async () => {
        const odooConfig = apiConfigs?.odoo;
        if (!odooConfig?.url) return;
        setIsLoadingOdoo(true);
        try {
            const [cats, brands, locs, prods] = await Promise.all([
                fetchProductCategories(odooConfig),
                fetchProductBrands(odooConfig),
                fetchAllLocations(odooConfig),
                fetchProducts(odooConfig),
            ]);
            if (cats?.length) setOdooCategories(cats);
            if (brands?.length) setOdooBrands(brands);
            if (locs?.length) setOdooLocations(locs);
            if (prods?.length) setOdooProducts(prods);
            setOdooConnected(true);
        } catch {
            setOdooConnected(false);
        }
        setIsLoadingOdoo(false);
    }, [apiConfigs]);

    useEffect(() => { loadOdooData(); }, [loadOdooData]);

    // ─── Quick Register ──────────────────────────────────────────────────────
    const resetForm = () => setForm({ name: '', brand: BRANDS[0] || 'SKINOXY', category: CATEGORIES[0]?.id || 'sample', qty: '', location: '', locationId: null, description: '', photo: null });

    const handlePhotoCapture = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_PHOTO_SIZE) { addToast('Photo too large (max 2MB)', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setForm(f => ({ ...f, photo: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { addToast('Please enter item name', 'error'); return; }
        if (!form.qty || parseInt(form.qty) <= 0) { addToast('Please enter valid quantity', 'error'); return; }

        if (editingId) {
            // Update existing
            setItems(prev => prev.map(i => i.id === editingId ? {
                ...i, name: form.name.trim(), brand: form.brand, category: form.category,
                qty: parseInt(form.qty), location: form.location.trim(), description: form.description.trim(),
                photo: form.photo, updatedAt: Date.now(),
            } : i));
            addToast(`Updated ${form.name}`, 'success');
            logActivity?.('gwp_update', `Updated GWP: ${form.name}`);
            setEditingId(null);
        } else {
            // Create new
            const sku = getNextSku(items);
            const barcode = generateBarcode13(sku);
            const locationName = form.location?.trim() || `G-${String(items.length + 1).padStart(2, '0')}-01`;
            const newItem = {
                id: `gwp-${Date.now()}`, sku, barcode,
                name: form.name.trim(), brand: form.brand, category: form.category,
                qty: parseInt(form.qty), location: locationName, locationId: form.locationId,
                description: form.description.trim(), photo: form.photo,
                odooId: null, odooSynced: false,
                createdAt: Date.now(), updatedAt: Date.now(), createdBy: user?.username || 'system',
            };

            // Sync to Odoo if connected
            const odooConfig = apiConfigs?.odoo;
            if (odooConfig?.url && odooConnected) {
                setIsSavingToOdoo(true);
                try {
                    const catId = CATEGORIES.find(c => c.id === form.category)?.odooId || null;
                    const result = await createGWPProduct(odooConfig, {
                        name: `[${sku}] ${form.name.trim()}`,
                        sku, barcode, categoryId: catId,
                        weight: 0, listPrice: 0,
                        description: form.description.trim(),
                    });
                    if (result.status === 'success') {
                        newItem.odooId = result.id;
                        newItem.odooSynced = true;
                        // Set initial stock
                        if (form.locationId) {
                            await setGWPInitialStock(odooConfig, { productId: result.id, locationId: form.locationId, qty: parseInt(form.qty) });
                        }
                    }
                } catch (e) {
                    console.warn('Odoo sync failed, saved locally:', e);
                }
                setIsSavingToOdoo(false);
            }

            setItems(prev => [newItem, ...prev]);
            const syncLabel = newItem.odooSynced ? ' (synced to Odoo)' : '';
            addToast(`Registered ${sku} — ${form.name}${syncLabel}`, 'success');
            logActivity?.('gwp_create', `Created GWP: ${sku} — ${form.name} (x${form.qty})${syncLabel}`);
        }
        resetForm();
        setTab('list');
    };

    const handleEdit = (item) => {
        setForm({ name: item.name, brand: item.brand, category: item.category, qty: String(item.qty), location: item.location, description: item.description || '', photo: item.photo || null });
        setEditingId(item.id);
        setTab('add');
    };

    const handleDelete = (ids) => {
        const toDelete = Array.isArray(ids) ? ids : [ids];
        const names = items.filter(i => toDelete.includes(i.id)).map(i => i.sku).join(', ');
        setItems(prev => prev.filter(i => !toDelete.includes(i.id)));
        setSelectedIds([]);
        addToast(`Deleted: ${names}`, 'success');
        logActivity?.('gwp_delete', `Deleted GWP: ${names}`);
    };

    // ─── Batch Import ────────────────────────────────────────────────────────
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFile(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const rows = parseCSV(ev.target.result);
            setImportRows(rows);
        };
        reader.readAsText(file);
    };

    const handleImportConfirm = () => {
        if (!importRows.length) return;
        const newItems = importRows.map((row, idx) => {
            const sku = getNextSkuFrom(items, idx);
            return {
                id: `gwp-${Date.now()}-${idx}`, sku, barcode: generateBarcode13(sku),
                name: row.name, brand: row.brand || 'Other', category: row.category || 'other',
                qty: parseInt(row.qty) || 1, location: row.location || `G-${String(items.length + idx + 1).padStart(2, '0')}-01`,
                description: row.description || '', photo: null,
                createdAt: Date.now(), updatedAt: Date.now(), createdBy: user?.username || 'system',
            };
        });
        setItems(prev => [...newItems, ...prev]);
        addToast(`Imported ${newItems.length} GWP items`, 'success');
        logActivity?.('gwp_import', `Batch imported ${newItems.length} GWP items`);
        setImportRows([]);
        setImportFile(null);
        setTab('list');
    };

    // Helper for batch import SKU generation
    function getNextSkuFrom(existingItems, batchIndex) {
        const nums = existingItems.map(i => {
            const m = i.sku?.match(/GWP-(\d+)/);
            return m ? parseInt(m[1], 10) : 0;
        });
        const max = nums.length > 0 ? Math.max(...nums) : 0;
        return `${GWP_PREFIX}-${String(max + 1 + batchIndex).padStart(4, '0')}`;
    }

    // ─── Export current list ─────────────────────────────────────────────────
    const exportCSV = () => {
        if (!items.length) { addToast('No items to export', 'error'); return; }
        const headers = 'SKU,Barcode,Name,Brand,Category,Qty,Location,Description,Created';
        const rows = items.map(i => [i.sku, i.barcode, `"${i.name}"`, i.brand, i.category, i.qty, i.location, `"${i.description || ''}"`, new Date(i.createdAt).toLocaleDateString()].join(','));
        const csv = '\uFEFF' + headers + '\n' + rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `gwp_products_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Filtered & Sorted ───────────────────────────────────────────────────
    const filtered = items.filter(i => {
        if (filterCat !== 'all' && i.category !== filterCat) return false;
        if (search) {
            const q = search.toLowerCase();
            return i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.barcode?.includes(q) || i.brand?.toLowerCase().includes(q);
        }
        return true;
    }).sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
        if (sortBy === 'sku') return a.sku.localeCompare(b.sku) * dir;
        if (sortBy === 'qty') return (a.qty - b.qty) * dir;
        return (a.createdAt - b.createdAt) * dir;
    });

    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);
    const catCounts = items.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {});

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Gift className="w-6 h-6 text-[var(--odoo-purple)]" />
                        GWP Manager
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Gift With Purchase — Register, barcode & manage freebie items</p>
                    <div className="flex items-center gap-2 mt-1">
                        {odooConnected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                                <Database className="w-3 h-3" /> Odoo Connected — {odooCategories.length} categories, {odooLocations.length} locations
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                <Database className="w-3 h-3" /> Offline mode (local data)
                            </span>
                        )}
                        {isLoadingOdoo && <Loader2 className="w-3.5 h-3.5 text-[var(--odoo-purple)] animate-spin" />}
                        <button onClick={loadOdooData} className="p-1 text-gray-400 hover:text-[var(--odoo-purple)] transition-colors" title="Refresh Odoo data">
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button onClick={() => { printBatchLabels(selectedIds.length > 0 ? items.filter(i => selectedIds.includes(i.id)) : items); }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Printer className="w-4 h-4" /> Print Labels
                    </button>
                </div>
            </div>

            {/* Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Items', value: items.length, icon: Package, color: 'var(--odoo-purple)' },
                    { label: 'Total Qty', value: totalQty.toLocaleString(), icon: Hash, color: '#00A09D' },
                    { label: 'Categories', value: Object.keys(catCounts).length, icon: Tag, color: '#2563eb' },
                    { label: 'Low Stock (<10)', value: items.filter(i => i.qty < 10).length, icon: AlertTriangle, color: '#dc2626' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                            <s.icon className="w-5 h-5" style={{ color: s.color }} />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-gray-800">{s.value}</p>
                            <p className="text-[11px] text-gray-500">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Buttons */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {[
                    { id: 'list', label: 'GWP List', icon: Package },
                    { id: 'add', label: editingId ? 'Edit Item' : 'Quick Register', icon: Plus },
                    { id: 'import', label: 'Batch Import', icon: Upload },
                ].map(t => (
                    <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'add' && !editingId) resetForm(); }}
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-all ${tab === t.id ? 'bg-white shadow text-[var(--odoo-purple)]' : 'text-gray-600 hover:text-gray-800'}`}>
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            {/* ─── TAB: GWP List ────────────────────────────────────────────── */}
            {tab === 'list' && (
                <div className="space-y-3">
                    {/* Search & Filter Bar */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, barcode..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[var(--odoo-purple)] focus:ring-1 focus:ring-[var(--odoo-purple)] outline-none" />
                        </div>
                        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-[var(--odoo-purple)] outline-none">
                            <option value="all">All Categories</option>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                        </select>
                        {selectedIds.length > 0 && (
                            <button onClick={() => handleDelete(selectedIds)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                                <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                            </button>
                        )}
                    </div>

                    {/* Items Table */}
                    {filtered.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                            <Gift className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No GWP items yet</p>
                            <p className="text-sm text-gray-400 mt-1">Use Quick Register or Batch Import to add items</p>
                            <button onClick={() => setTab('add')} className="mt-4 px-4 py-2 bg-[var(--odoo-purple)] text-white rounded-lg text-sm font-medium hover:bg-[var(--odoo-purple-dark)] transition-colors">
                                <Plus className="w-4 h-4 inline mr-1" /> Register First Item
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-[32px_1fr_90px_70px_60px_70px_80px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <div>
                                    <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0}
                                        onChange={e => setSelectedIds(e.target.checked ? filtered.map(i => i.id) : [])}
                                        className="w-4 h-4 rounded accent-[var(--odoo-purple)]" />
                                </div>
                                <button onClick={() => { setSortBy('name'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }} className="text-left flex items-center gap-1 hover:text-gray-700">
                                    Item {sortBy === 'name' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                </button>
                                <button onClick={() => { setSortBy('sku'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }} className="text-left flex items-center gap-1 hover:text-gray-700">
                                    SKU {sortBy === 'sku' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                </button>
                                <div>Category</div>
                                <button onClick={() => { setSortBy('qty'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }} className="text-left flex items-center gap-1 hover:text-gray-700">
                                    Qty {sortBy === 'qty' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                </button>
                                <div>Location</div>
                                <div className="text-right">Actions</div>
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                                {filtered.map(item => {
                                    const cat = CATEGORIES.find(c => c.id === item.category);
                                    return (
                                        <div key={item.id} className={`grid grid-cols-[32px_1fr_90px_70px_60px_70px_80px] gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors ${selectedIds.includes(item.id) ? 'bg-purple-50' : ''}`}>
                                            <div>
                                                <input type="checkbox" checked={selectedIds.includes(item.id)}
                                                    onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))}
                                                    className="w-4 h-4 rounded accent-[var(--odoo-purple)]" />
                                            </div>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {item.photo ? (
                                                    <img src={item.photo} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg">{cat?.icon || '📦'}</div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                                                    <p className="text-[10px] text-gray-400">
                                                        {item.brand} | {item.barcode}
                                                        {item.odooSynced && <span className="ml-1 text-green-600" title={`Odoo ID: ${item.odooId}`}>&#x2713; Odoo</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="px-2 py-0.5 bg-[var(--odoo-purple-light)] text-[var(--odoo-purple)] rounded font-mono text-xs font-bold">{item.sku}</span>
                                            </div>
                                            <div className="text-xs text-gray-600">{cat?.icon} {cat?.label?.split(' ')[0] || item.category}</div>
                                            <div className={`text-sm font-bold ${item.qty < 10 ? 'text-red-500' : 'text-gray-800'}`}>
                                                {item.qty.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono">{item.location}</div>
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors" title="Edit">
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => printLabel(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[var(--odoo-purple)] transition-colors" title="Print Label">
                                                    <Printer className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB: Quick Register ──────────────────────────────────────── */}
            {tab === 'add' && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl space-y-4">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        {editingId ? <Edit3 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-[var(--odoo-purple)]" />}
                        {editingId ? 'Edit GWP Item' : 'Quick Register'}
                    </h3>

                    {!editingId && (
                        <div className="bg-[var(--odoo-purple-lighter)] rounded-lg p-3 flex items-start gap-2">
                            <Tag className="w-4 h-4 text-[var(--odoo-purple)] mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-[var(--odoo-purple)]">Auto-generated: SKU <span className="font-mono font-bold">{getNextSku(items)}</span></p>
                                <p className="text-xs text-gray-500 mt-0.5">Barcode will be generated automatically from SKU</p>
                            </div>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Cream Sample 5ml, Fabric Bag, Sheet Mask 1pc"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[var(--odoo-purple)] focus:ring-1 focus:ring-[var(--odoo-purple)] outline-none" />
                    </div>

                    {/* Brand + Category */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Brand {odooConnected && <span className="text-[10px] text-green-600 font-normal">(Odoo)</span>}
                            </label>
                            <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:border-[var(--odoo-purple)] outline-none">
                                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category {odooConnected && <span className="text-[10px] text-green-600 font-normal">(Odoo)</span>}
                            </label>
                            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:border-[var(--odoo-purple)] outline-none">
                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Qty + Location */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                            <input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                                placeholder="100"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[var(--odoo-purple)] focus:ring-1 focus:ring-[var(--odoo-purple)] outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Location {odooConnected && LOCATIONS.length > 0 && <span className="text-[10px] text-green-600 font-normal">(Odoo)</span>}
                            </label>
                            {LOCATIONS.length > 0 ? (
                                <select value={form.locationId || ''} onChange={e => {
                                    const loc = LOCATIONS.find(l => l.id === parseInt(e.target.value));
                                    setForm(f => ({ ...f, locationId: loc?.id || null, location: loc?.name || '' }));
                                }}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:border-[var(--odoo-purple)] outline-none">
                                    <option value="">-- Select Location --</option>
                                    {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            ) : (
                                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                    placeholder="G-01-01 (auto if empty)"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[var(--odoo-purple)] focus:ring-1 focus:ring-[var(--odoo-purple)] outline-none" />
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={2} placeholder="Brief description for this GWP item..."
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:border-[var(--odoo-purple)] focus:ring-1 focus:ring-[var(--odoo-purple)] outline-none" />
                    </div>

                    {/* Photo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
                        <div className="flex items-center gap-3">
                            {form.photo ? (
                                <div className="relative">
                                    <img src={form.photo} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                                    <button onClick={() => setForm(f => ({ ...f, photo: null }))}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--odoo-purple)] hover:bg-purple-50/30 transition-colors">
                                    <Camera className="w-5 h-5 text-gray-400" />
                                    <span className="text-[10px] text-gray-400 mt-1">Add Photo</span>
                                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                                </label>
                            )}
                            <div className="text-xs text-gray-400">
                                <p>Max 2MB, JPG/PNG</p>
                                <p>On mobile: tap to use camera</p>
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <button onClick={handleSave} disabled={isSavingToOdoo}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--odoo-purple)] text-white rounded-lg text-sm font-bold hover:bg-[var(--odoo-purple-dark)] transition-colors disabled:opacity-50">
                            {isSavingToOdoo ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            {editingId ? 'Save Changes' : 'Register & Create Barcode'}
                        </button>
                        {!editingId && (
                            <button onClick={() => { handleSave(); setTimeout(() => { setTab('list'); const last = items[0]; if (last) printLabel(last); }, 100); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--odoo-purple)] text-[var(--odoo-purple)] rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors">
                                <Printer className="w-4 h-4" /> Register & Print
                            </button>
                        )}
                        <button onClick={() => { resetForm(); setEditingId(null); setTab('list'); }}
                            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                </div>
            )}

            {/* ─── TAB: Batch Import ────────────────────────────────────────── */}
            {tab === 'import' && (
                <div className="space-y-4 max-w-3xl">
                    {/* Download Template */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-3">
                            <FileSpreadsheet className="w-5 h-5 text-green-600" /> Step 1: Download Template
                        </h3>
                        <p className="text-sm text-gray-500 mb-3">Download the CSV template, fill in your GWP items, then upload below.</p>
                        <button onClick={downloadTemplate}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                            <Download className="w-4 h-4" /> Download Template (CSV)
                        </button>
                        <div className="mt-3 text-xs text-gray-400">
                            <p>Columns: <span className="font-mono">name, brand, category, qty, location, description</span></p>
                            <p>Categories: {CATEGORIES.map(c => c.id).join(', ')}</p>
                        </div>
                    </div>

                    {/* Upload */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-3">
                            <Upload className="w-5 h-5 text-blue-600" /> Step 2: Upload CSV
                        </h3>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700 transition-colors">
                                <Upload className="w-4 h-4" /> Choose File
                                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileSelect} className="hidden" />
                            </label>
                            {importFile && <span className="text-sm text-gray-600">{importFile}</span>}
                        </div>
                    </div>

                    {/* Preview */}
                    {importRows.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-3">
                                <Package className="w-5 h-5 text-[var(--odoo-purple)]" /> Step 3: Preview & Confirm ({importRows.length} items)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                                            <th className="text-left py-2 pr-3">SKU (auto)</th>
                                            <th className="text-left py-2 pr-3">Name</th>
                                            <th className="text-left py-2 pr-3">Brand</th>
                                            <th className="text-left py-2 pr-3">Category</th>
                                            <th className="text-right py-2 pr-3">Qty</th>
                                            <th className="text-left py-2">Location</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {importRows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="py-2 pr-3 font-mono text-xs font-bold text-[var(--odoo-purple)]">{getNextSkuFrom(items, idx)}</td>
                                                <td className="py-2 pr-3 font-medium">{row.name}</td>
                                                <td className="py-2 pr-3 text-gray-600">{row.brand || 'Other'}</td>
                                                <td className="py-2 pr-3 text-gray-600">{row.category || 'other'}</td>
                                                <td className="py-2 pr-3 text-right font-bold">{row.qty || 1}</td>
                                                <td className="py-2 font-mono text-xs text-gray-500">{row.location || 'Auto'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                                <button onClick={handleImportConfirm}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[var(--odoo-purple)] text-white rounded-lg text-sm font-bold hover:bg-[var(--odoo-purple-dark)] transition-colors">
                                    <Check className="w-4 h-4" /> Import {importRows.length} Items
                                </button>
                                <button onClick={() => { printBatchLabels(importRows.map((r, i) => ({ ...r, sku: getNextSkuFrom(items, i), qty: r.qty || 1, brand: r.brand || 'Other' }))); }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--odoo-purple)] text-[var(--odoo-purple)] rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors">
                                    <Printer className="w-4 h-4" /> Import & Print All
                                </button>
                                <button onClick={() => { setImportRows([]); setImportFile(null); }}
                                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">Clear</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Handheld Quick Add (Compact mobile form) ────────────────────────────────
export function HandheldGWPQuickAdd({ addToast, logActivity, user }) {
    const [items, setItems] = useState(loadGwpProducts);
    const [name, setName] = useState('');
    const [brand, setBrand] = useState('SKINOXY');
    const [category, setCategory] = useState('sample');
    const [qty, setQty] = useState('');
    const [saved, setSaved] = useState(null); // last saved item for print

    useEffect(() => { saveGwpProducts(items); }, [items]);

    const handleRegister = () => {
        if (!name.trim()) { addToast('Enter item name', 'error'); return; }
        if (!qty || parseInt(qty) <= 0) { addToast('Enter quantity', 'error'); return; }

        const sku = getNextSku(items);
        const barcode = generateBarcode13(sku);
        const newItem = {
            id: `gwp-${Date.now()}`, sku, barcode,
            name: name.trim(), brand, category,
            qty: parseInt(qty), location: `G-${String(items.length + 1).padStart(2, '0')}-01`,
            description: '', photo: null,
            createdAt: Date.now(), updatedAt: Date.now(), createdBy: user?.username || 'system',
        };
        setItems(prev => [newItem, ...prev]);
        setSaved(newItem);
        addToast(`${sku} registered!`, 'success');
        logActivity?.('gwp_create', `Created GWP: ${sku} — ${name.trim()} (x${qty})`);
        setName(''); setQty('');
    };

    return (
        <div className="space-y-4 p-1">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-[var(--odoo-purple)]" /> Quick Register GWP
                </h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-mono">
                    {items.length} items
                </span>
            </div>

            {/* Next SKU indicator */}
            <div className="bg-[var(--odoo-purple-light)] rounded-xl p-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-[var(--odoo-purple)]" />
                <span className="text-sm font-bold text-[var(--odoo-purple)] font-mono">{getNextSku(items)}</span>
                <span className="text-xs text-gray-500">will be assigned</span>
            </div>

            {/* Form */}
            <div className="space-y-3">
                <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="Item name (e.g. Cream Sample 5ml)"
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:border-[var(--odoo-purple)] focus:ring-2 focus:ring-[var(--odoo-purple-light)] outline-none" />

                <div className="grid grid-cols-2 gap-2">
                    <select value={brand} onChange={e => setBrand(e.target.value)}
                        className="px-3 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:border-[var(--odoo-purple)] outline-none">
                        {FALLBACK_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                        className="px-3 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:border-[var(--odoo-purple)] outline-none">
                        {FALLBACK_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                    </select>
                </div>

                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                    placeholder="Quantity"
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:border-[var(--odoo-purple)] focus:ring-2 focus:ring-[var(--odoo-purple-light)] outline-none" />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={handleRegister}
                    className="flex items-center justify-center gap-2 py-3.5 bg-[var(--odoo-purple)] text-white rounded-xl text-sm font-bold active:scale-95 transition-all">
                    <Check className="w-5 h-5" /> Register
                </button>
                <button onClick={() => { handleRegister(); setTimeout(() => { if (saved) printLabel(saved); }, 200); }}
                    className="flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-[var(--odoo-purple)] text-[var(--odoo-purple)] rounded-xl text-sm font-bold active:scale-95 transition-all">
                    <Printer className="w-5 h-5" /> Register & Print
                </button>
            </div>

            {/* Last Registered */}
            {saved && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-green-800">{saved.sku}</p>
                            <p className="text-xs text-green-600">{saved.name} | x{saved.qty}</p>
                        </div>
                        <button onClick={() => printLabel(saved)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold active:scale-95">
                            <Printer className="w-3.5 h-3.5" /> Print
                        </button>
                    </div>
                    {/* Inline barcode preview */}
                    <div className="mt-2 flex justify-center" ref={el => { if (el) { while (el.firstChild) el.removeChild(el.firstChild); const svg = generateBarcodeSVG(saved.sku, 200, 40); if (svg) { const parser = new DOMParser(); const doc = parser.parseFromString(svg, 'image/svg+xml'); const parseError = doc.querySelector('parsererror'); if (!parseError) { const svgEl = doc.documentElement; if (svgEl.nodeName === 'svg') el.appendChild(document.importNode(svgEl, true)); } } } }} />
                </div>
            )}

            {/* Recent items */}
            {items.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent ({Math.min(items.length, 5)})</p>
                    {items.slice(0, 5).map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                            <div className="min-w-0 flex-1">
                                <span className="text-xs font-mono font-bold text-[var(--odoo-purple)] mr-2">{item.sku}</span>
                                <span className="text-xs text-gray-600 truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-gray-800">x{item.qty}</span>
                                <button onClick={() => printLabel(item)} className="p-1 text-gray-400 active:text-[var(--odoo-purple)]">
                                    <Printer className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
