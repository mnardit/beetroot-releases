import { useState, useEffect, useCallback, useRef } from "react";
import * as db from "../lib/db";
import { dbRestoreItem, dbSaveImageItem } from "../lib/tauri";
import { createLogger, timed } from "../lib/log";
import { PERF_SLOW_THRESHOLD_MS } from "../lib/constants";
import type { ClipboardEntry } from "../types/clipboard";

const log = createLogger("database");

async function hashText(text: string): Promise<string> {
  const normalized = text.normalize("NFC");
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const AUTO_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PRUNE_THROTTLE_MS = 60 * 1000; // 1 minute

/**
 * Hook providing CRUD operations for clipboard history backed by SQLite.
 * No longer holds items in state — search_items IPC returns results directly.
 * Mutations bump `refreshKey` to trigger re-search in useSearchAndFilter.
 */
export function useDatabase(
  maxHistorySize: number = 500,
  onError?: (msg: string) => void,
  autoDeleteDays: number = 0,
) {
  // refreshKey bumped after each mutation to trigger re-search
  const [refreshKey, setRefreshKey] = useState(0);
  const maxRef = useRef(maxHistorySize);
  const onErrorRef = useRef(onError);
  const autoDeleteRef = useRef(autoDeleteDays);
  const lastPruneRef = useRef(0);

  useEffect(() => {
    maxRef.current = maxHistorySize;
    onErrorRef.current = onError;
    autoDeleteRef.current = autoDeleteDays;
  });

  function reportError(label: string, e: unknown) {
    const msg = `${label}: ${e instanceof Error ? e.message : String(e)}`;
    log.error(msg);
    onErrorRef.current?.(msg);
  }

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Auto-cleanup by age
  useEffect(() => {
    async function runCleanup() {
      const days = autoDeleteRef.current;
      if (days <= 0) return;
      try {
        const deleted = await db.deleteOlderThan(days);
        if (deleted > 0) {
          log.info(`Auto-cleanup: removed ${deleted} items older than ${days} days`);
          bump();
        }
      } catch (e) {
        reportError("Auto-cleanup failed", e);
      }
    }

    runCleanup();
    const timer = setInterval(runCleanup, AUTO_CLEANUP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [bump]);

  async function maybePrune() {
    if (maxRef.current <= 0) return;
    const now = Date.now();
    if (now - lastPruneRef.current < PRUNE_THROTTLE_MS) return;
    lastPruneRef.current = now;
    await db.pruneOldItems(maxRef.current);
  }

  const addItem = useCallback(
    async (
      content: string,
      htmlContent?: string,
      sourceApp?: string,
      sourceTitle?: string,
      isCurrent?: () => boolean,
    ) => {
      // Trim is only for the empty-check — preserve raw content verbatim so
      // code blocks, markdown with indentation, and trailing newlines round-trip.
      if (!content.trim()) return;
      try {
        const saved = await timed(
          log,
          "addItem (hash+upsert+prune)",
          async () => {
            const hash = await hashText(content);
            if (isCurrent && !isCurrent()) return false;
            await db.upsertItem(content, hash, htmlContent, sourceApp, sourceTitle);
            await maybePrune();
            return true;
          },
          PERF_SLOW_THRESHOLD_MS,
        );
        if (saved) bump();
      } catch (e) {
        reportError("Failed to save clip", e);
      }
    },
    [bump],
  );

  const addImageItem = useCallback(
    async (
      base64Data: string,
      sourceApp?: string,
      sourceTitle?: string,
      isCurrent?: () => boolean,
    ) => {
      if (!base64Data) return;
      try {
        const saved = await timed(
          log,
          "addImageItem (hash+save+upsert+prune)",
          async () => {
            const hash = await hashText(base64Data);
            if (isCurrent && !isCurrent()) return false;
            await dbSaveImageItem(base64Data, hash, sourceApp, sourceTitle);
            await maybePrune();
            return true;
          },
          PERF_SLOW_THRESHOLD_MS,
        );
        if (saved) bump();
      } catch (e) {
        reportError("Failed to save image", e);
      }
    },
    [bump],
  );

  // Mutations below re-throw after reporting so callers can skip their
  // "success" toasts when the DB write actually failed. Previously they
  // swallowed errors, which produced misleading feedback (error toast
  // from reportError PLUS a success toast from the caller).
  const removeItem = useCallback(
    async (id: number): Promise<void> => {
      try {
        await db.deleteItem(id);
        bump();
      } catch (e) {
        reportError("Failed to delete item", e);
        throw e;
      }
    },
    [bump],
  );

  const batchRemoveItems = useCallback(
    async (ids: number[]): Promise<void> => {
      try {
        await db.batchDeleteItems(ids);
        bump();
      } catch (e) {
        reportError("Failed to batch delete items", e);
        throw e;
      }
    },
    [bump],
  );

  // For image entries, `imageBase64` re-saves the file before the DB row —
  // the backend delete path also removes the PNG from disk, so without a
  // snapshot undo would point at a missing file.
  const restoreItem = useCallback(
    async (entry: ClipboardEntry, imageBase64?: string) => {
      try {
        if (entry.content_type === "image") {
          if (!imageBase64) throw new Error("Image snapshot is unavailable");
        }
        await dbRestoreItem(entry, imageBase64);
        bump();
      } catch (e) {
        reportError("Failed to restore item", e);
        throw e;
      }
    },
    [bump],
  );

  const restoreBatchItems = useCallback(
    async (entries: ClipboardEntry[], imageSnapshots?: Map<number, string>) => {
      try {
        for (const entry of entries) {
          const snapshot = imageSnapshots?.get(entry.id);
          if (entry.content_type === "image") {
            if (!snapshot) throw new Error("Image snapshot is unavailable");
          }
          await dbRestoreItem(entry, snapshot);
        }
        bump();
      } catch (e) {
        reportError("Failed to restore items", e);
        throw e;
      }
    },
    [bump],
  );

  const starItem = useCallback(
    async (id: number, starred: boolean) => {
      try {
        await db.toggleStar(id, starred);
        bump();
      } catch (e) {
        reportError("Failed to toggle star", e);
        throw e;
      }
    },
    [bump],
  );

  const touchItem = useCallback(
    async (id: number) => {
      try {
        await db.touchItem(id);
        bump();
      } catch (e) {
        reportError("Failed to touch item", e);
      }
    },
    [bump],
  );

  const updateNote = useCallback(
    async (id: number, note: string) => {
      try {
        await db.updateNote(id, note);
        bump();
      } catch (e) {
        reportError("Failed to update note", e);
      }
    },
    [bump],
  );

  return {
    refreshKey,
    bump,
    addItem,
    addImageItem,
    removeItem,
    batchRemoveItems,
    restoreItem,
    restoreBatchItems,
    starItem,
    touchItem,
    updateNote,
  };
}
