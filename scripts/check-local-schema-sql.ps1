$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

$sqlFile = Join-Path -Path $repoRoot -ChildPath "sql/local/20260520_move_tables_to_service_schemas_local_only.sql"
if (-not (Test-Path -LiteralPath $sqlFile)) {
    Write-Host "FAIL missing local schema move SQL: $sqlFile"
    exit 1
}

$content = Get-Content -Raw -LiteralPath $sqlFile

$requiredPhrases = @(
    "disposable database",
    "staging / production",
    "20260520_drop_cross_owner_fks_local_only.sql",
    "CREATE SCHEMA IF NOT EXISTS user_service",
    "CREATE SCHEMA IF NOT EXISTS ticket_service",
    "CREATE SCHEMA IF NOT EXISTS order_service",
    "CREATE SCHEMA IF NOT EXISTS payment_service",
    "CREATE SCHEMA IF NOT EXISTS notification_service",
    "CREATE TABLE IF NOT EXISTS order_service.order_snapshot",
    'REFERENCES order_service."order"'
)

foreach ($phrase in $requiredPhrases) {
    if ($content -notlike "*$phrase*") {
        Write-Host "FAIL local schema SQL missing required phrase: $phrase"
        exit 1
    }
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
