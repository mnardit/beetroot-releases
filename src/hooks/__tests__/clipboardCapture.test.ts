import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useClipboardMonitor } from "../useClipboardMonitor";
import { usePlainTextHotkey } from "../usePlainTextHotkey";
import { copyToClipboard, checkAndResetSuppress } from "../../lib/paste";
import { makeEntry, defaultSettings } from "../../test/fixtures";

const harness = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload: unknown }) => unknown>(),
  read: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name, callback) => {
    harness.listeners.set(name, callback);
    return () => harness.listeners.delete(name);
  }),
  emit: vi.fn(async (name, payload) => harness.listeners.get(name)?.({ payload })),
}));
vi.mock("tauri-plugin-clipboard-api", () => ({
  MONITOR_UPDATE_EVENT: "monitor",
  TEXT_CHANGED: "text",
  IMAGE_CHANGED: "image",
  onTextUpdate: vi.fn(async (callback) => {
    harness.listeners.set("text", ({ payload }) => callback((payload as { value: string }).value));
    return () => harness.listeners.delete("text");
  }),
  onImageUpdate: vi.fn(async (callback) => {
    harness.listeners.set("image", ({ payload }) => callback((payload as { value: string }).value));
    return () => harness.listeners.delete("image");
  }),
  startMonitor: () => harness.start(),
  stopMonitor: () => harness.stop(),
  hasFiles: () => harness.read("hasFiles"),
  hasImage: () => harness.read("hasImage"),
  hasText: () => harness.read("hasText"),
  hasHTML: () => harness.read("hasHTML"),
  readFiles: () => harness.read("files"),
  readImageBase64: () => harness.read("bitmap"),
  readText: () => harness.read("text"),
  readHtml: () => harness.read("html"),
  writeText: (text: string) => harness.write(text),
  writeHtmlAndText: (_html: string, text: string) => harness.write(text),
}));

function state(sequence = 10) {
  return {
    sequence,
    formats: [] as string[],
    hasFiles: false,
    hasImage: false,
    hasText: true,
    hasHTML: false,
    text: "A",
    html: "<b>A</b>",
    bitmap: "image-A",
    files: ["C:/synthetic/A.png"],
    file: "file-A",
    source: { app: "Editor", exe_name: "editor.exe", exe_path: "", title: "A" },
  };
}
let clipboard = state();
let reads: string[];
let duringRead: (name: string) => void;

async function settle() {
  for (let i = 0; i < 80; i++) await Promise.resolve();
}
async function mounted(paused = false) {
  const onText = vi.fn();
  const onImage = vi.fn();
  const onWarning = vi.fn();
  const hook = renderHook(({ paused }) => useClipboardMonitor(onText, onImage, paused, onWarning), {
    initialProps: { paused },
  });
  await act(settle);
  expect(harness.listeners.has("monitor")).toBe(true);
  const signal = harness.listeners.get("monitor")!;
  const update = async () => {
    await act(async () => {
      await signal({ payload: "clipboard update" });
      await settle();
    });
  };
  return { ...hook, onText, onImage, onWarning, update, signal };
}

