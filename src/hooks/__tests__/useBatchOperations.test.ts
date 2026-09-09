import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBatchOperations } from "../useBatchOperations";
import { makeEntry } from "../../test/fixtures";

const mockReadImageBase64 = vi.fn();
const mockDbGetItem = vi.fn();
vi.mock("../../lib/tauri", () => ({
  readImageBase64: (...args: unknown[]) => mockReadImageBase64(...args),
  dbGetItem: (...args: unknown[]) => mockDbGetItem(...args),
}));

vi.mock("../../lib/paste", () => ({
  pasteItem: vi.fn(),
}));

vi.mock("../../lib/clipboard-utils", () => ({
  textEntry: (text: string) => ({ id: 0, content: text, content_type: "text" }),
}));

const t = (key: string, opts?: { count?: number; skipped?: number }) =>
  opts ? `${key}:${opts.count ?? ""}:${opts.skipped ?? ""}` : key;

describe("useBatchOperations handleBatchDelete budget", () => {
  beforeEach(() => {
    mockReadImageBase64.mockReset();
    mockDbGetItem.mockReset();
  });

  it.each([null, "/img/empty.png", "/img/missing.png"])(
    "does not offer image undo without recoverable bytes (%s)",
    async (imagePath) => {
      mockDbGetItem.mockResolvedValue(
        makeEntry(1, { content_type: "image", image_path: imagePath }),
      );
      if (imagePath === "/img/missing.png") {
        mockReadImageBase64.mockRejectedValue(new Error("Missing image"));
      } else {
        mockReadImageBase64.mockResolvedValue("");
      }
      const showInfo = vi.fn();
      const restoreBatchItems = vi.fn().mockResolvedValue(undefined);
      const batchRemoveItems = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useBatchOperations({
          filtered: [makeEntry(1, { content_type: "image", image_path: imagePath })],
          batchRemoveItems,
          restoreBatchItems,
          showInfo,
          showError: vi.fn(),
          t,
        }),
      );
      act(() => result.current.handleToggleMultiSelect(1));
      await act(async () => {
        await result.current.handleBatchDelete();
      });
      expect(batchRemoveItems).toHaveBeenCalledWith([1]);
      expect(showInfo).toHaveBeenCalledWith("toast.deletedItemsSkipped:1:1", undefined);
      expect(restoreBatchItems).not.toHaveBeenCalled();
    },
  );

  it("respects 50MB byte budget when snapshotting images for undo", async () => {
    // 12 image items, each "5MB" base64 string = 60MB total
    const FIVE_MB = "x".repeat(5 * 1024 * 1024);
    mockReadImageBase64.mockImplementation(async () => FIVE_MB);

    const items = Array.from({ length: 12 }, (_, i) =>
      makeEntry(i + 1, { content_type: "image", image_path: `/img/${i}.png` }),
    );
    mockDbGetItem.mockImplementation(async (id: number) => items.find((row) => row.id === id));

    const restoreBatchItems = vi.fn().mockResolvedValue(undefined);
    const batchRemoveItems = vi.fn().mockResolvedValue(undefined);
    const showInfo = vi.fn();

    const { result } = renderHook(() =>
      useBatchOperations({
        filtered: items,
        batchRemoveItems,
        restoreBatchItems,
        showInfo,
        showError: vi.fn(),
        t,
      }),
    );

    // Select all 12
    act(() => {
      items.forEach((i) => result.current.handleToggleMultiSelect(i.id));
    });

    await act(async () => {
      await result.current.handleBatchDelete();
    });

    // Find the undo callback registered with showInfo
    const undoCall = showInfo.mock.calls[0];
    expect(undoCall).toBeDefined();
    const undoAction = undoCall[1] as { onClick: () => void };
    undoAction.onClick();

    // The Map passed to restoreBatchItems should have at most 10 entries
    // (50MB / 5MB = 10), demonstrating the budget cut off.
    const snapshotsArg = restoreBatchItems.mock.calls[0][1] as Map<number, string>;
    expect(snapshotsArg.size).toBeLessThanOrEqual(10);
    expect(snapshotsArg.size).toBeGreaterThan(0);

    // The items array passed to restoreBatchItems should match the snapshot
    // count — image items WITHOUT a snapshot are dropped from the restorable
    // set so undo doesn't recreate DB rows pointing at deleted PNG files.
    const restorableItems = restoreBatchItems.mock.calls[0][0] as Array<{ id: number }>;
    expect(restorableItems.length).toBe(snapshotsArg.size);
    for (const item of restorableItems) {
      expect(snapshotsArg.has(item.id)).toBe(true);
    }
  });

  it("keeps non-image items in undo set even when image budget is exhausted", async () => {
    const FIVE_MB = "x".repeat(5 * 1024 * 1024);
    mockReadImageBase64.mockImplementation(async () => FIVE_MB);

    // 12 images (60MB > 50MB budget) + 3 text items
    const imageItems = Array.from({ length: 12 }, (_, i) =>
      makeEntry(i + 1, { content_type: "image", image_path: `/img/${i}.png` }),
    );
    const textItems = Array.from({ length: 3 }, (_, i) =>
      makeEntry(100 + i, { content_type: "text", content: `text-${i}` }),
    );
    const items = [...imageItems, ...textItems];
    mockDbGetItem.mockImplementation(async (id: number) => items.find((row) => row.id === id));

    const restoreBatchItems = vi.fn().mockResolvedValue(undefined);
    const batchRemoveItems = vi.fn().mockResolvedValue(undefined);
    const showInfo = vi.fn();

    const { result } = renderHook(() =>
      useBatchOperations({
        filtered: items,
        batchRemoveItems,
        restoreBatchItems,
        showInfo,
        showError: vi.fn(),
        t,
      }),
    );

    act(() => {
      items.forEach((i) => result.current.handleToggleMultiSelect(i.id));
    });

    await act(async () => {
      await result.current.handleBatchDelete();
    });

    const undoAction = showInfo.mock.calls[0][1] as { onClick: () => void };
    undoAction.onClick();

    const restorableItems = restoreBatchItems.mock.calls[0][0] as Array<{
      id: number;
      content_type: string;
    }>;
    // All 3 text items must be in the restorable set even though some images
    // were skipped due to the budget.
    const restoredText = restorableItems.filter((i) => i.content_type === "text");
    expect(restoredText.length).toBe(3);
  });
});
