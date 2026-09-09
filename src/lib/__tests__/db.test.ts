import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "../db";
import {
  getAllItems,
  upsertItem,
  deleteItem,
  batchDeleteItems,
  toggleStar,
  clearUnstarred,
  deleteOlderThan,
  pruneOldItems,
} from "../db";

// Mock all tauri DB wrappers
const mockDbGetAllItems = vi.fn().mockResolvedValue([]);
const mockDbUpsertItem = vi.fn().mockResolvedValue(undefined);
const mockDbDeleteItem = vi.fn().mockResolvedValue(undefined);
const mockDbBatchDeleteItems = vi.fn().mockResolvedValue(undefined);
const mockDbToggleStar = vi.fn().mockResolvedValue(undefined);
const mockDbClearUnstarred = vi.fn().mockResolvedValue(undefined);
const mockDbDeleteOlderThan = vi.fn().mockResolvedValue(0);
const mockDbUpdateNote = vi.fn().mockResolvedValue(undefined);
const mockDbPruneOldItems = vi.fn().mockResolvedValue(undefined);

vi.mock("../tauri", () => ({
  dbGetAllItems: (...args: unknown[]) => mockDbGetAllItems(...args),
  dbUpsertItem: (...args: unknown[]) => mockDbUpsertItem(...args),
  dbDeleteItem: (...args: unknown[]) => mockDbDeleteItem(...args),
  dbBatchDeleteItems: (...args: unknown[]) => mockDbBatchDeleteItems(...args),
  dbToggleStar: (...args: unknown[]) => mockDbToggleStar(...args),
  dbUpdateNote: (...args: unknown[]) => mockDbUpdateNote(...args),
  dbClearUnstarred: (...args: unknown[]) => mockDbClearUnstarred(...args),
  dbDeleteOlderThan: (...args: unknown[]) => mockDbDeleteOlderThan(...args),
  dbPruneOldItems: (...args: unknown[]) => mockDbPruneOldItems(...args),
}));

describe("db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGetAllItems.mockResolvedValue([]);
    mockDbDeleteOlderThan.mockResolvedValue(0);
  });

  describe("getAllItems", () => {
    it("calls dbGetAllItems without limit", async () => {
      await getAllItems();
      expect(mockDbGetAllItems).toHaveBeenCalledWith(undefined);
    });

    it("calls dbGetAllItems with limit", async () => {
      await getAllItems(100);
      expect(mockDbGetAllItems).toHaveBeenCalledWith(100);
    });

    it("returns items from IPC", async () => {
      const items = [
        {
          id: 1,
          content: "hello",
          content_hash: "abc",
          content_type: "text",
          image_path: null,
          html_content: null,
          note: null,
          starred: false,
          created_at: "2024-01-01",
          last_used: "2024-01-01",
        },
      ];
      mockDbGetAllItems.mockResolvedValue(items);
      const result = await getAllItems();
      expect(result).toHaveLength(1);
      expect(result[0].starred).toBe(false);
      expect(result[0].content).toBe("hello");
    });
  });

  describe("upsertItem", () => {
    it("calls dbUpsertItem with content and hash", async () => {
      await upsertItem("hello", "abc123");
      expect(mockDbUpsertItem).toHaveBeenCalledWith(
        "hello",
        "abc123",
        undefined,
        undefined,
        undefined,
      );
    });

    it("passes htmlContent when provided", async () => {
      await upsertItem("hello", "abc123", "<b>hello</b>");
      expect(mockDbUpsertItem).toHaveBeenCalledWith(
        "hello",
        "abc123",
        "<b>hello</b>",
        undefined,
        undefined,
      );
    });
  });

  it("does not expose non-atomic image row writes", () => {
    expect(db).not.toHaveProperty("upsertImageItem");
  });

  describe("deleteItem", () => {
    it("calls dbDeleteItem with id", async () => {
      await deleteItem(42);
      expect(mockDbDeleteItem).toHaveBeenCalledWith(42);
    });
  });

  describe("batchDeleteItems", () => {
    it("calls dbBatchDeleteItems with ids", async () => {
      await batchDeleteItems([1, 2, 3]);
      expect(mockDbBatchDeleteItems).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("skips call for empty array", async () => {
      await batchDeleteItems([]);
      expect(mockDbBatchDeleteItems).not.toHaveBeenCalled();
    });
  });

  describe("toggleStar", () => {
    it("calls dbToggleStar with id and true", async () => {
      await toggleStar(1, true);
      expect(mockDbToggleStar).toHaveBeenCalledWith(1, true);
    });

    it("calls dbToggleStar with id and false", async () => {
      await toggleStar(1, false);
      expect(mockDbToggleStar).toHaveBeenCalledWith(1, false);
    });
  });

  describe("clearUnstarred", () => {
    it("calls dbClearUnstarred", async () => {
      await clearUnstarred();
      expect(mockDbClearUnstarred).toHaveBeenCalled();
    });
  });

  describe("deleteOlderThan", () => {
    it("calls dbDeleteOlderThan and returns count", async () => {
      mockDbDeleteOlderThan.mockResolvedValue(5);
      const result = await deleteOlderThan(30);
      expect(mockDbDeleteOlderThan).toHaveBeenCalledWith(30);
      expect(result).toBe(5);
    });
  });

  describe("pruneOldItems", () => {
    it("calls dbPruneOldItems with maxItems", async () => {
      await pruneOldItems(500);
      expect(mockDbPruneOldItems).toHaveBeenCalledWith(500);
    });
  });

  describe("error propagation", () => {
    it("getAllItems propagates errors", async () => {
      mockDbGetAllItems.mockRejectedValueOnce(new Error("query failed"));
      await expect(getAllItems()).rejects.toThrow("query failed");
    });

    it("upsertItem propagates errors", async () => {
      mockDbUpsertItem.mockRejectedValueOnce(new Error("insert failed"));
      await expect(upsertItem("text", "hash")).rejects.toThrow("insert failed");
    });

    it("deleteItem propagates errors", async () => {
      mockDbDeleteItem.mockRejectedValueOnce(new Error("delete failed"));
      await expect(deleteItem(1)).rejects.toThrow("delete failed");
    });
  });
});
