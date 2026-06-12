$ErrorActionPreference = "Stop"

$scriptPath = Join-Path -Path $PSScriptRoot -ChildPath "measure-gateway-latency.ps1"
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw "缺少脚本：$scriptPath"
}

function Get-ClosedLocalPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    return $port
}

function New-ClosedPortSet {
    return [pscustomobject]@{
        gateway = Get-ClosedLocalPort
        user = Get-ClosedLocalPort
        ticket = Get-ClosedLocalPort
        order = Get-ClosedLocalPort
        payment = Get-ClosedLocalPort
        notification = Get-ClosedLocalPort
        ollama = Get-ClosedLocalPort
    }
}

function Invoke-UnavailableServicesProbe {
    param(
        [Parameter(Mandatory = $true)]$Ports,
        [switch]$IncludeOllama,
        [string]$OutputFormat,
        [string]$OutputPath
    )

    $arguments = @{
        Iterations = 1
        TimeoutSec = 1
        GatewayBaseUrl = "http://127.0.0.1:$($Ports.gateway)"
        UserBaseUrl = "http://127.0.0.1:$($Ports.user)"
        TicketBaseUrl = "http://127.0.0.1:$($Ports.ticket)"
        OrderBaseUrl = "http://127.0.0.1:$($Ports.order)"
        PaymentBaseUrl = "http://127.0.0.1:$($Ports.payment)"
        NotificationBaseUrl = "http://127.0.0.1:$($Ports.notification)"
    }

    if ($IncludeOllama) {
        $arguments["IncludeOllama"] = $true
        $arguments["OllamaBaseUrl"] = "http://127.0.0.1:$($Ports.ollama)"
    }

    if ($OutputFormat) {
        $arguments["OutputFormat"] = $OutputFormat
    }

    if ($OutputPath) {
        $arguments["OutputPath"] = $OutputPath
    }

    return & $scriptPath @arguments
}

function Assert-CommonRows {
    param(
        [Parameter(Mandatory = $true)]$Rows
    )

    $requiredProperties = @("scenario", "route", "mode", "url", "success", "status", "p50Ms", "p95Ms", "maxMs", "error")
    foreach ($row in $Rows) {
        foreach ($property in $requiredProperties) {
            if (-not ($row.PSObject.Properties.Name -contains $property)) {
                throw "测量结果缺少字段：$property"
            }
        }

        if ($row.mode -notin @("gateway", "direct", "local-model")) {
            throw "mode 字段非法：$($row.mode)"
        }

        if ($row.mode -eq "local-model" -and $row.scenario -ne "local-model") {
            throw "local-model row scenario must be local-model, actual: $($row.scenario)"
        }

        if ($row.mode -ne "local-model" -and $row.scenario -ne "gateway-vs-direct") {
            throw "gateway/direct row scenario must be gateway-vs-direct, actual: $($row.scenario)"
        }

        if ($row.success -ne $false) {
            throw "关闭端口场景应返回 success=false"
        }

        if (-not $row.error -or $row.error -notmatch "[\u4e00-\u9fa5]") {
            throw "关闭端口场景应返回中文错误，实际为：$($row.error)"
        }
    }
}

$defaultPorts = New-ClosedPortSet
$defaultRows = Invoke-UnavailableServicesProbe -Ports $defaultPorts
if ($defaultRows.Count -ne 6) {
    throw "默认场景期望输出 6 行测量结果，实际为 $($defaultRows.Count)"
}
Assert-CommonRows -Rows $defaultRows
if (($defaultRows | Where-Object { $_.route -like "ollama.*" }).Count -ne 0) {
    throw "默认场景不应输出 Ollama 测量结果"
}

$ollamaPorts = New-ClosedPortSet
$ollamaRows = Invoke-UnavailableServicesProbe -Ports $ollamaPorts -IncludeOllama
if ($ollamaRows.Count -ne 8) {
    throw "IncludeOllama 场景期望输出 8 行测量结果，实际为 $($ollamaRows.Count)"
}
Assert-CommonRows -Rows $ollamaRows

$localModelRows = @($ollamaRows | Where-Object { $_.route -in @("ollama.tags", "ollama.chat") })
if ($localModelRows.Count -ne 2) {
    throw "IncludeOllama 应输出 ollama.tags 和 ollama.chat 两行结果"
}

foreach ($row in $localModelRows) {
    if ($row.mode -ne "local-model") {
        throw "Ollama 测量结果 mode 应为 local-model，实际为：$($row.mode)"
    }
    if ($row.url -notmatch "127\.0\.0\.1:$($ollamaPorts.ollama)") {
        throw "Ollama 测量结果 URL 应使用传入的 OllamaBaseUrl"
    }
}

$archivePorts = New-ClosedPortSet
$archiveDir = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath ("omni-latency-test-" + [Guid]::NewGuid().ToString("N"))
$archiveTempRoot = [System.IO.Path]::GetTempPath()
New-Item -ItemType Directory -Path $archiveDir | Out-Null
try {
    $csvPath = Join-Path -Path $archiveDir -ChildPath "latency.csv"
    Invoke-UnavailableServicesProbe -Ports $archivePorts -OutputFormat Csv -OutputPath $csvPath | Out-Null
    if (-not (Test-Path -LiteralPath $csvPath -PathType Leaf)) {
        throw "CSV output file was not created"
    }
    $csvRows = Import-Csv -LiteralPath $csvPath
    if ($csvRows.Count -ne 6) {
        throw "CSV output expected 6 rows, actual: $($csvRows.Count)"
    }
    Assert-CommonRows -Rows $csvRows

    $jsonPath = Join-Path -Path $archiveDir -ChildPath "latency.json"
    Invoke-UnavailableServicesProbe -Ports $archivePorts -IncludeOllama -OutputFormat Json -OutputPath $jsonPath | Out-Null
    if (-not (Test-Path -LiteralPath $jsonPath -PathType Leaf)) {
        throw "JSON output file was not created"
    }
    $jsonRows = Get-Content -Raw -LiteralPath $jsonPath | ConvertFrom-Json
    if ($jsonRows.Count -ne 8) {
        throw "JSON output expected 8 rows, actual: $($jsonRows.Count)"
    }
    Assert-CommonRows -Rows $jsonRows
} finally {
    if ($archiveDir.StartsWith($archiveTempRoot) -and (Test-Path -LiteralPath $archiveDir)) {
        Remove-Item -LiteralPath $archiveDir -Recurse -Force
    }
}

Write-Host "PASS measure-gateway-latency unavailable-service behavior"
