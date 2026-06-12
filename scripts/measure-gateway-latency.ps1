param(
    [int]$Iterations = 5,
    [int]$TimeoutSec = 8,
    [string]$GatewayBaseUrl = "http://localhost:8088",
    [string]$UserBaseUrl = "http://localhost:8081",
    [string]$TicketBaseUrl = "http://localhost:8082",
    [string]$OrderBaseUrl = "http://localhost:8083",
    [string]$PaymentBaseUrl = "http://localhost:8084",
    [string]$NotificationBaseUrl = "http://localhost:8085",
    [switch]$IncludeOllama,
    [string]$OllamaBaseUrl = "http://localhost:11434",
    [string]$OllamaModel = "Qwen2.5:7b",
    [string]$OllamaPrompt = "",
    [string]$Account = "13900000001",
    [string]$Password = "123456",
    [string]$Token,
    [ValidateSet("Object", "Csv", "Json")][string]$OutputFormat = "Object",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

function New-UnicodeText {
    param([int[]]$Codes)

    return (-join ($Codes | ForEach-Object { [char]$_ }))
}

$TextRequestFailed = New-UnicodeText @(0x8BF7, 0x6C42, 0x5931, 0x8D25, 0xFF1A)
$TextUnknownError = New-UnicodeText @(0x672A, 0x77E5, 0x9519, 0x8BEF)
$TextMustGreaterThanZero = New-UnicodeText @(0x5FC5, 0x987B, 0x5927, 0x4E8E, 0x0020, 0x0030)

if (-not $OllamaPrompt) {
    $OllamaPrompt = New-UnicodeText @(
        0x8BF7, 0x7528, 0x4E2D, 0x6587, 0x7B80, 0x77ED, 0x56DE, 0x7B54,
        0x5BA2, 0x670D, 0x6162, 0x94FE, 0x8DEF, 0x8017, 0x65F6, 0x8BCA,
        0x65AD, 0x3002
    )
}

if ($Iterations -lt 1) {
    throw "Iterations $TextMustGreaterThanZero"
}
if ($TimeoutSec -lt 1) {
    throw "TimeoutSec $TextMustGreaterThanZero"
}

function Join-OmniUrl {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][string]$Path
    )

    return "$($BaseUrl.TrimEnd('/'))/$($Path.TrimStart('/'))"
}

function ConvertTo-JsonBody {
    param([hashtable]$Body)

    if ($null -eq $Body) {
        return $null
    }
    return ($Body | ConvertTo-Json -Compress -Depth 10)
}

function Get-StatusCodeFromError {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return $null
    }

    try {
        return [int]$response.StatusCode
    } catch {
        return $null
    }
}

function Get-ChineseErrorMessage {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)

    $statusCode = Get-StatusCodeFromError -ErrorRecord $ErrorRecord
    if ($statusCode) {
        return "${TextRequestFailed}HTTP $statusCode"
    }

    $message = $ErrorRecord.Exception.Message
    if (-not $message) {
        $message = $TextUnknownError
    }
    return "$TextRequestFailed$message"
}

function Invoke-MeasuredRequest {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [hashtable]$Body,
        [hashtable]$Headers = @{}
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $arguments = @{
            Method = $Method
            Uri = $Url
            TimeoutSec = $TimeoutSec
            UseBasicParsing = $true
            Headers = $Headers
        }
        $jsonBody = ConvertTo-JsonBody -Body $Body
        if ($jsonBody) {
            $arguments["Body"] = $jsonBody
            $arguments["ContentType"] = "application/json;charset=UTF-8"
        }

        $response = Invoke-WebRequest @arguments
        $stopwatch.Stop()
        return [pscustomobject]@{
            success = $true
            status = [int]$response.StatusCode
            durationMs = [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
            error = ""
        }
    } catch {
        $stopwatch.Stop()
        return [pscustomobject]@{
            success = $false
            status = Get-StatusCodeFromError -ErrorRecord $_
            durationMs = [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
            error = Get-ChineseErrorMessage -ErrorRecord $_
        }
    }
}

function Get-Percentile {
    param(
        [double[]]$Values,
        [double]$Percentile
    )

    if ($Values.Count -eq 0) {
        return $null
    }

    $sorted = @($Values | Sort-Object)
    $index = [math]::Ceiling($sorted.Count * $Percentile) - 1
    if ($index -lt 0) {
        $index = 0
    }
    if ($index -ge $sorted.Count) {
        $index = $sorted.Count - 1
    }
    return [math]::Round([double]$sorted[$index], 2)
}

function Get-StatusSummary {
    param([object[]]$Attempts)

    $statuses = @($Attempts | ForEach-Object { $_.status } | Where-Object { $null -ne $_ } | Sort-Object -Unique)
    if ($statuses.Count -eq 0) {
        return $null
    }
    return ($statuses -join ",")
}

function Get-ErrorSummary {
    param([object[]]$Attempts)

    $errors = @($Attempts | ForEach-Object { $_.error } | Where-Object { $_ } | Sort-Object -Unique)
    if ($errors.Count -eq 0) {
        return ""
    }
    return ($errors -join "; ")
}

function Measure-OmniEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Route,
        [Parameter(Mandatory = $true)][ValidateSet("gateway", "direct", "local-model")][string]$Mode,
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [hashtable]$Body,
        [hashtable]$Headers = @{}
    )

    $attempts = @()
    for ($i = 0; $i -lt $Iterations; $i++) {
        $attempts += Invoke-MeasuredRequest -Method $Method -Url $Url -Body $Body -Headers $Headers
    }

    $durations = @($attempts | ForEach-Object { [double]$_.durationMs })
    $allSucceeded = ($attempts | Where-Object { -not $_.success }).Count -eq 0
    $maxMs = $null
    if ($durations.Count -gt 0) {
        $maxMs = [math]::Round([double]($durations | Measure-Object -Maximum).Maximum, 2)
    }

    return [pscustomobject]@{
        scenario = if ($Mode -eq "local-model") { "local-model" } else { "gateway-vs-direct" }
        route = $Route
        mode = $Mode
        url = $Url
        success = $allSucceeded
        status = Get-StatusSummary -Attempts $attempts
        p50Ms = Get-Percentile -Values $durations -Percentile 0.50
        p95Ms = Get-Percentile -Values $durations -Percentile 0.95
        maxMs = $maxMs
        error = Get-ErrorSummary -Attempts $attempts
    }
}

