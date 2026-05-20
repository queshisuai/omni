$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$splitRoot = Join-Path -Path $repoRoot -ChildPath "sql/production-split"
$manifestFile = Join-Path -Path $splitRoot -ChildPath "manifest.json"

if (-not (Test-Path -LiteralPath $manifestFile)) {
    Write-Host "FAIL missing production split manifest: $manifestFile"
    exit 1
}

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$expectedKeys = @("user", "ticket", "order", "payment", "notification")

foreach ($key in $expectedKeys) {
    $dir = Join-Path -Path $splitRoot -ChildPath $key
    if (-not (Test-Path -LiteralPath $dir)) {
        Write-Host "FAIL missing production split directory: $dir"
        exit 1
    }
}

$tableOwner = @{}
foreach ($service in $manifest.services) {
    foreach ($table in $service.tables) {
        $normalized = $table.ToLower()
        if ($tableOwner.ContainsKey($normalized)) {
            Write-Host "FAIL table assigned to multiple services: $table"
            exit 1
        }
        $tableOwner[$normalized] = $service.key
    }
}

$sqlFiles = Get-ChildItem -Path $splitRoot -Filter "*.sql" -Recurse | Sort-Object FullName
if ($sqlFiles.Count -eq 0) {
    Write-Host "FAIL no production split SQL files found"
    exit 1
}

$forbiddenText = @(
    "sql/local/",
    "20260520_drop_cross_owner_fks_local_only.sql",
    "20260520_move_tables_to_service_schemas_local_only.sql",
    "DROP DATABASE",
    "DROP SCHEMA"
)

foreach ($file in $sqlFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    if ($content -notmatch '(?m)^-- owner: java-(user|ticket|order|payment|notification)') {
        Write-Host "FAIL SQL file missing owner comment: $($file.FullName)"
        exit 1
    }
    foreach ($text in $forbiddenText) {
        if ($content -like "*$text*") {
            Write-Host "FAIL SQL file contains forbidden text '$text': $($file.FullName)"
            exit 1
        }
    }
}

$constraintNames = @{}
$constraintPattern = 'ADD\s+CONSTRAINT\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))'
foreach ($file in $sqlFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    foreach ($match in [regex]::Matches($content, $constraintPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $constraintName = $match.Groups[1].Value
        if (-not $constraintName) {
            $constraintName = $match.Groups[2].Value
        }
        $normalized = $constraintName.ToLower()
        $lineNumber = 1 + ($content.Substring(0, $match.Index).Split("`n").Count - 1)
        if ($constraintNames.ContainsKey($normalized)) {
            Write-Host "FAIL duplicate constraint name '$constraintName' in $($file.FullName):$lineNumber; first seen at $($constraintNames[$normalized])"
            exit 1
        }
        $constraintNames[$normalized] = "$($file.FullName):$lineNumber"
    }
}

$identifierPattern = '(?:(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))'
$fkPattern = 'ALTER\s+TABLE\s+' + $identifierPattern + '\s+ADD\s+CONSTRAINT\s+(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s+FOREIGN\s+KEY\s*\([\s\S]*?\)\s+REFERENCES\s+' + $identifierPattern + '\s*\('
foreach ($file in $sqlFiles) {
    $serviceKey = Split-Path -Leaf (Split-Path -Parent $file.FullName)
    $content = Get-Content -Raw -LiteralPath $file.FullName
    foreach ($match in [regex]::Matches($content, $fkPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $child = $match.Groups[1].Value
        if (-not $child) {
            $child = $match.Groups[2].Value
        }
        $referenced = $match.Groups[3].Value
        if (-not $referenced) {
            $referenced = $match.Groups[4].Value
        }
        $child = $child.ToLower()
        $referenced = $referenced.ToLower()
        $childOwner = $tableOwner[$child]
        $owner = $tableOwner[$referenced]
        $lineNumber = 1 + ($content.Substring(0, $match.Index).Split("`n").Count - 1)
        if (-not $childOwner) {
            Write-Host "FAIL FK alters unowned table '$child' in $($file.FullName):$lineNumber"
            exit 1
        }
        if ($childOwner -ne $serviceKey) {
            Write-Host "FAIL cross-owner ALTER TABLE in production split SQL: $($file.FullName):$lineNumber alters $child owned by $childOwner"
            exit 1
        }
        if (-not $owner) {
            Write-Host "FAIL FK references unowned table '$referenced' in $($file.FullName):$lineNumber"
            exit 1
        }
        if ($owner -ne $serviceKey) {
            Write-Host "FAIL cross-owner FK in production split SQL: $($file.FullName):$lineNumber references $referenced owned by $owner"
            exit 1
        }
    }
}

Write-Host "PASS production split SQL safety check"
