/**
 * Centralized Logger — Enterprise WMS Pro
 *
 * Usage:
 *   import log from '../utils/logger';
 *   log.info('Order synced', { orderId: 123 });
 *   log.error('API failed', error);
 *
 * Levels: debug < info < warn < error
 * Production suppresses debug logs automatically.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const isProd = import.meta.env.VITE_APP_ENV === 'production' || import.meta.env.PROD;
const minLevel = isProd ? LOG_LEVELS.info : LOG_LEVELS.debug;

const PREFIX = '[WMS]';

// Sensitive field names to redact from log output
const SENSITIVE_KEYS = /^(password|secret|token|apikey|api_key|key|authorization|cookie|session_id|access_token|refresh_token|partnerkey|appsecret)$/i;
const REDACTED = '[REDACTED]';

function redactSensitive(obj, depth = 0) {
  if (depth > 5) return obj; // prevent infinite recursion
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (obj instanceof Error) return { message: obj.message, stack: obj.stack };
  if (Array.isArray(obj)) return obj.map(item => redactSensitive(item, depth + 1));
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.test(key)) {
        result[key] = REDACTED;
      } else {
        result[key] = redactSensitive(value, depth + 1);
      }
    }
    return result;
  }
  return obj;
}

function formatArgs(level, message, data) {
  const timestamp = new Date().toISOString();
  const tag = `${PREFIX} ${timestamp} [${level.toUpperCase()}]`;
  if (data === undefined) return [tag, message];
  const safeData = (typeof data === 'object' && data !== null) ? redactSensitive(data) : data;
  return [tag, message, safeData];
}

const log = {
  debug(message, data) {
    if (LOG_LEVELS.debug >= minLevel) {
      console.debug(...formatArgs('debug', message, data));
    }
  },

  info(message, data) {
    if (LOG_LEVELS.info >= minLevel) {
      console.info(...formatArgs('info', message, data));
    }
  },

  warn(message, data) {
    if (LOG_LEVELS.warn >= minLevel) {
      console.warn(...formatArgs('warn', message, data));
    }
  },

  error(message, data) {
    if (LOG_LEVELS.error >= minLevel) {
      console.error(...formatArgs('error', message, data));
    }
  },

  /** Log API call with timing */
  api(method, url, durationMs, status) {
    const emoji = status >= 400 ? '❌' : '✅';
    this.info(`${emoji} ${method} ${url} → ${status} (${durationMs}ms)`);
  },

  /** Log user action for audit trail */
  action(user, action, detail) {
    this.info(`👤 [${user}] ${action}`, detail);
  },
};

export default log;
