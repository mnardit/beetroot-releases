# Microsoft Store Packaging

## Prerequisites

- Windows 10 or later with the C++ build tools and Windows SDK.
- Git Bash for `packaging/msix/build-msix.sh`.
- `MakeAppx.exe` and `MakePri.exe` from the Windows SDK version configured in the packaging script.
- The Store package identity belongs to the official Beetroot application. Publishing a fork requires its own identity and distribution setup.

## Build

Run from the repository root:

```powershell
npm run build:desktop -- --config src-tauri/tauri.unsigned.conf.json -- --locked
bash packaging/msix/build-msix.sh
```

The script verifies native attribution and the current release notices before staging the executable, resources, icons and manifest. It then produces the MSIX bundle, derives the four-part Identity Version from `package.json` and checks that the OS compatibility attributes remain unchanged. Do not bypass this script with a manual packaging command.

Store submission and signing are maintainer operations. Tauri updater signatures and Windows Authenticode signatures are different: the former authenticate in-app updates and do not remove SmartScreen warnings.

## Local Testing

Use an isolated Windows VM. Package installation or removal can affect an already installed copy with the same identity. Never run the smoke suite against a personal installation.

After building and signing the MSIX for the test VM with a certificate trusted by that VM:

```powershell
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$package = Join-Path (Get-Location) "src-tauri/target/release/bundle/Beetroot_$version.0_x64.msix"
Add-AppPackage -Path $package
$appx = Get-AppxPackage -Name 'MaxNardit.BeetrootClipboardManager' -ErrorAction Stop
Start-Process "explorer.exe" -ArgumentList "shell:AppsFolder\$($appx.PackageFamilyName)!Beetroot" -WindowStyle Hidden
Start-Sleep -Seconds 2
(Get-Process Beetroot).Path
```

The package name and `Beetroot` application ID above come from `packaging/msix/AppxManifest.xml`. AppsFolder activation uses the installed package's family name and that application ID, as the smoke harness does; no `beetroot:` URI handler is registered. The process path must contain `WindowsApps`. Loose manifest registration runs from a development directory and does not exercise the Store-specific autostart path.

## Store vs EXE Differences

| Behavior     | EXE / MSI                                 | MSIX                |
| ------------ | ----------------------------------------- | ------------------- |
| Updates      | Signed Tauri updates from GitHub Releases | Microsoft Store     |
| Install path | Installer-selected directory              | WindowsApps         |
| Autostart    | Tauri autostart plugin                    | Windows StartupTask |

`src-tauri/src/commands/autostart.rs` selects the path with `is_store_package()`. The Store implementation lives in `src-tauri/src/startup_task.rs`. `BeetrootAutoStart` must match the task ID in `AppxManifest.xml`.

Test enable, disable and the OS-controlled `DisabledByUser` state. The application must not override a user or policy restriction. Verify both startup behavior and the executable's WindowsApps path, not only a successful IPC response.
