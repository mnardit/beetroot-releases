import { invoke } from "@tauri-apps/api/core";
import type { ClipboardEntry } from "../types/clipboard";
import type { CloudProvider } from "./settings";

export interface PasteResult {
  status: "pasted" | "copied";
}

/** Paste the selected item. A closed target returns "copied" without hiding
 *  the popup, so feedback remains visible. Later focus/modifier failures also copy only. */
export function pasteSelectedItem(): Promise<PasteResult> {
  return invoke<PasteResult>("paste_selected_item");
}

/** Re-register the global shortcut with a new key combination */
export function changeHotkey(shortcutStr: string): Promise<void> {
  return invoke("change_hotkey", { shortcutStr });
}

/** Replace or clear a hotkey and return its actual predecessor for compensation. */
export function replaceHotkey(action: "main" | "plain_text", shortcutStr: string): Promise<string> {
  return invoke<string>("replace_hotkey", { action, shortcutStr });
}

/** Register a plain text paste hotkey (handled in Rust, emits "plain-text-paste" event) */
export function registerPlainTextHotkey(shortcutStr: string): Promise<void> {
  return invoke("register_plain_text_hotkey", { shortcutStr });
}

/** Unregister the plain text paste hotkey */
export function unregisterPlainTextHotkey(expectedShortcut?: string): Promise<void> {
  return expectedShortcut === undefined
    ? invoke("unregister_plain_text_hotkey")
    : invoke("unregister_plain_text_hotkey", { expectedShortcut });
}

/** Open a native folder picker dialog (parented to the main window) */
export function pickFolder(): Promise<string | null> {
  return invoke<string | null>("pick_folder");
}

/** Get the current data directory path */
export function getDataPath(): Promise<string> {
  return invoke<string>("get_data_path");
}

/** Check if a path is on a removable or network drive. Returns drive kind or null. */
export function checkDataPathDrive(path: string): Promise<string | null> {
  return invoke<string | null>("check_data_path_drive", { path });
}

/** Check if a path is inside a cloud sync folder. Returns service name or null. */
export function checkCloudSync(path: string): Promise<string | null> {
  return invoke<string | null>("check_cloud_sync", { path });
}

/** Copy data to a new directory and restart the app */
export function changeDataPath(newPath: string): Promise<void> {
  return invoke("change_data_path", { newPath });
}

/** Switch to a different data directory (no copy) and restart the app */
export function switchDataPath(newPath: string): Promise<void> {
  return invoke("switch_data_path", { newPath });
}

/** Delete an image file by path */
export function deleteImage(path: string): Promise<void> {
  return invoke("delete_image", { path });
}

/** Read an image file as base64 (from app images directory) */
export function readImageBase64(path: string): Promise<string> {
  return invoke<string>("read_image_base64", { path });
}

/**
 * Read an image file as a downscaled thumbnail (PNG, base64 data URL).
 * `maxDim` is the bounding-box dimension in pixels; aspect ratio is preserved.
 * For full-size preview use `readImageBase64`.
 */
export function readImageThumbnail(path: string, maxDim: number): Promise<string> {
  return invoke<string>("read_image_thumbnail", { path, maxDim });
}

/** Read an arbitrary image file from disk as base64 (for Explorer clipboard copies) */
export function readClipboardImageFile(path: string): Promise<string> {
  return invoke<string>("read_clipboard_image_file", { path });
}

/** Open Explorer with the image file selected */
export function showInExplorer(path: string): Promise<void> {
  return invoke("show_in_explorer", { path });
}

/**
 * Enable autostart at the OS level.
 *
 * **Resolves:** `true` when the OS confirms the autostart entry is now active.
 * `false` is theoretically reachable if the OS silently refuses (the Windows
 * `RequestEnableAsync` returns `Disabled` without throwing) — Microsoft does
 * not document this case, so callers should treat `false` as an unexpected
 * failure (do not assume autostart is on).
 *
 * **Rejects:** with a string code or message:
 *   - `"disabled_by_user"`   — user toggled the StartupTask off in Task Manager.
 *                             Cannot be overridden programmatically; user must
 *                             re-enable in Task Manager → Startup apps.
 *   - `"disabled_by_policy"` — group policy or unsupported device.
 *   - `"auto-launch enable: <e>"` — non-MSIX Run-key path failed (rare; e.g.
 *                                   filesystem/permission error). Treat as
 *                                   unexpected and log.
 *
 * MSIX builds use `ApplicationModel.StartupTask`; non-MSIX builds use the
 * `tauri-plugin-autostart` Run-key path. Branching is in Rust.
 */
export function enableAutostart(): Promise<boolean> {
  return invoke<boolean>("autostart_enable");
}

/**
 * Disable autostart at the OS level.
 *
 * **Rejects** with a string message on failure (e.g. `"auto-launch disable: <e>"`
 * for non-MSIX Run-key path, or HRESULT-bearing diagnostic for MSIX).
 * Callers typically log-and-continue.
 */
