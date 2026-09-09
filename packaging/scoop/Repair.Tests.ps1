BeforeAll {
    $repair = Join-Path $PSScriptRoot 'repair-beetroot.ps1'
    function New-InstalledFixture {
        param([string]$Name, [string]$Uninstaller = '$dir\Uninstall Beetroot.exe')
        $directory = Join-Path $TestDrive "$Name/apps/beetroot/1.6.6"
        $null = New-Item -ItemType Directory -Path $directory -Force
        $manifest = Get-Content (Join-Path $PSScriptRoot 'beetroot.json') -Raw | ConvertFrom-Json
        $manifest.version = '1.6.6'
        $manifest.uninstaller.file = $Uninstaller
        $manifest | ConvertTo-Json -Depth 30 | Set-Content (Join-Path $directory 'manifest.json')
        [IO.File]::WriteAllText((Join-Path $directory 'beetroot.exe'), 'inert fixture')
        [IO.File]::WriteAllText((Join-Path $directory 'uninstall.exe'), 'inert fixture')
        return $directory
    }
}

Describe 'Repair of the legacy Scoop uninstaller entry' {
    It 'changes only the known field and keeps the exact original backup' {
        $directory = New-InstalledFixture 'repair'
        $path = Join-Path $directory 'manifest.json'
        $before = [IO.File]::ReadAllText($path)
        & $repair -AppDirectory $directory
        [IO.File]::ReadAllText("$path.before-uninstaller-fix") | Should -BeExactly $before
        $actual = Get-Content $path -Raw | ConvertFrom-Json
        $expected = $before | ConvertFrom-Json
        $expected.uninstaller.file = 'uninstall.exe'
        ($actual | ConvertTo-Json -Depth 30 -Compress) | Should -BeExactly ($expected | ConvertTo-Json -Depth 30 -Compress)
        [IO.File]::ReadAllText((Join-Path $directory 'beetroot.exe')) | Should -BeExactly 'inert fixture'
        { & $repair -AppDirectory $directory } | Should -Not -Throw
    }

    It 'handles the double-backslash variant from the old bucket' {
        $directory = New-InstalledFixture 'double' '$dir\\Uninstall Beetroot.exe'
        & $repair -AppDirectory $directory
        (Get-Content (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json).uninstaller.file | Should -Be 'uninstall.exe'
    }

    It 'refuses an unrelated application path' {
        { & $repair -AppDirectory $TestDrive } | Should -Throw '*Expected the Beetroot*'
    }

    It 'refuses an unfamiliar uninstaller without editing the manifest' {
        $directory = New-InstalledFixture 'unknown' 'other.exe'
        $path = Join-Path $directory 'manifest.json'
        $before = [IO.File]::ReadAllText($path)
        { & $repair -AppDirectory $directory } | Should -Throw '*Unrecognized manifest*'
        [IO.File]::ReadAllText($path) | Should -BeExactly $before
        Test-Path "$path.before-uninstaller-fix" | Should -BeFalse
    }

    It 'refuses a missing real uninstaller' {
        $directory = New-InstalledFixture 'missing'
        Remove-Item -LiteralPath (Join-Path $directory 'uninstall.exe')
        { & $repair -AppDirectory $directory } | Should -Throw '*uninstaller is missing*'
    }

    It 'never overwrites an existing backup' {
        $directory = New-InstalledFixture 'backup'
        $path = Join-Path $directory 'manifest.json'
        $before = [IO.File]::ReadAllText($path)
        [IO.File]::WriteAllText("$path.before-uninstaller-fix", 'existing backup')
        { & $repair -AppDirectory $directory } | Should -Throw '*backup already exists*'
        [IO.File]::ReadAllText($path) | Should -BeExactly $before
        [IO.File]::ReadAllText("$path.before-uninstaller-fix") | Should -BeExactly 'existing backup'
    }
}
