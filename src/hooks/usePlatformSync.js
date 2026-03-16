// ─────────────────────────────────────────────────────────────
//  usePlatformSync — Hook for syncing marketplace orders
//  Polls configured marketplace APIs and merges into salesOrders
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import platformApi, { MARKETPLACES, ADAPTER_LABEL_MAP } from '../services/platformApi.js';

const SYNC_INTERVAL = 60_000; // 60 seconds (marketplace APIs have rate limits)

export default function usePlatformSync({
    enabled = false,
    salesOrders = [],
    setSalesOrders,
    addToast,
} = {}) {
    const [syncState, setSyncState] = useState({
        isSyncing: false,
        lastSyncTime: null,
        syncError: null,
        platformStatuses: {},  // { shopee: { connected, orderCount, lastSync }, ... }
    });
    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    // ── Sync Logic ─────────────────────────────────────────────
    const syncNow = useCallback(async (silent = false) => {
        if (!enabled) return;

        const configuredPlatforms = MARKETPLACES.filter(k => platformApi.isConfigured(k));
        if (configuredPlatforms.length === 0) return;

        setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

        try {
            const results = await platformApi.getAllMarketplaceOrders();
            if (!mountedRef.current) return;

            const statuses = {};
            let totalNew = 0;

            for (const [key, result] of Object.entries(results)) {
                const orders = result.orders || [];
                statuses[key] = {
                    connected: !result.error,
                    orderCount: orders.length,
                    lastSync: Date.now(),
                    error: result.error || null,
                };

                if (!result.error && orders.length > 0) {
                    // Normalize & merge into salesOrders
                    const wmsPlatform = ADAPTER_LABEL_MAP[key];
                    const normalized = orders.map(o => platformApi._normalizeOrder
                        ? platformApi._normalizeOrder(key, wmsPlatform, o)
                        : o
                    );

                    // Merge: only add orders not already in salesOrders
                    setSalesOrders(prev => {
                        const existingIds = new Set(prev.map(o => o.soRef || o.ref));
                        const newOrders = normalized.filter(o => !existingIds.has(o.soRef));
                        totalNew += newOrders.length;
                        if (newOrders.length === 0) return prev;
                        return [...prev, ...newOrders];
                    });
                }
            }

            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                lastSyncTime: Date.now(),
                platformStatuses: statuses,
            }));

            if (!silent && totalNew > 0) {
                addToast?.(`Synced ${totalNew} new order(s) from marketplace APIs`, 'success');
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                syncError: err.message,
            }));
            if (!silent) addToast?.(`Platform sync error: ${err.message}`, 'error');
        }
    }, [enabled, setSalesOrders, addToast]);

    // ── Polling ────────────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;
        if (enabled) {
            syncNow(true); // Initial silent sync
            intervalRef.current = setInterval(() => syncNow(true), SYNC_INTERVAL);
        }
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [enabled, syncNow]);

    return {
        ...syncState,
        syncNow,
        configuredPlatforms: MARKETPLACES.filter(k => platformApi.isConfigured(k)),
    };
}
