# Eagles Budget CRM - local startup
# Put this file INSIDE D:\github\EGSNEWFinancial-Analytics, then right-click it
# and choose "Run with PowerShell".  Or from a PowerShell window:
#     cd D:\github\EGSNEWFinancial-Analytics
#     powershell -ExecutionPolicy Bypass -File .\start-crm.ps1

function Fail($msg) {
    Write-Host ""
    Write-Host "=============== STOPPED ===============" -ForegroundColor Red
    Write-Host $msg -ForegroundColor Yellow
    Write-Host "=======================================" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}

function Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n/7] $msg" -ForegroundColor Cyan
}

# Work in the folder this script sits in.
if ($PSScriptRoot) { Set-Location -LiteralPath $PSScriptRoot }
Write-Host "Folder: $(Get-Location)" -ForegroundColor DarkGray

if (-not (Test-Path ".\package.json")) {
    Fail "There is no package.json in this folder.`n`nThis script must live INSIDE the project folder:`n    D:\github\EGSNEWFinancial-Analytics`n`nMove it there and run it again."
}

# ---------------------------------------------------------------- 1. Node
Step 1 "Checking Node.js..."
$nodeV = $null
try { $nodeV = (node -v) 2>$null } catch { }
if (-not $nodeV) {
    Fail "Node.js is not installed (or not on your PATH).`n`nInstall the LTS version from https://nodejs.org`nthen CLOSE this window, open a new one, and run this script again."
}
$major = 0
if ($nodeV -match '^v(\d+)') { $major = [int]$Matches[1] }
if ($major -lt 20) {
    Fail "Node $nodeV is too old - this app needs Node 20 or newer.`n`nInstall the LTS version from https://nodejs.org"
}
Write-Host "      OK - Node $nodeV" -ForegroundColor Green

# ---------------------------------------------------------------- 2. Docker
Step 2 "Checking Docker Desktop..."
$dockerOk = $false
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch { }
if (-not $dockerOk) {
    Fail "Docker Desktop is not running.`n`nThis app needs it for its PostgreSQL database.`n`n  1. Open Docker Desktop from the Start menu`n  2. Wait until it says 'Engine running' (whale icon in the system tray)`n  3. Run this script again`n`nNo Docker? You can instead point DATABASE_URL in the .env file`nat any PostgreSQL 14+ server you already have."
}
Write-Host "      OK - Docker is running" -ForegroundColor Green

# ---------------------------------------------------------------- 3. .env
Step 3 "Checking .env file..."
if (-not (Test-Path ".\.env")) {
    if (-not (Test-Path ".\.env.example")) {
        Fail "Neither .env nor .env.example exists in this folder.`nThe project files look incomplete - try: git pull"
    }
    Copy-Item ".\.env.example" ".\.env"
    Write-Host "      Created .env from .env.example" -ForegroundColor Green
} else {
    Write-Host "      OK - .env already exists (leaving it alone)" -ForegroundColor Green
}

# ---------------------------------------------------------------- 4. deps
Step 4 "Installing dependencies (this can take a few minutes)..."
npm install
if ($LASTEXITCODE -ne 0) {
    Fail "npm install failed.`n`nScroll up to read the first red error - that is the real cause.`nA common fix is to delete the node_modules folder and run this again."
}
Write-Host "      OK - dependencies installed" -ForegroundColor Green

# ---------------------------------------------------------------- 5. database
Step 5 "Starting the PostgreSQL database container..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Fail "'docker compose up -d' failed.`n`nIf it mentions port 5432 being in use, you already have another`nPostgreSQL running. Stop it, or change the port in docker-compose.yml."
}

Write-Host "      Waiting for the database to accept connections..." -ForegroundColor DarkGray
$ready = $false
foreach ($i in 1..60) {
    docker exec eagles_budget_db pg_isready -U eagles -d eagles_budget 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Fail "The database container started but never became ready.`n`nCheck what it is complaining about with:`n    docker logs eagles_budget_db"
}
Write-Host "      OK - database is ready" -ForegroundColor Green

# ---------------------------------------------------------------- 6. schema
Step 6 "Creating database tables and demo data..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Fail "Database migration failed.`n`nCheck that DATABASE_URL in your .env matches docker-compose.yml`n(default: postgresql://eagles:eagles_secret@localhost:5432/eagles_budget)"
}
npx prisma generate
if ($LASTEXITCODE -ne 0) { Fail "'npx prisma generate' failed. Scroll up for the error." }

# Seeding is only needed once; it is fine if this reports data already exists.
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "      NOTE: seeding did not complete - usually because the demo data" -ForegroundColor Yellow
    Write-Host "      is already there. Continuing." -ForegroundColor Yellow
} else {
    Write-Host "      OK - schema and demo data ready" -ForegroundColor Green
}

# ---------------------------------------------------------------- 7. run
Step 7 "Starting the web server..."

$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "      WARNING: something is already using port 3000." -ForegroundColor Yellow
    Write-Host "      Next.js will pick another port - watch the line below for the real URL." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "---------------------------------------------------------------" -ForegroundColor Green
Write-Host " Wait for the line that says:  Ready in ..." -ForegroundColor Green
Write-Host " THEN open:  http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "   Email:     admin@eaglesgroup.local" -ForegroundColor Green
Write-Host "   Password:  Admin@12345" -ForegroundColor Green
Write-Host ""
Write-Host " KEEP THIS WINDOW OPEN. Closing it stops the site." -ForegroundColor Yellow
Write-Host " Press Ctrl+C here when you want to shut the site down." -ForegroundColor DarkGray
Write-Host "---------------------------------------------------------------" -ForegroundColor Green
Write-Host ""

npm run dev

Write-Host ""
Write-Host "The server has stopped." -ForegroundColor Yellow
Read-Host "Press Enter to close"
