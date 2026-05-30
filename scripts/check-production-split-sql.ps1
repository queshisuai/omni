$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$splitRoot = Join-Path -Path $repoRoot -ChildPath "sql/production-split"
$manifestFile = Join-Path -Path $splitRoot -ChildPath "manifest.json"

if (-not (Test-Path -LiteralPath $manifestFile)) {
    Write-Host "FAIL missing production split manifest: $manifestFile"
    exit 1
}

$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$expectedKeys = @("user", "ticket", "order", "payment", "notification", "grab")

function New-ColumnSet([string[]] $columns) {
    $set = @{}
    foreach ($column in $columns) {
        $set[$column.ToLower()] = $true
    }
    return $set
}

function Normalize-Identifier([string] $identifier) {
    $value = $identifier.Trim()
    if ($value.Contains('.')) {
        $value = ($value -split '\.')[-1]
    }
    return $value.Trim('"').ToLower()
}

function Get-IdentifierFromMatch($match, [int] $quotedGroup, [int] $bareGroup) {
    $value = $match.Groups[$quotedGroup].Value
    if (-not $value) {
        $value = $match.Groups[$bareGroup].Value
    }
    return (Normalize-Identifier $value)
}

function Get-ColumnList([string] $columns) {
    $result = @()
    foreach ($column in ($columns -split ',')) {
        $result += (Normalize-Identifier $column)
    }
    return $result
}

function Test-SqlStatementTargetOwner($match, [string] $filePath, [string] $serviceKey, [int] $quotedGroup, [int] $bareGroup, [string] $operation) {
    $table = Get-IdentifierFromMatch $match $quotedGroup $bareGroup
    $owner = $statementTableOwner[$table]
    $lineNumber = 1 + ($content.Substring(0, $match.Index).Split("`n").Count - 1)
    if (-not $owner) {
        Write-Host "FAIL $operation targets unknown table '$table' in ${filePath}:$lineNumber"
        exit 1
    }
    if ($owner -ne $serviceKey) {
        Write-Host "FAIL cross-owner $operation in production split SQL: ${filePath}:$lineNumber targets $table owned by $owner"
        exit 1
    }
}

