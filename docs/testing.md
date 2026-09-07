# Testing

## Automated Checks

```powershell
npm test
npm run check:model
npm run lint
npm run format:check
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Vitest uses happy-dom and the shared setup in `src/test/setup.ts`. Tauri IPC and events are mocked globally. Mock the imported `invoke` function or the typed wrapper; `mockIPC` does not intercept a globally replaced `invoke`.

Prefer `container` queries or `within(container)`. Reuse `makeEntry()` and `defaultSettings()` from `src/test/fixtures.ts`. Clipboard entries use `starred: boolean`; Rust handles SQLite representation.

Credential unit tests use an explicitly constructed in-memory keyring entry, never the real Windows vault. Migration tests cover partial progress, retry, concurrent startup, storage-write failure and secret-free errors. `useAppState` tests assert migration/status ordering before Win10 and autostart settings saves. Test real Credential Manager persistence separately in a disposable VM, including an app restart and migration from synthetic legacy settings.

Backend unit tests exercise core functions against real SQLite and the migration schema. IPC mocks do not establish that native persistence or OS behavior works.

`npm run check:model` builds the language detector with the production Vite configuration and runs that bundle against the real local weights, using the existing happy-dom environment. It checks Python, Rust and SQL detection without network access and catches missing dynamic backend chunks that mocked unit tests cannot detect. It uses a temporary output directory, leaving `dist` untouched. Native WebView2 acceptance remains a separate check.

## Coverage

`npm run test:coverage` separately enforces the thresholds in `vite.config.ts`. A passing `npm test` does not imply those thresholds pass. Improve behavioral coverage where changes carry risk; do not lower thresholds or delete tests to obtain a green result.

## Native Tests

Run the [native harness](../tests/smoke/README.md) in a disposable Hyper-V Windows VM. It overwrites the session clipboard and sends global hotkeys, so it refuses to run on the physical host or alongside an existing Beetroot process. `npm run build:smoke` produces a separate release-mode test binary with no updater/autostart access. Every test launch receives its own DB and WebView2 profile; the harness stops only processes it started. MSIX installation requires an explicit `-MsixPath` and a clean package state.

The PowerShell harness unit tests do not launch Beetroot or touch the clipboard: `Invoke-Pester tests/smoke/Harness.Tests.ps1`. `npm run audit:locales` validates translated interpolation parameters and reports missing keys, which use the English fallback.

Exercise capture, paste suppression, search, hotkeys, settings and application restart with synthetic data. Use a real MSIX installation when testing Store autostart; see [MSIX packaging](../packaging/msix/README.md). Test standalone installation and updater behavior separately from Store updates.

`e2e/` is an inactive Playwright scaffold, not part of the verified test suite. See [its status](../e2e/README.md) before using it.
