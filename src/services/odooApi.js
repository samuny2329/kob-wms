// Odoo WMS API Service Layer
// Reads USE_MOCK from odooConfig.useMock (set in Settings UI)
// When useMock is false, connects to real Odoo 18 via session-based auth
//
// ─── Odoo Models & Fields Used ───────────────────────────────────────
//
// STOCK (Warehouse):
//   stock.picking      — id, name, partner_id, state, move_ids, origin, note,
//                        scheduled_date, sale_id, company_id, location_id
//                        Methods: search_read, read, button_validate
//   stock.move          — id, picking_id, product_id, product_uom_qty, quantity,
//                        location_id, state
//                        Methods: search_read
//   stock.move.line     — id, move_id, picking_id, product_id, location_id,
//                        location_dest_id, lot_id, quantity, qty_done, date, reference
//                        Methods: search_read, write, create
//   stock.quant         — product_id, lot_id, quantity, reserved_quantity, location_id,
//                        company_id
//                        Methods: search_read
//   stock.location      — id, name, complete_name, usage, location_id, active
//                        Methods: search_read, create
//
// SALES & INVOICING:
//   sale.order          — id, name, partner_id, order_line, team_id, date_order, state,
//                        source_id, commitment_date, picking_ids, client_order_ref, note
//                        Methods: search_read, read, create, action_confirm
//   account.move        — id, name, partner_id, invoice_date, invoice_date_due, state,
//                        payment_state, amount_untaxed, amount_tax, amount_total,
//                        invoice_origin, invoice_line_ids, move_type
//                        Methods: search_read, action_post
//   account.move.line   — move_id, product_id, name, quantity, price_unit,
//                        price_subtotal, price_total, display_type
//                        Methods: search_read
//
// MASTER DATA:
//   product.product     — id, name, default_code (SKU), barcode, lst_price, uom_id, active
//                        Methods: search_read, read
//   res.partner         — id, name, customer_rank
//                        Methods: search_read, create
//   crm.team            — id, name
//                        Methods: search_read
//
// WIZARDS:
//   sale.advance.payment.inv      — advance_payment_method, sale_order_ids
//                                   Methods: create, create_invoices
//   stock.backorder.confirmation  — pick_ids  |  Methods: create, process
//   stock.immediate.transfer      — pick_ids  |  Methods: create, process
//
// ─── Docker Deployment ────────────────────────────────────────────────
//   Browser → Nginx (:80) → /web/*, /wms/* proxy → Odoo 18 (:8069) → PostgreSQL 16
//   docker-compose.yml: wms (Nginx), odoo (Odoo 18), postgres (PostgreSQL 16)
//   Network: wms-pro-network (bridge 172.28.0.0/16)
//   CI/CD: GitHub Actions → Lint → Build → Docker Push (GHCR) → Deploy SSH → Health Check
// ──────────────────────────────────────────────────────────────────────

const API_TIMEOUT = 8000;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Session state
let _sessionAuthenticated = false;
let _sessionUid = null;

const fetchWithTimeout = async (url, options = {}, timeout = API_TIMEOUT) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

// ============ AUTH & TRANSPORT ============

const isMock = (odooConfig) => odooConfig?.useMock === true;

// Use Vite proxy: requests to /wms/* are forwarded to Odoo by the dev server
// No CORS issues, no credentials needed
const getOdooBase = (odooConfig) => odooConfig?.url || import.meta.env.VITE_ODOO_URL || '';

