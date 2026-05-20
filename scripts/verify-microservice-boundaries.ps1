$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$javaRoot = Join-Path -Path $repoRoot -ChildPath "java"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host ""
    Write-Host "=== $Name ==="
    try {
        & $Command
        if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
            throw "Exit code $LASTEXITCODE"
        }
        Write-Host "PASS $Name"
    } catch {
        Write-Host "FAIL $Name"
        Write-Host $_
        exit 1
    }
}

Write-Host "Microservice boundary verification"
Write-Host "Repository: $repoRoot"

Invoke-Step -Name "Service boundary guard" -Command {
    powershell -ExecutionPolicy Bypass -File (Join-Path -Path $repoRoot -ChildPath "scripts/check-service-boundaries.ps1")
}

Invoke-Step -Name "Cross-owner FK inventory" -Command {
    powershell -ExecutionPolicy Bypass -File (Join-Path -Path $repoRoot -ChildPath "scripts/check-cross-owner-fks.ps1")
}

Invoke-Step -Name "Local schema profiles" -Command {
    powershell -ExecutionPolicy Bypass -File (Join-Path -Path $repoRoot -ChildPath "scripts/check-local-schema-profiles.ps1")
}

Invoke-Step -Name "Local schema SQL safety" -Command {
    powershell -ExecutionPolicy Bypass -File (Join-Path -Path $repoRoot -ChildPath "scripts/check-local-schema-sql.ps1")
}

Invoke-Step -Name "Java boundary tests" -Command {
    Push-Location -LiteralPath $javaRoot
    try {
        mvn test -pl java-payment,java-ticket,java-order -am --% -Dsurefire.failIfNoSpecifiedTests=false
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "All microservice boundary checks passed."
