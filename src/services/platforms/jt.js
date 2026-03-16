// ─────────────────────────────────────────────────────────────
//  J&T Express Thailand API Adapter
//  Docs: https://developer.jet.co.id/documentation
//  Auth: MD5 + Base64 signature
// ─────────────────────────────────────────────────────────────

import BasePlatformAdapter from './base.js';

const JT_HOSTS = {
    live: 'https://openapi.jtexpress.co.th/api',
    test: 'https://uat-openapi.jtexpress.co.th/api',
    // TH-specific — for other regions: .co.id, .sg, .vn, etc.
};

class JTExpressAdapter extends BasePlatformAdapter {
    constructor() {
        super('jt', 'J&T Express');
        this._loadTokens();
    }

    getConfigFields() {
        return [
            { key: 'companyId', label: 'Company ID (ECCompanyId)', type: 'text', required: true, placeholder: 'Your J&T company ID' },
            { key: 'apiAccount', label: 'API Account', type: 'text', required: true, placeholder: 'Your API username' },
            { key: 'apiKey', label: 'API Key (Private Key)', type: 'password', required: true, placeholder: 'MD5 signing key' },
            { key: 'customerCode', label: 'Customer Code', type: 'text', required: false, placeholder: 'Assigned by J&T' },
            { key: 'env', label: 'Environment', type: 'select', options: ['live', 'test'], default: 'live' },
        ];
    }

    get _host() {
        return JT_HOSTS[this._config.env || 'live'];
    }

    // ── J&T Signature: Base64(MD5(data_param + apiKey)) ──
    _sign(dataParam) {
        const { apiKey } = this._config;
        const raw = this.md5(dataParam + apiKey);
        return btoa(raw); // Base64 encode the MD5 hex string
    }

    async _apiCall(endpoint, dataParam) {
        const { apiAccount } = this._config;
        const dataStr = typeof dataParam === 'string' ? dataParam : JSON.stringify(dataParam);
        const sign = this._sign(dataStr);

        const url = `${this._host}/${endpoint}`;
        const formData = new URLSearchParams();
        formData.append('logistics_interface', dataStr);
        formData.append('data_digest', sign);
        formData.append('msg_type', endpoint);
        formData.append('eccompanyid', this._config.companyId);

        const data = await this._json(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
        });

        if (data.code !== '1' && data.code !== 1 && data.responseitems?.[0]?.code !== '1') {
            const errMsg = data.reason || data.responseitems?.[0]?.reason || data.message || 'Unknown error';
            throw new Error(`J&T API Error: ${errMsg}`);
        }
        return data;
    }

    // ── Test Connection ────────────────────────────────────────
    async testConnection() {
        try {
            // Test with a tracking query
            const data = await this._apiCall('order/query', {
                logistics_interface: JSON.stringify({
                    eccompanyid: this._config.companyId,
                    billcode: 'TEST000000000',
                }),
            });
            return { success: true, data };
        } catch (err) {
            if (err.message.includes('not found') || err.message.includes('not exist')) {
                return { success: true, message: 'Connected (test tracking not found, auth OK)' };
            }
            return { success: false, error: err.message };
        }
    }

    // ── Create Order (Book Shipment) ───────────────────────────
    async createShipment({
        orderNo,
        senderName, senderPhone, senderAddress, senderCity, senderProvince, senderPostcode,
        recipientName, recipientPhone, recipientAddress, recipientCity, recipientProvince, recipientPostcode,
        weight = 1, itemName = 'Package',
        goodsValue = 0, codAmount = 0,
        serviceType = '1', // 1=Express
        remark = '',
    } = {}) {
        const dataParam = {
            eccompanyid: this._config.companyId,
            customercode: this._config.customerCode || this._config.companyId,
            txlogisticid: orderNo,
            ordertype: '1', // 1=Pickup
            servicetype: serviceType,
            sender: {
                name: senderName,
                mobile: senderPhone,
                prov: senderProvince || '',
                city: senderCity || '',
                address: senderAddress,
                postcode: senderPostcode || '',
            },
            receiver: {
                name: recipientName,
                mobile: recipientPhone,
                prov: recipientProvince || '',
                city: recipientCity || '',
                address: recipientAddress,
                postcode: recipientPostcode || '',
            },
            weight: weight.toString(),
            itemname: itemName,
            goodsvalue: goodsValue.toString(),
            ...(codAmount > 0 && { codamount: codAmount.toString() }),
            remark,
        };

        return this._apiCall('order/create', dataParam);
    }

    // ── Get Tracking ───────────────────────────────────────────
    async getTracking(billCode) {
        const dataParam = {
            eccompanyid: this._config.companyId,
            billcode: billCode,
        };
        return this._apiCall('order/query', dataParam);
    }

    // ── Cancel Order ───────────────────────────────────────────
    async cancelOrder(orderNo, reason = 'Cancelled by seller') {
        const dataParam = {
            eccompanyid: this._config.companyId,
            txlogisticid: orderNo,
            reason,
        };
        return this._apiCall('order/cancel', dataParam);
    }

    // ── Get Rate / Tariff Check ────────────────────────────────
    async getRate({ originPostcode, destPostcode, weight = 1, serviceType = '1' } = {}) {
        const dataParam = {
            eccompanyid: this._config.companyId,
            originpostcode: originPostcode,
            destpostcode: destPostcode,
            weight: weight.toString(),
            servicetype: serviceType,
        };
        return this._apiCall('order/tariffquery', dataParam);
    }

    // ── Get Shipping Label ─────────────────────────────────────
    async getShippingLabel(billCode) {
        const dataParam = {
            eccompanyid: this._config.companyId,
            billcode: billCode,
            printtype: '1', // 1=Standard label
        };
        return this._apiCall('order/printlabel', dataParam);
    }

    // ── Adapter Interface ──────────────────────────────────────
    async getOrders() {
        return { orders: [], message: 'J&T Express is courier-only. Use createShipment to book.' };
    }

    async shipOrder(orderNo) {
        return this.getTracking(orderNo);
    }
}

export default new JTExpressAdapter();
