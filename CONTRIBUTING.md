# Contributing to Beetroot

Beetroot is a Windows clipboard manager built with Tauri, React and TypeScript. Read [LICENSE](LICENSE) before reusing or distributing code. Changes should stay focused on a reproducible bug or an agreed feature.

## Licensing Contributions

Beetroot is licensed under [Apache License 2.0](LICENSE). Unless you explicitly state otherwise, contributions intentionally submitted for inclusion are licensed under Apache 2.0, as described in section 5. Contributors retain copyright in their contributions; no copyright assignment or separate CLA is required.

Submit only code and assets you have the right to contribute. Preserve applicable copyright and attribution notices, including [NOTICE](NOTICE), and include the licenses of any added third-party components. Dependency or font/model changes must also follow the [attribution update procedure](licenses/README.md); ordinary application changes require no additional tools.

## Windows Setup

The native app and Rust tests require Windows. Frontend unit tests, linting and type checks can also run on Linux and macOS; the app's native features cannot run in a browser preview.

Install Node.js 20.19 or later on the Node 20 line, Git, Rust through rustup with the MSVC toolchain, Microsoft C++ Build Tools (Desktop development with C++) and WebView2 Runtime. The repository's `.nvmrc` selects Node 20; `rust-toolchain.toml` pins the Rust version used by CI and the bundled standard-library notices.

```powershell
git clone https://github.com/mnardit/beetroot-releases.git
cd beetroot-releases
npm ci
npm run tauri dev
```

Debug builds use `com.beetroot.desktop.dev` for their database, WebView2 settings and single-instance identity. They cannot enable autostart or install updates. Clipboard capture and global hotkeys still affect the current Windows session, so use a test VM for native workflows and synthetic clipboard data.

## Checks

Run from the repository root:

```powershell
node scripts/check-versions.mjs
npm run check:licenses
npm run test:coverage
npm run check:model
npm run lint
npm run format:check
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run build:desktop -- --config src-tauri/tauri.unsigned.conf.json -- --locked
```

The unsigned override disables updater signatures for local and PR builds. No maintainer keys are needed. It does not create an isolated application profile. Never use it for official auto-update artifacts.

For an isolated release-mode test binary, run `npm run build:smoke`; do not install a normal release build alongside your personal installation for testing. See the [native harness](tests/smoke/README.md).

CI enforces coverage through `npm run test:coverage`; `npm test` runs the same tests without coverage instrumentation. See [testing notes](docs/testing.md) for native test limitations.

The [E2E directory](e2e/README.md) and `playwright.config.ts` are an inactive scaffold, not a runnable test suite or part of CI. Use the checks above; the E2E README explains its status and prerequisites.

## Where to Change Code

- [Architecture](docs/architecture.md): ownership and data flow.
- [Common changes](docs/patterns.md): settings, translations and IPC.
- [File map](docs/files.md): entry points.
- [MSIX packaging](packaging/msix/README.md): Store-specific behavior.

Keep `App.tsx` a render layer; app state belongs in hooks. New IPC commands need a Rust handler, registration in `lib.rs`, a typed wrapper in `src/lib/tauri.ts` and boundary tests. Test DB behavior against real SQLite. Use existing fixtures instead of duplicating large settings objects.

Follow ESLint, Prettier and Rustfmt. Share constants where they represent a shared contract; keep one-off values local. Avoid unrelated rewrites, new frameworks and mass formatting in a bug-fix PR.

## Pull Requests

1. Fork the repository if you do not have write access, then create a focused branch from `main`. Open your PR against `mnardit/beetroot-releases:main`.
2. Explain the behavior being changed and provide reproduction steps.
3. Add focused regression tests and run the relevant checks.
4. For UI or native changes, include screenshots or manual test results with Windows version.
5. Do not include API keys, clipboard databases, signing material or generated installers.

For user-visible changes, add a short entry under **Unreleased** in `CHANGELOG.md`. Describe the effect on the user rather than internal implementation details. Do not bump the application version in an ordinary fix or feature PR.

CI builds fork PRs without signing secrets. Official releases are maintainer operations described in the [release checklist](docs/release-checklist.md).

## Dependency Updates

Dependabot opens at most one version-update PR per dependency ecosystem (npm and Cargo) at a time. Security updates are separate from this limit. A dependency PR initially fails `check:licenses` when its lockfile changes; the bot does not perform the required attribution review.

Before merging, a maintainer or contributor must follow [licenses/README.md](licenses/README.md), review the changed components and licenses, and include the regenerated attribution files in the same PR. Then rerun `npm run check:licenses` and the normal checks. Do not bypass this gate or refresh input fingerprints without reviewing the dependency changes.
