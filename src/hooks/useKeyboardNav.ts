import { useCallback, useEffect, useRef } from "react";
import { hideWindow } from "../lib/tauri";
import type { ClipboardEntry } from "../types/clipboard";

interface ParsedShortcut {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  code: string;
}

function parseShortcut(s: string): ParsedShortcut | null {
  if (!s) return null;
  const parts = s.split("+");
  const code = parts[parts.length - 1];
  return {
    ctrl: parts.includes("Ctrl") || parts.includes("AltGr"),
    alt: parts.includes("Alt") || parts.includes("AltGr"),
    shift: parts.includes("Shift"),
    meta: parts.includes("Win") || parts.includes("Super") || parts.includes("Cmd"),
    code,
  };
}

function matchesShortcut(e: KeyboardEvent, parsed: ParsedShortcut): boolean {
  // Strict modifier matching — no AltGr leniency needed here.
  // Global hotkeys handle AltGr via Rust register_with_variants().
  // In-app shortcuts should NOT fire on AltGr (which sends Ctrl+Alt).
  return (
    e.code === parsed.code &&
    e.ctrlKey === parsed.ctrl &&
    e.altKey === parsed.alt &&
    e.shiftKey === parsed.shift &&
    e.metaKey === parsed.meta
  );
}

interface UseKeyboardNavProps {
  items: ClipboardEntry[];
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  onSelect: (item: ClipboardEntry) => void;
  onDelete: (item: ClipboardEntry) => void;
  onStar: (id: number, starred: boolean) => void;
  onPreview?: (item: ClipboardEntry) => void;
  onTransform?: (item: ClipboardEntry) => void;
  onCopy?: (item: ClipboardEntry) => void;
  onItemContextMenu?: (x: number, y: number, item: ClipboardEntry) => void;
  onToggleMultiSelect?: (id: number) => void;
  onTogglePinWindow?: () => void;
  onToggleFollowCursor?: () => void;
  shortcutPinWindow?: string;
  shortcutFollowCursor?: string;
  lastInputRef?: React.MutableRefObject<"keyboard" | "mouse">;
  hasActiveOverlayRef?: React.MutableRefObject<boolean>;
  isPreviewOpenRef?: React.MutableRefObject<boolean>;
  onPreviewNavigate?: (item: ClipboardEntry) => void;
  isNoFocusRef?: React.MutableRefObject<boolean>;
}

