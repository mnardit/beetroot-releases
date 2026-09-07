# Architecture

Beetroot runs as a Windows tray application. A Tauri WebView renders the React interface; Rust owns SQLite access, native OS integration and AI job execution.

## Frontend

`src/main.tsx` mounts the application. `src/App.tsx` renders state assembled by `src/hooks/useAppState.ts`. The compositor combines search/filter state, clipboard actions, batch operations and window/overlay behavior.

Components live in `src/components`. Settings are validated and persisted in WebView localStorage by `src/lib/settings.ts`; they are not stored in SQLite. AI keys are stored by `src-tauri/src/secrets.rs` in Windows Credential Manager, scoped to the build identifier. The renderer keeps only provider configuration and boolean key status; newly entered keys exist briefly in the dedicated editor.

`src/lib/tauri.ts` provides typed IPC wrappers. `src/lib/db.ts` adds thin timed wrappers around DB calls. Frontend mocks exercise these boundaries but do not replace backend tests.

English strings live in `src/lib/i18n.ts`; other dictionaries are loaded from `src/lib/locales`. Styles use BEM and shared CSS variables. The clipboard list uses react-window v2.

## Backend

`src-tauri/src/lib.rs` initializes the data path, database, migrations, plugins, windows and command registration. `commands/mod.rs` contains shared DB access helpers; commands are grouped by domain.

- `commands/db.rs`: history CRUD, pruning and search commands; testable core functions accept a SQLite connection.
- `commands/images.rs`: image storage, thumbnails and cleanup.
- `commands/paste.rs`: native paste orchestration.
- `commands/ai_cmds.rs`, `jobs.rs`, `ai.rs`: submission, bounded background queue and provider requests.
- `commands/autostart.rs`, `startup_task.rs`: regular and Microsoft Store startup paths.
- `hotkey.rs`, `window.rs`, `source_app` command module: keyboard, monitor and source-application integration.
- `migrations.rs`, `backup.rs`: schema evolution, backups and recovery.

Database operations use Rust/rusqlite with WAL and serialized connection access. Preserve atomic UPSERT behavior and append new migrations rather than rewriting existing ones.

## Important Boundaries

Clipboard content is untrusted input. Path validation and request-size limits belong at native boundaries, not only in the UI. Preserve paste suppression, hotkey layout handling and window positioning guards when changing native workflows.

Startup awaits `src/lib/secrets-migration.ts`, then loads key statuses, before any startup path may save settings. Each legacy `beetroot_settings` key is removed only after a verified vault write. Failed migrations can be retried; existing vault keys are not overwritten by retries. Ordinary settings saves refuse to erase remaining legacy credentials.

Only `save_api_key` accepts a secret. Status, deletion and provider validation use the closed cloud-provider ID set through typed wrappers. AI jobs contain no key; workers load it immediately before a request. Validation uses the saved key in a Rust request to the provider's model-list endpoint, without a generation request. Credential failures must never serialize raw keyring errors.

Cloud AI sends user-selected content to the configured provider. Local AI uses a validated local endpoint. Updater traffic goes to GitHub and is independent of WebView CSP. Tauri update signatures are not Windows Authenticode signatures.

Production data defaults to `%APPDATA%/com.beetroot.desktop` and can be redirected by the user. `build_profile.rs` selects `.dev` for debug builds and `.smoke.<run-id>` for harness launches. The same identifier isolates WebView2 storage and the single-instance mutex. Development and smoke builds do not register updater/autostart plugins. Store and standalone production builds retain their respective startup and update mechanisms.

See [testing](testing.md), [common changes](patterns.md) and [CI/release](ci-cd.md).
