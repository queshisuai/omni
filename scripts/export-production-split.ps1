param(
    [string]$SourceHost = "localhost",
    [int]$SourcePort = 5432,
    [string]$SourceDatabase = "omni_ticket",
    [string]$SourceUser = "postgres",
    # 默认面向生产共享库 public schema；本地 local-schema 预演可通过 SourceSchemaByService 覆盖。
    [string]$SourceSchema = "public",
    [string]$SourceSchemaByService = "",
    [string]$OutputSchema = "public",
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

    $result = New-Object System.Text.StringBuilder
    $statementPattern = '(?s).*?(?:;|\z)'
    foreach ($match in [regex]::Matches($Sql, $statementPattern)) {
        $statement = $match.Value
        if ($statement.Length -eq 0) {
            continue
        }

        $isForeignKeyConstraint = $statement -match '(?is)\bALTER\s+TABLE\s+' -and
            $statement -match '(?is)\bADD\s+CONSTRAINT\b' -and
            $statement -match '(?is)\bFOREIGN\s+KEY\b' -and
            $statement -match '(?is)\bREFERENCES\b'

        if (-not $isForeignKeyConstraint) {
            [void]$result.Append($statement)
        }
    }

    return $result.ToString()
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

function Convert-SchemaQualification {
    param(
        [string]$Sql,
        [string]$FromSchema,
        [string]$ToSchema
    )

    if (-not $FromSchema -or -not $ToSchema -or $FromSchema -eq $ToSchema) {
        return $Sql
    }

    $quotedFrom = [regex]::Escape('"' + $FromSchema.Replace('"', '""') + '"')
    $quotedTo = '"' + $ToSchema.Replace('"', '""') + '"'
    $bareFrom = [regex]::Escape($FromSchema)

    $converted = [regex]::Replace($Sql, $quotedFrom + '\s*\.', $quotedTo + '.', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $converted = [regex]::Replace($converted, '(?<![A-Za-z0-9_])' + $bareFrom + '\s*\.', $ToSchema + '.', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    return $converted
}

function Get-SourceSchemaMap {
    param([string]$Value)

    $result = @{}
    if (-not $Value) {
        return $result
    }

    foreach ($entry in ($Value -split ',')) {
        $trimmed = $entry.Trim()
        if (-not $trimmed) {
            continue
        }

        $parts = $trimmed -split '=', 2
        if ($parts.Count -ne 2 -or -not $parts[0].Trim() -or -not $parts[1].Trim()) {
            throw "Invalid SourceSchemaByService entry '$entry'. Expected service=schema"
        }

        $result[$parts[0].Trim()] = $parts[1].Trim()
    }

    return $result
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestFile = Join-Path -Path $repoRoot -ChildPath "sql/production-split/manifest.json"

if (-not (Test-Path -LiteralPath $manifestFile)) {
    throw "Missing production split manifest: $manifestFile"
}

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$resolvedOutputDir = Resolve-RepoPath -Path $OutputDir
$sourceSchemaMap = Get-SourceSchemaMap -Value $SourceSchemaByService

if (-not (Test-Path -LiteralPath $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir | Out-Null
}

foreach ($service in $manifest.services) {
    $serviceKey = [string]$service.key
    $schemaName = $SourceSchema
    if ($sourceSchemaMap.ContainsKey($serviceKey)) {
        $schemaName = $sourceSchemaMap[$serviceKey]
    }

    $serviceDir = Join-Path -Path $resolvedOutputDir -ChildPath $service.key
    if (-not (Test-Path -LiteralPath $serviceDir)) {
        New-Item -ItemType Directory -Path $serviceDir | Out-Null
    }

    $tableArguments = @()
    foreach ($table in $service.tables) {
        $tableArguments += (New-PgDumpTableArgument -SchemaName $schemaName -TableName $table)
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
    $postDataFile = Join-Path -Path $serviceDir -ChildPath "003_post_data.sql"
    $tempPreDataFile = Join-Path -Path $serviceDir -ChildPath "001_pre_data.sql.tmp"
    $tempPostDataFile = Join-Path -Path $serviceDir -ChildPath "003_post_data.sql.tmp"

    try {
        Invoke-PgDump -Arguments ($commonArguments + "--section=pre-data") -OutputFile $tempPreDataFile
        $preDataSql = Get-Content -Raw -Encoding UTF8 -LiteralPath $tempPreDataFile
        $filteredPreDataSql = Remove-ForeignKeyStatements -Sql $preDataSql
        $filteredPreDataSql = Convert-SchemaQualification -Sql $filteredPreDataSql -FromSchema $schemaName -ToSchema $OutputSchema
        if ($filteredPreDataSql -match '(?i)\bFOREIGN\s+KEY\b|\bREFERENCES\b') {
            throw "Filtered pre-data still contains FOREIGN KEY or REFERENCES for service '$($service.key)'"
        }
        Set-Content -LiteralPath $preDataFile -Value $filteredPreDataSql -Encoding UTF8

        Invoke-PgDump -Arguments ($commonArguments + "--data-only" + "--column-inserts" + "--disable-triggers") -OutputFile $dataFile
        $dataSql = Get-Content -Raw -Encoding UTF8 -LiteralPath $dataFile
        $dataSql = Convert-SchemaQualification -Sql $dataSql -FromSchema $schemaName -ToSchema $OutputSchema
        Set-Content -LiteralPath $dataFile -Value $dataSql -Encoding UTF8

        Invoke-PgDump -Arguments ($commonArguments + "--section=post-data") -OutputFile $tempPostDataFile
        $postDataSql = Get-Content -Raw -Encoding UTF8 -LiteralPath $tempPostDataFile
        $filteredPostDataSql = Remove-ForeignKeyStatements -Sql $postDataSql
        $filteredPostDataSql = Convert-SchemaQualification -Sql $filteredPostDataSql -FromSchema $schemaName -ToSchema $OutputSchema
        if ($filteredPostDataSql -match '(?i)\bFOREIGN\s+KEY\b|\bREFERENCES\b') {
            throw "Filtered post-data still contains FOREIGN KEY or REFERENCES for service '$($service.key)'"
        }
        Set-Content -LiteralPath $postDataFile -Value $filteredPostDataSql -Encoding UTF8
        Write-Host "Exported $($service.key) from schema $schemaName to $serviceDir"
    }
    finally {
        if (Test-Path -LiteralPath $tempPreDataFile) {
            Remove-Item -LiteralPath $tempPreDataFile -Force
        }
        if (Test-Path -LiteralPath $tempPostDataFile) {
            Remove-Item -LiteralPath $tempPostDataFile -Force
        }
    }
}

Write-Host "PASS production split export artifacts written to $resolvedOutputDir"