export function disableAutostart(): Promise<void> {
  return invoke("autostart_disable");
}

/**
 * Query whether autostart is currently enabled at the OS level.
 * Use to reconcile the saved settings flag with reality on app startup —
 * MSIX builds in particular can have OS state diverge from saved settings
 * (e.g. user disables in Task Manager).
 */
export function isAutostartEnabled(): Promise<boolean> {
  return invoke<boolean>("autostart_is_enabled");
}

/** Set the window positioning mode (normal / pinned / follow-cursor) */
export function setWindowMode(mode: string): Promise<void> {
  return invoke("set_window_mode", { mode });
}

/** Set the window position on the monitor (center / top-left / top-right / bottom-left / bottom-right) */
export function setWindowPosition(position: string): Promise<void> {
  return invoke("set_window_position", { position });
}

/** Check if running as MSIX/Store package */
export function isStoreBuild(): Promise<boolean> {
  return invoke<boolean>("is_store_build");
}

/** Development and smoke builds have separate data and no OS autostart/updater. */
export function isIsolatedBuild(): Promise<boolean> {
  return invoke<boolean>("is_isolated_build");
}

/** Extract text from an image using Windows OCR */
export function ocrImage(path: string): Promise<string> {
  return invoke<string>("ocr_image", { path });
}

/** Get custom clipboard format names (used to detect password manager entries) */
export function getClipboardFormats(): Promise<string[]> {
  return invoke<string[]>("get_clipboard_formats");
}

export function getClipboardSequence(): Promise<number> {
  return invoke<number>("get_clipboard_sequence");
}

// --- Database commands (backed by Rust/rusqlite) ---

/** Fetch all clipboard items ordered by last_used DESC */
export function dbGetAllItems(limit?: number): Promise<ClipboardEntry[]> {
  return invoke<ClipboardEntry[]>("db_get_all_items", { limit: limit ?? null });
}

/** Insert or bump a text clipboard item. Returns the upserted row. */
export function dbUpsertItem(
  content: string,
  contentHash: string,
  htmlContent?: string | null,
  sourceApp?: string | null,
  sourceTitle?: string | null,
): Promise<ClipboardEntry> {
  return invoke<ClipboardEntry>("db_upsert_item", {
    content,
    contentHash,
    htmlContent: htmlContent ?? null,
    sourceApp: sourceApp ?? null,
    sourceTitle: sourceTitle ?? null,
  });
}

/** Delete a clipboard item by ID */
export function dbDeleteItem(id: number): Promise<void> {
  return invoke("db_delete_item", { id });
}

/** Delete multiple clipboard items by IDs */
export function dbBatchDeleteItems(ids: number[]): Promise<void> {
  return invoke("db_batch_delete_items", { ids });
}

/** Toggle star state of a clipboard item */
export function dbToggleStar(id: number, starred: boolean): Promise<void> {
  return invoke("db_toggle_star", { id, starred });
}

/** Bump last_used timestamp of a clipboard item to now */
export function dbTouchItem(id: number): Promise<void> {
  return invoke("db_touch_item", { id });
}

/** Update the note on a clipboard item (empty string clears it) */
export function dbUpdateNote(id: number, note: string): Promise<void> {
  return invoke("db_update_note", { id, note });
}

/** Delete all unstarred clipboard items */
export function dbClearUnstarred(): Promise<void> {
  return invoke("db_clear_unstarred");
}

/** Delete unstarred items older than N days, return count deleted */
export function dbDeleteOlderThan(days: number): Promise<number> {
  return invoke<number>("db_delete_older_than", { days });
}

/** Prune oldest unstarred items to keep at most maxItems */
export function dbPruneOldItems(maxItems: number): Promise<void> {
  return invoke("db_prune_old_items", { maxItems });
}

/** Database statistics */
export interface DbStats {
  total_items: number;
  text_items: number;
  image_items: number;
  starred_items: number;
  db_size_bytes: number;
  images_dir_size_bytes: number;
}

/** Get database statistics (item counts, sizes) */
export function dbGetStats(): Promise<DbStats> {
  return invoke<DbStats>("db_get_stats");
}

// --- Search command (backed by Rust 5-phase search engine) ---

export interface SearchRequest {
  query: string;
  search_mode: string;
  type_filter: string;
  app_filter: string | null;
  limit: number;
}

export interface FieldMatch {
  field: string;
  indices: [number, number][];
}

export interface SearchResultItem extends ClipboardEntry {
  matches: FieldMatch[];
}

export interface FilterCounts {
  all: number;
  starred: number;
  text: number;
  image: number;
  notes: number;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total_unfiltered: number;
  filter_counts: FilterCounts;
  app_counts: Record<string, number>;
  app_last_used: Record<string, string>;
  regex_error: boolean;
}

// --- Window management ---

