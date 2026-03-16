# ─────────────────────────────────────────
#  WMS Pro — Multi-stage Docker Build
#  Stage 1: Build React app
#  Stage 2: Serve via Nginx
# ─────────────────────────────────────────

# ── Stage 1: Build ──────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source & build
COPY . .
RUN npm run build

# ── Stage 2: Production Nginx ───────────
FROM nginx:1.25-alpine AS production

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
