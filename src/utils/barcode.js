// Barcode validation and sanitization utilities
// Prevents injection attacks and ensures barcode format consistency

// Allowed characters: alphanumeric, hyphens, underscores, dots, slashes, spaces
// Covers EAN-8/13, CODE128, SKU formats (e.g., "WH/OUT/00050", "STDH-080", "GWP-0001")
const BARCODE_REGEX = /^[A-Za-z0-9\-_./\s]{1,128}$/;

/**
 * Validate barcode/SKU input against allowed patterns.
 * Returns { valid, sanitized, error }
 */
export function validateBarcode(input) {
    if (!input || typeof input !== 'string') {
        return { valid: false, sanitized: '', error: 'Empty barcode' };
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return { valid: false, sanitized: '', error: 'Empty barcode' };
    }

    if (trimmed.length > 128) {
        return { valid: false, sanitized: trimmed.slice(0, 128), error: 'Barcode too long (max 128 chars)' };
    }

    if (!BARCODE_REGEX.test(trimmed)) {
        return { valid: false, sanitized: trimmed.replace(/[^A-Za-z0-9\-_./\s]/g, ''), error: 'Invalid characters in barcode' };
    }

    return { valid: true, sanitized: trimmed, error: null };
}

/**
 * Sanitize barcode input — strips invalid chars, enforces length limit.
 * Use at all barcode entry points (scan, import, API).
 */
export function sanitizeBarcode(input) {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[^A-Za-z0-9\-_./\s]/g, '').trim().slice(0, 128);
}

/**
 * Validate numeric SVG dimension parameter.
 * Prevents DoS via excessively large or negative values.
 */
export function validateSvgDimension(value, min = 1, max = 2000, fallback = 260) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < min || num > max) return fallback;
    return num;
}
