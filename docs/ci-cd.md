# CI and Releases

## Pull Requests

`.github/workflows/ci.yml` checks frontend code, manifest versions, third-party attribution and Rust code, then builds unsigned Windows installers. It also supports `workflow_call` so releases run the same checks against the tagged commit. Rust is pinned to the version in `rust-toolchain.toml` and the attribution manifest.

PR jobs have read-only repository permissions and receive no signing secrets. The unsigned config disables updater artifact signing without changing the production endpoint or application identity.

## Official Releases

`.github/workflows/release.yml` runs for a new `v*` tag. Checks must finish before the signed build. The publishing job uses the `release` environment and the current repository's `GITHUB_TOKEN` with `contents: write`.

The environment must be configured by the maintainer with the existing `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Restrict release tags and environment access before enabling official publishing. Repository configuration is not created merely by adding the workflow file.

The release action uses `scripts/build-desktop.mjs`: after the actual Tauri build, native dependency and installer-toolchain attribution must pass before the command succeeds and the action uploads artifacts. The output is a draft release with EXE, MSI, updater signatures and `latest.json`. NSIS is preferred for the updater. Publishing the draft is a separate maintainer decision.

`scripts/release.sh` only prepares version files locally. It does not push, commit, sign, publish or update external package-manager repositories. There is no cross-repository publication token.

See the [release checklist](release-checklist.md). Do not replace existing release assets or move published tags.
