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

    $tempSql = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "omni-seed-cleanup-$Database-$([System.Guid]::NewGuid().ToString('N')).sql"
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

    $lines = @()
    foreach ($line in $output) {
        if ($null -ne $line -and $line.ToString().Length -gt 0) {
            $lines += $line.ToString()
        }
    }

    return $lines
}

function Invoke-DbStep {
    param(
        [string]$Database,
        [string]$Description,
        [string]$Sql
    )

    Write-Host ""
    Write-Host "[$Database] $Description" -ForegroundColor Cyan
    $lines = @(Invoke-OmniPsql -Database $Database -Sql $Sql)
    foreach ($line in $lines) {
        Write-Host $line
    }
}

function Convert-ToNullableLong {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }
    return [long]$Value
}

function Get-SqlLongArrayLiteral {
    param([object[]]$Values)
    $clean = @($Values | Where-Object { $null -ne $_ } | ForEach-Object { [long]$_ } | Sort-Object -Unique)
    if ($clean.Count -eq 0) {
        return 'ARRAY[]::bigint[]'
    }
    return "ARRAY[$($clean -join ',')]::bigint[]"
}

function Get-SqlTextArrayLiteral {
    param([object[]]$Values)
    $clean = @($Values | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ } | Sort-Object -Unique)
    if ($clean.Count -eq 0) {
        return 'ARRAY[]::text[]'
    }
    $quoted = @($clean | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" })
    return "ARRAY[$($quoted -join ',')]::text[]"
}

function Format-IdList {
    param([object[]]$Values)
    $clean = @($Values | Where-Object { $null -ne $_ } | Sort-Object -Unique)
    if ($clean.Count -eq 0) {
        return '无'
    }
    return ($clean -join ',')
}

function Assert-NoProtectedIds {
    param(
        [long[]]$PaymentIds,
        [long[]]$OrderIds,
        [long[]]$RefundIds
    )

    if ($PaymentIds -contains 984058) {
        throw '保护校验失败：候选支付包含真实沙箱 payment.id=984058。'
    }
    if ($OrderIds -contains 980058) {
        throw '保护校验失败：候选订单包含真实沙箱 order.id=980058。'
    }
    if ($RefundIds -contains 985058) {
        throw '保护校验失败：候选退款包含保留退款 id=985058。'
    }
}

