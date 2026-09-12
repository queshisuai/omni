param(
    [switch]$Execute,
    [string]$HostName = 'localhost',
    [int]$Port = 5432,
    [string]$User = 'postgres',
    [string]$Password = '123456',
    [switch]$AllowNonLocal
)

$ErrorActionPreference = 'Stop'

$localHosts = @('localhost', '127.0.0.1', '::1')
if (-not $AllowNonLocal -and $localHosts -notcontains $HostName) {
    throw "为避免误清生产数据，本脚本默认只允许本机数据库。非本机执行需显式添加 -AllowNonLocal。"
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    throw '未找到 psql，请先安装 PostgreSQL 客户端或把 psql 加入 PATH。'
}

$env:PGPASSWORD = $Password

function Invoke-OmniPsql {
    param(
        [string]$Database,
        [string]$Sql
    )

    $tempSql = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "omni-cleanup-625-$Database-$([System.Guid]::NewGuid().ToString('N')).sql"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tempSql, $Sql, $utf8NoBom)
    try {
        $arguments = @(
            '-v', 'ON_ERROR_STOP=1',
            '-h', $HostName,
            '-p', $Port,
            '-U', $User,
            '-d', $Database,
            '-q',
            '-t',
            '-A',
            '-F', "`t",
            '-P', 'footer=off',
            '-f', $tempSql
        )

        $output = & $psql.Source @arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "psql 执行失败: $Database`n$output"
        }
    }
    finally {
        Remove-Item -LiteralPath $tempSql -Force -ErrorAction SilentlyContinue
    }

    foreach ($line in $output) {
        if ($null -ne $line -and $line.ToString().Length -gt 0) {
            Write-Host $line.ToString()
        }
    }
}

function Invoke-DbStep {
    param(
        [string]$Database,
        [string]$Description,
        [string]$Sql
    )

    Write-Host ""
    Write-Host "[$Database] $Description" -ForegroundColor Cyan
    Invoke-OmniPsql -Database $Database -Sql $Sql
}

$targetOrderIdsSql = 'ARRAY[625,629]::bigint[]'
$targetOrderNosSql = "ARRAY['DM20260531180231071182','DM20260531192147184F55']::text[]"
$targetOrderSeatIdsSql = 'ARRAY[18,21]::bigint[]'
$targetSessionSeatIdsSql = 'ARRAY[838,882]::bigint[]'
$targetWaitlistEntryIdsSql = 'ARRAY[1,4,5]::bigint[]'
$targetWaitlistOfferIdsSql = 'ARRAY[1,4]::bigint[]'

$paymentGuardSql = @"
DO `$`$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM payment
        WHERE order_id = ANY($targetOrderIdsSql)
           OR out_trade_no = ANY($targetOrderNosSql)
    ) THEN
        RAISE EXCEPTION 'target orders already have payment records';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM refund_request
        WHERE order_id = ANY($targetOrderIdsSql)
    ) THEN
        RAISE EXCEPTION 'target orders already have refund records';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM payment
        WHERE id = 984058
          AND order_id = 980058
          AND raw_notify IS NOT NULL
          AND callback_data IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'real sandbox payment guard failed';
    END IF;
END `$`$;
"@

$orderGuardSql = @"
DO `$`$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "order"
        WHERE id IN (625, 629)
          AND NOT (
              (id = 625 AND order_no = 'DM20260531180231071182' AND status = 4 AND amount = 570.00)
              OR (id = 629 AND order_no = 'DM20260531192147184F55' AND status = 3 AND amount = 570.00)
          )
    ) THEN
        RAISE EXCEPTION 'order guard failed for 625/629';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "order"
        WHERE id = 980058
          AND order_no = 'DM202606110047432ACEBE'
    ) THEN
        RAISE EXCEPTION 'real sandbox order guard failed';
    END IF;
END `$`$;
"@