$schemaColumns = @{
    "activity" = New-ColumnSet @("id", "category_id", "artist_id", "per_user_limit")
    "activity_seat_layout" = New-ColumnSet @("id", "activity_id", "source_venue_layout_id")
    "activity_seat_layout_section" = New-ColumnSet @("id", "activity_layout_id")
    "artist" = New-ColumnSet @("id")
    "category" = New-ColumnSet @("id")
    "grab_request" = New-ColumnSet @("id", "request_id", "idempotency_key", "user_id", "session_id", "ticket_type_id", "quantity", "seat_ids", "allocate_random", "status", "order_id", "fail_reason", "expire_time", "created_at", "updated_at")
    "notification" = New-ColumnSet @("id")
    "order" = New-ColumnSet @("id")
    "order_seat" = New-ColumnSet @("id", "order_id")
    "order_snapshot" = New-ColumnSet @("id", "order_id")
    "organizer_application" = New-ColumnSet @("id", "user_id", "reviewer_id")
    "payment" = New-ColumnSet @("id")
    "private_asset" = New-ColumnSet @("id", "uploader_id", "biz_id")
    "refund_request" = New-ColumnSet @("id", "payment_id", "quantity", "order_seat_ids", "refund_type")
    "reservation" = New-ColumnSet @("id", "session_id")
    "seat" = New-ColumnSet @("id", "session_id", "ticket_type_id")
    "seat_block" = New-ColumnSet @("id")
    "seat_override" = New-ColumnSet @("id", "block_id")
    "session" = New-ColumnSet @("id", "activity_id", "venue_id")
    "session_seat" = New-ColumnSet @("id", "session_id", "venue_id", "area_id", "venue_seat_id", "ticket_type_id", "layout_section_id")
    "session_seat_layout" = New-ColumnSet @("id", "session_id", "activity_layout_id")
    "session_seat_layout_section" = New-ColumnSet @("id", "session_layout_id", "activity_layout_section_id", "ticket_type_id")
    "sms_code" = New-ColumnSet @("id")
    "station" = New-ColumnSet @("id", "tour_id")
    "station_config_version" = New-ColumnSet @("id", "station_id", "activity_id", "tour_id", "venue_id", "venue_application_id", "reviewer_id", "created_by")
    "stock_log" = New-ColumnSet @("id", "session_id", "ticket_type_id")
    "team_grab_request" = New-ColumnSet @("id", "request_id", "team_id", "trigger_user_id", "payer_user_id", "session_id", "ticket_type_id", "order_id")
    "team_seat_assignment" = New-ColumnSet @("id", "team_id", "user_id", "order_id", "order_seat_id", "session_seat_id")
    "ticket_team" = New-ColumnSet @("id", "invite_code", "leader_user_id", "activity_id", "session_id", "ticket_type_id")
    "ticket_team_member" = New-ColumnSet @("id", "team_id", "session_id", "user_id", "seat_id", "order_seat_id")
    "ticket_group" = New-ColumnSet @("id")
    "ticket_asset" = New-ColumnSet @("id", "uploader_id")
    "ticket_type" = New-ColumnSet @("id", "session_id")
    "ticket_type_area" = New-ColumnSet @("id", "ticket_type_id", "session_id", "area_id")
    "tour" = New-ColumnSet @("id")
    "user" = New-ColumnSet @("id")
    "user_asset" = New-ColumnSet @("id", "uploader_id")
    "user_auth" = New-ColumnSet @("id", "user_id")
    "venue" = New-ColumnSet @("id")
    "venue_application" = New-ColumnSet @("id", "venue_id", "proof_asset_id")
    "venue_area" = New-ColumnSet @("id", "venue_id")
    "venue_default_layout" = New-ColumnSet @("id", "venue_id")
    "venue_default_layout_section" = New-ColumnSet @("id", "layout_id")
    "venue_seat" = New-ColumnSet @("id", "venue_id", "area_id")
}

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
        if (-not $schemaColumns.ContainsKey($normalized)) {
            Write-Host "FAIL manifest references unknown production table '$table' for service $($service.key)"
            exit 1
        }
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
    if ($content -notmatch '(?m)^-- owner: (java-(user|ticket|order|payment|notification)|grab-service)') {
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
$identifierPattern = '(?:(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))'
$constraintPattern = 'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?' + $identifierPattern + '\s+ADD\s+CONSTRAINT\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))'
function Test-HasPrecedingConstraintDrop {
    param(
        [string]$Content,
        [string]$TableName,
        [string]$ConstraintName,
        [int]$BeforeIndex
    )

    $precedingContent = $Content.Substring(0, $BeforeIndex)
    $dropPattern = 'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?' + $identifierPattern + '\s+DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))'
    $normalizedTable = (Normalize-Identifier $TableName)
    $normalizedConstraint = $ConstraintName.ToLower()

    foreach ($dropMatch in [regex]::Matches($precedingContent, $dropPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $dropTable = Get-IdentifierFromMatch $dropMatch 1 2
        if ($dropTable -ne $normalizedTable) {
            continue
        }

        $dropConstraint = $dropMatch.Groups[3].Value
        if (-not $dropConstraint) {
            $dropConstraint = $dropMatch.Groups[4].Value
        }
        if ($dropConstraint.ToLower() -eq $normalizedConstraint) {
            return $true
        }
    }

    return $false
}

foreach ($file in $sqlFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    foreach ($match in [regex]::Matches($content, $constraintPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $tableName = Get-IdentifierFromMatch $match 1 2
        $constraintName = $match.Groups[3].Value
        if (-not $constraintName) {
            $constraintName = $match.Groups[4].Value
        }
        $normalized = $constraintName.ToLower()
        $lineNumber = 1 + ($content.Substring(0, $match.Index).Split("`n").Count - 1)
        if ($constraintNames.ContainsKey($normalized)) {
            if (Test-HasPrecedingConstraintDrop $content $tableName $constraintName $match.Index) {
                $constraintNames[$normalized] = "$($file.FullName):$lineNumber"
                continue
            }
            Write-Host "FAIL duplicate constraint name '$constraintName' in $($file.FullName):$lineNumber; first seen at $($constraintNames[$normalized])"
            exit 1
        }
        $constraintNames[$normalized] = "$($file.FullName):$lineNumber"
    }
}

$createTablePattern = 'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?' + $identifierPattern
$alterTablePattern = 'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?' + $identifierPattern
$updatePattern = 'UPDATE\s+(?:ONLY\s+)?' + $identifierPattern
$createIndexPattern = 'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s+ON\s+' + $identifierPattern
$fkPattern = 'ALTER\s+TABLE\s+' + $identifierPattern + '\s+ADD\s+CONSTRAINT\s+(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s+FOREIGN\s+KEY\s*\(([^\)]+)\)\s+REFERENCES\s+' + $identifierPattern + '\s*\(([^\)]+)\)'
foreach ($file in $sqlFiles) {
    $serviceKey = Split-Path -Leaf (Split-Path -Parent $file.FullName)
    $content = Get-Content -Raw -LiteralPath $file.FullName
    $statementTableOwner = $tableOwner.Clone()
    foreach ($match in [regex]::Matches($content, $createTablePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $table = Get-IdentifierFromMatch $match 1 2
        $owner = $statementTableOwner[$table]
        $lineNumber = 1 + ($content.Substring(0, $match.Index).Split("`n").Count - 1)
        if ($owner -and $owner -ne $serviceKey) {
            Write-Host "FAIL cross-owner CREATE TABLE in production split SQL: $($file.FullName):$lineNumber targets $table owned by $owner"
            exit 1
        }
        $statementTableOwner[$table] = $serviceKey
    }
    foreach ($match in [regex]::Matches($content, $alterTablePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        Test-SqlStatementTargetOwner $match $file.FullName $serviceKey 1 2 "ALTER TABLE"
    }
    foreach ($match in [regex]::Matches($content, $updatePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        Test-SqlStatementTargetOwner $match $file.FullName $serviceKey 1 2 "UPDATE"
    }
    foreach ($match in [regex]::Matches($content, $createIndexPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        Test-SqlStatementTargetOwner $match $file.FullName $serviceKey 1 2 "CREATE INDEX"
    }
    foreach ($match in [regex]::Matches($content, $fkPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $child = Get-IdentifierFromMatch $match 1 2
        $childColumns = Get-ColumnList $match.Groups[3].Value
        $referenced = Get-IdentifierFromMatch $match 4 5
        $referencedColumns = Get-ColumnList $match.Groups[6].Value
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
        foreach ($column in $childColumns) {
            if (-not $schemaColumns[$child].ContainsKey($column)) {
                Write-Host "FAIL FK uses unknown child column '$child.$column' in $($file.FullName):$lineNumber"
                exit 1
            }
        }
        foreach ($column in $referencedColumns) {
            if (-not $schemaColumns[$referenced].ContainsKey($column)) {
                Write-Host "FAIL FK references unknown column '$referenced.$column' in $($file.FullName):$lineNumber"
                exit 1
            }
        }
    }
}

Write-Host "PASS production split SQL safety check"
