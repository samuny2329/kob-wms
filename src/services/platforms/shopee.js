// ─────────────────────────────────────────────────────────────
//  Shopee Open Platform v2.0 Adapter
//  Docs: https://open.shopee.com
// ─────────────────────────────────────────────────────────────

import BasePlatformAdapter from './base.js';

const SHOPEE_HOSTS = {
    live: 'https://partner.shopeemobile.com',
    test: 'https://partner.test-stable.shopeemobile.com',
};

class ShopeeAdapter extends BasePlatformAdapter {
    constructor() {
        super('shopee', 'Shopee');
        this._loadTokens();
    }

    getConfigFields() {
        return [
            { key: 'partnerId', label: 'Partner ID', type: 'text', required: true, placeholder: '10xxxxx' },
            { key: 'partnerKey', label: 'Partner Key (Secret)', type: 'password', required: true, placeholder: 'Your app secret key' },
            { key: 'shopId', label: 'Shop ID', type: 'text', required: true, placeholder: '12345678' },
            { key: 'env', label: 'Environment', type: 'select', options: ['live', 'test'], default: 'live' },
            { key: 'redirectUrl', label: 'Redirect URL (OAuth)', type: 'text', required: false, placeholder: 'https://yoursite.com/callback' },
        ];
    }

    get _host() {
        return SHOPEE_HOSTS[this._config.env || 'live'];
    }

    // ── Signature: HMAC-SHA256(partnerKey, path + timestamp + access_token + shop_id) ──
    async _sign(path, ts) {
        const { partnerId, partnerKey, shopId } = this._config;
        const accessToken = this._tokens.access_token || '';
        const baseStr = `${partnerId}${path}${ts}${accessToken}${shopId}`;
        return this.hmacSha256(partnerKey, baseStr);
    }

    _buildUrl(path, extraParams = {}) {
        const { partnerId, shopId } = this._config;
        const ts = this.timestamp();
        const params = new URLSearchParams({
            partner_id: partnerId,
            timestamp: ts,
            shop_id: shopId || '',
            ...extraParams,
        });
        return { url: `${this._host}${path}`, ts, params, path };
    }

    async _apiCall(path, method = 'GET', body = null, extraParams = {}) {
        const { url, ts, params } = this._buildUrl(path, extraParams);
        const sign = await this._sign(path, ts);
        params.set('sign', sign);
        if (this._tokens.access_token) params.set('access_token', this._tokens.access_token);

        const fullUrl = `${url}?${params.toString()}`;
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body && method === 'POST') options.body = JSON.stringify(body);

