import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDatabase } from "../useDatabase";
import { dbRestoreItem, dbSaveImageItem } from "../../lib/tauri";
import { makeEntry } from "../../test/fixtures";

// Mock db module
const mockUpsertItem = vi.fn().mockResolvedValue(undefined);
const mockPruneOldItems = vi.fn().mockResolvedValue(undefined);
const mockDeleteItem = vi.fn().mockResolvedValue(undefined);
const mockBatchDeleteItems = vi.fn().mockResolvedValue(undefined);
const mockToggleStar = vi.fn().mockResolvedValue(undefined);
const mockTouchItem = vi.fn().mockResolvedValue(undefined);
const mockUpdateNote = vi.fn().mockResolvedValue(undefined);
const mockDeleteOlderThan = vi.fn().mockResolvedValue(0);

vi.mock("../../lib/db", () => ({
  upsertItem: (...args: unknown[]) => mockUpsertItem(...args),
  pruneOldItems: (...args: unknown[]) => mockPruneOldItems(...args),
  deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
  batchDeleteItems: (...args: unknown[]) => mockBatchDeleteItems(...args),
  toggleStar: (...args: unknown[]) => mockToggleStar(...args),
  touchItem: (...args: unknown[]) => mockTouchItem(...args),
  updateNote: (...args: unknown[]) => mockUpdateNote(...args),
  deleteOlderThan: (...args: unknown[]) => mockDeleteOlderThan(...args),
}));

