import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { TOAST_DISMISS_MS } from "../lib/constants";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastMessage {
  id: number;
  text: string;
  type: "error" | "info";
  action?: ToastAction;
  exiting?: boolean;
}

interface ToastContextValue {
  showError: (text: string) => void;
  showInfo: (text: string, action?: ToastAction) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  showError: () => {},
  showInfo: () => {},
});

export type { ToastAction, ToastMessage };

export function useToast() {
  return useContext(ToastContext);
}

const MAX_TOASTS = 3;
let nextId = 0;

export function useToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(`${id}`);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(`${id}`);
    }
  }, []);

  const startExit = useCallback(
    (id: number) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      const removeTimer = setTimeout(() => {
        dismissToast(id);
      }, 200);
      timersRef.current.set(`${id}-exit`, removeTimer);
    },
    [dismissToast],
  );

  const addToast = useCallback(
    (text: string, type: "error" | "info", action?: ToastAction) => {
      const id = nextId++;
      setToasts((prev) => {
        const next = [...prev, { id, text, type, action }];
        // Remove oldest toasts beyond the limit
        while (next.length > MAX_TOASTS) {
          const removed = next.shift()!;
          const oldTimer = timersRef.current.get(`${removed.id}`);
          if (oldTimer) {
            clearTimeout(oldTimer);
            timersRef.current.delete(`${removed.id}`);
          }
        }
        return next;
      });
      const dismissMs = action ? 5000 : TOAST_DISMISS_MS;
      const timer = setTimeout(() => {
        startExit(id);
      }, dismissMs);
      timersRef.current.set(`${id}`, timer);
    },
    [startExit],
  );

  const showError = useCallback((text: string) => addToast(text, "error"), [addToast]);
  const showInfo = useCallback(
    (text: string, action?: ToastAction) => addToast(text, "info", action),
    [addToast],
  );

  return { toasts, dismissToast, startExit, showError, showInfo };
}
