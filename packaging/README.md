# Package Manager Manifests

This directory contains manifests for distributing Beetroot through Windows package managers.

The checked-in manifests describe the published 1.6.6 binaries and their original proprietary license, not the current Apache-2.0 source. Manifest metadata must match the distributed binary.

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

The manifest includes `checkver` and `autoupdate` — Scoop can auto-detect new releases.

### Update Process

1. Update `scoop/beetroot.json` here (version, hash)
2. Copy to `mnardit/scoop-bucket` repo: `bucket/beetroot.json`
3. Push to scoop-bucket

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

## After Each Release

1. Calculate SHA256: `certutil -hashfile Beetroot_X.Y.Z_x64-setup.exe SHA256`
2. Update version + hash + URL in all manifests (this directory)
3. Push updated `beetroot.json` to `mnardit/scoop-bucket`
4. Submit winget PR to `microsoft/winget-pkgs`
5. Push chocolatey package (if account exists)