beforeEach(() => {
  vi.clearAllMocks();
  while (checkAndResetSuppress()) {
    /* drain */
  }
  harness.listeners.clear();
  harness.start.mockResolvedValue(undefined);
  harness.stop.mockResolvedValue(undefined);
  clipboard = state();
  harness.write.mockImplementation(async (text: string) => {
    clipboard = { ...state(clipboard.sequence + 1), text };
  });
  reads = [];
  duringRead = () => {};
  const read = async (name: string) => {
    reads.push(name);
    const result = clipboard[name as keyof typeof clipboard];
    duringRead(name);
    return result;
  };
  harness.read.mockImplementation(read);
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "register_plain_text_hotkey" || command === "unregister_plain_text_hotkey")
      return;
    const names: Record<string, string> = {
      get_clipboard_sequence: "sequence",
      get_clipboard_formats: "formats",
      get_clipboard_source: "source",
      read_clipboard_image_file: "file",
    };
    if (!(command in names)) throw new Error(`Unexpected IPC: ${command}`);
    return read(names[command]);
  });
});
afterEach(() => {
  cleanup();
  while (checkAndResetSuppress()) {
    /* drain */
  }
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function holdFinalSequence() {
  const held = deferred<number>();
  const read = vi.mocked(invoke).getMockImplementation()!;
  let samples = 0;
  vi.mocked(invoke).mockImplementation((command, args, options) => {
    if (command === "get_clipboard_sequence" && ++samples === 2) return held.promise;
    return read(command, args, options);
  });
  return held;
}

describe("clipboard write intent ordering", () => {
  const copy = (text: string) => copyToClipboard(makeEntry(1, { content: text }));
  async function genuine(app: Awaited<ReturnType<typeof mounted>>, text = "genuine C") {
    clipboard = { ...state(clipboard.sequence + 1), text };
    await app.update();
  }

  it("a failed plain-text hotkey write cannot suppress the following genuine copy", async () => {
    const app = await mounted();
    renderHook(() => usePlainTextHotkey(defaultSettings({ plainTextHotkey: "Ctrl+Shift+V" })));
    await act(settle);
    harness.write.mockRejectedValueOnce(new Error("write failed"));
    await harness.listeners.get("plain-text-paste")!({ payload: undefined });
    await genuine(app);
    expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["genuine C"]);
    expect(
      vi.mocked(invoke).mock.calls.some(([command]) => command === "paste_selected_item"),
    ).toBe(false);
  });

  it("keeps an older final-sequence response from consuming a later self-write", async () => {
    const app = await mounted();
    const held = holdFinalSequence();
    const pending = app.signal({ payload: "clipboard update" });
    await act(settle);
    await copy("self B");
    held.resolve(10);
    await pending;
    await app.update();
    await app.update();
    await genuine(app);
    expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["A", "genuine C"]);
  });

  it("refreshes write intent only when a changed sequence forces full recapture", async () => {
    const app = await mounted();
    const held = holdFinalSequence();
    const pending = app.signal({ payload: "clipboard update" });
    await act(settle);
    await copy("self B");
    held.resolve(11);
    await pending;
    await genuine(app);
    expect(reads.filter((name) => name === "formats")).toHaveLength(3);
    expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["genuine C"]);
  });

  it.each([false, true])(
    "retains overlapping captures with newer-first delivery %s",
    async (newerFirst) => {
      const app = await mounted();
      const firstDone = deferred<void>();
      const secondDone = deferred<void>();
      harness.write
        .mockImplementationOnce((text) => {
          clipboard = { ...state(11), text };
          return firstDone.promise;
        })
        .mockImplementationOnce((text) => {
          clipboard = { ...state(12), text };
          return secondDone.promise;
        });
      const first = copy("self B");
      const held = holdFinalSequence();
      const pending = app.signal({ payload: "clipboard update" });
      await act(settle);
      const second = copy("self C");
      secondDone.resolve();
      await second;
      if (newerFirst) await app.update();
      held.resolve(11);
      await pending;
      await app.update();
      firstDone.resolve();
      await first;
      await genuine(app, "genuine D");
      expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["genuine D"]);
    },
  );

  it("a failed older write cannot clear a newer successful write's suppression", async () => {
    const app = await mounted();
    const failed = deferred<void>();
    harness.write.mockImplementationOnce(() => failed.promise);
    const first = copy("failed B").catch((error: Error) => error.message);
    await copy("self C");
    failed.reject(new Error("write failed"));
    expect(await first).toBe("write failed");
    await app.update();
    await genuine(app, "genuine D");
    expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["genuine D"]);
  });

  it("a failed newer write cannot invalidate the older write's pending capture", async () => {
    const app = await mounted();
    await copy("self B");
    const held = holdFinalSequence();
    const pending = app.signal({ payload: "clipboard update" });
    await act(settle);
    harness.write.mockRejectedValueOnce(new Error("write failed"));
    await expect(copy("failed C")).rejects.toThrow("write failed");
    held.resolve(11);
    await pending;
    await genuine(app, "genuine D");
    expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["genuine D"]);
  });

  it("does not reserve a future copy for an overwritten self-write", async () => {
    const app = await mounted();
    await copy("self B");
    await copy("self C");
    await app.update();
    await genuine(app, "genuine D");
    expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["genuine D"]);
  });

  it("removes a failed write's credit before a genuine following copy", async () => {
    const app = await mounted();
    harness.write.mockRejectedValueOnce(new Error("write failed"));
    await expect(copy("failed B")).rejects.toThrow("write failed");
    await genuine(app);
    expect(app.onText.mock.calls.map(([text]) => text)).toEqual(["genuine C"]);
  });
});

