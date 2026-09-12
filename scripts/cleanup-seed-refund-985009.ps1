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

    $tempSql = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "omni-cleanup-$Database-$([System.Guid]::NewGuid().ToString('N')).sql"
    [System.IO.File]::WriteAllText($tempSql, $Sql, [System.Text.UTF8Encoding]::new($false))
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
        if ($line) {
            Write-Host $line
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

$paymentGuardSql = @'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM refund_request
        WHERE (id = 985009 OR refund_no = 'REFREAL985009')
          AND NOT (id = 985009 AND refund_no = 'REFREAL985009' AND order_id = 980006 AND payment_id = 984006)
    ) THEN
        RAISE EXCEPTION 'refund_request guard failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM refund_request
        WHERE payment_id = 984006
          AND id <> 985009
    ) THEN
        RAISE EXCEPTION 'payment 984006 has non-target refund_request';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM payment
        WHERE (id = 984006 OR payment_no = 'PAYREAL984006' OR out_trade_no = 'DMREAL980006' OR trade_no = 'ALI-REAL-980006')
          AND NOT (
              id = 984006
              AND order_id = 980006
              AND payment_no = 'PAYREAL984006'
              AND payment_method = 'ALIPAY'
              AND out_trade_no = 'DMREAL980006'
              AND trade_no = 'ALI-REAL-980006'
          )
    ) THEN
        RAISE EXCEPTION 'payment guard failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM payment
        WHERE id = 984006
          AND (raw_notify IS NOT NULL OR callback_data IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'payment 984006 has channel receipt';
    END IF;
END $$;
'@

$orderGuardSql = @'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "order"
        WHERE (id = 980006 OR order_no = 'DMREAL980006')
          AND NOT (
              id = 980006
              AND order_no = 'DMREAL980006'
              AND user_id = 2008
              AND session_id = 910006
              AND ticket_type_id = 920018
              AND quantity = 2
              AND amount = 440.00
          )
    ) THEN
        RAISE EXCEPTION 'order guard failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM order_seat
        WHERE id = 981006
          AND NOT (order_id = 980006 AND session_seat_id = 990006)
    ) THEN
        RAISE EXCEPTION 'order_seat guard failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM electronic_ticket
        WHERE (id = 983006 OR ticket_no = 'ETREAL983006')
          AND NOT (id = 983006 AND ticket_no = 'ETREAL983006' AND order_id = 980006 AND order_seat_id = 981006)
    ) THEN
        RAISE EXCEPTION 'electronic_ticket guard failed';
    END IF;
END $$;
'@

$grabGuardSql = @'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM waitlist_entry
        WHERE id = 989306
          AND NOT (
              user_id = 2008
              AND session_id = 910021
              AND ticket_type_id = 920061
              AND status = 'PAID'
              AND offer_order_id = 980006
          )
    ) THEN
        RAISE EXCEPTION 'waitlist_entry guard failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM waitlist_entry
        WHERE offer_order_id = 980006
          AND id <> 989306
    ) THEN
        RAISE EXCEPTION 'extra waitlist_entry points to order 980006';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM waitlist_offer
        WHERE id = 989506
          AND NOT (
              entry_id = 989306
              AND user_id = 2008
              AND session_id = 910021
              AND ticket_type_id = 920061
              AND order_id = 980006
              AND status = 'PAID'
          )
    ) THEN
        RAISE EXCEPTION 'waitlist_offer guard failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM waitlist_offer
        WHERE order_id = 980006
          AND id <> 989506
    ) THEN
        RAISE EXCEPTION 'extra waitlist_offer points to order 980006';
    END IF;
END $$;
'@