$preflightSql = [ordered]@{
    omni_payment = @"
$paymentGuardSql
SELECT 'target_payment', count(*) FROM payment WHERE order_id = ANY($targetOrderIdsSql) OR out_trade_no = ANY($targetOrderNosSql);
SELECT 'target_refund_request', count(*) FROM refund_request WHERE order_id = ANY($targetOrderIdsSql);
SELECT 'protected_real_payment_984058', count(*) FROM payment WHERE id = 984058 AND order_id = 980058;
"@
    omni_order = @"
$orderGuardSql
SELECT 'target_order', count(*) FROM "order" WHERE id = ANY($targetOrderIdsSql);
SELECT 'target_order_snapshot', count(*) FROM order_snapshot WHERE order_id = ANY($targetOrderIdsSql);
SELECT 'target_order_seat', count(*) FROM order_seat WHERE order_id = ANY($targetOrderIdsSql) OR id = ANY($targetOrderSeatIdsSql);
SELECT 'target_order_attendee', count(*) FROM order_attendee WHERE order_id = ANY($targetOrderIdsSql) OR order_seat_id = ANY($targetOrderSeatIdsSql);
SELECT 'target_electronic_ticket', count(*) FROM electronic_ticket WHERE order_id = ANY($targetOrderIdsSql) OR order_seat_id = ANY($targetOrderSeatIdsSql);
SELECT 'target_ticket_check_in_record', count(*) FROM ticket_check_in_record WHERE order_id = ANY($targetOrderIdsSql);
SELECT 'protected_real_order_980058', count(*) FROM "order" WHERE id = 980058;
"@
    omni_ticket_split = @"
SELECT 'target_session_seat_occupancy', count(*) FROM session_seat WHERE order_id = ANY($targetOrderIdsSql);
SELECT 'target_stock_log', count(*) FROM stock_log WHERE order_id = ANY($targetOrderIdsSql);
SELECT 'target_activity_review', count(*) FROM activity_review WHERE order_id = ANY($targetOrderIdsSql);
"@
    omni_grab = @"
SELECT 'target_waitlist_entry', count(*) FROM waitlist_entry WHERE id = ANY($targetWaitlistEntryIdsSql) OR offer_order_id = ANY($targetOrderIdsSql);
SELECT 'target_waitlist_offer', count(*) FROM waitlist_offer WHERE id = ANY($targetWaitlistOfferIdsSql) OR entry_id = ANY($targetWaitlistEntryIdsSql) OR order_id = ANY($targetOrderIdsSql);
SELECT 'target_waitlist_allocation_log', count(*) FROM waitlist_allocation_log WHERE allocated_entry_id = ANY($targetWaitlistEntryIdsSql) OR order_id = ANY($targetOrderIdsSql) OR source_order_id = ANY($targetOrderIdsSql);
SELECT 'target_grab_request', count(*) FROM grab_request WHERE order_id = ANY($targetOrderIdsSql);
SELECT 'target_team_grab_request', count(*) FROM team_grab_request WHERE order_id = ANY($targetOrderIdsSql);
SELECT 'target_team_seat_assignment', count(*) FROM team_seat_assignment WHERE order_id = ANY($targetOrderIdsSql) OR order_seat_id = ANY($targetOrderSeatIdsSql) OR session_seat_id = ANY($targetSessionSeatIdsSql);
SELECT 'target_ticket_team_member', count(*) FROM ticket_team_member WHERE order_seat_id = ANY($targetOrderSeatIdsSql) OR seat_id = ANY($targetSessionSeatIdsSql);
"@
    omni_notification = @"
SELECT 'target_notification', count(*) FROM notification WHERE order_id = ANY($targetOrderIdsSql) OR content ILIKE '%DM20260531180231071182%' OR content ILIKE '%DM20260531192147184F55%' OR aggregate_key ILIKE '%DM20260531180231071182%' OR aggregate_key ILIKE '%DM20260531192147184F55%';
SELECT 'target_notification_delivery', count(*) FROM notification_delivery WHERE order_id = ANY($targetOrderIdsSql) OR content_snapshot ILIKE '%DM20260531180231071182%' OR content_snapshot ILIKE '%DM20260531192147184F55%' OR payload_json ILIKE '%DM20260531180231071182%' OR payload_json ILIKE '%DM20260531192147184F55%';
"@
    omni_user = @"
SELECT 'target_exception_task', count(*) FROM exception_task WHERE business_no = ANY($targetOrderNosSql) OR order_no = ANY($targetOrderNosSql);
SELECT 'target_support_conversation', count(*) FROM support_conversation WHERE subject ILIKE '%DM20260531180231071182%' OR subject ILIKE '%DM20260531192147184F55%' OR last_message ILIKE '%DM20260531180231071182%' OR last_message ILIKE '%DM20260531192147184F55%';
SELECT 'target_support_message', count(*) FROM support_message WHERE content ILIKE '%DM20260531180231071182%' OR content ILIKE '%DM20260531192147184F55%';
"@
}

Write-Host "开始孤立订单 625 清理核对。当前模式: $(if ($Execute) { '执行删除' } else { 'dry-run 只读' })" -ForegroundColor Yellow
foreach ($entry in $preflightSql.GetEnumerator()) {
    Invoke-DbStep -Database $entry.Key -Description '清理前核对' -Sql $entry.Value
}

if (-not $Execute) {
    Write-Host ""
    Write-Host '未执行删除：确认核对结果后，请显式添加 -Execute 执行清理。' -ForegroundColor Yellow
    exit 0
}

Invoke-DbStep -Database 'omni_user' -Description '删除目标订单文本型客服/异常引用' -Sql @"
BEGIN;
DELETE FROM exception_task_evidence
WHERE exception_id IN (
    SELECT id FROM exception_task WHERE business_no = ANY($targetOrderNosSql) OR order_no = ANY($targetOrderNosSql)
);
DELETE FROM exception_task WHERE business_no = ANY($targetOrderNosSql) OR order_no = ANY($targetOrderNosSql);
COMMIT;
"@

