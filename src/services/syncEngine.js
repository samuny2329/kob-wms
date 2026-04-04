/**
 * SyncEngine — Orchestrates all data synchronization
 *
 * Combines: Smart Polling, Offline Queue, Product Cache,
 *           Request Manager, and Conflict Resolver
 *
 * Polling Strategy:
 *   - Active user (recent interaction): every 15s
 *   - Idle (no interaction 2min): every 60s
 *   - Tab hidden: pause polling
 *   - Error/offline: exponential backoff 30s → 60s → 120s → 240s (max)
 *   - Back online: immediate sync
 *   - Manual sync button: instant (debounced 2s)
 *
 * Usage:
 *   const engine = createSyncEngine({ odooConfig, callbacks });
 *   engine.start();
 *   engine.syncNow();           // manual sync
 *   engine.queueAction(data);   // offline-safe action
 *   engine.destroy();           // cleanup on unmount
 */

import requestManager from './requestManager';
import offlineQueue from './offlineQueue';
import productCache from './productCache';
import { mergeOrders, mergeInventory } from './conflictResolver';
import { fetchAllOrders, fetchInventory, fetchWaves, fetchInvoices, fetchProducts } from './odooApi';

// ── Timing Constants ──
const POLL_ACTIVE = 15_000;    // 15s when user is active
const POLL_IDLE = 60_000;      // 60s when idle
const IDLE_THRESHOLD = 120_000; // 2min no interaction → idle
const BACKOFF_BASE = 30_000;   // 30s initial backoff
const BACKOFF_MAX = 240_000;   // 4min max backoff
const DRAIN_INTERVAL = 5_000;  // 5s between queue drain attempts
const MAX_QUEUE_RETRIES = 3;   // max retries per queued action

/**
 * Create a SyncEngine instance
 *
 * @param {Object} options
 * @param {Object} options.odooConfig - Odoo connection config
 * @param {Function} options.onOrdersUpdate - (orders) => void
 * @param {Function} options.onInventoryUpdate - (inventory) => void
 * @param {Function} options.onWavesUpdate - (waves) => void
 * @param {Function} options.onInvoicesUpdate - (invoices) => void
 * @param {Function} options.onStatusChange - ({ isOnline, isSyncing, lastSyncTime, syncError, queueCount }) => void
 * @param {Function} options.onToast - (message) => void
 * @param {Function} options.getLocalOrders - () => currentOrders (for merge)
 * @param {Function} options.processQueueAction - (action) => Promise (execute a queued action against Odoo)
 */
