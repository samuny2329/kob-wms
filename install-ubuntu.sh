#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  KOB WMS Pro — Ubuntu Desktop Installer (Full Setup)
#
#  Tested on: Ubuntu 22.04 / 24.04 (GNOME Desktop)
#
#  What it does:
#    1. Installs Node.js 22 LTS (if not present)
#    2. Installs Docker + Docker Compose (optional)
#    3. Clones the repo (if needed)
#    4. Builds & installs WMS to ~/.local/share/kob-wms/
#    5. Creates GNOME desktop shortcut + systemd auto-start
#    6. Opens the app in Firefox/Chrome
#
#  Usage:
#    chmod +x install-ubuntu.sh
#    ./install-ubuntu.sh
#
#  Or one-liner from GitHub:
#    curl -fsSL https://raw.githubusercontent.com/samuny2329/kob-wms/main/install-ubuntu.sh | bash
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

APP_NAME="kob-wms"
APP_LABEL="KOB WMS Pro"
INSTALL_DIR="$HOME/.local/share/$APP_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/$APP_NAME.desktop"
SERVICE_NAME="$APP_NAME"
DEFAULT_PORT=3000
PORT=${WMS_PORT:-$DEFAULT_PORT}

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   KOB WMS Pro — Ubuntu Desktop Installer     ║"
echo "  ║   Enterprise Warehouse Management System     ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Detect Ubuntu ──
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "  ${CYAN}OS:${NC} $PRETTY_NAME"
else
    echo -e "  ${YELLOW}Warning: Cannot detect OS version${NC}"
fi
echo ""

# ═══════════════════════════════════════════
#  STEP 1: Install Node.js 22 LTS
# ═══════════════════════════════════════════
echo -e "${BOLD}${BLUE}[1/7] Node.js 22 LTS${NC}"

if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ]; then
        echo -e "  Node.js $(node -v) ${GREEN}already installed${NC}"
    else
        echo -e "  ${YELLOW}Node.js $(node -v) is too old, upgrading...${NC}"
        NEED_NODE=true
    fi
else
    NEED_NODE=true
fi

if [ "${NEED_NODE:-false}" = true ]; then
    echo -e "  Installing Node.js 22 via NodeSource..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq nodejs
    echo -e "  Node.js $(node -v) ${GREEN}installed${NC}"
fi

echo -e "  npm $(npm -v) ${GREEN}OK${NC}"

# ═══════════════════════════════════════════
#  STEP 2: Install Git (if needed)
# ═══════════════════════════════════════════
echo -e "\n${BOLD}${BLUE}[2/7] Git${NC}"

if command -v git &>/dev/null; then
    echo -e "  git $(git --version | cut -d' ' -f3) ${GREEN}already installed${NC}"
else
    echo -e "  Installing git..."
    sudo apt-get install -y -qq git
    echo -e "  ${GREEN}git installed${NC}"
fi

# ═══════════════════════════════════════════
#  STEP 3: Docker (optional)
# ═══════════════════════════════════════════
echo -e "\n${BOLD}${BLUE}[3/7] Docker (optional — for Odoo + PostgreSQL)${NC}"

if command -v docker &>/dev/null; then
    echo -e "  Docker $(docker --version | grep -oP '\d+\.\d+\.\d+') ${GREEN}already installed${NC}"
else
    echo -e "  ${YELLOW}Docker not found.${NC}"
    read -rp "  Install Docker for full-stack mode (Odoo+PostgreSQL)? [y/N] " install_docker
    if [[ "$install_docker" =~ ^[Yy]$ ]]; then
        echo -e "  Installing Docker..."
        sudo apt-get install -y -qq ca-certificates curl
        sudo install -m 0755 -d /etc/apt/keyrings
        sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        sudo chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -qq
        sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        sudo usermod -aG docker "$USER"
        echo -e "  ${GREEN}Docker installed${NC}"
        echo -e "  ${YELLOW}Note: Log out and back in for Docker permissions to take effect${NC}"
    else
        echo -e "  ${YELLOW}Skipped (WMS will run standalone without Odoo)${NC}"
    fi
