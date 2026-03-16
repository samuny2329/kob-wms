@echo off
chcp 65001 >nul 2>&1
title WMS Pro — GitHub Setup
color 0A

echo.
echo  ========================================
echo    WMS Pro — GitHub Setup (All Defaults)
echo  ========================================
echo.

:: ── Check Git ──
echo [1/6] Checking Git...
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   Git NOT FOUND — Installing...
    winget install Git.Git --accept-source-agreements --accept-package-agreements
    set "PATH=%PATH%;C:\Program Files\Git\cmd"
)
git --version
echo.

:: ── Check GitHub CLI ──
echo [2/6] Checking GitHub CLI...
where gh >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   GitHub CLI NOT FOUND — Installing...
    winget install GitHub.cli --accept-source-agreements --accept-package-agreements
    echo.
    echo   !! GitHub CLI installed !!
    echo   !! CLOSE this window and double-click setup-github.bat AGAIN !!
    echo.
    pause
    exit /b 0
)
gh --version
echo.

:: ── GitHub Login ──
echo [3/6] Checking GitHub login...
gh auth status >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   Not logged in — Opening browser...
    gh auth login -p https -w
)
echo   OK — Logged in
echo.

:: ── Go to project folder ──
cd /d "%~dp0"
echo [4/6] Project: %CD%

:: ── Git Init ──
if not exist ".git" (
    echo   Initializing Git...
    git init -q
    git branch -M main
    git config user.name "ADMIN"
    git config user.email "admin@wms-pro.local"
    echo   OK — Git initialized
) else (
    echo   OK — Git already exists
)
echo.

:: ── Add + Commit ──
echo [5/6] Staging and committing files...
git add -A
git status --short | find /c /v ""
git commit -m "feat: WMS Pro - Enterprise WMS with 7 Platform APIs" -m "Shopee, Lazada, TikTok, Flash, Kerry, J&T, Thai Post" -m "React + Vite + Tailwind + Firebase + Odoo 18 + Docker"
echo   OK — Committed
echo.

:: ── Create GitHub Repo ──
echo [6/6] Creating GitHub repo: wms-pro (private)...
echo.

git remote get-url origin >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   Remote already exists — Pushing...
    git push -u origin main
) else (
    gh repo create wms-pro --private --source=. --push
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo  ========================================
    echo    SUCCESS! Repo created and pushed!
    echo  ========================================
    echo.
    gh repo view --json url -q .url
    echo.
    git log --oneline -3
    echo.
    echo   Opening in browser...
    gh repo view --web
) else (
    echo.
    echo  ========================================
    echo    FAILED — Try manually:
    echo  ========================================
    echo.
    echo   1. Go to https://github.com/new
    echo   2. Create repo: wms-pro (private)
    echo   3. Run these commands:
    echo      git remote add origin https://github.com/YOUR_USER/wms-pro.git
    echo      git push -u origin main
)

echo.
echo ========================================
echo   DONE! Press any key to close...
echo ========================================
pause >nul
