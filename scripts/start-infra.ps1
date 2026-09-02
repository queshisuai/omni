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

function Test-RedisPing {
    param([string]$HostName, [int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect($HostName, $Port)
        $stream = $client.GetStream()
        $stream.ReadTimeout = 1000
        $stream.WriteTimeout = 1000
        $request = [System.Text.Encoding]::ASCII.GetBytes("*1`r`n`$4`r`nPING`r`n")
        $stream.Write($request, 0, $request.Length)
        $buffer = New-Object byte[] 32
        $count = $stream.Read($buffer, 0, $buffer.Length)
        if ($count -le 0) {
            return $false
        }
        $reply = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $count)
        return $reply.StartsWith("+PONG")
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
            Write-Host "[$Name] localhost:$Port 可连接" -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "等待 $Name 超时：localhost:$Port 不可连接"
}

function Assert-DockerAvailable {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "未找到 Docker CLI，请先安装/启动 Docker Desktop，并确认 PowerShell 可以使用 docker 命令。"
    }

    try {
        docker version | Out-Null
    } catch {
        throw "Docker 已安装但 Docker Engine 不可连接，请启动 Docker Desktop 后重试。"
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

    throw "$Name 需要使用 localhost:$Port，但端口已被其他进程占用。请停止冲突服务或容器后重试。"
}

Write-Step "检查 Docker..."
Assert-DockerAvailable

Write-Step "检查本机 PostgreSQL..."
Wait-Port -Name "本机 PostgreSQL" -HostName "localhost" -Port 5432 -TimeoutSeconds $TimeoutSeconds

Write-Step "检查中间件端口..."
$useExistingRedis = $false
if (Test-PortOpen -HostName "localhost" -Port 6379) {
    $runningRedisContainer = docker ps --filter "name=^/omni-redis$" --format "{{.Names}}"
    if ($runningRedisContainer -ne "omni-redis") {
        if (-not (Test-RedisPing -HostName "localhost" -Port 6379)) {
            throw "Redis 需要使用 localhost:6379，但端口已被非 Redis 进程占用。请停止冲突服务或容器后重试。"
        }
        $useExistingRedis = $true
        Write-Host "[Redis] localhost:6379 已有可用 Redis，跳过 Docker Redis" -ForegroundColor Green
    }
}
Assert-PortAvailableOrOwned -Name "Nacos" -Port 8848 -ContainerName "omni-nacos"

Write-Step "启动 Docker 中间件..."
Push-Location $projectRoot
try {
    $composeServices = @("nacos")
    if (-not $useExistingRedis) {
        $composeServices = @("redis") + $composeServices
    }
    docker compose up -d @composeServices
} finally {
    Pop-Location
}

Write-Step "等待中间件端口..."
Wait-Port -Name "Redis" -HostName "localhost" -Port 6379 -TimeoutSeconds $TimeoutSeconds
Wait-Port -Name "Nacos" -HostName "localhost" -Port 8848 -TimeoutSeconds $TimeoutSeconds

$redisProvider = if ($useExistingRedis) { "本机 Redis 6379" } else { "Docker Redis 6379" }
Write-Host "`n[Docker Infra] 已就绪：本机 PostgreSQL 5432，$redisProvider，Docker Nacos 8848" -ForegroundColor Green
