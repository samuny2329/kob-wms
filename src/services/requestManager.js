/**
 * RequestManager — Dedup, Cancel, Throttle
 *
 * Prevents duplicate concurrent requests, cancels stale ones,
 * and throttles high-frequency calls to protect Odoo server.
 *
 * Usage:
 *   import requestManager from './requestManager';
 *   const data = await requestManager.request('fetchOrders', () => fetchAllOrders(config));
 *   requestManager.cancelAll(); // on logout or tab switch
 */

const _inflight = new Map();   // key → { promise, controller, timestamp }
let _requestId = 0;            // monotonic counter for JSONRPC ids

// ── Unique Request ID (replaces Date.now() which can collide) ──
export const nextRequestId = () => ++_requestId;

// ── Dedup + Cancel ──
// If the same key is already in-flight, return the existing promise (dedup).
// If `cancelPrevious` is true, abort the old request and start fresh.
const request = async (key, fn, { cancelPrevious = false, timeout = 10000 } = {}) => {
  const existing = _inflight.get(key);

  if (existing) {
    if (!cancelPrevious) {
      // Dedup: return the same in-flight promise
      return existing.promise;
    }
    // Cancel previous
    try { existing.controller?.abort(); } catch { /* ignore */ }
    _inflight.delete(key);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const promise = fn(controller.signal)
    .then(result => {
      clearTimeout(timeoutId);
      _inflight.delete(key);
      return result;
    })
    .catch(err => {
      clearTimeout(timeoutId);
      _inflight.delete(key);
      throw err;
    });

  _inflight.set(key, { promise, controller, timestamp: Date.now() });
  return promise;
};

// ── Cancel all in-flight requests ──
const cancelAll = () => {
  for (const [key, { controller }] of _inflight) {
    try { controller?.abort(); } catch { /* ignore */ }
    _inflight.delete(key);
  }
};

// ── Cancel by key prefix (e.g., 'sync:' cancels all sync requests) ──
const cancelByPrefix = (prefix) => {
  for (const [key, { controller }] of _inflight) {
    if (key.startsWith(prefix)) {
      try { controller?.abort(); } catch { /* ignore */ }
      _inflight.delete(key);
    }
  }
};

// ── Throttle: returns a wrapper that skips calls within `ms` of last call ──
const _lastCall = new Map();
const MAX_THROTTLE_KEYS = 200;
const throttle = (key, fn, ms = 2000) => {
  return async (...args) => {
    const now = Date.now();
    const last = _lastCall.get(key) || 0;
    if (now - last < ms) return null; // skip, too soon
    _lastCall.set(key, now);
    // Prune stale entries to prevent unbounded growth
    if (_lastCall.size > MAX_THROTTLE_KEYS) {
      for (const [k, t] of _lastCall) {
        if (now - t > 60000) _lastCall.delete(k);
      }
    }
    return fn(...args);
  };
};

// ── Debounce: delays execution, resets timer on new call ──
const _debounceTimers = new Map();
const debounce = (key, fn, ms = 1000) => {
  return (...args) => {
    return new Promise((resolve) => {
      const existing = _debounceTimers.get(key);
      if (existing) clearTimeout(existing);
      _debounceTimers.set(key, setTimeout(async () => {
        _debounceTimers.delete(key);
        resolve(await fn(...args));
      }, ms));
    });
  };
};

// ── Stats for debugging ──
const getStats = () => ({
  inflight: _inflight.size,
  keys: [..._inflight.keys()],
  throttled: [..._lastCall.keys()],
});

const requestManager = { request, cancelAll, cancelByPrefix, throttle, debounce, nextRequestId, getStats };
export default requestManager;