describe("coherent clipboard capture", () => {
  it.each(["pause", "restart"])(
    "does not dedupe a new lifecycle against a cancelled handoff after %s",
    async (action) => {
      const app = await mounted();
      await app.update();
      const oldGuard = app.onText.mock.calls[0][4];
      if (action === "pause") {
        app.rerender({ paused: true });
        app.rerender({ paused: false });
      } else {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
        document.dispatchEvent(new Event("visibilitychange"));
        await act(settle);
      }
      expect(oldGuard()).toBe(false);
      clipboard.sequence++;
      await act(async () => {
        await harness.listeners.get("monitor")!({ payload: "clipboard update" });
        await settle();
      });
      expect(app.onText).toHaveBeenCalledTimes(2);
    },
  );
  it("hands persistence a guard that expires after pause and resume", async () => {
    const app = await mounted();
    await app.update();
    const isCurrent = app.onText.mock.calls[0][4];
    expect(typeof isCurrent).toBe("function");
    expect(isCurrent()).toBe(true);
    app.rerender({ paused: true });
    app.rerender({ paused: false });
    expect(isCurrent()).toBe(false);
  });
  it("does not admit untagged value events", async () => {
    const app = await mounted();
    await act(async () => {
      harness.listeners.get("text")?.({ payload: { value: "old protected text" } });
      harness.listeners.get("image")?.({ payload: { value: "old protected image" } });
      await settle();
    });
    expect(app.onText).not.toHaveBeenCalled();
    expect(app.onImage).not.toHaveBeenCalled();
  });

  it.each(["text", "html", "bitmap", "files", "file", "source"])(
    "fully recaptures when the generation changes during %s",
    async (stage) => {
      clipboard.hasHTML = stage === "html";
      clipboard.hasImage = stage === "bitmap";
      clipboard.hasFiles = stage === "files" || stage === "file";
      clipboard.hasText = !clipboard.hasImage && !clipboard.hasFiles;
      let changed = false;
      duringRead = (name) => {
        if (name === stage && !changed) {
          changed = true;
          clipboard = { ...state(11), text: "B", source: { ...state().source, title: "B" } };
        }
      };
      const app = await mounted();
      await app.update();
      expect(app.onText.mock.calls).toEqual([
        ["B", undefined, "editor.exe", "B", expect.any(Function)],
      ]);
      expect(app.onImage).not.toHaveBeenCalled();
    },
  );

  it.each([
    "CF_CLIPBOARD_VIEWER_IGNORE",
    "Clipboard Viewer Ignore",
    "ExcludeClipboardContentFromMonitorProcessing",
  ])("rejects every ingress carrying dedicated exclusion %s", async (marker) => {
    for (const kind of ["text", "bitmap", "file"]) {
      clipboard = {
        ...state(),
        formats: [marker],
        hasImage: kind === "bitmap",
        hasFiles: kind === "file",
      };
      const app = await mounted();
      await app.update();
      expect(app.onText).not.toHaveBeenCalled();
      expect(app.onImage).not.toHaveBeenCalled();
      app.unmount();
      await act(settle);
    }
  });

  it.each(["sequence", "formats"])("fails closed on failed %s IPC", async (stage) => {
    duringRead = (name) => {
      if (name === stage) throw new Error("unavailable");
    };
    const app = await mounted();
    await app.update();
    expect(app.onText).not.toHaveBeenCalled();
    expect(app.onImage).not.toHaveBeenCalled();
  });

  it("never treats zero as a valid sequence", async () => {
    clipboard.sequence = 0;
    const app = await mounted();
    await app.update();
    expect(app.onText).not.toHaveBeenCalled();
    expect(reads).not.toContain("text");
  });

  it.each(["zero", "failure"])("rejects an unavailable final sequence (%s)", async (mode) => {
    duringRead = (name) => {
      if (name === "source") {
        if (mode === "zero") clipboard.sequence = 0;
        else
          duringRead = (next) => {
            if (next === "sequence") throw new Error("access lost");
          };
      }
    };
    const app = await mounted();
    await app.update();
    expect(app.onText).not.toHaveBeenCalled();
    expect(app.onImage).not.toHaveBeenCalled();
  });

  it("does not authenticate changed HTML by equal plain text", async () => {
    clipboard.hasHTML = true;
    duringRead = (name) => {
      if (name === "html") clipboard = { ...state(11), formats: ["Clipboard Viewer Ignore"] };
    };
    const app = await mounted();
    await app.update();
    expect(app.onText).not.toHaveBeenCalled();
  });

  it("does not poison dedup when an earlier capture was excluded", async () => {
    clipboard.formats = ["Clipboard Viewer Ignore"];
    const app = await mounted();
    await app.update();
    clipboard = state(11);
    await app.update();
    expect(app.onText.mock.calls).toEqual([
      ["A", undefined, "editor.exe", "A", expect.any(Function)],
    ]);
  });

  it.each(["html", "source"])(
    "retains verified text when optional %s lookup fails",
    async (stage) => {
      clipboard.hasHTML = true;
      duringRead = (name) => {
        if (name === stage) throw new Error("optional read failed");
      };
      const app = await mounted();
      await app.update();
      expect(app.onText).toHaveBeenCalledWith(
        "A",
        stage === "html" ? undefined : "<b>A</b>",
        stage === "source" ? undefined : "editor.exe",
        stage === "source" ? undefined : "A",
        expect.any(Function),
      );
    },
  );

  it("rechecks exclusions after delayed rendering instead of relabeling old bytes", async () => {
    duringRead = (name) => {
      if (name === "text") clipboard = { ...state(11), formats: ["Clipboard Viewer Ignore"] };
    };
    const app = await mounted();
    await app.update();
    expect(app.onText).not.toHaveBeenCalled();
    expect(reads.filter((name) => name === "formats")).toHaveLength(2);
  });

  it("bounds full recapture while the clipboard keeps changing", async () => {
    duringRead = (name) => {
      if (name === "text") clipboard.sequence++;
    };
    const app = await mounted();
    await app.update();
    expect(app.onText).not.toHaveBeenCalled();
    expect(reads.filter((name) => name === "text")).toHaveLength(3);
  });

  it("allows Office text and HTML with standard history/cloud flags", async () => {
    clipboard = {
      ...state(),
      hasImage: true,
      hasHTML: true,
      text: "A1\tB1\nA2\tB2",
      html: "<table><tr><td>A1</td></tr></table>",
      formats: ["CanIncludeInClipboardHistory", "CanUploadToCloudClipboard"],
    };
    const app = await mounted();
    await app.update();
    expect(app.onText.mock.calls).toEqual([
      [clipboard.text, clipboard.html, "editor.exe", "A", expect.any(Function)],
    ]);
    expect(app.onImage).not.toHaveBeenCalled();
    expect(reads[0]).toBe("sequence");
    expect(reads[reads.length - 1]).toBe("sequence");
  });

  it.each(["pause", "unmount", "restart"])("discards pending capture after %s", async (action) => {
    let release!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    harness.read.mockImplementation(async (name) =>
      name === "text" ? pending : clipboard[name as keyof typeof clipboard],
    );
    const app = await mounted();
    const work = app.signal({ payload: "clipboard update" });
    await act(settle);
    if (action === "pause") {
      app.rerender({ paused: true });
      app.rerender({ paused: false });
    } else if (action === "unmount") app.unmount();
    else {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    }
    await act(async () => {
      release("stale");
      await work;
      await settle();
    });
    expect(app.onText).not.toHaveBeenCalled();
    expect(app.onImage).not.toHaveBeenCalled();
  });
});
