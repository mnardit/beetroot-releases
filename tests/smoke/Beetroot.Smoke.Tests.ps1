# tests/smoke/Beetroot.Smoke.Tests.ps1
param([string]$MsixPath)

BeforeAll {
    $libDir = Join-Path $PSScriptRoot "lib"
    Import-Module (Join-Path $libDir 'AppLifecycle.psm1') -Force
    Assert-BeetrootSmokeEnvironment
    foreach ($module in @('AppLifecycle', 'ClipboardOps', 'DbInspect', 'HotkeyOps')) {
        Import-Module (Join-Path $libDir "$module.psm1") -Force
    }
}

Describe "Smoke: clipboard text capture + DB write" {
    BeforeEach {
        $script:proc = $null
        $script:proc = Start-Beetroot -ReadyTimeoutSec 20
        # Beetroot's clipboard monitor lives in the renderer (useClipboardMonitor.ts)
        # and only registers after the WebView has loaded React. 2s was too short
        # on cold start; 5s is reliable on this dev machine.
        Start-Sleep -Seconds 5
        Clear-ClipboardSafe
    }

    AfterEach {
        if ($script:proc) { Stop-Beetroot -Process $script:proc }
    }

    It "writes a text clip and finds it in SQLite history" {
        $marker = "smoke-test-$(New-Guid)"
        Set-ClipboardText $marker

        # Beetroot dedup window is 500ms; wait for clipboard monitor + IPC + DB
        Start-Sleep -Seconds 3

        $items = Get-BeetrootHistoryItems -Limit 5
        $items | Should -Not -BeNullOrEmpty
        $matched = $items | Where-Object { $_.content -eq $marker }
        $matched | Should -Not -BeNullOrEmpty
        $matched.content_type | Should -Be "text"
    }

    It "does NOT capture a whitespace-only clipboard write" {
        # Beetroot's clipboard monitor filters via `text.trim().length > 0` in
        # useClipboardMonitor.ts, so a single space (or any whitespace-only
        # content) is the real boundary. We use " " here instead of "" because
        # Forms.Clipboard.SetText rejects empty strings with ArgumentNullException.
        $beforeCount = (Get-BeetrootHistoryItems -Limit 1000).Count
        Set-ClipboardText " "
        Start-Sleep -Seconds 3
        $afterCount = (Get-BeetrootHistoryItems -Limit 1000).Count
        $afterCount | Should -Be $beforeCount
    }
}

Describe "Smoke: hotkey popup show/hide" {
    BeforeEach {
        $script:proc = $null
        $script:proc = Start-Beetroot -ReadyTimeoutSec 20
        # Hotkey thread (RegisterHotKey via direct Windows API, hotkey.rs) is
        # started early in setup but the WebView2 keyboard layout warm-up plus
        # the layout cache pre-warming push first-press readiness past the
        # naive 3s figure observed in isolation. 7s is reliable on this dev
        # machine after the prior Describe block has churned the disk cache.
        Start-Sleep -Seconds 7
    }

    AfterEach {
        if ($script:proc) { Stop-Beetroot -Process $script:proc }
    }

    It "Ctrl+`` toggles window visibility" {
        # Initial: window should be hidden (Beetroot starts in tray).
        Test-BeetrootWindowVisible -Process $script:proc | Should -Be $false

        # First press: show. Hotkey-thread latency on cold start can swing
        # from ~200ms to >1s while WebView2 finishes initializing, so poll
        # for the transition rather than checking at a fixed interval.
        Send-CtrlBacktick
        Wait-BeetrootWindowVisible -Process $script:proc -ExpectedState $true -TimeoutMs 5000 | Should -Be $true

        # Beetroot auto-hides on blur because focus never leaves the test
        # runner. The popup collapses ~1s after appearing on its own, but
        # observed timing varies (1-3s) depending on WebView2 paint timing.
        # Wait up to 5s for the window to become hidden — either via the
        # auto-hide-on-blur or by sending a second Ctrl+` toggle if the
        # auto-hide is slow. This confirms the popup is dismissable, which is
        # the user-visible contract for the hotkey.
        $hidden = Wait-BeetrootWindowVisible -Process $script:proc -ExpectedState $false -TimeoutMs 2500
        if (-not $hidden) {
            # Auto-hide didn't fire (no blur event observed) — toggle manually.
            Send-CtrlBacktick
            $hidden = Wait-BeetrootWindowVisible -Process $script:proc -ExpectedState $false -TimeoutMs 3000
        }
        $hidden | Should -Be $true
    }
}

