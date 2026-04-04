import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAllOrders, fetchInventory, fetchWaves, fetchInvoices, fetchProducts } from '../services/odooApi';

// Handheld devices get slower poll to reduce lag
const IS_MOBILE = /Android|iPhone|iPad/i.test(navigator.userAgent) || (window.innerWidth < 768);
const POLL_INTERVAL = IS_MOBILE ? 30000 : 10000; // 30s mobile, 10s desktop

const useOdooSync = ({ apiConfigs, salesOrders, setSalesOrders, inventory, setInventory, waves, setWaves, invoices, setInvoices, addToast, companyId, companyIds }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [odooProducts, setOdooProducts] = useState([]);
    const intervalRef = useRef(null);
    const isFirstSync = useRef(true);
    const syncingRef = useRef(false);

    const odooConfig = apiConfigs?.odoo || {};
    const isLiveMode = odooConfig.enabled && odooConfig.url;

    const syncNow = useCallback(async (silent = false) => {
        if (!odooConfig.enabled && !isFirstSync.current) return;
        if (syncingRef.current) return;

        syncingRef.current = true;
        setIsSyncing(true);
        setSyncError(null);

        try {
            const cid = companyIds?.length === 1 ? companyIds[0] : (companyIds?.length > 1 ? companyIds : companyId);
            const [ordersData, inventoryData, wavesData, invoicesData, productsData] = await Promise.all([
                fetchAllOrders(odooConfig, cid).catch(() => null),
                fetchInventory(odooConfig, cid).catch(() => null),
                fetchWaves(odooConfig).catch(() => null),
                fetchInvoices(odooConfig, cid).catch(() => null),
                isFirstSync.current ? fetchProducts(odooConfig).catch(() => null) : Promise.resolve(null),
            ]);

            if (productsData && Array.isArray(productsData) && productsData.length > 0) {
                setOdooProducts(productsData);
                setSalesOrders(prev => prev.map(order => ({
                    ...order,
                    items: order.items?.map(item => {
                        const odooProduct = productsData.find(p => p.sku && p.sku === item.sku);
                        if (odooProduct && odooProduct.barcode) return { ...item, barcode: odooProduct.barcode };
                        return item;
                    }) || order.items,
                })));
            }

            if ((isLiveMode || odooConfig.syncOrders) && ordersData && Array.isArray(ordersData)) {
                setSalesOrders(prev => {
                    const merged = ordersData.map(remoteOrder => {
                        const localOrder = prev.find(lo => lo.id === remoteOrder.id);
                        if (localOrder) {
                            // Remote is done/shipped — accept only if local is also rts or beyond
                            if (remoteOrder.status === 'rts') {
                                if (['rts', 'locked'].includes(localOrder.status)) return remoteOrder;
                                // Local is still being worked on — keep local, don't overwrite active work
                                if (['picking', 'packing'].includes(localOrder.status)) return localOrder;
                                return remoteOrder;
                            }
                            const localProgress = localOrder.items?.reduce((s, i) => s + (i.picked || 0) + (i.packed || 0), 0) || 0;
                            const remoteProgress = remoteOrder.items?.reduce((s, i) => s + (i.picked || 0) + (i.packed || 0), 0) || 0;
                            if (localProgress > remoteProgress) {
                                return {
                                    ...localOrder,
                                    items: localOrder.items?.map(localItem => {
                                        const remoteItem = remoteOrder.items?.find(ri => ri.moveId === localItem.moveId || ri.sku === localItem.sku);
                                        return remoteItem ? { ...localItem, barcode: remoteItem.barcode } : localItem;
                                    }) || localOrder.items,
                                };
                            }
                            return remoteOrder;
                        }
                        return remoteOrder;
                    });
                    prev.forEach(lo => { if (!merged.find(m => m.id === lo.id)) merged.push(lo); });
                    return merged;
                });
            }

            if (inventoryData && Array.isArray(inventoryData)) setInventory(inventoryData);
            if (wavesData && Array.isArray(wavesData)) setWaves(wavesData);
            if (invoicesData && Array.isArray(invoicesData)) setInvoices(invoicesData);

            setIsOnline(true);
            setLastSyncTime(Date.now());
            isFirstSync.current = false;

            const queue = JSON.parse(localStorage.getItem('wms_sync_queue') || '[]');
            if (queue.length > 0) {
                localStorage.setItem('wms_sync_queue', '[]');
                if (!silent && addToast) addToast(`Synced ${queue.length} queued changes`);
            }
        } catch (err) {
            console.error('Sync error:', err);
            setIsOnline(false);
            setSyncError(err.message);
            if (isFirstSync.current) isFirstSync.current = false;
        } finally {
            syncingRef.current = false;
            setIsSyncing(false);
        }
    }, [odooConfig, companyId, companyIds, setSalesOrders, setInventory, setWaves, setInvoices, addToast]);

    // Initial sync
    const initialSyncDone = useRef(false);
    useEffect(() => {
        if (!initialSyncDone.current) {
            initialSyncDone.current = true;
            syncNow(true);
        }
    }, [syncNow]);

    // Re-sync when company changes
    const prevCompanyRef = useRef(JSON.stringify(companyIds));
    useEffect(() => {
        const key = JSON.stringify(companyIds);
        if (prevCompanyRef.current !== key) {
            prevCompanyRef.current = key;
            syncNow(false);
        }
    }, [companyIds, syncNow]);

    // Polling
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => syncNow(true), POLL_INTERVAL);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [syncNow]);

    const queueChange = useCallback((action, data) => {
        const queue = JSON.parse(localStorage.getItem('wms_sync_queue') || '[]');
        queue.push({ action, data, timestamp: Date.now() });
        localStorage.setItem('wms_sync_queue', JSON.stringify(queue));
    }, []);

    return { isOnline, isSyncing, lastSyncTime, syncError, isLiveMode, odooProducts, syncNow: () => syncNow(false), queueChange };
};

export default useOdooSync;
