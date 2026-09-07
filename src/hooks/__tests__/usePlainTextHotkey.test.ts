import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { readText, writeText } from "tauri-plugin-clipboard-api";
import { usePlainTextHotkey } from "../usePlainTextHotkey";
import {
  registerPlainTextHotkey,
  unregisterPlainTextHotkey,
  pasteSelectedItem,
} from "../../lib/tauri";
import { suppressedWrite } from "../../lib/paste";
import { defaultSettings } from "../../test/fixtures";

vi.mock("../../lib/tauri", () => ({
  registerPlainTextHotkey: vi.fn(() => Promise.resolve()),
  unregisterPlainTextHotkey: vi.fn(() => Promise.resolve()),
  pasteSelectedItem: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/paste", () => ({
  suppressedWrite: vi.fn((write: () => Promise<unknown>) => write()),
}));

describe("usePlainTextHotkey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers hotkey on mount with provided shortcut", async () => {
    const settings = { ...defaultSettings(), plainTextHotkey: "Ctrl+Shift+V" };
    renderHook(() => usePlainTextHotkey(settings));
    await vi.waitFor(() => {
      expect(registerPlainTextHotkey).toHaveBeenCalledWith("Ctrl+Shift+V");
    });
  });

  it("does NOT register when hotkey is empty string", () => {
    const settings = { ...defaultSettings(), plainTextHotkey: "" };
    renderHook(() => usePlainTextHotkey(settings));
    expect(registerPlainTextHotkey).not.toHaveBeenCalled();
  });

  it("unregisters previous hotkey when settings change", async () => {
    const settings = { ...defaultSettings(), plainTextHotkey: "Ctrl+Shift+V" };
    const { rerender } = renderHook(({ s }: { s: typeof settings }) => usePlainTextHotkey(s), {
      initialProps: { s: settings },
    });
    await vi.waitFor(() => expect(registerPlainTextHotkey).toHaveBeenCalledWith("Ctrl+Shift+V"));

    const newSettings = { ...settings, plainTextHotkey: "Ctrl+Alt+V" };
    rerender({ s: newSettings });

    await vi.waitFor(() => {
      expect(unregisterPlainTextHotkey).toHaveBeenCalled();
      expect(registerPlainTextHotkey).toHaveBeenLastCalledWith("Ctrl+Alt+V");
    });
  });

  it("on plain-text-paste event: read clipboard, suppress, writeText, paste", async () => {
    let capturedListener: (() => void) | null = null;
    vi.mocked(listen).mockImplementation(async (_name, cb) => {
      capturedListener = cb as () => void;
      return () => {};
    });
    vi.mocked(readText).mockResolvedValue("hello world");

    const settings = { ...defaultSettings(), plainTextHotkey: "Ctrl+Shift+V" };
    renderHook(() => usePlainTextHotkey(settings));

    await vi.waitFor(() => expect(capturedListener).not.toBeNull());

    capturedListener!();
    await vi.waitFor(() => {
      expect(suppressedWrite).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith("hello world");
      expect(pasteSelectedItem).toHaveBeenCalled();
    });
  });

  it("plain-text-paste with empty clipboard is a no-op", async () => {
    let capturedListener: (() => void) | null = null;
    vi.mocked(listen).mockImplementation(async (_name, cb) => {
      capturedListener = cb as () => void;
      return () => {};
    });
    vi.mocked(readText).mockResolvedValue("");

    const settings = { ...defaultSettings(), plainTextHotkey: "Ctrl+Shift+V" };
    renderHook(() => usePlainTextHotkey(settings));
    await vi.waitFor(() => expect(capturedListener).not.toBeNull());

    capturedListener!();
    await new Promise((r) => setTimeout(r, 50));

    expect(writeText).not.toHaveBeenCalled();
    expect(pasteSelectedItem).not.toHaveBeenCalled();
  });

  it("registration failure logs warn but does not throw", async () => {
    vi.mocked(registerPlainTextHotkey).mockRejectedValueOnce(new Error("nope"));
    const settings = { ...defaultSettings(), plainTextHotkey: "Ctrl+Shift+V" };
    expect(() => {
      renderHook(() => usePlainTextHotkey(settings));
    }).not.toThrow();
  });

  it("cleanup on unmount unregisters hotkey", async () => {
    const settings = { ...defaultSettings(), plainTextHotkey: "Ctrl+Shift+V" };
    const { unmount } = renderHook(() => usePlainTextHotkey(settings));
    await vi.waitFor(() => expect(registerPlainTextHotkey).toHaveBeenCalled());
    unmount();
    await vi.waitFor(() => expect(unregisterPlainTextHotkey).toHaveBeenCalled());
  });
});