Describe "Smoke: MSIX registration and activation" -Tag "MSIX" {
    BeforeAll {
        $script:installedPackage = $null
        if (-not $MsixPath) { throw 'Pass -MsixPath explicitly to opt in to package installation.' }
        $artifact = (Resolve-Path -LiteralPath $MsixPath -ErrorAction Stop).Path
        $zip = [IO.Compression.ZipFile]::OpenRead($artifact)
        try {
            $reader = [IO.StreamReader]::new($zip.GetEntry('AppxManifest.xml').Open())
            try { $script:manifest = [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
        } finally { $zip.Dispose() }
        $identity = $script:manifest.Package.Identity.Name
        if (-not $identity) { throw 'MSIX manifest has no package identity.' }
        if (Get-AppxPackage -Name $identity -ErrorAction Stop) {
            throw "Package $identity already exists. Use a clean test VM; the harness will not replace it."
        }
        Add-AppPackage -Path $artifact -ErrorAction Stop
        $script:installedPackage = Get-AppxPackage -Name $identity -ErrorAction Stop
        $script:installedPackage | Should -Not -BeNullOrEmpty
    }

    AfterAll {
        if ($script:installedPackage) {
            $packageRoot = $script:installedPackage.InstallLocation.TrimEnd('\') + '\'
            Get-Process beetroot -ErrorAction SilentlyContinue |
                Where-Object { $_.Path -and $_.Path.StartsWith($packageRoot, [StringComparison]::OrdinalIgnoreCase) } |
                ForEach-Object { $_.Kill(); $_.WaitForExit(3000) | Out-Null }
            Remove-AppxPackage -Package $script:installedPackage.PackageFullName -ErrorAction Stop
        }
    }

    It "MSIX install registers Beetroot as a Startup task entry" {
        $registered = Get-AppxPackageManifest -Package $script:installedPackage.PackageFullName
        $task = $registered.SelectSingleNode("//*[local-name()='StartupTask' and @TaskId='BeetrootAutoStart']")
        $task | Should -Not -BeNullOrEmpty
        $appId = "$($script:installedPackage.PackageFamilyName)!Beetroot"
        $beetrootEntry = Get-StartApps | Where-Object { $_.AppID -eq $appId }
        $beetrootEntry | Should -Not -BeNullOrEmpty
    }

    It "process Path contains WindowsApps after MSIX-activated launch" {
        $appx = $script:installedPackage
        $appx | Should -Not -BeNullOrEmpty

        # The Application Id in AppxManifest.xml is "Beetroot" (NOT the default
        # "App"), so the activation alias is `<PFN>!Beetroot`. Launching via
        # explorer.exe shell:AppsFolder is the documented way to activate an
        # AppX entry from PowerShell.
        Start-Process "explorer.exe" -ArgumentList "shell:AppsFolder\$($appx.PackageFamilyName)!Beetroot" -WindowStyle Hidden
        Start-Sleep -Seconds 6

        $packageRoot = $appx.InstallLocation.TrimEnd('\') + '\'
        $proc = Get-Process beetroot -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -and $_.Path.StartsWith($packageRoot, [StringComparison]::OrdinalIgnoreCase) } |
            Select-Object -First 1
        $proc | Should -Not -BeNullOrEmpty
        # A sideloaded package's process Path must
        # live under WindowsApps. If it doesn't, IPC silently fell back to the
        # Run-key autostart path and the MSIX code branch wasn't exercised.
        $proc.Path | Should -Match "WindowsApps"

        if ($proc) {
            $proc.Kill()
            $proc.WaitForExit(3000) | Out-Null
        }
    }
}
