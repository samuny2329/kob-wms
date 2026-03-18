// Task Difficulty Scoring System for Warehouse Operations
// Scores tasks by tier (1-5) and adjusts performance metrics accordingly.

// --- Tier definitions ---
export const TIER_CONFIG = {
  1: { label: 'Easy',     color: '#10b981', icon: '\u{1F7E2}', weight: 1.0 },
  2: { label: 'Standard', color: '#3b82f6', icon: '\u{1F535}', weight: 1.5 },
  3: { label: 'Complex',  color: '#eab308', icon: '\u{1F7E1}', weight: 2.0 },
  4: { label: 'Expert',   color: '#f97316', icon: '\u{1F7E0}', weight: 3.0 },
  5: { label: 'Critical', color: '#ef4444', icon: '\u{1F534}', weight: 4.0 },
};

// Express couriers that imply tight SLA
const EXPRESS_COURIERS = ['flash', 'grab', 'lalamove', 'express', 'same_day'];

// --- Helpers ---

/** Count unique values from an array by a key */
const countUnique = (arr, key) => new Set((arr || []).map((i) => i[key]).filter(Boolean)).size;

/** Check if courier name suggests express delivery */
const isExpressCourier = (courier) =>
  EXPRESS_COURIERS.some((kw) => (courier || '').toLowerCase().includes(kw));

/** Calculate hours between two timestamps, returns null if either is missing */
const hoursBetween = (start, end) => {
  if (!start || !end) return null;
  return Math.max(0, (new Date(end) - new Date(start)) / 3600000);
};

// --- Core exports ---

/**
 * Analyze an order and return its difficulty tier.
 * Gracefully handles missing fields by assuming lowest complexity.
 */
export function calculateTaskDifficulty(order) {
  if (!order) return { tier: 1, label: 'Easy', weight: 1.0, factors: ['no data'] };

  const items = order.items || [];
  const totalQty = items.reduce((sum, i) => sum + (i.qty || 1), 0);
  const uniqueSkus = countUnique(items, 'sku');
  const uniqueZones = countUnique(items, 'zone');
  const hasSpecial = (order.specialHandling || []).length > 0;
  const hasFragileOrCold = (order.specialHandling || []).some((h) =>
    ['fragile', 'cold-chain'].includes(h)
  );
  const express = isExpressCourier(order.courier);

  // Collect human-readable factors
  const factors = [];
  if (uniqueSkus > 0) factors.push(`${uniqueSkus} SKU${uniqueSkus > 1 ? 's' : ''}`);
  if (uniqueZones > 1) factors.push('multi-zone');
  if (express) factors.push('express SLA');
  if (hasFragileOrCold) factors.push((order.specialHandling || []).join(', '));
  else if (hasSpecial) factors.push('special handling');

  // Determine tier (evaluate top-down, highest tier first)
  let tier = 1;

  if (uniqueSkus > 20 || (uniqueSkus > 15 && express)) {
    tier = 5;
    if (express) factors.push('cross-dock candidate');
  } else if (uniqueSkus >= 11 || (uniqueSkus >= 6 && hasFragileOrCold)) {
    tier = 4;
  } else if (uniqueSkus >= 6 || (uniqueSkus >= 3 && uniqueZones > 1)) {
    tier = 3;
  } else if (uniqueSkus >= 3) {
    tier = 2;
  }

  // Bump tier if express + already tier 3+
  if (express && tier >= 3 && tier < 5) tier = Math.min(tier + 1, 5);

  const cfg = TIER_CONFIG[tier];
  return { tier, label: cfg.label, weight: cfg.weight, factors };
}

/**
 * Weighted Units Per Hour — rewards workers handling harder orders.
 * @param {Array} actions - completed order actions [{ orderId, completedAt }]
 * @param {Array} orders  - full order objects (looked up by ref)
 * @param {number} hoursWorked - total hours in shift (auto-calculated if 0/null)
 */
export function calculateWeightedUPH(actions, orders, hoursWorked) {
  if (!actions || actions.length === 0) return 0;

  // Build lookup map: order ref -> order object
  const orderMap = new Map((orders || []).map((o) => [o.ref, o]));

  // Sum weights for every completed action
  let totalWeight = 0;
  let earliest = Infinity;
  let latest = -Infinity;

  for (const action of actions) {
    const order = orderMap.get(action.orderId);
    const { weight } = calculateTaskDifficulty(order);
    totalWeight += weight;

    // Track time range for auto-calculating hours
    const t = new Date(action.completedAt).getTime();
    if (!isNaN(t)) {
      if (t < earliest) earliest = t;
      if (t > latest) latest = t;
    }
  }

  // Auto-calculate hours if not provided (at least 0.1h to avoid /0)
  const hours =
    hoursWorked && hoursWorked > 0
      ? hoursWorked
      : Math.max(0.1, (latest - earliest) / 3600000);

  return Math.round((totalWeight / hours) * 100) / 100;
}

