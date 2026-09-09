import { useState, useCallback } from "react";
import { pasteItem } from "../lib/paste";
import { textEntry } from "../lib/clipboard-utils";
import { dbGetItem, readImageBase64 } from "../lib/tauri";
import type { ClipboardEntry } from "../types/clipboard";
import type { TFunction } from "../lib/i18n";

const MAX_UNDO_BYTES = 50 * 1024 * 1024; // 50 MB total budget for batch image snapshots
const SNAPSHOT_CONCURRENCY = 5;

interface UseBatchOperationsDeps {
  filtered: ClipboardEntry[];
  batchRemoveItems: (ids: number[]) => Promise<void>;
  restoreBatchItems: (
    entries: ClipboardEntry[],
    imageSnapshots?: Map<number, string>,
  ) => Promise<void>;
  showInfo: (msg: string, action?: { label: string; onClick: () => void }) => void;
  showError: (msg: string) => void;
  t: TFunction;
}

export function useBatchOperations(deps: UseBatchOperationsDeps) {
  const { filtered, batchRemoveItems, restoreBatchItems, showInfo, showError, t } = deps;
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set());

  const handleToggleMultiSelect = useCallback((id: number) => {
    setMultiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(async () => {
    const ids = [...multiSelected];
    if (ids.length === 0) return;
    const itemsToDelete: ClipboardEntry[] = [];
    try {
      for (const id of ids) itemsToDelete.push(await dbGetItem(id));
    } catch {
      showError(t("toast.loadFailed"));
      return;
    }
    // Snapshot image files BEFORE delete — backend delete also removes PNGs
    // from disk, so undo needs a source to restore from. Process in chunks of
    // SNAPSHOT_CONCURRENCY and stop when total bytes exceed MAX_UNDO_BYTES.
    // Items past the budget are excluded from undo so memory stays bounded.
    const imageItems = itemsToDelete.filter((i) => i.content_type === "image" && i.image_path);
    const imageSnapshots = new Map<number, string>();
    let totalBytes = 0;
    for (let i = 0; i < imageItems.length; i += SNAPSHOT_CONCURRENCY) {
      if (totalBytes >= MAX_UNDO_BYTES) break;
      const chunk = imageItems.slice(i, i + SNAPSHOT_CONCURRENCY);
      await Promise.all(
        chunk.map(async (item) => {
          if (totalBytes >= MAX_UNDO_BYTES) return;
          try {
            const b64 = await readImageBase64(item.image_path!);
            // base64 length ≈ encoded size in bytes (1 char = 1 byte for ASCII)
            if (!b64 || totalBytes + b64.length > MAX_UNDO_BYTES) return;
            totalBytes += b64.length;
            imageSnapshots.set(item.id, b64);
          } catch {
            // Without a snapshot, this image is excluded from undo.
          }
        }),
      );
    }
    try {
      await batchRemoveItems(ids);
    } catch {
      return; // error toast already shown by useDatabase
    }
    setMultiSelected(new Set());
    if (itemsToDelete.length > 0) {
      // Image items without a snapshot can't be restored: backend delete
      // already removed the PNG file, so re-creating the DB row would point
      // at a missing path. Drop them from the undo set; only items with
      // recoverable data remain undoable.
      const restorable = itemsToDelete.filter(
        (i) => i.content_type !== "image" || imageSnapshots.has(i.id),
      );
      const skipped = itemsToDelete.length - restorable.length;

      // Pick the right toast variant based on what's actually recoverable:
      //  - All recoverable → standard "Deleted N items" with Undo.
      //  - Partial          → "Deleted N items (M cannot be undone)" with Undo
      //                       (the action only restores items that have data).
      //  - Nothing          → standard text, NO Undo (button would be a no-op).
      const message =
        skipped === 0
          ? t("toast.deletedItems", { count: itemsToDelete.length })
          : t("toast.deletedItemsSkipped", { count: itemsToDelete.length, skipped });
      const undoAction =
        restorable.length === 0
          ? undefined
          : {
              label: t("undo"),
              onClick: () => restoreBatchItems(restorable, imageSnapshots).catch(() => {}),
            };
      showInfo(message, undoAction);
    }
  }, [multiSelected, batchRemoveItems, restoreBatchItems, showInfo, showError, t]);

  const handleBatchCopy = useCallback(
    async (separator: string) => {
      const selected = filtered.filter((i) => multiSelected.has(i.id));
      const texts: string[] = [];
      try {
        for (const item of selected) {
          if (item.content_type === "text") texts.push((await dbGetItem(item.id)).content);
        }
      } catch {
        showError(t("toast.loadFailed"));
        return;
      }
      if (texts.length === 0) return;
      const skipped = selected.length - texts.length;
      const merged = texts.join(separator);
      try {
        await pasteItem(textEntry(merged), false);
        setMultiSelected(new Set());
        if (skipped > 0) {
          showInfo(t("toast.pastedItemsSkipped", { count: texts.length, skipped }));
        } else {
          showInfo(t("toast.pastedItems", { count: texts.length }));
        }
      } catch {
        showError(t("toast.pasteFailed"));
      }
    },
    [filtered, multiSelected, showInfo, showError, t],
  );

  return {
    multiSelected,
    setMultiSelected,
    handleToggleMultiSelect,
    handleBatchDelete,
    handleBatchCopy,
  };
}
