# File Map

| Area                          | Entry points                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| UI composition                | `src/App.tsx`, `src/hooks/useAppState.ts`                                                       |
| Search and selection          | `src/hooks/useSearchAndFilter.ts`, `src/hooks/useBatchOperations.ts`                            |
| Clipboard capture and actions | `src/hooks/useClipboardMonitor.ts`, `src/hooks/useClipboardActions.ts`                          |
| History state                 | `src/hooks/useDatabase.ts`                                                                      |
| Settings                      | `src/lib/settings.ts`, `src/components/Settings.tsx`, `src/components/SettingsAI.tsx`           |
| IPC                           | `src/lib/tauri.ts`, `src/lib/db.ts`, `src-tauri/src/commands/`                                  |
| AI                            | `src/lib/openai.ts` (configuration helpers), `src-tauri/src/ai.rs`, `src-tauri/src/jobs.rs`     |
| API key storage               | `src-tauri/src/secrets.rs`, `src/lib/secrets-migration.ts`, `src/components/CloudKeyEditor.tsx` |
| Search engine                 | `src-tauri/src/search.rs`                                                                       |
| Database and recovery         | `src-tauri/src/commands/db.rs`, `src-tauri/src/migrations.rs`, `src-tauri/src/backup.rs`        |
| Startup and native lifecycle  | `src-tauri/src/lib.rs`, `src-tauri/src/window.rs`, `src-tauri/src/hotkey.rs`                    |
| Localization                  | `src/lib/i18n.ts`, `src/lib/locales/`                                                           |
| Tests                         | `src/**/__tests__/`, `src/test/`, Rust inline tests, `src-tauri/tests/`                         |
| Native smoke                  | `tests/smoke/`; isolated VM only                                                                |
| Packaging                     | `src-tauri/tauri.conf.json`, `packaging/`                                                       |
| Release preparation           | `scripts/release.sh`, `scripts/prepare-version.mjs`, `scripts/check-versions.mjs`               |

This map lists ownership boundaries rather than line counts or an exhaustive list of components. See [architecture](architecture.md) for data flow.
