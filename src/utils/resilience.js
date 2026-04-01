// ─────────────────────────────────────────────────────────────
//  Enterprise Resilience Utilities
//  Circuit Breaker, Retry with Backoff, Request Queue, Health Monitor
// ─────────────────────────────────────────────────────────────

// ── Circuit Breaker ───────────────────────────────────────────
// Prevents cascading failures by stopping requests to failing services.
// States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)

const CB_STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

export class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000;      // 30s before trying again
        this.halfOpenMax = options.halfOpenMax || 2;             // max concurrent in half-open
        this.monitorInterval = options.monitorInterval || 60000; // health check interval

        this.state = CB_STATE.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailure = null;
        this.halfOpenAttempts = 0;
        this._listeners = [];
    }

    async execute(fn) {
        if (this.state === CB_STATE.OPEN) {
            if (Date.now() - this.lastFailure >= this.resetTimeout) {
                this.state = CB_STATE.HALF_OPEN;
                this.halfOpenAttempts = 0;
                this._notify('half_open');
            } else {
                throw new CircuitOpenError(this.name, this.resetTimeout - (Date.now() - this.lastFailure));
            }
        }

        if (this.state === CB_STATE.HALF_OPEN && this.halfOpenAttempts >= this.halfOpenMax) {
            throw new CircuitOpenError(this.name, this.resetTimeout);
        }

        if (this.state === CB_STATE.HALF_OPEN) {
            this.halfOpenAttempts++;
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure();
            throw err;
        }
    }

    _onSuccess() {
        if (this.state === CB_STATE.HALF_OPEN) {
            this.successes++;
            if (this.successes >= 2) {
                this.state = CB_STATE.CLOSED;
                this.failures = 0;
                this.successes = 0;
                this._notify('closed');
            }
        } else {
            this.failures = Math.max(0, this.failures - 1); // slow recovery
        }
    }

    _onFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        this.successes = 0;

        if (this.state === CB_STATE.HALF_OPEN) {
            this.state = CB_STATE.OPEN;
            this._notify('open');
        } else if (this.failures >= this.failureThreshold) {
            this.state = CB_STATE.OPEN;
            this._notify('open');
        }
    }

    onStateChange(listener) {
        this._listeners.push(listener);
        return () => { this._listeners = this._listeners.filter(l => l !== listener); };
    }

    _notify(newState) {
        this._listeners.forEach(fn => {
            try { fn(this.name, newState, this.getStatus()); } catch { /* ignore */ }
        });
    }

    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            lastFailure: this.lastFailure,
            nextRetry: this.state === CB_STATE.OPEN
                ? new Date(this.lastFailure + this.resetTimeout).toISOString()
                : null,
        };
    }

    reset() {
        this.state = CB_STATE.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailure = null;
        this.halfOpenAttempts = 0;
        this._notify('closed');
    }
}

export class CircuitOpenError extends Error {
    constructor(serviceName, retryAfterMs) {
        super(`Service "${serviceName}" is temporarily unavailable. Retry in ${Math.ceil(retryAfterMs / 1000)}s.`);
        this.name = 'CircuitOpenError';
        this.serviceName = serviceName;
        this.retryAfterMs = retryAfterMs;
    }
}


// ── Retry with Exponential Backoff ────────────────────────────

export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 16000,
        backoffFactor = 2,
        retryOn = defaultRetryCondition,
        onRetry = null,
    } = options;

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;
            if (attempt >= maxRetries || !retryOn(err, attempt)) {
                throw err;
            }
            const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15x jitter
            const delayMs = Math.min(baseDelay * Math.pow(backoffFactor, attempt) * jitter, maxDelay);
            if (onRetry) onRetry(attempt + 1, delayMs, err);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw lastError;
}

function defaultRetryCondition(err) {
    if (err instanceof CircuitOpenError) return false;
    if (err.name === 'AbortError') return false;
    // Retry on network errors, 429, 500-599
    if (err.status >= 400 && err.status < 500 && err.status !== 429) return false;
    return true;
}


// ── Request Queue / Rate Limiter ──────────────────────────────
// Limits concurrent requests to prevent overloading backend.

