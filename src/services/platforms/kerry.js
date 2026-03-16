// ─────────────────────────────────────────────────────────────
//  Kerry Express Thailand Smart-Edi v2 Adapter
//  Portal: https://exch.th.kerryexpress.com/ediwebapi
//  Note: Official API requires partner agreement. This adapter
//        supports both direct Smart-Edi and AfterShip fallback.
// ─────────────────────────────────────────────────────────────

import BasePlatformAdapter from './base.js';

const KERRY_HOSTS = {
    live: 'https://exch.th.kerryexpress.com/ediwebapi',
    test: 'https://exch.th.kerryexpress.com/ediwebapi',
};

class KerryExpressAdapter extends BasePlatformAdapter {
    constructor() {
        super('kerry', 'Kerry Express');
        this._loadTokens();
    }

    getConfigFields() {
        return [
            { key: 'apiMode', label: 'API Mode', type: 'select', options: ['smartedi', 'aftership'], default: 'smartedi' },
            // Smart-Edi fields
            { key: 'customerId', label: 'Customer ID (Smart-Edi)', type: 'text', required: false, placeholder: 'Kerry partner customer ID' },
            { key: 'username', label: 'Username (Smart-Edi)', type: 'text', required: false, placeholder: 'Smart-Edi login' },
            { key: 'password', label: 'Password (Smart-Edi)', type: 'password', required: false, placeholder: 'Smart-Edi password' },
            // AfterShip fields
            { key: 'aftershipKey', label: 'AfterShip API Key', type: 'password', required: false, placeholder: 'For tracking via AfterShip' },
            { key: 'env', label: 'Environment', type: 'select', options: ['live', 'test'], default: 'live' },
        ];
    }

    isConfigured() {
        const mode = this._config.apiMode || 'smartedi';
        if (mode === 'aftership') return !!this._config.aftershipKey;
        return !!(this._config.customerId && this._config.username && this._config.password);
    }

    get _host() {
        return KERRY_HOSTS[this._config.env || 'live'];
    }

    // ── Smart-Edi Auth ─────────────────────────────────────────
    async authenticate() {
        const { username, password } = this._config;
        const data = await this._json(`${this._host}/api/Account/Login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (data.token || data.access_token) {
            this._tokens = {
                access_token: data.token || data.access_token,
                obtained_at: Date.now(),
            };
            this._saveTokens();
        }
        return data;
    }

    async _ensureToken() {
        if (!this._tokens.access_token) {
            await this.authenticate();
        }
    }

    // ── Smart-Edi API Call ─────────────────────────────────────
    async _smartEdiCall(endpoint, body = {}, method = 'POST') {
        await this._ensureToken();
        const url = `${this._host}/api/${endpoint}`;
        const data = await this._json(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this._tokens.access_token}`,
            },
            ...(method === 'POST' && { body: JSON.stringify(body) }),
        });
        return data;
    }

    // ── AfterShip API Call ─────────────────────────────────────
    async _afterShipCall(endpoint, method = 'GET', body = null) {
        const url = `https://api.aftership.com/v4/${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'aftership-api-key': this._config.aftershipKey,
            },
        };
        if (body) options.body = JSON.stringify(body);
        const data = await this._json(url, options);
        return data;
    }

    // ── Test Connection ────────────────────────────────────────
    async testConnection() {
        try {
            const mode = this._config.apiMode || 'smartedi';
            if (mode === 'aftership') {
                const data = await this._afterShipCall('couriers');
                return { success: true, mode: 'aftership', couriers: data?.data?.total || 0 };
            } else {
                await this.authenticate();
                return { success: true, mode: 'smartedi', message: 'Smart-Edi login successful' };
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ── Create Shipment (Smart-Edi) ────────────────────────────
    async createShipment({
        orderNo,
        senderName, senderPhone, senderAddress, senderPostcode,
        recipientName, recipientPhone, recipientAddress, recipientPostcode,
        weight = 1, pieces = 1,
        codAmount = 0,
        productType = 'EXP', // EXP=Express, COD=Cash on Delivery
        remark = '',
    } = {}) {
        const mode = this._config.apiMode || 'smartedi';
        if (mode !== 'smartedi') throw new Error('createShipment requires Smart-Edi mode');

        return this._smartEdiCall('Shipment/Create', {
            customerCode: this._config.customerId,
            referenceNo: orderNo,
            sender: {
                name: senderName,
                phone: senderPhone,
                address: senderAddress,
                postcode: senderPostcode,
            },
            recipient: {
                name: recipientName,
                phone: recipientPhone,
                address: recipientAddress,
                postcode: recipientPostcode,
            },
            parcel: {
                weight,
                pieces,
                productType,
                codAmount,
                remark,
            },
        });
    }

    // ── Get Tracking ───────────────────────────────────────────
    async getTracking(trackingNumber) {
        const mode = this._config.apiMode || 'smartedi';
        if (mode === 'aftership') {
            return this._afterShipCall(`trackings/kerry-logistics/${trackingNumber}`);
        }
        return this._smartEdiCall('Tracking/GetStatus', { trackingNo: trackingNumber });
    }

    // ── Get Shipping Label ─────────────────────────────────────
    async getShippingLabel(trackingNumber) {
        const mode = this._config.apiMode || 'smartedi';
        if (mode !== 'smartedi') throw new Error('getShippingLabel requires Smart-Edi mode');
        return this._smartEdiCall('Shipment/GetLabel', { trackingNo: trackingNumber });
    }

    // ── Cancel Shipment ────────────────────────────────────────
    async cancelOrder(trackingNumber, reason = '') {
        const mode = this._config.apiMode || 'smartedi';
        if (mode !== 'smartedi') throw new Error('cancelOrder requires Smart-Edi mode');
        return this._smartEdiCall('Shipment/Cancel', { trackingNo: trackingNumber, reason });
    }

    // ── Adapter Interface ──────────────────────────────────────
    async getOrders() {
        return { orders: [], message: 'Kerry Express is courier-only. Use createShipment to book.' };
    }

    async shipOrder(trackingNumber) {
        return this.getTracking(trackingNumber);
    }
}

export default new KerryExpressAdapter();
