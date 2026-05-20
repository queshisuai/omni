param(
    [Parameter(Mandatory = $true)]
    [string]$UserHost,

    [Parameter(Mandatory = $true)]
    [string]$TicketHost,

    [Parameter(Mandatory = $true)]
    [string]$OrderHost,

    [Parameter(Mandatory = $true)]
    [string]$PaymentHost,

    [Parameter(Mandatory = $true)]
    [string]$NotificationHost,

    [int]$Port = 5432,

    [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Stop"

function Assert-FileExists {
    param(
        [string]$Path,
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing $Description`: $Path"
    }
}

function Invoke-PsqlScalar {
    param(
        [string]$HostName,
        [string]$DatabaseName,
        [string]$Sql,
        [string]$Description
    )

    $arguments = @(
        "--host=$HostName",
        "--port=$Port",
        "--username=$DbUser",
        "--dbname=$DatabaseName",
        "--no-password",
        "-v", "ON_ERROR_STOP=1",
        "--tuples-only",
        "--no-align",
        "--quiet",
        "--command=$Sql"
    )

    $output = & psql @arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        $message = ($output | Out-String).Trim()
        if (-not $message) {
            $message = "psql exited without output"
        }
        throw "psql failed during $Description for $DatabaseName on $HostName`:$Port with exit code $LASTEXITCODE`: $message"
    }

    return (($output | Out-String).Trim())
}

function New-TableOwnerMap {
    param([object]$Manifest)

    $tableOwner = @{}
    foreach ($service in $Manifest.services) {
        $serviceKey = [string]$service.key
        if (-not $serviceKey) {
            throw "Manifest contains a service without key"
        }

        foreach ($table in $service.tables) {
            $tableName = [string]$table
            if (-not $tableName) {
                throw "Manifest service '$serviceKey' contains an empty table name"
            }

            $normalized = $tableName.ToLowerInvariant()
            if ($tableOwner.ContainsKey($normalized)) {
                throw "Table assigned to multiple services in manifest: $tableName"
            }
            $tableOwner[$normalized] = $serviceKey
        }
    }

    return $tableOwner
}

function Assert-ServiceForeignKeys {
    param(
        [object]$Service,
        [string]$HostName,
        [hashtable]$TableOwner
    )

    $serviceKey = [string]$Service.key
    $targetDatabase = [string]$Service.targetDatabase
    if (-not $serviceKey) {
        throw "Manifest contains a service without key"
    }
    if (-not $targetDatabase) {
        throw "Manifest service '$serviceKey' is missing targetDatabase"
    }
    if (-not $HostName) {
        throw "No target host parameter mapped for service key '$serviceKey'"
    }

    Write-Host "Checking connectivity for $serviceKey -> $targetDatabase on $HostName`:$Port"
    $connectivity = Invoke-PsqlScalar -HostName $HostName -DatabaseName $targetDatabase -Sql "SELECT 1;" -Description "connectivity check"
    if ($connectivity -ne "1") {
        throw "Unexpected connectivity check result for $serviceKey on $HostName`:$Port/$targetDatabase`: $connectivity"
    }

    $fkQuery = @"
SELECT COALESCE(json_agg(row_to_json(fk_rows))::text, '[]')
FROM (
    SELECT
        con.conname AS constraint_name,
        child_ns.nspname AS child_schema,
        child.relname AS child_table,
        ref_ns.nspname AS ref_schema,
        ref.relname AS ref_table
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE con.contype = 'f'
      AND child_ns.nspname NOT IN ('pg_catalog', 'information_schema')
      AND ref_ns.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY child_ns.nspname, child.relname, con.conname
) fk_rows;
"@

    $fkJson = Invoke-PsqlScalar -HostName $HostName -DatabaseName $targetDatabase -Sql $fkQuery -Description "foreign key inspection"
    $foreignKeys = @($fkJson | ConvertFrom-Json)

    foreach ($foreignKey in $foreignKeys) {
        $childTable = [string]$foreignKey.child_table
        $refTable = [string]$foreignKey.ref_table
        $constraintName = [string]$foreignKey.constraint_name
        $childKey = $childTable.ToLowerInvariant()
        $refKey = $refTable.ToLowerInvariant()
        $childOwner = $TableOwner[$childKey]
        $refOwner = $TableOwner[$refKey]

        if (-not $childOwner) {
            throw "Unknown FK child table '$($foreignKey.child_schema).$childTable' in $serviceKey database '$targetDatabase' constraint '$constraintName'"
        }
        if (-not $refOwner) {
            throw "Unknown FK referenced table '$($foreignKey.ref_schema).$refTable' in $serviceKey database '$targetDatabase' constraint '$constraintName'"
        }
        if ($childOwner -ne $serviceKey) {
            throw "Cross-owner FK child table in $serviceKey database '$targetDatabase': constraint '$constraintName' is on '$childTable' owned by '$childOwner'"
        }
        if ($refOwner -ne $serviceKey) {
            throw "Cross-owner FK reference in $serviceKey database '$targetDatabase': constraint '$constraintName' references '$refTable' owned by '$refOwner'"
        }
    }

    Write-Host "PASS $serviceKey runtime FK check ($($foreignKeys.Count) foreign keys)"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestFile = Join-Path -Path $repoRoot -ChildPath "sql/production-split/manifest.json"

Assert-FileExists -Path $manifestFile -Description "production split manifest"

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$tableOwner = New-TableOwnerMap -Manifest $manifest
$targetHosts = @{
    user = $UserHost
    ticket = $TicketHost
    order = $OrderHost
    payment = $PaymentHost
    notification = $NotificationHost
}

foreach ($service in $manifest.services) {
    $serviceKey = [string]$service.key
    Assert-ServiceForeignKeys -Service $service -HostName $targetHosts[$serviceKey] -TableOwner $tableOwner
}

Write-Host "PASS production split runtime verification completed"
