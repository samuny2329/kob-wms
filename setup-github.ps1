# ─────────────────────────────────────────────────────────────
#  WMS Pro — GitHub Setup (ALL DEFAULTS — No prompts)
#  Right-click → Run with PowerShell
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "WMS Pro — GitHub Setup"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    WMS Pro — GitHub Repository Setup     " -ForegroundColor Cyan
Write-Host "    Defaults: wms-pro / private           " -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# ── Check & Install Git ──
Write-Host "[1/6] Checking Git..." -NoNewline
$gitPath = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitPath) {
    Write-Host " INSTALLING..." -ForegroundColor Yellow
    winget install Git.Git --accept-source-agreements --accept-package-agreements
    $env:PATH += ";C:\Program Files\Git\cmd"
    refreshenv 2>$null
}
Write-Host " OK" -ForegroundColor Green
git --version

# ── Check & Install GitHub CLI ──
Write-Host "[2/6] Checking GitHub CLI..." -NoNewline
$ghPath = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghPath) {
    Write-Host " INSTALLING..." -ForegroundColor Yellow
    winget install GitHub.cli --accept-source-agreements --accept-package-agreements
    $env:PATH += ";C:\Program Files\GitHub CLI"
    # Need restart after gh install
    Write-Host ""
    Write-Host "  GitHub CLI installed! Close this and run again." -ForegroundColor Yellow
    Write-Host "  Press any key..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}
Write-Host " OK" -ForegroundColor Green
gh --version | Select-Object -First 1

# ── GitHub Auth ──
Write-Host "[3/6] Checking GitHub login..." -NoNewline
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host " LOGIN REQUIRED" -ForegroundColor Yellow
    Write-Host "  Browser will open for GitHub login..." -ForegroundColor Yellow
    gh auth login -p https -w
}
Write-Host " OK" -ForegroundColor Green

# ── Git Init ──
Set-Location $PSScriptRoot
Write-Host "[4/6] Initializing Git..." -NoNewline
if (-not (Test-Path ".git")) {
    git init -q
    git branch -M main
    # Default git user if not set
    $existingName = git config user.name 2>$null
    if (-not $existingName) {
        git config user.name "ADMIN"
        git config user.email "admin@wms-pro.local"
    }
    Write-Host " INITIALIZED" -ForegroundColor Green
} else {
    Write-Host " ALREADY EXISTS" -ForegroundColor Green
}

# ── Stage + Commit ──
Write-Host "[5/6] Committing all files..." -NoNewline
git add -A
$status = git status --porcelain
$fileCount = ($status | Measure-Object).Count

if ($fileCount -gt 0) {
    $hasCommit = git log --oneline -1 2>$null
    if (-not $hasCommit) {
        git commit -q -m "feat: WMS Pro - Enterprise WMS with 7 Platform APIs`n`nMarketplaces: Shopee, Lazada, TikTok Shop`nCouriers: Flash Express, Kerry, J&T, Thai Post`nStack: React + Vite + Tailwind + Firebase + Odoo 18`nDocker + Nginx + CI/CD GitHub Actions"
    } else {
        git commit -q -m "update: WMS Pro latest changes"
    }
    Write-Host " $fileCount files committed" -ForegroundColor Green
} else {
    Write-Host " no changes" -ForegroundColor Yellow
}

# ── Create GitHub Repo (defaults: wms-pro, private) ──
Write-Host "[6/6] Creating GitHub repo: wms-pro (private)..." -ForegroundColor Cyan

# Check if remote already exists
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "  Remote already set: $existingRemote" -ForegroundColor Yellow
    Write-Host "  Pushing..." -ForegroundColor Yellow
    git push -u origin main
} else {
    gh repo create wms-pro --private --source=. --push
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host "    SUCCESS! Repository is LIVE!          " -ForegroundColor Green
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host ""
    $repoUrl = gh repo view --json url -q .url 2>$null
    Write-Host "  URL: $repoUrl" -ForegroundColor Cyan
    Write-Host ""
    git log --oneline -3
    Write-Host ""
    # Auto open in browser
    gh repo view --web 2>$null
} else {
    Write-Host ""
    Write-Host "  FAILED — try manually:" -ForegroundColor Red
    Write-Host "  1. Go to https://github.com/new" -ForegroundColor White
    Write-Host "  2. Create repo named: wms-pro" -ForegroundColor White
    Write-Host "  3. Then run:" -ForegroundColor White
    Write-Host "     git remote add origin https://github.com/YOUR_USER/wms-pro.git" -ForegroundColor Yellow
    Write-Host "     git push -u origin main" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
