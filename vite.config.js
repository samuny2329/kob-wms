import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Dev proxy target — override with VITE_ODOO_URL env var.
// In production, nginx (or similar) handles the reverse proxy to Odoo.
const odooTarget = process.env.VITE_ODOO_URL || 'https://odoo-uat.kissgroupbim.work';

export default defineConfig({
    base: process.env.GITHUB_ACTIONS ? '/kob-wms/' : '/',
    plugins: [react()],
    server: {
        host: true,
        port: parseInt(process.env.PORT) || 5173,
        proxy: {
            '/odoo-proxy': {
                target: odooTarget,
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/odoo-proxy/, ''),
            },
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
            '/jsonrpc': {
                target: odooTarget,
                changeOrigin: true,
                secure: false,
            },
        }
    }
})
