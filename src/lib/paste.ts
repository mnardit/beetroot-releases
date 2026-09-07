import { writeText, writeImageBase64, writeHtmlAndText } from "tauri-plugin-clipboard-api";
import { pasteSelectedItem, readImageBase64 } from "./tauri";
import { encodeCfHtml } from "./cf-html";
import type { PasteResult } from "./tauri";
import type { ClipboardEntry } from "../types/clipboard";
import type { PasteFormat } from "./settings";

interface WriteIntent {
  remaining: number;
  sequences: Set<number>;
  timer?: ReturnType<typeof setTimeout>;
}
let suppressIntent: WriteIntent | undefined;

/** Auto-reset suppress counter timeout (ms). Prevents counter from being stuck. */
const SUPPRESS_TIMEOUT_MS = 2000;

/** Mark the next N verified clipboard generations as self-initiated.
 * The monitor ignores repeated notifications for a consumed generation. */
export function setSuppressNext(count = 1) {
  const intent: WriteIntent = { remaining: count, sequences: new Set() };
  suppressIntent = intent;
  intent.timer = setTimeout(() => cancelIntent(intent), SUPPRESS_TIMEOUT_MS);
  return intent;
}

function cancelIntent(intent: WriteIntent) {
  intent.remaining = 0;
  intent.sequences.clear();
  clearTimeout(intent.timer);
}

function consumeIntent(intent: WriteIntent | undefined, sequence?: number): boolean {
  if (!intent) return false;
  if (sequence !== undefined && intent.sequences.has(sequence)) return true;
  if (intent.remaining <= 0) return false;
  intent.remaining--;
  if (sequence !== undefined) intent.sequences.add(sequence);
  if (intent.remaining === 0) clearTimeout(intent.timer);
  return true;
}

/** Capture before the attempt's first sequence request, not when its response arrives. */
export function captureSuppression(): (sequence: number) => boolean {
  const intent = suppressIntent;
  return (sequence) => consumeIntent(intent, sequence);
}

/** Consume the current explicit suppression count. Captures use their saved intent. */
export function checkAndResetSuppress(): boolean {
  return consumeIntent(suppressIntent);
}

/** A coherent text, image or combined HTML/text write consumes one generation.
 * Notification multiplicity is not a reliable count of clipboard writes. */
export async function suppressedWrite<T>(write: () => Promise<T>, count = 1): Promise<T> {
  const intent = setSuppressNext(count);
  try {
    return await write();
  } catch (e) {
    // A delayed failure must not clear another write's suppression.
    cancelIntent(intent);
    throw e;
  }
}

/** Write item to system clipboard without pasting (no Ctrl+V, no window hide). */
export async function copyToClipboard(
  item: ClipboardEntry,
  pasteFormat: PasteFormat = "plain",
): Promise<void> {
  if (item.content_type === "image") {
    if (!item.image_path) return;
    const base64 = await readImageBase64(item.image_path);
    await suppressedWrite(() => writeImageBase64(base64));
  } else if (pasteFormat === "original" && item.html_content) {
    const html = encodeCfHtml(item.html_content);
    await suppressedWrite(() => writeHtmlAndText(html, item.content));
  } else {
    await suppressedWrite(() => writeText(item.content));
  }
}

/** Write item to system clipboard and optionally simulate Ctrl+V to paste into the active app.
 *  Returns "pasted", "copied" (target window gone), or undefined (autoPaste=false). */
export async function pasteItem(
  item: ClipboardEntry,
  autoPaste = true,
  pasteFormat: PasteFormat = "plain",
): Promise<PasteResult | undefined> {
  if (item.content_type === "image") {
    if (!item.image_path) return undefined;
    const base64 = await readImageBase64(item.image_path);
    await suppressedWrite(() => writeImageBase64(base64));
  } else if (pasteFormat === "original" && item.html_content) {
    const html = encodeCfHtml(item.html_content);
    await suppressedWrite(() => writeHtmlAndText(html, item.content));
  } else {
    await suppressedWrite(() => writeText(item.content));
  }
  if (autoPaste) {
    return await pasteSelectedItem();
  }
  return undefined;
}