export const authenticateOdoo = async (odooConfig) => {
    if (isMock(odooConfig)) return { status: 'success', uid: 1 };
    try {
        // Use Odoo's standard JSONRPC auth endpoint (proxied via Vite /web/session/*)
        const response = await fetchWithTimeout(`${getOdooBase(odooConfig)}/web/session/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: { db: odooConfig.db, login: odooConfig.username, password: odooConfig.password }
            })
        });
        const data = await response.json();
        if (data.result?.uid) {
            _sessionAuthenticated = true;
            _sessionUid = data.result.uid;
            return { status: 'success', uid: data.result.uid, username: data.result.name };
        }
        throw new Error('Invalid credentials');
    } catch (err) {
        _sessionAuthenticated = false;
        _sessionUid = null;
        throw err;
    }
};

const odooPost = async (odooConfig, endpoint, params = {}) => {
    // Auto-authenticate if not yet authenticated
    if (!_sessionAuthenticated) {
        await authenticateOdoo(odooConfig);
    }

    const url = `${getOdooBase(odooConfig)}${endpoint}`;
    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ params })
    });
    const data = await response.json();
    if (data.error) {
        // Session expired? Re-auth once
        if (data.error.message?.includes('Session') || response.status === 401) {
            _sessionAuthenticated = false;
            await authenticateOdoo(odooConfig);
            const retry = await fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ params })
            });
            const retryData = await retry.json();
            if (retryData.error) throw new Error(retryData.error.message || 'Odoo API Error');
            return retryData.result;
        }
        throw new Error(data.error.message || 'Odoo API Error');
    }
    return data.result;
};

// ============ ORDERS ============

export const fetchPickingOrders = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(200);
        const stored = JSON.parse(localStorage.getItem('wms_sales_orders') || '[]');
        return stored.filter(o => o.status === 'pending' || o.status === 'picking');
    }
    return odooPost(odooConfig, '/wms/orders/pending');
};

export const fetchPackableOrders = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(200);
        const stored = JSON.parse(localStorage.getItem('wms_sales_orders') || '[]');
        return stored.filter(o => o.status === 'picked' || o.status === 'packing');
    }
    return odooPost(odooConfig, '/wms/orders/picked');
};

export const fetchAllOrders = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(300);
        return JSON.parse(localStorage.getItem('wms_sales_orders') || '[]');
    }

    // Live: fetch outgoing pickings — active ones + recently done (last 30 days for RTS display)
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10) + ' 00:00:00';
    const pickings = await odooCallKw(odooConfig, 'stock.picking', 'search_read',
        [[['picking_type_code', '=', 'outgoing'], ['state', 'not in', ['cancel']],
          ['write_date', '>=', cutoff]]],
        { fields: ['id', 'name', 'partner_id', 'state', 'move_ids', 'origin', 'note',
                   'scheduled_date', 'sale_id'], order: 'id asc', limit: 500 }
    );
    if (!pickings || pickings.length === 0) return [];

    // Fetch sale orders to get team_id (platform) for each picking
    const soNames = [...new Set(pickings.map(p => p.origin).filter(Boolean))];
    let soTeamMap = {}; // origin → platform label
    if (soNames.length > 0) {
        const sos = await odooCallKw(odooConfig, 'sale.order', 'search_read',
            [[['name', 'in', soNames]]],
            { fields: ['name', 'team_id'], limit: 500 }
        );
        for (const so of sos) {
            const teamName = so.team_id ? so.team_id[1] : '';
            let platform = 'Manual';
            if (teamName.toLowerCase().includes('shopee')) platform = 'Shopee Express';
            else if (teamName.toLowerCase().includes('lazada')) platform = 'Lazada Express';
            else if (teamName.toLowerCase().includes('tiktok') || teamName.toLowerCase().includes('tik tok')) platform = 'TikTok Shop';
            else if (teamName.toLowerCase().includes('line')) platform = 'LINE';
            else if (teamName) platform = teamName; // keep original team name
            soTeamMap[so.name] = platform;
        }
    }

    // Fetch all move lines for these pickings
    const pickingIds = pickings.map(p => p.id);
    const moves = await odooCallKw(odooConfig, 'stock.move', 'search_read',
        [[['picking_id', 'in', pickingIds], ['state', 'not in', ['cancel']]]],
        { fields: ['id', 'picking_id', 'product_id', 'product_uom_qty', 'quantity'] }
    );

    // Fetch product details (sku/barcode/name)
    const productIds = [...new Set(moves.map(m => m.product_id[0]))];
    let productMap = {};
    if (productIds.length > 0) {
        const products = await odooCallKw(odooConfig, 'product.product', 'read',
            [productIds], { fields: ['id', 'name', 'default_code', 'barcode'] }
        );
        for (const p of products) {
            productMap[p.id] = { name: p.name, sku: p.default_code || '', barcode: p.barcode || '' };
        }
    }

    // Group moves by picking
    const movesByPicking = {};
    for (const m of moves) {
        const pid = m.picking_id[0];
        if (!movesByPicking[pid]) movesByPicking[pid] = [];
        movesByPicking[pid].push(m);
    }

    const mapState = (state) => {
        if (state === 'done') return 'rts';        // validated in Odoo = shipped
        if (state === 'cancel') return 'cancelled';
        if (state === 'assigned') return 'pending'; // ready to pick
        return 'pending';
    };

    // Courier from carrier_id name
    const mapCourier = (carrierName = '') => {
        const n = carrierName.toLowerCase();
        if (n.includes('flash')) return 'Flash Express';
        if (n.includes('kerry')) return 'Kerry Express';
        if (n.includes('j&t') || n.includes('jt')) return 'J&T Express';
        if (n.includes('shopee')) return 'Shopee Express';
        if (n.includes('lazada')) return 'Lazada Express';
        if (n.includes('thai post') || n.includes('ems')) return 'Thai Post';
        return carrierName || 'Kerry Express';
    };

    return pickings.map(p => {
        const pMoves = movesByPicking[p.id] || [];
        const platform = soTeamMap[p.origin] || (p.note ? p.note : 'Manual');
        // Infer courier from platform team
        const courier = platform.includes('Shopee') ? 'Shopee Express'
            : platform.includes('Lazada') ? 'Lazada Express'
            : platform.includes('TikTok') ? 'J&T Express'
            : 'Kerry Express';
        const createdAt = p.scheduled_date
            ? new Date(p.scheduled_date).getTime()
            : Date.now();

        return {
            id: p.id,
            ref: p.name,
            customer: p.partner_id ? p.partner_id[1] : 'Unknown',
            platform,
            courier,
            status: mapState(p.state),
            odooPickingId: p.id,
            odooOrigin: p.origin || '',
            scheduledDate: p.scheduled_date ? p.scheduled_date.split(' ')[0] : null,
            createdAt,
            items: pMoves.map(m => ({
                sku: productMap[m.product_id[0]]?.sku || m.product_id[1],
                name: productMap[m.product_id[0]]?.name || m.product_id[1],
                barcode: productMap[m.product_id[0]]?.barcode || '',
                expected: m.product_uom_qty,
                picked: 0,
                packed: 0,
                moveId: m.id,
            })),
        };
    });
};

export const updateOrderStatus = async (odooConfig, orderId, status, extraData = {}) => {
    if (isMock(odooConfig)) {
        await delay(150);
        return { status: 'success', orderId, newStatus: status };
    }
    return odooPost(odooConfig, '/wms/orders/update', { order_id: orderId, status, ...extraData });
};

export const confirmRTS = async (odooConfig, orderId, platform) => {
    if (isMock(odooConfig)) {
        await delay(500);
        const platformPrefixes = {
            'Shopee Express': 'SPXTH', 'Lazada Express': 'LZTH', 'Flash Express': 'FLTH',
            'Kerry Express': 'KETH', 'J&T Express': 'JTTH', 'Thai Post': 'TPTH', 'TikTok Shop': 'TTTH'
        };
        const prefix = platformPrefixes[platform] || 'TH';
        const awb = prefix + Math.floor(Math.random() * 88888888 + 10000000);
        return { status: 'success', awb, trackingUrl: `https://track.example.com/${awb}` };
    }

    // Resolve picking ID — orderId may be a numeric Odoo ID or a ref string like 'WH/OUT/00104'
    let pickingId = Number(orderId);
    if (!pickingId || pickingId < 10) {
        // Likely a dummy/non-Odoo ID — try to find real picking by name/ref
        const found = await odooCallKw(odooConfig, 'stock.picking', 'search_read',
            [[['name', '=', String(orderId)], ['state', 'not in', ['cancel', 'done']]]],
            { fields: ['id', 'name'], limit: 1 }
        ).catch(() => []);
        if (found.length > 0) {
            pickingId = found[0].id;
        } else {
            throw new Error(`Picking not found in Odoo for: ${orderId} — please Sync Orders first`);
        }
    }

    // 1. Get demands from stock.move (source of truth for required qty)
    const moves = await odooCallKw(odooConfig, 'stock.move', 'search_read',
        [[['picking_id', '=', pickingId], ['state', 'not in', ['cancel', 'done']]]],
        { fields: ['id', 'product_id', 'product_uom_qty', 'location_id', 'location_dest_id'] }
    );

    // 2. Get picking's company + source location to restrict quant search
    const pickingInfo = await odooCallKw(odooConfig, 'stock.picking', 'read',
        [[pickingId]], { fields: ['company_id', 'location_id', 'location_dest_id'] }
    ).catch(() => [{}]);
    const companyId = pickingInfo[0]?.company_id?.[0];
    const pickingLocId = pickingInfo[0]?.location_id?.[0];
    const pickingDestId = pickingInfo[0]?.location_dest_id?.[0];

    for (const move of moves) {
        const demandQty = move.product_uom_qty;
        const productId = move.product_id[0];

        // Find stock location — restrict to same company to avoid cross-company errors
        const quantDomain = [
            ['product_id', '=', productId], ['quantity', '>', 0],
            ['location_id.usage', '=', 'internal'],
        ];
        if (companyId) quantDomain.push(['company_id', '=', companyId]);

        const quants = await odooCallKw(odooConfig, 'stock.quant', 'search_read',
            [quantDomain],
            { fields: ['id', 'location_id', 'quantity'], order: 'quantity desc', limit: 1 }
        ).catch(() => []);

        // Prefer picking's source location; fall back to quant location or move location
        const newLocId = pickingLocId || quants[0]?.location_id?.[0] || move.location_id[0];

        // Get or create move line for this move
        const existingLines = await odooCallKw(odooConfig, 'stock.move.line', 'search_read',
            [[['move_id', '=', move.id], ['state', 'not in', ['cancel', 'done']]]],
            { fields: ['id', 'location_id'] }
        ).catch(() => []);

        if (existingLines.length > 0) {
            // Reset location to picking's source (fixes any previous cross-company contamination)
            // and set full demand quantity
            await odooCallKw(odooConfig, 'stock.move.line', 'write',
                [[existingLines[0].id], { location_id: newLocId, quantity: demandQty }]
            ).catch(() => {});
        } else {
            // Create new move line with correct company location
            await odooCallKw(odooConfig, 'stock.move.line', 'create',
                [{ move_id: move.id, picking_id: pickingId, product_id: productId,
                   location_id: newLocId, location_dest_id: pickingDestId || move.location_dest_id?.[0] || move.location_id[0],
                   quantity: demandQty, product_uom_id: 1 }]
            ).catch(() => {});
        }
    }

    // 3. Validate with skip_immediate + skip_backorder context (Odoo 17+)
    let validateResult;
    let validateError = null;
    const validateCtx = { skip_immediate: true, skip_backorder: true, skip_sms: true };
    try {
        validateResult = await odooCallKw(odooConfig, 'stock.picking', 'button_validate',
            [[pickingId]], { context: validateCtx }
        );
    } catch (err) {
        validateError = err;
        validateResult = null;
    }

    // Handle wizard responses (backorder / immediate transfer — Odoo 16 fallback)
    if (validateResult && typeof validateResult === 'object' && validateResult.res_model) {
        try {
            const model = validateResult.res_model;
            const ctx = { ...validateCtx, ...(validateResult.context || {}) };
            if (model === 'stock.backorder.confirmation') {
                const wId = await odooCallKw(odooConfig, model, 'create', [{ pick_ids: [[4, pickingId]] }], { context: ctx });
                await odooCallKw(odooConfig, model, 'process', [[wId]], { context: ctx });
            } else if (model === 'stock.immediate.transfer') {
                const wId = await odooCallKw(odooConfig, model, 'create', [{ pick_ids: [[4, pickingId]] }], { context: ctx });
                await odooCallKw(odooConfig, model, 'process', [[wId]], { context: ctx });
            }
        } catch (wizardErr) {
            console.warn('Wizard handling failed:', wizardErr.message);
        }
    }

    // 4. Verify picking is actually 'done'
    const pickingCheck = await odooCallKw(odooConfig, 'stock.picking', 'read',
        [[pickingId]], { fields: ['state', 'name'] }
    ).catch(() => null);
    const finalState = pickingCheck?.[0]?.state;
    if (finalState && finalState !== 'done') {
        const reason = validateError?.message || `state = ${finalState}`;
        throw new Error(`Stock deduction failed: ${pickingCheck[0]?.name} — ${reason}`);
    }

    // 3. Find sale order linked to this picking, then create + post invoice
    let invoiceId = null;
    try {
        const pickingData = await odooCallKw(odooConfig, 'stock.picking', 'read',
            [[pickingId]], { fields: ['origin', 'sale_id'] }
        );
        const pd = pickingData[0];
        let saleOrderId = pd?.sale_id?.[0];

        if (!saleOrderId && pd?.origin) {
            const soSearch = await odooCallKw(odooConfig, 'sale.order', 'search_read',
                [[['name', '=', pd.origin]]],
                { fields: ['id'], limit: 1 }
            );
            saleOrderId = soSearch[0]?.id;
        }

        if (saleOrderId) {
            // Create invoice via sale.advance.payment.inv wizard
            const wizardId = await odooCallKw(odooConfig, 'sale.advance.payment.inv', 'create',
                [{ advance_payment_method: 'delivered', sale_order_ids: [[6, 0, [saleOrderId]]] }]
            );
            await odooCallKw(odooConfig, 'sale.advance.payment.inv', 'create_invoices', [[wizardId]]);

            // Find the created draft invoice and post it
            const invoices = await odooCallKw(odooConfig, 'account.move', 'search_read',
                [[['invoice_origin', 'ilike', pd.origin || ''], ['state', '=', 'draft'], ['move_type', '=', 'out_invoice']]],
                { fields: ['id'], limit: 1, order: 'id desc' }
            );
            if (invoices.length > 0) {
                invoiceId = invoices[0].id;
                await odooCallKw(odooConfig, 'account.move', 'action_post', [[invoiceId]]);
            }
        }
    } catch (invoiceErr) {
        console.warn('Auto-invoice failed (picking already validated):', invoiceErr.message);
    }

    // Generate AWB tracking number
    const platformPrefixes = {
        'Shopee Express': 'SPXTH', 'Lazada Express': 'LZTH', 'Flash Express': 'FLTH',
        'Kerry Express': 'KETH', 'J&T Express': 'JTTH', 'Thai Post': 'TPTH', 'TikTok Shop': 'TTTH'
    };
    const prefix = platformPrefixes[platform] || 'TH';
    const awb = prefix + Math.floor(Math.random() * 88888888 + 10000000);

    return {
        status: 'success',
        awb,
        trackingUrl: `https://track.example.com/${awb}`,
        invoiceId,
        pickingValidated: true,
    };
};

// ============ PICKFACE LOCATION ============

export const PICKFACE_LOCATION_NAME = 'PICKFACE';

// Call Odoo model method via JSON-RPC call_kw
const odooCallKw = async (odooConfig, model, method, args = [], kwargs = {}) => {
    const url = `${getOdooBase(odooConfig)}/web/dataset/call_kw`;
    if (!_sessionAuthenticated) await authenticateOdoo(odooConfig);
    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            jsonrpc: '2.0', method: 'call', id: Date.now(),
            params: { model, method, args, kwargs }
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.data?.message || data.error.message || 'Odoo Error');
    return data.result;
};

