# tests/smoke/lib/AppLifecycle.psm1
# Lifecycle helpers for the Beetroot binary used by the native smoke harness.

$script:BeetrootPath = [IO.Path]::GetFullPath("$PSScriptRoot/../../../src-tauri/target/smoke/release/beetroot.exe")
$script:DataPath = $null
$script:Process = $null
$script:DbFileName   = "clipboard.db"

function Assert-BeetrootSmokeEnvironment {
    $computer = Get-CimInstance Win32_ComputerSystem
    if ($computer.Manufacturer -ne 'Microsoft Corporation' -or $computer.Model -ne 'Virtual Machine') {
        throw 'Native smoke changes the clipboard and sends global hotkeys. Run it in a disposable Hyper-V VM.'
    }
    $sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId
    if (Get-Process rdpclip -ErrorAction SilentlyContinue | Where-Object SessionId -eq $sessionId) {
        throw 'Disable clipboard redirection in the test session first; smoke must not change the host clipboard.'
    }
    if (Get-Process beetroot -ErrorAction SilentlyContinue) {
        throw 'Close Beetroot in the test VM first. The harness will not terminate unrelated processes.'
    }
}

function Get-BeetrootDataPath {
    if (-not $script:DataPath) { throw "Start-Beetroot must select an isolated profile first." }
    return $script:DataPath
}

function Get-BeetrootDbPath {
    <#
    .SYNOPSIS
    Returns the absolute path to the Beetroot SQLite database file.
    #>
    Join-Path (Get-BeetrootDataPath) $script:DbFileName
}

function Start-Beetroot {
    <#
    .SYNOPSIS
    Launches the release Beetroot binary and waits until it has initialized
    its SQLite database.

    .PARAMETER ReadyTimeoutSec
    Maximum time, in seconds, to wait for clipboard.db to exist. Defaults to
    20 because cold starts on Windows can be slow when Defender scans the
    binary for the first time.
    #>
    [CmdletBinding()]
    param(
        [int]$ReadyTimeoutSec = 20
    )

    if ($script:Process -and -not $script:Process.HasExited) {
        throw "The previous smoke process is still running. Stop it before starting another."
    }
    if (-not (Test-Path -LiteralPath $script:BeetrootPath)) {
        throw "Smoke binary not found at $script:BeetrootPath. Run 'npm run build:smoke' first."
    }
    $runId = [guid]::NewGuid().ToString('N')
    $identifier = "com.beetroot.desktop.smoke.$runId"
    $script:DataPath = Join-Path $env:APPDATA $identifier
    $previousRunId = $env:BEETROOT_SMOKE_RUN_ID
    try {
        $env:BEETROOT_SMOKE_RUN_ID = $runId
        $profile = (& $script:BeetrootPath --print-build-profile | Out-String) | ConvertFrom-Json
        if (-not $profile.smoke -or $profile.identifier -ne $identifier -or $profile.dataDirectory -ne $script:DataPath) {
            throw "The binary is not a matching isolated smoke build. Run 'npm run build:smoke'."
        }
        $proc = Start-Process -FilePath $script:BeetrootPath -WindowStyle Hidden -PassThru
        $script:Process = $proc
    } finally {
        $env:BEETROOT_SMOKE_RUN_ID = $previousRunId
    }
    $deadline = (Get-Date).AddSeconds($ReadyTimeoutSec)

    $dbPath = Get-BeetrootDbPath
    while (-not (Test-Path $dbPath) -and (Get-Date) -lt $deadline) {
        if ($proc.HasExited) { throw "Smoke process exited before initializing its database." }
        Start-Sleep -Milliseconds 250
    }

    if (-not (Test-Path $dbPath)) {
        Stop-Beetroot -Process $proc
        throw "Beetroot did not initialize within $ReadyTimeoutSec sec (DB not created at $dbPath)"
    }

    return $proc
}

function Stop-Beetroot {
    <#
    .SYNOPSIS
    Terminates a Beetroot process previously started via Start-Beetroot and
    waits up to 3 seconds for clean exit.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [System.Diagnostics.Process]$Process
    )

    if ($Process -ne $script:Process) { throw "Refusing to stop a process not started by this harness." }
    if (-not $Process.HasExited) {
        $Process.Kill()
        $Process.WaitForExit(3000) | Out-Null
    }
}

Export-ModuleMember -Function Assert-BeetrootSmokeEnvironment, Start-Beetroot, Stop-Beetroot, Get-BeetrootDataPath, Get-BeetrootDbPath
