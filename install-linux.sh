#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  KOB WMS Pro — Linux Desktop Installer
#  Installs WMS as a local web app with desktop shortcut
#
#  Usage:
#    chmod +x install-linux.sh
#    ./install-linux.sh
#
#  What it does:
#    1. Builds the production bundle (npm run build)
#    2. Installs to ~/.local/share/kob-wms/
#    3. Creates a .desktop launcher in ~/.local/share/applications/
#    4. Creates a systemd user service (auto-start on login)
#    5. Opens the app in your default browser
#
#  Requirements: Node.js 18+, npm
#  Optional: Docker (for full stack with Odoo + PostgreSQL)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_NAME="kob-wms"
APP_LABEL="KOB WMS Pro"
INSTALL_DIR="$HOME/.local/share/$APP_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/$APP_NAME.desktop"
SERVICE_NAME="$APP_NAME"
DEFAULT_PORT=3000

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║     KOB WMS Pro — Linux Installer        ║"
echo "  ║     Enterprise Warehouse Management      ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── Pre-flight checks ──
echo -e "${BLUE}[1/6] Checking requirements...${NC}"

if ! command -v node &>/dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Install Node.js 18+ first.${NC}"
    echo "  Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  Or use nvm:    https://github.com/nvm-sh/nvm"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required (found v$(node -v))${NC}"
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

echo -e "  Node.js $(node -v) ${GREEN}OK${NC}"
echo -e "  npm $(npm -v) ${GREEN}OK${NC}"

# ── Choose port ──
PORT=${WMS_PORT:-$DEFAULT_PORT}
echo -e "\n${BLUE}[2/6] Port: ${CYAN}$PORT${NC} (set WMS_PORT env to change)"

# ── Install dependencies ──
echo -e "\n${BLUE}[3/6] Installing dependencies...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
npm ci --no-audit --no-fund 2>&1 | tail -3

# ── Build ──
echo -e "\n${BLUE}[4/6] Building production bundle...${NC}"
npm run build 2>&1 | tail -5
echo -e "  ${GREEN}Build complete${NC}"

# ── Install files ──
echo -e "\n${BLUE}[5/6] Installing to $INSTALL_DIR${NC}"
mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/dist"
cp -r dist "$INSTALL_DIR/dist"
cp package.json "$INSTALL_DIR/"
cp -r public/favicon.svg "$INSTALL_DIR/" 2>/dev/null || true

# Create a simple serve script
cat > "$INSTALL_DIR/serve.sh" << 'SERVE_EOF'
#!/usr/bin/env bash
# Simple static file server using Node.js (no extra deps)
PORT=${WMS_PORT:-3000}
DIR="$(dirname "$0")/dist"

node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const root = '${DIR}'.replace(/'/g, '');
const server = http.createServer((req, res) => {
    let filePath = path.join(root, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) filePath = path.join(root, 'index.html'); // SPA fallback
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(${PORT}, '127.0.0.1', () => {
    console.log('KOB WMS Pro running at http://localhost:${PORT}');
});
"
SERVE_EOF
chmod +x "$INSTALL_DIR/serve.sh"

# ── Create .desktop file ──
echo -e "\n${BLUE}[6/6] Creating desktop shortcut & service...${NC}"
mkdir -p "$HOME/.local/share/applications"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=$APP_LABEL
Comment=Enterprise Warehouse Management System
Exec=sh -c 'xdg-open http://localhost:$PORT >/dev/null 2>&1'
Icon=$INSTALL_DIR/favicon.svg
Terminal=false
Type=Application
Categories=Office;ProjectManagement;
Keywords=warehouse;wms;inventory;logistics;
StartupNotify=true
EOF

# ── Create systemd user service (if systemd available) ──
HAS_SYSTEMD=false
if command -v systemctl &>/dev/null && systemctl --user status 2>/dev/null; then
    HAS_SYSTEMD=true
    mkdir -p "$HOME/.config/systemd/user"
    cat > "$HOME/.config/systemd/user/$SERVICE_NAME.service" << EOF
[Unit]
Description=KOB WMS Pro - Warehouse Management System
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/env bash $INSTALL_DIR/serve.sh
Restart=on-failure
RestartSec=5
Environment=WMS_PORT=$PORT
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME.service" 2>/dev/null || true
    systemctl --user restart "$SERVICE_NAME.service" 2>/dev/null || true
    echo -e "  ${GREEN}systemd service enabled (auto-start on login)${NC}"
else
    echo -e "  ${YELLOW}systemd user bus not available — using direct mode${NC}"
    # Start server directly in background
    pkill -f "serve.sh.*$APP_NAME" 2>/dev/null || true
    nohup bash "$INSTALL_DIR/serve.sh" > "$INSTALL_DIR/server.log" 2>&1 &
    echo $! > "$INSTALL_DIR/server.pid"
    echo -e "  ${GREEN}Server started (PID: $(cat "$INSTALL_DIR/server.pid"))${NC}"
fi

# Create start/stop helper scripts
cat > "$INSTALL_DIR/start.sh" << 'START_EOF'
#!/usr/bin/env bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$APP_DIR/server.pid" ] && kill -0 "$(cat "$APP_DIR/server.pid")" 2>/dev/null; then
    echo "KOB WMS Pro is already running (PID: $(cat "$APP_DIR/server.pid"))"
    exit 0
fi
nohup bash "$APP_DIR/serve.sh" > "$APP_DIR/server.log" 2>&1 &
echo $! > "$APP_DIR/server.pid"
echo "KOB WMS Pro started (PID: $!)"
START_EOF
chmod +x "$INSTALL_DIR/start.sh"

cat > "$INSTALL_DIR/stop.sh" << 'STOP_EOF'
#!/usr/bin/env bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$APP_DIR/server.pid" ]; then
    PID=$(cat "$APP_DIR/server.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        echo "KOB WMS Pro stopped (PID: $PID)"
    else
        echo "Process not running"
    fi
    rm -f "$APP_DIR/server.pid"
else
    echo "No PID file found"
fi
STOP_EOF
chmod +x "$INSTALL_DIR/stop.sh"

# Update desktop database
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# ── Done ──
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  KOB WMS Pro installed successfully!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}URL:${NC}        http://localhost:$PORT"
echo -e "  ${CYAN}Install:${NC}    $INSTALL_DIR"
echo -e "  ${CYAN}Shortcut:${NC}   $DESKTOP_FILE"
echo -e "  ${CYAN}Service:${NC}    systemctl --user status $SERVICE_NAME"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
if [ "$HAS_SYSTEMD" = true ]; then
echo -e "    systemctl --user start $SERVICE_NAME    # Start"
echo -e "    systemctl --user stop $SERVICE_NAME     # Stop"
echo -e "    systemctl --user restart $SERVICE_NAME  # Restart"
echo -e "    journalctl --user -u $SERVICE_NAME -f   # View logs"
else
echo -e "    $INSTALL_DIR/start.sh                   # Start"
echo -e "    $INSTALL_DIR/stop.sh                    # Stop"
echo -e "    tail -f $INSTALL_DIR/server.log         # View logs"
fi
echo ""
echo -e "  ${YELLOW}Docker (full stack with Odoo):${NC}"
echo -e "    cp .env.example .env  # Edit credentials first"
echo -e "    docker compose up -d"
echo ""

# Open in browser
sleep 1
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT" 2>/dev/null &
fi
