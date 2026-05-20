param(
    [string]$SourceHost = "localhost",
    [int]$SourcePort = 5432,
    [string]$SourceDatabase = "omni_ticket",
    [string]$SourceUser = "postgres",
    [string]$SourceSchema = "public",
    [string]$OutputDir = "artifacts/production-split"
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return (Join-Path -Path $repoRoot -ChildPath $Path)
}

function Quote-PgIdentifier {
    param([string]$Identifier)

    return '"' + $Identifier.Replace('"', '""') + '"'
}

function New-PgDumpTableArgument {
    param(
        [string]$SchemaName,
        [string]$TableName
    )

    return '--table=' + (Quote-PgIdentifier -Identifier $SchemaName) + '.' + (Quote-PgIdentifier -Identifier $TableName)
}

function Remove-ForeignKeyStatements {
    param([string]$Sql)

    $pattern = '(?ims)^ALTER\s+TABLE\s+ONLY\s+.*?\s+ADD\s+CONSTRAINT\s+.*?\s+FOREIGN\s+KEY\s*\(.*?\)\s+REFERENCES\s+.*?;\s*'
    return [regex]::Replace($Sql, $pattern, '')
}

function Invoke-PgDump {
    param(
        [string[]]$Arguments,
        [string]$OutputFile
    )

    & pg_dump @Arguments --file=$OutputFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestFile = Join-Path -Path $repoRoot -ChildPath "sql/production-split/manifest.json"

if (-not (Test-Path -LiteralPath $manifestFile)) {
    throw "Missing production split manifest: $manifestFile"
}

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$resolvedOutputDir = Resolve-RepoPath -Path $OutputDir

if (-not (Test-Path -LiteralPath $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir | Out-Null
}

foreach ($service in $manifest.services) {
    $serviceDir = Join-Path -Path $resolvedOutputDir -ChildPath $service.key
    if (-not (Test-Path -LiteralPath $serviceDir)) {
        New-Item -ItemType Directory -Path $serviceDir | Out-Null
    }

    $tableArguments = @()
    foreach ($table in $service.tables) {
        $tableArguments += (New-PgDumpTableArgument -SchemaName $SourceSchema -TableName $table)
    }

    $commonArguments = @(
        "--host=$SourceHost",
        "--port=$SourcePort",
        "--username=$SourceUser",
        "--dbname=$SourceDatabase",
        "--no-owner",
        "--no-privileges"
    ) + $tableArguments

    $preDataFile = Join-Path -Path $serviceDir -ChildPath "001_pre_data.sql"
    $dataFile = Join-Path -Path $serviceDir -ChildPath "002_data.sql"
    $tempPreDataFile = Join-Path -Path $serviceDir -ChildPath "001_pre_data.sql.tmp"

    try {
        Invoke-PgDump -Arguments ($commonArguments + "--section=pre-data") -OutputFile $tempPreDataFile
        $preDataSql = Get-Content -Raw -LiteralPath $tempPreDataFile
        $filteredPreDataSql = Remove-ForeignKeyStatements -Sql $preDataSql
        if ($filteredPreDataSql -match '(?i)\bFOREIGN\s+KEY\b|\bREFERENCES\b') {
            throw "Filtered pre-data still contains FOREIGN KEY or REFERENCES for service '$($service.key)'"
        }
        Set-Content -LiteralPath $preDataFile -Value $filteredPreDataSql -Encoding UTF8

        Invoke-PgDump -Arguments ($commonArguments + "--data-only") -OutputFile $dataFile
        Write-Host "Exported $($service.key) to $serviceDir"
    }
    finally {
        if (Test-Path -LiteralPath $tempPreDataFile) {
            Remove-Item -LiteralPath $tempPreDataFile -Force
        }
    }
}

Write-Host "Production split export completed: $resolvedOutputDir"
