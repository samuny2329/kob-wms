import { useState, useEffect, useRef, useCallback } from 'react';
import txRing from '../services/transactionRing';
import txSub from '../services/txSubscription';
import txBroadcast from '../services/txBroadcast';

/**
 * useTransactionRing — React hook for Transaction Ring
 *
 * Provides: emit (create TX), subscribe (receive notifications),
 *           history (query past TXs), and cross-tab broadcast.
 *
 * Usage in component:
 *   const { emit, notifications, orderTrail, stats } = useTransactionRing({
 *     userId: 'picker01', role: 'picker', onNotification: (tx, msg) => addToast(msg),
 *   });
 *
 *   // Emit a TX when user picks an item
 *   await emit('pick', { orderId: 100, sku: 'STDH080', qty: 1 });
 *
 *   // View order trail
 *   const trail = await orderTrail(100);
 */
const useTransactionRing = ({ userId, role, onNotification }) => {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const notifRef = useRef(notifications);
  notifRef.current = notifications;

  // Subscribe to TX notifications for this user's role
  useEffect(() => {
    if (!userId || !role) return;

    const handleNotification = (tx, message) => {
      const notif = { id: tx.hash, tx, message, timestamp: Date.now(), read: false };
      setNotifications(prev => [notif, ...prev].slice(0, 50)); // keep last 50
      onNotification?.(tx, message);
    };

    // Subscribe this user
    const unsub = txSub.subscribe(userId, role, handleNotification);

    // Start cross-tab broadcast — receive TXs from other tabs
    txBroadcast.start((incomingTx) => {
      // Notify this tab's subscribers about the remote TX
      txSub.notify(incomingTx);
    });

    // Load initial stats
    txRing.getStats().then(setStats);

    return () => {
      unsub();
      txBroadcast.stop();
      txSub.clearAll();
    };
  }, [userId, role, onNotification]);

  // Emit a new TX (pick, pack, scan, etc.)
  const emit = useCallback(async (action, target = {}, extra = {}) => {
    const affects = extra.affects || [];
    const meta = extra.meta || {};

    // Append to ring (IndexedDB + hash chain)
    const tx = await txRing.append({ action, actor: userId, target, affects, meta });

    // Notify all local subscribers
    txSub.notify(tx);

    // Broadcast to other tabs
    txBroadcast.send(tx);

    // Update stats
    txRing.getStats().then(setStats);

    return tx;
  }, [userId]);

  // Query order audit trail
  const orderTrail = useCallback(async (orderId) => {
    return txRing.getOrderTrail(orderId);
  }, []);

  // Query TXs with filters
  const queryTx = useCallback(async (filters) => {
    return txRing.query(filters);
  }, []);

  // Mark notification as read
  const markRead = useCallback((notifId) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Verify chain integrity
  const verifyChain = useCallback(async () => {
    return txRing.verifyChain();
  }, []);

  return {
    emit,
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    orderTrail,
    queryTx,
    markRead,
    clearNotifications,
    verifyChain,
    stats,
  };
};

export default useTransactionRing;