// Find or create the PICKFACE internal location under WH/Stock
export const ensurePickfaceLocation = async (odooConfig) => {
    if (isMock(odooConfig)) {
        return { id: 999, name: 'PICKFACE', complete_name: 'WH/Stock/PICKFACE' };
    }
    // Search existing
    const existing = await odooCallKw(odooConfig, 'stock.location', 'search_read',
        [[['name', '=', PICKFACE_LOCATION_NAME], ['usage', '=', 'internal']]],
        { fields: ['id', 'name', 'complete_name'], limit: 1 }
    );
    if (existing.length > 0) return existing[0];

    // Find parent: WH/Stock
    const parents = await odooCallKw(odooConfig, 'stock.location', 'search_read',
        [[['complete_name', 'ilike', 'WH/Stock'], ['usage', '=', 'internal']]],
        { fields: ['id', 'name', 'complete_name'], limit: 1 }
    );
    const parentId = parents[0]?.id;
    if (!parentId) throw new Error('WH/Stock location not found in Odoo');

    // Create PICKFACE
    const newId = await odooCallKw(odooConfig, 'stock.location', 'create',
        [{ name: PICKFACE_LOCATION_NAME, usage: 'internal', location_id: parentId }]
    );
    return { id: newId, name: PICKFACE_LOCATION_NAME, complete_name: `WH/Stock/${PICKFACE_LOCATION_NAME}` };
};

