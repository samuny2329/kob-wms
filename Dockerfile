# ─────────────────────────────────────────
#  WMS Pro — Multi-stage Docker Build
#  Stage 1: Build React app
#  Stage 2: Serve via Nginx (non-root)
# ─────────────────────────────────────────

# ── Stage 1: Build ──────────────────────
FROM node:20-alpine AS builder

LABEL maintainer="WMS Pro Team <dev@kissofbeauty.com>"
LABEL version="1.0.0"
LABEL description="WMS Pro - Enterprise Warehouse Management System for Kiss of Beauty / SKINOXY"

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund --ignore-scripts=false

# Copy source & build
COPY . .
RUN npm run build

# ── Stage 2: Production Nginx ───────────
FROM nginx:1.25-alpine AS production

LABEL maintainer="WMS Pro Team <dev@kissofbeauty.com>"
LABEL version="1.0.0"
LABEL description="WMS Pro - Enterprise Warehouse Management System"
LABEL org.opencontainers.image.source="https://github.com/kissofbeauty/wms-pro"

# Create non-root user for nginx
RUN addgroup -g 1001 -S wmsgroup && \
    adduser -u 1001 -S wmsuser -G wmsgroup && \
    # Adjust nginx dirs for non-root operation
    mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R wmsuser:wmsgroup /var/cache/nginx /var/log/nginx /var/run /etc/nginx/conf.d && \
    # Make nginx pid writable
    touch /var/run/nginx.pid && \
    chown wmsuser:wmsgroup /var/run/nginx.pid

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder --chown=wmsuser:wmsgroup /app/dist /usr/share/nginx/html

# Switch to non-root user
USER wmsuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
