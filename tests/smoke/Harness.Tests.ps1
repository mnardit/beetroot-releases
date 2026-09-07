BeforeDiscovery {
    Import-Module "$PSScriptRoot/lib/AppLifecycle.psm1" -Force
    Import-Module "$PSScriptRoot/lib/DbInspect.psm1" -Force
    Import-Module "$PSScriptRoot/lib/HotkeyOps.psm1" -Force
}

Describe 'Smoke runner exit status' {
    BeforeAll {
        function Invoke-InertSmokeRunner {
            param([scriptblock[]]$Fixture)

            # Execute only the runner's final exit decision, never its app-suite setup.
            $runner = Join-Path $PSScriptRoot 'run-smoke.ps1'
            $tokens = $null
            $parseErrors = $null
            $ast = [System.Management.Automation.Language.Parser]::ParseFile($runner, [ref]$tokens, [ref]$parseErrors)
            if ($parseErrors.Count -gt 0) { throw "Cannot parse smoke runner: $parseErrors" }
            $decision = $ast.EndBlock.Statements[-1]
            if ($decision -isnot [System.Management.Automation.Language.IfStatementAst]) {
                throw 'Expected the smoke runner to end with its exit decision.'
            }
            $command = @'
$ErrorActionPreference = 'Stop'
Import-Module Pester -MinimumVersion 5.5.0
$config = New-PesterConfiguration
$config.Run.Container = @(
__CONTAINERS__
)
$config.Filter.ExcludeTag = @('MSIX')
$config.Output.Verbosity = 'None'
$config.Run.PassThru = $true
$result = Invoke-Pester -Configuration $config
Write-Output ('SYNTHETIC_PESTER ' + ($result | Select-Object Result, FailedCount, PassedCount, FailedBlocksCount, FailedContainersCount | ConvertTo-Json -Compress))
__DECISION__
exit 0
'@
            $containers = ($Fixture | ForEach-Object { "New-PesterContainer -ScriptBlock {`n$_`n}" }) -join "`n"
            $command = $command.Replace('__CONTAINERS__', $containers).Replace('__DECISION__', $decision.Extent.Text)
            $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
            $output = & (Join-Path $PSHOME 'pwsh.exe') -NoProfile -NonInteractive -Sta -EncodedCommand $encoded 2>&1
            $exitCode = $LASTEXITCODE
            $summary = $output | ForEach-Object { "$_" } | Where-Object { $_.StartsWith('SYNTHETIC_PESTER ') }
            if (@($summary).Count -ne 1) { throw "Missing synthetic Pester result: $output" }
            [pscustomobject]@{
                ExitCode = $exitCode
                Result = $summary.Substring('SYNTHETIC_PESTER '.Length) | ConvertFrom-Json
            }
        }
    }

    It 'succeeds when an executed test passes' {
        $run = Invoke-InertSmokeRunner {
            Describe 'Synthetic pass' { It 'passes' { 1 | Should -Be 1 } }
        }
        $run.Result.Result | Should -Be 'Passed'
        $run.Result.PassedCount | Should -Be 1
        $run.ExitCode | Should -Be 0
    }

    It 'fails when an executed test fails' {
        $run = Invoke-InertSmokeRunner {
            Describe 'Synthetic failure' { It 'fails' { 1 | Should -Be 2 } }
        }
        $run.Result.FailedCount | Should -Be 1
        $run.ExitCode | Should -Be 1
    }

    It 'fails when BeforeAll setup fails' {
        $run = Invoke-InertSmokeRunner {
            Describe 'Synthetic pass' { It 'passes' { 1 | Should -Be 1 } }
            Describe 'Synthetic setup failure' {
                BeforeAll { throw 'Synthetic setup failure' }
                It 'never executes' { 1 | Should -Be 1 }
            }
        }
        $run.Result.Result | Should -Be 'Failed'
        $run.Result.FailedBlocksCount | Should -Be 1
        $run.Result.FailedCount | Should -Be 1
        $run.Result.PassedCount | Should -Be 1
        $run.ExitCode | Should -Be 1
    }

    It 'fails on discovery setup failure even with a passing test and no failed tests' {
        $run = Invoke-InertSmokeRunner -Fixture @(
            { Describe 'Synthetic pass' { It 'passes' { 1 | Should -Be 1 } } }
            {
                BeforeDiscovery { throw 'Synthetic discovery failure' }
                Describe 'Synthetic discovery failure' {
                    It 'never executes' { 1 | Should -Be 1 }
                }
            }
        )
        $run.Result.Result | Should -Be 'Failed'
        $run.Result.FailedContainersCount | Should -Be 1
        $run.Result.FailedCount | Should -Be 0
        $run.Result.PassedCount | Should -Be 1
        $run.ExitCode | Should -Be 1
    }

    It 'fails on teardown failure even with a passing test and no failed tests' {
        $run = Invoke-InertSmokeRunner {
            Describe 'Synthetic teardown failure' {
                It 'passes' { 1 | Should -Be 1 }
                AfterAll { throw 'Synthetic teardown failure' }
            }
        }
        $run.Result.Result | Should -Be 'Failed'
        $run.Result.FailedBlocksCount | Should -Be 1
        $run.Result.FailedCount | Should -Be 0
        $run.Result.PassedCount | Should -Be 1
        $run.ExitCode | Should -Be 1
    }

    It 'fails when there are no tests' {
        $run = Invoke-InertSmokeRunner {
            Describe 'Synthetic empty container' {}
        }
        $run.Result.FailedCount | Should -Be 0
        $run.Result.PassedCount | Should -Be 0
        $run.ExitCode | Should -Be 1
    }

    It 'fails when every test is skipped' {
        $run = Invoke-InertSmokeRunner {
            Describe 'Synthetic skipped container' { It 'is skipped' -Skip {} }
        }
        $run.Result.FailedCount | Should -Be 0
        $run.Result.PassedCount | Should -Be 0
        $run.ExitCode | Should -Be 1
    }

    It 'fails when every test is excluded by the runner filter' {
        $run = Invoke-InertSmokeRunner {
            Describe 'Synthetic filtered container' -Tag 'MSIX' {
                It 'is excluded' { 1 | Should -Be 1 }
            }
        }
        $run.Result.FailedCount | Should -Be 0
        $run.Result.PassedCount | Should -Be 0
        $run.ExitCode | Should -Be 1
    }
}

