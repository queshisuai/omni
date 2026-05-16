# Omni Ticket Platform - Startup Script

param(
    [switch]$SkipJava,
    [switch]$SkipFrontend,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Continue"
$projectRoot = "C:\Users\Administrator\Desktop\omni"

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Start-Service-InBackground {
    param([string]$Name, [string]$Command, [string]$WorkDir)
    $proc = Start-Process powershell -ArgumentList "-NoExit", "-Command", $Command -WorkingDirectory $WorkDir -PassThru
    Write-Host "[$Name] Started (PID: $($proc.Id))" -ForegroundColor Green
    return $proc
}

Write-Host "`n  Omni Ticket Platform - Startup`n" -ForegroundColor Magenta

# 1. Check Environment
Write-Step "Checking Environment..."

try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "[Java] $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "[Java] Not Found" -ForegroundColor Red
}

try {
    $mvnVersion = mvn -version 2>&1 | Select-Object -First 1
    Write-Host "[Maven] OK" -ForegroundColor Green
} catch {
    Write-Host "[Maven] Not Found" -ForegroundColor Red
}

try {
    $nodeVersion = node -v
    Write-Host "[Node.js] v$nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[Node.js] Not Found" -ForegroundColor Red
}

$npmCmd = "npm"
try {
    $pnpmVersion = pnpm -v
    $npmCmd = "pnpm"
    Write-Host "[pnpm] v$pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "[npm] using npm instead of pnpm" -ForegroundColor Yellow
}

# 2. Check PostgreSQL
Write-Step "Starting PostgreSQL..."
$pgSvc = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
if ($pgSvc -and $pgSvc.Status -eq "Running") {
    Write-Host "[PostgreSQL] Running" -ForegroundColor Green
} else {
    Start-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "[PostgreSQL] Started" -ForegroundColor Green
}

# 3. Start Nacos
Write-Step "Starting Nacos..."
$nacosPort = 8848
try {
    $nacosCheck = Invoke-WebRequest -Uri "http://localhost:$nacosPort/nacos" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "[Nacos] Already Running" -ForegroundColor Green
} catch {
    Write-Host "[Nacos] Starting..." -ForegroundColor Yellow
    Start-Process cmd -ArgumentList "/c", "C:\nacos\bin\startup.cmd -m standalone" -WorkingDirectory "C:\nacos\bin" -PassThru | Out-Null
    Start-Sleep -Seconds 15
    Write-Host "[Nacos] Started" -ForegroundColor Green
}

# 4. Install Java Dependencies
if (-not $SkipInstall -and -not $SkipJava) {
    Write-Step "Installing Java Dependencies..."

    $commonPath = Join-Path $projectRoot "java\java-common"
    Write-Host "Installing java-common..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $commonPath; mvn clean install -DskipTests" -WorkingDirectory $commonPath -PassThru | Out-Null
    Start-Sleep -Seconds 10

    Write-Host "[Info] Java dependencies installing in background..." -ForegroundColor Yellow
}

# 5. Install Frontend Dependencies
if (-not $SkipInstall -and -not $SkipFrontend) {
    Write-Step "Installing Frontend Dependencies..."

    $frontendPath = Join-Path $projectRoot "frontend"
    if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
        Write-Host "Running $($npmCmd) install..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $frontendPath; $npmCmd install" -WorkingDirectory $frontendPath -PassThru | Out-Null
        Start-Sleep -Seconds 10
        Write-Host "[Info] Frontend dependencies installing in background..." -ForegroundColor Yellow
    } else {
        Write-Host "[Frontend] node_modules already exists" -ForegroundColor Green
    }
}

# 6. Start Java Services
if (-not $SkipJava) {
    Write-Step "Starting Java Services..."

    $javaServices = @(
        @{Name="java-gateway"; Port=8088; Path="java\java-gateway"},
        @{Name="java-user"; Port=8081; Path="java\java-user"},
        @{Name="java-ticket"; Port=8082; Path="java\java-ticket"},
        @{Name="java-order"; Port=8083; Path="java\java-order"},
        @{Name="java-payment"; Port=8084; Path="java\java-payment"},
        @{Name="java-notification"; Port=8085; Path="java\java-notification"}
    )

    foreach ($svc in $javaServices) {
        $fullPath = Join-Path $projectRoot $svc.Path
        Write-Host "Starting $($svc.Name) on port $($svc.Port)..." -ForegroundColor Cyan
        Start-Service-InBackground -Name $svc.Name -Command "cd $fullPath; mvn spring-boot:run" -WorkDir $fullPath
        Start-Sleep -Seconds 5
    }
    Write-Host "`n[Info] Java services need a few minutes to start" -ForegroundColor Yellow
}

# 7. Start Frontend
if (-not $SkipFrontend) {
    Write-Step "Starting Frontend..."

    $frontendPath = Join-Path $projectRoot "frontend"
    $devCmd = if ($npmCmd -eq "pnpm") { "pnpm dev" } else { "npm run dev" }

    Start-Service-InBackground -Name "Next.js Frontend" -Command "cd $frontendPath; $devCmd" -WorkDir $frontendPath
    Write-Host "`n[Info] Access http://localhost:3000 after startup" -ForegroundColor Yellow
}

Write-Step "Startup Complete!"

Write-Host @"

  Ports:
  - Nacos:      http://localhost:8848
  - Gateway:    http://localhost:8088
  - Frontend:   http://localhost:3000

  Test Accounts:
  - admin:      13800000001 / 123456
  - organizer: 13800000002 / 123456
  - user:       13900000001 / 123456

"@ -ForegroundColor Green