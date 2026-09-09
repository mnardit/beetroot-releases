# CI and Releases

## Pull Requests

`.github/workflows/ci.yml` checks frontend code, manifest versions, third-party attribution and Rust code, then builds unsigned Windows installers. It also supports `workflow_call` so releases run the same checks against the tagged commit. Rust is pinned to the version in `rust-toolchain.toml` and the attribution manifest.

PR jobs have read-only repository permissions and receive no signing secrets. The unsigned config disables updater artifact signing without changing the production endpoint or application identity.

## Dependency Audits

The npm and Rust audits are informational: a successful workflow is not a claim that their reports are empty. Rust audit installation, RustSec advisory database access and invalid advisory reports fail the job; actual advisories remain visible for maintainer review. Yanked-package lookups are best-effort: cargo-audit can omit failed registry lookups without failing, so CI explicitly reports that their completeness is unverified. This limitation does not disable RustSec advisory matching. Do not suppress an advisory solely to make CI green.

The Windows `x86_64-pc-windows-msvc` dependency graph and callers were reviewed on 2026-09-09. `rustls-webpki` was updated to 0.103.13, including the upstream certificate name-constraint fixes. The remaining Rust reports have the following scope:

| Packages                                                                | Current assessment                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quick-xml` 0.37.5                                                      | The only Windows consumer, `tauri-winrt-notification`, uses `escape::escape`, not the attribute parser or `NsReader` affected by RUSTSEC-2026-0194 and RUSTSEC-2026-0195.          |
| `quick-xml` 0.38.4, `tar`, `event-listener`, `glib`, `proc-macro-error` | Present in the cross-platform lockfile, but absent from the Windows normal/build/dev dependency graph. This is not an assessment of other platforms.                               |
| `time`                                                                  | RUSTSEC-2026-0009 affects RFC2822 parsing. Current consumers use fixed cookie date formats, ISO8601 notification dates and RFC3339 updater dates, not that parser.                 |
| `crossbeam-epoch`                                                       | RUSTSEC-2026-0204 affects pointer formatting. Its only direct consumer, `crossbeam-deque`, does not format the affected `Atomic`/`Shared` pointers.                                |
| `anyhow`                                                                | No `downcast_mut` calls were found in Beetroot or its direct dependency consumers; the context-then-mutable-downcast trigger in RUSTSEC-2026-0190 is absent.                       |
| `rand` 0.7/0.8/0.9                                                      | The resolved Windows builds do not enable `log`, a required condition of RUSTSEC-2026-0097.                                                                                        |
| `core2`, `fxhash`, `paste`, `unic-*`                                    | Unmaintained notices remain maintenance debt in transitive image/Tauri dependencies, not evidence of a specific exploitable operation. Revisit during upstream dependency updates. |

These are caller- and feature-specific assessments, not a guarantee of safety. Recheck them after dependency, feature, networking or parsing changes. Advisory details are available in the [RustSec database](https://rustsec.org/advisories/). Use `cargo tree --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc -e normal,build,dev -i <package@version>` to verify a package's consumers. Follow the [attribution procedure](../licenses/README.md) when changing dependencies.

## Official Releases

`.github/workflows/release.yml` runs for a new `v*` tag. Checks must finish before the signed build. The publishing job uses the `release` environment and the current repository's `GITHUB_TOKEN` with `contents: write`.

Maintainers configure `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as secrets in the protected `release` environment. Release tags and environment access must be restricted; signing credentials stay outside the source tree.

The release action uses `scripts/build-desktop.mjs`: after the actual Tauri build, native dependency and installer-toolchain attribution must pass before the command succeeds and the action uploads artifacts. The output is a draft release with EXE, MSI, updater signatures and `latest.json`. NSIS is preferred for the updater. Publishing the draft is a separate maintainer decision.

`scripts/release.sh` runs source checks and prepares version files locally. It does not commit or publish changes; submit the prepared version through a PR before tagging.

See the [release checklist](release-checklist.md). Do not replace existing release assets or move published tags.
