import { useState, useEffect, useRef, useCallback } from 'react';
import { createSyncEngine } from '../services/syncEngine';
import productCache from '../services/productCache';
import offlineQueue from '../services/offlineQueue';
import { updateOrderStatus, confirmRTS } from '../services/odooApi';

/**
 * useOdooSync — React hook that wraps SyncEngine
 *
 * Drop-in replacement for the old useOdooSync hook.
 * Now powered by: SyncEngine + OfflineQueue + ProductCache + ConflictResolver + RequestManager
 *
 * Same return API — existing components don't need changes.
 */
const useOdooSync = ({ apiConfigs, salesOrders, setSalesOrders, inventory, setInventory, waves, setWaves, invoices, setInvoices, addToast }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [queueCount, setQueueCount] = useState(0);

    const odooConfig = apiConfigs?.odoo || {};
    const isLiveMode = odooConfig.enabled && odooConfig.useMock === false && odooConfig.url;

    // Refs to avoid stale closures in SyncEngine callbacks
    const salesOrdersRef = useRef(salesOrders);
    salesOrdersRef.current = salesOrders;
    const odooConfigRef = useRef(odooConfig);
    odooConfigRef.current = odooConfig;

    const engineRef = useRef(null);

    // Process a queued offline action against Odoo
    const processQueueAction = useCallback(async (action) => {
        const config = odooConfigRef.current;
        switch (action.action) {
            case 'updateStatus':
                await updateOrderStatus(config, action.orderId, action.status, action.extraData || {});
                break;
            case 'confirmRTS':
                await confirmRTS(config, action.orderId, action.platform);
                break;
            default:
                throw new Error(`Unknown queue action: ${action.action}`);
        }
    }, []);

    // Initialize SyncEngine once
    useEffect(() => {
        const engine = createSyncEngine({
            odooConfig,
            onOrdersUpdate: (orders) => setSalesOrders(orders),
            onInventoryUpdate: (inv) => setInventory(inv),
            onWavesUpdate: (w) => setWaves(w),
            onInvoicesUpdate: (inv) => setInvoices(inv),
            onStatusChange: (status) => {
                setIsOnline(status.isOnline);
                setIsSyncing(status.isSyncing);
                setLastSyncTime(status.lastSyncTime);
                setSyncError(status.syncError);
                setQueueCount(status.queueCount || 0);
            },
            onToast: addToast,
            getLocalOrders: () => salesOrdersRef.current,
            processQueueAction,
        });

        engine.start();
        engineRef.current = engine;

        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Mount once — config changes handled via updateConfig

    // Update SyncEngine when Odoo config changes
    const prevConfigRef = useRef(JSON.stringify(odooConfig));
    useEffect(() => {
        const configStr = JSON.stringify(odooConfig);
        if (configStr !== prevConfigRef.current && engineRef.current) {
            prevConfigRef.current = configStr;
            engineRef.current.updateConfig(odooConfig);
        }
    }, [odooConfig]);

    // Queue an offline-safe action
    const queueChange = useCallback(async (action, data) => {
        if (engineRef.current) {
            await engineRef.current.queueAction({ action, ...data });
        } else {
            // Fallback: direct IndexedDB push
            await offlineQueue.push({ action, ...data });
        }
    }, []);

    return {
        isOnline,
        isSyncing,
        lastSyncTime,
        syncError,
        isLiveMode,
        queueCount,
        odooProducts: [],  // Deprecated: use productCache.lookupSku() instead
        syncNow: () => engineRef.current?.syncNow(),
        queueChange,
        // New APIs exposed to components
        productCache,
        offlineQueue,
        getEngineStats: () => engineRef.current?.getStats(),
    };
};

export default useOdooSync;