        const data = await this._json(fullUrl, options);
        if (data.error) throw new Error(`Shopee API Error: ${data.error} - ${data.message || ''}`);
        return data;
    }

    // ── Auth Flow ──────────────────────────────────────────────
    getAuthUrl() {
        const { partnerId, redirectUrl } = this._config;
        const ts = this.timestamp();
        const path = '/api/v2/shop/auth_partner';
        // sign for auth URL = HMAC(key, path + timestamp)
        return `${this._host}${path}?partner_id=${partnerId}&timestamp=${ts}&redirect=${encodeURIComponent(redirectUrl || '')}`;
    }

    async authenticate(code, shopId) {
        const path = '/api/v2/auth/token/get';
        const body = {
            code,
            shop_id: parseInt(shopId || this._config.shopId),
            partner_id: parseInt(this._config.partnerId),
        };
        const data = await this._apiCall(path, 'POST', body);
        this._tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expire_in: data.expire_in,
            obtained_at: Date.now(),
        };
        this._saveTokens();
        return data;
    }

    async refreshToken() {
        const path = '/api/v2/auth/access_token/get';
        const body = {
            refresh_token: this._tokens.refresh_token,
            shop_id: parseInt(this._config.shopId),
            partner_id: parseInt(this._config.partnerId),
        };
        const data = await this._apiCall(path, 'POST', body);
        this._tokens = {
            ...this._tokens,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expire_in: data.expire_in,
            obtained_at: Date.now(),
        };
        this._saveTokens();
        return data;
    }

    _isTokenExpired() {
        if (!this._tokens.obtained_at || !this._tokens.expire_in) return true;
        const elapsed = (Date.now() - this._tokens.obtained_at) / 1000;
        return elapsed > (this._tokens.expire_in - 300); // 5 min buffer
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
            const data = await this._apiCall('/api/v2/shop/get_shop_info', 'GET');
            return { success: true, shopName: data.response?.shop_name, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ── Orders ─────────────────────────────────────────────────
    async getOrders({ status = 'READY_TO_SHIP', pageSize = 50, cursor = '' } = {}) {
        await this._ensureToken();
        const body = {
            time_range_field: 'create_time',
            time_from: this.timestamp() - 7 * 86400,
            time_to: this.timestamp(),
            page_size: pageSize,
            order_status: status,
            ...(cursor && { cursor }),
        };
        const data = await this._apiCall('/api/v2/order/get_order_list', 'POST', body);
        return {
            orders: data.response?.order_list || [],
            hasMore: data.response?.more || false,
            nextCursor: data.response?.next_cursor || '',
        };
    }

    async getOrderDetail(orderSn) {
        await this._ensureToken();
        const data = await this._apiCall('/api/v2/order/get_order_detail', 'POST', {
            order_sn_list: Array.isArray(orderSn) ? orderSn : [orderSn],
            response_optional_fields: [
                'buyer_user_id', 'buyer_username', 'estimated_shipping_fee',
                'recipient_address', 'actual_shipping_fee', 'item_list',
                'pay_time', 'dropshipper', 'shipping_carrier', 'payment_method',
                'total_amount', 'invoice_data', 'order_chargeable_weight_gram',
                'package_list',
            ],
        });
        return data.response?.order_list || [];
    }

    // ── Shipping ───────────────────────────────────────────────
    async getShippingParameter(orderSn) {
        await this._ensureToken();
        return this._apiCall('/api/v2/logistics/get_shipping_parameter', 'POST', { order_sn: orderSn });
    }

    async shipOrder(orderSn, { pickup = {} } = {}) {
        await this._ensureToken();
        const params = await this.getShippingParameter(orderSn);
        const infoNeeded = params.response?.info_needed || {};

        const body = { order_sn: orderSn };
        if (infoNeeded.pickup) {
            body.pickup = pickup.address_id
                ? { address_id: pickup.address_id }
                : params.response?.pickup?.address_list?.[0] || {};
        }
        if (infoNeeded.dropoff) {
            body.dropoff = { branch_id: params.response?.dropoff?.branch_list?.[0]?.branch_id };
        }

        return this._apiCall('/api/v2/logistics/ship_order', 'POST', body);
    }

    async getShippingLabel(orderSn) {
        await this._ensureToken();
        const data = await this._apiCall('/api/v2/logistics/get_shipping_document_result', 'POST', {
            shipping_document_type: 'NORMAL_AIR_WAYBILL',
            order_list: [{ order_sn: orderSn }],
        });
        return data;
    }

    async getTracking(orderSn) {
        await this._ensureToken();
        return this._apiCall('/api/v2/logistics/get_tracking_info', 'POST', { order_sn: orderSn });
    }

    async cancelOrder(orderSn, reason = 'OUT_OF_STOCK') {
        await this._ensureToken();
        return this._apiCall('/api/v2/order/cancel_order', 'POST', {
            order_sn: orderSn,
            cancel_reason: reason,
        });
    }

    // ── Products ───────────────────────────────────────────────
    async getProducts({ offset = 0, pageSize = 50, status = 'NORMAL' } = {}) {
        await this._ensureToken();
        return this._apiCall('/api/v2/product/get_item_list', 'GET', null, {
            offset, page_size: pageSize, item_status: status,
        });
    }
}

export default new ShopeeAdapter();
