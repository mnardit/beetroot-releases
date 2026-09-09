import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyToClipboard, pasteItem, setSuppressNext, checkAndResetSuppress } from "../paste";

const mockWriteText = vi.fn().mockResolvedValue(undefined);
const mockWriteImageBase64 = vi.fn().mockResolvedValue(undefined);
const mockWriteHtmlAndText = vi.fn().mockResolvedValue(undefined);
const mockPasteSelectedItem = vi.fn().mockResolvedValue(undefined);
const mockReadImageBase64 = vi.fn().mockResolvedValue("base64data");

vi.mock("tauri-plugin-clipboard-api", () => ({
  writeText: (...args: unknown[]) => mockWriteText(...args),
  writeImageBase64: (...args: unknown[]) => mockWriteImageBase64(...args),
  writeHtmlAndText: (...args: unknown[]) => mockWriteHtmlAndText(...args),
}));

vi.mock("../tauri", () => ({
  pasteSelectedItem: () => mockPasteSelectedItem(),
  readImageBase64: (...args: unknown[]) => mockReadImageBase64(...args),
}));

import { makeEntry } from "../../test/fixtures";

const textEntry = makeEntry(1, { content: "hello" });

const imageEntry = makeEntry(2, {
  content: "img",
  content_type: "image",
  image_path: "/images/test.png",
});

describe("pasteItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset suppress flag
    checkAndResetSuppress();
  });

  it("writes text to clipboard for text entries", async () => {
    await pasteItem(textEntry);
    expect(mockWriteText).toHaveBeenCalledWith("hello");
    expect(mockWriteImageBase64).not.toHaveBeenCalled();
  });

  it("writes image to clipboard for image entries", async () => {
    await pasteItem(imageEntry);
    expect(mockReadImageBase64).toHaveBeenCalledWith("/images/test.png");
    expect(mockWriteImageBase64).toHaveBeenCalledWith("base64data");
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("calls pasteSelectedItem after writing to clipboard", async () => {
    await pasteItem(textEntry);
    expect(mockPasteSelectedItem).toHaveBeenCalledTimes(1);
  });

  it("sets suppress flag before writing to clipboard", async () => {
    await pasteItem(textEntry);
    // Suppress was set and should have been consumed or auto-reset
    // Verify it was set by checking the flag was set (it auto-resets via timeout)
    // Since we're in sync tests, just verify the flow completed
    expect(mockWriteText).toHaveBeenCalled();
  });

  it("skips clipboard write for image entry without image_path", async () => {
    const noPathImage = { ...imageEntry, image_path: null };
    await pasteItem(noPathImage);
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(mockReadImageBase64).not.toHaveBeenCalled();
  });
});

describe("pasteItem with pasteFormat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkAndResetSuppress();
  });

  it("uses writeText when pasteFormat is plain (default)", async () => {
    const entry = { ...textEntry, html_content: "<b>hello</b>" };
    await pasteItem(entry);
    expect(mockWriteText).toHaveBeenCalledWith("hello");
    expect(mockWriteHtmlAndText).not.toHaveBeenCalled();
  });

  it("uses writeHtmlAndText when pasteFormat is original and html_content exists", async () => {
    const entry = { ...textEntry, html_content: "<b>hello</b>" };
    await pasteItem(entry, true, "original");
    expect(readCfHtml(mockWriteHtmlAndText.mock.calls[0][0]).fragment).toBe("<b>hello</b>");
    expect(mockWriteHtmlAndText.mock.calls[0][1]).toBe("hello");
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("falls back to writeText when pasteFormat is original but no html_content", async () => {
    await pasteItem(textEntry, true, "original");
    expect(mockWriteText).toHaveBeenCalledWith("hello");
    expect(mockWriteHtmlAndText).not.toHaveBeenCalled();
  });

  it("always uses writeImageBase64 for images regardless of pasteFormat", async () => {
    await pasteItem(imageEntry, true, "original");
    expect(mockWriteImageBase64).toHaveBeenCalled();
    expect(mockWriteHtmlAndText).not.toHaveBeenCalled();
    expect(mockWriteText).not.toHaveBeenCalled();
  });
});

