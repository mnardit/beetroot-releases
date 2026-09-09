$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath("$PSScriptRoot/../..")
$previousTarget = $env:CARGO_TARGET_DIR
Push-Location $repoRoot
try {
    $env:CARGO_TARGET_DIR = Join-Path $repoRoot 'src-tauri/target/smoke'
    & npm.cmd run tauri -- build --features smoke-test --no-bundle --config src-tauri/tauri.unsigned.conf.json
    if ($LASTEXITCODE -ne 0) { throw "Smoke build failed (exit $LASTEXITCODE)." }
} finally {
    $env:CARGO_TARGET_DIR = $previousTarget
    Pop-Location
}