/** Activate the Beetroot window (remove no-focus mode, bring to foreground) */
export function activateWindow(): Promise<void> {
  return invoke("activate_window");
}

/** Hide the window and clear no-focus state */
export function hideWindow(): Promise<void> {
  return invoke("hide_window");
}

/** Show a brief "Copied" overlay */
export function showCopyOverlay(
  label: string,
  position: string,
  durationMs: number,
  animation: string,
): Promise<void> {
  const style = getComputedStyle(document.documentElement);
  const bg = style.getPropertyValue("--bg-panel").trim() || "#141416";
  const fg = style.getPropertyValue("--text-primary").trim() || "#fff";
  const accent = style.getPropertyValue("--accent-main").trim() || "#4ADE80";
  return invoke("show_copy_overlay", {
    label,
    bg,
    fg,
    accent,
    position,
    durationMs,
    animation,
  });
}

/** Fetch a single clipboard item with full content (for paste/preview/transform) */
export function dbGetItem(id: number): Promise<ClipboardEntry> {
  return invoke<ClipboardEntry>("db_get_item", { id });
}

/** Restore an undo snapshot without changing a concurrently re-added row. */
export function dbRestoreItem(
  entry: ClipboardEntry,
  imageBase64?: string,
): Promise<ClipboardEntry> {
  return invoke<ClipboardEntry>("db_restore_item", { entry, imageBase64 });
}

/** Save image bytes and insert the row under the same backend lock as cleanup. */
export function dbSaveImageItem(
  base64Data: string,
  contentHash: string,
  sourceApp?: string,
  sourceTitle?: string,
): Promise<ClipboardEntry> {
  return invoke<ClipboardEntry>("db_save_image_item", {
    base64Data,
    contentHash,
    sourceApp,
    sourceTitle,
  });
}

/** Search clipboard items using Rust 5-phase search engine */
export function searchItems(request: SearchRequest): Promise<SearchResponse> {
  return invoke<SearchResponse>("search_items", { request });
}

/** Get display characters for all key codes on the current keyboard layout */
export function getKeyLabels(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_key_labels");
}

/** Check if DB was recovered from corruption on last startup. Returns notice message or null. */
export function checkRecoveryNotice(): Promise<string | null> {
  return invoke<string | null>("check_recovery_notice");
}

/** Get the Windows build number (e.g. 22621). Build >= 22000 = Win11. */
export function getOsBuild(): Promise<number> {
  return invoke<number>("get_os_build");
}

/** Get the source application that owns the current clipboard content */
export function getClipboardSource(): Promise<{
  app: string;
  title: string;
  exe_name: string;
  exe_path: string;
}> {
  return invoke("get_clipboard_source");
}

/** Get the icon for an application (cached in DB) */
export function getAppIcon(
  exeName: string,
  exePath?: string,
): Promise<{
  exe_name: string;
  display_name: string;
  icon_base64: string | null;
}> {
  return invoke("get_app_icon", { exeName, exePath: exePath ?? null });
}

/** Get all cached app icons in one batch (avoids N+1 IPC on startup) */
export function getAllAppIcons(): Promise<
  {
    exe_name: string;
    display_name: string;
    icon_base64: string | null;
  }[]
> {
  return invoke("get_all_app_icons");
}

/** Test connection to a local OpenAI-compatible endpoint (proxied via Rust to bypass mixed-content) */
export function testLocalEndpoint(endpoint: string): Promise<{
  ok: boolean;
  model: string;
  error: string;
}> {
  return invoke("test_local_endpoint", { endpoint });
}

/** List all available models from a local endpoint */
export function listLocalModels(endpoint: string): Promise<string[]> {
  return invoke("list_local_models", { endpoint });
}

// ── Background Jobs ─────────────────────────────────────────────────────

export interface SubmitJobParams {
  provider: string;
  model: string;
  endpoint?: string;
  prompt: string;
  promptName: string;
  inputText: string;
  imageBase64?: string;
  imageMime?: string;
  source?: "user" | "auto" | "mcp";
}

export function submitJob(params: SubmitJobParams): Promise<number> {
  return invoke<number>("submit_job", { params });
}

export function cancelJob(jobId: number): Promise<boolean> {
  return invoke<boolean>("cancel_job", { jobId });
}

/** Secret entry is the only IPC path that carries a key; jobs carry provider IDs only. */
export function saveApiKey(
  provider: CloudProvider,
  apiKey: string,
  overwrite = true,
): Promise<void> {
  return invoke("save_api_key", { provider, apiKey, overwrite });
}

export function deleteApiKey(provider: CloudProvider): Promise<void> {
  return invoke("delete_api_key", { provider });
}

export function getApiKeyStatus(provider: CloudProvider): Promise<boolean> {
  return invoke("get_api_key_status", { provider });
}

export function validateApiKey(provider: CloudProvider): Promise<void> {
  return invoke("validate_api_key", { provider });
}
