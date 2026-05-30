$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

$sqlFile = Join-Path -Path $repoRoot -ChildPath "sql/local/20260520_move_tables_to_service_schemas_local_only.sql"
$sharedOrderSnapshotSqlFile = Join-Path -Path $repoRoot -ChildPath "sql/migrations/shared/20260520_order_snapshot.sql"
$sharedMigrationRoot = Join-Path -Path $repoRoot -ChildPath "sql/migrations/shared"
$initSqlFile = Join-Path -Path $repoRoot -ChildPath "sql/init.sql"
if (-not (Test-Path -LiteralPath $sqlFile)) {
    Write-Host "FAIL missing local schema move SQL: $sqlFile"
    exit 1
}
if (-not (Test-Path -LiteralPath $sharedOrderSnapshotSqlFile)) {
    Write-Host "FAIL missing shared order snapshot SQL: $sharedOrderSnapshotSqlFile"
    exit 1
}
if (-not (Test-Path -LiteralPath $sharedMigrationRoot)) {
    Write-Host "FAIL missing shared migration root: $sharedMigrationRoot"
    exit 1
}
if (-not (Test-Path -LiteralPath $initSqlFile)) {
    Write-Host "FAIL missing init SQL: $initSqlFile"
    exit 1
}

$content = Get-Content -Raw -LiteralPath $sqlFile
$sharedOrderSnapshotContent = Get-Content -Raw -LiteralPath $sharedOrderSnapshotSqlFile
$sharedMigrationContent = ((Get-ChildItem -Path $sharedMigrationRoot -Filter "*.sql" | Sort-Object Name | ForEach-Object {
    Get-Content -Raw -LiteralPath $_.FullName
}) -join "`n")
$initContent = Get-Content -Raw -LiteralPath $initSqlFile

$requiredPhrases = @(
    "disposable database",
    "staging / production",
    "20260520_drop_cross_owner_fks_local_only.sql",
    "CREATE SCHEMA IF NOT EXISTS user_service",
    "CREATE SCHEMA IF NOT EXISTS ticket_service",
    "CREATE SCHEMA IF NOT EXISTS order_service",
    "CREATE SCHEMA IF NOT EXISTS payment_service",
    "CREATE SCHEMA IF NOT EXISTS notification_service",
    "CREATE SCHEMA IF NOT EXISTS grab_service",
    "CREATE TABLE IF NOT EXISTS order_service.order_snapshot",
    'REFERENCES order_service."order"',
    "ALTER TABLE IF EXISTS grab_request SET SCHEMA grab_service",
    "ALTER TABLE IF EXISTS ticket_team SET SCHEMA grab_service",
    "ALTER TABLE IF EXISTS ticket_team_member SET SCHEMA grab_service",
    "ALTER TABLE IF EXISTS team_grab_request SET SCHEMA grab_service",
    "ALTER TABLE IF EXISTS team_seat_assignment SET SCHEMA grab_service"
)

foreach ($phrase in $requiredPhrases) {
    if ($content -notlike "*$phrase*") {
        Write-Host "FAIL local schema SQL missing required phrase: $phrase"
        exit 1
    }
}

if ($sharedOrderSnapshotContent -notmatch "ALTER\s+TABLE\s+IF\s+EXISTS\s+order_seat\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+seat_label\s+VARCHAR\(128\)") {
    Write-Host "FAIL shared order snapshot SQL missing idempotent order_seat.seat_label migration"
    exit 1
}

if ($sharedOrderSnapshotContent -match "(?is)\bJOIN\s+session_seat\b") {
    Write-Host "FAIL shared order snapshot SQL must not read seat labels from session_seat"
    exit 1
}

$requiredInitPatterns = @(
    @{ Name = "session_seat.lock_request_id"; Pattern = "(?is)CREATE\s+TABLE\s+session_seat\s*\([^;]*lock_request_id\s+VARCHAR\s*\(\s*64\s*\)" },
    @{ Name = "grab_request table"; Pattern = "(?is)CREATE\s+TABLE\s+grab_request\s*\([^;]*request_type\s+VARCHAR\s*\(\s*32\s*\)[^;]*progress_status\s+VARCHAR\s*\(\s*32\s*\)" },
    @{ Name = "ticket_team table"; Pattern = "(?is)CREATE\s+TABLE\s+ticket_team\s*\([^;]*invite_code\s+VARCHAR\s*\(\s*32\s*\)[^;]*leader_user_id\s+BIGINT" },
    @{ Name = "ticket_team_member table"; Pattern = "(?is)CREATE\s+TABLE\s+ticket_team_member\s*\([^;]*team_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+ticket_team\s*\(\s*id\s*\)" },
    @{ Name = "team_grab_request table"; Pattern = "(?is)CREATE\s+TABLE\s+team_grab_request\s*\([^;]*grab_request_id\s+VARCHAR\s*\(\s*64\s*\)[^;]*quantity\s+INTEGER\s+NOT\s+NULL" },
    @{ Name = "team_seat_assignment table"; Pattern = "(?is)CREATE\s+TABLE\s+team_seat_assignment\s*\([^;]*order_seat_id\s+BIGINT\s+NOT\s+NULL[^;]*seat_label\s+VARCHAR\s*\(\s*128\s*\)" },
    @{ Name = "team active request index"; Pattern = "(?is)CREATE\s+UNIQUE\s+INDEX\s+uk_team_grab_request_active_team\s+ON\s+team_grab_request\s*\(\s*team_id\s*\)\s+WHERE\s+status\s+IN\s*\(\s*'PENDING'\s*,\s*'GRABBING'\s*,\s*'LOCKED'\s*,\s*'ORDER_CREATED'\s*\)" },
    @{ Name = "session_seat lock request index"; Pattern = "(?is)CREATE\s+INDEX\s+idx_session_seat_lock_request\s+ON\s+session_seat\s*\(\s*lock_request_id\s*\)\s+WHERE\s+lock_request_id\s+IS\s+NOT\s+NULL" }
)

