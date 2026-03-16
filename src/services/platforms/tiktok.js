// ─────────────────────────────────────────────────────────────
//  TikTok Shop API Adapter (v202309+)
//  Docs: https://partner.tiktokshop.com
// ─────────────────────────────────────────────────────────────

import BasePlatformAdapter from './base.js';

const TIKTOK_HOST = 'https://open-api.tiktokglobalshop.com';

class TikTokAdapter extends BasePlatformAdapter {
    constructor() {
        super('tiktok', 'TikTok Shop');
        this._loadTokens();
    }

    getConfigFields() {
        return [
            { key: 'appKey', label: 'App Key', type: 'text', required: true, placeholder: 'Your TikTok App Key' },
            { key: 'appSecret', label: 'App Secret', type: 'password', required: true, placeholder: 'Your TikTok App Secret' },
            { key: 'shopCipher', label: 'Shop Cipher', type: 'text', required: false, placeholder: 'Auto-populated after auth' },
            { key: 'shopId', label: 'Shop ID', type: 'text', required: false, placeholder: 'Auto-populated after auth' },
            { key: 'redirectUrl', label: 'Redirect URL (OAuth)', type: 'text', required: false, placeholder: 'https://yoursite.com/callback' },
        ];
    }

    // ── TikTok Signature: HMAC-SHA256(secret, path + sorted params + body) ──
    async _sign(path, params, body = '') {
        const { appSecret } = this._config;
        const sorted = Object.keys(params).sort()
            .filter(k => k !== 'sign' && k !== 'access_token')
            .map(k => `${k}${params[k]}`).join('');
        const signStr = `${appSecret}${path}${sorted}${body}${appSecret}`;
        return (await this.hmacSha256(appSecret, signStr));
    }

    async _apiCall(path, method = 'GET', body = null, extraParams = {}) {
        const { appKey } = this._config;
        const ts = this.timestamp();

        const params = {
            app_key: appKey,
            timestamp: ts.toString(),
            version: '202309',
            ...extraParams,
        };
        if (this._tokens.access_token) params.access_token = this._tokens.access_token;
        if (this._config.shopCipher) params.shop_cipher = this._config.shopCipher;

        const bodyStr = body ? JSON.stringify(body) : '';
        const sign = await this._sign(path, params, bodyStr);
        params.sign = sign;

        const qs = new URLSearchParams(params).toString();
        const url = `${TIKTOK_HOST}${path}?${qs}`;

        const options = {
            method,
            headers: { 'Content-Type': 'application/json', 'x-tts-access-token': this._tokens.access_token || '' },
        };
        if (body && (method === 'POST' || method === 'PUT')) options.body = bodyStr;

        const data = await this._json(url, options);
        if (data.code !== 0) {
            throw new Error(`TikTok API Error [${data.code}]: ${data.message || 'Unknown'}`);
        }
        return data;
    }

    // ── Auth Flow ──────────────────────────────────────────────
    getAuthUrl() {
        const { appKey } = this._config;
        return `https://services.tiktokshop.com/open/authorize?service_id=${appKey}`;
    }

    async authenticate(code) {
        const { appKey, appSecret } = this._config;
        const data = await this._json(`${TIKTOK_HOST}/api/v2/token?app_key=${appKey}&app_secret=${appSecret}&auth_code=${code}&grant_type=authorized_code`, {
            method: 'GET',
        });
        if (data.data) {
            this._tokens = {
                access_token: data.data.access_token,
                refresh_token: data.data.refresh_token,
                access_token_expire_in: data.data.access_token_expire_in,
                refresh_token_expire_in: data.data.refresh_token_expire_in,
                obtained_at: Date.now(),
                open_id: data.data.open_id,
            };
            // Auto-set shop info
            if (data.data.seller_base_region) {
                this._config.region = data.data.seller_base_region;
            }
            this._saveTokens();
        }
        return data;
    }

    async refreshToken() {
        const { appKey, appSecret } = this._config;
        const data = await this._json(`${TIKTOK_HOST}/api/v2/token?app_key=${appKey}&app_secret=${appSecret}&refresh_token=${this._tokens.refresh_token}&grant_type=refresh_token`, {
            method: 'GET',
        });
        if (data.data) {
            this._tokens = {
                ...this._tokens,
                access_token: data.data.access_token,
                refresh_token: data.data.refresh_token,
                obtained_at: Date.now(),
            };
            this._saveTokens();
        }
        return data;
    }

    _isTokenExpired() {
        if (!this._tokens.obtained_at || !this._tokens.access_token_expire_in) return true;
        const elapsed = (Date.now() - this._tokens.obtained_at) / 1000;
        return elapsed > (this._tokens.access_token_expire_in - 300);
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
            const data = await this._apiCall('/api/shop/get_authorized_shop', 'GET');
            return { success: true, shops: data.data?.shop_list, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ── Orders ─────────────────────────────────────────────────
    async getOrders({ status = 'AWAITING_SHIPMENT', pageSize = 50, cursor = '', sortBy = 'CREATE_TIME' } = {}) {
        await this._ensureToken();
        const body = {
            page_size: pageSize,
            sort_order: 'DESC',
            sort_field: sortBy,
            ...(cursor && { cursor }),
        };
        // TikTok uses filter by order_status
        if (status) body.order_status = status;

        const data = await this._apiCall('/api/orders/search', 'POST', body);
        return {
            orders: data.data?.order_list || [],
            hasMore: data.data?.more || false,
            nextCursor: data.data?.next_cursor || '',
            total: data.data?.total || 0,
        };
    }

    async getOrderDetail(orderIdList) {
        await this._ensureToken();
        const ids = Array.isArray(orderIdList) ? orderIdList : [orderIdList];
        const data = await this._apiCall('/api/orders/detail/query', 'POST', { order_id_list: ids });
        return data.data?.order_list || [];
    }

    // ── Fulfillment ────────────────────────────────────────────
    async getShippingServices(orderId) {
        await this._ensureToken();
        return this._apiCall('/api/fulfillment/shipping_services', 'POST', { order_id: orderId });
    }

    async shipOrder(orderId, { shippingProviderId, trackingNumber, pickupSlot } = {}) {
        await this._ensureToken();
        const body = {
            order_id: orderId,
            ...(shippingProviderId && { shipping_provider_id: shippingProviderId }),
            ...(trackingNumber && { tracking_number: trackingNumber }),
            ...(pickupSlot && { pick_up: pickupSlot }),
        };
        return this._apiCall('/api/fulfillment/ship_package', 'POST', body);
    }

    async getShippingLabel(orderId, documentType = 'SHIPPING_LABEL') {
        await this._ensureToken();
        return this._apiCall('/api/fulfillment/shipping_document', 'POST', {
            order_id: orderId,
            document_type: documentType,
        });
    }

    async getTracking(orderId) {
        await this._ensureToken();
        return this._apiCall('/api/fulfillment/order_tracking', 'GET', null, { order_id: orderId });
    }

    async cancelOrder(orderId, reason = 'Out of stock') {
        await this._ensureToken();
        return this._apiCall('/api/orders/cancel', 'POST', {
            order_id: orderId,
            cancel_reason: reason,
        });
    }

    // ── Products ───────────────────────────────────────────────
    async getProducts({ pageSize = 50, cursor = '' } = {}) {
        await this._ensureToken();
        return this._apiCall('/api/products/search', 'POST', {
            page_size: pageSize,
            ...(cursor && { cursor }),
        });
    }
}

export default new TikTokAdapter();
