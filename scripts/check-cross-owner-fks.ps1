$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

# --- Owner map (all lowercase keys) ---
$ownerMap = @{}
function Add-Owners {
    param([string[]]$Tables, [string]$Owner)
    foreach ($t in $Tables) { $ownerMap[$t.ToLower()] = $Owner }
}

Add-Owners -Tables @("user", "user_auth", "sms_code", "organizer_application", "user_asset", "user_attendee", "privacy_audit_log", "support_account", "support_conversation", "support_message", "support_conversation_note", "support_conversation_tag", "support_conversation_audit", "support_quick_reply", "user_browse_history", "rbac_role", "rbac_permission", "rbac_role_permission", "operation_audit_log", "exception_task", "exception_task_evidence", "reconciliation_batch", "reconciliation_detail", "reconciliation_difference") -Owner "java-user"
Add-Owners -Tables @("category", "artist", "activity_artist", "tour", "station", "activity", "session", "ticket_type", "ticket_type_area", "session_seat", "venue", "venue_area", "venue_seat", "venue_application", "reservation", "seat", "review", "moment", "stock_log", "venue_seat_layout_template", "venue_seat_layout_template_section", "venue_default_layout", "venue_default_layout_section", "activity_seat_layout", "activity_seat_layout_section", "session_seat_layout", "session_seat_layout_section", "seat_block", "seat_override", "ticket_group", "layout_section", "performance_subscription", "activity_review", "activity_question", "activity_review_report", "activity_marketing_rule", "search_history", "seat_layout_version", "seat_layout_version_block", "seat_layout_version_override", "seat_layout_version_ticket_group", "seat_layout_version_group_binding", "ticket_asset", "private_asset", "station_config_version") -Owner "java-ticket"
Add-Owners -Tables @("order", "order_seat", "order_snapshot", "order_attendee", "electronic_ticket", "ticket_transfer") -Owner "java-order"
Add-Owners -Tables @("payment", "refund_request") -Owner "java-payment"
Add-Owners -Tables @("notification") -Owner "java-notification"
Add-Owners -Tables @("grab_request", "ticket_team", "ticket_team_member", "team_grab_request", "team_seat_assignment", "waitlist_entry", "waitlist_offer", "waitlist_allocation_log") -Owner "grab-service"

# --- Normalize table name: strip quotes and lowercase ---
function Normalize-TableName {
    param([string]$Name)
    return $Name.Trim('"').Trim("'").ToLower()
}

# --- Known cross-owner allowlist (from cross-service-db-constraints.md) ---
# Key format: "sql/migrations/shared/file.sql:childtable.column -> referencedtable" (all lowercase, no quotes)
$knownCrossOwner = @{}
function Add-Known {
    param([string]$File, [string]$Child, [string]$Column, [string]$Ref)
    $childNorm = Normalize-TableName -Name $Child
    $refNorm = Normalize-TableName -Name $Ref
    $key = "$($file):$childNorm.$column -> $refNorm"
    $knownCrossOwner[$key.ToLower()] = $true
}

$knownEntries = @(
    @{Files=@("sql/migrations/shared/20260518_create_venue_application.sql"); Child="venue_application"; Column="applicant_id"; Ref="user"},
    @{Files=@("sql/migrations/shared/20260518_create_venue_application.sql"); Child="venue_application"; Column="reviewer_id"; Ref="user"},
    @{Files=@("sql/migrations/shared/20260517_create_refund_request.sql"); Child="refund_request"; Column="order_id"; Ref="order"},
    @{Files=@("sql/migrations/shared/20260517_create_refund_request.sql"); Child="refund_request"; Column="user_id"; Ref="user"},
    @{Files=@("sql/migrations/shared/20260517_create_refund_request.sql"); Child="refund_request"; Column="reviewer_id"; Ref="user"},
    @{Files=@("sql/migrations/shared/20260518_create_order_seat.sql"); Child="order_seat"; Column="session_seat_id"; Ref="session_seat"},
    @{Files=@("sql/migrations/shared/20260518_create_session_seat.sql"); Child="session_seat"; Column="order_id"; Ref="order"}
)

foreach ($entry in $knownEntries) {
    foreach ($f in $entry.Files) {
        Add-Known -File $f -Child $entry.Child -Column $entry.Column -Ref $entry.Ref
    }
}

# --- Scan all SQL files (recursive) ---
$sqlDir = Join-Path -Path $repoRoot -ChildPath "sql"
$sqlFiles = Get-ChildItem -Path $sqlDir -Filter "*.sql" -Recurse | Sort-Object FullName

$allFks = @()        # Array of discovered FK objects
$unknownCrossOwners = @()
$unclassifiedTables = @{}
$exitCode = 0

