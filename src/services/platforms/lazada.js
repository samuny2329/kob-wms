// ─────────────────────────────────────────────────────────────
//  Lazada Open Platform (LazOP 2.0) Adapter
//  Docs: https://open.lazada.com
// ─────────────────────────────────────────────────────────────

import BasePlatformAdapter from './base.js';

const LAZADA_HOSTS = {
    live: 'https://api.lazada.co.th/rest',
    test: 'https://api.lazada.co.th/rest',    // Lazada uses same host, sandbox via app
    auth: 'https://auth.lazada.com/rest',
};

const LAZADA_REGIONS = {
    TH: 'https://api.lazada.co.th/rest',
    MY: 'https://api.lazada.com.my/rest',
    SG: 'https://api.lazada.sg/rest',
    PH: 'https://api.lazada.com.ph/rest',
    VN: 'https://api.lazada.vn/rest',
    ID: 'https://api.lazada.co.id/rest',
};

class LazadaAdapter extends BasePlatformAdapter {
    constructor() {
        super('lazada', 'Lazada');
        this._loadTokens();
    }

    getConfigFields() {
        return [
            { key: 'appKey', label: 'App Key', type: 'text', required: true, placeholder: '1234567' },
            { key: 'appSecret', label: 'App Secret', type: 'password', required: true, placeholder: 'Your app secret' },
            { key: 'region', label: 'Region', type: 'select', options: ['TH', 'MY', 'SG', 'PH', 'VN', 'ID'], default: 'TH' },
            { key: 'redirectUrl', label: 'Redirect URL (OAuth)', type: 'text', required: false, placeholder: 'https://yoursite.com/callback' },
        ];
    }

    get _host() {
        return LAZADA_REGIONS[this._config.region || 'TH'];
    }

    // ── Lazada Signature: HMAC-SHA256(secret, sorted_params) ──
    async _sign(apiPath, params) {
        const { appSecret } = this._config;
        const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
        const signStr = `${apiPath}${sorted}`;
        return (await this.hmacSha256(appSecret, signStr)).toUpperCase();
    }

    async _apiCall(apiPath, params = {}, method = 'GET') {
        const { appKey } = this._config;
        const ts = Date.now();

        const baseParams = {
            app_key: appKey,
            timestamp: ts.toString(),
            sign_method: 'sha256',
            ...(this._tokens.access_token && { access_token: this._tokens.access_token }),
            ...params,
        };

        const sign = await this._sign(apiPath, baseParams);
        baseParams.sign = sign;

        const qs = new URLSearchParams(baseParams).toString();
        const url = `${this._host}${apiPath}?${qs}`;

        const options = { method, headers: { 'Content-Type': 'application/json' } };
        const data = await this._json(url, options);

        if (data.code && data.code !== '0') {
            throw new Error(`Lazada API Error [${data.code}]: ${data.message || data.type || 'Unknown'}`);
        }
        return data;
    }

    // ── Auth Flow ──────────────────────────────────────────────
    getAuthUrl() {
        const { appKey, redirectUrl } = this._config;
        return `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUrl || '')}&client_id=${appKey}`;
    }

    async authenticate(code) {
        const data = await this._apiCall('/auth/token/create', { code }, 'GET');
        this._tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expire_in: data.expires_in,
            refresh_expires_in: data.refresh_expires_in,
            country: data.country,
            account: data.account,
            obtained_at: Date.now(),
        };
        this._saveTokens();
        return data;
    }

    async refreshToken() {
        const data = await this._apiCall('/auth/token/refresh', {
            refresh_token: this._tokens.refresh_token,
        });
        this._tokens = {
            ...this._tokens,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expire_in: data.expires_in,
            obtained_at: Date.now(),
        };
        this._saveTokens();
        return data;
    }

    _isTokenExpired() {
        if (!this._tokens.obtained_at || !this._tokens.expire_in) return true;
        const elapsed = (Date.now() - this._tokens.obtained_at) / 1000;
        return elapsed > (this._tokens.expire_in - 300);
    }

    async _ensureToken() {
        if (this._isTokenExpired() && this._tokens.refresh_token) {
            await this.refreshToken();
        }
    }

    // ── Test Connection ────────────────────────────────────────
    async testConnection() {
        try {
            await this._ensureToken();
            const data = await this._apiCall('/seller/get', {});
            return { success: true, sellerName: data.data?.name, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ── Orders ─────────────────────────────────────────────────
    async getOrders({ status = 'pending', limit = 50, offset = 0, createdAfter, createdBefore } = {}) {
        await this._ensureToken();
        const params = {
            ...(status && { status }),
            limit: limit.toString(),
            offset: offset.toString(),
            sort_direction: 'DESC',
            sort_by: 'created_at',
        };
        if (createdAfter) params.created_after = createdAfter;
        if (createdBefore) params.created_before = createdBefore;

        const data = await this._apiCall('/orders/get', params);
        return {
            orders: data.data?.orders || [],
            count: data.data?.count || 0,
            countTotal: data.data?.countTotal || 0,
        };
    }

    async getOrderDetail(orderId) {
        await this._ensureToken();
        const data = await this._apiCall('/order/get', { order_id: orderId.toString() });
        return data.data || {};
    }

    async getOrderItems(orderId) {
        await this._ensureToken();
        const data = await this._apiCall('/order/items/get', { order_id: orderId.toString() });
        return data.data || [];
    }

    // ── Fulfillment ────────────────────────────────────────────
    async setStatusToPackedByMarketplace(orderItemIds, shipmentProvider, trackingNumber) {
        await this._ensureToken();
        return this._apiCall('/order/pack', {
            order_item_ids: JSON.stringify(orderItemIds),
            delivery_type: 'dropship',
            shipping_provider: shipmentProvider,
        }, 'POST');
    }

    async shipOrder(orderId, { orderItemIds, trackingNumber, shippingProvider } = {}) {
        await this._ensureToken();
        return this._apiCall('/order/rts', {
            order_item_ids: JSON.stringify(orderItemIds),
            delivery_type: 'dropship',
            shipment_provider: shippingProvider || 'Lazada',
            tracking_number: trackingNumber || '',
        }, 'POST');
    }

    async getShippingLabel(orderItemIds, documentType = 'shippingLabel') {
        await this._ensureToken();
        return this._apiCall('/order/document/get', {
            order_item_ids: JSON.stringify(orderItemIds),
            doc_type: documentType,
        });
    }

    async getTracking(orderSn) {
        // Lazada tracking is via order items — use getOrderItems + status
        return this.getOrderItems(orderSn);
    }

    async cancelOrder(orderId, reason = 'Out of stock') {
        await this._ensureToken();
        return this._apiCall('/order/cancel', {
            order_id: orderId.toString(),
            reason_detail: reason,
            reason_id: '15',
        }, 'POST');
    }

    // ── Products ───────────────────────────────────────────────
    async getProducts({ filter = 'live', limit = 50, offset = 0 } = {}) {
        await this._ensureToken();
        return this._apiCall('/products/get', {
            filter, limit: limit.toString(), offset: offset.toString(),
        });
    }
}

export default new LazadaAdapter();