$realPaymentGuard = @(Invoke-OmniPsql -Database 'omni_payment' -Sql @'
SELECT count(*)
FROM payment
WHERE id = 984058
  AND order_id = 980058
  AND status = 1
  AND coalesce(trade_no, '') <> ''
  AND coalesce(trade_no, '') NOT LIKE 'ALI-%'
  AND raw_notify IS NOT NULL
  AND callback_data IS NOT NULL;
'@)

$realOrderGuard = @(Invoke-OmniPsql -Database 'omni_order' -Sql @'
SELECT count(*)
FROM "order"
WHERE id = 980058
  AND order_no = 'DM202606110047432ACEBE';
'@)

if ($realPaymentGuard[0] -ne '1') {
    throw '真实沙箱保护校验失败：未确认 payment.id=984058 / order_id=980058 的真实支付宝回执。'
}
if ($realOrderGuard[0] -ne '1') {
    throw '真实沙箱保护校验失败：未确认 order.id=980058 / DM202606110047432ACEBE。'
}

$candidatePaymentSql = @'
WITH inspected AS (
    SELECT
        p.*,
        (
            coalesce(payment_no, '') ILIKE 'PAYSEED%'
            OR coalesce(payment_no, '') ILIKE 'PAYREAL%'
            OR coalesce(payment_no, '') ILIKE 'SEED-%'
            OR coalesce(payment_no, '') ILIKE 'MOCK-%'
            OR coalesce(out_trade_no, '') ILIKE 'DMSEED%'
            OR coalesce(out_trade_no, '') ILIKE 'DMREAL%'
            OR coalesce(out_trade_no, '') ILIKE 'SEED-%'
            OR coalesce(out_trade_no, '') ILIKE 'MOCK-%'
            OR coalesce(trade_no, '') ILIKE 'ALI-SEED-%'
            OR coalesce(trade_no, '') ILIKE 'ALI-REAL-%'
            OR coalesce(trade_no, '') ILIKE 'SEED-%'
            OR coalesce(trade_no, '') ILIKE 'MOCK-%'
        ) AS matches_seed_prefix,
        (
            status = 1
            AND upper(coalesce(payment_method, '')) = 'ALIPAY'
            AND coalesce(nullif(btrim(trade_no), ''), '') <> ''
            AND (
                raw_notify IS NULL
                OR btrim(raw_notify) = ''
                OR callback_data IS NULL
                OR btrim(callback_data) = ''
                OR raw_notify NOT ILIKE '%' || trade_no || '%'
                OR callback_data NOT ILIKE '%' || trade_no || '%'
            )
        ) AS lacks_valid_alipay_receipt
    FROM payment p
)
SELECT
    id,
    order_id,
    coalesce(payment_no, ''),
    coalesce(out_trade_no, ''),
    coalesce(trade_no, ''),
    status,
    CASE WHEN raw_notify IS NULL OR btrim(raw_notify) = '' THEN '0' ELSE '1' END AS has_raw_notify,
    CASE WHEN callback_data IS NULL OR btrim(callback_data) = '' THEN '0' ELSE '1' END AS has_callback_data,
    concat_ws(
        ',',
        CASE WHEN matches_seed_prefix THEN 'seed-prefix' END,
        CASE WHEN lacks_valid_alipay_receipt THEN 'no-valid-alipay-receipt' END
    ) AS reason
FROM inspected
WHERE (matches_seed_prefix OR lacks_valid_alipay_receipt)
  AND id <> 984058
  AND order_id <> 980058
ORDER BY id;
'@

$paymentRows = @()
foreach ($line in @(Invoke-OmniPsql -Database 'omni_payment' -Sql $candidatePaymentSql)) {
    $cols = $line -split "`t", -1
    if ($cols.Count -lt 9) {
        continue
    }
    $paymentRows += [pscustomobject]@{
        Id = [long]$cols[0]
        OrderId = Convert-ToNullableLong $cols[1]
        PaymentNo = $cols[2]
        OutTradeNo = $cols[3]
        TradeNo = $cols[4]
        Status = [int]$cols[5]
        HasRawNotify = $cols[6] -eq '1'
        HasCallbackData = $cols[7] -eq '1'
        Reason = $cols[8]
    }
}

$paymentIds = @($paymentRows | ForEach-Object { $_.Id } | Sort-Object -Unique)
$initialOrderIds = @($paymentRows | ForEach-Object { $_.OrderId } | Where-Object { $null -ne $_ } | Sort-Object -Unique)
$paymentIdsSql = Get-SqlLongArrayLiteral $paymentIds
$initialOrderIdsSql = Get-SqlLongArrayLiteral $initialOrderIds

$candidateRefundSql = @"
WITH payment_candidates AS (
    SELECT unnest($paymentIdsSql) AS id
),
order_candidates AS (
    SELECT unnest($initialOrderIdsSql) AS id
),
inspected AS (
    SELECT
        rr.*,
        (
            coalesce(refund_no, '') ILIKE 'REFSEED%'
            OR coalesce(refund_no, '') ILIKE 'REFREAL%'
            OR coalesce(refund_no, '') ILIKE 'SEED-%'
            OR coalesce(refund_no, '') ILIKE 'MOCK-%'
            OR coalesce(raw_response::text, '') ILIKE '%"seed"%'
        ) AS matches_seed_refund
    FROM refund_request rr
)
SELECT
    id,
    order_id,
    payment_id,
    coalesce(refund_no, ''),
    status,
    coalesce(raw_response::text, ''),
    concat_ws(
        ',',
        CASE WHEN payment_id IN (SELECT id FROM payment_candidates) THEN 'candidate-payment' END,
        CASE WHEN order_id IN (SELECT id FROM order_candidates) THEN 'candidate-order' END,
        CASE WHEN matches_seed_refund THEN 'seed-refund' END
    ) AS reason
FROM inspected
WHERE (
        payment_id IN (SELECT id FROM payment_candidates)
        OR order_id IN (SELECT id FROM order_candidates)
        OR matches_seed_refund
    )
  AND coalesce(payment_id, -1) <> 984058
  AND coalesce(order_id, -1) <> 980058
ORDER BY id;
"@

$refundRows = @()
foreach ($line in @(Invoke-OmniPsql -Database 'omni_payment' -Sql $candidateRefundSql)) {
    $cols = $line -split "`t", -1
    if ($cols.Count -lt 7) {
        continue
    }
    $refundRows += [pscustomobject]@{
        Id = [long]$cols[0]
        OrderId = Convert-ToNullableLong $cols[1]
        PaymentId = Convert-ToNullableLong $cols[2]
        RefundNo = $cols[3]
        Status = [int]$cols[4]
        RawResponse = $cols[5]
        Reason = $cols[6]
    }
}

$refundIds = @($refundRows | ForEach-Object { $_.Id } | Sort-Object -Unique)
$orderIds = @(
    $initialOrderIds
    $refundRows | ForEach-Object { $_.OrderId }
) | Where-Object { $null -ne $_ } | Sort-Object -Unique

Assert-NoProtectedIds -PaymentIds $paymentIds -OrderIds $orderIds -RefundIds $refundIds

$linkedNonCandidateRefundPayments = @(
    $refundRows |
        Where-Object { $null -ne $_.PaymentId -and $paymentIds -notcontains $_.PaymentId } |
        ForEach-Object { $_.PaymentId } |
        Sort-Object -Unique
)
if ($linkedNonCandidateRefundPayments.Count -gt 0) {
    throw "存在 seed 退款绑定非候选支付，请人工复核后再执行：payment_id=$(Format-IdList $linkedNonCandidateRefundPayments)"
}

$orderIdsSql = Get-SqlLongArrayLiteral $orderIds
$refundIdsSql = Get-SqlLongArrayLiteral $refundIds

$orderRows = @()
foreach ($line in @(Invoke-OmniPsql -Database 'omni_order' -Sql @"
SELECT id, order_no, status, user_id, session_id, ticket_type_id, quantity, amount
FROM "order"
WHERE id = ANY($orderIdsSql)
ORDER BY id;
"@)) {
    $cols = $line -split "`t", -1
    if ($cols.Count -lt 8) {
        continue
    }
    $orderRows += [pscustomobject]@{
        Id = [long]$cols[0]
        OrderNo = $cols[1]
        Status = [int]$cols[2]
        UserId = Convert-ToNullableLong $cols[3]
        SessionId = Convert-ToNullableLong $cols[4]
        TicketTypeId = Convert-ToNullableLong $cols[5]
        Quantity = [int]$cols[6]
        Amount = $cols[7]
    }
}

$orderSeatRows = @()
foreach ($line in @(Invoke-OmniPsql -Database 'omni_order' -Sql @"
SELECT id, order_id, session_seat_id, session_id, ticket_type_id, status, coalesce(seat_label, '')
FROM order_seat
WHERE order_id = ANY($orderIdsSql)
ORDER BY id;
"@)) {
    $cols = $line -split "`t", -1
    if ($cols.Count -lt 7) {
        continue
    }
    $orderSeatRows += [pscustomobject]@{
        Id = [long]$cols[0]
        OrderId = Convert-ToNullableLong $cols[1]
        SessionSeatId = Convert-ToNullableLong $cols[2]
        SessionId = Convert-ToNullableLong $cols[3]
        TicketTypeId = Convert-ToNullableLong $cols[4]
        Status = [int]$cols[5]
        SeatLabel = $cols[6]
    }
}

$orderSeatIds = @($orderSeatRows | ForEach-Object { $_.Id } | Sort-Object -Unique)
$sessionSeatIds = @($orderSeatRows | ForEach-Object { $_.SessionSeatId } | Where-Object { $null -ne $_ } | Sort-Object -Unique)
$orderSeatIdsSql = Get-SqlLongArrayLiteral $orderSeatIds
$sessionSeatIdsSql = Get-SqlLongArrayLiteral $sessionSeatIds

$ticketRows = @()
foreach ($line in @(Invoke-OmniPsql -Database 'omni_order' -Sql @"
SELECT id, ticket_no, order_id, order_seat_id, status
FROM electronic_ticket
WHERE order_id = ANY($orderIdsSql)
   OR order_seat_id = ANY($orderSeatIdsSql)
ORDER BY id;
"@)) {
    $cols = $line -split "`t", -1
    if ($cols.Count -lt 5) {
        continue
    }
    $ticketRows += [pscustomobject]@{
        Id = [long]$cols[0]
        TicketNo = $cols[1]
        OrderId = Convert-ToNullableLong $cols[2]
        OrderSeatId = Convert-ToNullableLong $cols[3]
        Status = [int]$cols[4]
    }
}

$ticketIds = @($ticketRows | ForEach-Object { $_.Id } | Sort-Object -Unique)
$ticketNos = @($ticketRows | ForEach-Object { $_.TicketNo } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
$ticketIdsSql = Get-SqlLongArrayLiteral $ticketIds
$ticketNosSql = Get-SqlTextArrayLiteral $ticketNos

$identifierTokens = @(
    $paymentRows | ForEach-Object { $_.PaymentNo }
    $paymentRows | ForEach-Object { $_.OutTradeNo }
    $paymentRows | ForEach-Object { $_.TradeNo }
    $refundRows | ForEach-Object { $_.RefundNo }
    $orderRows | ForEach-Object { $_.OrderNo }
    $ticketNos
) | Where-Object {
    -not [string]::IsNullOrWhiteSpace([string]$_) -and
    [string]$_ -ne 'DM202606110047432ACEBE' -and
    [string]$_ -ne '2026061122001424640509936851'
} | Sort-Object -Unique
$identifierTokensSql = Get-SqlTextArrayLiteral $identifierTokens

Write-Host "开始 Seed 伪交易清理核对。当前模式: $(if ($Execute) { '执行删除' } else { 'dry-run 只读' })" -ForegroundColor Yellow
Write-Host ""
Write-Host "候选支付 payment.id: $(Format-IdList $paymentIds)"
Write-Host "候选退款 refund_request.id: $(Format-IdList $refundIds)"
Write-Host "候选订单 order.id: $(Format-IdList $orderIds)"
Write-Host "候选订单座位 order_seat.id: $(Format-IdList $orderSeatIds)"
Write-Host "候选电子票 electronic_ticket.id: $(Format-IdList $ticketIds)"

Write-Host ""
Write-Host '[omni_payment] 候选支付明细' -ForegroundColor Cyan
foreach ($row in $paymentRows) {
    Write-Host ("payment_id={0}; order_id={1}; payment_no={2}; out_trade_no={3}; trade_no={4}; status={5}; has_raw={6}; has_callback={7}; reason={8}" -f $row.Id, $row.OrderId, $row.PaymentNo, $row.OutTradeNo, $row.TradeNo, $row.Status, $row.HasRawNotify, $row.HasCallbackData, $row.Reason)
}

Write-Host ""
Write-Host '[omni_payment] 候选退款明细' -ForegroundColor Cyan
foreach ($row in $refundRows) {
    Write-Host ("refund_id={0}; order_id={1}; payment_id={2}; refund_no={3}; status={4}; reason={5}" -f $row.Id, $row.OrderId, $row.PaymentId, $row.RefundNo, $row.Status, $row.Reason)
}

Write-Host ""
Write-Host '[omni_order] 候选订单状态分布' -ForegroundColor Cyan
$orderRows | Group-Object Status | Sort-Object Name | ForEach-Object {
    Write-Host ("status={0}; count={1}" -f $_.Name, $_.Count)
}

Invoke-DbStep -Database 'omni_payment' -Description '清理前计数' -Sql @"
WITH target_payment AS (SELECT unnest($paymentIdsSql) AS id),
target_refund AS (SELECT unnest($refundIdsSql) AS id),
target_order AS (SELECT unnest($orderIdsSql) AS id)
SELECT 'target_payment', count(*) FROM payment WHERE id IN (SELECT id FROM target_payment)
UNION ALL
SELECT 'target_refund_request', count(*) FROM refund_request WHERE id IN (SELECT id FROM target_refund)
UNION ALL
SELECT 'seed_refund_total_after_filter', count(*) FROM refund_request
WHERE (
    refund_no ILIKE 'REFSEED%'
    OR refund_no ILIKE 'REFREAL%'
    OR coalesce(raw_response::text, '') ILIKE '%"seed"%'
    OR payment_id IN (SELECT id FROM target_payment)
    OR order_id IN (SELECT id FROM target_order)
)
AND coalesce(payment_id, -1) <> 984058
AND coalesce(order_id, -1) <> 980058
UNION ALL
SELECT 'protected_real_payment_984058', count(*) FROM payment WHERE id = 984058 AND order_id = 980058;
"@

Invoke-DbStep -Database 'omni_order' -Description '清理前计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id),
target_order_seat AS (SELECT unnest($orderSeatIdsSql) AS id),
target_ticket AS (SELECT unnest($ticketIdsSql) AS id),
target_ticket_no AS (SELECT unnest($ticketNosSql) AS ticket_no)
SELECT 'target_order', count(*) FROM "order" WHERE id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_order_snapshot', count(*) FROM order_snapshot WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_order_seat', count(*) FROM order_seat WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_electronic_ticket', count(*) FROM electronic_ticket WHERE order_id IN (SELECT id FROM target_order) OR order_seat_id IN (SELECT id FROM target_order_seat)
UNION ALL
SELECT 'target_ticket_check_in_record', count(*) FROM ticket_check_in_record WHERE order_id IN (SELECT id FROM target_order) OR ticket_id IN (SELECT id FROM target_ticket) OR ticket_no IN (SELECT ticket_no FROM target_ticket_no)
UNION ALL
SELECT 'target_ticket_transfer', count(*) FROM ticket_transfer WHERE ticket_id IN (SELECT id FROM target_ticket) OR new_ticket_id IN (SELECT id FROM target_ticket)
UNION ALL
SELECT 'target_order_attendee', count(*) FROM order_attendee WHERE order_id IN (SELECT id FROM target_order) OR order_seat_id IN (SELECT id FROM target_order_seat)
UNION ALL
SELECT 'protected_real_order_980058', count(*) FROM "order" WHERE id = 980058;
"@

Invoke-DbStep -Database 'omni_ticket_split' -Description '清理前计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id)
SELECT 'target_session_seat_occupancy', count(*) FROM session_seat WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_stock_log', count(*) FROM stock_log WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_activity_review_report', count(*) FROM activity_review_report WHERE review_id IN (SELECT id FROM activity_review WHERE order_id IN (SELECT id FROM target_order))
UNION ALL
SELECT 'target_activity_review', count(*) FROM activity_review WHERE order_id IN (SELECT id FROM target_order);
"@

Invoke-DbStep -Database 'omni_grab' -Description '清理前计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id),
target_order_seat AS (SELECT unnest($orderSeatIdsSql) AS id),
target_session_seat AS (SELECT unnest($sessionSeatIdsSql) AS id),
target_waitlist_entry AS (
    SELECT id FROM waitlist_entry WHERE offer_order_id IN (SELECT id FROM target_order)
    UNION
    SELECT entry_id FROM waitlist_offer WHERE order_id IN (SELECT id FROM target_order)
    UNION
    SELECT allocated_entry_id FROM waitlist_allocation_log
    WHERE allocated_entry_id IS NOT NULL
      AND (order_id IN (SELECT id FROM target_order) OR source_order_id IN (SELECT id FROM target_order))
)
SELECT 'target_waitlist_entry', count(*) FROM waitlist_entry WHERE id IN (SELECT id FROM target_waitlist_entry) OR offer_order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_waitlist_offer', count(*) FROM waitlist_offer WHERE entry_id IN (SELECT id FROM target_waitlist_entry) OR order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_waitlist_allocation_log', count(*) FROM waitlist_allocation_log WHERE allocated_entry_id IN (SELECT id FROM target_waitlist_entry) OR order_id IN (SELECT id FROM target_order) OR source_order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_grab_request', count(*) FROM grab_request WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_team_grab_request', count(*) FROM team_grab_request WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'target_team_seat_assignment', count(*) FROM team_seat_assignment WHERE order_id IN (SELECT id FROM target_order) OR order_seat_id IN (SELECT id FROM target_order_seat) OR session_seat_id IN (SELECT id FROM target_session_seat)
UNION ALL
SELECT 'target_ticket_team_member', count(*) FROM ticket_team_member WHERE order_seat_id IN (SELECT id FROM target_order_seat) OR seat_id IN (SELECT id FROM target_session_seat);
"@

Invoke-DbStep -Database 'omni_notification' -Description '清理前计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id),
target_token AS (SELECT unnest($identifierTokensSql) AS token)
SELECT 'target_notification_delivery', count(*) FROM notification_delivery nd
WHERE order_id IN (SELECT id FROM target_order)
   OR EXISTS (
      SELECT 1 FROM target_token t
      WHERE coalesce(nd.event_id, '') ILIKE '%' || t.token || '%'
         OR coalesce(nd.content_snapshot, '') ILIKE '%' || t.token || '%'
         OR coalesce(nd.payload_json, '') ILIKE '%' || t.token || '%'
   )
UNION ALL
SELECT 'target_notification', count(*) FROM notification n
WHERE order_id IN (SELECT id FROM target_order)
   OR EXISTS (
      SELECT 1 FROM target_token t
      WHERE coalesce(n.content, '') ILIKE '%' || t.token || '%'
         OR coalesce(n.aggregate_key, '') ILIKE '%' || t.token || '%'
         OR coalesce(n.action_href, '') ILIKE '%' || t.token || '%'
   );
"@

Invoke-DbStep -Database 'omni_user' -Description '清理前计数' -Sql @"
WITH target_token AS (SELECT unnest($identifierTokensSql) AS token),
target_exception AS (
    SELECT id FROM exception_task e
    WHERE EXISTS (
        SELECT 1 FROM target_token t
        WHERE coalesce(e.business_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.order_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.payment_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.refund_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.ticket_no, '') ILIKE '%' || t.token || '%'
    )
),
target_support_conversation AS (
    SELECT id FROM support_conversation c
    WHERE EXISTS (
        SELECT 1 FROM target_token t
        WHERE coalesce(c.subject, '') ILIKE '%' || t.token || '%'
           OR coalesce(c.last_message, '') ILIKE '%' || t.token || '%'
    )
    UNION
    SELECT conversation_id FROM support_message m
    WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(m.content, '') ILIKE '%' || t.token || '%')
    UNION
    SELECT conversation_id FROM support_conversation_note n
    WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(n.content, '') ILIKE '%' || t.token || '%')
    UNION
    SELECT conversation_id FROM support_conversation_audit a
    WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(a.detail, '') ILIKE '%' || t.token || '%')
)
SELECT 'target_exception_task', count(*) FROM exception_task WHERE id IN (SELECT id FROM target_exception)
UNION ALL
SELECT 'target_exception_task_evidence', count(*) FROM exception_task_evidence WHERE exception_id IN (SELECT id FROM target_exception)
UNION ALL
SELECT 'target_reconciliation_detail', count(*) FROM reconciliation_detail rd
WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(rd.business_no, '') ILIKE '%' || t.token || '%')
UNION ALL
SELECT 'target_reconciliation_difference', count(*) FROM reconciliation_difference rdiff
WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(rdiff.business_no, '') ILIKE '%' || t.token || '%')
UNION ALL
SELECT 'target_support_conversation', count(*) FROM support_conversation WHERE id IN (SELECT id FROM target_support_conversation)
UNION ALL
SELECT 'target_support_message', count(*) FROM support_message WHERE conversation_id IN (SELECT id FROM target_support_conversation)
UNION ALL
SELECT 'target_support_conversation_note', count(*) FROM support_conversation_note WHERE conversation_id IN (SELECT id FROM target_support_conversation)
UNION ALL
SELECT 'target_support_conversation_audit', count(*) FROM support_conversation_audit WHERE conversation_id IN (SELECT id FROM target_support_conversation)
UNION ALL
SELECT 'target_support_conversation_tag', count(*) FROM support_conversation_tag WHERE conversation_id IN (SELECT id FROM target_support_conversation);
"@

if (-not $Execute) {
    Write-Host ""
    Write-Host '未执行删除：请确认上述候选清单后，再显式添加 -Execute 执行清理。' -ForegroundColor Yellow
    exit 0
}

Invoke-DbStep -Database 'omni_user' -Description '删除异常任务、对账差异与客服会话 seed 假数据' -Sql @"
BEGIN;
CREATE TEMP TABLE target_token(token text) ON COMMIT DROP;
INSERT INTO target_token SELECT DISTINCT unnest($identifierTokensSql);
CREATE TEMP TABLE target_exception_task ON COMMIT DROP AS
    SELECT id FROM exception_task e
    WHERE EXISTS (
        SELECT 1 FROM target_token t
        WHERE coalesce(e.business_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.order_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.payment_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.refund_no, '') ILIKE '%' || t.token || '%'
           OR coalesce(e.ticket_no, '') ILIKE '%' || t.token || '%'
    );
CREATE TEMP TABLE target_support_conversation ON COMMIT DROP AS
    SELECT id FROM support_conversation c
    WHERE EXISTS (
        SELECT 1 FROM target_token t
        WHERE coalesce(c.subject, '') ILIKE '%' || t.token || '%'
           OR coalesce(c.last_message, '') ILIKE '%' || t.token || '%'
    )
    UNION
    SELECT conversation_id FROM support_message m
    WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(m.content, '') ILIKE '%' || t.token || '%')
    UNION
    SELECT conversation_id FROM support_conversation_note n
    WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(n.content, '') ILIKE '%' || t.token || '%')
    UNION
    SELECT conversation_id FROM support_conversation_audit a
    WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(a.detail, '') ILIKE '%' || t.token || '%');
