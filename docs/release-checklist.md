# Release Checklist

Maintainers publish official releases through the [release workflow](ci-cd.md#official-releases). Keep the production application identity, updater endpoint and signing key stable unless a migration is planned.

## Prepare

- Choose a version unused in Git tags and GitHub releases. With clean version-bearing files, run `bash scripts/release.sh X.Y.Z` in Git Bash.
- Review the npm, Cargo, Tauri and MSIX version changes. Update `CHANGELOG.md` with concise user-facing notes, limitations and any required upgrade steps.
- After the edits, run `bash scripts/pre-release-check.sh` again. Dependency, toolchain and font/model changes also require the [attribution review](../licenses/README.md).
- Submit a PR, wait for passing checks and record the merged commit to release.

## Build a Draft

- Confirm release-tag protections and the protected `release` environment. After maintainer approval, push a new `vX.Y.Z` tag pointing to the verified commit and wait for the checks and signed build.
- Verify each package's source commit, version, hashes and [bundled licenses](../licenses/README.md#distribution-check). Retain the corresponding third-party source archives and check their download links.
- Verify updater signatures with the production public key. Check the version, platform, NSIS artifact and URLs in `latest.json`.
- Add the user-facing changelog to the draft body, retaining the generated installation instructions.

## Verify and Publish

- In an isolated Windows VM, test clean installation and upgrade from the current public installer with synthetic data. Verify history, images, notes, settings and credential migrations, then exercise startup, capture, paste, search and hotkeys.
- After maintainer approval, publish the draft and verify public downloads and a real in-app update from the previous version in a separate VM. A private draft is unavailable to the public updater, so installer testing alone does not verify that path.
- Once the release is available, update translated README banners, documentation release status and the website. Update [package-manager manifests](../packaging/README.md) separately with the version, URLs, hashes and matching license metadata; pin license links to the release tag.
- Test and submit Store/MSIX updates separately using the [MSIX guide](../packaging/msix/README.md).

Published tags and artifacts are immutable. If a release is broken, coordinate stopping its rollout and issue a higher corrective version instead of replacing its binaries.
