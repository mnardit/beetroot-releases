import { test, expect } from "@playwright/test";

/**
 * Clipboard history flow tests for Beetroot.
 *
 * These tests verify clipboard list interactions. In a real Tauri
 * environment, clipboard items are populated via the system clipboard
 * monitor. In the Vite-only dev server, the list starts empty since
 * Tauri IPC is not available.
 *
 * For full E2E testing with actual clipboard data, the Tauri app must
 * be running and clipboard events must be triggered externally.
 */

test.describe("Clipboard list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows empty state when no items exist", async ({ page }) => {
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
  });

  test("search filters display correctly", async ({ page }) => {
    const searchInput = page.locator(".search-input");
    await searchInput.fill("nonexistent query");

    // With no items, empty state should show (query-aware message)
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
  });

  test("filter chips toggle active state", async ({ page }) => {
    const chips = page.locator(".filter-bar__chip");

    // First chip (All) should be active by default
    await expect(chips.first()).toHaveClass(/filter-bar__chip--active/);

    // Click Pinned filter
    await chips.nth(1).click();
    await expect(chips.nth(1)).toHaveClass(/filter-bar__chip--active/);
    await expect(chips.first()).not.toHaveClass(/filter-bar__chip--active/);

    // Click Text filter
    await chips.nth(2).click();
    await expect(chips.nth(2)).toHaveClass(/filter-bar__chip--active/);
    await expect(chips.nth(1)).not.toHaveClass(/filter-bar__chip--active/);

    // Click All to reset
    await chips.first().click();
    await expect(chips.first()).toHaveClass(/filter-bar__chip--active/);
  });
});

test.describe("Clipboard item interactions", () => {
  // These tests require clipboard items to be present.
  // In a full Tauri environment, items would be populated from the database.
  // For now, these serve as scaffolding for when the test harness supports
  // seeding the database or mocking Tauri IPC.

  test.skip("pin and unpin item", async ({ page }) => {
    await page.goto("/");

    // Click pin button on first item
    const firstItem = page.locator(".clip-item").first();
    const pinButton = firstItem.locator(".clip-item__pin");
    await pinButton.click();

    // Should show pinned state
    await expect(pinButton).toHaveClass(/clip-item__pin--active/);

    // Unpin
    await pinButton.click();
    await expect(pinButton).not.toHaveClass(/clip-item__pin--active/);
  });

  test.skip("delete item removes it from list", async ({ page }) => {
    await page.goto("/");

    const items = page.locator(".clip-item");
    const initialCount = await items.count();

    // Delete the first item
    const deleteButton = items.first().locator(".clip-item__delete");
    await deleteButton.click();

    await expect(items).toHaveCount(initialCount - 1);
  });

  test.skip("multi-select with Ctrl+Click", async ({ page }) => {
    await page.goto("/");

    const items = page.locator(".clip-item");

    // Ctrl+Click first item to enter multi-select
    await items.first().click({ modifiers: ["Control"] });
    await expect(items.first()).toHaveClass(/clip-item--multi/);

    // Footer should switch to batch mode
    const batchHint = page.locator(".footer__hint");
    await expect(batchHint).toContainText("1");

    // Ctrl+Click second item
    await items.nth(1).click({ modifiers: ["Control"] });
    await expect(batchHint).toContainText("2");
  });

  test.skip("batch delete selected items", async ({ page }) => {
    await page.goto("/");

    const items = page.locator(".clip-item");

    // Multi-select two items
    await items.first().click({ modifiers: ["Control"] });
    await items.nth(1).click({ modifiers: ["Control"] });

    // Click batch delete
    const deleteBtn = page.locator(".footer__batch-btn--danger");
    await deleteBtn.click();

    // Items should be removed
    const remaining = page.locator(".clip-item");
    await expect(remaining).toHaveCount((await items.count()) - 2);
  });
});