DELETE FROM exception_task_evidence WHERE exception_id IN (SELECT id FROM target_exception_task);
DELETE FROM exception_task WHERE id IN (SELECT id FROM target_exception_task);
DELETE FROM reconciliation_difference
WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(business_no, '') ILIKE '%' || t.token || '%');
DELETE FROM reconciliation_detail
WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(business_no, '') ILIKE '%' || t.token || '%');
DELETE FROM support_conversation_audit WHERE conversation_id IN (SELECT id FROM target_support_conversation);
DELETE FROM support_conversation_tag WHERE conversation_id IN (SELECT id FROM target_support_conversation);
DELETE FROM support_conversation_note WHERE conversation_id IN (SELECT id FROM target_support_conversation);
DELETE FROM support_message WHERE conversation_id IN (SELECT id FROM target_support_conversation);
DELETE FROM support_conversation WHERE id IN (SELECT id FROM target_support_conversation);
COMMIT;
"@

Invoke-DbStep -Database 'omni_notification' -Description '删除目标订单/标识相关通知假数据' -Sql @"
BEGIN;
CREATE TEMP TABLE target_order(id bigint) ON COMMIT DROP;
INSERT INTO target_order SELECT DISTINCT unnest($orderIdsSql);
CREATE TEMP TABLE target_token(token text) ON COMMIT DROP;
INSERT INTO target_token SELECT DISTINCT unnest($identifierTokensSql);
DELETE FROM notification_delivery nd
WHERE order_id IN (SELECT id FROM target_order)
   OR EXISTS (
      SELECT 1 FROM target_token t
      WHERE coalesce(nd.event_id, '') ILIKE '%' || t.token || '%'
         OR coalesce(nd.content_snapshot, '') ILIKE '%' || t.token || '%'
         OR coalesce(nd.payload_json, '') ILIKE '%' || t.token || '%'
   );
