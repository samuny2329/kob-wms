// src/utils/crypto.js — AES-GCM encryption for localStorage sensitive data
// Uses Web Crypto API (available in all modern browsers)

const ENCRYPTION_KEY_NAME = 'wms_enc_key';
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

// Derive a CryptoKey from a passphrase (PBKDF2)
async function deriveKey(passphrase) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('kob-wms-v1-salt'), iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// Generate and store a random encryption key (per-browser instance)
async function getOrCreateKey() {
    try {
        const stored = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
        if (stored) {
            return deriveKey(stored);
        }
        // Generate a random passphrase and store in sessionStorage (cleared on tab close)
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const passphrase = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem(ENCRYPTION_KEY_NAME, passphrase);
        return deriveKey(passphrase);
    } catch {
        return null; // Graceful fallback if crypto unavailable
    }
}

// Encrypt a string → base64(iv + ciphertext)
export async function encrypt(plaintext) {
    try {
        const key = await getOrCreateKey();
        if (!key) return plaintext; // Fallback: no encryption
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const enc = new TextEncoder();
        const ciphertext = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv },
            key,
            enc.encode(plaintext)
        );
        // Combine iv + ciphertext
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);
        return 'enc:' + btoa(String.fromCharCode(...combined));
    } catch {
        return plaintext;
    }
}

// Decrypt base64(iv + ciphertext) → string
export async function decrypt(encoded) {
    try {
        if (!encoded || !encoded.startsWith('enc:')) return encoded; // Not encrypted
        const key = await getOrCreateKey();
        if (!key) return encoded;
        const raw = Uint8Array.from(atob(encoded.slice(4)), c => c.charCodeAt(0));
        const iv = raw.slice(0, IV_LENGTH);
        const ciphertext = raw.slice(IV_LENGTH);
        const decrypted = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    } catch {
        return encoded; // Return as-is if decryption fails (key changed / data corrupted)
    }
}

// Secure localStorage wrapper for sensitive keys
const SENSITIVE_KEYS = ['wms_apis', 'wms_session', 'wms_audit_log'];

export async function secureSet(key, value) {
    const json = JSON.stringify(value);
    if (SENSITIVE_KEYS.includes(key)) {
        const encrypted = await encrypt(json);
        localStorage.setItem(key, encrypted);
    } else {
        localStorage.setItem(key, json);
    }
}

export async function secureGet(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        if (SENSITIVE_KEYS.includes(key) && raw.startsWith('enc:')) {
            const decrypted = await decrypt(raw);
            return JSON.parse(decrypted);
        }
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

// Mask sensitive values for display (show only last 4 chars)
export function maskSecret(value) {
    if (!value || typeof value !== 'string' || value.length < 8) return '****';
    return '****' + value.slice(-4);
}
