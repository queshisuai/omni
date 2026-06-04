param(
    [switch]$ConfirmApply,
    [string]$HostName = 'localhost',
    [int]$Port = 5432,
    [string]$User = 'postgres',
    [string]$Password = '123456',
    [switch]$SkipGrab
)

$ErrorActionPreference = 'Stop'

if (-not $ConfirmApply) {
    Write-Host '未执行导入：请显式添加 -ConfirmApply 后再写入本机数据库。' -ForegroundColor Yellow
    exit 0
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$seedRoot = Join-Path -Path $repoRoot -ChildPath 'sql/seeds/prod-split-real-demo'
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    throw '未找到 psql，请先安装 PostgreSQL 客户端或把 psql 加入 PATH。'
}

$targets = @(
    @{ Database = 'omni_ticket_split'; File = '01-ticket.sql' },
    @{ Database = 'omni_order'; File = '02-order.sql' },
    @{ Database = 'omni_payment'; File = '03-payment.sql' },
    @{ Database = 'omni_user'; File = '04-user-ops.sql' },
    @{ Database = 'omni_notification'; File = '05-notification.sql' }
)
if (-not $SkipGrab) {
    $targets += @{ Database = 'omni_grab'; File = '06-grab.sql' }
}

$env:PGPASSWORD = $Password
foreach ($target in $targets) {
    $file = Join-Path -Path $seedRoot -ChildPath $target.File
    if (-not (Test-Path -LiteralPath $file)) {
        throw "缺少 seed SQL 文件: $file"
    }
    Write-Host "正在导入 $($target.File) -> $($target.Database)" -ForegroundColor Cyan
    & $psql.Source -v ON_ERROR_STOP=1 -h $HostName -p $Port -U $User -d $target.Database -f $file
    if ($LASTEXITCODE -ne 0) {
        throw "导入失败: $($target.File)"
    }
}
Write-Host 'prod-split 真实演示 seed 已导入。' -ForegroundColor Green
