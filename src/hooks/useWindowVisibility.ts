import { useEffect, useRef } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { hideWindow } from "../lib/tauri";
import { createLogger } from "../lib/log";
import { BLUR_HIDE_DELAY_MS } from "../lib/constants";

const log = createLogger("window");

interface WindowVisibilityOptions {
  /** When true, window will not hide on blur (e.g. Settings open). */
  suppressHideOnBlur?: boolean;
}

/** Resets UI state when window becomes visible and hides on blur. */
export function useWindowVisibility(onShow: () => void, options?: WindowVisibilityOptions): void {
  const onShowRef = useRef(onShow);
  const suppressRef = useRef(options?.suppressHideOnBlur ?? false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onShowRef.current = onShow;
  });

  useEffect(() => {
    suppressRef.current = options?.suppressHideOnBlur ?? false;
  }, [options?.suppressHideOnBlur]);

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    const cleanups: (() => void)[] = [];

    appWindow
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          // Focus returned — cancel any pending hide (e.g. during window resize drag)
          if (hideTimerRef.current !== null) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
        } else if (!suppressRef.current) {
          // Delay hide so transient blur during resize doesn't close the window
          hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            hideWindow().catch((e) => log.warn("hide failed", e));
          }, BLUR_HIDE_DELAY_MS);
        }
      })
      .then((fn) => cleanups.push(fn))
      .catch((e) => log.warn("focus listener setup failed", e));

    appWindow
      .listen("tauri://focus", () => {
        onShowRef.current();
      })
      .then((fn) => cleanups.push(fn))
      .catch((e) => log.warn("focus event listener setup failed", e));

    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      cleanups.forEach((fn) => fn());
    };
  }, []);
}
