$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

$expectedProfiles = @(
    @{ Service = "java-user"; Schema = "user_service,public" },
    @{ Service = "java-ticket"; Schema = "ticket_service,public" },
    @{ Service = "java-order"; Schema = "order_service,public" },
    @{ Service = "java-payment"; Schema = "payment_service,public" },
    @{ Service = "java-notification"; Schema = "notification_service,public" }
)

foreach ($profile in $expectedProfiles) {
    $file = Join-Path -Path $repoRoot -ChildPath "java/$($profile.Service)/src/main/resources/application-local-schema.yml"
    if (-not (Test-Path -LiteralPath $file)) {
        Write-Host "FAIL missing local schema profile: $file"
        exit 1
    }

    $content = Get-Content -Raw -LiteralPath $file
    if ($content -notmatch [regex]::Escape("currentSchema=$($profile.Schema)")) {
        Write-Host "FAIL invalid currentSchema for $($profile.Service): expected $($profile.Schema)"
        exit 1
    }

    Write-Host "PASS $($profile.Service) local schema profile -> $($profile.Schema)"
}

# Seata defaults: local-schema keeps a local disabled fallback; prod-split requires explicit environment.
$seataServices = @("java-order", "java-payment", "java-ticket")
foreach ($svc in $seataServices) {
    $localFile = Join-Path -Path $repoRoot -ChildPath "java/$svc/src/main/resources/application-local-schema.yml"
    $prodFile = Join-Path -Path $repoRoot -ChildPath "java/$svc/src/main/resources/application-prod-split.yml"

    if (Test-Path -LiteralPath $localFile) {
        $content = Get-Content -Raw -LiteralPath $localFile
        if ($content -notmatch [regex]::Escape('enabled: ${SEATA_ENABLED:false}')) {
            Write-Host "FAIL $svc local-schema: expected seata enabled default=false"
            exit 1
        }
        Write-Host "PASS $svc local-schema seata enabled default=false"
    }

    if (Test-Path -LiteralPath $prodFile) {
        $content = Get-Content -Raw -LiteralPath $prodFile
        if ($content -notmatch '(?m)^\s+enabled:\s*\$\{SEATA_ENABLED\}\s*$') {
            Write-Host "FAIL $svc prod-split: expected seata enabled to require SEATA_ENABLED without fallback"
            exit 1
        }
        Write-Host "PASS $svc prod-split seata enabled requires SEATA_ENABLED"
    }
}

# User service: local-schema must have development-only id-no-key fallback
$userLocalFile = Join-Path -Path $repoRoot -ChildPath "java/java-user/src/main/resources/application-local-schema.yml"
if (Test-Path -LiteralPath $userLocalFile) {
    $content = Get-Content -Raw -LiteralPath $userLocalFile
    if ($content -notmatch [regex]::Escape('id-no-key: ${OMNI_ID_NO_KEY:omni-local-dev-id-no-key-change-me}')) {
        Write-Host "FAIL java-user local-schema: expected id-no-key development fallback"
        exit 1
    }
    Write-Host "PASS java-user local-schema id-no-key development fallback"
}

Write-Host "All local schema profile checks passed."