foreach ($required in $requiredInitPatterns) {
    if ($initContent -notmatch $required.Pattern) {
        Write-Host "FAIL init SQL missing required team grab item: $($required.Name)"
        exit 1
    }
}

$requiredSharedTeamGrabPatterns = @(
    @{ Name = "session_seat.lock_request_id"; Pattern = "(?is)ALTER\s+TABLE\s+session_seat\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+lock_request_id\s+VARCHAR\s*\(\s*64\s*\)" },
    @{ Name = "session_seat.seat_block_id"; Pattern = "(?is)ALTER\s+TABLE\s+session_seat\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+seat_block_id\s+BIGINT" },
    @{ Name = "grab_request table"; Pattern = "(?is)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+grab_request\s*\([^;]*request_type\s+VARCHAR\s*\(\s*32\s*\)[^;]*progress_status\s+VARCHAR\s*\(\s*32\s*\)" },
    @{ Name = "ticket_team table"; Pattern = "(?is)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+ticket_team\s*\([^;]*invite_code\s+VARCHAR\s*\(\s*32\s*\)[^;]*leader_user_id\s+BIGINT" },
    @{ Name = "ticket_team_member table"; Pattern = "(?is)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+ticket_team_member\s*\([^;]*team_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+ticket_team\s*\(\s*id\s*\)" },
    @{ Name = "team_grab_request table"; Pattern = "(?is)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+team_grab_request\s*\([^;]*grab_request_id\s+VARCHAR\s*\(\s*64\s*\)[^;]*quantity\s+INTEGER\s+NOT\s+NULL" },
    @{ Name = "team_seat_assignment table"; Pattern = "(?is)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+team_seat_assignment\s*\([^;]*order_seat_id\s+BIGINT\s+NOT\s+NULL[^;]*seat_label\s+VARCHAR\s*\(\s*128\s*\)" },
    @{ Name = "grab_request progress index"; Pattern = "(?is)CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_grab_request_progress_expire_time\s+ON\s+grab_request\s*\(\s*progress_status\s*,\s*expire_time\s*\)" },
    @{ Name = "team member active session index"; Pattern = "(?is)CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uk_ticket_team_member_active_session\s+ON\s+ticket_team_member\s*\(\s*user_id\s*,\s*session_id\s*\)\s+WHERE\s+status\s+IN\s*\(\s*'JOINED'\s*,\s*'CONFIRMED'\s*\)" },
    @{ Name = "team active request index"; Pattern = "(?is)CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uk_team_grab_request_active_team\s+ON\s+team_grab_request\s*\(\s*team_id\s*\)\s+WHERE\s+status\s+IN\s*\(\s*'PENDING'\s*,\s*'GRABBING'\s*,\s*'LOCKED'\s*,\s*'ORDER_CREATED'\s*\)" },
    @{ Name = "team grab request unique index"; Pattern = "(?is)CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uk_team_grab_request_grab_request_id\s+ON\s+team_grab_request\s*\(\s*grab_request_id\s*\)" },
    @{ Name = "session_seat lock request index"; Pattern = "(?is)CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_session_seat_lock_request\s+ON\s+session_seat\s*\(\s*lock_request_id\s*\)\s+WHERE\s+lock_request_id\s+IS\s+NOT\s+NULL" },
    @{ Name = "session_seat team lock lookup index"; Pattern = "(?is)CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_session_seat_team_lock_lookup\s+ON\s+session_seat\s*\(\s*session_id\s*,\s*ticket_type_id\s*,\s*status\s*,\s*seat_block_id\s*,\s*\(CASE\s+WHEN\s+seat_block_id\s+IS\s+NULL\s+THEN\s+layout_section_id\s+END\)\s*,\s*row_no\s*,\s*seat_no\s*,\s*id\s*\)\s+WHERE\s+order_id\s+IS\s+NULL\s+AND\s+lock_expire_time\s+IS\s+NULL" }
)

foreach ($required in $requiredSharedTeamGrabPatterns) {
    if ($sharedMigrationContent -notmatch $required.Pattern) {
        Write-Host "FAIL shared migration SQL missing required team grab item: $($required.Name)"
        exit 1
    }
}

$hasSharedSeatSelectionInsert = $sharedOrderSnapshotContent -match "(?is)seat_selection_mode.*case.*has_order_seats.*'EXPLICIT'"
$hasSharedSeatSelectionUpdate = $sharedOrderSnapshotContent -match "(?is)UPDATE\s+order_snapshot\s+\w+\s+SET\s+seat_selection_mode\s*=\s*CASE"
$hasSharedOrderSeatInference = $sharedOrderSnapshotContent -match "(?is)EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+order_seat"
if (-not $hasSharedSeatSelectionInsert -or -not $hasSharedSeatSelectionUpdate -or -not $hasSharedOrderSeatInference) {
    Write-Host "FAIL shared order snapshot SQL must backfill seat_selection_mode from team_order and order_seat"
    exit 1
}

$forbiddenPatterns = @(
    "DROP\s+TABLE",
    "DROP\s+COLUMN",
    "TRUNCATE\s+TABLE",
    "DELETE\s+FROM",
    "UPDATE\s+",
    "INSERT\s+INTO",
    "ALTER\s+TABLE\s+.*DROP\s+CONSTRAINT"
)

foreach ($pattern in $forbiddenPatterns) {
    if ($content -match $pattern) {
        Write-Host "FAIL local schema SQL contains forbidden pattern: $pattern"
        exit 1
    }
}

Write-Host "PASS local schema move SQL safety check"
