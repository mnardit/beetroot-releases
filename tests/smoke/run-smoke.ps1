# tests/smoke/run-smoke.ps1
# Entry point for `npm run test:smoke`. Runs all Pester tests in tests/smoke/.
param([string]$MsixPath)
$ErrorActionPreference = "Stop"

# Re-launch with -Sta if needed (clipboard ops require single-threaded apartment)
if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    $arguments = @('-Sta', '-File', $PSCommandPath)
    if ($MsixPath) { $arguments += @('-MsixPath', $MsixPath) }
    & pwsh @arguments
    exit $LASTEXITCODE
}

$repoRoot = Resolve-Path "$PSScriptRoot/../.."
Push-Location $repoRoot

try {
    Import-Module Pester -MinimumVersion 5.5.0
    $config = New-PesterConfiguration
    $config.Run.Container = New-PesterContainer -Path 'tests/smoke/Beetroot.Smoke.Tests.ps1' -Data @{ MsixPath = $MsixPath }
    if (-not $MsixPath) { $config.Filter.ExcludeTag = @('MSIX') }
    $config.Output.Verbosity = "Detailed"
    $config.Run.PassThru = $true
    $result = Invoke-Pester -Configuration $config
} finally {
    Pop-Location
}
if ($result.Result -ne 'Passed' -or $result.FailedCount -gt 0 -or $result.PassedCount -eq 0) { exit 1 }
