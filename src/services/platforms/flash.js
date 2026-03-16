// ─────────────────────────────────────────────────────────────
//  Flash Express Thailand Fulfillment API Adapter
//  Docs: https://open-docs.flashfulfillment.co.th/en.html
// ─────────────────────────────────────────────────────────────

import BasePlatformAdapter from './base.js';

const FLASH_HOSTS = {
    live: 'https://open.flashfulfillment.co.th',
    test: 'https://open-training.flashfulfillment.co.th',
};

class FlashExpressAdapter extends BasePlatformAdapter {
    constructor() {
        super('flash', 'Flash Express');
        this._loadTokens();
    }

    getConfigFields() {
        return [
            { key: 'mchId', label: 'Merchant ID (mchId)', type: 'text', required: true, placeholder: 'Your Flash merchant ID' },
            { key: 'secretKey', label: 'Secret Key', type: 'password', required: true, placeholder: 'Your Flash secret key' },
            { key: 'storeCode', label: 'Store Code', type: 'text', required: false, placeholder: 'Store/warehouse code' },
            { key: 'env', label: 'Environment', type: 'select', options: ['live', 'test'], default: 'live' },
        ];
    }

    get _host() {
        return FLASH_HOSTS[this._config.env || 'live'];
    }

    // ── Flash Signature (Algorithm 2): SHA256(secret + sortedParams + jsonBody + secret) ──
    async _sign(queryParams, jsonBody = '') {
        const { secretKey } = this._config;
        const sorted = Object.keys(queryParams).sort()
            .filter(k => k !== 'sign')
            .map(k => `${k}=${queryParams[k]}`).join('&');
        const signStr = `${secretKey}${sorted}${jsonBody}${secretKey}`;
        return (await this.sha256(signStr)).toUpperCase();
    }

    async _apiCall(path, body = {}) {
        const { mchId } = this._config;
        const ts = this.timestamp().toString();
        const nonceStr = this.nonce(16);

        const queryParams = { mchId, nonceStr, timestamp: ts };
        const jsonBody = JSON.stringify(body);
        const sign = await this._sign(queryParams, jsonBody);
        queryParams.sign = sign;

        const qs = new URLSearchParams(queryParams).toString();
        const url = `${this._host}${path}?${qs}`;

        const data = await this._json(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonBody,
        });

        if (data.code !== 1 && data.code !== 200) {
            throw new Error(`Flash API Error [${data.code}]: ${data.message || 'Unknown'}`);
        }
        return data;
    }

    // ── Test Connection ────────────────────────────────────────
    async testConnection() {
        try {
            // Test with a simple tracking query (empty = just verifies auth)
            const data = await this._apiCall('/order/getOrderStatusByNo', {
                deliveryNo: 'TEST000000000',
            });
            return { success: true, data };
        } catch (err) {
            // Auth error vs not-found are different — not-found means auth works
            if (err.message.includes('not found') || err.message.includes('delivery bill')) {
                return { success: true, message: 'Connected (test order not found, auth OK)' };
            }
            return { success: false, error: err.message };
        }
    }

    // ── Order Management ───────────────────────────────────────
    async createShipment({
        externalOrderNo,
        recipientName, recipientPhone, recipientAddress, recipientPostcode,
        recipientProvince, recipientCity, recipientDistrict,
        goodsList = [],
        totalPrice = 0, logisticCharge = 0,
        paymentMode = 1, // 1=COD, 2=Bank Transfer, 3=E-payment
        remark = '',
    } = {}) {
        const body = {
            storeCode: this._config.storeCode || '',
            externalOrderNo,
            recipientName,
            recipientPhone,
            recipientFullAddress: recipientAddress,
            recipientPostCode: recipientPostcode,
            recipientProvince: recipientProvince || '',
            recipientCity: recipientCity || '',
            recipientDistrict: recipientDistrict || '',
            goodsList: goodsList.map(g => ({
                goodsBarcode: g.barcode || g.sku || '',
                goodsName: g.name || '',
                goodsQuantity: g.qty || 1,
                goodsUnitPrice: g.price || 0,
            })),
            totalPrice,
            logisticCharge,
            paymentMode,
            remark,
        };
        return this._apiCall('/Order/addOrder', body);
    }

    async getOrderStatus(deliveryNo) {
        return this._apiCall('/order/getOrderStatusByNo', { deliveryNo });
    }

    async getTracking(deliveryNo) {
        return this._apiCall('/order/getOrderTrackingInfoByNo', {
            deliveryNo,
            trackingType: 1, // 1 = by delivery number
        });
    }

    async getShippingLabel(deliveryNo) {
        return this._apiCall('/order/getDocument', {
            deliveryNo,
            documentType: 1, // 1 = shipping label
        });
    }

    async approveDelivery(deliveryNo) {
        return this._apiCall('/Audit/delivery', { deliveryNo });
    }

    async freezeOrder(deliveryNo, freezeType = 1) {
        return this._apiCall('/order/freeze', { deliveryNo, freezeType });
    }

    // ── Shipping Label Upload ──────────────────────────────────
    async uploadExpressLabel(deliveryNo, expressNo, expressCompany) {
        return this._apiCall('/order/importExpressLabel', {
            deliveryNo,
            expressNo,
            expressCompany,
        });
    }

    // ── Adapter Interface ──────────────────────────────────────
    async getOrders() {
        // Flash doesn't have a "list orders" endpoint — orders are push-based
        // Use Odoo sync or webhook approach instead
        return { orders: [], message: 'Flash Express uses push-based order flow. Use createShipment to send orders.' };
    }

    async shipOrder(deliveryNo) {
        return this.approveDelivery(deliveryNo);
    }

    async cancelOrder(deliveryNo, reason = '') {
        // Flash uses freeze to cancel
        return this.freezeOrder(deliveryNo, 2); // 2 = cancel
    }
}

export default new FlashExpressAdapter();