Describe 'Smoke popup identification' {
    It 'matches the smoke popup by class and title' {
        [BeetrootWinProbe]::IsSmokePopup('Tauri Window', 'Beetroot Smoke') | Should -BeTrue
    }

    It 'does not mistake the copy overlay for the popup' {
        [BeetrootWinProbe]::IsSmokePopup('Tauri Window', '') | Should -BeFalse
    }

    It 'does not match a different window class or build title' {
        [BeetrootWinProbe]::IsSmokePopup('tray_icon_app', 'Beetroot Smoke') | Should -BeFalse
        [BeetrootWinProbe]::IsSmokePopup('Tauri Window', 'Beetroot') | Should -BeFalse
    }
}

Describe 'Smoke environment isolation' {
    InModuleScope AppLifecycle {
        BeforeEach {
            Mock Get-CimInstance { [pscustomobject]@{Manufacturer='Microsoft Corporation'; Model='Virtual Machine'} }
            Mock Get-Process { @() }
        }

        It 'rejects a physical host before querying its processes' {
            Mock Get-CimInstance { [pscustomobject]@{Manufacturer='Physical'; Model='Desktop'} }
            { Assert-BeetrootSmokeEnvironment } | Should -Throw '*disposable Hyper-V VM*'
            Should -Invoke Get-Process -Times 0
        }

        It 'rejects clipboard redirection in the current session' {
            Mock Get-Process { [pscustomobject]@{SessionId=[Diagnostics.Process]::GetCurrentProcess().SessionId} } -ParameterFilter { $Name -eq 'rdpclip' }
            { Assert-BeetrootSmokeEnvironment } | Should -Throw '*clipboard redirection*'
        }

        It 'does not mistake another session for the test session' {
            Mock Get-Process { [pscustomobject]@{SessionId=-1} } -ParameterFilter { $Name -eq 'rdpclip' }
            { Assert-BeetrootSmokeEnvironment } | Should -Not -Throw
        }

        It 'rejects an existing application process' {
            Mock Get-Process { [pscustomobject]@{Id=123} } -ParameterFilter { $Name -eq 'beetroot' }
            { Assert-BeetrootSmokeEnvironment } | Should -Throw '*Close Beetroot*'
        }

        It 'allows an isolated VM with no application process' {
            { Assert-BeetrootSmokeEnvironment } | Should -Not -Throw
        }
    }
}