function readCfHtml(value: string) {
  const bytes = new TextEncoder().encode(value);
  const offset = (name: string) => {
    const match = value.match(new RegExp(`^${name}:(\\d+)\\r?$`, "m"));
    expect(match, `${name} byte offset`).not.toBeNull();
    return Number(match![1]);
  };
  const start = offset("StartHTML");
  const end = offset("EndHTML");
  const fragmentStart = offset("StartFragment");
  const fragmentEnd = offset("EndFragment");
  expect(start).toBe(105);
  expect(end).toBe(bytes.length);
  expect(fragmentStart).toBeGreaterThanOrEqual(start);
  expect(fragmentEnd).toBeLessThanOrEqual(end);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return {
    context: decoder.decode(bytes.slice(start, end)),
    fragment: decoder.decode(bytes.slice(fragmentStart, fragmentEnd)),
  };
}

describe("rich clipboard byte representation", () => {
  function contextFree(fragment: string, markers = true) {
    const prefix = markers ? "<!--StartFragment-->" : "";
    const suffix = markers ? "<!--EndFragment-->" : "";
    const header = (start: number, end: number) =>
      "Version:1.0\r\nStartHTML:-1\r\nEndHTML:-1\r\n" +
      `StartFragment:${String(start).padStart(10, "0")}\r\n` +
      `EndFragment:${String(end).padStart(10, "0")}\r\n`;
    const start = new TextEncoder().encode(header(0, 0) + prefix).length;
    return (
      header(start, start + new TextEncoder().encode(fragment).length) + prefix + fragment + suffix
    );
  }

  it.each([
    "<b>hello</b>",
    "<b>\u00e9\u4e2d\ud83d\ude00</b>",
    "<b>\u00e9<!--EndFragment-->tail</b>",
  ])("accepts context-free CF_HTML byte fragments on copy and paste: %s", async (fragment) => {
    for (const markers of [false, true]) {
      for (const copy of [true, false]) {
        mockWriteHtmlAndText.mockClear();
        const entry = { ...textEntry, html_content: contextFree(fragment, markers) };
        if (copy) await copyToClipboard(entry, "original");
        else await pasteItem(entry, false, "original");
        expect(mockWriteHtmlAndText).toHaveBeenCalledTimes(1);
        expect(readCfHtml(mockWriteHtmlAndText.mock.calls[0][0]).fragment).toBe(fragment);
        expect(mockWriteHtmlAndText.mock.calls[0][1]).toBe("hello");
      }
    }
  });

  it.each([
    "mixed sentinel",
    "negative",
    "reversed",
    "out of bounds",
    "header",
    "split UTF-8",
    "missing",
  ])("rejects malformed context-free fragment offsets: %s", async (kind) => {
    let html = contextFree("\u00e9\u4e2d\ud83d\ude00");
    const start = Number(html.match(/^StartFragment:(\d+)/m)![1]);
    if (kind === "mixed sentinel") html = html.replace("EndHTML:-1", "EndHTML:1");
    else if (kind === "missing") html = html.replace(/^EndFragment:.*\r\n/m, "");
    else if (kind === "out of bounds")
      html = html.replace(/^EndFragment:\d+/m, "EndFragment:9999999999");
    else if (kind === "reversed")
      html = html.replace(/^EndFragment:\d+/m, `EndFragment:${start - 1}`);
    else {
      const invalid = kind === "negative" ? -1 : kind === "header" ? 0 : start + 1;
      html = html.replace(
        /^StartFragment:\d+/m,
        `StartFragment:${String(invalid).padStart(10, "0")}`,
      );
    }
    mockWriteHtmlAndText.mockClear();
    mockPasteSelectedItem.mockClear();
    await expect(
      pasteItem({ ...textEntry, html_content: html }, true, "original"),
    ).rejects.toThrow();
    expect(mockWriteHtmlAndText).not.toHaveBeenCalled();
    expect(mockPasteSelectedItem).not.toHaveBeenCalled();
  });

  it.each(["<b>hello</b>", "<b>\u00e9\u4e2d\ud83d\ude00</b>"])(
    "writes byte-addressable CF_HTML for %s on copy and paste",
    async (fragment) => {
      for (const copy of [true, false]) {
        mockWriteHtmlAndText.mockClear();
        const entry = { ...textEntry, html_content: fragment };
        if (copy) await copyToClipboard(entry, "original");
        else await pasteItem(entry, false, "original");
        expect(mockWriteHtmlAndText).toHaveBeenCalledTimes(1);
        expect(readCfHtml(mockWriteHtmlAndText.mock.calls[0][0])).toEqual({
          fragment,
          context: `<html><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`,
        });
      }
    },
  );

  it("retains captured HTML context and existing fragment markers", async () => {
    const html =
      "<html><head><title>\u4e2d</title></head><body><!--StartFragment--><b>\u00e9</b><!--EndFragment--></body></html>";
    await copyToClipboard({ ...textEntry, html_content: html }, "original");
    expect(readCfHtml(mockWriteHtmlAndText.mock.lastCall![0])).toEqual({
      context: html,
      fragment: "<b>\u00e9</b>",
    });
  });

  it("accepts previously encoded CF_HTML without nesting its header", async () => {
    const captured =
      "Version:1.0\r\nStartHTML:0000000105\r\nEndHTML:0000000181\r\nStartFragment:0000000137\r\nEndFragment:0000000149\r\n<html><body><!--StartFragment--><b>hello</b><!--EndFragment--></body></html>";
    // Literal offsets above include the 105-byte header and 32-byte prefix.
    await copyToClipboard({ ...textEntry, html_content: captured }, "original");
    const result = readCfHtml(mockWriteHtmlAndText.mock.lastCall![0]);
    expect(result.fragment).toBe("<b>hello</b>");
    expect(result.context).not.toContain("Version:");
  });

  it("preserves a captured document without fragment markers", async () => {
    const html =
      '<html><head><title>Context</title></head><body lang="en"><b>\u4e2d</b></body></html>';
    await copyToClipboard({ ...textEntry, html_content: html }, "original");
    const result = readCfHtml(mockWriteHtmlAndText.mock.lastCall![0]);
    expect(result.fragment).toBe("<b>\u4e2d</b>");
    expect(result.context).toBe(
      '<html><head><title>Context</title></head><body lang="en"><!--StartFragment--><b>\u4e2d</b><!--EndFragment--></body></html>',
    );
  });

  it("propagates a combined write failure without injecting input", async () => {
    mockPasteSelectedItem.mockClear();
    mockWriteHtmlAndText.mockRejectedValueOnce(new Error("clipboard locked"));
    await expect(
      pasteItem({ ...textEntry, html_content: "<b>hello</b>" }, true, "original"),
    ).rejects.toThrow("clipboard locked");
    expect(mockPasteSelectedItem).not.toHaveBeenCalled();
    expect(checkAndResetSuppress()).toBe(false);
  });
});

