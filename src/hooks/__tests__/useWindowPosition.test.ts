import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWindowPosition } from "../useWindowPosition";

const mockSetPosition = vi.fn().mockResolvedValue(undefined);
const mockSetSize = vi.fn().mockResolvedValue(undefined);
const mockOuterPosition = vi.fn().mockResolvedValue({ x: 200, y: 150 });
const mockOuterSize = vi.fn().mockResolvedValue({ width: 680, height: 480 });
const mockScaleFactor = vi.fn().mockResolvedValue(1);
const mockAvailableMonitors = vi.fn().mockResolvedValue([
  {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  },
]);

let onMovedCallback: (() => void) | null = null;
let onResizedCallback: (() => void) | null = null;
let onFocusChangedCallback: ((event: { payload: boolean }) => void) | null = null;

const mockOnMoved = vi.fn().mockImplementation((cb) => {
  onMovedCallback = cb;
  return Promise.resolve(() => {});
});
const mockOnResized = vi.fn().mockImplementation((cb) => {
  onResizedCallback = cb;
  return Promise.resolve(() => {});
});
const mockOnFocusChanged = vi.fn().mockImplementation((cb) => {
  onFocusChangedCallback = cb;
  return Promise.resolve(() => {});
});

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setPosition: mockSetPosition,
    setSize: mockSetSize,
    outerPosition: mockOuterPosition,
    outerSize: mockOuterSize,
    scaleFactor: mockScaleFactor,
    onMoved: mockOnMoved,
    onResized: mockOnResized,
    onFocusChanged: mockOnFocusChanged,
  }),
  availableMonitors: (...args: unknown[]) => mockAvailableMonitors(...args),
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
  LogicalSize: class LogicalSize {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  },
}));