Invoke-DbStep -Database 'omni_notification' -Description '删除目标订单通知' -Sql @"
BEGIN;
DELETE FROM notification_delivery
WHERE order_id = ANY($targetOrderIdsSql)
   OR content_snapshot ILIKE '%DM20260531180231071182%'
   OR content_snapshot ILIKE '%DM20260531192147184F55%'
   OR payload_json ILIKE '%DM20260531180231071182%'
   OR payload_json ILIKE '%DM20260531192147184F55%';
DELETE FROM notification
WHERE order_id = ANY($targetOrderIdsSql)
   OR content ILIKE '%DM20260531180231071182%'
   OR content ILIKE '%DM20260531192147184F55%'
   OR aggregate_key ILIKE '%DM20260531180231071182%'
   OR aggregate_key ILIKE '%DM20260531192147184F55%';
COMMIT;
"@

Invoke-DbStep -Database 'omni_grab' -Description '删除目标候补链路' -Sql @"
BEGIN;
DELETE FROM waitlist_allocation_log
WHERE allocated_entry_id = ANY($targetWaitlistEntryIdsSql)
   OR order_id = ANY($targetOrderIdsSql)
   OR source_order_id = ANY($targetOrderIdsSql);
DELETE FROM waitlist_offer
WHERE id = ANY($targetWaitlistOfferIdsSql)
   OR entry_id = ANY($targetWaitlistEntryIdsSql)
   OR order_id = ANY($targetOrderIdsSql);
DELETE FROM waitlist_entry
WHERE id = ANY($targetWaitlistEntryIdsSql)
   OR offer_order_id = ANY($targetOrderIdsSql);
DELETE FROM team_seat_assignment
WHERE order_id = ANY($targetOrderIdsSql)
   OR order_seat_id = ANY($targetOrderSeatIdsSql)
   OR session_seat_id = ANY($targetSessionSeatIdsSql);
DELETE FROM ticket_team_member
WHERE order_seat_id = ANY($targetOrderSeatIdsSql)
   OR seat_id = ANY($targetSessionSeatIdsSql);
DELETE FROM team_grab_request WHERE order_id = ANY($targetOrderIdsSql);
DELETE FROM grab_request WHERE order_id = ANY($targetOrderIdsSql);
COMMIT;
"@

Invoke-DbStep -Database 'omni_ticket_split' -Description '释放目标座位并删除票务侧引用' -Sql @"
BEGIN;
UPDATE session_seat
SET status = 1,
    order_id = NULL,
    lock_expire_time = NULL,
    lock_request_id = NULL,
    update_time = CURRENT_TIMESTAMP
WHERE order_id = ANY($targetOrderIdsSql)
   OR id = ANY($targetSessionSeatIdsSql);
DELETE FROM stock_log WHERE order_id = ANY($targetOrderIdsSql);
DELETE FROM activity_review_report WHERE review_id IN (SELECT id FROM activity_review WHERE order_id = ANY($targetOrderIdsSql));
DELETE FROM activity_review WHERE order_id = ANY($targetOrderIdsSql);
COMMIT;
"@

Invoke-DbStep -Database 'omni_payment' -Description '确认无支付/退款后跳过支付库删除' -Sql @"
BEGIN;
$paymentGuardSql
COMMIT;
"@

Invoke-DbStep -Database 'omni_order' -Description '删除孤立订单和订单侧关联' -Sql @"
BEGIN;
$orderGuardSql
DELETE FROM ticket_transfer
WHERE ticket_id IN (SELECT id FROM electronic_ticket WHERE order_id = ANY($targetOrderIdsSql))
   OR new_ticket_id IN (SELECT id FROM electronic_ticket WHERE order_id = ANY($targetOrderIdsSql));
DELETE FROM ticket_check_in_record WHERE order_id = ANY($targetOrderIdsSql);
DELETE FROM order_attendee WHERE order_id = ANY($targetOrderIdsSql) OR order_seat_id = ANY($targetOrderSeatIdsSql);
DELETE FROM electronic_ticket WHERE order_id = ANY($targetOrderIdsSql) OR order_seat_id = ANY($targetOrderSeatIdsSql);
DELETE FROM order_seat WHERE order_id = ANY($targetOrderIdsSql) OR id = ANY($targetOrderSeatIdsSql);
DELETE FROM order_snapshot WHERE order_id = ANY($targetOrderIdsSql);
DELETE FROM "order" WHERE id = ANY($targetOrderIdsSql);
COMMIT;
"@

Write-Host ""
Write-Host '执行后核对:' -ForegroundColor Yellow
foreach ($entry in $preflightSql.GetEnumerator()) {
    Invoke-DbStep -Database $entry.Key -Description '清理后核对' -Sql $entry.Value
}

Write-Host ""
Write-Host '孤立订单 625 及派生订单 629 清理完成。' -ForegroundColor Green