$userGuardSql = @'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM support_conversation
        WHERE id = 988102
          AND (subject NOT LIKE '%DMREAL980006%' OR last_message NOT LIKE '%REFREAL985009%')
    ) THEN
        RAISE EXCEPTION 'support_conversation guard failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM support_conversation
        WHERE id <> 988102
          AND (subject LIKE '%DMREAL980006%' OR last_message LIKE '%DMREAL980006%' OR last_message LIKE '%REFREAL985009%')
    ) THEN
        RAISE EXCEPTION 'extra support_conversation matches target identifiers';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM support_message
        WHERE conversation_id <> 988102
          AND (content LIKE '%DMREAL980006%' OR content LIKE '%REFREAL985009%')
    ) THEN
        RAISE EXCEPTION 'extra support_message matches target identifiers';
    END IF;
END $$;
'@

$notificationGuardSql = @'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM notification
        WHERE order_id IN (980058, 984058)
          AND (
              coalesce(content, '') LIKE '%DMREAL980006%'
              OR coalesce(content, '') LIKE '%REFREAL985009%'
              OR coalesce(aggregate_key, '') LIKE '%DMREAL980006%'
              OR coalesce(aggregate_key, '') LIKE '%REFREAL985009%'
          )
    ) THEN
        RAISE EXCEPTION 'notification guard failed';
    END IF;
END $$;
'@

$ticketGuardSql = @'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM stock_log
        WHERE order_id = 980006
    ) THEN
        RAISE EXCEPTION 'stock_log exists for order 980006';
    END IF;
END $$;
'@

$preflightSql = [ordered]@{
    omni_payment = @"
$paymentGuardSql
SELECT 'target_refund_request', count(*) FROM refund_request WHERE id = 985009 AND refund_no = 'REFREAL985009' AND order_id = 980006 AND payment_id = 984006;
SELECT 'target_payment', count(*) FROM payment WHERE id = 984006 AND payment_no = 'PAYREAL984006' AND order_id = 980006 AND payment_method = 'ALIPAY' AND out_trade_no = 'DMREAL980006' AND trade_no = 'ALI-REAL-980006';
SELECT 'target_payment_receipts', count(*) FROM payment WHERE id = 984006 AND (raw_notify IS NOT NULL OR callback_data IS NOT NULL);
SELECT 'protected_real_payment_984058', count(*) FROM payment WHERE id = 984058 AND order_id = 980058;
"@
    omni_order = @"
$orderGuardSql
SELECT 'target_order', count(*) FROM "order" WHERE id = 980006 AND order_no = 'DMREAL980006';
SELECT 'target_order_snapshot', count(*) FROM order_snapshot WHERE order_id = 980006;
SELECT 'target_order_seat', count(*) FROM order_seat WHERE order_id = 980006 OR id = 981006;
SELECT 'target_electronic_ticket', count(*) FROM electronic_ticket WHERE order_id = 980006 OR id = 983006 OR ticket_no = 'ETREAL983006';
SELECT 'target_ticket_transfer', count(*) FROM ticket_transfer WHERE ticket_id = 983006 OR new_ticket_id = 983006;
SELECT 'target_check_in_record', count(*) FROM ticket_check_in_record WHERE order_id = 980006 OR ticket_id = 983006 OR ticket_no = 'ETREAL983006';
SELECT 'target_order_attendee', count(*) FROM order_attendee WHERE order_id = 980006 OR order_seat_id = 981006;
SELECT 'protected_real_order_980058', count(*) FROM "order" WHERE id = 980058;
"@
    omni_ticket_split = @"
$ticketGuardSql
SELECT 'target_activity_review', count(*) FROM activity_review WHERE order_id = 980006;
SELECT 'target_session_seat_occupancy', count(*) FROM session_seat WHERE order_id = 980006 OR (id = 990006 AND order_id = 980006);
SELECT 'target_stock_log', count(*) FROM stock_log WHERE order_id = 980006;
SELECT 'target_ticket_type_remain_stock', remain_stock FROM ticket_type WHERE id = 920018;
"@
    omni_grab = @"
$grabGuardSql
SELECT 'target_waitlist_entry', count(*) FROM waitlist_entry WHERE id = 989306 AND offer_order_id = 980006;
SELECT 'target_waitlist_offer', count(*) FROM waitlist_offer WHERE id = 989506 AND order_id = 980006;
SELECT 'target_waitlist_allocation_log', count(*) FROM waitlist_allocation_log WHERE order_id = 980006 OR source_order_id = 980006 OR allocated_entry_id = 989306;
SELECT 'target_grab_request', count(*) FROM grab_request WHERE order_id = 980006;
SELECT 'target_team_grab_request', count(*) FROM team_grab_request WHERE order_id = 980006;
SELECT 'target_team_seat_assignment', count(*) FROM team_seat_assignment WHERE order_id = 980006 OR order_seat_id = 981006;
"@
    omni_notification = @"
$notificationGuardSql
SELECT 'target_notification', count(*) FROM notification WHERE order_id IN (980006, 985009) OR coalesce(content, '') LIKE '%DMREAL980006%' OR coalesce(content, '') LIKE '%REFREAL985009%' OR coalesce(aggregate_key, '') LIKE '%DMREAL980006%' OR coalesce(aggregate_key, '') LIKE '%REFREAL985009%';
SELECT 'target_notification_delivery', count(*) FROM notification_delivery WHERE order_id IN (980006, 985009) OR coalesce(content_snapshot, '') LIKE '%DMREAL980006%' OR coalesce(content_snapshot, '') LIKE '%REFREAL985009%' OR coalesce(payload_json, '') LIKE '%DMREAL980006%' OR coalesce(payload_json, '') LIKE '%REFREAL985009%' OR coalesce(event_id, '') LIKE '%DMREAL980006%' OR coalesce(event_id, '') LIKE '%REFREAL985009%';
"@
    omni_user = @"
$userGuardSql
SELECT 'target_support_conversation', count(*) FROM support_conversation WHERE id = 988102;
SELECT 'target_support_message', count(*) FROM support_message WHERE conversation_id = 988102;
SELECT 'target_support_conversation_audit', count(*) FROM support_conversation_audit WHERE conversation_id = 988102;
SELECT 'target_support_conversation_note', count(*) FROM support_conversation_note WHERE conversation_id = 988102;
SELECT 'target_support_conversation_tag', count(*) FROM support_conversation_tag WHERE conversation_id = 988102;
SELECT 'target_exception_task', count(*) FROM exception_task WHERE order_no = 'DMREAL980006' OR payment_no = 'PAYREAL984006' OR refund_no = 'REFREAL985009' OR ticket_no = 'ETREAL983006';
"@
}

