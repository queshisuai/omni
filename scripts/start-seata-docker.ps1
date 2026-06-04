param(
    [int]$AdvertisePort = $(if ($env:SEATA_ADVERTISE_PORT) { [int]$env:SEATA_ADVERTISE_PORT } else { 8091 }),
    [string]$NacosAddr = $(if ($env:SEATA_NACOS_ADDR) { $env:SEATA_NACOS_ADDR } else { "localhost:8848" })
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-AdvertiseHost {
    param([string]$HostValue)
    if ([string]::IsNullOrWhiteSpace($HostValue)) { return $false }
    if ($HostValue -in @("localhost", "0.0.0.0", "::1")) { return $false }
    if ($HostValue -like "127.*") { return $false }
    if ($HostValue -like "169.254.*") { return $false }
    return $HostValue -match "^\d{1,3}(\.\d{1,3}){3}$"
}

function Get-PrimaryIpv4 {
    $routes = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
        Where-Object { $_.NextHop -and $_.NextHop -ne "0.0.0.0" } |
        Sort-Object RouteMetric, InterfaceMetric

    foreach ($route in $routes) {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -and $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
            Select-Object -First 1 -ExpandProperty IPAddress
        if ($ip) { return $ip }
    }

    return $null
}

function Test-TcpPort {
    param([string]$HostValue, [int]$PortValue)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($HostValue, $PortValue, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(1200, $false)) {
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

function Wait-TcpPort {
    param([string]$HostValue, [int]$PortValue, [int]$TimeoutSeconds)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort -HostValue $HostValue -PortValue $PortValue) {
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "Seata Server 在 ${HostValue}:$PortValue 未就绪。"
}

if (-not (Test-CommandExists "docker")) {
    throw "未找到 docker 命令，请先启动 Docker Desktop。"
}

if (Test-AdvertiseHost $env:SEATA_ADVERTISE_HOST) {
    $advertiseHost = $env:SEATA_ADVERTISE_HOST
} else {
    $advertiseHost = Get-PrimaryIpv4
    if (-not $advertiseHost) {
        throw "未找到可用于 Seata 注册的非回环 IPv4，请检查当前网络连接。"
    }
}

$oldHost = $env:SEATA_ADVERTISE_HOST
$oldPort = $env:SEATA_ADVERTISE_PORT
$env:SEATA_ADVERTISE_HOST = $advertiseHost
$env:SEATA_ADVERTISE_PORT = [string]$AdvertisePort

Push-Location $projectRoot
try {
    Write-Host "[Seata] 使用注册地址 ${advertiseHost}:$AdvertisePort 启动 Docker Seata。" -ForegroundColor Cyan
    docker compose up -d nacos
    if ($LASTEXITCODE -ne 0) { throw "Docker 启动 Nacos 失败。" }

    docker compose up --force-recreate --no-deps seata-config-init
    if ($LASTEXITCODE -ne 0) { throw "Docker 发布 Seata 配置失败。" }

    docker compose up -d --force-recreate seata-server
    if ($LASTEXITCODE -ne 0) { throw "Docker 启动 Seata Server 失败。" }

    Wait-TcpPort -HostValue $advertiseHost -PortValue $AdvertisePort -TimeoutSeconds 60
    & (Join-Path $PSScriptRoot "update-seata-nacos-config.ps1") -NacosAddr $NacosAddr -AdvertiseHost $advertiseHost -AdvertisePort $AdvertisePort
} finally {
    Pop-Location
    $env:SEATA_ADVERTISE_HOST = $oldHost
    $env:SEATA_ADVERTISE_PORT = $oldPort
}
