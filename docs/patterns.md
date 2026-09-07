# Common Changes

## Add an IPC Command

1. Implement the handler in the appropriate `src-tauri/src/commands/` domain module.
2. Make it accessible through the commands module and register it in `src-tauri/src/lib.rs`.
3. Add a typed wrapper in `src/lib/tauri.ts`; new consumers use that wrapper.
4. Test serialization, error behavior and input validation. DB logic should be tested with a real migrated SQLite connection.

Existing handlers use both `Result<T, AppError>` and `Result<T, String>`. Preserve the boundary's actual serialized error behavior instead of assuming one universal error type. Match Rust serde field naming and optional values in TypeScript.

## Add a Setting

1. Update `AppSettings`, `defaults` and `sanitize()` in `src/lib/settings.ts`.
2. Wire the relevant settings component to the draft in `src/components/Settings.tsx`. The draft uses `AppSettings`; do not duplicate its type or defaults.
3. Add validation and persistence tests. Reuse `defaultSettings()` from `src/test/fixtures.ts`.
4. Put app-level state and effects in `useAppState` or a focused hook, not `App.tsx`.

Unknown or malformed persisted values must not bypass sanitization. Test upgrade behavior with older settings objects.

## Add a Translation

English keys are defined in `src/lib/i18n.ts`. Other dictionaries live in `src/lib/locales/` and use `TranslationDictionary`, a partial dictionary with checked key names. Add an English key and translate it where possible; missing translations fall back to English without blocking compilation of all other locales.

Use `useTranslation()` and typed keys. Interpolated strings use named parameters. Run `npm run audit:locales` to report missing keys and catch translated parameter mismatches. Fallback and interpolation are covered by deterministic tests with an intentionally partial dictionary.

## Change AI Behavior

Credentials are not settings fields or job payload fields. Use `saveApiKey`, `deleteApiKey`, `getApiKeyStatus` and `validateApiKey` from `src/lib/tauri.ts`. Rust accepts only the four cloud providers; do not add renderer-side provider HTTP requests or a secret-reading IPC command.

Configuration helpers live in `src/lib/openai.ts`; provider requests run in `src-tauri/src/ai.rs` through `jobs.rs`. Check both context-menu and transform-menu submission paths when changing a job payload. Test failure, cancellation and persistence behavior, not only menu rendering.

## Change Windows Integration

Follow the nearest native implementation and its safety comments. Keep multi-monitor show behavior routed through the existing window helpers.

For Store-aware behavior, see `src-tauri/src/commands/autostart.rs` and `src-tauri/src/startup_task.rs`. Validate a real installed MSIX path in WindowsApps, not a loose manifest registration. See [MSIX testing](../packaging/msix/README.md).
