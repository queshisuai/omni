# Docker Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start local PostgreSQL, Redis, and Nacos through Docker Compose while keeping Java, NestJS, and frontend services running on the host.

**Architecture:** Docker Compose owns only middleware and publishes the same localhost ports the application already uses. `scripts/start-infra.ps1` starts and verifies middleware, and `start-project.ps1 -UseDockerInfra` delegates infrastructure startup to that script before launching application services.

**Tech Stack:** Docker Compose, PostgreSQL 17, Redis 7 Alpine, Nacos standalone, PowerShell 5.1, existing Maven/npm/pnpm startup scripts.

---

## File Structure

- Create `docker-compose.yml`: define `postgres`, `redis`, and `nacos` services with stable project container names and named volumes.
- Create `sql/docker-init/001-create-databases.sql`: create the local development databases expected by `prod-split` and grab-service.
- Create `scripts/start-infra.ps1`: start Docker middleware and wait for `5432`, `6379`, and `8848`.
- Modify `start-project.ps1`: add `-UseDockerInfra` and skip local Windows PostgreSQL/Nacos startup when enabled.
- Modify `README.md`: document the Docker infrastructure startup command.
- Modify `CLAUDE.md`: update local runbook commands for Docker middleware.

## Task 1: Compose Middleware Stack

**Files:**
- Create: `docker-compose.yml`
- Create: `sql/docker-init/001-create-databases.sql`

- [ ] **Step 1: Add PostgreSQL init SQL**

Create `sql/docker-init/001-create-databases.sql` with:

```sql
CREATE DATABASE omni_user;
CREATE DATABASE omni_ticket_split;
CREATE DATABASE omni_order;
CREATE DATABASE omni_payment;
CREATE DATABASE omni_notification;
CREATE DATABASE omni_grab;
```

- [ ] **Step 2: Add Docker Compose stack**

Create `docker-compose.yml` with services:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: omni-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: "123456"
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - omni-postgres-data:/var/lib/postgresql/data
      - ./sql/docker-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 20

  redis:
    image: redis:7-alpine
    container_name: omni-redis
    ports:
      - "6379:6379"
    volumes:
      - omni-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20

  nacos:
    image: nacos/nacos-server:v2.4.3
    container_name: omni-nacos
    environment:
      MODE: standalone
      NACOS_AUTH_ENABLE: "false"
      PREFER_HOST_MODE: hostname
    ports:
      - "8848:8848"
      - "9848:9848"
    volumes:
      - omni-nacos-data:/home/nacos/data
      - omni-nacos-logs:/home/nacos/logs
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8848/nacos/ >/dev/null || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30

volumes:
  omni-postgres-data:
  omni-redis-data:
  omni-nacos-data:
  omni-nacos-logs:
```

- [ ] **Step 3: Validate Compose syntax**

Run: `docker compose config`

Expected: command exits `0` and prints normalized Compose YAML.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docker-compose.yml sql/docker-init/001-create-databases.sql
git commit -m "chore: add docker middleware compose stack"
```

## Task 2: Infrastructure Starter Script

**Files:**
- Create: `scripts/start-infra.ps1`

- [ ] **Step 1: Add the script**

Create `scripts/start-infra.ps1` with:

```powershell
param(
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Test-PortOpen {
    param([string]$HostName, [int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(1000, $false)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Port {
    param([string]$Name, [string]$HostName, [int]$Port, [int]$TimeoutSeconds)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortOpen -HostName $HostName -Port $Port) {
            Write-Host "[$Name] localhost:$Port is reachable" -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "Timed out waiting for $Name on localhost:$Port"
}

Write-Step "Checking Docker..."
docker version | Out-Null

Write-Step "Starting Docker middleware..."
Push-Location $projectRoot
try {
    docker compose up -d postgres redis nacos
} finally {
    Pop-Location
}

Write-Step "Waiting for middleware ports..."
Wait-Port -Name "PostgreSQL" -HostName "localhost" -Port 5432 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "Redis" -HostName "localhost" -Port 6379 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "Nacos" -HostName "localhost" -Port 8848 -TimeoutSeconds $TimeoutSeconds

Write-Host "`n[Docker Infra] Ready: PostgreSQL 5432, Redis 6379, Nacos 8848" -ForegroundColor Green
```

- [ ] **Step 2: Validate script parse**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-infra.ps1 -TimeoutSeconds 1`

Expected: if Docker is running and images are available, middleware starts or the command times out waiting for services. If Docker is not running, the error explicitly comes from `docker version`.

- [ ] **Step 3: Commit**

Run:

```powershell
git add scripts/start-infra.ps1
git commit -m "chore: add docker infrastructure starter"
```

## Task 3: Wire Docker Infrastructure Into Startup

**Files:**
- Modify: `start-project.ps1`

- [ ] **Step 1: Add the parameter**

Add `[switch]$UseDockerInfra` to the existing `param(...)` block.

- [ ] **Step 2: Start Docker infrastructure before local PostgreSQL/Nacos logic**

After environment checks and before PostgreSQL startup, add:

```powershell
if ($UseDockerInfra) {
    Write-Step "Starting Docker Infrastructure..."
    & (Join-Path $projectRoot "scripts\start-infra.ps1")
}
```

- [ ] **Step 3: Skip local PostgreSQL startup when Docker infra is enabled**

Wrap the current PostgreSQL service block with:

```powershell
if ($UseDockerInfra) {
    Write-Step "Using Docker PostgreSQL..."
    Write-Host "[PostgreSQL] Docker infrastructure selected" -ForegroundColor Green
} else {
    # existing Windows PostgreSQL service startup block
}
```

- [ ] **Step 4: Skip local Nacos startup when Docker infra is enabled**

Wrap the current Nacos startup block with:

```powershell
if ($UseDockerInfra) {
    Write-Step "Using Docker Nacos..."
    Write-Host "[Nacos] Docker infrastructure selected" -ForegroundColor Green
} else {
    # existing local Nacos startup block
}
```

- [ ] **Step 5: Validate skip path**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File start-project.ps1 -UseDockerInfra -SkipJava -SkipFrontend -SkipInstall`

Expected: script invokes `scripts/start-infra.ps1`, does not call `Start-Service -Name "postgresql-x64-17"`, and does not require `C:\nacos`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add start-project.ps1
git commit -m "chore: support docker infrastructure startup"
```

## Task 4: Document Docker Startup

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update README**

Document the recommended local startup:

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1 -UseDockerInfra
```

Also document infrastructure-only startup:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-infra.ps1
```

- [ ] **Step 2: Update CLAUDE.md**

Add the same commands to the local runbook and note that Docker middleware publishes PostgreSQL `5432`, Redis `6379`, and Nacos `8848`.

- [ ] **Step 3: Commit**

Run:

```powershell
git add README.md CLAUDE.md
git commit -m "docs: document docker infrastructure startup"
```

## Task 5: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Validate Compose**

Run: `docker compose config`

Expected: exit code `0`.

- [ ] **Step 2: Start infrastructure**

Run: `powershell -ExecutionPolicy Bypass -File scripts/start-infra.ps1`

Expected: PostgreSQL, Redis, and Nacos ports are reachable.

- [ ] **Step 3: Verify Redis**

Run: `docker exec omni-redis redis-cli ping`

Expected: `PONG`.

- [ ] **Step 4: Verify startup integration**

Run: `powershell -ExecutionPolicy Bypass -File start-project.ps1 -UseDockerInfra -SkipJava -SkipFrontend -SkipInstall`

Expected: infrastructure path completes without local PostgreSQL or local Nacos requirements.