Describe 'Smoke lifecycle ownership' {
    InModuleScope AppLifecycle {
        BeforeEach {
            $script:DataPath = $null
            $script:Process = $null
        }

        It 'cannot fall back to the installed database before a smoke launch' {
            { Get-BeetrootDbPath } | Should -Throw '*isolated profile*'
        }

        It 'does not read data_path.txt when resolving the smoke database' {
            $script:DataPath = Join-Path $TestDrive 'smoke-profile'
            Mock Get-Content { throw 'Unexpected profile redirect read' }
            Get-BeetrootDbPath | Should -Be (Join-Path $script:DataPath 'clipboard.db')
            Should -Invoke Get-Content -Times 0
        }

        It 'refuses to stop a process it did not start' {
            $unrelated = [Diagnostics.Process]::GetCurrentProcess()
            { Stop-Beetroot -Process $unrelated } | Should -Throw '*not started by this harness*'
            $unrelated.HasExited | Should -BeFalse
        }

        It 'refuses to replace a still-running owned process' {
            $script:Process = [Diagnostics.Process]::GetCurrentProcess()
            { Start-Beetroot } | Should -Throw '*still running*'
        }
    }
}

Describe 'Smoke SQLite inspection' {
    InModuleScope DbInspect {
        BeforeAll {
            # Unit tests mock the CLI, so sqlite3 need not be installed in CI.
            function script:sqlite3.exe { throw 'Unmocked sqlite3 call in a unit test' }
        }
        AfterAll {
            Remove-Item Function:\script:sqlite3.exe
        }
        BeforeEach {
            Mock Get-BeetrootDbPath { Join-Path $TestDrive 'clipboard.db' }
            Mock Test-Path { $true }
            $global:LASTEXITCODE = 0
        }

        It 'uses read-only JSON and preserves tabs, newlines and quotes in clips' {
            Mock sqlite3.exe { '[{"id":1,"content":"first\tcolumn\nsecond \"line\"","content_type":"text"}]' }
            $items = @(Get-BeetrootHistoryItems -Limit 5)
            $items.Count | Should -Be 1
            $items[0].content | Should -Be "first`tcolumn`nsecond `"line`""
            Should -Invoke sqlite3.exe -Times 1 -ParameterFilter {
                $args[0] -eq '-readonly' -and $args[1] -eq '-json' -and $args[3] -like '*LIMIT 5;'
            }
        }

        It 'returns an empty history for an empty SQLite response' {
            Mock sqlite3.exe { '' }
            @(Get-BeetrootHistoryItems).Count | Should -Be 0
        }

        It 'propagates SQLite failures instead of returning an empty history' {
            Mock sqlite3.exe { $global:LASTEXITCODE = 1; 'database is locked' }
            { Get-BeetrootHistoryItems } | Should -Throw '*sqlite3 query failed*'
        }
    }
}