vi.mock("../../lib/tauri", () => ({
  dbRestoreItem: vi.fn().mockResolvedValue(undefined),
  dbSaveImageItem: vi.fn().mockResolvedValue(undefined),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

const mockEntry = {
  id: 1,
  content: "hello",
  content_hash: "abc",
  content_type: "text" as const,
  image_path: null,
  html_content: null,
  note: null,
  starred: false,
  created_at: "2024-01-01",
  last_used: "2024-01-01",
  source_app: null,
  source_title: null,
};

describe("useDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["text", "image"])(
    "does not submit %s persistence when capture expires during hashing",
    async (kind) => {
      let release!: (value: ArrayBuffer) => void;
      const digest = vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            release = resolve;
          }),
      );
      const { result } = renderHook(() => useDatabase(500));
      let current = true;
      const pending =
        kind === "text"
          ? result.current.addItem("captured", undefined, undefined, undefined, () => current)
          : result.current.addImageItem("captured-image", undefined, undefined, () => current);
      current = false;
      try {
        await act(async () => {
          release(new ArrayBuffer(32));
          await pending;
        });
        expect(mockUpsertItem).not.toHaveBeenCalled();
        expect(dbSaveImageItem).not.toHaveBeenCalled();
        expect(mockPruneOldItems).not.toHaveBeenCalled();
        expect(result.current.refreshKey).toBe(0);
      } finally {
        digest.mockRestore();
      }
    },
  );

  it("returns refreshKey starting at 0", () => {
    const { result } = renderHook(() => useDatabase(500));
    expect(result.current.refreshKey).toBe(0);
  });

  it("addItem calls db.upsertItem and bumps refreshKey", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.addItem("  test content  ");
    });

    // Content is now stored verbatim (no trim) — code blocks / markdown
    // indentation / trailing newlines round-trip exactly.
    expect(mockUpsertItem).toHaveBeenCalledWith(
      "  test content  ",
      expect.any(String),
      undefined,
      undefined,
      undefined,
    );
    expect(result.current.refreshKey).toBe(keyBefore + 1);
  });

  it("addItem skips empty strings", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.addItem("   ");
    });

    expect(mockUpsertItem).not.toHaveBeenCalled();
    expect(result.current.refreshKey).toBe(keyBefore);
  });

  it("removeItem calls db.deleteItem and bumps refreshKey", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.removeItem(1);
    });

    expect(mockDeleteItem).toHaveBeenCalledWith(1);
    expect(result.current.refreshKey).toBe(keyBefore + 1);
  });

  it("starItem calls db.toggleStar and bumps refreshKey", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.starItem(1, true);
    });

    expect(mockToggleStar).toHaveBeenCalledWith(1, true);
    expect(result.current.refreshKey).toBe(keyBefore + 1);
  });

  it("touchItem calls db.touchItem and bumps refreshKey", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.touchItem(1);
    });

    expect(mockTouchItem).toHaveBeenCalledWith(1);
    expect(result.current.refreshKey).toBe(keyBefore + 1);
  });

  it("updateNote calls db.updateNote and bumps refreshKey", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.updateNote(1, "my note");
    });

    expect(mockUpdateNote).toHaveBeenCalledWith(1, "my note");
    expect(result.current.refreshKey).toBe(keyBefore + 1);
  });

  it("batchRemoveItems calls db.batchDeleteItems and bumps refreshKey", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.batchRemoveItems([1, 2, 3]);
    });

    expect(mockBatchDeleteItems).toHaveBeenCalledWith([1, 2, 3]);
    expect(result.current.refreshKey).toBe(keyBefore + 1);
  });

  it("addImageItem saves image and upserts, bumps refreshKey", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.addImageItem("base64data");
    });

    expect(dbSaveImageItem).toHaveBeenCalledWith(
      "base64data",
      expect.any(String), // hash
      undefined,
      undefined,
    );
    expect(result.current.refreshKey).toBe(keyBefore + 1);
  });

  it("addImageItem skips empty base64", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.addImageItem("");
    });

    expect(dbSaveImageItem).not.toHaveBeenCalled();
    expect(dbRestoreItem).not.toHaveBeenCalled();
    expect(result.current.refreshKey).toBe(keyBefore);
  });

  it("restoreItem passes html_content to upsertItem", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const entry = { ...mockEntry, html_content: "<b>rich</b>" };

    await act(async () => {
      await result.current.restoreItem(entry);
    });

    expect(dbRestoreItem).toHaveBeenCalledWith(entry, undefined);
    expect(mockUpsertItem).not.toHaveBeenCalled();
  });

  it("restoreItem passes null html_content when absent", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    await act(async () => {
      await result.current.restoreItem(mockEntry);
    });

    expect(dbRestoreItem).toHaveBeenCalledWith(mockEntry, undefined);
    expect(mockUpsertItem).not.toHaveBeenCalled();
  });

  it.each([undefined, ""])("rejects image restore without snapshot (%s)", async (snapshot) => {
    const onError = vi.fn();
    const { result } = renderHook(() => useDatabase(500, onError));
    const image = makeEntry(3, { content_type: "image", image_path: "/images/deleted.png" });
    await act(async () => {
      await expect(result.current.restoreItem(image, snapshot)).rejects.toThrow("snapshot");
    });
    expect(mockUpsertItem).not.toHaveBeenCalled();
    expect(dbSaveImageItem).not.toHaveBeenCalled();
    expect(dbRestoreItem).not.toHaveBeenCalled();
    expect(result.current.refreshKey).toBe(0);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("restores image bytes and the row through one restore command", async () => {
    const { result } = renderHook(() => useDatabase());
    const image = makeEntry(3, { content_type: "image", image_path: "/images/deleted.png" });
    await act(async () => {
      await result.current.restoreItem(image, "snapshot");
    });
    expect(dbRestoreItem).toHaveBeenCalledWith(image, "snapshot");
    expect(dbSaveImageItem).not.toHaveBeenCalled();
    expect(mockUpsertItem).not.toHaveBeenCalled();
    expect(result.current.refreshKey).toBe(1);
  });

  it("restoreBatchItems restores image entries with their snapshots", async () => {
    const { result } = renderHook(() => useDatabase(500));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const entries = [
      { ...mockEntry, id: 1, content_type: "text" as const, html_content: "<em>hi</em>" },
      {
        ...mockEntry,
        id: 2,
        content_type: "image" as const,
        content_hash: "img_hash",
        image_path: "/images/2026-02/abc.png",
      },
    ];

    await act(async () => {
      await result.current.restoreBatchItems(entries, new Map([[2, "snapshot"]]));
    });

    expect(dbRestoreItem).toHaveBeenNthCalledWith(1, entries[0], undefined);
    expect(dbRestoreItem).toHaveBeenNthCalledWith(2, entries[1], "snapshot");
    expect(mockUpsertItem).not.toHaveBeenCalled();
    expect(dbSaveImageItem).not.toHaveBeenCalled();
  });

  it.each([null, "/images/deleted.png"])(
    "rejects batch image restore without bytes, regardless of the old path (%s)",
    async (imagePath) => {
      const onError = vi.fn();
      const { result } = renderHook(() => useDatabase(500, onError));
      await act(async () => {
        await expect(
          result.current.restoreBatchItems([
            makeEntry(1, { content_type: "image", image_path: imagePath }),
          ]),
        ).rejects.toThrow("snapshot");
      });
      expect(mockUpsertItem).not.toHaveBeenCalled();
      expect(dbSaveImageItem).not.toHaveBeenCalled();
      expect(dbRestoreItem).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledOnce();
    },
  );

  it("calls onError when addItem fails", async () => {
    const onError = vi.fn();
    mockUpsertItem.mockRejectedValueOnce(new Error("DB locked"));

    const { result } = renderHook(() => useDatabase(500, onError));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      await result.current.addItem("fail");
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("DB locked"));
    // refreshKey should NOT bump on error
    expect(result.current.refreshKey).toBe(keyBefore);
  });

  it("calls onError and re-throws when removeItem fails", async () => {
    const onError = vi.fn();
    mockDeleteItem.mockRejectedValueOnce(new Error("delete failed"));

    const { result } = renderHook(() => useDatabase(500, onError));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    const keyBefore = result.current.refreshKey;

    await act(async () => {
      // Mutation now re-throws so callers can skip success toasts.
      await expect(result.current.removeItem(99)).rejects.toThrow("delete failed");
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("delete failed"));
    expect(result.current.refreshKey).toBe(keyBefore);
  });

  it("calls onError and re-throws when starItem fails", async () => {
    const onError = vi.fn();
    mockToggleStar.mockRejectedValueOnce(new Error("star failed"));

    const { result } = renderHook(() => useDatabase(500, onError));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    await act(async () => {
      await expect(result.current.starItem(1, true)).rejects.toThrow("star failed");
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("star failed"));
  });

  it("calls onError when touchItem fails", async () => {
    const onError = vi.fn();
    mockTouchItem.mockRejectedValueOnce(new Error("touch failed"));

    const { result } = renderHook(() => useDatabase(500, onError));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    await act(async () => {
      await result.current.touchItem(1);
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("touch failed"));
  });

  it("calls onError when updateNote fails", async () => {
    const onError = vi.fn();
    mockUpdateNote.mockRejectedValueOnce(new Error("note failed"));

    const { result } = renderHook(() => useDatabase(500, onError));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    await act(async () => {
      await result.current.updateNote(1, "test");
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("note failed"));
  });

  it("calls onError and re-throws when batchRemoveItems fails", async () => {
    const onError = vi.fn();
    mockBatchDeleteItems.mockRejectedValueOnce(new Error("batch failed"));

    const { result } = renderHook(() => useDatabase(500, onError));

    await vi.waitFor(() => {
      expect(result.current.refreshKey).toBeGreaterThanOrEqual(0);
    });

    await act(async () => {
      await expect(result.current.batchRemoveItems([1, 2])).rejects.toThrow("batch failed");
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("batch failed"));
  });
});
