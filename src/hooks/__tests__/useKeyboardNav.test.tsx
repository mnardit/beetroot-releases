import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useKeyboardNav } from "../useKeyboardNav";
import { makeEntry } from "../../test/fixtures";

const mockHide = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    onFocusChanged: vi.fn().mockResolvedValue(() => {}),
    listen: vi.fn().mockResolvedValue(() => {}),
    show: vi.fn(),
    setFocus: vi.fn(),
  }),
}));

vi.mock("../../lib/tauri", () => ({
  hideWindow: (...args: unknown[]) => mockHide(...args),
}));

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
}

describe("useKeyboardNav", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves selection down on ArrowDown", () => {
    const setSelectedIndex = vi.fn();
    const items = [makeEntry(1), makeEntry(2), makeEntry(3)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("ArrowDown");
    // setSelectedIndex is called with an updater function
    expect(setSelectedIndex).toHaveBeenCalled();
    const updater = setSelectedIndex.mock.calls[0][0];
    expect(updater(0)).toBe(1);
    expect(updater(2)).toBe(2); // capped at length - 1
  });

  it("moves selection up on ArrowUp", () => {
    const setSelectedIndex = vi.fn();
    const items = [makeEntry(1), makeEntry(2)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 1,
        setSelectedIndex,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("ArrowUp");
    expect(setSelectedIndex).toHaveBeenCalled();
    const updater = setSelectedIndex.mock.calls[0][0];
    expect(updater(1)).toBe(0);
    expect(updater(0)).toBe(0); // capped at 0
  });

  it("calls onSelect on Enter", () => {
    const onSelect = vi.fn();
    const items = [makeEntry(1), makeEntry(2)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 1,
        setSelectedIndex: vi.fn(),
        onSelect,
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("Enter");
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it("calls onDelete on Alt+Delete", () => {
    const onDelete = vi.fn();
    const items = [makeEntry(42)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect: vi.fn(),
        onDelete,
        onStar: vi.fn(),
      }),
    );

    fireKey("Delete", { altKey: true });
    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it("calls onStar on Alt+S", () => {
    const onStar = vi.fn();
    const items = [makeEntry(7)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar,
      }),
    );

    fireKey("s", { altKey: true, code: "KeyS" });
    expect(onStar).toHaveBeenCalledWith(7, true);
  });

  it("quick-selects with Ctrl+1-9", () => {
    const onSelect = vi.fn();
    const items = [makeEntry(1), makeEntry(2), makeEntry(3)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect,
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("2", { ctrlKey: true });
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it("does not select out-of-bounds Ctrl+number", () => {
    const onSelect = vi.fn();
    const items = [makeEntry(1)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect,
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("5", { ctrlKey: true });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("hides window on Escape", () => {
    mockHide.mockClear();

    renderHook(() =>
      useKeyboardNav({
        items: [makeEntry(1)],
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("Escape");
    // Hide is deferred until keyup to prevent Escape leaking to the app behind
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    expect(mockHide).toHaveBeenCalled();
  });

  it("Escape keyup listener filters non-Escape releases (regression)", () => {
    // Regression: previously used { once: true } which fired on ANY keyup,
    // so a non-Escape release (e.g. user holding Shift) would consume the
    // listener without hiding the window. Listener must filter for Escape
    // and remove itself explicitly.
    mockHide.mockClear();

    renderHook(() =>
      useKeyboardNav({
        items: [makeEntry(1)],
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    // Press Escape — registers the keyup listener
    fireKey("Escape");
    // Reset between the keydown setup and the keyup phase: the keydown
    // handler may already have called hideWindow once during setup.
    mockHide.mockClear();

    // A non-Escape keyup must NOT trigger hide and must NOT consume the listener
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", bubbles: true }));
    expect(mockHide).not.toHaveBeenCalled();

    // The actual Escape keyup must trigger hide exactly once
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    expect(mockHide).toHaveBeenCalledTimes(1);

    // Listener removed itself — second Escape keyup is a no-op
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it("jumps to first item on Home", () => {
    const setSelectedIndex = vi.fn();
    const items = [makeEntry(1), makeEntry(2), makeEntry(3)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 2,
        setSelectedIndex,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("Home");
    expect(setSelectedIndex).toHaveBeenCalledWith(0);
  });

  it("jumps to last item on End", () => {
    const setSelectedIndex = vi.fn();
    const items = [makeEntry(1), makeEntry(2), makeEntry(3)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("End");
    expect(setSelectedIndex).toHaveBeenCalledWith(2);
  });

  it("jumps 10 up on PageUp, clamped to 0", () => {
    const setSelectedIndex = vi.fn();
    const items = Array.from({ length: 20 }, (_, i) => makeEntry(i + 1));

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 5,
        setSelectedIndex,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("PageUp");
    expect(setSelectedIndex).toHaveBeenCalledWith(0); // max(0, 5 - 10) = 0
  });

  it("jumps 10 down on PageDown, clamped to last", () => {
    const setSelectedIndex = vi.fn();
    const items = Array.from({ length: 20 }, (_, i) => makeEntry(i + 1));

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 15,
        setSelectedIndex,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    fireKey("PageDown");
    expect(setSelectedIndex).toHaveBeenCalledWith(19); // min(19, 15 + 10) = 19
  });

  it("calls onPreview on Space key", () => {
    const onPreview = vi.fn();
    const items = [makeEntry(1)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
        onPreview,
      }),
    );

    fireKey(" ");
    expect(onPreview).toHaveBeenCalledWith(items[0]);
  });

  it("calls onTransform on Alt+T", () => {
    const onTransform = vi.fn();
    const items = [makeEntry(1)];

    renderHook(() =>
      useKeyboardNav({
        items,
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
        onTransform,
      }),
    );

    fireKey("t", { altKey: true, code: "KeyT" });
    expect(onTransform).toHaveBeenCalledWith(items[0]);
  });

  it("cleans up event listener on unmount", () => {
    const spy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() =>
      useKeyboardNav({
        items: [],
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onStar: vi.fn(),
      }),
    );

    unmount();
    expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function));
    spy.mockRestore();
  });
});
