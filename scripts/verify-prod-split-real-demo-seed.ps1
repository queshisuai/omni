param(
    [int]$ExpectedActivityCount = 120
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$seedRoot = Join-Path -Path $repoRoot -ChildPath "sql/seeds/prod-split-real-demo"
$posterRoot = Join-Path -Path $repoRoot -ChildPath "frontend/public/seed-posters-real"
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-RequiredFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        Add-Failure "缺少文件: $Path"
        return ""
    }
    return Get-Content -Raw -Encoding UTF8 -LiteralPath $Path
}

if (-not (Test-Path -LiteralPath $seedRoot)) {
    Add-Failure "缺少 seed 目录: $seedRoot"
}

if (-not (Test-Path -LiteralPath $posterRoot)) {
    Add-Failure "缺少海报目录: $posterRoot"
}

$requiredSqlFiles = @(
    "01-ticket.sql",
    "02-order.sql",
    "03-payment.sql",
    "04-user-ops.sql",
    "05-notification.sql",
    "06-grab.sql"
)

foreach ($fileName in $requiredSqlFiles) {
    $path = Join-Path -Path $seedRoot -ChildPath $fileName
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "缺少 SQL 文件: $fileName"
    }
}

$posterManifestPath = Join-Path -Path $seedRoot -ChildPath "posters.json"
if (Test-Path -LiteralPath $posterManifestPath) {
    try {
        $posters = Get-Content -Raw -Encoding UTF8 -LiteralPath $posterManifestPath | ConvertFrom-Json
        if ($posters.Count -lt $ExpectedActivityCount) {
            Add-Failure "海报清单不足: 当前 $($posters.Count), 期望至少 $ExpectedActivityCount"
        }
        foreach ($poster in $posters) {
            if (-not $poster.title) {
                Add-Failure "海报清单存在空 title"
                continue
            }
            if (-not $poster.sourceUrl) {
                Add-Failure "海报缺少来源链接: $($poster.title)"
            }
            if (-not $poster.localPath) {
                Add-Failure "海报缺少本地路径: $($poster.title)"
                continue
            }
            $relativePath = $poster.localPath.TrimStart("/")
            $localPoster = Join-Path -Path (Join-Path -Path $repoRoot -ChildPath "frontend/public") -ChildPath $relativePath
            if (-not (Test-Path -LiteralPath $localPoster)) {
                Add-Failure "海报文件不存在: $($poster.localPath)"
            }
        }
    } catch {
        Add-Failure "posters.json 解析失败: $($_.Exception.Message)"
    }
} else {
    Add-Failure "缺少海报清单: posters.json"
}

$ticketSqlPath = Join-Path -Path $seedRoot -ChildPath "01-ticket.sql"
$ticketSql = Read-RequiredFile -Path $ticketSqlPath
if ($ticketSql) {
    $activityBlockMatch = [regex]::Match(
        $ticketSql,
        "(?s)-- seed-real-demo:activity-start(?<body>.*?)-- seed-real-demo:activity-end"
    )
    if (-not $activityBlockMatch.Success) {
        Add-Failure "01-ticket.sql 缺少 activity 覆盖标记"
    } else {
        $activityRows = [regex]::Matches($activityBlockMatch.Groups["body"].Value, "(?m)^\s*\(").Count
        if ($activityRows -ne $ExpectedActivityCount) {
            Add-Failure "活动数量不匹配: 当前 $activityRows, 期望 $ExpectedActivityCount"
        }
    }

    foreach ($keyword in @("'published'", "'hidden'", "TRUE", "FALSE", "售罄", "候补")) {
        if (-not $ticketSql.Contains($keyword)) {
            Add-Failure "01-ticket.sql 缺少覆盖关键词: $keyword"
        }
    }
}

$orderSql = Read-RequiredFile -Path (Join-Path -Path $seedRoot -ChildPath "02-order.sql")
if ($orderSql) {
    foreach ($keyword in @("STATUS_PAID", "STATUS_CANCELLED", "支付超时", "order_snapshot", "electronic_ticket")) {
        if (-not $orderSql.Contains($keyword)) {
            Add-Failure "02-order.sql 缺少覆盖关键词: $keyword"
        }
    }
}

$paymentSql = Read-RequiredFile -Path (Join-Path -Path $seedRoot -ChildPath "03-payment.sql")
if ($paymentSql) {
    foreach ($keyword in @("refund_request", "退款异常", "UNKNOWN")) {
        if (-not $paymentSql.Contains($keyword)) {
            Add-Failure "03-payment.sql 缺少覆盖关键词: $keyword"
        }
    }
}

$userOpsSql = Read-RequiredFile -Path (Join-Path -Path $seedRoot -ChildPath "04-user-ops.sql")
if ($userOpsSql) {
    foreach ($keyword in @("exception_task", "reconciliation_batch", "operation_audit_log", "场馆资料审核", "站点变更审核")) {
        if (-not $userOpsSql.Contains($keyword)) {
            Add-Failure "04-user-ops.sql 缺少覆盖关键词: $keyword"
        }
    }
}

$notificationSql = Read-RequiredFile -Path (Join-Path -Path $seedRoot -ChildPath "05-notification.sql")
if ($notificationSql) {
    foreach ($keyword in @("候补", "退款", "风控", "订单")) {
        if (-not $notificationSql.Contains($keyword)) {
            Add-Failure "05-notification.sql 缺少覆盖关键词: $keyword"
        }
    }
}

$grabSql = Read-RequiredFile -Path (Join-Path -Path $seedRoot -ChildPath "06-grab.sql")
if ($grabSql) {
    foreach ($keyword in @("grab_request", "waitlist_entry", "库存不足", "票档库存不足", "请勿重复抢票", "PAID")) {
        if (-not $grabSql.Contains($keyword)) {
            Add-Failure "06-grab.sql 缺少覆盖关键词: $keyword"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host "prod-split 真实演示 seed 校验失败:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "prod-split 真实演示 seed 校验通过: 活动 $ExpectedActivityCount 条，海报不少于 $ExpectedActivityCount 张。" -ForegroundColor Green

