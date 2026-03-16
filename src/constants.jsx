import React from 'react';
import { LayoutDashboard, ShoppingCart, Box, ScanLine, FileText, Truck, Printer, Users, Settings, BookOpen, Smartphone, Monitor, Warehouse, Layers, PackageCheck, Receipt, BarChart2 } from 'lucide-react';
import { PlatformBadge } from './components/PlatformLogo';

export const firebaseConfig = {
    apiKey: "AIzaSyB_OCHiF5jhR8_J1KBxZ9ytMnZ6JwTT4wk",
    authDomain: "outbound-scanner-app.firebaseapp.com",
    projectId: "outbound-scanner-app",
    storageBucket: "outbound-scanner-app.firebasestorage.app",
    messagingSenderId: "870142640245",
    appId: "1:870142640245:web:acbde680241cf2ae24b83c"
};

export const ITEMS_PER_PAGE = 25;

export const rolesInfo = {
    admin: { label: 'Administrator', tabs: ['dashboard', 'pick', 'pack', 'handheldPack', 'posPack', 'inventory', 'sorting', 'fulfillment', 'platformMonitor', 'invoice', 'scan', 'list', 'dispatch', 'report', 'users', 'settings', 'manual'], icon: <LayoutDashboard />, desc: 'Full System Access' },
    picker: { label: 'Picker Specialist', tabs: ['pick', 'sorting', 'manual'], icon: <ShoppingCart />, desc: 'Inventory Picking' },
    packer: { label: 'Packer & QC', tabs: ['pack', 'handheldPack', 'posPack', 'fulfillment', 'manual'], icon: <Box />, desc: 'Packing & Validation' },
    outbound: { label: 'Outbound Ops', tabs: ['scan', 'list', 'dispatch', 'report', 'manual'], icon: <ScanLine />, desc: 'Scanning & Logistics' },
    accounting: { label: 'Accounting', tabs: ['dashboard', 'invoice', 'report', 'manual'], icon: <Receipt />, desc: 'Invoices & Finance' }
};

export const tabInfo = {
    dashboard: { icon: <LayoutDashboard className="w-5 h-5" />, section: 'Operations' },
    pick: { icon: <ShoppingCart className="w-5 h-5" />, section: 'Operations' },
    pack: { icon: <Box className="w-5 h-5" />, section: 'Operations' },
    handheldPack: { icon: <Smartphone className="w-5 h-5" />, section: 'Operations' },
    posPack: { icon: <Monitor className="w-5 h-5" />, section: 'Operations' },
    inventory: { icon: <Warehouse className="w-5 h-5" />, section: 'Inventory' },
    sorting: { icon: <Layers className="w-5 h-5" />, section: 'Inventory' },
    fulfillment: { icon: <PackageCheck className="w-5 h-5" />, section: 'Logistics' },
    platformMonitor: { icon: <BarChart2 className="w-5 h-5" />, section: 'Logistics' },
    scan: { icon: <ScanLine className="w-5 h-5" />, section: 'Logistics' },
    list: { icon: <FileText className="w-5 h-5" />, section: 'Logistics' },
    dispatch: { icon: <Truck className="w-5 h-5" />, section: 'Logistics' },
    invoice: { icon: <Receipt className="w-5 h-5" />, section: 'Accounting' },
    report: { icon: <Printer className="w-5 h-5" />, section: 'System' },
    users: { icon: <Users className="w-5 h-5" />, section: 'System' },
    settings: { icon: <Settings className="w-5 h-5" />, section: 'System' },
    manual: { icon: <BookOpen className="w-5 h-5" />, section: 'Help' }
};

// Wave templates
export const WAVE_TEMPLATES = [
    { id: 'morning', name: 'Morning Wave', timeRange: '08:00-12:00', icon: '🌅' },
    { id: 'afternoon', name: 'Afternoon Wave', timeRange: '12:00-17:00', icon: '☀️' },
    { id: 'evening', name: 'Evening Wave', timeRange: '17:00-21:00', icon: '🌙' },
    { id: 'custom', name: 'Custom Wave', timeRange: 'Custom', icon: '⚡' },
];

