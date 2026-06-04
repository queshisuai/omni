# Omni Ticket Platform - Startup Script

param(
    [switch]$SkipJava,
    [switch]$SkipFrontend,
    [switch]$SkipInstall,
    [switch]$UseSharedDatabase,
    [switch]$UseDockerInfra
)

$ErrorActionPreference = "Continue"
$projectRoot = $PSScriptRoot
if (-not $projectRoot) { $projectRoot = Get-Location }

function Find-NacosHome {
    param([string[]]$SearchRoots = @("C:\", "D:\"))

    # 1. 优先读取环境变量 NACOS_HOME
    $envHome = [Environment]::GetEnvironmentVariable("NACOS_HOME", "User")
    if (-not $envHome) { $envHome = [Environment]::GetEnvironmentVariable("NACOS_HOME", "Machine") }
    if ($envHome -and (Test-Path "$envHome\bin\startup.cmd")) {
        Write-Host "[Nacos] Found via NACOS_HOME: $envHome" -ForegroundColor Green
        return $envHome
    }

    # 2. 检查常见安装路径
    $commonPaths = @(
        "C:\nacos",
        "D:\nacos",
        "D:\Development-Environment\nacos",
        "C:\Program Files\nacos",
        "$env:USERPROFILE\nacos",
        "$env:USERPROFILE\Downloads\nacos"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path "$p\bin\startup.cmd") {
            Write-Host "[Nacos] Found at: $p" -ForegroundColor Green
            return $p
        }
    }

    # 3. 自动扫描磁盘根目录及一级子目录（深度可控）
    foreach ($root in $SearchRoots) {
        if (-not (Test-Path $root)) { continue }
        $found = Get-ChildItem -Path $root -Directory -Depth 0 -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq "nacos" } |
            Select-Object -First 1
        if ($found) {
            $p = $found.FullName
            if (Test-Path "$p\bin\startup.cmd") {
                Write-Host "[Nacos] Found at: $p" -ForegroundColor Green
                return $p
            }
        }
    }

    # 4. 深层扫描（最多两级子目录，覆盖常见嵌套场景）
    foreach ($root in $SearchRoots) {
        if (-not (Test-Path $root)) { continue }
        $found = Get-ChildItem -Path $root -Directory -Depth 2 -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq "nacos" } |
            Select-Object -First 1
        if ($found) {
            $p = $found.FullName
            if (Test-Path "$p\bin\startup.cmd") {
                Write-Host "[Nacos] Found at: $p" -ForegroundColor Green
                return $p
            }
        }
    }

    return $null
}

$nacosHome = Find-NacosHome

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

function Import-DotEnv {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            return
        }
        if ($line -notmatch "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
            return
        }

        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

Write-Host "`n  Omni Ticket Platform - Startup`n" -ForegroundColor Magenta
Import-DotEnv -Path (Join-Path $projectRoot ".env")

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

$defaultJwtSecret = "omni-local-jwt-secret-must-be-at-least-32-bytes"
if ([string]::IsNullOrWhiteSpace($env:JWT_SECRET)) {
    $env:JWT_SECRET = $defaultJwtSecret
}
if ([string]::IsNullOrWhiteSpace($env:INTERNAL_API_TOKEN)) {
    $env:INTERNAL_API_TOKEN = "omni-local-internal-token"
}
if ([string]::IsNullOrWhiteSpace($env:OMNI_ID_NO_KEY)) {
    $env:OMNI_ID_NO_KEY = "omni-local-dev-id-no-key-change-me"
}

if ($UseDockerInfra) {
    Write-Step "启动 Docker 中间件..."
    & (Join-Path $projectRoot "scripts\start-infra.ps1")
}

# 2. Check PostgreSQL
if ($UseDockerInfra) {
    Write-Step "使用本机 PostgreSQL..."
    Write-Host "[PostgreSQL] Docker 中间件模式下仍使用本机数据库" -ForegroundColor Green
} else {
    Write-Step "Starting PostgreSQL..."
    $pgSvc = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
    if ($pgSvc -and $pgSvc.Status -eq "Running") {
        Write-Host "[PostgreSQL] Running" -ForegroundColor Green
    } else {
        Start-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "[PostgreSQL] Started" -ForegroundColor Green
    }
}