foreach ($sqlFile in $sqlFiles) {
    $relPath = $sqlFile.FullName.Substring($repoRoot.Length + 1).Replace("\", "/")
    $lines = Get-Content -Path $sqlFile.FullName
    $currentTable = $null
    $inCreateBlock = $false

    foreach ($line in $lines) {
        # Track CREATE TABLE
        if ($line -match 'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["]?(\w+)["]?\s*\(') {
            $currentTable = Normalize-TableName -Name $matches[1]
            $inCreateBlock = $true
            continue
        }

        # End of CREATE TABLE block
        if ($inCreateBlock -and $line -match '^\s*\);') {
            $currentTable = $null
            $inCreateBlock = $false
            continue
        }

        # --- Pattern 1: Inline REFERENCES inside CREATE TABLE (or any line with column + REFERENCES) ---
        # Matches: column_name TYPE [NOT NULL] [UNIQUE] REFERENCES "ref"(id)
        if ($line -match '^\s*(\w+)\s+\w+(?:\s+DEFAULT\s+\S+)?(?:\s+NOT\s+NULL)?(?:\s+UNIQUE)?\s+REFERENCES\s+["]?(\w+)["]?\s*\(' -and $inCreateBlock -and $currentTable) {
            $column = $matches[1]
            $refTableRaw = $matches[2]
            $refTable = Normalize-TableName -Name $refTableRaw
            $allFks += @{
                File = $relPath
                Child = $currentTable
                Column = $column
                References = $refTable
            }
            continue
        }

        # --- Pattern 2: ALTER TABLE ... ADD COLUMN ... REFERENCES ---
        if ($line -match 'ALTER\s+TABLE\s+["]?(\w+)["]?\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+\w+.*REFERENCES\s+["]?(\w+)["]?\s*\(') {
            $childTable = Normalize-TableName -Name $matches[1]
            $column = $matches[2]
            $refTable = Normalize-TableName -Name $matches[3]
            $allFks += @{
                File = $relPath
                Child = $childTable
                Column = $column
                References = $refTable
            }
            continue
        }

        # --- Pattern 3: CONSTRAINT ... FOREIGN KEY (col) REFERENCES ... ---
        if ($line -match 'FOREIGN\s+KEY\s+\((\w+)\)\s+REFERENCES\s+["]?(\w+)["]?\s*\(' -and $inCreateBlock -and $currentTable) {
            $column = $matches[1]
            $refTable = Normalize-TableName -Name $matches[2]
            $allFks += @{
                File = $relPath
                Child = $currentTable
                Column = $column
                References = $refTable
            }
            continue
        }
    }
}

# --- Classify each FK ---
$crossOwnerCount = 0
$sameOwnerCount = 0
$legacyCount = 0

$crossOwnerList = @()

foreach ($fk in $allFks) {
    $childOwner = $ownerMap[$fk.Child]
    $refOwner = $ownerMap[$fk.References]

    # Check for unclassified tables
    if (-not $childOwner) {
        $unclassifiedTables[$fk.Child] = $true
    }
    if (-not $refOwner) {
        $unclassifiedTables[$fk.References] = $true
    }

    $isLegacy = ($childOwner -eq "legacy-unused") -or ($refOwner -eq "legacy-unused")
    # Check if child or ref is a legacy table
    if ($fk.Child -in @("review", "moment", "reservation")) {
        $isLegacy = $true
    }
    if ($fk.References -in @("review", "moment", "reservation")) {
        $isLegacy = $true
    }

    if ($isLegacy) {
        $legacyCount++
        continue
    }

    if ($childOwner -ne $refOwner) {
        $crossOwnerCount++
        $crossOwnerList += $fk

        # Check against allowlist
        $key = "$($fk.File):$($fk.Child).$($fk.Column) -> $($fk.References)"
        if (-not $knownCrossOwner[$key.ToLower()]) {
            $unknownCrossOwners += $fk
        }
    } else {
        $sameOwnerCount++
    }
}

# --- Report results ---
Write-Host "=== Cross-Owner FK Check ==="
Write-Host ""

# Print known cross-owner FKs
if ($crossOwnerList.Count -gt 0) {
    Write-Host "Known cross-owner FKs ($crossOwnerCount):"
    foreach ($fk in $crossOwnerList) {
        $childLabel = if ($fk.Child -eq "order") { """order""" } else { $fk.Child }
        $refLabel = if ($fk.References -eq "order") { """order""" } else { $fk.References }
        Write-Host "  $($fk.File): $childLabel.$($fk.Column) -> $refLabel"
    }
    Write-Host ""
}

Write-Host "Same-owner FKs: $sameOwnerCount"
Write-Host "Legacy FKs: $legacyCount"
Write-Host ""

# Check for unclassified tables
if ($unclassifiedTables.Count -gt 0) {
    Write-Host "FAIL unclassified FK table(s):"
    foreach ($t in $unclassifiedTables.Keys) {
        Write-Host "  $t (not found in owner map)"
    }
    $exitCode = 1
}

# Check for unknown cross-owner FKs
if ($unknownCrossOwners.Count -gt 0) {
    Write-Host "FAIL unknown cross-owner FK(s):"
    foreach ($fk in $unknownCrossOwners) {
        $childLabel = if ($fk.Child -eq "order") { """order""" } else { $fk.Child }
        $refLabel = if ($fk.References -eq "order") { """order""" } else { $fk.References }
        Write-Host "  $($fk.File): $childLabel.$($fk.Column) -> $refLabel"
    }
    $exitCode = 1
}

if ($exitCode -eq 0) {
    Write-Host "PASS known cross-owner FK inventory"
}

# --- Summary ---
Write-Host ""
Write-Host "Summary: $crossOwnerCount cross-owner, $sameOwnerCount same-owner, $legacyCount legacy"

# Also check order_snapshot FK (same-owner, order_snapshot -> order, both java-order)
$orderSnapshotFk = $allFks | Where-Object { $_.Child -eq "order_snapshot" -and $_.References -eq "order" }
if ($orderSnapshotFk) {
    Write-Host "(order_snapshot.order_id -> order: same-owner, safe for schema split)"
}

exit $exitCode
