// ─────────────────────────────────────────────────────────────
//  Unified Platform API — Single facade for all 7 platforms
//  Usage:
//    import platformApi from './services/platformApi';
//    platformApi.configure('shopee', { partnerId, partnerKey, shopId });
//    const result = await platformApi.getOrders('shopee');
//    const tracking = await platformApi.getTracking('flash', 'TH12345678');
// ─────────────────────────────────────────────────────────────

import adapters, { PLATFORM_LABEL_MAP, ADAPTER_LABEL_MAP, MARKETPLACES, COURIERS } from './platforms/index.js';

const LS_KEY = 'wms_platform_configs';

class PlatformApi {
    constructor() {
        this._loadConfigs();
    }

    // ── Config Persistence ─────────────────────────────────────
    _loadConfigs() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const configs = JSON.parse(raw);
                Object.entries(configs).forEach(([key, cfg]) => {
                    if (adapters[key]) adapters[key].setConfig(cfg);
                });
            }
        } catch { /* ignore */ }
    }

    _saveConfigs() {
        try {
            const configs = {};
            Object.entries(adapters).forEach(([key, adapter]) => {
                configs[key] = adapter.config;
            });
            localStorage.setItem(LS_KEY, JSON.stringify(configs));
        } catch { /* ignore */ }
    }

    // ── Public: Configuration ──────────────────────────────────

    /** Configure a platform with API credentials */
    configure(platformKey, config) {
        const adapter = this._getAdapter(platformKey);
        adapter.setConfig(config);
        this._saveConfigs();
    }

    /** Get config for a platform */
    getConfig(platformKey) {
        return this._getAdapter(platformKey).config;
    }

    /** Get UI field definitions for settings page */
    getConfigFields(platformKey) {
        return this._getAdapter(platformKey).getConfigFields();
    }

    /** Check if a platform has valid config */
    isConfigured(platformKey) {
        return this._getAdapter(platformKey).isConfigured();
    }

    /** Get all platform statuses */
    getAllStatus() {
        return Object.entries(adapters).map(([key, adapter]) => ({
            key,
            name: adapter.displayName,
            configured: adapter.isConfigured(),
            type: MARKETPLACES.includes(key) ? 'marketplace' : 'courier',
            wmsPlatformLabel: ADAPTER_LABEL_MAP[key] || key,
        }));
    }

    // ── Public: Connection Test ────────────────────────────────

    /** Test connection for a specific platform */
    async testConnection(platformKey) {
        const adapter = this._getAdapter(platformKey);
        if (!adapter.isConfigured()) {
            return { success: false, error: `${adapter.displayName} is not configured` };
        }
        try {
            return await adapter.testConnection();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /** Test all configured platforms */
    async testAllConnections() {
        const results = {};
        const promises = Object.entries(adapters)
            .filter(([, adapter]) => adapter.isConfigured())
            .map(async ([key, adapter]) => {
                try {
                    results[key] = await adapter.testConnection();
                } catch (err) {
                    results[key] = { success: false, error: err.message };
                }
            });
        await Promise.allSettled(promises);
        return results;
    }

    // ── Public: Auth (OAuth platforms) ──────────────────────────

    /** Get OAuth authorization URL (Shopee, Lazada, TikTok) */
    getAuthUrl(platformKey) {
        const adapter = this._getAdapter(platformKey);
        if (typeof adapter.getAuthUrl !== 'function') {
            throw new Error(`${adapter.displayName} does not use OAuth flow`);
        }
        return adapter.getAuthUrl();
    }

    /** Exchange auth code for tokens */
    async authenticate(platformKey, code, extraParams = {}) {
        const adapter = this._getAdapter(platformKey);
        return adapter.authenticate(code, extraParams);
    }

    /** Refresh token manually */
    async refreshToken(platformKey) {
        const adapter = this._getAdapter(platformKey);
        return adapter.refreshToken();
    }

    // ── Public: Orders (Marketplaces) ──────────────────────────

    /** Fetch orders from a marketplace platform */
    async getOrders(platformKey, params = {}) {
        const adapter = this._getAdapter(platformKey);
        return adapter.getOrders(params);
    }

    /** Get single order detail */
    async getOrderDetail(platformKey, orderId) {
        const adapter = this._getAdapter(platformKey);
        return adapter.getOrderDetail(orderId);
    }

    /** Fetch orders from ALL configured marketplaces */
    async getAllMarketplaceOrders(params = {}) {
        const results = {};
        const promises = MARKETPLACES
            .filter(key => adapters[key].isConfigured())
            .map(async key => {
                try {
                    results[key] = await adapters[key].getOrders(params);
                } catch (err) {
                    results[key] = { orders: [], error: err.message };
                }
            });
        await Promise.allSettled(promises);
        return results;
    }

    // ── Public: Shipping & Fulfillment ─────────────────────────

    /** Ship order on marketplace (generate AWB, mark shipped) */
    async shipOrder(platformKey, orderId, shipData = {}) {
        const adapter = this._getAdapter(platformKey);
        return adapter.shipOrder(orderId, shipData);
    }

    /** Get shipping label (PDF/HTML) */
    async getShippingLabel(platformKey, orderId) {
        const adapter = this._getAdapter(platformKey);
        return adapter.getShippingLabel(orderId);
    }

    /** Cancel order on platform */
    async cancelOrder(platformKey, orderId, reason = '') {
        const adapter = this._getAdapter(platformKey);
        return adapter.cancelOrder(orderId, reason);
    }

    // ── Public: Courier Operations ─────────────────────────────

    /** Create shipment with a courier (Flash, Kerry, J&T) */
    async createShipment(courierKey, shipmentData) {
        const adapter = this._getAdapter(courierKey);
        return adapter.createShipment(shipmentData);
    }

    /** Get shipping rate from courier */
    async getRate(courierKey, rateParams) {
        const adapter = this._getAdapter(courierKey);
        return adapter.getRate(rateParams);
    }

    // ── Public: Tracking (All platforms) ───────────────────────

    /** Get tracking info for a shipment */
    async getTracking(platformKey, trackingNumber) {
        const adapter = this._getAdapter(platformKey);
        return adapter.getTracking(trackingNumber);
    }

    /** Bulk tracking — auto-detect courier from tracking number */
    async bulkTracking(trackingNumbers) {
        const grouped = {};
        for (const tn of trackingNumbers) {
            const courier = this._detectCourier(tn);
            if (!grouped[courier]) grouped[courier] = [];
            grouped[courier].push(tn);
        }

        const results = {};
        const promises = Object.entries(grouped).map(async ([courier, numbers]) => {
            try {
                if (courier === 'thaipost') {
                    // Thai Post supports batch tracking
                    results[courier] = await adapters.thaipost.getTracking(numbers);
                } else {
                    // Others: one by one
                    results[courier] = [];
                    for (const tn of numbers) {
                        try {
                            const data = await adapters[courier].getTracking(tn);
                            results[courier].push({ trackingNumber: tn, ...data });
                        } catch (err) {
                            results[courier].push({ trackingNumber: tn, error: err.message });
                        }
                    }
                }
            } catch (err) {
                results[courier] = { error: err.message };
            }
        });
        await Promise.allSettled(promises);
        return results;
    }

    // ── Public: Products (Marketplaces) ────────────────────────

    /** Fetch products from a marketplace */
    async getProducts(platformKey, params = {}) {
        const adapter = this._getAdapter(platformKey);
        return adapter.getProducts(params);
    }

    // ── Smart Order Routing ────────────────────────────────────

    /**
     * Auto-select best courier for an order based on:
     * - Platform default (Shopee→SPX, Lazada→LEX, TikTok→J&T)
     * - Destination postcode / coverage
     * - COD availability
     * - Cheapest rate (if rate APIs available)
     */
    async suggestCourier(order) {
        const platform = order.platform || '';
        const adapterKey = PLATFORM_LABEL_MAP[platform];

        // Default courier mapping
        const defaultCourier = {
            shopee: 'shopee',   // Shopee uses own logistics
            lazada: 'lazada',   // Lazada uses own logistics
            tiktok: 'jt',      // TikTok typically uses J&T in TH
        };

        // If marketplace handles fulfillment, use their built-in logistics
        if (adapterKey && MARKETPLACES.includes(adapterKey)) {
            return {
                recommended: defaultCourier[adapterKey] || 'flash',
                reason: `${platform} orders use platform logistics by default`,
                alternatives: ['flash', 'kerry', 'jt'],
            };
        }

        // For manual/direct orders, compare rates if possible
        const postcode = order.recipientPostcode || order.postcode || '';
        const weight = order.totalWeight || 1;
        const rates = {};

        const courierCandidates = ['flash', 'jt', 'kerry'];
        for (const c of courierCandidates) {
            if (adapters[c].isConfigured()) {
                try {
                    const rate = await adapters[c].getRate({
                        originPostcode: '10110', // Default warehouse postcode
                        destPostcode: postcode,
                        weight,
                    });
                    rates[c] = rate;
                } catch { /* skip */ }
            }
        }

        // Find cheapest
        const cheapest = Object.entries(rates)
            .sort(([, a], [, b]) => (a.totalPrice || 999) - (b.totalPrice || 999))[0];

        return {
            recommended: cheapest ? cheapest[0] : 'flash',
            reason: cheapest ? `Cheapest rate: ${cheapest[1].totalPrice}` : 'Default courier (Flash Express)',
            alternatives: courierCandidates,
            rates,
        };
    }

    // ── Unified Order Sync ─────────────────────────────────────

    /**
     * Sync orders from all configured marketplaces and normalize
     * into WMS order format (compatible with salesOrders state)
     */
    async syncMarketplaceOrders() {
        const allOrders = await this.getAllMarketplaceOrders();
        const normalized = [];

        for (const [platform, result] of Object.entries(allOrders)) {
            if (result.error) continue;
            const orders = result.orders || [];
            const wmsPlatform = ADAPTER_LABEL_MAP[platform];

            for (const order of orders) {
                normalized.push(this._normalizeOrder(platform, wmsPlatform, order));
            }
        }

        return normalized;
    }

    _normalizeOrder(platform, wmsPlatform, raw) {
        switch (platform) {
            case 'shopee':
                return {
                    id: raw.order_sn,
                    ref: `SPX-${raw.order_sn}`,
                    soRef: raw.order_sn,
                    customer: raw.buyer_username || 'Shopee Customer',
                    platform: wmsPlatform,
                    courier: 'Shopee Express',
                    status: this._mapShopeeStatus(raw.order_status),
                    createdAt: (raw.create_time || 0) * 1000,
                    items: (raw.item_list || []).map(i => ({
                        sku: i.item_sku || i.model_sku || '',
                        name: i.item_name || '',
                        expected: i.model_quantity_purchased || 1,
                        picked: 0,
                        packed: 0,
                    })),
                    _raw: raw,
                };
            case 'lazada':
                return {
                    id: raw.order_id || raw.order_number,
                    ref: `LZD-${raw.order_id}`,
                    soRef: raw.order_number || raw.order_id?.toString(),
                    customer: raw.customer_first_name || 'Lazada Customer',
                    platform: wmsPlatform,
                    courier: 'Lazada Express',
                    status: this._mapLazadaStatus(raw.statuses?.[0] || raw.status),
                    createdAt: new Date(raw.created_at).getTime(),
                    items: (raw.items || []).map(i => ({
                        sku: i.sku || '',
                        name: i.name || '',
                        expected: i.quantity || 1,
                        picked: 0,
                        packed: 0,
                    })),
                    _raw: raw,
                };
            case 'tiktok':
                return {
                    id: raw.order_id,
                    ref: `TT-${raw.order_id}`,
                    soRef: raw.order_id,
                    customer: raw.buyer_message || 'TikTok Customer',
                    platform: wmsPlatform,
                    courier: 'J&T Express',
                    status: this._mapTikTokStatus(raw.order_status),
                    createdAt: (raw.create_time || 0) * 1000,
                    items: (raw.item_list || raw.line_items || []).map(i => ({
                        sku: i.seller_sku || i.sku_id || '',
                        name: i.product_name || '',
                        expected: i.quantity || 1,
                        picked: 0,
                        packed: 0,
                    })),
                    _raw: raw,
                };
            default:
                return { id: raw.id, platform: wmsPlatform, _raw: raw };
        }
    }

    _mapShopeeStatus(s) {
        const map = {
            UNPAID: 'pending', READY_TO_SHIP: 'pending', PROCESSED: 'picking',
            SHIPPED: 'rts', COMPLETED: 'rts', IN_CANCEL: 'cancelled',
            CANCELLED: 'cancelled', INVOICE_PENDING: 'pending',
        };
        return map[s] || 'pending';
    }

    _mapLazadaStatus(s) {
        const map = {
            pending: 'pending', ready_to_ship: 'pending', packed: 'packed',
            shipped: 'rts', delivered: 'rts', canceled: 'cancelled',
            returned: 'cancelled', failed: 'cancelled',
        };
        return map[s] || 'pending';
    }

    _mapTikTokStatus(s) {
        const map = {
            AWAITING_SHIPMENT: 'pending', AWAITING_COLLECTION: 'packed',
            IN_TRANSIT: 'rts', DELIVERED: 'rts', COMPLETED: 'rts',
            CANCELLED: 'cancelled',
        };
        return map[s] || 'pending';
    }

    // ── Courier Auto-Detect ────────────────────────────────────
    _detectCourier(trackingNumber) {
        const tn = (trackingNumber || '').toUpperCase();
        if (tn.startsWith('SPX') || tn.startsWith('SPXTH')) return 'shopee';
        if (tn.startsWith('TH') && tn.length === 13) return 'flash'; // Flash TH format
        if (tn.startsWith('JT') || tn.startsWith('JTTH')) return 'jt';
        if (tn.startsWith('KER') || tn.startsWith('SMKD') || tn.startsWith('KETH')) return 'kerry';
        if (/^E[A-Z]\d{9}TH$/.test(tn)) return 'thaipost'; // EMS format: EY123456789TH
        if (/^R[A-Z]\d{9}TH$/.test(tn)) return 'thaipost'; // Registered: RY123456789TH
        if (tn.startsWith('FLTH')) return 'flash';
        if (tn.startsWith('LZTH') || tn.startsWith('LZD')) return 'lazada';
        if (tn.startsWith('TTTH')) return 'tiktok';
        return 'flash'; // Default fallback
    }

    // ── Internal ───────────────────────────────────────────────
    _getAdapter(key) {
        // Accept both adapter key ('shopee') and WMS label ('Shopee Express')
        const adapterKey = PLATFORM_LABEL_MAP[key] || key;
        const adapter = adapters[adapterKey];
        if (!adapter) throw new Error(`Unknown platform: ${key}`);
        return adapter;
    }
}

// Singleton
const platformApi = new PlatformApi();
export default platformApi;

// Named exports for convenience
export { adapters, PLATFORM_LABEL_MAP, ADAPTER_LABEL_MAP, MARKETPLACES, COURIERS };
