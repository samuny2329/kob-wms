#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  KOB WMS Pro — Linux Uninstaller
#  Usage: chmod +x uninstall-linux.sh && ./uninstall-linux.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_NAME="kob-wms"
INSTALL_DIR="$HOME/.local/share/$APP_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/$APP_NAME.desktop"
SERVICE_FILE="$HOME/.config/systemd/user/$APP_NAME.service"

echo -e "${CYAN}KOB WMS Pro — Uninstaller${NC}\n"

read -rp "Remove KOB WMS Pro from this system? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop running process (PID-based)
if [ -f "$INSTALL_DIR/server.pid" ]; then
    PID=$(cat "$INSTALL_DIR/server.pid")
    if kill -0 "$PID" 2>/dev/null; then
        echo -e "  ${YELLOW}Stopping server (PID: $PID)...${NC}"
        kill "$PID"
    fi
fi

# Stop and disable systemd service
if command -v systemctl &>/dev/null && systemctl --user status 2>/dev/null; then
    if systemctl --user is-active "$APP_NAME" &>/dev/null; then
        echo -e "  ${YELLOW}Stopping service...${NC}"
        systemctl --user stop "$APP_NAME"
    fi
    if [ -f "$SERVICE_FILE" ]; then
        systemctl --user disable "$APP_NAME" 2>/dev/null || true
        rm -f "$SERVICE_FILE"
        systemctl --user daemon-reload
    fi
fi
echo -e "  ${GREEN}Service removed${NC}"

# Remove desktop shortcut
if [ -f "$DESKTOP_FILE" ]; then
    rm -f "$DESKTOP_FILE"
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo -e "  ${GREEN}Desktop shortcut removed${NC}"
fi

# Remove installed files
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo -e "  ${GREEN}Application files removed${NC}"
fi

echo -e "\n${GREEN}KOB WMS Pro has been uninstalled.${NC}"
echo -e "${YELLOW}Note: Source code in $(pwd) was not removed.${NC}"