// ============ CREATE SALES ORDER IN ODOO ============

// All known product SKUs (default_code) used in the warehouse
const PICKFACE_SKUS = [
    'STDH080-REFILL', 'STBG080-REFILL', 'SWB700', 'SWH700',  // SKINOXY
    'SHGG030', 'SHLF030',                                       // SKINOXY Hydrogel Mask
    'KLA226', 'KMA088', 'KLMH180', 'KWAP380',                  // KISS-MY-BODY
];

// Platform → Odoo sales team name mapping
const PLATFORM_TEAM_MAP = {
    'Shopee Express': 'Shopee',
    'Lazada Express': 'eMarketplace',
    'TikTok Shop':    'Tiktok Shop',
    'Manual':         'Direct Sales',
};

// Platform → Odoo customer (partner) name mapping
const PLATFORM_CUSTOMER_MAP = {
    'Shopee Express': 'ECOMMERCE : SHOPEE',
    'Lazada Express': 'ECOMMERCE : LAZADA',
    'TikTok Shop':    'ECOMMERCE : TIKTOK',
};

/**
 * Create a Sales Order directly in Odoo.
 * @param {Object} odooConfig  - Odoo API config
 * @param {Object} orderData   - { platform, items: [{sku, qty}], note, sourceDoc }
 * @returns {{ soId, soName, pickingRef }}
 */
export const createSalesOrder = async (odooConfig, orderData) => {
    if (isMock(odooConfig)) {
        // Mock: return a fake result for UI testing
        await delay(600);
        const fakeRef = `WH/OUT/${String(Math.floor(Math.random() * 900) + 100).padStart(5, '0')}`;
        return { soId: Math.floor(Math.random() * 9000) + 1000, soName: `S${Date.now()}`, pickingRef: fakeRef };
    }

    const { platform = 'Manual', items = [], note = '', sourceDoc = '' } = orderData;

    // 1. Find product IDs by default_code
    const skus = items.map(i => i.sku).filter(Boolean);
    if (skus.length === 0) throw new Error('No products specified');

    const products = await odooCallKw(odooConfig, 'product.product', 'search_read',
        [[['default_code', 'in', skus], ['active', '=', true]]],
        { fields: ['id', 'default_code', 'name', 'lst_price', 'uom_id'] }
    );
    const productMap = Object.fromEntries(products.map(p => [p.default_code, p]));
    const missing = skus.filter(s => !productMap[s]);
    if (missing.length > 0) throw new Error(`Products not found in Odoo: ${missing.join(', ')}`);

    // 2. Find or create platform customer (partner)
    const customerName = PLATFORM_CUSTOMER_MAP[platform] || 'ECOMMERCE : WMS';
    const partners = await odooCallKw(odooConfig, 'res.partner', 'search_read',
        [[['name', '=', customerName]]],
        { fields: ['id', 'name'], limit: 1 }
    );
    let partnerId = partners[0]?.id;
    if (!partnerId) {
        // Create partner if not exists
        partnerId = await odooCallKw(odooConfig, 'res.partner', 'create',
            [{ name: customerName, customer_rank: 1 }]
        );
    }

    // 3. Find sales team
    const teamName = PLATFORM_TEAM_MAP[platform] || 'Direct Sales';
    const teams = await odooCallKw(odooConfig, 'crm.team', 'search_read',
        [[['name', 'ilike', teamName]]],
        { fields: ['id', 'name'], limit: 1 }
    );
    const teamId = teams[0]?.id || false;

    // 4. Build order lines
    const orderLines = items.map(({ sku, qty }) => {
        const p = productMap[sku];
        return [0, 0, {
            product_id: p.id,
            product_uom_qty: qty,
            price_unit: p.lst_price || 0,
        }];
    });

    // 5. Create SO
    const soVals = {
        partner_id: partnerId,
        order_line: orderLines,
        ...(teamId && { team_id: teamId }),
        ...(note && { note }),
        ...(sourceDoc && { client_order_ref: sourceDoc }),
    };
    const soId = await odooCallKw(odooConfig, 'sale.order', 'create', [soVals]);

    // 6. Confirm SO → auto-creates WH/OUT picking
    await odooCallKw(odooConfig, 'sale.order', 'action_confirm', [[soId]]);

    // 7. Fetch SO name + picking ref
    const soData = await odooCallKw(odooConfig, 'sale.order', 'read',
        [[soId]], { fields: ['name', 'picking_ids'] }
    );
    const soName = soData[0]?.name || '';
    let pickingRef = '';
    if (soData[0]?.picking_ids?.length > 0) {
        const pickings = await odooCallKw(odooConfig, 'stock.picking', 'read',
            [soData[0].picking_ids], { fields: ['name'] }
        );
        pickingRef = pickings[0]?.name || '';
    }

    return { soId, soName, pickingRef };
};