fi

# ═══════════════════════════════════════════
#  STEP 4: Clone or locate source code
# ═══════════════════════════════════════════
echo -e "\n${BOLD}${BLUE}[4/7] Source code${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if we're already inside the repo
if [ -f "$SCRIPT_DIR/package.json" ] && grep -q "wms-pro" "$SCRIPT_DIR/package.json" 2>/dev/null; then
    SRC_DIR="$SCRIPT_DIR"
    echo -e "  ${GREEN}Using local source: $SRC_DIR${NC}"
else
    SRC_DIR="$HOME/$APP_NAME"
    if [ -d "$SRC_DIR/.git" ]; then
        echo -e "  Updating existing clone..."
        cd "$SRC_DIR" && git pull --ff-only 2>/dev/null || true
    else
        echo -e "  Cloning repository..."
        git clone https://github.com/samuny2329/kob-wms.git "$SRC_DIR"
    fi
    echo -e "  ${GREEN}Source ready: $SRC_DIR${NC}"
fi

cd "$SRC_DIR"

# ═══════════════════════════════════════════
#  STEP 5: Install npm dependencies & build
# ═══════════════════════════════════════════
echo -e "\n${BOLD}${BLUE}[5/7] Installing dependencies & building...${NC}"

npm ci --no-audit --no-fund 2>&1 | tail -3
npm run build 2>&1 | tail -5
echo -e "  ${GREEN}Build complete${NC}"

# ═══════════════════════════════════════════
#  STEP 6: Install application files
# ═══════════════════════════════════════════
echo -e "\n${BOLD}${BLUE}[6/7] Installing to $INSTALL_DIR${NC}"

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/dist"
cp -r dist "$INSTALL_DIR/dist"
cp package.json "$INSTALL_DIR/"
cp -r public/favicon.svg "$INSTALL_DIR/" 2>/dev/null || true

# ── Serve script (Node.js static server) ──
cat > "$INSTALL_DIR/serve.sh" << 'SERVE_EOF'
#!/usr/bin/env bash
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
    const url = req.url.split('?')[0];
    let filePath = path.join(root, url === '/' ? 'index.html' : url);
    if (!fs.existsSync(filePath)) filePath = path.join(root, 'index.html');
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

# ── Start / Stop scripts ──
cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/usr/bin/env bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$APP_DIR/server.pid" ] && kill -0 "$(cat "$APP_DIR/server.pid")" 2>/dev/null; then
    echo "KOB WMS Pro is already running (PID: $(cat "$APP_DIR/server.pid"))"
    exit 0
fi
nohup bash "$APP_DIR/serve.sh" > "$APP_DIR/server.log" 2>&1 &
echo $! > "$APP_DIR/server.pid"
echo "KOB WMS Pro started (PID: $!) — http://localhost:${WMS_PORT:-3000}"
EOF
chmod +x "$INSTALL_DIR/start.sh"

cat > "$INSTALL_DIR/stop.sh" << 'EOF'
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
EOF
chmod +x "$INSTALL_DIR/stop.sh"

# ═══════════════════════════════════════════
#  STEP 7: Desktop shortcut + systemd service
# ═══════════════════════════════════════════
echo -e "\n${BOLD}${BLUE}[7/7] Creating GNOME shortcut & systemd service...${NC}"

# ── .desktop launcher ──
mkdir -p "$HOME/.local/share/applications"
cat > "$DESKTOP_FILE" << DEOF
[Desktop Entry]
Name=$APP_LABEL
Comment=Enterprise Warehouse Management System — Kiss of Beauty
Exec=bash -c '$INSTALL_DIR/start.sh && sleep 1 && xdg-open http://localhost:$PORT'
Icon=$INSTALL_DIR/favicon.svg
Terminal=false
Type=Application
Categories=Office;ProjectManagement;
Keywords=warehouse;wms;inventory;logistics;skinoxy;
StartupNotify=true
Actions=stop;

