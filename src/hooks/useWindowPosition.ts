import { useEffect, useRef } from "react";
import {
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
  availableMonitors,
} from "@tauri-apps/api/window";
import { createLogger } from "../lib/log";

const log = createLogger("window-pos");

const STORAGE_KEY = "beetroot_window_pos";
const SAVE_DEBOUNCE_MS = 500;

interface SavedWindowPos {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadSavedPosition(): SavedWindowPos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number" &&
      parsed.width > 0 &&
      parsed.height > 0
    ) {
      return parsed as SavedWindowPos;
    }
  } catch {
    // ignore corrupted data
  }
  return null;
}

function savePosition(pos: SavedWindowPos): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

/** Check if saved position has at least 50px visible on any monitor */
async function isSavedPositionOnScreen(saved: SavedWindowPos): Promise<boolean> {
  const monitors = await availableMonitors();
  return monitors.some((m) => {
    const mPos = m.position;
    const mSize = m.size;
    const factor = m.scaleFactor;
    const mx = mPos.x / factor;
    const my = mPos.y / factor;
    const mw = mSize.width / factor;
    const mh = mSize.height / factor;
    const overlapX = Math.max(0, Math.min(saved.x + saved.width, mx + mw) - Math.max(saved.x, mx));
    const overlapY = Math.max(0, Math.min(saved.y + saved.height, my + mh) - Math.max(saved.y, my));
    return overlapX >= 50 && overlapY >= 50;
  });
}

/** Restore saved position and size on the given window */
async function restorePositionAndSize(saved: SavedWindowPos): Promise<void> {
  const appWindow = getCurrentWindow();
  await appWindow.setPosition(new LogicalPosition(saved.x, saved.y));
  await appWindow.setSize(new LogicalSize(saved.width, saved.height));
}

/** Restore only position (not size) — avoids visual resize jump on focus */
async function restorePositionOnly(saved: SavedWindowPos): Promise<void> {
  const appWindow = getCurrentWindow();
  await appWindow.setPosition(new LogicalPosition(saved.x, saved.y));
}

/**
 * Persists window position/size to localStorage.
 * Restores position+size on window focus (after Rust show_on_active_monitor centers it).
 * When pinned (alwaysOnTop), restores immediately on mount before first show.
 */
/** How long after a move/resize event to suppress position restore (ms) */
const RECENTLY_MOVED_MS = 1000;

export function useWindowPosition(
  windowMode: "normal" | "pinned" | "follow-cursor",
  windowPosition?: string,
): void {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentlyMoved = useRef(false);
  const recentlyMovedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount-time restore for pinned mode — apply saved position+size before first show
  useEffect(() => {
    if (windowMode !== "pinned") return;
    const saved = loadSavedPosition();
    if (!saved) return;
    (async () => {
      try {
        if (await isSavedPositionOnScreen(saved)) {
          await restorePositionAndSize(saved);
        }
      } catch (e) {
        log.warn("failed to restore pinned position on mount", e);
      }
    })();
    // Intentionally run once on mount — alwaysOnTop is read from initial settings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const cleanups: (() => void)[] = [];

    function markRecentlyMoved() {
      recentlyMoved.current = true;
      if (recentlyMovedTimer.current) clearTimeout(recentlyMovedTimer.current);
      recentlyMovedTimer.current = setTimeout(() => {
        recentlyMoved.current = false;
        recentlyMovedTimer.current = null;
      }, RECENTLY_MOVED_MS);
    }

    // Save position on move (debounced)
    appWindow
      .onMoved(() => {
        markRecentlyMoved();
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
          try {
            const pos = await appWindow.outerPosition();
            const size = await appWindow.outerSize();
            const factor = await appWindow.scaleFactor();
            savePosition({
              x: pos.x / factor,
              y: pos.y / factor,
              width: size.width / factor,
              height: size.height / factor,
            });
          } catch (e) {
            log.warn("failed to save position on move", e);
          }
        }, SAVE_DEBOUNCE_MS);
      })
      .then((fn) => cleanups.push(fn))
      .catch((e) => log.warn("move listener setup failed", e));

    // Save position on resize (debounced)
    appWindow
      .onResized(() => {
        markRecentlyMoved();
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
          try {
            const pos = await appWindow.outerPosition();
            const size = await appWindow.outerSize();
            const factor = await appWindow.scaleFactor();
            savePosition({
              x: pos.x / factor,
              y: pos.y / factor,
              width: size.width / factor,
              height: size.height / factor,
            });
          } catch (e) {
            log.warn("failed to save position on resize", e);
          }
        }, SAVE_DEBOUNCE_MS);
      })
      .then((fn) => cleanups.push(fn))
      .catch((e) => log.warn("resize listener setup failed", e));

    // Restore position+size on focus (debounced 300ms to avoid conflict with show_on_active_monitor)
    appWindow
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return;
        if (focusDebounceTimer.current) clearTimeout(focusDebounceTimer.current);
        focusDebounceTimer.current = setTimeout(async () => {
          if (recentlyMoved.current) return;
          // In pinned/follow-cursor mode, window is already in place — don't override
          if (windowMode === "pinned" || windowMode === "follow-cursor") return;
          // When using a non-center position, Rust handles placement — don't override
          if (windowPosition && windowPosition !== "center") return;
          const saved = loadSavedPosition();
          if (!saved) return;

          try {
            if (await isSavedPositionOnScreen(saved)) {
              await restorePositionOnly(saved);
            }
          } catch (e) {
            log.warn("failed to restore window position", e);
          }
        }, 300);
      })
      .then((fn) => cleanups.push(fn))
      .catch((e) => log.warn("focus listener for position restore failed", e));

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (recentlyMovedTimer.current) clearTimeout(recentlyMovedTimer.current);
      if (focusDebounceTimer.current) clearTimeout(focusDebounceTimer.current);
      cleanups.forEach((fn) => fn());
    };
  }, [windowMode, windowPosition]);
}
