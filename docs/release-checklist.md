# Release Checklist

Official releases are maintainer operations. Keep the production application identity, updater endpoint and signing key unchanged unless a separate migration has been designed.

## Prepare

- Confirm the proposed stable version is unused in Git tags and GitHub releases.
- Start with clean version-bearing files and run `bash scripts/release.sh X.Y.Z` with the chosen version. This is a version argument, not a command to run literally.
- Review package.json, package-lock.json, Cargo.toml, Cargo.lock, tauri.conf.json and the MSIX manifest. Update CHANGELOG.md.
- Keep release notes short and user-facing: highlight behavior changes, relevant limitations and any action required on upgrade. Do not copy internal audit reports into the release body.
- Run the full pre-release gate again after the version and documentation edits; the preparation script's first preflight runs before its version changes.
- Run `npm run check:licenses`. Dependency, toolchain or font/model changes require the [attribution review](../licenses/README.md); do not regenerate notices without reviewing upstream terms.
- Submit a PR, run checks and record the exact merged commit to release.
- Confirm the protected `release` environment and release-tag rules are configured. Never put signing credentials in a file tracked by Git.

## Build a Draft

- Create and push the new `vX.Y.Z` tag only after approval, pointing to the verified commit.
- Wait for the reusable checks and signed Windows build.
- Verify that the draft's assets correspond to that source commit and version.
- Add the approved user-facing changelog to the draft body, keeping the installation instructions. The workflow currently supplies the installation section only.
- Inspect the installer payload for readable LICENSE, NOTICE and THIRD_PARTY_LICENSES.txt files matching the release source, alongside the existing font/model notices. Check each distributed package format, including MSIX when applicable. Retain the version-specific third-party source archives with release evidence and check that recipients' source links remain available.
- Check signatures with the existing updater public key, and inspect `latest.json`: version, platform, NSIS artifact and URLs for this exact release.
- Do not reuse an existing tag or overwrite a published artifact.

## Verify and Publish

- In an isolated Windows VM, test clean installation and upgrade from the current public installer using synthetic clipboard data.
- Verify history/settings preservation, startup, capture, paste, search and hotkeys.
- For the first Credential Manager migration release, upgrade from the actual public installer with synthetic legacy keys and verify migration, retry behavior and preservation of the selected data folder, images, starred entries and notes. An upgrade from a same-version local test build is not equivalent.
- A draft is not visible through the public latest-release endpoint. Installer upgrade testing is not proof of the production auto-update path.
- Obtain approval to publish the draft. Then test a real in-app update from the previous version in a separate VM.
- Check download links and update package-manager manifests separately, with approval for those external changes.
- Update all six README release banners, documentation release-status notes and the website only when the new version is available. Keep source-license and contributor links visible; do not advertise an unreleased installer as downloadable.
- For the first Apache-2.0 release, change the historical package-manager license metadata together with the new artifact version, URLs and hashes. Pin license URLs to that release tag; do not relabel previously published binaries.
- Keep Store/MSIX submission and testing separate; follow the [MSIX guide](../packaging/msix/README.md).

If a published version is broken, coordinate stopping its rollout and issue a higher corrective version. Do not silently replace its binaries.
