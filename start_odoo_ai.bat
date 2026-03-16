@echo off
echo ==========================================
echo    Expert WMS AI Brain - Odoo Starter
echo ==========================================

echo [1/3] Cleaning up old processes...
taskkill /F /IM python.exe /T >nul 2>&1

echo [2/3] Starting Odoo Server (Port 8070)...
echo Check your browser at: http://localhost:8070
echo.
set PYTHON_PATH=%~dp0venv\Scripts\python.exe
set ODOO_BIN=%~dp0source\odoo-bin
set CONFIG_FILE=%~dp0config\odoo_local.conf

start "" "http://localhost:8070"
"%PYTHON_PATH%" "%ODOO_BIN%" -c "%CONFIG_FILE%"

pause