/** Registers global keyboard shortcuts for list navigation, quick-select, pin, and delete. */
export function useKeyboardNav({
  items,
  selectedIndex,
  setSelectedIndex,
  onSelect,
  onDelete,
  onStar,
  onPreview,
  onTransform,
  onCopy,
  onItemContextMenu,
  onToggleMultiSelect,
  onTogglePinWindow,
  onToggleFollowCursor,
  shortcutPinWindow,
  shortcutFollowCursor,
  lastInputRef,
  hasActiveOverlayRef,
  isPreviewOpenRef,
  onPreviewNavigate,
  isNoFocusRef,
}: UseKeyboardNavProps) {
  const itemsRef = useRef(items);
  const selectedIndexRef = useRef(selectedIndex);
  const onSelectRef = useRef(onSelect);
  const onDeleteRef = useRef(onDelete);
  const onStarRef = useRef(onStar);
  const onPreviewRef = useRef(onPreview);
  const onTransformRef = useRef(onTransform);
  const onCopyRef = useRef(onCopy);
  const onItemContextMenuRef = useRef(onItemContextMenu);
  const onToggleMultiSelectRef = useRef(onToggleMultiSelect);
  const onTogglePinWindowRef = useRef(onTogglePinWindow);
  const onToggleFollowCursorRef = useRef(onToggleFollowCursor);
  const onPreviewNavigateRef = useRef(onPreviewNavigate);
  const parsedPinWindowRef = useRef(parseShortcut(shortcutPinWindow ?? ""));
  const parsedFollowCursorRef = useRef(parseShortcut(shortcutFollowCursor ?? ""));

  // Keep refs in sync with latest props
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);
  useEffect(() => {
    onStarRef.current = onStar;
  }, [onStar]);
  useEffect(() => {
    onPreviewRef.current = onPreview;
  }, [onPreview]);
  useEffect(() => {
    onTransformRef.current = onTransform;
  }, [onTransform]);
  useEffect(() => {
    onCopyRef.current = onCopy;
  }, [onCopy]);
  useEffect(() => {
    onItemContextMenuRef.current = onItemContextMenu;
  }, [onItemContextMenu]);
  useEffect(() => {
    onToggleMultiSelectRef.current = onToggleMultiSelect;
  }, [onToggleMultiSelect]);
  useEffect(() => {
    onTogglePinWindowRef.current = onTogglePinWindow;
  }, [onTogglePinWindow]);
  useEffect(() => {
    onToggleFollowCursorRef.current = onToggleFollowCursor;
  }, [onToggleFollowCursor]);
  useEffect(() => {
    onPreviewNavigateRef.current = onPreviewNavigate;
  }, [onPreviewNavigate]);
  useEffect(() => {
    parsedPinWindowRef.current = parseShortcut(shortcutPinWindow ?? "");
  }, [shortcutPinWindow]);
  useEffect(() => {
    parsedFollowCursorRef.current = parseShortcut(shortcutFollowCursor ?? "");
  }, [shortcutFollowCursor]);

  // Helper: arrow navigation while preview is open (shared by focused + no-focus modes)
  const handlePreviewArrow = useCallback(
    (direction: "up" | "down") => {
      const currentItems = itemsRef.current;
      if (lastInputRef) lastInputRef.current = "keyboard";
      const idx = selectedIndexRef.current;
      const newIdx =
        direction === "down" ? Math.min(idx + 1, currentItems.length - 1) : Math.max(idx - 1, 0);
      if (newIdx !== idx) {
        setSelectedIndex(newIdx);
        if (onPreviewNavigateRef.current && currentItems[newIdx]) {
          onPreviewNavigateRef.current(currentItems[newIdx]);
        }
      }
    },
    [setSelectedIndex, lastInputRef],
  );

  // Mirror handlePreviewArrow into a ref so the keydown listeners below can
  // call the latest version without re-registering on every render. Per the
  // file's "register handler once via refs" pattern.
  const handlePreviewArrowRef = useRef(handlePreviewArrow);
  useEffect(() => {
    handlePreviewArrowRef.current = handlePreviewArrow;
  }, [handlePreviewArrow]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // In no-focus mode, all keyboard input is handled via Rust nf-* events.
      // Skip the WebView keydown handler to prevent duplicate actions.
      if (isNoFocusRef?.current) {
        return;
      }
      // Allow arrow navigation when preview is open
      if (hasActiveOverlayRef?.current && isPreviewOpenRef?.current) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          handlePreviewArrowRef.current(e.key === "ArrowDown" ? "down" : "up");
          return;
        }
        return; // Block all other keys when overlay is active
      }
      // Alt+T toggle: allow closing transform menu even when overlay is active
      if (hasActiveOverlayRef?.current && e.altKey && e.code === "KeyT") {
        const currentItems = itemsRef.current;
        const idx = selectedIndexRef.current;
        if (currentItems[idx] && onTransformRef.current) {
          e.preventDefault();
          onTransformRef.current(currentItems[idx]);
        }
        return;
      }
      if (hasActiveOverlayRef?.current) return;

      const currentItems = itemsRef.current;
      const idx = selectedIndexRef.current;

      // Don't handle if typing in search (except navigation keys)
      const isSearch = e.target instanceof HTMLInputElement && e.target.type === "text";
      // Non-search inputs (settings) — don't intercept Space/Escape
      const isFormInput =
        (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLInputElement && e.target.classList.contains("search-input"));

      // Dynamic shortcuts checked first (before switch) so they work with any key including Space.
      // Skip in form inputs (Settings fields) — only active in main view + search.
      if (
        !isFormInput &&
        parsedPinWindowRef.current &&
        matchesShortcut(e, parsedPinWindowRef.current) &&
        onTogglePinWindowRef.current
      ) {
        e.preventDefault();
        onTogglePinWindowRef.current();
        return;
      }
      if (
        !isFormInput &&
        parsedFollowCursorRef.current &&
        matchesShortcut(e, parsedFollowCursorRef.current) &&
        onToggleFollowCursorRef.current
      ) {
        e.preventDefault();
        onToggleFollowCursorRef.current();
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (lastInputRef) lastInputRef.current = "keyboard";
          setSelectedIndex((i) => Math.min(i + 1, currentItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          if (lastInputRef) lastInputRef.current = "keyboard";
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          if (lastInputRef) lastInputRef.current = "keyboard";
          setSelectedIndex(0);
          break;
        case "End":
          e.preventDefault();
          if (lastInputRef) lastInputRef.current = "keyboard";
          setSelectedIndex(currentItems.length - 1);
          break;
        case "PageUp":
          e.preventDefault();
          if (lastInputRef) lastInputRef.current = "keyboard";
          setSelectedIndex(Math.max(0, idx - 10));
          break;
        case "PageDown":
          e.preventDefault();
          if (lastInputRef) lastInputRef.current = "keyboard";
          setSelectedIndex(Math.min(currentItems.length - 1, idx + 10));
          break;
        case "Enter":
          e.preventDefault();
          if (currentItems[idx]) {
            onSelectRef.current(currentItems[idx]);
          }
          break;
        case "ContextMenu":
          if (currentItems[idx] && onItemContextMenuRef.current) {
            e.preventDefault();
            const el = document.getElementById(`clip-item-${currentItems[idx].id}`);
            if (el) {
              const rect = el.getBoundingClientRect();
              onItemContextMenuRef.current(rect.left + 8, rect.bottom - 4, currentItems[idx]);
            }
          }
          break;
        case "F10":
          if (e.shiftKey && currentItems[idx] && onItemContextMenuRef.current) {
            e.preventDefault();
            const el = document.getElementById(`clip-item-${currentItems[idx].id}`);
            if (el) {
              const rect = el.getBoundingClientRect();
              onItemContextMenuRef.current(rect.left + 8, rect.bottom - 4, currentItems[idx]);
            }
          }
          break;
        case "Delete":
          if (e.altKey && currentItems[idx]) {
            e.preventDefault();
            onDeleteRef.current(currentItems[idx]);
          }
          break;
        default:
          // Alt+S = star/unstar (e.code for layout-independence)
          if (e.altKey && e.code === "KeyS" && currentItems[idx]) {
            e.preventDefault();
            onStarRef.current(currentItems[idx].id, !currentItems[idx].starred);
          }
          // Alt+T = transform (e.code for layout-independence)
          else if (e.altKey && e.code === "KeyT" && currentItems[idx] && onTransformRef.current) {
            e.preventDefault();
            onTransformRef.current(currentItems[idx]);
          }
          // Ctrl+C = copy to clipboard without paste
          else if (
            e.ctrlKey &&
            e.code === "KeyC" &&
            !isSearch &&
            currentItems[idx] &&
            onCopyRef.current
          ) {
            e.preventDefault();
            onCopyRef.current(currentItems[idx]);
          }
          // Ctrl+1..9 quick select
          else if (e.ctrlKey && !isSearch && /^[1-9]$/.test(e.key)) {
            const quickIdx = parseInt(e.key) - 1;
            if (currentItems[quickIdx]) {
              e.preventDefault();
              onSelectRef.current(currentItems[quickIdx]);
            }
          }
          break;
        case " ":
          // Ctrl+Space = toggle multi-select
          if (e.ctrlKey && currentItems[idx] && onToggleMultiSelectRef.current) {
            e.preventDefault();
            onToggleMultiSelectRef.current(currentItems[idx].id);
          } else if (!isFormInput && currentItems[idx] && onPreviewRef.current) {
            // Plain Space = preview. In search: only when query is empty (so users can type spaces in queries)
            const searchEmpty =
              isSearch && e.target instanceof HTMLInputElement && e.target.value === "";
            if (!isSearch || searchEmpty) {
              e.preventDefault();
              onPreviewRef.current(currentItems[idx]);
            }
          }
          break;
        case "Escape":
          if (!isFormInput) {
            e.preventDefault();
            // Wait for keyup before hiding so the Escape release event
            // is consumed by our window, not forwarded to the app behind.
            // Don't use { once: true } — it fires on ANY key release, so a
            // non-Escape keyup (e.g. user holds Arrow while pressing Esc)
            // would consume the listener without hiding the window.
            const escapeHandler = (ev: KeyboardEvent) => {
              if (ev.key !== "Escape") return;
              window.removeEventListener("keyup", escapeHandler);
              hideWindow().catch(() => {});
            };
            window.addEventListener("keyup", escapeHandler);
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedIndex, lastInputRef, hasActiveOverlayRef, isPreviewOpenRef, isNoFocusRef]);

  // --- No-focus mode: navigation via window.__beetrootNav / __beetrootAction ---
  // Uses eval() from Rust instead of Tauri event system (which doesn't deliver
  // events to the WebView when the window has no focus).
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Global functions called directly from Rust via win.eval()
    window.__beetrootNav = (direction: string) => {
      // Allow arrow navigation when preview is open
      if (hasActiveOverlayRef?.current && isPreviewOpenRef?.current) {
        if (direction === "down" || direction === "up") {
          handlePreviewArrowRef.current(direction);
        }
        return;
      }
      if (hasActiveOverlayRef?.current) return;
      const currentItems = itemsRef.current;
      if (lastInputRef) lastInputRef.current = "keyboard";

      switch (direction) {
        case "down":
          setSelectedIndex((i) => Math.min(i + 1, currentItems.length - 1));
          break;
        case "up":
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "home":
          setSelectedIndex(0);
          break;
        case "end":
          setSelectedIndex(currentItems.length - 1);
          break;
        case "pageup":
          setSelectedIndex((i) => Math.max(0, i - 10));
          break;
        case "pagedown":
          setSelectedIndex((i) => Math.min(currentItems.length - 1, i + 10));
          break;
      }
    };

    window.__beetrootAction = (action: string) => {
      if (
        hasActiveOverlayRef?.current &&
        action !== "space" &&
        action !== "transform" &&
        !(isPreviewOpenRef?.current && (action === "enter" || action === "copy"))
      )
        return;
      const currentItems = itemsRef.current;
      const idx = selectedIndexRef.current;
      if (!currentItems[idx]) return;

      switch (action) {
        case "space":
          if (onPreviewRef.current) onPreviewRef.current(currentItems[idx]);
          break;
        case "enter":
          onSelectRef.current(currentItems[idx]);
          break;
        case "delete":
          onDeleteRef.current(currentItems[idx]);
          break;
        case "star":
          onStarRef.current(currentItems[idx].id, !currentItems[idx].starred);
          break;
        case "pin":
          if (onTogglePinWindowRef.current) onTogglePinWindowRef.current();
          break;
        case "follow":
          if (onToggleFollowCursorRef.current) onToggleFollowCursorRef.current();
          break;
        case "transform":
          if (onTransformRef.current) onTransformRef.current(currentItems[idx]);
          break;
        case "copy":
          if (onCopyRef.current) onCopyRef.current(currentItems[idx]);
          break;
        default:
          // quick-select-N
          if (action.startsWith("quick-select-")) {
            const qIdx = parseInt(action.replace("quick-select-", ""), 10);
            if (currentItems[qIdx]) onSelectRef.current(currentItems[qIdx]);
          }
          break;
      }
    };

    cleanups.push(() => {
      delete window.__beetrootNav;
      delete window.__beetrootAction;
    });

    return () => cleanups.forEach((fn) => fn());
  }, [setSelectedIndex, lastInputRef, hasActiveOverlayRef, isPreviewOpenRef]);
}
