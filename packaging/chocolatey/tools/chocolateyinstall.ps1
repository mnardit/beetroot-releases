$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/mnardit/beetroot-releases/releases/download/v1.6.6/Beetroot_1.6.6_x64-setup.exe'
  softwareName   = 'Beetroot*'
  checksum64     = 'd11683daa88e5488ca4256aaf057f7ebff48fbbc85661b8ce12469fa09ceeeb5'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
