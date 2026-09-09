param([Parameter(Mandatory)][string]$AppDirectory)

$ErrorActionPreference = 'Stop'
$directory = (Get-Item -LiteralPath $AppDirectory).FullName.TrimEnd('\')
if ($directory -notmatch '\\apps\\beetroot\\(current|\d+\.\d+\.\d+)$') {
    throw 'Expected the Beetroot application directory returned by scoop prefix beetroot.'
}

$manifestPath = Join-Path $directory 'manifest.json'
$raw = [IO.File]::ReadAllText($manifestPath)
$manifest = $raw | ConvertFrom-Json
if ($manifest.homepage -ne 'https://github.com/mnardit/beetroot-releases') {
    throw 'This is not the official Beetroot manifest.'
}
if ($manifest.uninstaller.file -eq 'uninstall.exe') {
    Write-Output 'The Beetroot uninstaller entry is already correct.'
    return
}
if ($manifest.version -notmatch '^\d+\.\d+\.\d+$' -or
    [version]$manifest.version -gt [version]'1.6.6' -or
    $manifest.uninstaller.file -notin @('$dir\Uninstall Beetroot.exe', '$dir\\Uninstall Beetroot.exe')) {
    throw 'Unrecognized manifest; no changes were made.'
}
if (-not (Test-Path -LiteralPath (Join-Path $directory 'uninstall.exe') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $directory 'beetroot.exe') -PathType Leaf)) {
    throw 'The installed Beetroot executable or uninstaller is missing.'
}

$backupPath = "$manifestPath.before-uninstaller-fix"
if (Test-Path -LiteralPath $backupPath) {
    throw "A backup already exists: $backupPath. Inspect it before retrying."
}
Copy-Item -LiteralPath $manifestPath -Destination $backupPath
$manifest.uninstaller.file = 'uninstall.exe'
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 30) + "`n", [Text.UTF8Encoding]::new($false))
Write-Output 'Corrected the cached uninstaller entry. Run scoop update beetroot again.'
Write-Output "Original manifest retained at $backupPath. Application data was not changed."