// Alias for backward compatibility (Settings.jsx uses this name)
export const createTestSalesOrders = async (odooConfig, count = 5) => {
    const skus = PICKFACE_SKUS.slice(0, 4);
    const platforms = ['Shopee Express', 'Lazada Express', 'TikTok Shop', 'Shopee Express', 'Manual'];
    const createdIds = [];
    for (let i = 0; i < count; i++) {
        const picked = skus.slice(0, Math.floor(Math.random() * 3) + 1);
        const items = picked.map(sku => ({ sku, qty: Math.floor(Math.random() * 3) + 1 }));
        const result = await createSalesOrder(odooConfig, {
            platform: platforms[i % platforms.length],
            items,
        });
        createdIds.push(result.soId);
    }
    return { created: createdIds.length, ids: createdIds };
};

// ============ INVENTORY ============

export const fetchInventory = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(250);
        const stored = JSON.parse(localStorage.getItem('wms_inventory') || 'null');
        if (stored) return stored;
        return [
            { sku: 'STDH080-REFILL', name: 'SKINOXY Refill Toner Pad 150 ml', shortName: 'Refill Toner Pad (Dewy)', location: 'A-01-01', onHand: 450, reserved: 12, available: 438, unitCost: 189, reorderPoint: 50, lots: [
                { lotNumber: 'LOT-2026-001', expiryDate: '2027-06-15', qty: 200, receivedDate: '2026-01-10' },
                { lotNumber: 'LOT-2026-002', expiryDate: '2027-09-20', qty: 250, receivedDate: '2026-02-28' }
            ]},
            { sku: 'STBG080-REFILL', name: 'SKINOXY Refill Toner Pad 150 ml (Bright & Glow)', shortName: 'Toner Pad Refill (Bright)', location: 'A-01-02', onHand: 320, reserved: 6, available: 314, unitCost: 199, reorderPoint: 40, lots: [
                { lotNumber: 'LOT-2026-003', expiryDate: '2027-08-01', qty: 320, receivedDate: '2026-02-15' }
            ]},
            { sku: 'SWB700', name: 'SKINOXY Body Wash 700ml (Brightening)', shortName: 'Body Wash (Bright)', location: 'B-02-01', onHand: 180, reserved: 4, available: 176, unitCost: 259, reorderPoint: 30, lots: [
                { lotNumber: 'LOT-2025-010', expiryDate: '2027-03-10', qty: 80, receivedDate: '2025-09-20' },
                { lotNumber: 'LOT-2026-004', expiryDate: '2027-12-01', qty: 100, receivedDate: '2026-03-01' }
            ]},
            { sku: 'SWH700', name: 'SKINOXY Body Wash 700ml (Hydrating)', shortName: 'Body Wash (Hydra)', location: 'B-02-02', onHand: 95, reserved: 5, available: 90, unitCost: 259, reorderPoint: 30, lots: [
                { lotNumber: 'LOT-2026-005', expiryDate: '2027-11-15', qty: 95, receivedDate: '2026-03-05' }
            ]}
        ];
    }
    // Live mode: fetch stock.quant from configured allowed locations
    const allowedLoc = getStoredAllowedLocations();
    // Build OR domain for each keyword
    let locDomain;
    if (allowedLoc.length === 0) {
        locDomain = [['location_id.usage', '=', 'internal']];
    } else if (allowedLoc.length === 1) {
        locDomain = [['location_id.complete_name', 'ilike', allowedLoc[0]], ['location_id.usage', '=', 'internal']];
    } else {
        // Odoo domain OR: ['|', cond1, cond2, ...] — chain ORs
        const ors = [];
        for (let i = 0; i < allowedLoc.length - 1; i++) ors.push('|');
        const conds = allowedLoc.map(kw => ['location_id.complete_name', 'ilike', kw]);
        locDomain = [...ors, ...conds, ['location_id.usage', '=', 'internal']];
    }
    const quants = await odooCallKw(odooConfig, 'stock.quant', 'search_read',
        [locDomain],
        { fields: ['product_id', 'lot_id', 'quantity', 'reserved_quantity', 'location_id'] }
    );
    // Group by product
    const grouped = {};
    for (const q of quants) {
        const key = q.product_id[0];
        if (!grouped[key]) grouped[key] = { productId: key, name: q.product_id[1], location: q.location_id[1], onHand: 0, reserved: 0, lots: [] };
        grouped[key].onHand += q.quantity;
        grouped[key].reserved += q.reserved_quantity;
        if (q.lot_id) grouped[key].lots.push({ lotNumber: q.lot_id[1], qty: q.quantity });
    }
    // Fetch SKU (default_code) for each product
    const productIds = Object.keys(grouped).map(Number);
    let skuMap = {};
    if (productIds.length > 0) {
        const products = await odooCallKw(odooConfig, 'product.product', 'read',
            [productIds], { fields: ['id', 'default_code'] }
        );
        for (const p of products) skuMap[p.id] = p.default_code || '';
    }
    return Object.values(grouped).map(g => ({
        ...g,
        sku: skuMap[g.productId] || g.name,
        shortName: skuMap[g.productId] || '',
        available: g.onHand - g.reserved,
        unitCost: 0,
        reorderPoint: 10,
    }));
};

