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

Write-Host "All local schema profile checks passed."
