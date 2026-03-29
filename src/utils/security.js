// src/utils/security.js — Security utilities for WMS Pro

// ── Password Hashing (SHA-256 based — for client-side, production should use bcrypt server-side) ──
// Uses Web Crypto API for browser-native hashing
const SALT_PREFIX = 'wms_pro_v1_';

export async function hashPassword(password) {
  const data = new TextEncoder().encode(SALT_PREFIX + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== hash.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return result === 0;
}

// ── Session Management ──
const SESSION_KEY = 'wms_session';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_WARNING_MS = 25 * 60 * 1000; // Warning at 25 minutes

export function createSession(user) {
  // Store session WITHOUT password
  const { password, ...safeUser } = user;
  const session = {
    user: safeUser,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      destroySession();
      return null; // expired
    }
    return session;
  } catch {
    destroySession();
    return null;
  }
}

export function refreshSession() {
  const session = getSession();
  if (!session) return null;
  session.lastActivity = Date.now();
  session.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function destroySession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userRole');
}

export function isSessionExpiringSoon() {
  const session = getSession();
  if (!session) return false;
  return Date.now() > (session.expiresAt - (SESSION_TIMEOUT_MS - SESSION_WARNING_MS));
}

export function getSessionTimeRemaining() {
  const session = getSession();
  if (!session) return 0;
  return Math.max(0, session.expiresAt - Date.now());
}

// ── Login Rate Limiting ──
const LOGIN_ATTEMPTS_KEY = 'wms_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5-minute window

export function getLoginAttempts() {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return { attempts: [], lockedUntil: null };
    return JSON.parse(raw);
  } catch {
    return { attempts: [], lockedUntil: null };
  }
}

export function isAccountLocked() {
  const data = getLoginAttempts();
  if (data.lockedUntil && Date.now() < data.lockedUntil) {
    return {
      locked: true,
      remainingMs: data.lockedUntil - Date.now(),
      remainingMin: Math.ceil((data.lockedUntil - Date.now()) / 60000),
    };
  }
  return { locked: false, remainingMs: 0, remainingMin: 0 };
}

export function recordLoginAttempt(success) {
  const data = getLoginAttempts();
  const now = Date.now();

  if (success) {
    // Clear attempts on successful login
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({ attempts: [], lockedUntil: null }));
    return { locked: false };
  }

  // Add failed attempt, keep only recent ones within window
  const recentAttempts = [...data.attempts.filter(t => now - t < ATTEMPT_WINDOW_MS), now];

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    const lockData = { attempts: recentAttempts, lockedUntil: now + LOCKOUT_DURATION_MS };
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(lockData));
    return { locked: true, remainingMin: Math.ceil(LOCKOUT_DURATION_MS / 60000) };
  }

  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({ attempts: recentAttempts, lockedUntil: null }));
  return { locked: false, attemptsLeft: MAX_ATTEMPTS - recentAttempts.length };
}

// ── Input Sanitization ──
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Sanitize object recursively (for localStorage data)
export function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeText(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[sanitizeText(key)] = sanitizeObject(value);
    }
    return result;
  }
  return obj;
}

// Validate score is 1-5
export function validateScore(score) {
  const n = parseInt(score);
  if (isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

// Validate weight is 0-100
export function validateWeight(weight) {
  const n = parseFloat(weight);
  if (isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

// ── Password Strength Validation ──
export function validatePasswordStrength(password) {
  const result = { valid: false, strength: 'weak', errors: [], score: 0 };
  if (!password || typeof password !== 'string') {
    result.errors.push('Password is required');
    return result;
  }
  if (password.length >= 8) result.score += 1;
  else result.errors.push('Minimum 8 characters');
  if (/[A-Z]/.test(password)) result.score += 1;
  else result.errors.push('At least 1 uppercase letter');
  if (/[a-z]/.test(password)) result.score += 1;
  else result.errors.push('At least 1 lowercase letter');
  if (/[0-9]/.test(password)) result.score += 1;
  else result.errors.push('At least 1 number');
  // Bonus points for special chars and length
  if (/[^A-Za-z0-9]/.test(password)) result.score += 1;
  if (password.length >= 12) result.score += 1;

  result.valid = result.errors.length === 0;
  if (result.score >= 5) result.strength = 'strong';
  else if (result.score >= 3) result.strength = 'medium';
  else result.strength = 'weak';
  return result;
}

// ── CSRF Token ──
export function generateCSRFToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

let csrfToken = null;
export function getCSRFToken() {
  if (!csrfToken) {
    csrfToken = localStorage.getItem('wms_csrf_token');
    if (!csrfToken) {
      csrfToken = generateCSRFToken();
      localStorage.setItem('wms_csrf_token', csrfToken);
    }
  }
  return csrfToken;
}

// ── Audit Logger ──
const AUDIT_KEY = 'wms_audit_log';
const MAX_AUDIT_ENTRIES = 500;

export function auditLog(action, details = {}, username = null) {
  try {
    const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      action,
      username: username || getSession()?.user?.username || 'anonymous',
      details: typeof details === 'string' ? { message: details } : details,
      userAgent: navigator.userAgent?.substring(0, 100),
    };
    logs.unshift(entry);
    // Keep only recent entries
    if (logs.length > MAX_AUDIT_ENTRIES) logs.length = MAX_AUDIT_ENTRIES;
    localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
  } catch { /* fail silently */ }
}

// ── Secure localStorage wrapper ──
// Strips password fields before storing user data
export function secureStoreUser(key, userData) {
  if (Array.isArray(userData)) {
    // For user list: don't remove passwords (needed for auth), but mark as sensitive
    localStorage.setItem(key, JSON.stringify(userData));
    return;
  }
  // For single user (currentUser): strip password
  const { password, ...safe } = userData || {};
  localStorage.setItem(key, JSON.stringify(safe));
}

// ── File Upload Validation ──
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFileUpload(file) {
  if (!file) return { valid: false, error: 'No file selected' };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` };
  if (file.size === 0) return { valid: false, error: 'File is empty' };

  // Check extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExts = ['pdf', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png', 'docx'];
  if (!allowedExts.includes(ext)) return { valid: false, error: `File type .${ext} not allowed` };

  // Check MIME type if available
  if (file.type && !ALLOWED_FILE_TYPES.includes(file.type) && !file.type.startsWith('text/')) {
    return { valid: false, error: `MIME type ${file.type} not allowed` };
  }

  // Sanitize filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);

  return { valid: true, safeName };
}