// Product catalog with images
export const PRODUCT_CATALOG = {
    // ── SKINOXY ─────────────────────────────────────────────
    'STDH080-REFILL': {
        name: 'SKINOXY Refill Toner Pad 150 ml (80 Sheets)',
        shortName: 'Refill Toner Pad (Dewy)',
        variant: 'Dewy & Hydrating',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/e8d5f5/6b21a8?text=STDH080%0ARefill',
        weight: 0.25,
        barcode: '8859139111901',
        location: 'A-01-01',
        odooId: 40001,
    },
    'STBG080-REFILL': {
        name: 'SKINOXY Refill Toner Pad 150 ml (80 Sheets)',
        shortName: 'Toner Pad Refill (Bright)',
        variant: 'Bright & Glow',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/fde68a/92400e?text=STBG080%0ARefill',
        weight: 0.28,
        barcode: '8859139111925',
        location: 'A-01-02',
        odooId: 40002,
    },
    'SWB700': {
        name: 'SKINOXY Body Wash 700ml (pH 5.5 Brightening)',
        shortName: 'Body Wash (Bright)',
        variant: 'pH 5.5 Brightening',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/bbf7d0/166534?text=SWB700%0ABody+Wash',
        weight: 0.78,
        barcode: '8859139111703',
        location: 'B-02-01',
        odooId: 40003,
    },
    'SWH700': {
        name: 'SKINOXY Body Wash 700ml (pH 5.5 Hydrating)',
        shortName: 'Body Wash (Hydra)',
        variant: 'pH 5.5 Hydrating',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/bfdbfe/1e40af?text=SWH700%0ABody+Wash',
        weight: 0.78,
        barcode: '8859139111680',
        location: 'B-02-02',
        odooId: 40004,
    },
    // ── SKINOXY Hydrogel Mask ────────────────────────────────
    'SHGG030': {
        name: 'SKINOXY Hydrogel Mask 30g (Glow & Glamour)',
        shortName: 'Hydrogel Mask (Glow)',
        variant: 'Glow & Glamour',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/fce4ec/880e4f?text=SHGG030%0AMask',
        weight: 0.05,
        barcode: '8859139119830',
        location: 'A-02-01',
        odooId: 43998,
    },
    'SHLF030': {
        name: 'SKINOXY Hydrogel Mask 30g (Lift & Firm)',
        shortName: 'Hydrogel Mask (Lift)',
        variant: 'Lift & Firm',
        brand: 'SKINOXY',
        image: 'https://placehold.co/200x200/e8eaf6/1a237e?text=SHLF030%0AMask',
        weight: 0.05,
        barcode: '8859139119847',
        location: 'A-02-02',
        odooId: 43999,
    },
    // ── KISS-MY-BODY ─────────────────────────────────────────
    'KLA226': {
        name: 'KISS-MY-BODY Bright & Shining Lotion 226ml',
        shortName: 'Bright & Shining Lotion',
        variant: 'Bright & Shining',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/fce4ec/880e4f?text=KLA226%0ALotion',
        weight: 0.32,
        barcode: '8859139102261',
        location: 'C-01-01',
        odooId: 24310,
    },
    'KMA088': {
        name: 'KISS-MY-BODY Perfume Mist 88ml',
        shortName: 'Perfume Mist 88ml',
        variant: 'Mist',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/f3e5f5/4a148c?text=KMA088%0AMist',
        weight: 0.18,
        barcode: '8859139100882',
        location: 'C-01-02',
        odooId: 24376,
    },
    'KLMH180': {
        name: 'KISS-MY-BODY Tone Up Body Lotion 180ml',
        shortName: 'Tone Up Lotion 180ml',
        variant: 'Tone Up',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/e8f5e9/1b5e20?text=KLMH180%0AToneUp',
        weight: 0.28,
        barcode: '8859139118010',
        location: 'C-02-01',
        odooId: 43355,
    },
    'KWAP380': {
        name: 'KISS-MY-BODY Perfume & Aroma 380ml',
        shortName: 'Perfume & Aroma 380ml',
        variant: 'Aroma',
        brand: 'KISS-MY-BODY',
        image: 'https://placehold.co/200x200/e3f2fd/0d47a1?text=KWAP380%0AAroma',
        weight: 0.52,
        barcode: '8859139138030',
        location: 'C-02-02',
        odooId: 43024,
    },
};

