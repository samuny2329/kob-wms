/**
 * TxBroadcast — Cross-tab TX sync via BroadcastChannel API
 *
 * When a TX is created in one browser tab, all other tabs
 * (same origin) receive it instantly — no server involved.
 *
 * Use case:
 *   Tab 1 (Picker): picks item → TX broadcast
 *   Tab 2 (Packer): receives TX → shows notification
 *   Tab 3 (Dashboard): receives TX → updates KPI chart
 *
 * Also works across multiple browser windows on the same machine.
 *
 * Usage:
 *   import txBroadcast from './txBroadcast';
 *   txBroadcast.start((tx) => handleIncomingTx(tx));
 *   txBroadcast.send(tx); // broadcast to other tabs
 *   txBroadcast.stop();
 */

const CHANNEL_NAME = 'wms-tx-ring';

let _channel = null;
let _onReceive = null;
let _started = false;

/**
 * Start listening for TX broadcasts from other tabs
 * @param {Function} onReceive - (tx) => void — called when another tab sends a TX
 */
const start = (onReceive) => {
  if (_started) return;

  // Check browser support (available in all modern browsers)
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('[TxBroadcast] BroadcastChannel not supported — cross-tab sync disabled');
    return;
  }

  _channel = new BroadcastChannel(CHANNEL_NAME);
  _onReceive = onReceive;

  _channel.onmessage = (event) => {
    const { type, payload } = event.data || {};

    if (type === 'tx' && payload && _onReceive) {
      _onReceive(payload);
    }

    if (type === 'sync_request' && _onReceive) {
      // Another tab is asking "what did I miss?"
      // We don't respond here — SyncEngine handles full sync
    }
  };

  _channel.onmessageerror = () => {
    // Message couldn't be deserialized — ignore
  };

  _started = true;
};

/**
 * Broadcast a TX to all other tabs
 * @param {Object} tx - The transaction object from txRing.append()
 */
const send = (tx) => {
  if (!_channel) return;
  try {
    _channel.postMessage({ type: 'tx', payload: tx });
  } catch {
    // Channel closed or message too large — ignore
  }
};

/**
 * Request other tabs to send their latest state (after reconnect)
 */
const requestSync = () => {
  if (!_channel) return;
  try {
    _channel.postMessage({ type: 'sync_request', payload: { timestamp: Date.now() } });
  } catch {
    // ignore
  }
};

/**
 * Stop listening and close the channel
 */
const stop = () => {
  if (_channel) {
    _channel.close();
    _channel = null;
  }
  _onReceive = null;
  _started = false;
};

/**
 * Check if broadcast is active
 */
const isActive = () => _started;

const txBroadcast = { start, send, requestSync, stop, isActive };

export default txBroadcast;
