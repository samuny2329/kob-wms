/**
 * TxSubscription — Role-based event subscription & notification
 *
 * Each role subscribes to TX actions they care about.
 * When a matching TX is appended, subscribers get notified instantly.
 *
 * Built-in routing rules:
 *   pick.confirmed   → packer, supervisor
 *   pack.confirmed   → outbound, supervisor
 *   scan.confirmed   → dispatch, supervisor
 *   confirmRTS       → dispatch, accounting, supervisor
 *   adjust           → supervisor, inventory
 *   *                → supervisor (sees everything)
 *
 * Usage:
 *   import txSub from './txSubscription';
 *
 *   // Subscribe
 *   const unsub = txSub.subscribe('packer01', 'packer', (tx) => {
 *     showNotification(`Order ${tx.target.orderId} ready to pack`);
 *   });
 *
 *   // When a TX is created, notify all subscribers
 *   txSub.notify(tx);
 *
 *   // Cleanup
 *   unsub();
 */

// ── Default routing: action → which roles get notified ──
const DEFAULT_ROUTES = {
  'pick':         ['packer', 'senior', 'admin'],
  'pack':         ['outbound', 'senior', 'admin'],
  'scan':         ['outbound', 'senior', 'admin'],
  'confirmRTS':   ['outbound', 'senior', 'admin'],
  'dispatch':     ['senior', 'admin'],
  'adjust':       ['senior', 'admin'],
  'cycleCount':   ['senior', 'admin'],
  'transfer':     ['senior', 'admin', 'picker', 'packer'],
  'gwp':          ['packer', 'senior', 'admin'],
  'login':        ['admin'],
  'logout':       ['admin'],
};

// ── Notification message templates ──
const MESSAGE_TEMPLATES = {
  pick:       (tx) => `📦 Order ${tx.target.orderRef || tx.target.orderId} picked by ${tx.actor} — ready to pack`,
  pack:       (tx) => `📦 Order ${tx.target.orderRef || tx.target.orderId} packed by ${tx.actor} — ready to scan`,
  scan:       (tx) => `📦 Order ${tx.target.orderRef || tx.target.orderId} scanned by ${tx.actor}`,
  confirmRTS: (tx) => `✅ Order ${tx.target.orderRef || tx.target.orderId} confirmed RTS — AWB: ${tx.target.awb || 'pending'}`,
  dispatch:   (tx) => `🚛 Dispatch batch by ${tx.actor} — ${tx.target.count || 1} orders`,
  adjust:     (tx) => `📊 Inventory adjusted: ${tx.target.sku} by ${tx.actor} (${tx.target.variance > 0 ? '+' : ''}${tx.target.variance})`,
  cycleCount: (tx) => `📋 Cycle count completed by ${tx.actor} — ${tx.target.itemCount || 0} items`,
  transfer:   (tx) => `🔄 Internal transfer by ${tx.actor}: ${tx.target.from} → ${tx.target.to}`,
  gwp:        (tx) => `🎁 GWP created: ${tx.target.sku} by ${tx.actor}`,
  login:      (tx) => `🔑 ${tx.actor} logged in`,
  logout:     (tx) => `🔑 ${tx.actor} logged out`,
};

// ── Subscriber registry ──
// Map<subscriberId, { userId, role, callback, filters }>
const _subscribers = new Map();
let _subCounter = 0;

// ── Custom routes (can be extended at runtime) ──
let _routes = { ...DEFAULT_ROUTES };

/**
 * Subscribe to TX events
 * @param {string} userId - e.g. 'packer01'
 * @param {string} role - e.g. 'packer', 'senior', 'admin'
 * @param {Function} callback - (tx, message) => void
 * @param {Object} filters - optional { actions: ['pick','pack'], orderIds: [100] }
 * @returns {Function} unsubscribe function
 */
const subscribe = (userId, role, callback, filters = {}) => {
  const id = ++_subCounter;
  _subscribers.set(id, { userId, role, callback, filters });

  // Return unsubscribe function
  return () => {
    _subscribers.delete(id);
  };
};

/**
 * Notify all matching subscribers about a new TX
 * Called after txRing.append()
 */
const notify = (tx) => {
  const action = tx.action;
  const affectedRoles = _routes[action] || [];

  // Also check tx.affects (explicit list from the TX creator)
  const allAffected = new Set([...affectedRoles, ...(tx.affects || [])]);

  for (const [, sub] of _subscribers) {
    // Skip the actor themselves (don't notify yourself)
    if (sub.userId === tx.actor) continue;

    // Check role match
    const roleMatch = allAffected.has(sub.role) || sub.role === 'admin' || sub.role === 'senior';

    // Check custom filters
    let filterMatch = true;
    if (sub.filters.actions && !sub.filters.actions.includes(action)) {
      filterMatch = false;
    }
    if (sub.filters.orderIds && tx.target?.orderId && !sub.filters.orderIds.includes(tx.target.orderId)) {
      filterMatch = false;
    }

    if (roleMatch && filterMatch) {
      const template = MESSAGE_TEMPLATES[action];
      const message = template ? template(tx) : `${action} by ${tx.actor}`;
      try {
        sub.callback(tx, message);
      } catch (err) {
        // Don't let one bad subscriber break others
        console.warn('[TxSubscription] callback error:', err);
      }
    }
  }
};

/**
 * Get subscriber count and list
 */
const getSubscribers = () => {
  const list = [];
  for (const [id, sub] of _subscribers) {
    list.push({ id, userId: sub.userId, role: sub.role, hasFilters: Object.keys(sub.filters).length > 0 });
  }
  return list;
};

/**
 * Add custom route (extend default routing)
 */
const addRoute = (action, roles) => {
  _routes[action] = [...new Set([...(_routes[action] || []), ...roles])];
};

/**
 * Reset routes to defaults
 */
const resetRoutes = () => {
  _routes = { ...DEFAULT_ROUTES };
};

/**
 * Get current routes
 */
const getRoutes = () => ({ ..._routes });

/**
 * Clear all subscribers (for logout/cleanup)
 */
const clearAll = () => {
  _subscribers.clear();
  _subCounter = 0;
};

const txSubscription = {
  subscribe,
  notify,
  getSubscribers,
  addRoute,
  resetRoutes,
  getRoutes,
  clearAll,
  MESSAGE_TEMPLATES,
};

export default txSubscription;
