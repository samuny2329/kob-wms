export const getTrackingUrl = (barcode, courier) => {
    if (!barcode) return '#';
    const c = String(courier).toLowerCase();
    if (c.includes('shopee') || c.includes('spx')) return `https://spx.co.th/m/track?tracking_no=${barcode}`;
    if (c.includes('kerry')) return `https://th.kerryexpress.com/th/track/?track=${barcode}`;
    if (c.includes('flash')) return `https://www.flashexpress.co.th/tracking/?se=${barcode}`;
    if (c.includes('j&t') || c.includes('jt')) return `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${barcode}`;
    if (c.includes('thaipost') || c.includes('ems')) return `https://track.thailandpost.co.th/?trackNumber=${barcode}`;
    return `https://www.google.com/search?q=track+${barcode}`;
};

import { useState, useEffect } from 'react';

export function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => { const handler = setTimeout(() => { setDebouncedValue(value); }, delay); return () => { clearTimeout(handler); }; }, [value, delay]);
    return debouncedValue;
}
