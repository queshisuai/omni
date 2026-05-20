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

    [string]$DbUser = "postgres"
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

$repoRoot = Split-Path -Parent $PSScriptRoot
$splitRoot = Join-Path -Path $repoRoot -ChildPath "sql/production-split"
$manifestFile = Join-Path -Path $splitRoot -ChildPath "manifest.json"
$resolvedArtifactDir = Resolve-RepoPath -Path $ArtifactDir

Assert-FileExists -Path $manifestFile -Description "production split manifest"

if (-not (Test-Path -LiteralPath $resolvedArtifactDir -PathType Container)) {
    throw "Missing artifact directory: $resolvedArtifactDir"
}

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$targetHosts = @{
    user = $UserHost
    ticket = $TicketHost
    order = $OrderHost
    payment = $PaymentHost
    notification = $NotificationHost
}

foreach ($service in $manifest.services) {
    $serviceKey = [string]$service.key
    $targetDatabase = [string]$service.targetDatabase
    $targetHost = $targetHosts[$serviceKey]

    if (-not $targetHost) {
        throw "No target host parameter mapped for service key '$serviceKey'"
    }
    if (-not $targetDatabase) {
        throw "Manifest service '$serviceKey' is missing targetDatabase"
    }

    $serviceArtifactDir = Join-Path -Path $resolvedArtifactDir -ChildPath $serviceKey
    $preDataFile = Join-Path -Path $serviceArtifactDir -ChildPath "001_pre_data.sql"
    $dataFile = Join-Path -Path $serviceArtifactDir -ChildPath "002_data.sql"
    $constraintFile = Join-Path -Path (Join-Path -Path $splitRoot -ChildPath $serviceKey) -ChildPath "001_same_owner_constraints.sql"

    if (-not (Test-Path -LiteralPath $serviceArtifactDir -PathType Container)) {
        throw "Missing service artifact directory for '$serviceKey': $serviceArtifactDir"
    }

    Assert-FileExists -Path $preDataFile -Description "$serviceKey pre-data artifact"
    Assert-FileExists -Path $dataFile -Description "$serviceKey data artifact"
    Assert-FileExists -Path $constraintFile -Description "$serviceKey same-owner constraints SQL"

    Write-Host "Starting import for $serviceKey -> $targetDatabase on $targetHost`:$Port"
    Invoke-PsqlFile -HostName $targetHost -DatabaseName $targetDatabase -SqlFile $preDataFile
    Invoke-PsqlFile -HostName $targetHost -DatabaseName $targetDatabase -SqlFile $dataFile
    Invoke-PsqlFile -HostName $targetHost -DatabaseName $targetDatabase -SqlFile $constraintFile
    Write-Host "Completed import for $serviceKey"
}

Write-Host "PASS production split import completed from $resolvedArtifactDir"
