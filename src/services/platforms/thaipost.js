// ─────────────────────────────────────────────────────────────
//  Thai Post / EMS Track & Trace API Adapter
//  Docs: https://track.thailandpost.co.th/developerGuide
//  Auth: Token-based (registered developer)
// ─────────────────────────────────────────────────────────────

import BasePlatformAdapter from './base.js';

const THAIPOST_HOST = 'https://trackapi.thailandpost.co.th/post/api/v1';

class ThaiPostAdapter extends BasePlatformAdapter {
    constructor() {
        super('thaipost', 'Thai Post');
        this._loadTokens();
    }

    getConfigFields() {
        return [
            { key: 'apiToken', label: 'API Token', type: 'password', required: true, placeholder: 'Token from track.thailandpost.co.th' },
            { key: 'apiMode', label: 'API Mode', type: 'select', options: ['direct', 'aftership'], default: 'direct' },
            { key: 'aftershipKey', label: 'AfterShip API Key (optional)', type: 'password', required: false, placeholder: 'For tracking via AfterShip' },
        ];
    }

    isConfigured() {
        const mode = this._config.apiMode || 'direct';
        if (mode === 'aftership') return !!this._config.aftershipKey;
        return !!this._config.apiToken;
    }

    // ── Thai Post Token Management ─────────────────────────────
    // Thai Post issues a short-lived token from the master API token
    async _getFireToken() {
        if (this._tokens.fire_token && this._tokens.fire_token_at) {
            const elapsed = (Date.now() - this._tokens.fire_token_at) / 1000;
            if (elapsed < 3500) return this._tokens.fire_token; // Token valid ~1 hour
        }

        const res = await this._fetch(`${THAIPOST_HOST}/authenticate/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${this._config.apiToken}`,
            },
        });
        const data = await res.json();
        if (data.token || data.expire) {
            this._tokens.fire_token = data.token;
            this._tokens.fire_token_at = Date.now();
            this._saveTokens();
            return data.token;
        }
        throw new Error('Failed to get Thai Post fire token');
    }

    async _apiCall(endpoint, body = {}) {
        const mode = this._config.apiMode || 'direct';
        if (mode === 'aftership') {
            return this._afterShipCall(endpoint, body);
        }

        const fireToken = await this._getFireToken();
        const url = `${THAIPOST_HOST}/${endpoint}`;
        const data = await this._json(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${fireToken}`,
            },
            body: JSON.stringify(body),
        });

        if (data.status === false || data.message === 'error') {
            throw new Error(`Thai Post API Error: ${data.message || 'Unknown'}`);
        }
        return data;
    }

    // ── AfterShip Fallback ─────────────────────────────────────
    async _afterShipCall(endpoint, body) {
        const url = `https://api.aftership.com/v4/${endpoint}`;
        const data = await this._json(url, {
            method: body ? 'POST' : 'GET',
            headers: {
                'Content-Type': 'application/json',
                'aftership-api-key': this._config.aftershipKey,
            },
            ...(body && { body: JSON.stringify(body) }),
        });
        return data;
    }

    // ── Test Connection ────────────────────────────────────────
    async testConnection() {
        try {
            const mode = this._config.apiMode || 'direct';
            if (mode === 'aftership') {
                const data = await this._afterShipCall('couriers/detect', {
                    tracking: { tracking_number: 'EY123456789TH' },
                });
                return { success: true, mode: 'aftership', data };
            }
            // Test by getting a fire token
            const token = await this._getFireToken();
            return { success: true, mode: 'direct', message: 'Token obtained', hasFireToken: !!token };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ── Track Items ────────────────────────────────────────────
    async getTracking(trackingNumbers) {
        const mode = this._config.apiMode || 'direct';
        const barcodes = Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers];

        if (mode === 'aftership') {
            // AfterShip: one-by-one tracking
            const results = [];
            for (const barcode of barcodes.slice(0, 10)) {
                try {
                    const data = await this._afterShipCall(`trackings/thailand-post/${barcode}`);
                    results.push({ barcode, ...data?.data?.tracking });
                } catch { results.push({ barcode, error: 'Not found' }); }
            }
            return { items: results };
        }

        // Direct Thai Post API: batch tracking (max 20 per call)
        return this._apiCall('track', {
            status: 'all',
            language: 'TH',
            barcode: barcodes.slice(0, 20),
        });
    }

    // ── Get Item Statuses (bulk) ───────────────────────────────
    async getItemStatuses(trackingNumbers) {
        const barcodes = Array.isArray(trackingNumbers) ? trackingNumbers : [trackingNumbers];
        return this._apiCall('track', {
            status: 'all',
            language: 'EN',
            barcode: barcodes.slice(0, 20),
        });
    }

    // ── Webhook Registration (Thai Post Push notifications) ────
    async registerWebhook(url, barcodes) {
        return this._apiCall('hook', {
            status: 'all',
            language: 'TH',
            barcode: Array.isArray(barcodes) ? barcodes : [barcodes],
            req_previous_status: true,
        });
    }

    // ── Thai Post doesn't have shipment creation via API ───────
    // For booking pickups, use their web portal or eService
    async createShipment() {
        throw new Error('Thai Post shipment creation is not available via API. Use eService portal at www.thailandpost.co.th');
    }

    // ── Adapter Interface ──────────────────────────────────────
    async getOrders() {
        return { orders: [], message: 'Thai Post is tracking-only. No order management API.' };
    }

    async shipOrder() {
        throw new Error('Thai Post does not support API-based shipping. Use their counter/eService.');
    }

    async cancelOrder() {
        throw new Error('Thai Post does not support API-based cancellation.');
    }

    async getShippingLabel() {
        throw new Error('Thai Post labels are generated at the post office or via eService portal.');
    }
}

export default new ThaiPostAdapter();