function Get-LoginToken {
    param([string]$BaseUrl)

    if ($Token) {
        return $Token
    }

    $loginUrl = Join-OmniUrl -BaseUrl $BaseUrl -Path "/api/user/login"
    $result = Invoke-MeasuredRequest `
        -Method "POST" `
        -Url $loginUrl `
        -Body @{ loginType = "password"; account = $Account; password = $Password }

    if (-not $result.success) {
        return $null
    }

    try {
        $jsonBody = ConvertTo-JsonBody -Body @{ loginType = "password"; account = $Account; password = $Password }
        $response = Invoke-WebRequest `
            -Method Post `
            -Uri $loginUrl `
            -TimeoutSec $TimeoutSec `
            -UseBasicParsing `
            -ContentType "application/json;charset=UTF-8" `
            -Body $jsonBody
        $payload = $response.Content | ConvertFrom-Json
        return $payload.data.token
    } catch {
        return $null
    }
}

$gatewayToken = Get-LoginToken -BaseUrl $GatewayBaseUrl
$directToken = Get-LoginToken -BaseUrl $UserBaseUrl
$gatewayNotificationHeaders = @{}
if ($gatewayToken) {
    $gatewayNotificationHeaders = @{ Authorization = "Bearer $gatewayToken" }
}
$directNotificationHeaders = @{}
if ($directToken) {
    $directNotificationHeaders = @{ Authorization = "Bearer $directToken" }
}

$loginBody = @{ loginType = "password"; account = $Account; password = $Password }
$routes = @(
    @{
        route = "ticket.activities"
        method = "GET"
        gatewayUrl = Join-OmniUrl -BaseUrl $GatewayBaseUrl -Path "/api/ticket/activities"
        directUrl = Join-OmniUrl -BaseUrl $TicketBaseUrl -Path "/api/ticket/activities"
        body = $null
        gatewayHeaders = @{}
        directHeaders = @{}
    },
    @{
        route = "user.login"
        method = "POST"
        gatewayUrl = Join-OmniUrl -BaseUrl $GatewayBaseUrl -Path "/api/user/login"
        directUrl = Join-OmniUrl -BaseUrl $UserBaseUrl -Path "/api/user/login"
        body = $loginBody
        gatewayHeaders = @{}
        directHeaders = @{}
    },
    @{
        route = "notification.list"
        method = "GET"
        gatewayUrl = Join-OmniUrl -BaseUrl $GatewayBaseUrl -Path "/api/notification/list"
        directUrl = Join-OmniUrl -BaseUrl $NotificationBaseUrl -Path "/api/notification/list"
        body = $null
        gatewayHeaders = $gatewayNotificationHeaders
        directHeaders = $directNotificationHeaders
    }
)

$results = @()
foreach ($route in $routes) {
    $results += Measure-OmniEndpoint `
        -Route $route.route `
        -Mode "gateway" `
        -Method $route.method `
        -Url $route.gatewayUrl `
        -Body $route.body `
        -Headers $route.gatewayHeaders

    $results += Measure-OmniEndpoint `
        -Route $route.route `
        -Mode "direct" `
        -Method $route.method `
        -Url $route.directUrl `
        -Body $route.body `
        -Headers $route.directHeaders
}

if ($IncludeOllama) {
    $ollamaRoutes = @(
        @{
            route = "ollama.tags"
            method = "GET"
            url = Join-OmniUrl -BaseUrl $OllamaBaseUrl -Path "/api/tags"
            body = $null
        },
        @{
            route = "ollama.chat"
            method = "POST"
            url = Join-OmniUrl -BaseUrl $OllamaBaseUrl -Path "/api/chat"
            body = @{
                model = $OllamaModel
                stream = $false
                messages = @(
                    @{
                        role = "user"
                        content = $OllamaPrompt
                    }
                )
            }
        }
    )

    foreach ($route in $ollamaRoutes) {
        $results += Measure-OmniEndpoint `
            -Route $route.route `
            -Mode "local-model" `
            -Method $route.method `
            -Url $route.url `
            -Body $route.body `
            -Headers @{}
    }
}

switch ($OutputFormat) {
    "Csv" {
        if ($OutputPath) {
            $results | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8
        } else {
            $results | ConvertTo-Csv -NoTypeInformation
        }
    }
    "Json" {
        $json = @($results) | ConvertTo-Json -Depth 10
        if ($OutputPath) {
            Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8
        } else {
            $json
        }
    }
    default {
        $results
    }
}