DELETE FROM notification n
WHERE order_id IN (SELECT id FROM target_order)
   OR EXISTS (
      SELECT 1 FROM target_token t
      WHERE coalesce(n.content, '') ILIKE '%' || t.token || '%'
         OR coalesce(n.aggregate_key, '') ILIKE '%' || t.token || '%'
         OR coalesce(n.action_href, '') ILIKE '%' || t.token || '%'
   );
COMMIT;
"@

Invoke-DbStep -Database 'omni_grab' -Description '删除候补/抢票 seed 关联数据' -Sql @"
BEGIN;
CREATE TEMP TABLE target_order(id bigint) ON COMMIT DROP;
INSERT INTO target_order SELECT DISTINCT unnest($orderIdsSql);
CREATE TEMP TABLE target_order_seat(id bigint) ON COMMIT DROP;
INSERT INTO target_order_seat SELECT DISTINCT unnest($orderSeatIdsSql);
CREATE TEMP TABLE target_session_seat(id bigint) ON COMMIT DROP;
INSERT INTO target_session_seat SELECT DISTINCT unnest($sessionSeatIdsSql);
CREATE TEMP TABLE target_waitlist_entry ON COMMIT DROP AS
    SELECT id FROM waitlist_entry WHERE offer_order_id IN (SELECT id FROM target_order)
    UNION
    SELECT entry_id FROM waitlist_offer WHERE order_id IN (SELECT id FROM target_order)
    UNION
    SELECT allocated_entry_id FROM waitlist_allocation_log
    WHERE allocated_entry_id IS NOT NULL
      AND (order_id IN (SELECT id FROM target_order) OR source_order_id IN (SELECT id FROM target_order));
