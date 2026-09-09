import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useClipboardMonitor } from "../useClipboardMonitor";
import { MAX_TEXT_SIZE, MAX_IMAGE_SIZE } from "../../lib/constants";
import { copyToClipboard, checkAndResetSuppress } from "../../lib/paste";
import { makeEntry } from "../../test/fixtures";
import {
  startMonitor,
  stopMonitor,
  hasFiles,
  hasImage,
  hasText,
  hasHTML,
  readFiles,
  readImageBase64,
  readHtml,
  readText,
} from "tauri-plugin-clipboard-api";

const mockListen = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));
vi.mock("tauri-plugin-clipboard-api", () => ({
  startMonitor: vi.fn(),
  stopMonitor: vi.fn(),
  hasFiles: vi.fn(),
  hasImage: vi.fn(),
  hasHTML: vi.fn(),
  hasText: vi.fn(),
  readFiles: vi.fn(),
  readImageBase64: vi.fn(),
  readHtml: vi.fn(),
  readText: vi.fn(),
  writeHtmlAndText: vi.fn().mockResolvedValue(undefined),
  writeText: vi.fn().mockResolvedValue(undefined),
  writeImageBase64: vi.fn().mockResolvedValue(undefined),
  MONITOR_UPDATE_EVENT: "plugin:clipboard://clipboard-monitor/update",
}));
const mockGetClipboardFormats = vi.fn();
const mockGetClipboardSource = vi.fn();
const mockGetClipboardSequence = vi.fn();
const mockReadClipboardImageFile = vi.fn();
vi.mock("../../lib/tauri", () => ({
  getClipboardFormats: () => mockGetClipboardFormats(),
  getClipboardSequence: () => mockGetClipboardSequence(),
  getClipboardSource: () => mockGetClipboardSource(),
  readClipboardImageFile: (...args: unknown[]) => mockReadClipboardImageFile(...args),
}));
let sequence: number;
let listener: (event: { payload: string }) => Promise<void>;
let unlisten: ReturnType<typeof vi.fn>;
async function settle() {
  for (let i = 0; i < 80; i++) await Promise.resolve();
}
async function mount(paused = false) {
  const onText = vi.fn(),
    onImage = vi.fn(),
    onWarning = vi.fn();
  const hook = renderHook(() => useClipboardMonitor(onText, onImage, paused, onWarning));
  await act(settle);
  return { ...hook, onText, onImage, onWarning };
}
async function update() {
  await act(async () => {
    await listener({ payload: "clipboard update" });
    await settle();
  });
}
async function text(value: string) {
  sequence++;
  vi.mocked(hasImage).mockResolvedValue(false);
  vi.mocked(hasText).mockResolvedValue(true);
  vi.mocked(readText).mockResolvedValue(value);
  await update();
}
async function image(value: string) {
  sequence++;
  vi.mocked(hasImage).mockResolvedValue(true);
  vi.mocked(hasText).mockResolvedValue(false);
  vi.mocked(readImageBase64).mockResolvedValue(value);
  await update();
}

beforeEach(() => {
  vi.resetAllMocks();
  while (checkAndResetSuppress()) {
    /* drain */
  }
  sequence = 1;
  unlisten = vi.fn();
  mockListen.mockImplementation(async (_name, callback) => {
    listener = callback;
    return unlisten;
  });
  vi.mocked(startMonitor).mockResolvedValue(undefined);
  vi.mocked(stopMonitor).mockResolvedValue(undefined);
  vi.mocked(hasFiles).mockResolvedValue(false);
  vi.mocked(hasImage).mockResolvedValue(false);
  vi.mocked(hasText).mockResolvedValue(false);
  vi.mocked(hasHTML).mockResolvedValue(false);
  vi.mocked(readText).mockResolvedValue("");
  vi.mocked(readHtml).mockResolvedValue("");
  vi.mocked(readFiles).mockResolvedValue([]);
  vi.mocked(readImageBase64).mockResolvedValue("");
  mockGetClipboardFormats.mockResolvedValue([]);
  mockGetClipboardSource.mockResolvedValue({ app: "Unknown", title: "", exe_name: "" });
  mockGetClipboardSequence.mockImplementation(async () => sequence);
  mockReadClipboardImageFile.mockResolvedValue("");
});
afterEach(async () => {
  cleanup();
  await act(settle);
  vi.restoreAllMocks();
});