export const createSyncEngine = (options) => {
  const {
    onOrdersUpdate,
    onInventoryUpdate,
    onWavesUpdate,
    onInvoicesUpdate,
    onStatusChange,
    onToast,
    getLocalOrders,
    processQueueAction,
  } = options;

  let odooConfig = options.odooConfig || {};

  // ── Internal State ──
  let _pollTimer = null;
  let _drainTimer = null;
  let _lastActivity = Date.now();
  let _consecutiveErrors = 0;
  let _isOnline = true;
  let _isSyncing = false;
  let _lastSyncTime = null;
  let _syncError = null;
  let _isFirstSync = true;
  let _destroyed = false;
  let _tabVisible = true;

  // ── Status broadcast ──
  const broadcastStatus = async () => {
    const queueCount = await offlineQueue.count().catch(() => 0);
    onStatusChange?.({
      isOnline: _isOnline,
      isSyncing: _isSyncing,
      lastSyncTime: _lastSyncTime,
      syncError: _syncError,
      queueCount,
      isLiveMode: isLiveMode(),
      productCacheReady: productCache.isReady,
      productCount: productCache.size,
    });
  };

  const isLiveMode = () => {
    return odooConfig.enabled && odooConfig.url;
  };

  // ── Calculate next poll interval ──
  const getNextInterval = () => {
    if (_consecutiveErrors > 0) {
      // Exponential backoff: 30s, 60s, 120s, 240s
      return Math.min(BACKOFF_BASE * Math.pow(2, _consecutiveErrors - 1), BACKOFF_MAX);
    }
    const timeSinceActivity = Date.now() - _lastActivity;
    return timeSinceActivity > IDLE_THRESHOLD ? POLL_IDLE : POLL_ACTIVE;
  };

  // ── Core sync function ──
  const sync = async (silent = false) => {
    if (_destroyed || _isSyncing) return;
    if (!odooConfig.enabled && !_isFirstSync) return;

    _isSyncing = true;
    _syncError = null;
    broadcastStatus();

    try {
      // Use requestManager to dedup concurrent sync calls
      await requestManager.request('sync:main', async () => {
        // Parallel fetch with individual error handling
        const [ordersData, inventoryData, wavesData, invoicesData] = await Promise.all([
          fetchAllOrders(odooConfig).catch(e => ({ _error: e })),
          fetchInventory(odooConfig).catch(e => ({ _error: e })),
          fetchWaves(odooConfig).catch(e => ({ _error: e })),
          fetchInvoices(odooConfig).catch(e => ({ _error: e })),
        ]);

        // Initialize product cache on first sync
        if (_isFirstSync) {
          await productCache.initialize(
            () => fetchProducts(odooConfig),
          ).catch(() => {});
        }

        // Process orders with conflict resolution
        if (ordersData && !ordersData._error && Array.isArray(ordersData)) {
          const localOrders = getLocalOrders?.() || [];
          const merged = isLiveMode()
            ? mergeOrders(localOrders, ordersData)
            : ordersData;
          onOrdersUpdate?.(merged);

          // Patch product cache barcodes from order items
          const patches = ordersData.flatMap(o =>
            (o.items || []).filter(i => i.sku && i.barcode).map(i => ({ sku: i.sku, barcode: i.barcode }))
          );
          if (patches.length > 0) {
            productCache.patchBarcodes(patches);
          }
        }

        // Inventory: Odoo is authoritative
        if (inventoryData && !inventoryData._error && Array.isArray(inventoryData)) {
          const merged = isLiveMode()
            ? mergeInventory([], inventoryData)
            : inventoryData;
          onInventoryUpdate?.(merged);
        }

        if (wavesData && !wavesData._error && Array.isArray(wavesData)) {
          onWavesUpdate?.(wavesData);
        }

        if (invoicesData && !invoicesData._error && Array.isArray(invoicesData)) {
          onInvoicesUpdate?.(invoicesData);
        }
      }, { cancelPrevious: true });

      // Success
      _isOnline = true;
      _lastSyncTime = Date.now();
      _consecutiveErrors = 0;
      _isFirstSync = false;

    } catch (err) {
      if (err.name === 'AbortError') return; // cancelled, not an error
      _consecutiveErrors++;
      _syncError = err.message;

      // Only go offline after 3 consecutive failures
      if (_consecutiveErrors >= 3) {
        _isOnline = false;
      }

      if (!silent) {
        onToast?.(`Sync error: ${err.message}`);
      }
    } finally {
      _isSyncing = false;
      broadcastStatus();
      scheduleNext();
    }
  };

  // ── Queue drain: process offline actions ──
  const drainQueue = async () => {
    if (_destroyed || !_isOnline || !processQueueAction) return;

    const pending = await offlineQueue.getAll('pending').catch(() => []);
    if (pending.length === 0) return;

    let processed = 0;
    let failed = 0;

    for (const action of pending) {
      try {
        await offlineQueue.updateStatus(action.id, 'processing');
        await processQueueAction(action);
        await offlineQueue.remove(action.id);
        processed++;
      } catch (err) {
        await offlineQueue.updateStatus(action.id, 'failed', err.message);
        failed++;

        // If too many retries, skip this action
        if ((action.retries || 0) >= MAX_QUEUE_RETRIES) {
          // Keep it as failed for supervisor review
          continue;
        }
      }
    }

    if (processed > 0) {
      onToast?.(`Synced ${processed} queued action${processed > 1 ? 's' : ''}`);
      broadcastStatus();
      // Trigger a full sync after draining to get fresh data
      sync(true);
    }

    // Notify if there are permanently failed items
    const failedItems = await offlineQueue.getFailed(MAX_QUEUE_RETRIES).catch(() => []);
    if (failedItems.length > 0) {
      onToast?.(`${failedItems.length} action(s) failed after ${MAX_QUEUE_RETRIES} retries — needs supervisor review`);
    }
  };

  // ── Schedule next poll ──
  const scheduleNext = () => {
    if (_destroyed) return;
    if (_pollTimer) clearTimeout(_pollTimer);

    if (!_tabVisible) return; // don't poll when tab is hidden

    const interval = getNextInterval();
    _pollTimer = setTimeout(() => sync(true), interval);
  };

  // ── User activity tracking ──
  const onUserActivity = () => {
    _lastActivity = Date.now();
  };

  // ── Visibility change handler ──
  const onVisibilityChange = () => {
    _tabVisible = !document.hidden;
    if (_tabVisible) {
      // Tab became visible — sync immediately
      _lastActivity = Date.now();
      sync(true);
    } else {
      // Tab hidden — stop polling
      if (_pollTimer) clearTimeout(_pollTimer);
    }
  };

  // ── Online/offline handler ──
  const onOnline = () => {
    _isOnline = true;
    _consecutiveErrors = 0;
    sync(false);   // immediate sync + drain queue
    drainQueue();
  };

  const onOffline = () => {
    _isOnline = false;
    broadcastStatus();
  };

  // ── Queue an action (offline-safe) ──
  const queueAction = async (actionData) => {
    const id = await offlineQueue.push(actionData);
    broadcastStatus();

    // Try to process immediately if online
    if (_isOnline && processQueueAction) {
      try {
        await offlineQueue.updateStatus(id, 'processing');
        await processQueueAction(actionData);
        await offlineQueue.remove(id);
        broadcastStatus();
      } catch {
        await offlineQueue.updateStatus(id, 'pending');
        // Will be retried by drainQueue
      }
    }

    return id;
  };

  // ── Update config (when user changes Odoo settings) ──
  const updateConfig = (newConfig) => {
    odooConfig = newConfig;
    _isFirstSync = true;
    _consecutiveErrors = 0;
    requestManager.cancelByPrefix('sync:');
    sync(false);
  };

  // ── Start engine ──
  const start = () => {
    // Event listeners
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Track user activity (throttled)
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const throttledActivity = requestManager.throttle('userActivity', onUserActivity, 5000);
    activityEvents.forEach(evt => document.addEventListener(evt, throttledActivity, { passive: true }));

    // Initial sync
    sync(true);

    // Start queue drain interval
    _drainTimer = setInterval(drainQueue, DRAIN_INTERVAL);
  };

  // ── Destroy (cleanup on unmount) ──
  const destroy = () => {
    _destroyed = true;
    if (_pollTimer) clearTimeout(_pollTimer);
    if (_drainTimer) clearInterval(_drainTimer);
    requestManager.cancelByPrefix('sync:');
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };

  // ── Public API ──
  return {
    start,
    destroy,
    syncNow: () => sync(false),
    queueAction,
    updateConfig,
    drainQueue,
    getStats: () => ({
      isOnline: _isOnline,
      isSyncing: _isSyncing,
      lastSyncTime: _lastSyncTime,
      syncError: _syncError,
      consecutiveErrors: _consecutiveErrors,
      pollInterval: getNextInterval(),
      tabVisible: _tabVisible,
      isLiveMode: isLiveMode(),
      productCache: productCache.getStats(),
      requestManager: requestManager.getStats(),
    }),
    // Expose sub-modules for direct access
    productCache,
    offlineQueue,
    requestManager,
  };
};

export default createSyncEngine;