describe("useWindowPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    onMovedCallback = null;
    onResizedCallback = null;
    onFocusChangedCallback = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers move, resize, and focus listeners", () => {
    renderHook(() => useWindowPosition("normal"));
    expect(mockOnMoved).toHaveBeenCalledTimes(1);
    expect(mockOnResized).toHaveBeenCalledTimes(1);
    expect(mockOnFocusChanged).toHaveBeenCalledTimes(1);
  });

  it("saves position to localStorage on window move (debounced)", async () => {
    renderHook(() => useWindowPosition("normal"));

    // Simulate move
    onMovedCallback!();

    // Not saved yet (debounced)
    expect(localStorage.getItem("beetroot_window_pos")).toBeNull();

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(500);

    const saved = JSON.parse(localStorage.getItem("beetroot_window_pos")!);
    expect(saved).toEqual({ x: 200, y: 150, width: 680, height: 480 });
  });

  it("saves position to localStorage on window resize (debounced)", async () => {
    renderHook(() => useWindowPosition("normal"));

    onResizedCallback!();
    await vi.advanceTimersByTimeAsync(500);

    const saved = JSON.parse(localStorage.getItem("beetroot_window_pos")!);
    expect(saved).toEqual({ x: 200, y: 150, width: 680, height: 480 });
  });

  it("restores saved position on focus if on-screen", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 300, y: 200, width: 680, height: 480 }),
    );

    renderHook(() => useWindowPosition("normal"));

    // Simulate focus
    onFocusChangedCallback!({ payload: true });
    // Advance past focus debounce (300ms)
    await vi.advanceTimersByTimeAsync(300);

    expect(mockSetPosition).toHaveBeenCalledTimes(1);
    const pos = mockSetPosition.mock.calls[0][0];
    expect(pos.x).toBe(300);
    expect(pos.y).toBe(200);
  });

  it("does not restore position on blur", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 300, y: 200, width: 680, height: 480 }),
    );

    renderHook(() => useWindowPosition("normal"));

    onFocusChangedCallback!({ payload: false });
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("does not restore position if off-screen", async () => {
    // Position is way off-screen
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 5000, y: 5000, width: 680, height: 480 }),
    );

    renderHook(() => useWindowPosition("normal"));

    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("does not restore if no saved position", async () => {
    renderHook(() => useWindowPosition("normal"));

    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("ignores corrupted localStorage data", async () => {
    localStorage.setItem("beetroot_window_pos", "not json");

    renderHook(() => useWindowPosition("normal"));

    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("ignores invalid saved data (missing fields)", async () => {
    localStorage.setItem("beetroot_window_pos", JSON.stringify({ x: 100 }));

    renderHook(() => useWindowPosition("normal"));

    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("accounts for scale factor when saving", async () => {
    mockScaleFactor.mockResolvedValueOnce(2);
    mockOuterPosition.mockResolvedValueOnce({ x: 400, y: 300 });
    mockOuterSize.mockResolvedValueOnce({ width: 1360, height: 960 });

    renderHook(() => useWindowPosition("normal"));

    onMovedCallback!();
    await vi.advanceTimersByTimeAsync(500);

    const saved = JSON.parse(localStorage.getItem("beetroot_window_pos")!);
    expect(saved).toEqual({ x: 200, y: 150, width: 680, height: 480 });
  });

  it("debounces rapid move events", async () => {
    renderHook(() => useWindowPosition("normal"));

    // Fire multiple move events rapidly
    onMovedCallback!();
    onMovedCallback!();
    onMovedCallback!();

    await vi.advanceTimersByTimeAsync(500);

    // outerPosition should only be called once (last debounced call)
    expect(mockOuterPosition).toHaveBeenCalledTimes(1);
  });

  it("does not restore position if window was recently moved (race condition guard)", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 300, y: 200, width: 680, height: 480 }),
    );

    renderHook(() => useWindowPosition("normal"));

    // User drags the window (move event fires)
    onMovedCallback!();

    // Focus event fires shortly after (e.g. from the move itself)
    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(300);

    // Position should NOT be restored because window was recently moved
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("restores position after recentlyMoved cooldown expires", async () => {
    renderHook(() => useWindowPosition("normal"));

    // User drags the window
    onMovedCallback!();

    // Wait for the recentlyMoved cooldown to expire (1000ms)
    // This also fires the debounce save, so we re-set the desired position after
    await vi.advanceTimersByTimeAsync(1000);

    // Set the saved position to the value we want to restore
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 300, y: 200, width: 680, height: 480 }),
    );

    // Now focus fires — should restore since cooldown has expired
    onFocusChangedCallback!({ payload: true });
    // Advance past focus debounce (300ms)
    await vi.advanceTimersByTimeAsync(300);

    expect(mockSetPosition).toHaveBeenCalledTimes(1);
    const pos = mockSetPosition.mock.calls[0][0];
    expect(pos.x).toBe(300);
    expect(pos.y).toBe(200);
  });

  it("does not restore position if window was recently resized", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 300, y: 200, width: 680, height: 480 }),
    );

    renderHook(() => useWindowPosition("normal"));

    // User resizes the window
    onResizedCallback!();

    // Focus event fires shortly after
    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(300);

    // Position should NOT be restored because window was recently resized
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("restores only position (not size) on focus to avoid resize jump", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 300, y: 200, width: 700, height: 500 }),
    );

    renderHook(() => useWindowPosition("normal"));

    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(300);

    expect(mockSetPosition).toHaveBeenCalledTimes(1);
    expect(mockSetSize).not.toHaveBeenCalled();
  });

  it("restores position+size on mount when alwaysOnTop is true", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 100, y: 50, width: 600, height: 400 }),
    );

    renderHook(() => useWindowPosition("pinned"));

    // Mount effect runs async — flush microtasks
    await vi.advanceTimersByTimeAsync(0);

    expect(mockSetPosition).toHaveBeenCalledTimes(1);
    const pos = mockSetPosition.mock.calls[0][0];
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(50);
    expect(mockSetSize).toHaveBeenCalledTimes(1);
    const size = mockSetSize.mock.calls[0][0];
    expect(size.width).toBe(600);
    expect(size.height).toBe(400);
  });

  it("does not restore on mount when alwaysOnTop is false", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 100, y: 50, width: 600, height: 400 }),
    );

    renderHook(() => useWindowPosition("normal"));

    await vi.advanceTimersByTimeAsync(0);

    // No mount restore — only focus restore triggers it
    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it("does not restore on mount if saved position is off-screen", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 5000, y: 5000, width: 600, height: 400 }),
    );

    renderHook(() => useWindowPosition("pinned"));

    await vi.advanceTimersByTimeAsync(0);

    expect(mockSetPosition).not.toHaveBeenCalled();
  });

  it.each(["pinned", "follow-cursor"] as const)(
    "%s never restores a saved position on focus",
    async (mode) => {
      localStorage.setItem(
        "beetroot_window_pos",
        JSON.stringify({ x: 100, y: 50, width: 600, height: 400 }),
      );
      renderHook(() => useWindowPosition(mode));
      await vi.advanceTimersByTimeAsync(0);
      mockSetPosition.mockClear();
      mockSetSize.mockClear();

      onFocusChangedCallback!({ payload: true });
      await vi.advanceTimersByTimeAsync(1500);

      expect(mockSetPosition).not.toHaveBeenCalled();
      expect(mockSetSize).not.toHaveBeenCalled();
    },
  );

  it("follow-cursor does not apply the saved pinned position on mount", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 100, y: 50, width: 600, height: 400 }),
    );
    renderHook(() => useWindowPosition("follow-cursor"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(mockSetPosition).not.toHaveBeenCalled();
    expect(mockSetSize).not.toHaveBeenCalled();
  });

  it("switching from normal to follow-cursor cancels a pending position restore", async () => {
    localStorage.setItem(
      "beetroot_window_pos",
      JSON.stringify({ x: 100, y: 50, width: 600, height: 400 }),
    );
    const { rerender } = renderHook(({ mode }) => useWindowPosition(mode), {
      initialProps: { mode: "normal" as "normal" | "follow-cursor" },
    });
    onFocusChangedCallback!({ payload: true });
    await vi.advanceTimersByTimeAsync(100);
    rerender({ mode: "follow-cursor" });
    await vi.advanceTimersByTimeAsync(1500);
    expect(mockSetPosition).not.toHaveBeenCalled();
  });
});
