param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactDir,

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

    [string]$DbUser = "postgres",

    [string]$TargetDatabaseByService = ""
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return (Join-Path -Path $repoRoot -ChildPath $Path)
}

function Assert-FileExists {
    param(
        [string]$Path,
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing $Description`: $Path"
    }
}

function Assert-NonEmptyFile {
    param(
        [string]$Path,
        [string]$Description
    )

    Assert-FileExists -Path $Path -Description $Description

    $item = Get-Item -LiteralPath $Path
    if ($item.Length -eq 0) {
        throw "Empty $Description`: $Path"
    }
}

function Assert-SafeSqlFile {
    param(
        [string]$Path,
        [string]$Description
    )

    $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path
    $forbiddenPatterns = @(
        @{ Name = "DROP DATABASE"; Pattern = '(?is)\bDROP\s+DATABASE\b' },
        @{ Name = "DROP SCHEMA"; Pattern = '(?is)\bDROP\s+SCHEMA\b' },
        @{ Name = "ALTER SYSTEM"; Pattern = '(?is)\bALTER\s+SYSTEM\b' },
        @{ Name = "psql shell command"; Pattern = '(?m)^\s*\\!' },
        @{ Name = "psql include command"; Pattern = '(?m)^\s*\\i(?:r)?(?:\s|$)' },
        @{ Name = "COPY PROGRAM"; Pattern = '(?is)\bCOPY\b[\s\S]*?\bPROGRAM\b' },
        @{ Name = "TRUNCATE"; Pattern = '(?is)\bTRUNCATE\b' }
    )

    foreach ($forbidden in $forbiddenPatterns) {
        if ($content -match $forbidden.Pattern) {
            throw "Unsafe SQL in $Description`: forbidden $($forbidden.Name) in $Path"
        }
    }
}

function Assert-ArtifactRootMatchesManifest {
    param(
        [string]$Path,
        [hashtable]$ExpectedServiceKeys
    )

    $entries = Get-ChildItem -LiteralPath $Path
    foreach ($entry in $entries) {
        if ($entry.PSIsContainer) {
            if (-not $ExpectedServiceKeys.ContainsKey($entry.Name)) {
                throw "Unknown service artifact directory: $($entry.FullName)"
            }
            continue
        }

        throw "Unexpected file in artifact root: $($entry.FullName)"
    }
}

function Invoke-PsqlFile {
    param(
        [string]$HostName,
        [string]$DatabaseName,
        [string]$SqlFile
    )

    Write-Host "Importing $SqlFile into $DatabaseName on $HostName`:$Port"
    & psql --host=$HostName --port=$Port --username=$DbUser --dbname=$DatabaseName -v ON_ERROR_STOP=1 --file=$SqlFile
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed with exit code $LASTEXITCODE for $SqlFile"
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

function Get-TargetDatabaseMap {
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
            throw "Invalid TargetDatabaseByService entry '$entry'. Expected service=database"
        }

        $result[$parts[0].Trim()] = $parts[1].Trim()
    }

    return $result
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$splitRoot = Join-Path -Path $repoRoot -ChildPath "sql/production-split"
$manifestFile = Join-Path -Path $splitRoot -ChildPath "manifest.json"
$resolvedArtifactDir = Resolve-RepoPath -Path $ArtifactDir

Assert-FileExists -Path $manifestFile -Description "production split manifest"

if (-not (Test-Path -LiteralPath $resolvedArtifactDir -PathType Container)) {
    throw "Missing artifact directory: $resolvedArtifactDir"
}

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$targetDatabaseOverrides = Get-TargetDatabaseMap -Value $TargetDatabaseByService
$targetHosts = @{
    user = $UserHost
    ticket = $TicketHost
    order = $OrderHost
    payment = $PaymentHost
    notification = $NotificationHost
}
$expectedServiceKeys = @{}

foreach ($service in $manifest.services) {
    $serviceKey = [string]$service.key
    if (-not $serviceKey) {
        throw "Manifest contains a service without key"
    }
    if ($expectedServiceKeys.ContainsKey($serviceKey)) {
        throw "Duplicate service key in manifest: $serviceKey"
    }
    $expectedServiceKeys[$serviceKey] = $true
}

Assert-ArtifactRootMatchesManifest -Path $resolvedArtifactDir -ExpectedServiceKeys $expectedServiceKeys

$importPlan = @()

