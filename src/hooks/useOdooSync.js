import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAllOrders, fetchInventory, fetchWaves, fetchInvoices, fetchProducts } from '../services/odooApi';

const POLL_INTERVAL = 10000; // 10 seconds

const useOdooSync = ({ apiConfigs, salesOrders, setSalesOrders, inventory, setInventory, waves, setWaves, invoices, setInvoices, addToast }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [odooProducts, setOdooProducts] = useState([]); // barcode lookup map from Odoo
    const intervalRef = useRef(null);
    const isFirstSync = useRef(true);

    const odooConfig = apiConfigs?.odoo || {};

    const isLiveMode = odooConfig.enabled && odooConfig.useMock === false && odooConfig.url;

    const syncNow = useCallback(async (silent = false) => {
        if (!odooConfig.enabled && !isFirstSync.current) return;
        if (isSyncing) return;

        setIsSyncing(true);
        setSyncError(null);

        try {
            // Fetch all data in parallel (products only on first sync)
            const [ordersData, inventoryData, wavesData, invoicesData, productsData] = await Promise.all([
                fetchAllOrders(odooConfig).catch(() => null),
                fetchInventory(odooConfig).catch(() => null),
                fetchWaves(odooConfig).catch(() => null),
                fetchInvoices(odooConfig).catch(() => null),
                isFirstSync.current ? fetchProducts(odooConfig).catch(() => null) : Promise.resolve(null),
            ]);

            // Update product barcode map from Odoo (real barcodes fix swapped ones)
            if (productsData && Array.isArray(productsData) && productsData.length > 0) {
                setOdooProducts(productsData);
                // Patch salesOrders items with correct barcodes from Odoo
                setSalesOrders(prev => prev.map(order => ({
                    ...order,
                    items: order.items?.map(item => {
                        const odooProduct = productsData.find(p =>
                            p.sku && p.sku === item.sku
                        );
                        if (odooProduct && odooProduct.barcode) {
                            return { ...item, barcode: odooProduct.barcode };
                        }
                        return item;
                    }) || order.items,
                })));
            }

            // Sync orders whenever live mode is on (useMock=false)
            // In mock mode, syncOrders can still be used as an explicit override
            if ((isLiveMode || odooConfig.syncOrders) && ordersData && Array.isArray(ordersData)) {
                setSalesOrders(prev => {
                    const merged = ordersData.map(remoteOrder => {
                        const localOrder = prev.find(lo => lo.id === remoteOrder.id);
                        if (localOrder) {
                            // If Odoo says done (rts) → always trust Odoo
                            if (remoteOrder.status === 'rts') return remoteOrder;
                            const localProgress = localOrder.items?.reduce((s, i) => s + (i.picked || 0) + (i.packed || 0), 0) || 0;
                            const remoteProgress = remoteOrder.items?.reduce((s, i) => s + (i.picked || 0) + (i.packed || 0), 0) || 0;
                            if (localProgress > remoteProgress) {
                                // Keep local progress but always refresh barcode from Odoo (fixes stale/swapped barcodes)
                                return {
                                    ...localOrder,
                                    items: localOrder.items?.map(localItem => {
                                        const remoteItem = remoteOrder.items?.find(
                                            ri => ri.moveId === localItem.moveId || ri.sku === localItem.sku
                                        );
                                        return remoteItem ? { ...localItem, barcode: remoteItem.barcode } : localItem;
                                    }) || localOrder.items,
                                };
                            }
                            return remoteOrder;
                        }
                        return remoteOrder;
                    });
                    prev.forEach(lo => {
                        if (!merged.find(m => m.id === lo.id)) merged.push(lo);
                    });
                    return merged;
                });
            }

            if (inventoryData && Array.isArray(inventoryData)) {
                setInventory(inventoryData);
            }

            if (wavesData && Array.isArray(wavesData)) {
                setWaves(wavesData);
            }

            if (invoicesData && Array.isArray(invoicesData)) {
                setInvoices(invoicesData);
            }

            setIsOnline(true);
            setLastSyncTime(Date.now());
            isFirstSync.current = false;

            // Process queued changes
            const queue = JSON.parse(localStorage.getItem('wms_sync_queue') || '[]');
            if (queue.length > 0) {
                localStorage.setItem('wms_sync_queue', '[]');
                if (!silent && addToast) {
                    addToast(`Synced ${queue.length} queued changes`);
                }
            }
        } catch (err) {
            console.error('Sync error:', err);
            setIsOnline(false);
            setSyncError(err.message);
            if (isFirstSync.current) {
                isFirstSync.current = false;
            }
        } finally {
            setIsSyncing(false);
        }
    }, [odooConfig, isSyncing, setSalesOrders, setInventory, setWaves, setInvoices, addToast]);

    // Initial sync on mount
    useEffect(() => {
        syncNow(true);
    }, []);

    // Polling interval
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            syncNow(true);
        }, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [syncNow]);

    // Queue local changes when offline
    const queueChange = useCallback((action, data) => {
        const queue = JSON.parse(localStorage.getItem('wms_sync_queue') || '[]');
        queue.push({ action, data, timestamp: Date.now() });
        localStorage.setItem('wms_sync_queue', JSON.stringify(queue));
    }, []);

    return {
        isOnline,
        isSyncing,
        lastSyncTime,
        syncError,
        isLiveMode,
        odooProducts,
        syncNow: () => syncNow(false),
        queueChange
    };
};

export default useOdooSync;