# 3. Start Nacos
if ($UseDockerInfra) {
    Write-Step "Using Docker Nacos..."
    Write-Host "[Nacos] Docker infrastructure selected" -ForegroundColor Green
} else {
    Write-Step "Starting Nacos..."
    $nacosPort = 8848
    try {
        $nacosCheck = Invoke-WebRequest -Uri "http://localhost:$nacosPort/nacos" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "[Nacos] Already Running" -ForegroundColor Green
    } catch {
        Write-Host "[Nacos] Starting..." -ForegroundColor Yellow
        if (-not $nacosHome) {
            Write-Host "[Nacos] NOT FOUND! Please install Nacos to C:\nacos or D:\nacos, or start it manually." -ForegroundColor Red
        } else {
            Start-Process cmd -ArgumentList "/c", "$nacosHome\bin\startup.cmd -m standalone" -WorkingDirectory "$nacosHome\bin" -PassThru | Out-Null
            Start-Sleep -Seconds 15
            Write-Host "[Nacos] Started" -ForegroundColor Green
        }
    }
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

    $grabPath = Join-Path $projectRoot "nestjs\grab-service"
    if (-not (Test-Path (Join-Path $grabPath "node_modules"))) {
        Write-Host "Running npm install for grab-service..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $grabPath; npm install" -WorkingDirectory $grabPath -PassThru | Out-Null
        Start-Sleep -Seconds 10
        Write-Host "[Info] grab-service dependencies installing in background..." -ForegroundColor Yellow
    } else {
        Write-Host "[grab-service] node_modules already exists" -ForegroundColor Green
    }
}

# 6. Start Java Services
if (-not $SkipJava) {
    Write-Step "Starting Java Services..."

    if ($UseSharedDatabase) {
        Write-Host "[Warning] Starting business services with the legacy shared omni_ticket database." -ForegroundColor Yellow
    } else {
        Write-Host "[Info] Starting business services with prod-split local databases." -ForegroundColor Cyan
    }

    $javaServices = @(
        @{Name="java-gateway"; Port=8088; Path="java\java-gateway"; Database=$null},
        @{Name="java-user"; Port=8081; Path="java\java-user"; Database="omni_user"},
        @{Name="java-ticket"; Port=8082; Path="java\java-ticket"; Database="omni_ticket_split"},
        @{Name="java-order"; Port=8083; Path="java\java-order"; Database="omni_order"},
        @{Name="java-payment"; Port=8084; Path="java\java-payment"; Database="omni_payment"},
        @{Name="java-notification"; Port=8085; Path="java\java-notification"; Database="omni_notification"}
    )

    $uploadRoot = Join-Path $projectRoot "runtime\uploads"
    $internalApiToken = $env:INTERNAL_API_TOKEN
    $jwtSecret = $env:JWT_SECRET

    if (-not $UseSharedDatabase) {
        Write-Step "发布 Seata 配置..."
        & (Join-Path $projectRoot "scripts\update-seata-nacos-config.ps1") -NacosAddr "localhost:$nacosPort"
    }

    foreach ($svc in $javaServices) {
        $fullPath = Join-Path $projectRoot $svc.Path
        Write-Host "Starting $($svc.Name) on port $($svc.Port)..." -ForegroundColor Cyan
        $command = "cd $fullPath; mvn spring-boot:run -Dspring-boot.run.arguments=`"--spring.cloud.nacos.discovery.ip=127.0.0.1 --omni.upload.root=$uploadRoot`""
        if (-not $UseSharedDatabase -and $svc.Database) {
            $seataArg = if ($svc.Name -in @("java-ticket", "java-order", "java-payment")) { " --seata.enabled=true" } else { "" }
            $command = "cd $fullPath; mvn spring-boot:run -Dspring-boot.run.profiles=prod-split -Dspring-boot.run.arguments=`"--spring.datasource.url=jdbc:postgresql://localhost:5432/$($svc.Database) --spring.datasource.username=postgres --spring.datasource.password=123456 --internal.api.token=$internalApiToken --jwt.secret=$jwtSecret --spring.cloud.nacos.discovery.ip=127.0.0.1 --omni.upload.root=$uploadRoot$seataArg`""
        }
        Start-Service-InBackground -Name $svc.Name -Command $command -WorkDir $fullPath
        Start-Sleep -Seconds 5
    }
    Write-Host "`n[Info] Java services need a few minutes to start" -ForegroundColor Yellow
}

# 7. Start Grab Service
if (-not $SkipFrontend) {
    Write-Step "Starting Grab Service..."

    $grabPath = Join-Path $projectRoot "nestjs\grab-service"
    $grabCommand = "cd $grabPath; `$env:GRAB_SERVICE_PORT='3001'; `$env:GRAB_DB_HOST='localhost'; `$env:GRAB_DB_PORT='5432'; `$env:GRAB_DB_NAME='omni_grab'; `$env:GRAB_DB_USER='postgres'; `$env:GRAB_DB_PASSWORD='123456'; `$env:ORDER_SERVICE_URL='http://localhost:8088'; `$env:INTERNAL_API_TOKEN='$env:INTERNAL_API_TOKEN'; `$env:JWT_SECRET='$env:JWT_SECRET'; npm run start:dev"
    Start-Service-InBackground -Name "grab-service" -Command $grabCommand -WorkDir $grabPath
    Write-Host "`n[Info] Grab service access through gateway /api/grab" -ForegroundColor Yellow
}

# 8. Start Frontend
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
  - Grab:       http://localhost:3001
  - Frontend:   http://localhost:3000

  Test Accounts:
  - admin:      13800000001 / 123456
  - organizer: 13800000002 / 123456
  - user:       13900000001 / 123456

"@ -ForegroundColor Green
