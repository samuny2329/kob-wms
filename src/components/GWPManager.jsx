import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gift, Plus, Upload, Download, Trash2, Edit3, Printer, Search, X, Check, Package, BarChart2, AlertTriangle, Camera, FileSpreadsheet, Tag, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Hash, Save, Loader2, RefreshCw, Database, MoreVertical, ScanBarcode, Shield, Activity } from 'lucide-react';
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
    const scrollContainerRef = useRef(null);

    // Odoo master data
    const [odooCategories, setOdooCategories] = useState([]);
    const [odooBrands, setOdooBrands] = useState([]);
    const [odooLocations, setOdooLocations] = useState([]);
    const [odooProducts, setOdooProducts] = useState([]);
    const [isLoadingOdoo, setIsLoadingOdoo] = useState(false);
    const [odooConnected, setOdooConnected] = useState(false);
    const [isSavingToOdoo, setIsSavingToOdoo] = useState(false);

    // Modal state for create/edit
    const [showModal, setShowModal] = useState(false);

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
        setShowModal(false);
        setTab('list');
    };

    const handleEdit = (item) => {
        setForm({ name: item.name, brand: item.brand, category: item.category, qty: String(item.qty), location: item.location, description: item.description || '', photo: item.photo || null });
        setEditingId(item.id);
        setShowModal(true);
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

    // ─── Horizontal scroll helpers ───────────────────────────────────────────
    const scrollCards = (dir) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const scrollAmt = 360;
        el.scrollBy({ left: dir === 'left' ? -scrollAmt : scrollAmt, behavior: 'smooth' });
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
    const lowStockCount = items.filter(i => i.qty < 10).length;
    const complianceRate = items.length > 0 ? ((items.filter(i => i.qty > 0).length / items.length) * 100).toFixed(1) : '100.0';

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* ═══ Header Actions ═══ */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--odoo-text)' }}>
                        GWP Rules Management
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--odoo-text-secondary)' }}>
                        Configure automated gift insertion rules for order fulfillment.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        {odooConnected ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold"
                                style={{ color: 'var(--odoo-success)', background: 'color-mix(in srgb, var(--odoo-success) 10%, transparent)' }}>
                                <Database className="w-3 h-3" /> Odoo Connected
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                                style={{ color: 'var(--odoo-text-muted)', background: 'var(--odoo-surface-high)' }}>
                                <Database className="w-3 h-3" /> Offline mode
                            </span>
                        )}
                        {isLoadingOdoo && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--odoo-purple)' }} />}
                        <button onClick={loadOdooData} className="p-1 transition-colors hover:opacity-80" style={{ color: 'var(--odoo-text-muted)' }} title="Refresh Odoo data">
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={exportCSV}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all hover:opacity-90"
                        style={{ background: 'var(--odoo-surface-high)', color: 'var(--odoo-text)' }}>
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={() => { printBatchLabels(selectedIds.length > 0 ? items.filter(i => selectedIds.includes(i.id)) : items); }}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all hover:opacity-90"
                        style={{ background: 'var(--odoo-surface-high)', color: 'var(--odoo-text)' }}>
                        <Printer className="w-4 h-4" /> Labels
                    </button>
                    <button onClick={() => { resetForm(); setEditingId(null); setShowModal(true); setTab('add'); }}
                        className="flex items-center gap-2 px-6 py-2.5 text-white rounded font-semibold text-sm shadow-sm transition-all hover:brightness-110 active:scale-95"
                        style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                        <Plus className="w-4 h-4" /> Create GWP Rule
                    </button>
                </div>
            </div>

            {/* ═══ Stats Bento Grid (3 KPI cards) ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* Total Gifts Distributed Today */}
                <div className="p-6 flex flex-col justify-between rounded shadow-sm"
                    style={{ background: 'var(--odoo-surface)', borderLeft: '4px solid var(--odoo-purple)' }}>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>
                            Total GWP Items Registered
                        </span>
                        <Gift className="w-5 h-5" style={{ color: 'var(--odoo-purple)', opacity: 0.4 }} />
                    </div>
                    <div className="mt-4">
                        <span className="text-4xl font-bold tracking-tighter" style={{ color: 'var(--odoo-text)' }}>
                            {totalQty.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold ml-2 px-2 py-0.5 rounded"
                            style={{ color: 'var(--odoo-success)', background: 'color-mix(in srgb, var(--odoo-success) 10%, transparent)' }}>
                            {items.length} SKUs
                        </span>
                    </div>
                </div>

                {/* Compliance Rate % */}
                <div className="p-6 rounded shadow-sm"
                    style={{ background: 'var(--odoo-surface)', borderLeft: '4px solid var(--odoo-success)' }}>
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>
                            Stock Compliance %
                        </span>
                        <Shield className="w-5 h-5" style={{ color: 'var(--odoo-success)', opacity: 0.4 }} />
                    </div>
                    <div className="flex items-end gap-4">
                        <span className="text-4xl font-bold tracking-tighter" style={{ color: 'var(--odoo-text)' }}>
                            {complianceRate}%
                        </span>
                        <div className="flex-grow mb-2">
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--odoo-surface-high)' }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${complianceRate}%`, background: 'var(--odoo-success)' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Rule Coverage */}
                <div className="p-6 rounded shadow-sm"
                    style={{ background: 'var(--odoo-surface)', borderLeft: '4px solid var(--odoo-text-secondary)' }}>
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>
                            Active Rule Coverage
                        </span>
                        <Activity className="w-5 h-5" style={{ color: 'var(--odoo-text-secondary)', opacity: 0.4 }} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--odoo-text)' }}>{Object.keys(catCounts).length}</div>
                            <div className="text-[10px] font-semibold uppercase" style={{ color: 'var(--odoo-text-muted)' }}>Categories</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--odoo-text)' }}>{lowStockCount}</div>
                            <div className="text-[10px] font-semibold uppercase" style={{ color: lowStockCount > 0 ? 'var(--odoo-danger)' : 'var(--odoo-text-muted)' }}>
                                Low Stock
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Active GWP Rules -- Horizontal Scroll Cards ═══ */}
            {items.length > 0 && (
                <section className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--odoo-text-secondary)' }}>
                            Active GWP Rules
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => scrollCards('left')}
                                className="p-1.5 rounded transition-colors hover:opacity-80"
                                style={{ background: 'var(--odoo-surface-high)' }}>
                                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--odoo-text-secondary)' }} />
                            </button>
                            <button onClick={() => scrollCards('right')}
                                className="p-1.5 rounded transition-colors hover:opacity-80"
                                style={{ background: 'var(--odoo-surface-high)' }}>
                                <ChevronRight className="w-4 h-4" style={{ color: 'var(--odoo-text-secondary)' }} />
                            </button>
                        </div>
                    </div>
                    <div ref={scrollContainerRef}
                        className="flex gap-6 overflow-x-auto pb-4 -mx-2 px-2"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {items.slice(0, 8).map(item => {
                            const cat = CATEGORIES.find(c => c.id === item.category);
                            return (
                                <div key={item.id}
                                    className="min-w-[340px] p-5 rounded shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                    style={{ background: 'var(--odoo-surface)' }}
                                    onClick={() => handleEdit(item)}>
                                    {/* Card header: name + badge + synced dot */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold" style={{ color: 'var(--odoo-purple)' }}>{item.name}</h3>
                                            <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-tighter"
                                                style={{ background: 'color-mix(in srgb, var(--odoo-purple) 10%, transparent)', color: 'var(--odoo-purple)' }}>
                                                {cat?.label?.split('/')[0]?.trim() || item.category}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.odooSynced && (
                                                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--odoo-success)' }} title="Synced to Odoo" />
                                            )}
                                        </div>
                                    </div>
                                    {/* Card body: photo/icon + SKU info */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            {item.photo ? (
                                                <img src={item.photo} alt="" className="w-12 h-12 object-cover rounded" style={{ background: 'var(--odoo-surface-high)' }} />
                                            ) : (
                                                <div className="w-12 h-12 rounded flex items-center justify-center text-xl" style={{ background: 'var(--odoo-surface-high)' }}>
                                                    {cat?.icon || '📦'}
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--odoo-text-muted)' }}>Gift Item</div>
                                                <div className="font-mono text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>{item.sku}</div>
                                                <div className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>{item.brand}</div>
                                            </div>
                                        </div>
                                        {/* Bottom stats row */}
                                        <div className="grid grid-cols-2 gap-4 pt-2" style={{ borderTop: '1px solid var(--odoo-surface-high)' }}>
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--odoo-text-muted)' }}>Quantity</div>
                                                <div className="text-sm font-bold" style={{ color: item.qty < 10 ? 'var(--odoo-danger)' : 'var(--odoo-text)' }}>
                                                    {item.qty.toLocaleString()}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--odoo-text-muted)' }}>Location</div>
                                                <div className="text-xs font-semibold font-mono" style={{ color: 'var(--odoo-text)' }}>{item.location}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ═══ Tab Navigation ═══ */}
            <div className="flex items-center gap-6 mb-4 h-10" style={{ borderBottom: '1px solid var(--odoo-surface-high)' }}>
                {[
                    { id: 'list', label: 'GWP List' },
                    { id: 'import', label: 'Batch Import' },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className="h-full px-2 text-sm font-semibold transition-colors"
                        style={{
                            color: tab === t.id ? 'var(--odoo-purple)' : 'var(--odoo-text-muted)',
                            borderBottom: tab === t.id ? '2px solid var(--odoo-purple)' : '2px solid transparent',
                        }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB: GWP List (Fulfillment Queue style table) ═══ */}
            {tab === 'list' && (
                <section>
                    {/* Search & Filter Bar */}
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules or items..."
                                    className="pl-9 pr-4 py-1.5 text-sm rounded-lg w-64 outline-none transition-all"
                                    style={{ background: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }} />
                            </div>
                            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                                className="px-3 py-1.5 text-sm rounded-lg outline-none"
                                style={{ background: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }}>
                                <option value="all">All Categories</option>
                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            {selectedIds.length > 0 && (
                                <button onClick={() => handleDelete(selectedIds)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-tighter rounded transition-all"
                                    style={{ color: 'var(--odoo-danger)', background: 'color-mix(in srgb, var(--odoo-danger) 8%, transparent)' }}>
                                    <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.length})
                                </button>
                            )}
                            <span className="text-xs font-bold px-2 py-1 rounded"
                                style={{ color: 'var(--odoo-purple)', background: 'color-mix(in srgb, var(--odoo-purple) 10%, transparent)' }}>
                                {filtered.length} Items
                            </span>
                        </div>
                    </div>

                    {/* Items Table */}
                    {filtered.length === 0 ? (
                        <div className="rounded shadow-sm p-12 text-center" style={{ background: 'var(--odoo-surface)' }}>
                            <Gift className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--odoo-text-muted)', opacity: 0.3 }} />
                            <p className="font-medium" style={{ color: 'var(--odoo-text-muted)' }}>No GWP items yet</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--odoo-text-muted)' }}>Use Create GWP Rule or Batch Import to add items</p>
                            <button onClick={() => { resetForm(); setEditingId(null); setShowModal(true); setTab('add'); }}
                                className="mt-4 px-6 py-2.5 text-white rounded text-sm font-bold transition-all hover:brightness-110 active:scale-95"
                                style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                <Plus className="w-4 h-4 inline mr-1" /> Register First Item
                            </button>
                        </div>
                    ) : (
                        <div className="rounded shadow-sm overflow-hidden" style={{ background: 'var(--odoo-surface)' }}>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr style={{ background: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-surface-high)' }}>
                                        <th className="px-6 py-4 w-10">
                                            <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0}
                                                onChange={e => setSelectedIds(e.target.checked ? filtered.map(i => i.id) : [])}
                                                className="w-4 h-4 rounded" style={{ accentColor: 'var(--odoo-purple)' }} />
                                        </th>
                                        {[
                                            { key: 'sku', label: 'SKU' },
                                            { key: 'name', label: 'Item Name' },
                                        ].map(col => (
                                            <th key={col.key}
                                                className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none"
                                                style={{ color: 'var(--odoo-text-muted)' }}
                                                onClick={() => { setSortBy(col.key); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                                                <span className="flex items-center gap-1">
                                                    {col.label}
                                                    {sortBy === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                                </span>
                                            </th>
                                        ))}
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Category</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none"
                                            style={{ color: 'var(--odoo-text-muted)' }}
                                            onClick={() => { setSortBy('qty'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                                            <span className="flex items-center gap-1">
                                                Qty {sortBy === 'qty' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                            </span>
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--odoo-text-muted)' }}>Status</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: 'var(--odoo-text-muted)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(item => {
                                        const cat = CATEGORIES.find(c => c.id === item.category);
                                        const isLow = item.qty < 10;
                                        const statusLabel = isLow ? 'Low Stock' : item.odooSynced ? 'Synced' : 'Local';
                                        const statusColor = isLow ? 'var(--odoo-warning)' : item.odooSynced ? 'var(--odoo-success)' : 'var(--odoo-text-muted)';
                                        return (
                                            <tr key={item.id} className="transition-colors"
                                                style={{
                                                    borderBottom: '1px solid var(--odoo-surface-high)',
                                                    background: selectedIds.includes(item.id) ? 'color-mix(in srgb, var(--odoo-purple) 5%, transparent)' : undefined,
                                                }}
                                                onMouseEnter={e => { if (!selectedIds.includes(item.id)) e.currentTarget.style.background = 'color-mix(in srgb, var(--odoo-surface-high) 30%, transparent)'; }}
                                                onMouseLeave={e => { if (!selectedIds.includes(item.id)) e.currentTarget.style.background = ''; }}>
                                                <td className="px-6 py-4">
                                                    <input type="checkbox" checked={selectedIds.includes(item.id)}
                                                        onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))}
                                                        className="w-4 h-4 rounded" style={{ accentColor: 'var(--odoo-purple)' }} />
                                                </td>
                                                <td className="px-6 py-4 font-mono font-bold text-sm" style={{ color: 'var(--odoo-purple)' }}>{item.sku}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {item.photo ? (
                                                            <img src={item.photo} alt="" className="w-10 h-10 rounded object-cover" style={{ background: 'var(--odoo-surface-high)' }} />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded flex items-center justify-center text-lg" style={{ background: 'var(--odoo-surface-high)' }}>
                                                                {cat?.icon || '📦'}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-semibold" style={{ color: 'var(--odoo-text)' }}>{item.name}</div>
                                                            <div className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>{item.brand} | {item.location}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs">
                                                    <span className="px-2 py-0.5 rounded font-mono"
                                                        style={{ background: 'var(--odoo-surface-low)', border: '1px solid var(--odoo-border-ghost)' }}>
                                                        {cat?.label?.split('/')[0]?.trim() || item.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold" style={{ color: isLow ? 'var(--odoo-danger)' : 'var(--odoo-text)' }}>
                                                    {item.qty.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tighter px-2 py-1 rounded"
                                                            style={{ color: statusColor, background: `color-mix(in srgb, ${statusColor} 10%, transparent)` }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                                                            {statusLabel}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => handleEdit(item)} className="p-2 rounded transition-colors"
                                                            style={{ color: 'var(--odoo-purple)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--odoo-purple) 10%, transparent)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = ''}
                                                            title="Edit">
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => printLabel(item)} className="p-2 rounded transition-colors"
                                                            style={{ color: 'var(--odoo-purple)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--odoo-purple) 10%, transparent)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = ''}
                                                            title="Print Label">
                                                            <Printer className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(item.id)} className="p-2 rounded transition-colors"
                                                            style={{ color: 'var(--odoo-danger)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--odoo-danger) 10%, transparent)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = ''}
                                                            title="Delete">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Pagination Footer */}
                            <div className="px-6 py-3 flex justify-between items-center" style={{ background: 'var(--odoo-surface-low)' }}>
                                <span className="text-xs font-semibold" style={{ color: 'var(--odoo-text-muted)' }}>
                                    Showing {filtered.length} of {items.length} records
                                </span>
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 text-xs font-bold rounded transition-all"
                                        style={{ background: 'var(--odoo-surface)', border: '1px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}>
                                        Previous
                                    </button>
                                    <button className="px-3 py-1 text-xs font-bold rounded transition-all"
                                        style={{ background: 'var(--odoo-surface)', border: '1px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}>
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* ═══ TAB: Batch Import ═══ */}
            {tab === 'import' && (
                <div className="space-y-6 max-w-3xl">
                    {/* Download Template */}
                    <div className="p-6 rounded shadow-sm" style={{ background: 'var(--odoo-surface)' }}>
                        <h3 className="text-sm font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--odoo-text-secondary)' }}>
                            <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--odoo-success)' }} /> Step 1: Download Template
                        </h3>
                        <p className="text-sm mb-3" style={{ color: 'var(--odoo-text-muted)' }}>Download the CSV template, fill in your GWP items, then upload below.</p>
                        <button onClick={downloadTemplate}
                            className="flex items-center gap-2 px-4 py-2.5 text-white rounded text-sm font-bold transition-all hover:brightness-110"
                            style={{ background: 'var(--odoo-success)' }}>
                            <Download className="w-4 h-4" /> Download Template (CSV)
                        </button>
                        <div className="mt-3 text-xs" style={{ color: 'var(--odoo-text-muted)' }}>
                            <p>Columns: <span className="font-mono">name, brand, category, qty, location, description</span></p>
                            <p>Categories: {CATEGORIES.map(c => c.id).join(', ')}</p>
                        </div>
                    </div>

                    {/* Upload */}
                    <div className="p-6 rounded shadow-sm" style={{ background: 'var(--odoo-surface)' }}>
                        <h3 className="text-sm font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--odoo-text-secondary)' }}>
                            <Upload className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Step 2: Upload CSV
                        </h3>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-4 py-2.5 text-white rounded text-sm font-bold cursor-pointer transition-all hover:brightness-110"
                                style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                <Upload className="w-4 h-4" /> Choose File
                                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileSelect} className="hidden" />
                            </label>
                            {importFile && <span className="text-sm" style={{ color: 'var(--odoo-text-secondary)' }}>{importFile}</span>}
                        </div>
                    </div>

                    {/* Preview */}
                    {importRows.length > 0 && (
                        <div className="p-6 rounded shadow-sm" style={{ background: 'var(--odoo-surface)' }}>
                            <h3 className="text-sm font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--odoo-text-secondary)' }}>
                                <Package className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} /> Step 3: Preview & Confirm ({importRows.length} items)
                            </h3>
                            <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--odoo-surface-high)' }}>
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr style={{ background: 'var(--odoo-surface-low)', borderBottom: '1px solid var(--odoo-surface-high)' }}>
                                            <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>SKU (auto)</th>
                                            <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Name</th>
                                            <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Brand</th>
                                            <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Category</th>
                                            <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Qty</th>
                                            <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>Location</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importRows.map((row, idx) => (
                                            <tr key={idx} className="transition-colors"
                                                style={{ borderBottom: '1px solid var(--odoo-surface-high)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--odoo-surface-high) 30%, transparent)'}
                                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                <td className="py-3 px-4 font-mono text-xs font-bold" style={{ color: 'var(--odoo-purple)' }}>{getNextSkuFrom(items, idx)}</td>
                                                <td className="py-3 px-4 font-semibold" style={{ color: 'var(--odoo-text)' }}>{row.name}</td>
                                                <td className="py-3 px-4" style={{ color: 'var(--odoo-text-secondary)' }}>{row.brand || 'Other'}</td>
                                                <td className="py-3 px-4" style={{ color: 'var(--odoo-text-secondary)' }}>{row.category || 'other'}</td>
                                                <td className="py-3 px-4 text-right font-bold" style={{ color: 'var(--odoo-text)' }}>{row.qty || 1}</td>
                                                <td className="py-3 px-4 font-mono text-xs" style={{ color: 'var(--odoo-text-muted)' }}>{row.location || 'Auto'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-col md:flex-row items-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--odoo-surface-high)' }}>
                                <button onClick={() => { printBatchLabels(importRows.map((r, i) => ({ ...r, sku: getNextSkuFrom(items, i), qty: r.qty || 1, brand: r.brand || 'Other' }))); }}
                                    className="w-full md:w-auto flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all hover:opacity-80"
                                    style={{ color: 'var(--odoo-purple)', background: 'var(--odoo-surface-high)' }}>
                                    <Printer className="w-4 h-4" /> Print Barcode Labels
                                </button>
                                <div className="flex gap-4 w-full md:w-auto">
                                    <button onClick={() => { setImportRows([]); setImportFile(null); }}
                                        className="flex-grow md:flex-none px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded transition-all hover:opacity-80"
                                        style={{ color: 'var(--odoo-text-secondary)' }}>
                                        Clear
                                    </button>
                                    <button onClick={handleImportConfirm}
                                        className="flex-grow md:flex-none flex items-center justify-center gap-2 px-10 py-2.5 text-white text-xs font-bold uppercase tracking-widest rounded shadow transition-all hover:brightness-110 active:scale-95"
                                        style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                        <Check className="w-4 h-4" /> Import {importRows.length} Items
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ MODAL: Create / Edit GWP Rule ═══ */}
            {(showModal || tab === 'add') && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(12px)' }}>
                    <div className="w-full max-w-2xl rounded shadow-2xl overflow-hidden"
                        style={{ background: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                        {/* Modal Header -- gradient */}
                        <div className="px-6 py-4 flex justify-between items-center text-white"
                            style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight">{editingId ? 'Edit GWP Rule' : 'Create GWP Rule'}</h2>
                                <p className="text-[10px] text-white/70 uppercase tracking-widest font-semibold">Rule Definition Engine</p>
                            </div>
                            <button onClick={() => { setShowModal(false); resetForm(); setEditingId(null); if (tab === 'add') setTab('list'); }}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6">
                            {/* Auto SKU indicator */}
                            {!editingId && (
                                <div className="flex items-center gap-2 text-xs rounded px-3 py-2"
                                    style={{ background: 'color-mix(in srgb, var(--odoo-purple) 8%, transparent)', color: 'var(--odoo-purple)' }}>
                                    <Tag className="w-3.5 h-3.5" />
                                    <span className="font-semibold">Auto-generated SKU: <span className="font-mono font-bold">{getNextSku(items)}</span></span>
                                </div>
                            )}

                            {/* Rule Name + Brand */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--odoo-text-muted)' }}>
                                        Rule Name *
                                    </label>
                                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g. Summer Solstice Gift"
                                        className="w-full text-sm font-semibold transition-all outline-none py-2"
                                        style={{ background: 'var(--odoo-surface)', borderBottom: '2px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}
                                        onFocus={e => e.target.style.borderBottomColor = 'var(--odoo-purple)'}
                                        onBlur={e => e.target.style.borderBottomColor = 'var(--odoo-surface-high)'} />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--odoo-text-muted)' }}>
                                        Brand {odooConnected && <span style={{ color: 'var(--odoo-success)', fontWeight: 400 }}>(Odoo)</span>}
                                    </label>
                                    <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                                        className="w-full text-sm py-2 outline-none transition-all"
                                        style={{ background: 'var(--odoo-surface)', borderBottom: '2px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}>
                                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Category (qualifying SKU area) */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--odoo-text-muted)' }}>
                                    Qualifying SKUs {odooConnected && <span style={{ color: 'var(--odoo-success)', fontWeight: 400 }}>(Odoo)</span>}
                                </label>
                                <div className="p-2 rounded flex flex-wrap gap-2 min-h-[44px]"
                                    style={{ background: 'var(--odoo-surface-low)' }}>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="flex-1 text-sm py-1 px-2 rounded outline-none"
                                        style={{ background: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', color: 'var(--odoo-text)' }}>
                                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Gift Item (Scan) + Qty */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--odoo-text-muted)' }}>
                                        Gift Item (Scan Barcode)
                                    </label>
                                    {LOCATIONS.length > 0 ? (
                                        <div className="relative">
                                            <ScanBarcode className="absolute left-0 bottom-2.5 w-4 h-4" style={{ color: 'var(--odoo-purple)', opacity: 0.5 }} />
                                            <select value={form.locationId || ''} onChange={e => {
                                                const loc = LOCATIONS.find(l => l.id === parseInt(e.target.value));
                                                setForm(f => ({ ...f, locationId: loc?.id || null, location: loc?.name || '' }));
                                            }}
                                                className="w-full text-sm font-mono pl-7 py-2 outline-none transition-all"
                                                style={{ background: 'var(--odoo-surface)', borderBottom: '2px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}>
                                                <option value="">-- Select --</option>
                                                {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <ScanBarcode className="absolute left-0 bottom-2.5 w-4 h-4" style={{ color: 'var(--odoo-purple)', opacity: 0.5 }} />
                                            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                                placeholder="Scan SKU..."
                                                className="w-full text-sm font-mono pl-7 py-2 outline-none transition-all"
                                                style={{ background: 'var(--odoo-surface)', borderBottom: '2px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}
                                                onFocus={e => e.target.style.borderBottomColor = 'var(--odoo-purple)'}
                                                onBlur={e => e.target.style.borderBottomColor = 'var(--odoo-surface-high)'} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--odoo-text-muted)' }}>
                                        Min Purchase Amount ($)
                                    </label>
                                    <input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full text-sm font-bold py-2 outline-none transition-all"
                                        style={{ background: 'var(--odoo-surface)', borderBottom: '2px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}
                                        onFocus={e => e.target.style.borderBottomColor = 'var(--odoo-purple)'}
                                        onBlur={e => e.target.style.borderBottomColor = 'var(--odoo-surface-high)'} />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--odoo-text-muted)' }}>Description (optional)</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    rows={2} placeholder="Brief description..."
                                    className="w-full text-sm py-2 outline-none resize-none transition-all"
                                    style={{ background: 'var(--odoo-surface)', borderBottom: '2px solid var(--odoo-surface-high)', color: 'var(--odoo-text)' }}
                                    onFocus={e => e.target.style.borderBottomColor = 'var(--odoo-purple)'}
                                    onBlur={e => e.target.style.borderBottomColor = 'var(--odoo-surface-high)'} />
                            </div>

                            {/* Photo */}
                            <div className="flex items-center gap-3">
                                {form.photo ? (
                                    <div className="relative">
                                        <img src={form.photo} alt="" className="w-16 h-16 rounded object-cover" style={{ border: '1px solid var(--odoo-surface-high)' }} />
                                        <button onClick={() => setForm(f => ({ ...f, photo: null }))}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                                            style={{ background: 'var(--odoo-danger)' }}>
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="w-16 h-16 rounded flex flex-col items-center justify-center cursor-pointer transition-colors"
                                        style={{ border: '2px dashed var(--odoo-surface-dim)', color: 'var(--odoo-text-muted)' }}>
                                        <Camera className="w-5 h-5" />
                                        <span className="text-[9px] mt-0.5">Photo</span>
                                        <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                                    </label>
                                )}
                                <div className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>
                                    <p>Max 2MB, JPG/PNG</p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderTop: '1px solid var(--odoo-surface-high)' }}>
                                <button onClick={() => {
                                    if (editingId) { const item = items.find(i => i.id === editingId); if (item) printLabel(item); }
                                }}
                                    className="w-full md:w-auto flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all hover:opacity-80"
                                    style={{ color: 'var(--odoo-purple)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--odoo-surface-high)'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <Printer className="w-4 h-4" /> Print Barcode Label
                                </button>
                                <div className="flex gap-4 w-full md:w-auto">
                                    <button onClick={() => { setShowModal(false); resetForm(); setEditingId(null); if (tab === 'add') setTab('list'); }}
                                        className="flex-grow md:flex-none px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded transition-all hover:opacity-80"
                                        style={{ color: 'var(--odoo-text-secondary)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--odoo-surface-high)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        Cancel
                                    </button>
                                    <button onClick={handleSave} disabled={isSavingToOdoo}
                                        className="flex-grow md:flex-none flex items-center justify-center gap-2 px-10 py-2.5 text-white text-xs font-bold uppercase tracking-widest rounded shadow transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                                        {isSavingToOdoo ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                        {editingId ? 'Save Changes' : 'Save Rule'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
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
        <div className="space-y-4 p-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--odoo-text)' }}>
                    <Gift className="w-5 h-5" style={{ color: 'var(--odoo-purple)' }} /> Quick Register GWP
                </h3>
                <span className="text-xs px-2 py-1 rounded-lg font-mono" style={{ background: 'var(--odoo-surface-high)', color: 'var(--odoo-text-secondary)' }}>
                    {items.length} items
                </span>
            </div>

            {/* Next SKU indicator */}
            <div className="rounded-xl p-3 flex items-center gap-2"
                style={{ background: 'color-mix(in srgb, var(--odoo-purple) 10%, transparent)' }}>
                <Tag className="w-4 h-4" style={{ color: 'var(--odoo-purple)' }} />
                <span className="text-sm font-bold font-mono" style={{ color: 'var(--odoo-purple)' }}>{getNextSku(items)}</span>
                <span className="text-xs" style={{ color: 'var(--odoo-text-muted)' }}>will be assigned</span>
            </div>

            {/* Form */}
            <div className="space-y-3">
                <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="Item name (e.g. Cream Sample 5ml)"
                    className="w-full px-3 py-3 rounded-xl text-base outline-none transition-all"
                    style={{ border: '1px solid var(--odoo-surface-dim)', background: 'var(--odoo-surface)', color: 'var(--odoo-text)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--odoo-purple)'}
                    onBlur={e => e.target.style.borderColor = 'var(--odoo-surface-dim)'} />

                <div className="grid grid-cols-2 gap-2">
                    <select value={brand} onChange={e => setBrand(e.target.value)}
                        className="px-3 py-3 rounded-xl text-sm outline-none"
                        style={{ border: '1px solid var(--odoo-surface-dim)', background: 'var(--odoo-surface)', color: 'var(--odoo-text)' }}>
                        {FALLBACK_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                        className="px-3 py-3 rounded-xl text-sm outline-none"
                        style={{ border: '1px solid var(--odoo-surface-dim)', background: 'var(--odoo-surface)', color: 'var(--odoo-text)' }}>
                        {FALLBACK_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                    </select>
                </div>

                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                    placeholder="Quantity"
                    className="w-full px-3 py-3 rounded-xl text-base outline-none transition-all"
                    style={{ border: '1px solid var(--odoo-surface-dim)', background: 'var(--odoo-surface)', color: 'var(--odoo-text)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--odoo-purple)'}
                    onBlur={e => e.target.style.borderColor = 'var(--odoo-surface-dim)'} />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={handleRegister}
                    className="flex items-center justify-center gap-2 py-3.5 text-white rounded-xl text-sm font-bold active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg, var(--odoo-purple-dark), var(--odoo-purple))' }}>
                    <Check className="w-5 h-5" /> Register
                </button>
                <button onClick={() => { handleRegister(); setTimeout(() => { if (saved) printLabel(saved); }, 200); }}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
                    style={{ border: '2px solid var(--odoo-purple)', color: 'var(--odoo-purple)', background: 'var(--odoo-surface)' }}>
                    <Printer className="w-5 h-5" /> Register & Print
                </button>
            </div>

            {/* Last Registered */}
            {saved && (
                <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--odoo-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--odoo-success) 20%, transparent)' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--odoo-success)' }}>{saved.sku}</p>
                            <p className="text-xs" style={{ color: 'var(--odoo-text-secondary)' }}>{saved.name} | x{saved.qty}</p>
                        </div>
                        <button onClick={() => printLabel(saved)}
                            className="flex items-center gap-1 px-3 py-1.5 text-white rounded-lg text-xs font-bold active:scale-95"
                            style={{ background: 'var(--odoo-success)' }}>
                            <Printer className="w-3.5 h-3.5" /> Print
                        </button>
                    </div>
                    {/* Inline barcode preview */}
                    <div className="mt-2 flex justify-center" ref={el => { if (el) { el.innerHTML = ''; const svg = generateBarcodeSVG(saved.sku, 200, 40); if (svg) { const parser = new DOMParser(); const doc = parser.parseFromString(svg, 'image/svg+xml'); const svgEl = doc.documentElement; if (svgEl.nodeName === 'svg') el.appendChild(svgEl); } } }} />
                </div>
            )}

            {/* Recent items */}
            {items.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)' }}>Recent ({Math.min(items.length, 5)})</p>
                    {items.slice(0, 5).map(item => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ background: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)' }}>
                            <div className="min-w-0 flex-1">
                                <span className="text-xs font-mono font-bold mr-2" style={{ color: 'var(--odoo-purple)' }}>{item.sku}</span>
                                <span className="text-xs truncate" style={{ color: 'var(--odoo-text-secondary)' }}>{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold" style={{ color: 'var(--odoo-text)' }}>x{item.qty}</span>
                                <button onClick={() => printLabel(item)} className="p-1 active:opacity-70" style={{ color: 'var(--odoo-text-muted)' }}>
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
