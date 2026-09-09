# Package Manager Manifests

This directory contains manifests for distributing Beetroot through Windows package managers.

The checked-in manifests describe the published 1.6.7 binaries under Apache-2.0. Manifest metadata must match the distributed binary.

For each new release, update the version, artifact URLs, hashes and license metadata together. Pin license URLs to the corresponding release tag and leave previously published artifacts unchanged.

Package availability and approval status live in the package-manager repositories and registries, not in this source snapshot. Check the target registry before announcing a package release.

## Winget (Windows Package Manager)

Files in `winget/`:

- `MNardit.Beetroot.yaml` - Version manifest
- `MNardit.Beetroot.installer.yaml` - Installer manifest
- `MNardit.Beetroot.locale.en-US.yaml` - Locale manifest

**Repo:** Fork of [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) at `mnardit/winget-pkgs`
**Manifest path:** `manifests/m/MNardit/Beetroot/{version}/`

### Update Process

1. Update version + SHA256 in all 3 YAML files here
2. Copy to fork: `manifests/m/MNardit/Beetroot/X.Y.Z/MNardit.Beetroot.*.yaml`
3. Submit PR to `microsoft/winget-pkgs`

## Scoop

**Bucket repo:** [mnardit/scoop-bucket](https://github.com/mnardit/scoop-bucket)
**Source manifest:** `scoop/beetroot.json` (copy lives in bucket repo as `bucket/beetroot.json`)

The manifest includes `checkver` and `autoupdate` templates. Maintainers must run the updater and publish the resulting manifest; these fields alone do not update the bucket on GitHub.

### Update Process

1. Update `scoop/beetroot.json` here (version, URL, hash and pinned license URL).
2. Copy to `mnardit/scoop-bucket`: `bucket/beetroot.json` and the retained root-level `beetroot.json` compatibility copy. Keep both identical.
3. Verify installation/update and push the reviewed bucket changes.

### Existing Scoop Installations

Exit Beetroot from its tray menu before updating. The manifests through 1.6.6 named the wrong uninstaller. Scoop caches that manifest locally and runs its uninstaller before loading the new version, so an affected installation needs a one-time repair:

```powershell
scoop update
$scoopRoot = if ($env:SCOOP) { $env:SCOOP } else { Join-Path $env:USERPROFILE 'scoop' }
& (Join-Path $scoopRoot 'buckets/beetroot/scripts/repair-beetroot.ps1') -AppDirectory (scoop prefix beetroot)
scoop update beetroot
```

The [repair script](scoop/repair-beetroot.ps1) only corrects the known cached uninstaller field after validating the application path and manifest. It preserves an exact backup and does not delete application data. It refuses unfamiliar or incomplete installations. Maintainers keep the bucket's script identical to this copy and run `Invoke-Pester packaging/scoop/Repair.Tests.ps1` before publication.

## Chocolatey

Files in `chocolatey/`:

- `beetroot.nuspec` - Package specification
- `tools/chocolateyinstall.ps1` - Install script
- `tools/chocolateyuninstall.ps1` - Uninstall script

### Submission Process

1. Create account at [chocolatey.org](https://chocolatey.org)
2. Update version + checksum in `nuspec` and `chocolateyinstall.ps1`
3. Build package: `choco pack`
4. Push: `choco push beetroot.X.Y.Z.nupkg --source https://push.chocolatey.org/`

## User Updates

After the respective registry has accepted the package:

```powershell
winget upgrade --id MNardit.Beetroot --exact --source winget
scoop update beetroot
choco upgrade beetroot
```

Winget PR validation/merge and Chocolatey moderation are separate from the GitHub release. Scoop updates become available after the bucket is published and refreshed. Do not announce all three as available based only on a successful submission.

## After Each Release

1. Calculate SHA256: `certutil -hashfile Beetroot_X.Y.Z_x64-setup.exe SHA256`
2. Update version + hash + URL in all manifests (this directory)
3. Push updated `beetroot.json` to `mnardit/scoop-bucket`
4. Submit winget PR to `microsoft/winget-pkgs`
5. Push chocolatey package (if account exists)
