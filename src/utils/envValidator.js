/**
 * Environment Config Validator — Enterprise WMS Pro
 *
 * Validates that required environment variables are set on startup.
 * Call validateEnv() in main.jsx before rendering.
 */

const REQUIRED_VARS = [
  // None strictly required for app boot — Odoo/Firebase configured in UI Settings
];

const RECOMMENDED_VARS = [
  { key: 'VITE_ODOO_URL', description: 'Odoo server URL (e.g. https://odoo.yourdomain.com)' },
  { key: 'VITE_APP_ENV', description: 'Environment: production | staging | development' },
];

export function validateEnv() {
  const missing = [];
  const warnings = [];

  // Check required vars
  for (const key of REQUIRED_VARS) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  // Check recommended vars
  for (const { key, description } of RECOMMENDED_VARS) {
    if (!import.meta.env[key]) {
      warnings.push(`${key} — ${description}`);
    }
  }

  // Report
  if (missing.length > 0) {
    console.error(
      `[WMS] ❌ Missing required environment variables:\n` +
      missing.map(k => `  - ${k}`).join('\n') +
      `\nCopy .env.example to .env and fill in the values.`
    );
  }

  if (warnings.length > 0) {
    console.warn(
      `[WMS] ⚠️ Recommended environment variables not set:\n` +
      warnings.map(w => `  - ${w}`).join('\n')
    );
  }

  return { valid: missing.length === 0, missing, warnings };
}

export function getAppEnv() {
  return import.meta.env.VITE_APP_ENV || (import.meta.env.PROD ? 'production' : 'development');
}

export function isProduction() {
  return getAppEnv() === 'production';
}