DELETE FROM waitlist_allocation_log
WHERE allocated_entry_id IN (SELECT id FROM target_waitlist_entry)
   OR order_id IN (SELECT id FROM target_order)
   OR source_order_id IN (SELECT id FROM target_order);
DELETE FROM waitlist_offer
WHERE entry_id IN (SELECT id FROM target_waitlist_entry)
   OR order_id IN (SELECT id FROM target_order);
DELETE FROM waitlist_entry
WHERE id IN (SELECT id FROM target_waitlist_entry)
   OR offer_order_id IN (SELECT id FROM target_order);
DELETE FROM team_seat_assignment
WHERE order_id IN (SELECT id FROM target_order)
   OR order_seat_id IN (SELECT id FROM target_order_seat)
   OR session_seat_id IN (SELECT id FROM target_session_seat);
DELETE FROM ticket_team_member
WHERE order_seat_id IN (SELECT id FROM target_order_seat)
   OR seat_id IN (SELECT id FROM target_session_seat);
DELETE FROM team_grab_request WHERE order_id IN (SELECT id FROM target_order);
DELETE FROM grab_request WHERE order_id IN (SELECT id FROM target_order);
COMMIT;
"@

Invoke-DbStep -Database 'omni_ticket_split' -Description '释放座位占用并删除票务侧 seed 引用' -Sql @"
BEGIN;
CREATE TEMP TABLE target_order(id bigint) ON COMMIT DROP;
INSERT INTO target_order SELECT DISTINCT unnest($orderIdsSql);
UPDATE session_seat
SET status = 1,
    order_id = NULL,
    lock_expire_time = NULL,
    lock_request_id = NULL,
    update_time = CURRENT_TIMESTAMP