describe("useClipboardMonitor", () => {
  it("starts monitor after subscribing to raw clipboard notifications", async () => {
    await mount();
    expect(mockListen).toHaveBeenCalledTimes(1);
    expect(startMonitor).toHaveBeenCalledTimes(1);
    expect(mockListen.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(startMonitor).mock.invocationCallOrder[0],
    );
  });
  it("forwards text updates to callback", async () => {
    const app = await mount();
    await text("hello");
    expect(app.onText).toHaveBeenCalledWith("hello", undefined, "", "", expect.any(Function));
  });
  it("forwards image updates to callback", async () => {
    const app = await mount();
    await image("base64data");
    expect(app.onImage).toHaveBeenCalledWith("base64data", "", "", expect.any(Function));
  });
  it("drops image exceeding MAX_IMAGE_SIZE", async () => {
    const app = await mount();
    await image("x".repeat(MAX_IMAGE_SIZE + 1));
    expect(app.onImage).not.toHaveBeenCalled();
  });
  it("dedupes consecutive identical text events", async () => {
    const app = await mount();
    await text("hello");
    await text("hello");
    expect(app.onText).toHaveBeenCalledTimes(1);
  });
  it("saves consecutive distinct text events", async () => {
    const app = await mount();
    await text("a");
    await text("b");
    await text("c");
    expect(app.onText.mock.calls.map((call) => call[0])).toEqual(["a", "b", "c"]);
  });
  it("saves identical text again after the dedup window expires", async () => {
    const app = await mount();
    const date = vi.spyOn(Date, "now").mockReturnValue(1000);
    await text("X");
    date.mockReturnValue(1600);
    await text("X");
    expect(app.onText).toHaveBeenCalledTimes(2);
  });
  it("never pairs old text with HTML when text changes during readHtml", async () => {
    const app = await mount();
    vi.mocked(hasHTML).mockResolvedValue(true);
    vi.mocked(readHtml)
      .mockImplementationOnce(async () => {
        sequence++;
        vi.mocked(readText).mockResolvedValue("B");
        return "<b>B's html</b>";
      })
      .mockResolvedValue("<b>B's html</b>");
    await text("A");
    expect(app.onText.mock.calls).toEqual([["B", "<b>B's html</b>", "", "", expect.any(Function)]]);
  });
  it("drops text exceeding MAX_TEXT_SIZE", async () => {
    const app = await mount();
    await text("a".repeat(MAX_TEXT_SIZE + 1));
    expect(app.onText).not.toHaveBeenCalled();
  });
  it("cleans up listeners on unmount", async () => {
    const app = await mount();
    app.unmount();
    await act(settle);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
  it.each(["\u00e9", "\u4e2d", "\ud83d\ude00"])(
    "enforces UTF-8 text limits for %s",
    async (character) => {
      const app = await mount();
      const bytes = new TextEncoder().encode(character).length;
      const boundary =
        character.repeat(Math.floor(MAX_TEXT_SIZE / bytes)) + "a".repeat(MAX_TEXT_SIZE % bytes);
      await text(boundary + "a");
      expect(app.onText).not.toHaveBeenCalled();
      await text(boundary);
      expect(app.onText.mock.calls.map((call) => call[0])).toEqual([boundary]);
    },
  );
  it("skips text when password manager format is detected", async () => {
    mockGetClipboardFormats.mockResolvedValue(["CF_CLIPBOARD_VIEWER_IGNORE"]);
    const app = await mount();
    await text("password123");
    expect(app.onText).not.toHaveBeenCalled();
  });
  it("skips text save when getClipboardFormats rejects (fail-closed)", async () => {
    mockGetClipboardFormats.mockRejectedValueOnce(new Error("OpenClipboard failed"));
    const app = await mount();
    await text("possibly-a-password");
    expect(app.onText).not.toHaveBeenCalled();
  });
  it("calls stopMonitor on unmount", async () => {
    const app = await mount();
    app.unmount();
    await act(settle);
    expect(stopMonitor).toHaveBeenCalledTimes(1);
  });
  it("prefers text over bitmap when both present (Excel/Word cell copies)", async () => {
    vi.mocked(hasImage).mockResolvedValue(true);
    vi.mocked(hasText).mockResolvedValue(true);
    vi.mocked(readText).mockResolvedValue("A1\tB1\tC1\nA2\tB2\tC2");
    const app = await mount();
    await update();
    expect(app.onText).toHaveBeenCalledWith(
      "A1\tB1\tC1\nA2\tB2\tC2",
      undefined,
      "",
      "",
      expect.any(Function),
    );
    expect(app.onImage).not.toHaveBeenCalled();
  });
  it.each([
    ["text alongside image is empty", "   "],
    ["text alongside image exceeds MAX_TEXT_SIZE", "a".repeat(MAX_TEXT_SIZE + 1)],
    ["Unicode text exceeds the byte limit", "\u4e2d".repeat(Math.floor(MAX_TEXT_SIZE / 3) + 1)],
  ])("preserves bitmap fallback when %s", async (_label, value) => {
    vi.mocked(hasImage).mockResolvedValue(true);
    vi.mocked(hasText).mockResolvedValue(true);
    vi.mocked(readText).mockResolvedValue(value);
    vi.mocked(readImageBase64).mockResolvedValue("bitmap-data");
    const app = await mount();
    await update();
    expect(app.onImage).toHaveBeenCalledWith("bitmap-data", "", "", expect.any(Function));
    expect(app.onText).not.toHaveBeenCalled();
  });
  it("falls through to bitmap when readText throws while reading text alongside image", async () => {
    vi.mocked(hasImage).mockResolvedValue(true);
    vi.mocked(hasText).mockResolvedValue(true);
    vi.mocked(readText).mockRejectedValueOnce(new Error("clipboard locked"));
    vi.mocked(readImageBase64).mockResolvedValue("bitmap-data");
    const app = await mount();
    await update();
    expect(app.onImage).toHaveBeenCalledWith("bitmap-data", "", "", expect.any(Function));
    expect(app.onText).not.toHaveBeenCalled();
  });
  it("prioritizes bitmap image over files when no text is present", async () => {
    vi.mocked(hasImage).mockResolvedValue(true);
    vi.mocked(hasFiles).mockResolvedValue(true);
    vi.mocked(readImageBase64).mockResolvedValue("bitmap-data");
    const app = await mount();
    await update();
    expect(app.onImage).toHaveBeenCalledWith("bitmap-data", "", "", expect.any(Function));
    expect(mockReadClipboardImageFile).not.toHaveBeenCalled();
  });
  it("reads image file from Explorer when no bitmap", async () => {
    vi.mocked(hasFiles).mockResolvedValue(true);
    vi.mocked(hasText).mockResolvedValue(true);
    vi.mocked(readFiles).mockResolvedValue(["C:/Photos/image.png"]);
    mockReadClipboardImageFile.mockResolvedValue("file-image-base64");
    const app = await mount();
    await update();
    expect(mockReadClipboardImageFile).toHaveBeenCalledWith("C:/Photos/image.png");
    expect(app.onImage).toHaveBeenCalledWith("file-image-base64", "", "", expect.any(Function));
    expect(app.onText).not.toHaveBeenCalled();
  });
  it("falls through to text for non-image files", async () => {
    vi.mocked(hasFiles).mockResolvedValue(true);
    vi.mocked(readFiles).mockResolvedValue(["C:/Docs/readme.txt"]);
    const app = await mount();
    await text("C:/Docs/readme.txt");
    expect(mockReadClipboardImageFile).not.toHaveBeenCalled();
    expect(app.onText).toHaveBeenCalledWith(
      "C:/Docs/readme.txt",
      undefined,
      "",
      "",
      expect.any(Function),
    );
  });
  it("ignores non-update payloads", async () => {
    await mount();
    await listener({ payload: "something else" });
    expect(hasImage).not.toHaveBeenCalled();
    expect(hasFiles).not.toHaveBeenCalled();
    expect(hasText).not.toHaveBeenCalled();
  });
  it("falls through to text when readFiles returns empty array", async () => {
    vi.mocked(hasFiles).mockResolvedValue(true);
    const app = await mount();
    await text("some text");
    expect(mockReadClipboardImageFile).not.toHaveBeenCalled();
    expect(app.onText).toHaveBeenCalledWith("some text", undefined, "", "", expect.any(Function));
  });
  it("does not fall through to file/text when readImageBase64 throws", async () => {
    vi.mocked(hasImage).mockResolvedValue(true);
    vi.mocked(hasFiles).mockResolvedValue(true);
    vi.mocked(readImageBase64).mockRejectedValueOnce(new Error("bitmap read failed"));
    const app = await mount();
    await update();
    expect(mockReadClipboardImageFile).not.toHaveBeenCalled();
    expect(app.onText).not.toHaveBeenCalled();
    expect(app.onImage).not.toHaveBeenCalled();
  });
  it("does not fire callbacks when paused", async () => {
    const app = await mount(true);
    await text("ignored");
    await image("ignored");
    expect(app.onText).not.toHaveBeenCalled();
    expect(app.onImage).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
    expect(readImageBase64).not.toHaveBeenCalled();
  });
  it("rejects non-PNG image files from Explorer ingest and warns", async () => {
    vi.mocked(hasFiles).mockResolvedValue(true);
    vi.mocked(readFiles).mockResolvedValue(["C:/Photos/photo.jpg", "C:/Photos/later.png"]);
    const app = await mount();
    await update();
    expect(app.onImage).not.toHaveBeenCalled();
    expect(mockReadClipboardImageFile).not.toHaveBeenCalled();
    expect(app.onWarning).toHaveBeenCalledWith("toast.imageFormatNotSupported");
  });
  it("ingests .png files from Explorer normally", async () => {
    vi.mocked(hasFiles).mockResolvedValue(true);
    vi.mocked(readFiles).mockResolvedValue(["C:/Photos/screenshot.PNG"]);
    mockReadClipboardImageFile.mockResolvedValue("iVBORw0KGgo...");
    const app = await mount();
    await update();
    expect(app.onImage).toHaveBeenCalledWith("iVBORw0KGgo...", "", "", expect.any(Function));
    expect(app.onWarning).not.toHaveBeenCalled();
  });
  it("does not let an image dedup against a recent text event", async () => {
    const app = await mount();
    await text("hello");
    await image("screenshot-base64-payload");
    expect(app.onText).toHaveBeenCalledTimes(1);
    expect(app.onImage).toHaveBeenCalledTimes(1);
    expect(app.onImage).toHaveBeenCalledWith(
      "screenshot-base64-payload",
      "",
      "",
      expect.any(Function),
    );
  });
  it("does not let text dedup against a recent image fingerprint", async () => {
    const app = await mount();
    await image("screenshot-base64-payload");
    await text("hello");
    expect(app.onText).toHaveBeenCalledTimes(1);
    expect(app.onImage).toHaveBeenCalledTimes(1);
    expect(app.onText).toHaveBeenCalledWith("hello", undefined, "", "", expect.any(Function));
  });
  it.each(["plain", "original"] as const)(
    "suppresses a %s write generation without eating the next genuine copy",
    async (format) => {
      const app = await mount();
      await copyToClipboard(makeEntry(1, { content: "self", html_content: "<b>self</b>" }), format);
      await text("self");
      await update();
      await update(); // Duplicate OS wakeups, same clipboard state.
      expect(app.onText).not.toHaveBeenCalled();
      await text("genuine");
      expect(app.onText.mock.calls).toEqual([["genuine", undefined, "", "", expect.any(Function)]]);
    },
  );
});
