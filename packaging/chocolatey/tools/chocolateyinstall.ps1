$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/mnardit/beetroot-releases/releases/download/v1.6.7/Beetroot_1.6.7_x64-setup.exe'
  softwareName   = 'Beetroot*'
  checksum64     = '1f2ba334edc1fbaf89cb75dfe732799031ff1a187124b84be5b2e48374adafb6'
  checksumType64 = 'sha256'
  silentArgs     = '/S /ALLUSERS'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
