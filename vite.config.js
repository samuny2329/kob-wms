import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        proxy: {
            '/wms': {
                target: 'http://localhost:8070',
                changeOrigin: true,
                secure: false,
            },
            '/web/session': {
                target: 'http://localhost:8070',
                changeOrigin: true,
                secure: false,
            },
            '/web/dataset': {
                target: 'http://localhost:8070',
                changeOrigin: true,
                secure: false,
            },
        }
    }
})