WHERE order_id IN (SELECT id FROM target_order);
DELETE FROM stock_log WHERE order_id IN (SELECT id FROM target_order);
DELETE FROM activity_review_report WHERE review_id IN (SELECT id FROM activity_review WHERE order_id IN (SELECT id FROM target_order));
DELETE FROM activity_review WHERE order_id IN (SELECT id FROM target_order);
COMMIT;
"@

Invoke-DbStep -Database 'omni_payment' -Description '删除 seed 退款申请与伪支付流水' -Sql @"
BEGIN;
CREATE TEMP TABLE target_payment(id bigint) ON COMMIT DROP;
INSERT INTO target_payment SELECT DISTINCT unnest($paymentIdsSql);
CREATE TEMP TABLE target_refund(id bigint) ON COMMIT DROP;
INSERT INTO target_refund SELECT DISTINCT unnest($refundIdsSql);
DELETE FROM refund_request WHERE id IN (SELECT id FROM target_refund);
DELETE FROM payment WHERE id IN (SELECT id FROM target_payment);
COMMIT;
"@

Invoke-DbStep -Database 'omni_order' -Description '删除订单、快照、电子票与核验记录假数据' -Sql @"
BEGIN;
CREATE TEMP TABLE target_order(id bigint) ON COMMIT DROP;
INSERT INTO target_order SELECT DISTINCT unnest($orderIdsSql);
CREATE TEMP TABLE target_order_seat(id bigint) ON COMMIT DROP;
INSERT INTO target_order_seat SELECT DISTINCT unnest($orderSeatIdsSql);
CREATE TEMP TABLE target_ticket(id bigint) ON COMMIT DROP;
INSERT INTO target_ticket SELECT DISTINCT unnest($ticketIdsSql);
CREATE TEMP TABLE target_ticket_no(ticket_no text) ON COMMIT DROP;
INSERT INTO target_ticket_no SELECT DISTINCT unnest($ticketNosSql);
DELETE FROM ticket_transfer WHERE ticket_id IN (SELECT id FROM target_ticket) OR new_ticket_id IN (SELECT id FROM target_ticket);
DELETE FROM ticket_check_in_record WHERE order_id IN (SELECT id FROM target_order) OR ticket_id IN (SELECT id FROM target_ticket) OR ticket_no IN (SELECT ticket_no FROM target_ticket_no);
DELETE FROM order_attendee WHERE order_id IN (SELECT id FROM target_order) OR order_seat_id IN (SELECT id FROM target_order_seat);
DELETE FROM electronic_ticket WHERE order_id IN (SELECT id FROM target_order) OR order_seat_id IN (SELECT id FROM target_order_seat) OR id IN (SELECT id FROM target_ticket);
DELETE FROM order_seat WHERE order_id IN (SELECT id FROM target_order) OR id IN (SELECT id FROM target_order_seat);
DELETE FROM order_snapshot WHERE order_id IN (SELECT id FROM target_order);
DELETE FROM "order" WHERE id IN (SELECT id FROM target_order);
COMMIT;
"@

