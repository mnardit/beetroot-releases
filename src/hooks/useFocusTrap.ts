import { useCallback, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Returns a keydown handler that traps Tab/Shift+Tab focus within a container ref.
 * Cycles from the last focusable element back to the first (and vice versa).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
): (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => void {
  return useCallback(
    (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [containerRef],
  );
}
