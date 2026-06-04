$ErrorActionPreference = "Stop"

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)

    Write-Host ""
    Write-Host "==> $Message"
}

function Assert-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$CommandName)

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Required command '$CommandName' was not found on PATH."
    }
}

function Assert-DockerContainerRunning {
    param([Parameter(Mandatory = $true)][string]$ContainerName)

    $containerId = docker ps --filter "name=^/$ContainerName$" --filter "status=running" --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed while checking container '$ContainerName'. Ensure Docker Engine is reachable, then retry."
    }

    if (-not $containerId) {
        throw "Docker 容器 '$ContainerName' 未运行。请先执行：docker compose up -d redis"
    }
}

function Assert-TcpPortOpen {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
        $connected = $asyncResult.AsyncWaitHandle.WaitOne([TimeSpan]::FromSeconds(3))
        if (-not $connected) {
            throw "Timed out connecting to ${HostName}:${Port}."
        }

        $client.EndConnect($asyncResult)
    }
    finally {
        $client.Close()
    }
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Step $Step
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed with exit code ${LASTEXITCODE}: $Step"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$originalLocation = (Get-Location).Path
$envNamesToRestore = @(
    "RUN_GRAB_POSTGRES_INTEGRATION",
    "RUN_GRAB_REDIS_INTEGRATION",
    "GRAB_POSTGRES_HOST",
    "GRAB_POSTGRES_PORT",
    "GRAB_POSTGRES_DATABASE",
    "GRAB_POSTGRES_USER",
    "GRAB_POSTGRES_PASSWORD",
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_PASSWORD"
)
$originalEnv = @{}

foreach ($name in $envNamesToRestore) {
    $path = "Env:$name"
    $originalEnv[$name] = @{
        Exists = Test-Path $path
        Value = [Environment]::GetEnvironmentVariable($name, "Process")
    }
}

function Restore-Environment {
    foreach ($name in $envNamesToRestore) {
        if ($originalEnv[$name].Exists) {
            [Environment]::SetEnvironmentVariable($name, $originalEnv[$name].Value, "Process")
        }
        else {
            [Environment]::SetEnvironmentVariable($name, $null, "Process")
        }
    }
}

function Set-LocalIntegrationEnvironment {
    $env:GRAB_POSTGRES_HOST = "localhost"
    $env:GRAB_POSTGRES_PORT = "5432"
    $env:GRAB_POSTGRES_DATABASE = "postgres"
    $env:GRAB_POSTGRES_USER = "postgres"
    $env:GRAB_POSTGRES_PASSWORD = "123456"

    $env:PGHOST = "localhost"
    $env:PGPORT = "5432"
    $env:PGDATABASE = "postgres"
    $env:PGUSER = "postgres"
    $env:PGPASSWORD = "123456"

    $env:REDIS_HOST = "localhost"
    $env:REDIS_PORT = "6379"
    Remove-Item Env:REDIS_PASSWORD -ErrorAction SilentlyContinue
}

try {
    Set-Location $repoRoot

    Write-Step "Check Docker CLI is available"
    Assert-CommandAvailable "docker"

    Write-Step "Check Docker Engine is reachable"
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Engine is not reachable. Start Docker Desktop or the Docker daemon, then retry."
    }

    Write-Step "检查本机 PostgreSQL 端口"
    Assert-TcpPortOpen "localhost" 5432

    Write-Step "检查必需 Docker 容器"
    Assert-DockerContainerRunning "omni-redis"

    Write-Step "检查 Redis 端口"
    Assert-TcpPortOpen "localhost" 6379

    $grabServiceDir = Join-Path $repoRoot "nestjs\grab-service"
    if (-not (Test-Path $grabServiceDir)) {
        throw "Expected grab service directory not found: $grabServiceDir"
    }

    Set-Location $grabServiceDir

    Invoke-CheckedCommand "Run Postgres team-grab integration test" {
        Set-LocalIntegrationEnvironment
        $env:RUN_GRAB_POSTGRES_INTEGRATION = "1"
        npm test -- team-grab.repository.postgres.integration.spec.ts
    }

    Invoke-CheckedCommand "Run Redis grab integration test" {
        Set-LocalIntegrationEnvironment
        $env:RUN_GRAB_REDIS_INTEGRATION = "1"
        npm test -- grab-redis.integration.spec.ts
    }
}
finally {
    Set-Location $originalLocation
    Restore-Environment
}