Write-Host "开始清理前核对。当前模式: $(if ($Execute) { '执行删除' } else { 'dry-run 只读' })" -ForegroundColor Yellow
foreach ($entry in $preflightSql.GetEnumerator()) {
    Invoke-DbStep -Database $entry.Key -Description '清理前核对' -Sql $entry.Value
}

if (-not $Execute) {
    Write-Host ""
    Write-Host '未执行删除：确认核对结果后，请显式添加 -Execute 执行清理。' -ForegroundColor Yellow
    exit 0
}

Invoke-DbStep -Database 'omni_user' -Description '删除客服与异常任务 seed 假数据' -Sql @"
BEGIN;
$userGuardSql
DELETE FROM exception_task_evidence
WHERE exception_id IN (
    SELECT id
    FROM exception_task
    WHERE order_no = 'DMREAL980006'
       OR payment_no = 'PAYREAL984006'
       OR refund_no = 'REFREAL985009'
       OR ticket_no = 'ETREAL983006'
);
DELETE FROM exception_task
WHERE order_no = 'DMREAL980006'
   OR payment_no = 'PAYREAL984006'
   OR refund_no = 'REFREAL985009'
   OR ticket_no = 'ETREAL983006';
DELETE FROM support_conversation_audit WHERE conversation_id = 988102;
DELETE FROM support_conversation_tag WHERE conversation_id = 988102;
DELETE FROM support_conversation_note WHERE conversation_id = 988102;
DELETE FROM support_message WHERE conversation_id = 988102;
DELETE FROM support_conversation WHERE id = 988102 AND subject LIKE '%DMREAL980006%';
COMMIT;
"@

