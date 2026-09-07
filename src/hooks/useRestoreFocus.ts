import { useEffect, useRef } from "react";

/**
 * Saves the currently focused element on mount and restores focus on unmount.
 * Useful for dialogs/menus that should return focus to their trigger element.
 */
export function useRestoreFocus(): void {
  const previousFocusRef = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    const prev = previousFocusRef.current;
    return () => {
      if (prev instanceof HTMLElement) {
        prev.focus();
      }
    };
  }, []);
}
