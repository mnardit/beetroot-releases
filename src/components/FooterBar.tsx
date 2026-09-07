import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  IconHelpCircle,
  IconPlayerPause,
  IconPin,
  IconPinnedOff,
  IconPlayerPlay,
  IconSettings,
  IconCrosshair,
} from "@tabler/icons-react";
import { useTranslation } from "../lib/i18n";
import "../styles/Footer.css";

interface FooterBarProps {
  multiSelectedCount: number;
  onBatchCopy: (separator: string) => void;
  onBatchDelete: () => void;
  onCancelSelection: () => void;
  onShowShortcuts: () => void;
  monitorPaused: boolean;
  onTogglePause: () => void;
  onTogglePin: () => void;
  windowMode: "normal" | "pinned" | "follow-cursor";
  pasteMode: "auto" | "copy";
  onToggleFollowCursor: () => void;
  onShowSettings: () => void;
  hasSearchQuery?: boolean;
  isPreviewOpen?: boolean;
}

const SEP_OPTIONS = [
  { key: "sep.newline", value: "\n" },
  { key: "sep.comma", value: ", " },
  { key: "sep.space", value: " " },
  { key: "sep.tab", value: "\t" },
  { key: "sep.none", value: "" },
] as const;

export const FooterBar = memo(function FooterBar({
  multiSelectedCount,
  onBatchCopy,
  onBatchDelete,
  onCancelSelection,
  onShowShortcuts,
  monitorPaused,
  onTogglePause,
  onTogglePin,
  windowMode,
  pasteMode,
  onToggleFollowCursor,
  onShowSettings,
  hasSearchQuery,
  isPreviewOpen,
}: FooterBarProps) {
  const t = useTranslation();
  const [showSepMenu, setShowSepMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeSepMenu = useCallback(() => {
    setShowSepMenu(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (showSepMenu && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLButtonElement>(".sep-menu__item");
      firstItem?.focus();
    }
  }, [showSepMenu]);

  useEffect(() => {
    if (!showSepMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShowSepMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSepMenu]);

  const handleSepMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(".sep-menu__item");
      if (!items || items.length === 0) return;

      const focused = document.activeElement as HTMLElement;
      const index = Array.from(items).indexOf(focused as HTMLButtonElement);

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          closeSepMenu();
          break;
        case "ArrowDown":
          e.preventDefault();
          items[index < items.length - 1 ? index + 1 : 0].focus();
          break;
        case "ArrowUp":
          e.preventDefault();
          items[index > 0 ? index - 1 : items.length - 1].focus();
          break;
      }
    },
    [closeSepMenu],
  );

  if (multiSelectedCount > 0) {
    return (
      <div className="footer">
        <span className="footer__hint">{t("footer.selected", { count: multiSelectedCount })}</span>
        <div className="footer__actions">
          <div className="footer__paste-wrap">
            <button
              ref={triggerRef}
              className="footer__batch-btn"
              onClick={() => setShowSepMenu((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showSepMenu}
            >
              {t("footer.pasteDropdown")}
            </button>
            {showSepMenu && (
              <div
                ref={menuRef}
                className="sep-menu"
                role="menu"
                aria-label={t("footer.pasteDropdown")}
                onKeyDown={handleSepMenuKeyDown}
              >
                {SEP_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className="sep-menu__item"
                    role="menuitem"
                    onClick={() => {
                      onBatchCopy(opt.value);
                      setShowSepMenu(false);
                    }}
                  >
                    {t(opt.key)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="footer__batch-btn footer__batch-btn--danger" onClick={onBatchDelete}>
            {t("delete")}
          </button>
          <button
            className="footer__batch-btn"
            onClick={() => {
              onCancelSelection();
              setShowSepMenu(false);
            }}
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="footer">
      <span className="footer__hint">
        {(() => {
          if (isPreviewOpen) return t("footer.hintPreview");
          if (windowMode !== "pinned") return t("footer.hintNoFocus");
          const hint = t(
            windowMode === "pinned" || pasteMode === "copy" ? "footer.hintPinned" : "footer.hint",
          );
          return hasSearchQuery ? hint.replace(/\s*Space \w+\s*\u00B7\s*/, " ") : hint;
        })()}
      </span>
      <div className="footer__actions">
        <button
          className="footer__help"
          onClick={onShowShortcuts}
          title={t("footer.shortcuts")}
          aria-label={t("footer.shortcuts")}
        >
          <IconHelpCircle size={18} />
        </button>
        <button
          className={`footer__pause ${monitorPaused ? "footer__pause--active" : ""}`}
          onClick={onTogglePause}
          title={monitorPaused ? t("footer.resumeMonitor") : t("footer.pauseMonitor")}
          aria-label={monitorPaused ? t("footer.resumeMonitor") : t("footer.pauseMonitor")}
        >
          {monitorPaused ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
        </button>
        <button
          className={`footer__pin ${windowMode === "pinned" ? "footer__pin--active" : ""}`}
          onClick={onTogglePin}
          title={windowMode === "pinned" ? t("footer.unpinWindow") : t("footer.pinWindow")}
          aria-label={windowMode === "pinned" ? t("footer.unpinWindow") : t("footer.pinWindow")}
        >
          {windowMode === "pinned" ? <IconPin size={18} /> : <IconPinnedOff size={18} />}
        </button>
        <button
          className={`footer__follow-cursor ${windowMode === "follow-cursor" ? "footer__follow-cursor--active" : ""}`}
          onClick={onToggleFollowCursor}
          title={
            windowMode === "follow-cursor"
              ? t("footer.followCursorOff")
              : t("footer.followCursorOn")
          }
          aria-label={
            windowMode === "follow-cursor"
              ? t("footer.followCursorOff")
              : t("footer.followCursorOn")
          }
        >
          <IconCrosshair size={18} />
        </button>
        <button
          className="footer__settings"
          onClick={onShowSettings}
          title={t("footer.settings")}
          aria-label={t("footer.settings")}
        >
          <IconSettings size={18} />
        </button>
      </div>
    </div>
  );
});
