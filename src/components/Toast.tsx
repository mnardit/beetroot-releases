import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { ToastContext, useToastProvider } from "../hooks/useToast";
import { useTranslation } from "../lib/i18n";
import "../styles/Toast.css";

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslation();
  const { toasts, startExit, showError, showInfo } = useToastProvider();

  return (
    <ToastContext.Provider value={{ showError, showInfo }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast--${toast.type}${toast.exiting ? " toast--exiting" : ""}`}
              role={toast.type === "error" ? "alert" : undefined}
              onClick={() => startExit(toast.id)}
            >
              <span>{toast.text}</span>
              {toast.action && (
                <button
                  className="toast__action"
                  onClick={() => {
                    toast.action!.onClick();
                    startExit(toast.id);
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button
                className="toast__close"
                onClick={(e) => {
                  e.stopPropagation();
                  startExit(toast.id);
                }}
                aria-label={t("close")}
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