export const updateInventory = async (odooConfig, sku, adjustment, reason, lotNumber) => {
    if (isMock(odooConfig)) {
        await delay(200);
        return { status: 'success', sku, newQty: adjustment };
    }
    return odooPost(odooConfig, '/wms/inventory/adjust', { sku, adjustment, reason, lot_number: lotNumber, location: PICKFACE_LOCATION_NAME });
};

// ============ WAVES / SORTING ============

export const fetchWaves = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(200);
        return JSON.parse(localStorage.getItem('wms_waves') || '[]');
    }
    return odooPost(odooConfig, '/wms/waves/list');
};

export const createWave = async (odooConfig, waveName, orderIds, waveType) => {
    if (isMock(odooConfig)) {
        await delay(300);
        return {
            status: 'success',
            wave: { id: 'WAVE-' + Date.now(), name: waveName, type: waveType, orderIds, status: 'active', createdAt: Date.now() }
        };
    }
    return odooPost(odooConfig, '/wms/waves/create', { name: waveName, order_ids: orderIds, type: waveType });
};

export const closeWave = async (odooConfig, waveId) => {
    if (isMock(odooConfig)) {
        await delay(200);
        return { status: 'success', waveId };
    }
    return odooPost(odooConfig, '/wms/waves/close', { wave_id: waveId });
};

// ============ INVOICES ============

export const fetchInvoices = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(250);
        return JSON.parse(localStorage.getItem('wms_invoices') || '[]');
    }

    // Live: fetch from Odoo account.move (customer invoices only)
    const moves = await odooCallKw(odooConfig, 'account.move', 'search_read',
        [[['move_type', '=', 'out_invoice'], ['state', 'not in', ['cancel']]]],
        {
            fields: ['id', 'name', 'partner_id', 'invoice_date', 'invoice_date_due',
                     'state', 'payment_state', 'amount_untaxed', 'amount_tax',
                     'amount_total', 'invoice_origin', 'invoice_line_ids'],
            order: 'id desc',
            limit: 200,
        }
    );
    if (!moves || moves.length === 0) return [];

    // Batch fetch all invoice lines in one call
    const allLineIds = moves.flatMap(m => m.invoice_line_ids);
    let lineMap = {}; // move_id → lines[]
    if (allLineIds.length > 0) {
        const lines = await odooCallKw(odooConfig, 'account.move.line', 'search_read',
            [[['id', 'in', allLineIds], ['display_type', '=', 'product']]],
            { fields: ['move_id', 'product_id', 'name', 'quantity', 'price_unit', 'price_subtotal', 'price_total'] }
        ).catch(() => []);
        for (const l of lines) {
            const mid = l.move_id[0];
            if (!lineMap[mid]) lineMap[mid] = [];
            // Extract SKU from product name [SKU] or use default_code
            const skuMatch = l.name?.match(/^\[([^\]]+)\]/);
            lineMap[mid].push({
                sku: skuMatch?.[1] || l.product_id?.[1]?.match(/^\[([^\]]+)\]/)?.[1] || '',
                name: l.name?.replace(/^\[[^\]]+\]\s*/, '') || l.product_id?.[1] || '',
                qty: l.quantity,
                unitPrice: l.price_unit,
                subtotal: l.price_subtotal,
                total: l.price_total,
            });
        }
    }

    const mapStatus = (state, paymentState) => {
        if (state === 'draft') return 'draft';
        if (paymentState === 'paid' || paymentState === 'in_payment') return 'paid';
        return 'posted';
    };

    return moves.map(m => ({
        id: m.name,                              // INV/2026/00006
        odooId: m.id,
        orderRef: m.invoice_origin || m.name,    // S00100 or INV number
        customer: m.partner_id?.[1] || '',
        platform: '',                            // resolved later if needed
        items: lineMap[m.id] || [],
        subtotal: m.amount_untaxed,
        tax: m.amount_tax,
        total: m.amount_total,
        status: mapStatus(m.state, m.payment_state),
        invoiceDate: m.invoice_date,
        dueDate: m.invoice_date_due,
        paymentState: m.payment_state,
        createdAt: m.invoice_date ? new Date(m.invoice_date).getTime() : Date.now(),
        postedAt: m.state === 'posted' ? new Date(m.invoice_date).getTime() : null,
    }));
};

export const createInvoice = async (odooConfig, order) => {
    if (isMock(odooConfig)) {
        await delay(300);
        const totalAmount = order.items.reduce((sum, item) => {
            const qty = item.picked || item.expected || 0;
            const price = item.unitPrice || 299;
            return sum + (qty * price);
        }, 0);
        const tax = Math.round(totalAmount * 0.07);
        return {
            status: 'success',
            invoice: {
                id: 'INV-' + Date.now(),
                orderRef: order.ref,
                customer: order.customer,
                platform: order.platform || order.courier,
                items: order.items.map(i => ({ sku: i.sku, name: i.name, qty: i.picked || i.expected, unitPrice: i.unitPrice || 299 })),
                subtotal: totalAmount,
                tax,
                total: totalAmount + tax,
                status: 'draft',
                createdAt: Date.now()
            }
        };
    }
    return odooPost(odooConfig, '/wms/invoices/create', { order_id: order.id });
};

export const postInvoice = async (odooConfig, invoiceId) => {
    if (isMock(odooConfig)) {
        await delay(400);
        return { status: 'success', invoiceId, postedAt: Date.now() };
    }
    return odooPost(odooConfig, '/wms/invoices/post', { invoice_id: invoiceId });
};

// ============ PLATFORM ORDERS ============