foreach ($service in $manifest.services) {
    $serviceKey = [string]$service.key
    $targetDatabase = [string]$service.targetDatabase
    $targetHost = $targetHosts[$serviceKey]

    if ($targetDatabaseOverrides.ContainsKey($serviceKey)) {
        $targetDatabase = $targetDatabaseOverrides[$serviceKey]
    }

    if (-not $targetHost) {
        throw "No target host parameter mapped for service key '$serviceKey'"
    }
    if (-not $targetDatabase) {
        throw "Manifest service '$serviceKey' is missing targetDatabase"
    }

    $serviceArtifactDir = Join-Path -Path $resolvedArtifactDir -ChildPath $serviceKey
    $preDataFile = Join-Path -Path $serviceArtifactDir -ChildPath "001_pre_data.sql"
    $dataFile = Join-Path -Path $serviceArtifactDir -ChildPath "002_data.sql"
    $postDataFile = Join-Path -Path $serviceArtifactDir -ChildPath "003_post_data.sql"
    $constraintFile = Join-Path -Path (Join-Path -Path $splitRoot -ChildPath $serviceKey) -ChildPath "001_same_owner_constraints.sql"

    if (-not (Test-Path -LiteralPath $serviceArtifactDir -PathType Container)) {
        throw "Missing service artifact directory for '$serviceKey': $serviceArtifactDir"
    }

    Assert-NonEmptyFile -Path $preDataFile -Description "$serviceKey pre-data artifact"
    Assert-NonEmptyFile -Path $dataFile -Description "$serviceKey data artifact"
    Assert-NonEmptyFile -Path $postDataFile -Description "$serviceKey post-data artifact"
    Assert-NonEmptyFile -Path $constraintFile -Description "$serviceKey same-owner constraints SQL"
    $sourceSchema = [string]$service.key + "_service"
    $preDataContent = Convert-SchemaQualification -Sql (Get-Content -Raw -Encoding UTF8 -LiteralPath $preDataFile) -FromSchema $sourceSchema -ToSchema 'public'
    $dataContent = Convert-SchemaQualification -Sql (Get-Content -Raw -Encoding UTF8 -LiteralPath $dataFile) -FromSchema $sourceSchema -ToSchema 'public'
    $postDataContent = Convert-SchemaQualification -Sql (Get-Content -Raw -Encoding UTF8 -LiteralPath $postDataFile) -FromSchema $sourceSchema -ToSchema 'public'
    Set-Content -LiteralPath $preDataFile -Value $preDataContent -Encoding UTF8
    Set-Content -LiteralPath $dataFile -Value $dataContent -Encoding UTF8
    Set-Content -LiteralPath $postDataFile -Value $postDataContent -Encoding UTF8

    Assert-SafeSqlFile -Path $preDataFile -Description "$serviceKey pre-data artifact"
    Assert-SafeSqlFile -Path $dataFile -Description "$serviceKey data artifact"
    Assert-SafeSqlFile -Path $postDataFile -Description "$serviceKey post-data artifact"
    Assert-SafeSqlFile -Path $constraintFile -Description "$serviceKey same-owner constraints SQL"

    $importPlan += [PSCustomObject]@{
        ServiceKey = $serviceKey
        TargetHost = $targetHost
        TargetDatabase = $targetDatabase
        PreDataFile = $preDataFile
        DataFile = $dataFile
        PostDataFile = $postDataFile
        ConstraintFile = $constraintFile
    }
}

Write-Host "PASS production split import preflight completed for $($importPlan.Count) services"

foreach ($item in $importPlan) {
    $serviceKey = $item.ServiceKey
    $targetHost = $item.TargetHost
    $targetDatabase = $item.TargetDatabase

    Write-Host "Starting import for $serviceKey -> $targetDatabase on $targetHost`:$Port"
    Invoke-PsqlFile -HostName $targetHost -DatabaseName $targetDatabase -SqlFile $item.PreDataFile
    Invoke-PsqlFile -HostName $targetHost -DatabaseName $targetDatabase -SqlFile $item.DataFile
    Invoke-PsqlFile -HostName $targetHost -DatabaseName $targetDatabase -SqlFile $item.PostDataFile
    Invoke-PsqlFile -HostName $targetHost -DatabaseName $targetDatabase -SqlFile $item.ConstraintFile
    Write-Host "Completed import for $serviceKey"
}

Write-Host "PASS production split import completed from $resolvedArtifactDir"
