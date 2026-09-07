param(
    [int]$AdvertisePort = $(if ($env:SEATA_ADVERTISE_PORT) { [int]$env:SEATA_ADVERTISE_PORT } else { 8091 }),
    [string]$NacosAddr = $(if ($env:SEATA_NACOS_ADDR) { $env:SEATA_NACOS_ADDR } else { "localhost:8848" }),
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot "runtime\logs"
$logPath = Join-Path $logDir "seata-auto-refresh.log"

function Write-RefreshLog {
    param([string]$Message)
    if (-not (Test-Path -LiteralPath $logDir)) {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    }
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-DockerReady {
    docker info *> $null
    return $LASTEXITCODE -eq 0
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

function Get-SeataNacosGrouplist {
    try {
        $content = Invoke-RestMethod -Uri "http://$NacosAddr/nacos/v1/cs/configs?dataId=seataServer.properties&group=SEATA_GROUP" -TimeoutSec 5
    } catch {
        return $null
    }

    foreach ($line in ($content -split "`r?`n")) {
        if ($line -match "^\s*service\.default\.grouplist\s*=\s*(.+?)\s*$") {
            return $Matches[1]
        }
    }
    return $null
}

function Get-SeataContainerEnvValue {
    param([string]$Name)
    $lines = docker inspect omni-seata --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }

    foreach ($line in $lines) {
        if ($line -like "$Name=*") {
            return $line.Substring($Name.Length + 1)
        }
    }
    return $null
}

try {
    $currentIp = Get-PrimaryIpv4
    if (-not $currentIp) {
        Write-RefreshLog "跳过刷新：未找到当前可用的非回环 IPv4。"
        exit 0
    }

    if (-not (Test-CommandExists "docker")) {
        Write-RefreshLog "跳过刷新：未找到 docker 命令。"
        exit 0
    }

    if (-not (Test-DockerReady)) {
        Write-RefreshLog "跳过刷新：Docker Desktop 尚未就绪，等待下次计划任务重试。"
        exit 0
    }

    $desiredGrouplist = "${currentIp}:$AdvertisePort"
    $currentGrouplist = Get-SeataNacosGrouplist
    $currentContainerIp = Get-SeataContainerEnvValue -Name "SEATA_IP"

    if (-not $Force -and $currentGrouplist -eq $desiredGrouplist -and $currentContainerIp -eq $currentIp) {
        Write-RefreshLog "无需刷新：Seata 已使用当前地址 $desiredGrouplist。"
        exit 0
    }

    Write-RefreshLog "开始刷新：当前 IP=$currentIp，Nacos=$currentGrouplist，容器 SEATA_IP=$currentContainerIp。"
    $env:SEATA_ADVERTISE_HOST = $currentIp
    $env:SEATA_ADVERTISE_PORT = [string]$AdvertisePort
    & (Join-Path $PSScriptRoot "start-seata-docker.ps1") -AdvertisePort $AdvertisePort -NacosAddr $NacosAddr

    $updatedGrouplist = Get-SeataNacosGrouplist
    $updatedContainerIp = Get-SeataContainerEnvValue -Name "SEATA_IP"
    if ($updatedGrouplist -ne $desiredGrouplist -or $updatedContainerIp -ne $currentIp) {
        throw "刷新后地址不一致：期望 $desiredGrouplist，Nacos=$updatedGrouplist，容器 SEATA_IP=$updatedContainerIp。"
    }

    Write-RefreshLog "刷新完成：Seata 已更新为 $desiredGrouplist。"
    exit 0
} catch {
    Write-RefreshLog "刷新失败：$($_.Exception.Message)"
    exit 1
}



