import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for Beetroot E2E tests.
 *
 * Tauri E2E testing notes:
 * - Tests interact with the WebView content, not the native window frame.
 * - The Tauri app must be running before tests execute. Use `npm run tauri dev`
 *   in a separate terminal, or rely on the webServer config below to start
 *   the Vite dev server (frontend only, without Tauri shell).
 * - For full integration testing (with Rust backend), build the app first
 *   with `npm run tauri build` and launch the binary manually.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "windows-webview",
      use: {
        // Tauri uses the system WebView2 (Chromium-based) on Windows.
        // Channel is not set here because Playwright connects to the
        // running WebView, not a standalone browser.
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
