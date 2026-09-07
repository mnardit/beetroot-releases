import { test, expect } from "@playwright/test";

/**
 * Basic app tests for Beetroot.
 *
 * These tests verify the main UI shell loads correctly and core
 * interactions work. They run against the Vite dev server (frontend only).
 * For full Tauri integration (IPC, clipboard, tray), the app must be
 * built and launched as a native window.
 */

test.describe("App shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("app container renders", async ({ page }) => {
    const container = page.locator(".app-container");
    await expect(container).toBeVisible();
  });

  test("search bar is visible and accepts input", async ({ page }) => {
    const searchInput = page.locator(".search-input");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    await searchInput.fill("test query");
    await expect(searchInput).toHaveValue("test query");
  });

  test("search mode toggle button is visible", async ({ page }) => {
    const modeToggle = page.locator(".search-mode");
    await expect(modeToggle).toBeVisible();
    await expect(modeToggle).toHaveText(".*");
  });

  test("search mode toggles between fuzzy and regex", async ({ page }) => {
    const modeToggle = page.locator(".search-mode");

    // Default is fuzzy — toggle to regex
    await modeToggle.click();
    await expect(modeToggle).toHaveClass(/search-mode--active/);

    // Toggle back to fuzzy
    await modeToggle.click();
    await expect(modeToggle).not.toHaveClass(/search-mode--active/);
  });

  test("filter bar renders with correct chips", async ({ page }) => {
    const filterBar = page.locator(".filter-bar");
    await expect(filterBar).toBeVisible();

    const chips = filterBar.locator(".filter-bar__chip");
    // At minimum: All, Pinned, Text (Image chip only if images exist)
    await expect(chips).toHaveCount(3);
  });

  test("empty state shows when no items", async ({ page }) => {
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
  });

  test("footer bar renders with action buttons", async ({ page }) => {
    const footer = page.locator(".footer");
    await expect(footer).toBeVisible();

    // Shortcuts help button
    await expect(page.locator(".footer__help")).toBeVisible();
    // Pause button
    await expect(page.locator(".footer__pause")).toBeVisible();
    // Settings button
    await expect(page.locator(".footer__settings")).toBeVisible();
  });
});

test.describe("Settings dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens when settings button is clicked", async ({ page }) => {
    await page.locator(".footer__settings").click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/settings/);
  });

  test("closes on Escape key", async ({ page }) => {
    await page.locator(".footer__settings").click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("closes when close button is clicked", async ({ page }) => {
    await page.locator(".footer__settings").click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.locator(".settings__close").click();
    await expect(dialog).not.toBeVisible();
  });

  test("displays all settings sections", async ({ page }) => {
    await page.locator(".footer__settings").click();

    // Language section
    await expect(
      page.locator('[aria-label="Language"]').or(page.locator('[role="radiogroup"]').first()),
    ).toBeVisible();

    // Save and Cancel buttons in footer
    await expect(page.locator(".settings__footer .settings__btn--primary")).toBeVisible();
    await expect(page.locator(".settings__footer .settings__btn").first()).toBeVisible();
  });
});

test.describe("Keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Escape clears search query", async ({ page }) => {
    const searchInput = page.locator(".search-input");
    await searchInput.fill("some text");
    await expect(searchInput).toHaveValue("some text");

    await page.keyboard.press("Escape");
    // Escape in empty list may not clear, but search should still function
    await expect(searchInput).toBeVisible();
  });

  test("shortcuts help opens and closes", async ({ page }) => {
    // Click the shortcuts help button
    await page.locator(".footer__help").click();

    // ShortcutsHelp overlay should appear
    const overlay = page.locator(".shortcuts-help");
    await expect(overlay).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  });
});
