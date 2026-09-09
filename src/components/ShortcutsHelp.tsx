import { useEffect, useRef, useMemo } from "react";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "../lib/i18n";
import { displayHotkey } from "../lib/hotkey-utils";
import { useFocusTrap } from "../hooks/useFocusTrap";
import "../styles/ShortcutsHelp.css";

interface ShortcutsHelpProps {
  onClose: () => void;
  shortcutPinWindow?: string;
  shortcutFollowCursor?: string;
  windowMode?: string;
  pasteMode?: string;
}

export function ShortcutsHelp({
  onClose,
  shortcutPinWindow,
  shortcutFollowCursor,
  windowMode,
  pasteMode,
}: ShortcutsHelpProps) {
  const pinDisplay = useMemo(
    () => (shortcutPinWindow ? displayHotkey(shortcutPinWindow) : ""),
    [shortcutPinWindow],
  );
  const followDisplay = useMemo(
    () => (shortcutFollowCursor ? displayHotkey(shortcutFollowCursor) : ""),
    [shortcutFollowCursor],
  );

  const shortcuts = useMemo(
    () => [
      {
        keys: "Enter",
        actionKey:
          windowMode === "pinned" || pasteMode === "copy"
            ? ("shortcuts.copy" as const)
            : ("shortcuts.paste" as const),
      },
      { keys: "Space", actionKey: "shortcuts.preview" as const },
      { keys: "Alt+T", actionKey: "shortcuts.transform" as const },
      { keys: "Alt+S", actionKey: "shortcuts.pin" as const },
      { keys: "Alt+Del", actionKey: "shortcuts.deleteItem" as const },
      { keys: "Ctrl+1\u20139", actionKey: "shortcuts.quickPaste" as const },
      { keys: "Ctrl+Click", actionKey: "shortcuts.multiSelect" as const },
      { keys: "Ctrl+Space", actionKey: "shortcuts.multiSelect" as const },
      { keys: "Right-click", actionKey: "shortcuts.contextMenu" as const },
      ...(pinDisplay ? [{ keys: pinDisplay, actionKey: "shortcuts.pinWindow" as const }] : []),
      ...(followDisplay
        ? [{ keys: followDisplay, actionKey: "shortcuts.followCursor" as const }]
        : []),
      { keys: "\u2191 \u2193", actionKey: "shortcuts.navigate" as const },
      { keys: "Esc", actionKey: "shortcuts.closeWindow" as const },
    ],
    [pinDisplay, followDisplay, windowMode, pasteMode],
  );
  const t = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const trapFocus = useFocusTrap(panelRef);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
        return;
      }
      trapFocus(e);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, trapFocus]);

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div
        className="shortcuts"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("shortcuts.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts__header">
          <span className="shortcuts__title">{t("shortcuts.title")}</span>
          <button className="shortcuts__close" onClick={onClose} aria-label={t("close")}>
            <IconX size={16} />
          </button>
        </div>
        <div className="shortcuts__list">
          {shortcuts.map((s, i) => (
            <div key={`${i}-${s.keys}`} className="shortcuts__row">
              <kbd className="shortcuts__key">{s.keys}</kbd>
              <span className="shortcuts__action">{t(s.actionKey)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
