// src/utils/secureStorage.js
// Secure localStorage wrapper with AES-GCM encryption for sensitive data

const STORAGE_PREFIX = 'wms_enc_';
const APP_SECRET = 'WMS-Pro-2026-KOB'; // App-level secret (not user secret)

// Derive encryption key from app secret + salt
async function deriveKey(salt = 'wms-default-salt') {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(APP_SECRET + salt), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// Encrypt and store
export async function secureSet(key, value, salt) {
    try {
        if (!crypto?.subtle) {
            // Fallback for HTTP/non-secure contexts — base64 obfuscation only
            localStorage.setItem(STORAGE_PREFIX + key, btoa(JSON.stringify(value)));
            return;
        }
        const enc = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cryptoKey = await deriveKey(salt);
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            enc.encode(JSON.stringify(value))
        );
        const payload = {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted)),
        };
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
    } catch (e) {
        console.warn('secureSet fallback:', key);
        localStorage.setItem(STORAGE_PREFIX + key, btoa(JSON.stringify(value)));
    }
}

// Decrypt and retrieve
export async function secureGet(key, salt, fallback = null) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if (!raw) return fallback;

        if (!crypto?.subtle) {
            // Fallback: base64 decode
            return JSON.parse(atob(raw));
        }

        const payload = JSON.parse(raw);
        if (!payload.iv || !payload.data) {
            // Legacy unencrypted or base64
            try { return JSON.parse(atob(raw)); } catch { return JSON.parse(raw); }
        }

        const cryptoKey = await deriveKey(salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
            cryptoKey,
            new Uint8Array(payload.data)
        );
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
        console.warn('secureGet fallback:', key);
        return fallback;
    }
}

// Remove encrypted item
export function secureRemove(key) {
    localStorage.removeItem(STORAGE_PREFIX + key);
}

// Check if key exists
export function secureHas(key) {
    return localStorage.getItem(STORAGE_PREFIX + key) !== null;
}
