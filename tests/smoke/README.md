# Beetroot Native Smoke Tests

Native Windows checks for clipboard capture, hotkey popup, and optional MSIX registration/activation. These tests change the clipboard and send global hotkeys. Run them in a disposable Hyper-V VM with an interactive user session; the harness refuses physical hosts and existing Beetroot processes.

Disable clipboard redirection for the test session. The harness also rejects an active `rdpclip.exe` in its own session, since Enhanced Session/RDP can otherwise propagate test clipboard writes to the host. Do not reconnect with clipboard sharing enabled during a run.

## Prerequisites

- PowerShell 7 (`pwsh.exe`)
- Pester 5+ (`Install-Module Pester -MinimumVersion 5.5.0 -Scope CurrentUser`)
- sqlite3.exe on PATH (`winget install SQLite.SQLite`)
- A smoke build at `src-tauri/target/smoke/release/beetroot.exe` (not an installed release)

## Run

```powershell
npm run build:smoke
npm run test:smoke
```

Build on the host or inside the VM. When transferring a host build, copy the repository's `tests/smoke` directory and the binary to the same relative layout in the guest. The binary embeds the built frontend; Node/Rust are not needed to run it. Pester, sqlite3, PowerShell 7 and WebView2 are needed in the guest.

Each launch selects a fresh `com.beetroot.desktop.smoke.<run-id>` profile for the database and WebView2. Autostart and updater are disabled. Profiles remain in `%APPDATA%` and `%LOCALAPPDATA%` for failure inspection; discard the VM checkpoint after testing. The harness never follows the production data-path redirect or stops an unrelated process.

MSIX testing is opt-in and refuses to replace an already installed package:

```powershell
pwsh tests/smoke/run-smoke.ps1 -MsixPath C:\test-artifacts\candidate.msix
```

Only the exact package installed by that run is removed afterwards. A failed installation fails the test rather than silently skipping it. MSIX checks use a production-mode package, since smoke builds deliberately cannot change autostart.

Harness unit tests can run on the host without launching Beetroot or modifying the clipboard:

```powershell
Invoke-Pester tests/smoke/Harness.Tests.ps1
```

## Scope

3 scenarios:

1. **Clipboard text capture** — write text via .NET clipboard, assert SQLite row appears.
2. **Hotkey popup** — send Ctrl+` via the Windows keyboard API, assert the test process's popup becomes visible / hidden.
3. **MSIX registration** — sideload the specified package, inspect its registered startup-task extension and activate the exact package. This does not prove that toggling autostart or logging in works; those remain manual checks.

Real Office / 1Password / NVDA / multi-monitor / DPI / reboot stay manual — these are out of scope for the POC.
