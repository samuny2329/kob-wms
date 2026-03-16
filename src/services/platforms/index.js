// ─────────────────────────────────────────────────────────────
//  Platform Registry — Central index of all platform adapters
// ─────────────────────────────────────────────────────────────

import shopee from './shopee.js';
import lazada from './lazada.js';
import tiktok from './tiktok.js';
import flash from './flash.js';
import kerry from './kerry.js';
import jt from './jt.js';
import thaipost from './thaipost.js';

/** All registered platform adapters keyed by platformKey */
export const adapters = {
    shopee,
    lazada,
    tiktok,
    flash,
    kerry,
    jt,
    thaipost,
};

/** Marketplace platforms (have order management APIs) */
export const MARKETPLACES = ['shopee', 'lazada', 'tiktok'];

/** Courier/Logistics platforms (shipment booking + tracking) */
export const COURIERS = ['flash', 'kerry', 'jt', 'thaipost'];

/** Map WMS platform label → adapter key */
export const PLATFORM_LABEL_MAP = {
    'Shopee Express': 'shopee',
    'Lazada Express': 'lazada',
    'TikTok Shop': 'tiktok',
    'Flash Express': 'flash',
    'Kerry Express': 'kerry',
    'J&T Express': 'jt',
    'Thai Post': 'thaipost',
};

/** Map adapter key → WMS platform label */
export const ADAPTER_LABEL_MAP = Object.fromEntries(
    Object.entries(PLATFORM_LABEL_MAP).map(([k, v]) => [v, k])
);

export default adapters;