// Box/packaging types
export const BOX_TYPES = [
    { id: 'BOX-S', name: 'Box S', size: '15x20x10 cm', maxWeight: 0.5, icon: '📦' },
    { id: 'BOX-M', name: 'Box M', size: '25x30x15 cm', maxWeight: 1.5, icon: '📦' },
    { id: 'BOX-L', name: 'Box L', size: '35x40x20 cm', maxWeight: 3.0, icon: '📦' },
    { id: 'BOX-XL', name: 'Box XL', size: '45x50x30 cm', maxWeight: 5.0, icon: '📦' },
    { id: 'ENV-A4', name: 'Envelope A4', size: '24x33 cm', maxWeight: 0.3, icon: '✉️' },
    { id: 'BUBBLE', name: 'Bubble Mailer', size: '20x28 cm', maxWeight: 0.4, icon: '🫧' },
];

// Platform label configs — logo is now a React element (SVG badge)
// Use: <PlatformBadge name={order.platform} size={32} /> for best quality
// Or legacy: {pl.logo} still works (renders a sized badge)
const _badge = (name, size = 28) => <PlatformBadge name={name} size={size} />;
export const PLATFORM_LABELS = {
    'Shopee Express': { color: '#EE4D2D', logo: _badge('Shopee Express'), name: 'Shopee', prefix: 'SPXTH' },
    'Lazada Express': { color: '#0F146D', logo: _badge('Lazada Express'), name: 'Lazada', prefix: 'LZTH' },
    'Flash Express':  { color: '#FFCD00', logo: _badge('Flash Express'),  name: 'Flash',  prefix: 'FLTH', textColor: '#333' },
    'Kerry Express':  { color: '#FF6600', logo: _badge('Kerry Express'),  name: 'Kerry',  prefix: 'KETH' },
    'J&T Express':    { color: '#D32011', logo: _badge('J&T Express'),    name: 'J&T',    prefix: 'JTTH' },
    'Thai Post':      { color: '#ED1C24', logo: _badge('Thai Post'),      name: 'Thai Post', prefix: 'TPTH' },
    'TikTok Shop':    { color: '#010101', logo: _badge('TikTok Shop'),    name: 'TikTok', prefix: 'TTTH' },
};

const _D = (msAgo) => Date.now() - msAgo;
const _today = new Date().toISOString().split('T')[0];

// SKINOXY products
const _P = {
    refill: { sku: 'STDH080-REFILL',  barcode: '8859139111901', name: 'SKINOXY Refill Toner Pad (Dewy) 150ml' },
    toner:  { sku: 'STBG080-REFILL',  barcode: '8859139111925', name: 'SKINOXY Toner Pad Refill (Bright) 150ml' },
    washB:  { sku: 'SWB700',          barcode: '8859139111703', name: 'SKINOXY Body Wash (Bright) 700ml' },
    washH:  { sku: 'SWH700',          barcode: '8859139111680', name: 'SKINOXY Body Wash (Hydra) 700ml' },
    maskG:  { sku: 'SHGG030',         barcode: '8859139119830', name: '[SHGG030] SKINOXY Hydrogel Mask (Glow) 30g' },
    maskL:  { sku: 'SHLF030',         barcode: '8859139119847', name: '[SHLF030] SKINOXY Hydrogel Mask (Lift) 30g' },
};
// KISS-MY-BODY products
const _K = {
    kla:    { sku: 'KLA226',   barcode: '8859139102261', name: '[KLA226] KISS-MY-BODY Bright & Shining Lotion 226ml' },
    kma:    { sku: 'KMA088',   barcode: '8859139100882', name: '[KMA088] KISS-MY-BODY Perfume Mist 88ml' },
    klmh:   { sku: 'KLMH180',  barcode: '8859139118010', name: '[KLMH180] KISS-MY-BODY Tone Up Body Lotion 180ml' },
    kwap:   { sku: 'KWAP380',  barcode: '8859139138030', name: '[KWAP380] KISS-MY-BODY Perfume & Aroma 380ml' },
};
const _i = (p, q) => ({ ...p, expected: q, picked: 0, packed: 0 });

// Real Odoo SO format:
//   ref      = WH/OUT/XXXXX  (delivery picking ref — used in WMS)
//   soRef    = platform order number
//              Shopee:  alphanumeric  e.g. "2603145CM763UM"
//              TikTok:  18-digit num  e.g. "583073436999124085"
//              Lazada:  16-digit num  e.g. "1090229548148582"
//   customer = "ECOMMERCE : {PLATFORM}" (as stored in Odoo)
//   source   = "{Platform}_{Shop}"  e.g. "Shopee_KissMyBody", "Lazada_Skinoxy"
// Production: starts empty. Use Settings > Create Test Orders for demo data.
export const INITIAL_SALES_ORDERS = [];
