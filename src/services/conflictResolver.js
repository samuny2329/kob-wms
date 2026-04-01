/**
 * ConflictResolver — Field-level merge for concurrent edits
 *
 * When multiple workers edit the same order simultaneously,
 * this module merges changes at the item level instead of
 * last-write-wins which causes data loss.
 *
 * Rules:
 *   1. Odoo 'done'/'rts' status always wins (source of truth)
 *   2. Higher pick/pack progress wins (work already done)
 *   3. Remote new orders are added
 *   4. Locally cancelled orders removed if Odoo confirms cancel
 *   5. Barcode always taken from remote (Odoo master data)
 *
 * Usage:
 *   import { mergeOrders } from './conflictResolver';
 *   const merged = mergeOrders(localOrders, remoteOrders);
 */

// Status priority: higher = more progressed (can't go backwards)
const STATUS_PRIORITY = {
  'pending': 0,
  'picking': 1,
  'picked': 2,
  'packing': 3,
  'packed': 4,
  'rts': 5,
  'shipped': 6,
  'delivered': 7,
  'cancelled': -1,  // special: only Odoo can set this
};

/**
 * Merge a single order's items (field-level)
 * Local picks/packs are preserved, remote barcodes are used
 */
const mergeItems = (localItems = [], remoteItems = []) => {
  const merged = [];

  for (const remoteItem of remoteItems) {
    const localItem = localItems.find(
      li => li.moveId === remoteItem.moveId || li.sku === remoteItem.sku
    );

    if (!localItem) {
      // New item from Odoo (e.g., order line added)
      merged.push(remoteItem);
      continue;
    }

    // Field-level merge
    merged.push({
      ...remoteItem,                           // base: Odoo master (barcode, name, expected)
      picked: Math.max(localItem.picked || 0, remoteItem.picked || 0),
      packed: Math.max(localItem.packed || 0, remoteItem.packed || 0),
      // Preserve local-only fields
      ...(localItem.pickedAt && { pickedAt: localItem.pickedAt }),
      ...(localItem.pickedBy && { pickedBy: localItem.pickedBy }),
      ...(localItem.packedAt && { packedAt: localItem.packedAt }),
      ...(localItem.packedBy && { packedBy: localItem.packedBy }),
      ...(localItem.scannedBarcode && { scannedBarcode: localItem.scannedBarcode }),
    });
  }

  // Check for items only in local (removed from Odoo = deleted line)
  // Don't add them back — trust Odoo as source of truth for order lines

  return merged;
};

/**
 * Merge a single order
 * Returns the merged order
 */
const mergeOrder = (local, remote) => {
  // Rule 1: Odoo done/rts always wins
  if (remote.status === 'rts' || remote.status === 'shipped' || remote.status === 'delivered') {
    return {
      ...remote,
      // Preserve local metadata that Odoo doesn't track
      ...(local.awb && !remote.awb && { awb: local.awb }),
      ...(local.packedAt && { packedAt: local.packedAt }),
      ...(local.dispatchedAt && { dispatchedAt: local.dispatchedAt }),
    };
  }

  // Rule 2: Cancelled in Odoo = remove
  if (remote.status === 'cancelled') {
    return { ...remote, _removed: true };
  }

  // Rule 3: Compare progress
  const localPriority = STATUS_PRIORITY[local.status] || 0;
  const remotePriority = STATUS_PRIORITY[remote.status] || 0;

  // Use the more progressed version as base
  const base = localPriority >= remotePriority ? local : remote;
  const other = localPriority >= remotePriority ? remote : local;

  return {
    ...base,
    // Always use Odoo data for these fields (master data)
    customer: remote.customer,
    platform: remote.platform || base.platform,
    courier: remote.courier || base.courier,
    scheduledDate: remote.scheduledDate || base.scheduledDate,
    odooPickingId: remote.odooPickingId || base.odooPickingId,
    odooOrigin: remote.odooOrigin || base.odooOrigin,
    // Merge items at field level
    items: mergeItems(local.items, remote.items),
    // Use more progressed status
    status: localPriority >= remotePriority ? local.status : remote.status,
    // Track merge metadata
    _lastMerge: Date.now(),
    _mergeSource: localPriority >= remotePriority ? 'local' : 'remote',
  };
};

/**
 * Merge full order lists
 * @param {Array} localOrders - Current local state
 * @param {Array} remoteOrders - Fresh data from Odoo
 * @returns {Array} Merged orders
 */
export const mergeOrders = (localOrders = [], remoteOrders = []) => {
  const localMap = new Map(localOrders.map(o => [o.id, o]));
  const merged = [];

  // Process all remote orders
  for (const remote of remoteOrders) {
    const local = localMap.get(remote.id);

    if (!local) {
      // New order from Odoo
      merged.push(remote);
    } else {
      const result = mergeOrder(local, remote);
      if (!result._removed) {
        // Clean up internal merge flags before storing
        const { _removed, ...clean } = result;
        merged.push(clean);
      }
      // If _removed, skip it (cancelled in Odoo)
      localMap.delete(remote.id);
    }
  }

  // Local-only orders (not in Odoo response)
  // Keep them only if they are NOT from Odoo (e.g., mock/demo orders)
  // If they have odooPickingId, they were from Odoo but are now gone = cancelled/archived
  for (const [id, local] of localMap) {
    if (!local.odooPickingId) {
      // Local-only order (mock/demo) — keep it
      merged.push(local);
    }
    // Else: was in Odoo but no longer returned = filtered out (cancelled/archived/old)
    // Don't keep stale Odoo orders locally
  }

  return merged;
};

/**
 * Merge inventory data
 * Remote always wins for inventory (Odoo is source of truth for stock levels)
 */
export const mergeInventory = (localInventory = [], remoteInventory = []) => {
  // For inventory, Odoo is always authoritative
  // Just return remote data
  return remoteInventory;
};

export default { mergeOrders, mergeInventory };