[Desktop Action stop]
Name=Stop WMS Server
Exec=bash -c '$INSTALL_DIR/stop.sh'
DEOF
chmod +x "$DESKTOP_FILE"

# ── systemd user service ──
HAS_SYSTEMD=false
if command -v systemctl &>/dev/null && systemctl --user status &>/dev/null 2>&1; then
    HAS_SYSTEMD=true
    mkdir -p "$HOME/.config/systemd/user"
    cat > "$HOME/.config/systemd/user/$SERVICE_NAME.service" << SEOF
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
SEOF
    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME.service" 2>/dev/null || true
    systemctl --user restart "$SERVICE_NAME.service" 2>/dev/null || true
    # Enable lingering so service runs even when not logged in
    sudo loginctl enable-linger "$USER" 2>/dev/null || true
    echo -e "  ${GREEN}systemd service enabled (auto-start on login)${NC}"
else
    echo -e "  ${YELLOW}systemd user session not available — using direct mode${NC}"
    pkill -f "serve.sh.*$APP_NAME" 2>/dev/null || true
    nohup bash "$INSTALL_DIR/serve.sh" > "$INSTALL_DIR/server.log" 2>&1 &
    echo $! > "$INSTALL_DIR/server.pid"
    echo -e "  ${GREEN}Server started (PID: $(cat "$INSTALL_DIR/server.pid"))${NC}"
fi

# ── GNOME favorites (pin to dock) ──
if command -v gsettings &>/dev/null; then
    CURRENT_FAVS=$(gsettings get org.gnome.shell favorite-apps 2>/dev/null || echo "[]")
    if [[ "$CURRENT_FAVS" != *"$APP_NAME.desktop"* ]]; then
        NEW_FAVS=$(echo "$CURRENT_FAVS" | sed "s/]/, '$APP_NAME.desktop']/" | sed "s/\[, /[/")
        gsettings set org.gnome.shell favorite-apps "$NEW_FAVS" 2>/dev/null || true
        echo -e "  ${GREEN}Pinned to GNOME dock${NC}"
    fi
fi

# Update desktop database
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# ═══════════════════════════════════════════
#  DONE
# ═══════════════════════════════════════════
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║   KOB WMS Pro installed on Ubuntu successfully!  ║${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Quick Start:${NC}"
echo -e "  ${CYAN}URL:${NC}           http://localhost:$PORT"
echo -e "  ${CYAN}Desktop:${NC}       Search '${APP_LABEL}' in Activities or click dock icon"
echo -e "  ${CYAN}Install dir:${NC}   $INSTALL_DIR"
echo ""
echo -e "  ${BOLD}Manage Server:${NC}"
if [ "$HAS_SYSTEMD" = true ]; then
echo -e "    systemctl --user start $SERVICE_NAME     # Start"
echo -e "    systemctl --user stop $SERVICE_NAME      # Stop"
echo -e "    systemctl --user restart $SERVICE_NAME   # Restart"
echo -e "    systemctl --user status $SERVICE_NAME    # Status"
echo -e "    journalctl --user -u $SERVICE_NAME -f    # Logs"
else
echo -e "    $INSTALL_DIR/start.sh                    # Start"
echo -e "    $INSTALL_DIR/stop.sh                     # Stop"
echo -e "    tail -f $INSTALL_DIR/server.log          # Logs"
fi
echo ""
echo -e "  ${BOLD}Full Stack (Odoo + PostgreSQL):${NC}"
echo -e "    cd $SRC_DIR"
echo -e "    cp .env.example .env     # Edit passwords first!"
echo -e "    docker compose up -d     # Start all services"
echo -e "    docker compose down      # Stop all"
echo ""
echo -e "  ${BOLD}Uninstall:${NC}"
echo -e "    bash $SRC_DIR/uninstall-linux.sh"
echo ""

# Wait a moment then open browser
sleep 1
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT" 2>/dev/null &
fi

echo -e "  ${GREEN}Browser opening... Enjoy KOB WMS Pro!${NC}"
echo ""