export const fetchPlatformOrders = async (odooConfig, platform) => {
    if (isMock(odooConfig)) {
        await delay(400);
        const mockPlatformOrders = {
            'shopee': [
                { id: Date.now() + 1, ref: 'SHP-' + Math.floor(Math.random() * 90000 + 10000), customer: 'Shopee Customer', platform: 'Shopee Express', courier: 'Shopee Express', status: 'pending', createdAt: Date.now(), items: [{ sku: 'STDH080-REFILL', name: 'SKINOXY Refill Toner Pad', expected: 2, picked: 0, packed: 0, unitPrice: 299 }] }
            ],
            'lazada': [
                { id: Date.now() + 2, ref: 'LZD-' + Math.floor(Math.random() * 90000 + 10000), customer: 'Lazada Customer', platform: 'Lazada Express', courier: 'Lazada Express', status: 'pending', createdAt: Date.now(), items: [{ sku: 'STBG080-REFILL', name: 'SKINOXY Refill Toner Pad (Bright)', expected: 1, picked: 0, packed: 0, unitPrice: 329 }] }
            ],
            'tiktok': [
                { id: Date.now() + 3, ref: 'TKT-' + Math.floor(Math.random() * 90000 + 10000), customer: 'TikTok Customer', platform: 'TikTok Shop', courier: 'J&T Express', status: 'pending', createdAt: Date.now(), items: [{ sku: 'SWB700', name: 'SKINOXY Body Wash (Bright)', expected: 1, picked: 0, packed: 0, unitPrice: 399 }] }
            ]
        };
        return mockPlatformOrders[platform] || [];
    }
    return odooPost(odooConfig, '/wms/platform/orders', { platform });
};

export const syncAllPlatforms = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(800);
        const shopee = await fetchPlatformOrders(odooConfig, 'shopee');
        const lazada = await fetchPlatformOrders(odooConfig, 'lazada');
        const tiktok = await fetchPlatformOrders(odooConfig, 'tiktok');
        return { shopee, lazada, tiktok, total: shopee.length + lazada.length + tiktok.length };
    }
    return odooPost(odooConfig, '/wms/platform/sync');
};

// ============ AI BRAIN ============

export const fetchAiSuggestion = async (odooConfig, pickingId, question) => {
    if (isMock(odooConfig)) {
        await delay(600);
        const suggestions = [
            'Pack fragile items first with bubble wrap, then stack heavier items at the bottom.',
            'Use Box M for this order. Total weight ~0.53kg fits well within limits.',
            'FEFO: Use LOT-2025-010 first (expires 2027-03-10) before newer lots.',
            'Group items by type: Body Wash together, Toner Pads together for efficient packing.',
        ];
        return { status: 'success', suggestion: suggestions[Math.floor(Math.random() * suggestions.length)] };
    }
    return odooPost(odooConfig, '/wms/ai/ask', { picking_id: pickingId, question });
};

// ============ CONNECTION ============

export const testConnection = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(500);
        return { status: 'success', version: 'Odoo 18.0 (Mock)', database: odooConfig.db || 'Demo Mode — no live database' };
    }
    try {
        // All requests go through Vite proxy → no CORS issues
        const response = await fetchWithTimeout(`${getOdooBase(odooConfig)}/wms/connection/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        const data = await response.json();
        if (data.result) {
            try {
                await authenticateOdoo(odooConfig);
                return { ...data.result, authenticated: true };
            } catch {
                return { ...data.result, authenticated: false, authError: 'Could not authenticate - check credentials' };
            }
        }
        return { status: 'error', message: 'Unexpected response' };
    } catch (err) {
        // Fallback: standard Odoo session info (also proxied)
        try {
            const response = await fetchWithTimeout(`/web/session/get_session_info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ jsonrpc: '2.0', params: {} })
            });
            const data = await response.json();
            return { status: 'success', version: data.result?.server_version || 'Odoo', database: data.result?.db || odooConfig.db };
        } catch (fallbackErr) {
            return { status: 'error', message: `Cannot reach Odoo: ${err.message}` };
        }
    }
};

// ============ PRODUCTS ============

export const fetchProducts = async (odooConfig) => {
    if (isMock(odooConfig)) return null;
    try {
        const products = await odooCallKw(odooConfig, 'product.product', 'search_read',
            [[['active', '=', true], ['default_code', '!=', false]]],
            { fields: ['id', 'name', 'default_code', 'barcode'], limit: 500 }
        );
        return products.map(p => ({
            id: p.id,
            sku: p.default_code || '',
            name: p.name,
            barcode: p.barcode || '',
        }));
    } catch {
        return null;
    }
};

// Reset session (call when user changes Odoo config)
export const resetOdooSession = () => {
    _sessionAuthenticated = false;
    _sessionUid = null;
};

// ============ LOCATION CONFIG ============

// Default allowed location keywords (stored in localStorage)
const LS_LOCATIONS_KEY = 'wms_allowed_locations';

export const getStoredAllowedLocations = () => {
    try {
        const v = localStorage.getItem(LS_LOCATIONS_KEY);
        if (v) return JSON.parse(v);
    } catch {}
    // Default: accept PICKFACE and any WH/Stock sub-location
    return ['PICKFACE', 'WH/Stock'];
};

export const saveAllowedLocations = (list) => {
    localStorage.setItem(LS_LOCATIONS_KEY, JSON.stringify(list));
};

// Fetch all internal stock locations from Odoo (for the picker UI)
export const fetchAllLocations = async (odooConfig) => {
    if (isMock(odooConfig)) {
        await delay(150);
        return [
            { id: 1, name: 'WH/Stock',              complete_name: 'WH/Stock' },
            { id: 2, name: 'WH/Stock/PICKFACE',     complete_name: 'WH/Stock/PICKFACE' },
            { id: 3, name: 'WH/Stock/BIN-A-01',     complete_name: 'WH/Stock/BIN-A-01' },
            { id: 4, name: 'WH/Stock/BIN-A-02',     complete_name: 'WH/Stock/BIN-A-02' },
            { id: 5, name: 'WH/Stock/BIN-B-01',     complete_name: 'WH/Stock/BIN-B-01' },
            { id: 6, name: 'WH/Stock/BULK',         complete_name: 'WH/Stock/BULK' },
            { id: 7, name: 'WH2/Stock',             complete_name: 'WH2/Stock' },
            { id: 8, name: 'WH2/Stock/PICKFACE',    complete_name: 'WH2/Stock/PICKFACE' },
        ];
    }
    return await odooCallKw(odooConfig, 'stock.location', 'search_read',
        [[['usage', '=', 'internal'], ['active', '=', true]]],
        { fields: ['id', 'name', 'complete_name'], order: 'complete_name asc', limit: 200 }
    );
};

