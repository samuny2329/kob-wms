/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'Sarabun', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
        primary: { 50: '#f9f5f8', 100: '#f0e8ed', 400: '#9e6d8a', 500: '#875A7B', 600: '#714B67', 700: '#5a3d52', 900: '#3a2435' },
        odoo: {
          purple: '#714B67',
          'purple-dark': '#5a3d52',
          teal: '#017E84',
          'teal-light': '#00A09D',
          bg: '#f8f9fa',
          surface: '#ffffff',
          border: '#dee2e6',
          text: '#212529',
          'text-secondary': '#6c757d',
          'text-muted': '#adb5bd',
          success: '#28a745',
          warning: '#ffac00',
          danger: '#dc3545',
          info: '#17a2b8',
          gray: '#E9ECEF',
          light: '#F8F9FA'
        },
        zinc: { 950: '#09090b', 900: '#18181b', 800: '#27272a' }
      },
      animation: {
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideInRight: { '0%': { transform: 'translateX(20px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } }
      },
      boxShadow: {
        'sleek': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'glow': '0 0 20px -5px var(--tw-shadow-color)',
        'glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
      }
    }
  },
  plugins: [],
}
