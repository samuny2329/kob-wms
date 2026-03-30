import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Dev proxy target — override with VITE_ODOO_URL env var.
// In production, nginx (or similar) handles the reverse proxy to Odoo.
const odooTarget = process.env.VITE_ODOO_URL || 'http://localhost:8070';

export default defineConfig({
    base: process.env.GITHUB_ACTIONS ? '/kob-wms/' : '/',
    plugins: [react()],
    server: {
        host: true,
        proxy: {
            '/wms': {
                target: odooTarget,
                changeOrigin: true,
                secure: false,
            },
            '/web/session': {
                target: odooTarget,
                changeOrigin: true,
                secure: false,
            },
            '/web/dataset': {
                target: odooTarget,
                changeOrigin: true,
                secure: false,
            },
        }
    }
})