Write-Host ""
Write-Host '执行后核对:' -ForegroundColor Yellow
Invoke-DbStep -Database 'omni_payment' -Description '清理后计数' -Sql @"
WITH target_payment AS (SELECT unnest($paymentIdsSql) AS id),
target_refund AS (SELECT unnest($refundIdsSql) AS id)
SELECT 'remaining_target_payment', count(*) FROM payment WHERE id IN (SELECT id FROM target_payment)
UNION ALL
SELECT 'remaining_target_refund_request', count(*) FROM refund_request WHERE id IN (SELECT id FROM target_refund)
UNION ALL
SELECT 'protected_real_payment_984058', count(*) FROM payment WHERE id = 984058 AND order_id = 980058;
"@

Invoke-DbStep -Database 'omni_order' -Description '清理后计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id),
target_order_seat AS (SELECT unnest($orderSeatIdsSql) AS id),
target_ticket AS (SELECT unnest($ticketIdsSql) AS id)
SELECT 'remaining_target_order', count(*) FROM "order" WHERE id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_target_order_snapshot', count(*) FROM order_snapshot WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_target_order_seat', count(*) FROM order_seat WHERE order_id IN (SELECT id FROM target_order) OR id IN (SELECT id FROM target_order_seat)
UNION ALL
SELECT 'remaining_target_electronic_ticket', count(*) FROM electronic_ticket WHERE order_id IN (SELECT id FROM target_order) OR order_seat_id IN (SELECT id FROM target_order_seat) OR id IN (SELECT id FROM target_ticket)
UNION ALL
SELECT 'protected_real_order_980058', count(*) FROM "order" WHERE id = 980058;
"@

