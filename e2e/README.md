# E2E Scaffold (Inactive)

This directory contains unfinished Playwright specs. They are not run by CI or the pre-release gate. Vitest excludes `e2e/**` in [`vite.config.ts`](../vite.config.ts), and `@playwright/test` is not installed.

[`playwright.config.ts`](../playwright.config.ts) targets the Vite frontend at `localhost:1420`; it does not attach to a native Tauri process. Starting the desktop app alone does not connect these specs to its Rust backend.

Restoring the suite requires adding Playwright and browser binaries, defining the IPC test setup, and updating the specs before including them in CI.

For the supported checks, see [testing](../docs/testing.md). For Windows clipboard, hotkey, paste and MSIX behavior, use the [native harness](../tests/smoke/README.md) in an isolated VM.
