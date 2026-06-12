param(
    [int]$ExpectedActivityCount = 120
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$seedRoot = Join-Path -Path $repoRoot -ChildPath "sql/seeds/prod-split-real-demo"
$posterRoot = Join-Path -Path $repoRoot -ChildPath "frontend/public/seed-posters-real"
$artistAvatarRoot = Join-Path -Path $repoRoot -ChildPath "frontend/public/seed-artist-avatars-real"
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

if (-not (Test-Path -LiteralPath $artistAvatarRoot)) {
    Add-Failure "缺少艺人头像目录: $artistAvatarRoot"
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
            if ($poster.sourceUrl -match "img\.alicdn|p\.damai") {
                Add-Failure "海报清单不应依赖阿里/大麦远端图片: $($poster.title)"
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

$artistAvatarManifestPath = Join-Path -Path $seedRoot -ChildPath "artist-avatars.json"
if (Test-Path -LiteralPath $artistAvatarManifestPath) {
    try {
        $artistAvatars = Get-Content -Raw -Encoding UTF8 -LiteralPath $artistAvatarManifestPath | ConvertFrom-Json
        foreach ($avatar in $artistAvatars) {
            if (-not $avatar.id -or -not $avatar.name) {
                Add-Failure "艺人头像清单存在空 id/name"
                continue
            }
            if (-not $avatar.localPath) {
                Add-Failure "艺人头像缺少本地路径: $($avatar.name)"
                continue
            }
            if ($avatar.localPath -match "/seed-posters-real/") {
                Add-Failure "艺人头像不应复用活动海报: $($avatar.name)"
            }
            if (-not $avatar.sourceUrl -or $avatar.sourceUrl -notmatch "^https?://") {
                Add-Failure "艺人头像缺少可追溯来源链接: $($avatar.name)"
            }
            if ($avatar.sourceUrl -match "img\.alicdn|p\.damai") {
                Add-Failure "艺人头像不应依赖阿里/大麦远端图片: $($avatar.name)"
            }
            $relativePath = $avatar.localPath.TrimStart("/")
            $localAvatar = Join-Path -Path (Join-Path -Path $repoRoot -ChildPath "frontend/public") -ChildPath $relativePath
            if (-not (Test-Path -LiteralPath $localAvatar)) {
                Add-Failure "艺人头像文件不存在: $($avatar.localPath)"
            }
        }
    } catch {
        Add-Failure "artist-avatars.json 解析失败: $($_.Exception.Message)"
    }
} else {
    Add-Failure "缺少艺人头像清单: artist-avatars.json"
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
    if ($ticketSql -match "img\.alicdn|p\.damai") {
        Add-Failure "01-ticket.sql 不应依赖阿里/大麦远端图片"
    }
    if ($ticketSql -match "(?m)^\(901\d+,[^\r\n]*,\s*NULL,\s*1,\s*NULL,\s*'项目/艺人'") {
        Add-Failure "01-ticket.sql 艺人档案存在空头像，请补齐本地归档图像"
    }
    if ($ticketSql -match "(?m)^\(901002,[^\r\n]*/seed-posters-real/activity-900001\.jpg") {
        Add-Failure "01-ticket.sql BY2 艺人头像不应复用活动海报"
    }
    if ($ticketSql -match "(?m)^\(901003,[^\r\n]*/seed-posters-real/activity-900011\.jpg") {
        Add-Failure "01-ticket.sql 胡夏艺人头像不应复用活动海报"
    }
    foreach ($keyword in @("/seed-artist-avatars-real/artist-901002.jpg", "/seed-artist-avatars-real/artist-901003.jpg")) {
        if (-not $ticketSql.Contains($keyword)) {
            Add-Failure "01-ticket.sql 缺少艺人头像引用: $keyword"
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
    foreach ($keyword in @("980001", "980050", "2004", "983001", "983013")) {
        if (-not $orderSql.Contains($keyword)) {
            Add-Failure "02-order.sql 缺少客服上下文订单/票夹演示数据: $keyword"
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
    foreach ($keyword in @("REFREAL985004", "980045", "2004")) {
        if (-not $paymentSql.Contains($keyword)) {
            Add-Failure "03-payment.sql 缺少客服上下文退款演示数据: $keyword"
        }
    }
    foreach ($keyword in @("REFREAL985009", "980006", "主办方退款处理")) {
        if (-not $paymentSql.Contains($keyword)) {
            Add-Failure "03-payment.sql 缺少主办方退款处理演示数据: $keyword"
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
    foreach ($keyword in @("平台主办方运营员", "organizer_ops_assignment", "organizer_ops_follow_up", "'watch'", "'high'", "real-demo:")) {
        if (-not $userOpsSql.Contains($keyword)) {
            Add-Failure "04-user-ops.sql 缺少平台主办方运营员工作台演示数据: $keyword"
        }
    }
    if ($userOpsSql.Contains("主办方管理员")) {
        Add-Failure "04-user-ops.sql 不应继续写旧称谓: 主办方管理员"
    }
    foreach ($keyword in @("support_conversation", "support_message", "support_conversation_note", "support_conversation_tag", "support_conversation_audit", "support_quick_reply", "13910000003", "DMREAL980045", "REFREAL985004", "用户上下文")) {
        if (-not $userOpsSql.Contains($keyword)) {
            Add-Failure "04-user-ops.sql 缺少客服上下文工作台演示数据: $keyword"
        }
    }
    foreach ($keyword in @("988102", "WAITING_AGENT", "默认待处理队列")) {
        if (-not $userOpsSql.Contains($keyword)) {
            Add-Failure "04-user-ops.sql 缺少普通客服默认待处理队列演示数据: $keyword"
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
    foreach ($keyword in @("988001", "988004", "2004")) {
        if (-not $notificationSql.Contains($keyword)) {
            Add-Failure "05-notification.sql 缺少客服上下文通知演示数据: $keyword"
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
    foreach ($keyword in @("989001", "989301", "2004")) {
        if (-not $grabSql.Contains($keyword)) {
            Add-Failure "06-grab.sql 缺少客服上下文抢票/候补演示数据: $keyword"
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

