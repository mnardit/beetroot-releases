import {
  dbGetAllItems,
  dbUpsertItem,
  dbDeleteItem,
  dbBatchDeleteItems,
  dbToggleStar,
  dbTouchItem,
  dbUpdateNote,
  dbClearUnstarred,
  dbDeleteOlderThan,
  dbPruneOldItems,
} from "./tauri";
import { createLogger, timed } from "./log";
import type { ClipboardEntry } from "../types/clipboard";

import { PERF_SLOW_THRESHOLD_MS } from "./constants";

const log = createLogger("db");

/** Fetch all clipboard items ordered by last_used. Optional limit caps the result set. */
export async function getAllItems(limit?: number): Promise<ClipboardEntry[]> {
  return timed(log, "getAllItems", async () => dbGetAllItems(limit), PERF_SLOW_THRESHOLD_MS);
}

/** Insert a text entry or bump its last_used timestamp if the hash already exists. Returns the upserted row. */
export async function upsertItem(
  content: string,
  contentHash: string,
  htmlContent?: string | null,
  sourceApp?: string | null,
  sourceTitle?: string | null,
): Promise<ClipboardEntry> {
  return timed(
    log,
    "upsertItem",
    () => dbUpsertItem(content, contentHash, htmlContent, sourceApp, sourceTitle),
    PERF_SLOW_THRESHOLD_MS,
  );
}

/** Delete a single clipboard item by ID. */
export async function deleteItem(id: number): Promise<void> {
  return timed(log, "deleteItem", () => dbDeleteItem(id), PERF_SLOW_THRESHOLD_MS);
}

/** Delete multiple clipboard items by IDs. */
export async function batchDeleteItems(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  return timed(log, "batchDeleteItems", () => dbBatchDeleteItems(ids), PERF_SLOW_THRESHOLD_MS);
}

/** Set the starred state of a clipboard item. */
export async function toggleStar(id: number, starred: boolean): Promise<void> {
  return timed(log, "toggleStar", () => dbToggleStar(id, starred), PERF_SLOW_THRESHOLD_MS);
}

/** Bump the last_used timestamp to now so the item sorts to the top. */
export async function touchItem(id: number): Promise<void> {
  return timed(log, "touchItem", () => dbTouchItem(id), PERF_SLOW_THRESHOLD_MS);
}

/** Update the note on a clipboard item. Empty string clears it. */
export async function updateNote(id: number, note: string): Promise<void> {
  return timed(log, "updateNote", () => dbUpdateNote(id, note), PERF_SLOW_THRESHOLD_MS);
}

/** Delete all unstarred clipboard items. */
export async function clearUnstarred(): Promise<void> {
  return timed(log, "clearUnstarred", () => dbClearUnstarred(), PERF_SLOW_THRESHOLD_MS);
}

/** Delete unstarred items older than the given number of days. */
export async function deleteOlderThan(days: number): Promise<number> {
  return timed(log, "deleteOlderThan", () => dbDeleteOlderThan(days), PERF_SLOW_THRESHOLD_MS);
}

/** Remove the oldest unstarred items to keep the total unstarred count at maxItems. */
export async function pruneOldItems(maxItems: number): Promise<void> {
  return timed(log, "pruneOldItems", () => dbPruneOldItems(maxItems), PERF_SLOW_THRESHOLD_MS);
}