Invoke-DbStep -Database 'omni_ticket_split' -Description '清理后计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id)
SELECT 'remaining_session_seat_occupancy', count(*) FROM session_seat WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_stock_log', count(*) FROM stock_log WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_activity_review_report', count(*) FROM activity_review_report WHERE review_id IN (SELECT id FROM activity_review WHERE order_id IN (SELECT id FROM target_order))
UNION ALL
SELECT 'remaining_activity_review', count(*) FROM activity_review WHERE order_id IN (SELECT id FROM target_order);
"@

Invoke-DbStep -Database 'omni_grab' -Description '清理后计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id),
target_order_seat AS (SELECT unnest($orderSeatIdsSql) AS id),
target_session_seat AS (SELECT unnest($sessionSeatIdsSql) AS id)
SELECT 'remaining_waitlist_entry', count(*) FROM waitlist_entry WHERE offer_order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_waitlist_offer', count(*) FROM waitlist_offer WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_waitlist_allocation_log', count(*) FROM waitlist_allocation_log WHERE order_id IN (SELECT id FROM target_order) OR source_order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_grab_request', count(*) FROM grab_request WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_team_grab_request', count(*) FROM team_grab_request WHERE order_id IN (SELECT id FROM target_order)
UNION ALL
SELECT 'remaining_team_seat_assignment', count(*) FROM team_seat_assignment WHERE order_id IN (SELECT id FROM target_order) OR order_seat_id IN (SELECT id FROM target_order_seat) OR session_seat_id IN (SELECT id FROM target_session_seat)
UNION ALL
SELECT 'remaining_ticket_team_member', count(*) FROM ticket_team_member WHERE order_seat_id IN (SELECT id FROM target_order_seat) OR seat_id IN (SELECT id FROM target_session_seat);
"@

Invoke-DbStep -Database 'omni_notification' -Description '清理后计数' -Sql @"
WITH target_order AS (SELECT unnest($orderIdsSql) AS id),
target_token AS (SELECT unnest($identifierTokensSql) AS token)
SELECT 'remaining_notification_delivery', count(*) FROM notification_delivery nd
WHERE order_id IN (SELECT id FROM target_order)
   OR EXISTS (
      SELECT 1 FROM target_token t
      WHERE coalesce(nd.event_id, '') ILIKE '%' || t.token || '%'
         OR coalesce(nd.content_snapshot, '') ILIKE '%' || t.token || '%'
         OR coalesce(nd.payload_json, '') ILIKE '%' || t.token || '%'
   )
UNION ALL
SELECT 'remaining_notification', count(*) FROM notification n
WHERE order_id IN (SELECT id FROM target_order)
   OR EXISTS (
      SELECT 1 FROM target_token t
      WHERE coalesce(n.content, '') ILIKE '%' || t.token || '%'
         OR coalesce(n.aggregate_key, '') ILIKE '%' || t.token || '%'
         OR coalesce(n.action_href, '') ILIKE '%' || t.token || '%'
   );
"@

Invoke-DbStep -Database 'omni_user' -Description '清理后计数' -Sql @"
WITH target_token AS (SELECT unnest($identifierTokensSql) AS token)
SELECT 'remaining_exception_task', count(*) FROM exception_task e
WHERE EXISTS (
    SELECT 1 FROM target_token t
    WHERE coalesce(e.business_no, '') ILIKE '%' || t.token || '%'
       OR coalesce(e.order_no, '') ILIKE '%' || t.token || '%'
       OR coalesce(e.payment_no, '') ILIKE '%' || t.token || '%'
       OR coalesce(e.refund_no, '') ILIKE '%' || t.token || '%'
       OR coalesce(e.ticket_no, '') ILIKE '%' || t.token || '%'
)
UNION ALL
SELECT 'remaining_reconciliation_detail', count(*) FROM reconciliation_detail rd
WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(rd.business_no, '') ILIKE '%' || t.token || '%')
UNION ALL
SELECT 'remaining_reconciliation_difference', count(*) FROM reconciliation_difference rdiff
WHERE EXISTS (SELECT 1 FROM target_token t WHERE coalesce(rdiff.business_no, '') ILIKE '%' || t.token || '%')
UNION ALL
SELECT 'remaining_support_conversation', count(*) FROM support_conversation c
WHERE EXISTS (
    SELECT 1 FROM target_token t
    WHERE coalesce(c.subject, '') ILIKE '%' || t.token || '%'
       OR coalesce(c.last_message, '') ILIKE '%' || t.token || '%'
);
"@

Write-Host ""
Write-Host 'seed 伪交易全面清理脚本执行完成。' -ForegroundColor Green