Invoke-DbStep -Database 'omni_notification' -Description '删除目标订单相关通知冗余记录' -Sql @"
BEGIN;
$notificationGuardSql
DELETE FROM notification_delivery
WHERE order_id IN (980006, 985009)
   OR coalesce(content_snapshot, '') LIKE '%DMREAL980006%'
   OR coalesce(content_snapshot, '') LIKE '%REFREAL985009%'
   OR coalesce(payload_json, '') LIKE '%DMREAL980006%'
   OR coalesce(payload_json, '') LIKE '%REFREAL985009%'
   OR coalesce(event_id, '') LIKE '%DMREAL980006%'
   OR coalesce(event_id, '') LIKE '%REFREAL985009%';
DELETE FROM notification
WHERE order_id IN (980006, 985009)
   OR coalesce(content, '') LIKE '%DMREAL980006%'
   OR coalesce(content, '') LIKE '%REFREAL985009%'
   OR coalesce(aggregate_key, '') LIKE '%DMREAL980006%'
   OR coalesce(aggregate_key, '') LIKE '%REFREAL985009%';
COMMIT;
"@

Invoke-DbStep -Database 'omni_grab' -Description '删除候补 seed 假数据' -Sql @"
BEGIN;
$grabGuardSql
DELETE FROM waitlist_allocation_log
WHERE order_id = 980006
   OR source_order_id = 980006
   OR allocated_entry_id = 989306;
DELETE FROM waitlist_offer
WHERE id = 989506
  AND entry_id = 989306
  AND order_id = 980006;
DELETE FROM waitlist_entry
WHERE id = 989306
  AND offer_order_id = 980006;
COMMIT;
"@

Invoke-DbStep -Database 'omni_payment' -Description '删除退款申请和伪支付流水' -Sql @"
BEGIN;
$paymentGuardSql
DELETE FROM refund_request
WHERE id = 985009
  AND refund_no = 'REFREAL985009'
  AND order_id = 980006
  AND payment_id = 984006;
DELETE FROM payment
WHERE id = 984006
  AND order_id = 980006
  AND payment_no = 'PAYREAL984006'
  AND payment_method = 'ALIPAY'
  AND out_trade_no = 'DMREAL980006'
  AND trade_no = 'ALI-REAL-980006';
COMMIT;
"@

Invoke-DbStep -Database 'omni_order' -Description '删除订单、电子票与订单侧关联数据' -Sql @"
BEGIN;
$orderGuardSql
DELETE FROM ticket_transfer
WHERE ticket_id = 983006
   OR new_ticket_id = 983006;
DELETE FROM ticket_check_in_record
WHERE order_id = 980006
   OR ticket_id = 983006
   OR ticket_no = 'ETREAL983006';
DELETE FROM order_attendee
WHERE order_id = 980006
   OR order_seat_id = 981006;
DELETE FROM electronic_ticket
WHERE order_id = 980006
   OR id = 983006
   OR ticket_no = 'ETREAL983006';
DELETE FROM order_seat
WHERE order_id = 980006
   OR id = 981006;
DELETE FROM order_snapshot
WHERE order_id = 980006;
DELETE FROM "order"
WHERE id = 980006
  AND order_no = 'DMREAL980006';
COMMIT;
"@

Invoke-DbStep -Database 'omni_ticket_split' -Description '防御性释放目标座位占用，不调整票档库存' -Sql @"
BEGIN;
$ticketGuardSql
UPDATE session_seat
SET status = 1,
    order_id = NULL,
    lock_expire_time = NULL,
    lock_request_id = NULL,
    update_time = CURRENT_TIMESTAMP
WHERE id = 990006
  AND order_id = 980006;
COMMIT;
"@

Write-Host ""
Write-Host '执行后核对:' -ForegroundColor Yellow
foreach ($entry in $preflightSql.GetEnumerator()) {
    Invoke-DbStep -Database $entry.Key -Description '清理后核对' -Sql $entry.Value
}

Write-Host ""
Write-Host 'seed 伪交易清理脚本执行完成。' -ForegroundColor Green
