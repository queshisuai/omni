param(
    [switch]$IUnderstandThisIsLocalOnly,
    [string]$Database = "omni_ticket",
    [string]$User = "postgres",
    [string]$HostName = "localhost",
    [int]$Port = 5432
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $IUnderstandThisIsLocalOnly) {
    Write-Host "Refusing to run. This script is local-only and requires -IUnderstandThisIsLocalOnly."
    exit 1
}

if ($env:OMNI_ALLOW_LOCAL_SCHEMA_ISOLATION -ne "true") {
    Write-Host "Refusing to run. Set OMNI_ALLOW_LOCAL_SCHEMA_ISOLATION=true to confirm this is a disposable local database."
    exit 1
}

if ($HostName -notin @("localhost", "127.0.0.1")) {
    Write-Host "Refusing to run against non-local host: $HostName"
    exit 1
}

$dropFkSql = Join-Path -Path $repoRoot -ChildPath "sql/local/20260520_drop_cross_owner_fks_local_only.sql"
$moveSql = Join-Path -Path $repoRoot -ChildPath "sql/local/20260520_move_tables_to_service_schemas_local_only.sql"

powershell -ExecutionPolicy Bypass -File (Join-Path -Path $repoRoot -ChildPath "scripts/check-local-schema-sql.ps1")

Write-Host "Applying local-only cross-owner FK drop candidate..."
psql -h $HostName -p $Port -U $User -d $Database -f $dropFkSql

Write-Host "Applying local-only service schema move candidate..."
psql -h $HostName -p $Port -U $User -d $Database -f $moveSql

Write-Host "Local schema isolation SQL applied. Run scripts/verify-microservice-boundaries.ps1 and start services with local-schema profile."
