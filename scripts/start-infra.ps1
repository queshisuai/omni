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
        if (-not $async.AsyncWaitHandle.WaitOne(1000, $false)) {
            return $false
        }
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

function Assert-DockerAvailable {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI not found. Install Docker Desktop and make sure the docker command is available in PowerShell."
    }

    try {
        docker version | Out-Null
    } catch {
        throw "Docker is installed but the Docker Engine is not reachable. Start Docker Desktop and retry."
    }
}

function Assert-PortAvailableOrOwned {
    param([string]$Name, [int]$Port, [string]$ContainerName)
    if (-not (Test-PortOpen -HostName "localhost" -Port $Port)) {
        return
    }

    $runningContainer = docker ps --filter "name=^/$ContainerName$" --format "{{.Names}}"
    if ($runningContainer -eq $ContainerName) {
        return
    }

    throw "$Name requires localhost:$Port, but that port is already in use. Stop the local service or the conflicting container, then retry."
}

Write-Step "Checking Docker..."
Assert-DockerAvailable

Write-Step "Checking Middleware Ports..."
Assert-PortAvailableOrOwned -Name "PostgreSQL" -Port 5432 -ContainerName "omni-postgres"
Assert-PortAvailableOrOwned -Name "Redis" -Port 6379 -ContainerName "omni-redis"
Assert-PortAvailableOrOwned -Name "Nacos" -Port 8848 -ContainerName "omni-nacos"
Assert-PortAvailableOrOwned -Name "RabbitMQ" -Port 5672 -ContainerName "omni-rabbitmq"
Assert-PortAvailableOrOwned -Name "Elasticsearch" -Port 9200 -ContainerName "omni-elasticsearch"

Write-Step "Starting Docker Middleware..."
Push-Location $projectRoot
try {
    docker compose up -d postgres redis nacos rabbitmq elasticsearch
} finally {
    Pop-Location
}

Write-Step "Waiting for Middleware Ports..."
Wait-Port -Name "PostgreSQL" -HostName "localhost" -Port 5432 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "Redis" -HostName "localhost" -Port 6379 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "Nacos" -HostName "localhost" -Port 8848 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "RabbitMQ" -HostName "localhost" -Port 5672 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "Elasticsearch" -HostName "localhost" -Port 9200 -TimeoutSeconds $TimeoutSeconds

Write-Host "`n[Docker Infra] Ready: PostgreSQL 5432, Redis 6379, Nacos 8848, RabbitMQ 5672, Elasticsearch 9200" -ForegroundColor Green