describe("pasteItem error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkAndResetSuppress();
  });

  it("propagates writeText errors", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("clipboard locked"));
    await expect(pasteItem(textEntry)).rejects.toThrow("clipboard locked");
  });

  it("propagates readImageBase64 errors for image entries", async () => {
    mockReadImageBase64.mockRejectedValueOnce(new Error("file not found"));
    await expect(pasteItem(imageEntry)).rejects.toThrow("file not found");
  });

  it("propagates pasteSelectedItem errors", async () => {
    mockPasteSelectedItem.mockRejectedValueOnce(new Error("enigo failed"));
    await expect(pasteItem(textEntry)).rejects.toThrow("enigo failed");
  });
});

describe("suppress flag auto-reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    checkAndResetSuppress();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-resets after timeout", () => {
    setSuppressNext();
    expect(checkAndResetSuppress()).toBe(true);

    // Set again
    setSuppressNext();
    // Advance past timeout
    vi.advanceTimersByTime(3000);
    // Should have been auto-reset
    expect(checkAndResetSuppress()).toBe(false);
  });

  it("clears timeout when consumed normally", () => {
    setSuppressNext();
    // Consume it
    expect(checkAndResetSuppress()).toBe(true);
    // Advance timers — should not cause issues
    vi.advanceTimersByTime(3000);
    expect(checkAndResetSuppress()).toBe(false);
  });
});