export class RequestQueue {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 6;
        this.maxPerSecond = options.maxPerSecond || 10;
        this._active = 0;
        this._queue = [];
        this._timestamps = [];
    }

    async enqueue(fn, priority = 0) {
        return new Promise((resolve, reject) => {
            this._queue.push({ fn, resolve, reject, priority });
            this._queue.sort((a, b) => b.priority - a.priority);
            this._processNext();
        });
    }

    _canProceed() {
        if (this._active >= this.maxConcurrent) return false;
        // Rate limit check
        const now = Date.now();
        this._timestamps = this._timestamps.filter(t => now - t < 1000);
        return this._timestamps.length < this.maxPerSecond;
    }

    _processNext() {
        while (this._queue.length > 0 && this._canProceed()) {
            const { fn, resolve, reject } = this._queue.shift();
            this._active++;
            this._timestamps.push(Date.now());

            fn()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this._active--;
                    this._processNext();
                });
        }
    }

    getStatus() {
        return {
            active: this._active,
            queued: this._queue.length,
            maxConcurrent: this.maxConcurrent,
        };
    }
}


// ── Health Monitor ────────────────────────────────────────────
// Periodically checks service health and reports status.

export class HealthMonitor {
    constructor() {
        this._checks = new Map();   // name → { fn, interval, status, timer }
        this._listeners = [];
    }

    register(name, checkFn, intervalMs = 30000) {
        if (this._checks.has(name)) this.unregister(name);
        const entry = {
            fn: checkFn,
            interval: intervalMs,
            status: { healthy: null, lastCheck: null, latency: null, error: null },
            timer: null,
        };
        this._checks.set(name, entry);
        // Run first check immediately, then on interval
        this._runCheck(name);
        entry.timer = setInterval(() => this._runCheck(name), intervalMs);
    }

    unregister(name) {
        const entry = this._checks.get(name);
        if (entry?.timer) clearInterval(entry.timer);
        this._checks.delete(name);
    }

    async _runCheck(name) {
        const entry = this._checks.get(name);
        if (!entry) return;
        const start = performance.now();
        try {
            await entry.fn();
            entry.status = {
                healthy: true,
                lastCheck: new Date().toISOString(),
                latency: Math.round(performance.now() - start),
                error: null,
            };
        } catch (err) {
            entry.status = {
                healthy: false,
                lastCheck: new Date().toISOString(),
                latency: Math.round(performance.now() - start),
                error: err.message,
            };
        }
        this._notify(name, entry.status);
    }

    onStatus(listener) {
        this._listeners.push(listener);
        return () => { this._listeners = this._listeners.filter(l => l !== listener); };
    }

    _notify(name, status) {
        this._listeners.forEach(fn => {
            try { fn(name, status); } catch { /* ignore */ }
        });
    }

    getAll() {
        const result = {};
        for (const [name, entry] of this._checks) {
            result[name] = entry.status;
        }
        return result;
    }

    destroy() {
        for (const [name] of this._checks) this.unregister(name);
    }
}


// ── Request Deduplication ─────────────────────────────────────
// Prevents duplicate concurrent requests to the same endpoint.

export class RequestDeduplicator {
    constructor() {
        this._inflight = new Map();
    }

    async dedupe(key, fn) {
        if (this._inflight.has(key)) {
            return this._inflight.get(key);
        }
        const promise = fn().finally(() => this._inflight.delete(key));
        this._inflight.set(key, promise);
        return promise;
    }
}


// ── Singleton Instances ───────────────────────────────────────

export const odooCircuit = new CircuitBreaker('odoo', {
    failureThreshold: 5,
    resetTimeout: 30000,
});

export const platformCircuit = new CircuitBreaker('platform-api', {
    failureThreshold: 3,
    resetTimeout: 20000,
});

export const claudeCircuit = new CircuitBreaker('claude-api', {
    failureThreshold: 3,
    resetTimeout: 15000,
});

export const apiQueue = new RequestQueue({
    maxConcurrent: 6,
    maxPerSecond: 10,
});

export const healthMonitor = new HealthMonitor();
export const deduplicator = new RequestDeduplicator();
