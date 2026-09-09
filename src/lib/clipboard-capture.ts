import {
  hasFiles,
  hasImage,
  hasText,
  hasHTML,
  readFiles,
  readText,
  readHtml,
  readImageBase64,
} from "tauri-plugin-clipboard-api";
import {
  getClipboardFormats,
  getClipboardSequence,
  getClipboardSource,
  readClipboardImageFile,
} from "./tauri";
import { MAX_IMAGE_SIZE, MAX_TEXT_SIZE } from "./constants";
import type { TranslationKey } from "./i18n";
import { createLogger } from "./log";
import { captureSuppression } from "./paste";

const log = createLogger("clipboard");
const encoder = new TextEncoder();
const excludedFormats = [
  "CF_CLIPBOARD_VIEWER_IGNORE",
  "Clipboard Viewer Ignore",
  "ExcludeClipboardContentFromMonitorProcessing",
];
const imageExtensions = [
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
];

export function isTextWithinLimit(text: string): boolean {
  return text.length <= MAX_TEXT_SIZE && encoder.encode(text).length <= MAX_TEXT_SIZE;
}

type Content = { kind: "text" | "image"; value: string; html?: string };
interface Capture {
  sequence: number;
  suppress: (sequence: number) => boolean;
  content?: Content;
  warning?: TranslationKey;
  source: Awaited<ReturnType<typeof getClipboardSource>> | null;
}

async function optionalRead<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    log.warn("Clipboard representation unavailable", error);
    return undefined;
  }
}

async function readContent(): Promise<Pick<Capture, "content" | "warning">> {
  const files = await hasFiles();
  const image = await hasImage();
  const text = await hasText();
  let warning: TranslationKey | undefined;
  let content: Content | undefined;
  if (image && text) {
    const value = await optionalRead(readText);
    if (value?.trim() && isTextWithinLimit(value)) content = { kind: "text", value };
  }
  if (!content && image) {
    const value = await optionalRead(readImageBase64);
    return {
      content: value && value.length <= MAX_IMAGE_SIZE ? { kind: "image", value } : undefined,
    };
  }
  if (!content && files) {
    const paths = await optionalRead(readFiles);
    const path = paths?.find((path) =>
      imageExtensions.some((ext) => path.toLowerCase().endsWith(ext)),
    );
    if (path) {
      if (!path.toLowerCase().endsWith(".png")) warning = "toast.imageFormatNotSupported";
      else {
        const value = await optionalRead(() => readClipboardImageFile(path));
        if (value && value.length <= MAX_IMAGE_SIZE) return { content: { kind: "image", value } };
      }
    }
  }
  if (!content && text) {
    const value = await optionalRead(readText);
    if (value !== undefined && isTextWithinLimit(value)) content = { kind: "text", value };
  }
  if (content?.kind === "text") {
    const html = await optionalRead(async () => ((await hasHTML()) ? readHtml() : undefined));
    if (html && isTextWithinLimit(html)) content.html = html;
  }
  return { content, warning };
}

/** A raw notification is only a wakeup. No value read before this boundary is trusted. */
export async function captureClipboard(isCurrent: () => boolean): Promise<Capture | undefined> {
  for (let attempt = 0; attempt < 3 && isCurrent(); attempt++) {
    try {
      const suppress = captureSuppression();
      const before = await getClipboardSequence();
      if (!before || !isCurrent()) return;
      // Standard Windows history/cloud flags are deliberately not presence-denied.
      const formats = await getClipboardFormats();
      if (formats.some((format) => excludedFormats.includes(format))) return;
      const captured = await readContent();
      const source = await getClipboardSource().catch(() => null);
      const after = await getClipboardSequence();
      if (!after || !isCurrent()) return;
      if (before === after) return { ...captured, source, sequence: before, suppress };
      // Delayed rendering can advance the sequence. Discard ALL old values and policy.
    } catch (error) {
      log.warn("Clipboard capture could not be verified", error);
      return;
    }
  }
}
