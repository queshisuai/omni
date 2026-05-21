$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-BoundaryCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [string[]]$Include = @("*.java"),
        [string[]]$Allowed = @()
    )

    $fullPath = Join-Path -Path $repoRoot -ChildPath $Path
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Boundary check path not found: $fullPath"
    }

    $matches = @()
    foreach ($filter in $Include) {
        $matches += Get-ChildItem -Path $fullPath -Recurse -Filter $filter | Select-String -Pattern $Pattern
    }
    $violations = @($matches | Where-Object {
        $line = $_.Line
        -not ($Allowed | Where-Object { $line -match $_ })
    })

    if ($violations.Count -gt 0) {
        Write-Host "FAIL $Name"
        $violations | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber) $($_.Line.Trim())" }
        exit 1
    }

    Write-Host "PASS $Name"
}

Invoke-BoundaryCheck `
    -Name "ticket must not use user table refs" `
    -Path "java/java-ticket/src" `
    -Pattern 'UserRefMapper|@TableName\(""user""\)|FROM\s+"?user"?|JOIN\s+"?user"?' `
    -Include @("*.java", "*.xml") `
    -Allowed @("InternalUserRefResponse", "UserInternalClient", "UserAccessService")

Invoke-BoundaryCheck `
    -Name "ticket must not use removed social tables" `
    -Path "java/java-ticket/src" `
    -Pattern 'ReviewMapper|MomentMapper|@TableName\(""review""\)|@TableName\(""moment""\)|FROM\s+review|FROM\s+moment|JOIN\s+review|JOIN\s+moment' `
    -Include @("*.java", "*.xml") `
    -Allowed @("removedSocialPersistenceTypesAreNotPresent", "assertClassNotFound", "isRemovedSocialPersistenceType", "com.omni.ticket.mapper.ReviewMapper", "com.omni.ticket.mapper.MomentMapper")

Invoke-BoundaryCheck `
    -Name "order must not use ticket table refs" `
    -Path "java/java-order/src" `
    -Pattern 'TicketTypeMapper|SessionSeatMapper|ActivityMapper|SessionMapper|VenueMapper|JOIN\s+activity|JOIN\s+session|JOIN\s+venue|JOIN\s+ticket_type|JOIN\s+session_seat|FROM\s+activity|FROM\s+session|FROM\s+venue|FROM\s+ticket_type|FROM\s+session_seat' `
    -Include @("*.java", "*.xml")

Invoke-BoundaryCheck `
    -Name "payment must not use user ticket ref mappers" `
    -Path "java/java-payment/src" `
    -Pattern 'UserRefMapper|SessionRefMapper|ActivityRefMapper|import com\.omni\.payment\.entity\.(UserRef|SessionRef|ActivityRef)|\bUserRef\b|\bSessionRef\b|\bActivityRef\b|FROM\s+"?user"?|FROM\s+session|FROM\s+activity|JOIN\s+"?user"?|JOIN\s+session|JOIN\s+activity' `
    -Include @("*.java", "*.xml") `
    -Allowed @("InternalUserRefResponse")

Invoke-BoundaryCheck `
    -Name "notification must not use user or order table refs" `
    -Path "java/java-notification/src" `
    -Pattern 'import com\.omni\.user\.|import com\.omni\.order\.|FROM\s+"?user"?|FROM\s+"?order"?|JOIN\s+"?user"?|JOIN\s+"?order"?|UserRefMapper|OrderRefMapper|UserMapper|OrderMapper|@TableName\(""user""\)|@TableName\(""order""\)' `
    -Include @("*.java", "*.xml")

Write-Host "All service boundary checks passed."