/**
 * Success rate overall and broken down by tier.
 * Success = status is 'shipped' or 'packed' (not 'error'/'returned') and
 *           completed within SLA window if timestamps available.
 * @param {Array} workerLogs - [{ orderId, success: bool }]
 * @param {Array} orders     - full order objects
 */
export function calculateSuccessRate(workerLogs, orders) {
  const empty = { overall: 0, byTier: {} };
  if (!workerLogs || workerLogs.length === 0) return empty;

  const orderMap = new Map((orders || []).map((o) => [o.ref, o]));

  // Buckets per tier: { attempts, successes }
  const buckets = {};
  for (let t = 1; t <= 5; t++) buckets[t] = { attempts: 0, successes: 0 };

  let totalAttempts = 0;
  let totalSuccesses = 0;

  for (const log of workerLogs) {
    const order = orderMap.get(log.orderId);
    const { tier } = calculateTaskDifficulty(order);

    buckets[tier].attempts += 1;
    totalAttempts += 1;

    if (log.success) {
      buckets[tier].successes += 1;
      totalSuccesses += 1;
    }
  }

  // Build per-tier percentages (only tiers with attempts)
  const byTier = {};
  for (let t = 1; t <= 5; t++) {
    const b = buckets[t];
    if (b.attempts > 0) {
      byTier[t] = Math.round((b.successes / b.attempts) * 100);
    }
  }

  return {
    overall: totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : 0,
    byTier,
  };
}

/**
 * Derive a skill profile from a worker's historical logs.
 * Identifies strong/weak tiers and suggests targeted training.
 */
export function calculateWorkerSkillProfile(workerLogs, orders) {
  const defaults = {
    strongTiers: [],
    weakTiers: [],
    bestCategory: 'unknown',
    suggestedTraining: 'Insufficient data for analysis',
  };
  if (!workerLogs || workerLogs.length < 3) return defaults;

  const { byTier } = calculateSuccessRate(workerLogs, orders);

  const STRONG_THRESHOLD = 90;
  const WEAK_THRESHOLD = 75;

  const strongTiers = [];
  const weakTiers = [];

  for (const [tier, pct] of Object.entries(byTier)) {
    const t = Number(tier);
    if (pct >= STRONG_THRESHOLD) strongTiers.push(t);
    if (pct < WEAK_THRESHOLD) weakTiers.push(t);
  }

  // Determine best category label based on strongest tier performance
  const categoryMap = {
    1: 'single-sku',
    2: 'standard-batch',
    3: 'multi-zone',
    4: 'specialist',
    5: 'critical-ops',
  };
  const bestTier = strongTiers.length > 0 ? Math.max(...strongTiers) : 1;
  const bestCategory = categoryMap[bestTier] || 'unknown';

  // Generate training suggestion based on weakest tier
  let suggestedTraining = 'Maintain current performance';
  if (weakTiers.length > 0) {
    const lowestWeak = Math.min(...weakTiers);
    const suggestions = {
      1: 'Review basic pick/pack procedures',
      2: 'Practice multi-SKU batching',
      3: 'Cross-zone navigation and priority handling training',
      4: 'Fragile/cold-chain handling certification',
      5: 'Express SLA and cross-dock operations training',
    };
    suggestedTraining = suggestions[lowestWeak] || suggestedTraining;
  }

  return { strongTiers, weakTiers, bestCategory, suggestedTraining };
}

/**
 * Distribution of orders across difficulty tiers.
 * Returns count and percentage per tier.
 */
export function getTaskDistribution(orders) {
  const dist = {};
  for (let t = 1; t <= 5; t++) dist[t] = { count: 0, pct: 0 };

  if (!orders || orders.length === 0) return dist;

  for (const order of orders) {
    const { tier } = calculateTaskDifficulty(order);
    dist[tier].count += 1;
  }

  const total = orders.length;
  for (let t = 1; t <= 5; t++) {
    dist[t].pct = Math.round((dist[t].count / total) * 100);
  }

  return dist;
}
