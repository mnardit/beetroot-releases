# E2E — Inactive Scaffold

**Status (as of 2026-05-01):** scaffold only. Not run by CI, not part of the pre-release gate, and the `@playwright/test` package is **not installed** — `npm test` and `./scripts/pre-release-check.sh` ignore this directory entirely (Vitest excludes `e2e/**` in [`vite.config.ts`](../vite.config.ts)).

[`playwright.config.ts`](../playwright.config.ts) imports `@playwright/test`, so trying to run it without first installing the dep will fail with `Cannot find module '@playwright/test'`.

## To resurrect

1. `npm install --save-dev @playwright/test`
2. `npx playwright install` (browser binaries)
3. Add a `"test:e2e": "playwright test"` script to [`package.json`](../package.json).
4. Decide harness for native Tauri behavior — Playwright drives the WebView, not the Rust shell. For full-stack flows (clipboard capture via OS, hotkey, paste via SendInput, MSIX) you need either:
   - `npm run tauri dev` running in a separate terminal, OR
   - A built binary launched as a child process, OR
   - WebDriver via `tauri-driver` (separate setup).

## To explicitly retire

If E2E is not coming back, delete:

- `e2e/` (this directory)
- `playwright.config.ts`
- The `playwright` references inside `package.json` if any creep in.

## Why it's still here

The specs were written when E2E was an active goal but `npm install @playwright/test` never landed. Rather than delete the work, we keep it as a starting point in case browser-driven E2E is reconsidered (vs. native Tauri smoke harnesses, which are usually a better fit for this app).