// ============ SALE ORDER HISTORY (for Platform Monitor Reports) ============

/**
 * Fetch historical sale.order data grouped by date + platform.
 * Live mode: queries Odoo sale.order with date_order >= (today - days).
 *   Platform is detected from sale.order.team_id.name or channel/tag.
 *   Returns same shape as generateHistoricalData() so ReportsView works identically.
 * Mock mode: returns null (caller falls back to generateHistoricalData).
 */
export const fetchSaleOrderHistory = async (odooConfig, { days = 7 } = {}) => {
    if (isMock(odooConfig)) return null;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days + 1);
    dateFrom.setHours(0, 0, 0, 0);
    const dateFromStr = dateFrom.toISOString().replace('T', ' ').split('.')[0];

    // Odoo state → WMS status
    const stateToStatus = (state) => {
        if (['done', 'sale'].includes(state)) return 'shipped';
        if (state === 'cancel') return 'cancelled';
        return 'pending';
    };

    // Detect platform key from sale team name or source
    const detectPlatform = (teamName = '', sourceName = '') => {
        const s = (teamName + ' ' + sourceName).toLowerCase();
        if (s.includes('shopee')) return 'shopee';
        if (s.includes('lazada')) return 'lazada';
        if (s.includes('tiktok') || s.includes('tik tok')) return 'tiktok';
        return 'manual';
    };

    const emptyDay = () => ({
        shopee:  { total: 0, shipped: 0, late: 0, cancelled: 0, pending: 0 },
        lazada:  { total: 0, shipped: 0, late: 0, cancelled: 0, pending: 0 },
        tiktok:  { total: 0, shipped: 0, late: 0, cancelled: 0, pending: 0 },
        manual:  { total: 0, shipped: 0, late: 0, cancelled: 0, pending: 0 },
    });

    // SLA windows per platform (hours)
    const SLA = { shopee: 24, lazada: 24, tiktok: 24, manual: null };

    try {
        const orders = await odooCallKw(odooConfig, 'sale.order', 'search_read',
            [[['date_order', '>=', dateFromStr], ['state', '!=', 'draft']]],
            {
                fields: ['name', 'date_order', 'state', 'team_id', 'source_id', 'commitment_date'],
                order: 'date_order asc',
                limit: 5000,
            }
        );

        const buckets = {};   // { 'YYYY-MM-DD': emptyDay() }

        for (const order of orders) {
            const date = (order.date_order || '').split(' ')[0];
            if (!date) continue;
            if (!buckets[date]) buckets[date] = emptyDay();

            const pk = detectPlatform(
                order.team_id?.[1] || '',
                order.source_id?.[1] || ''
            );

            const status = stateToStatus(order.state);
            buckets[date][pk].total++;
            buckets[date][pk][status]++;

            // Mark late: committed date passed and not shipped/cancelled
            if (SLA[pk] && status === 'pending') {
                const createdMs = new Date(order.date_order).getTime();
                const ageH = (Date.now() - createdMs) / 3600000;
                if (ageH > SLA[pk]) buckets[date][pk].late++;
            }
        }

        // Ensure all days in range are present (fill gaps)
        for (let i = 0; i < days; i++) {
            const d = new Date(dateFrom);
            d.setDate(d.getDate() + i);
            const ds = d.toISOString().split('T')[0];
            if (!buckets[ds]) buckets[ds] = emptyDay();
        }

        return Object.entries(buckets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({
                date,
                label: new Date(date + 'T12:00:00').toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
                isSpike: false,
                ...data,
            }));
    } catch (e) {
        console.warn('[fetchSaleOrderHistory]', e);
        return null;  // caller falls back to mock data
    }
};

// ============ STOCK HISTORY ============

export const fetchStockHistory = async (odooConfig, productId, locationKeywords = [], limit = 50) => {
    if (isMock(odooConfig)) {
        await delay(300);
        // Return null — caller will use mock generator
        return null;
    }
    // Build domain: find stock.move.line for this product, done state
    const domain = [
        ['product_id', '=', productId],
        ['state', '=', 'done'],
    ];
    // If location filter is provided, add it
    if (locationKeywords.length > 0) {
        const locDomain = locationKeywords.flatMap(kw => [
            ['location_id.complete_name', 'ilike', kw],
        ]);
        // OR all location conditions
        domain.push('|');
        domain.push(...locDomain.slice(0, 2)); // basic: first two
    }
    try {
        const lines = await odooCallKw(odooConfig, 'stock.move.line', 'search_read',
            [domain],
            {
                fields: ['date', 'reference', 'product_id', 'lot_id', 'qty_done',
                         'location_id', 'location_dest_id', 'picking_id', 'move_id'],
                order: 'date desc',
                limit,
            }
        );
        // Compute running balance from moves
        let balance = 0;
        const rows = [];
        for (let i = lines.length - 1; i >= 0; i--) {
            const ml = lines[i];
            const isOutgoing = ml.location_dest_id[1]?.includes('Customer') ||
                               ml.location_dest_id[1]?.includes('Virtual');
            const qty = isOutgoing ? -(ml.qty_done || 0) : (ml.qty_done || 0);
            balance += qty;
            rows.unshift({
                date:    new Date(ml.date).toLocaleString(),
                type:    isOutgoing ? 'delivery' : 'receipt',
                ref:     ml.reference || ml.picking_id?.[1] || '—',
                partner: '—',
                qty,
                balance,
                locationFrom: ml.location_id[1],
                locationTo:   ml.location_dest_id[1],
            });
        }
        return rows;
    } catch (e) {
        console.warn('fetchStockHistory error:', e);
        return null;
    }
};
