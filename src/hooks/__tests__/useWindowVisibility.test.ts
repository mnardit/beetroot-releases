import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWindowVisibility } from "../useWindowVisibility";
import { BLUR_HIDE_DELAY_MS } from "../../lib/constants";

const mockOnFocusChanged = vi.fn().mockResolvedValue(() => {});
const mockListen = vi.fn().mockResolvedValue(() => {});
const mockHide = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    onFocusChanged: mockOnFocusChanged,
    listen: mockListen,
  }),
}));

vi.mock("../../lib/tauri", () => ({
  hideWindow: (...args: unknown[]) => mockHide(...args),
}));

describe("useWindowVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers focus change and listen handlers", () => {
    renderHook(() => useWindowVisibility(vi.fn()));
    expect(mockOnFocusChanged).toHaveBeenCalledTimes(1);
    expect(mockListen).toHaveBeenCalledWith("tauri://focus", expect.any(Function));
  });

  it("calls onShow when tauri://focus fires", async () => {
    const onShow = vi.fn();
    renderHook(() => useWindowVisibility(onShow));

    const focusCallback = mockListen.mock.calls[0][1];
    focusCallback();
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it("hides window after delay when focus is lost", async () => {
    renderHook(() => useWindowVisibility(vi.fn()));

    const focusChangedCallback = mockOnFocusChanged.mock.calls[0][0];
    focusChangedCallback({ payload: false });

    // Should not hide immediately
    expect(mockHide).not.toHaveBeenCalled();

    // Should hide after the delay
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it("does not hide window when focus is gained", async () => {
    renderHook(() => useWindowVisibility(vi.fn()));

    const focusChangedCallback = mockOnFocusChanged.mock.calls[0][0];
    focusChangedCallback({ payload: true });
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).not.toHaveBeenCalled();
  });

  it("cancels pending hide when focus returns (resize scenario)", async () => {
    renderHook(() => useWindowVisibility(vi.fn()));

    const focusChangedCallback = mockOnFocusChanged.mock.calls[0][0];

    // Blur fires (e.g. mouse leaves window during resize drag)
    focusChangedCallback({ payload: false });
    expect(mockHide).not.toHaveBeenCalled();

    // Focus returns before delay expires (resize completes)
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS / 2);
    focusChangedCallback({ payload: true });

    // Let the full delay pass — hide should NOT fire
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).not.toHaveBeenCalled();
  });

  it("does not hide window when suppressHideOnBlur is true", async () => {
    renderHook(() => useWindowVisibility(vi.fn(), { suppressHideOnBlur: true }));

    const focusChangedCallback = mockOnFocusChanged.mock.calls[0][0];
    focusChangedCallback({ payload: false });
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).not.toHaveBeenCalled();
  });

  it("hides window when suppressHideOnBlur is false", async () => {
    renderHook(() => useWindowVisibility(vi.fn(), { suppressHideOnBlur: false }));

    const focusChangedCallback = mockOnFocusChanged.mock.calls[0][0];
    focusChangedCallback({ payload: false });
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it("updates suppress behavior when option changes", async () => {
    let suppress = false;
    const { rerender } = renderHook(() =>
      useWindowVisibility(vi.fn(), { suppressHideOnBlur: suppress }),
    );

    const focusChangedCallback = mockOnFocusChanged.mock.calls[0][0];

    // Initially not suppressed — should hide after delay
    focusChangedCallback({ payload: false });
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).toHaveBeenCalledTimes(1);
    mockHide.mockClear();

    // Now suppress — should not hide
    suppress = true;
    rerender();
    focusChangedCallback({ payload: false });
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).not.toHaveBeenCalled();
  });

  it("cleans up listeners on unmount", async () => {
    vi.useRealTimers();
    const unlistenFocus = vi.fn();
    const unlistenEvent = vi.fn();
    mockOnFocusChanged.mockResolvedValueOnce(unlistenFocus);
    mockListen.mockResolvedValueOnce(unlistenEvent);

    const { unmount } = renderHook(() => useWindowVisibility(vi.fn()));

    await vi.waitFor(() => {
      expect(mockOnFocusChanged).toHaveBeenCalled();
    });

    unmount();

    await new Promise((r) => setTimeout(r, 0));
    expect(unlistenFocus).toHaveBeenCalled();
    expect(unlistenEvent).toHaveBeenCalled();
  });

  it("clears pending timer on unmount", () => {
    const { unmount } = renderHook(() => useWindowVisibility(vi.fn()));

    const focusChangedCallback = mockOnFocusChanged.mock.calls[0][0];
    focusChangedCallback({ payload: false });

    // Unmount before timer fires
    unmount();

    // Advance past delay — hide should NOT fire because cleanup cleared the timer
    vi.advanceTimersByTime(BLUR_HIDE_DELAY_MS);
    expect(mockHide).not.toHaveBeenCalled();
  });
});
