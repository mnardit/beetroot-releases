import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  IconStar,
  IconEye,
  IconWand,
  IconFolderOpen,
  IconTextScan2,
  IconSparkles,
  IconTrash,
  IconWorld,
  IconClipboardCopy,
} from "@tabler/icons-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import "../styles/ContextMenu.css";
import type { ClipboardEntry } from "../types/clipboard";
import type { CustomAIPrompt } from "../lib/settings";
import type { AIConfig } from "../lib/openai";
import { getPromptLabel } from "../lib/settings";
import { getActiveModel, isAIReady } from "../lib/openai";
import { useTranslation } from "../lib/i18n";
import { extractUrls } from "../lib/content-detect";
import { dbGetItem, readImageBase64 } from "../lib/tauri";
import type { SubmitJobParams } from "../lib/tauri";
import { useRestoreFocus } from "../hooks/useRestoreFocus";
import { useContentType } from "../hooks/useContentType";
import { getMimeFromPath } from "../lib/image-utils";

interface ContextMenuProps {
  x: number;
  y: number;
  item: ClipboardEntry;
  onClose: () => void;
  onStar: (id: number, starred: boolean) => void;
  onDelete: (item: ClipboardEntry) => void;
  onPreview: (item: ClipboardEntry) => void;
  onShowInExplorer?: (path: string) => void;
  onTransform?: (item: ClipboardEntry) => void;
  onPaste?: (item: ClipboardEntry) => void;
  onCopy?: (item: ClipboardEntry) => void;
  onOcr?: (item: ClipboardEntry) => void;
  isCopyOnly?: boolean;
  quickAccessPrompts?: CustomAIPrompt[];
  aiConfig?: AIConfig;
  submitJob?: (params: SubmitJobParams) => Promise<number | null>;
  onError: (message: string) => void;
}

export const ContextMenu = memo(function ContextMenu({
  x,
  y,
  item,
  onClose,
  onStar,
  onDelete,
  onPreview,
  onShowInExplorer,
  onPaste,
  onCopy,
  onTransform,
  onOcr,
  isCopyOnly,
  quickAccessPrompts,
  aiConfig,
  submitJob,
  onError,
}: ContextMenuProps) {
  const t = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  useRestoreFocus();
  const [isExiting, setIsExiting] = useState(false);
  const closingRef = useRef(false);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsExiting(true);
    setTimeout(() => onClose(), 100);
  }, [onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
          'button[role="menuitem"]:not(:disabled)',
        );
        if (!items || items.length === 0) return;
        const current = document.activeElement as HTMLElement;
        const idx = Array.from(items).indexOf(current as HTMLButtonElement);
        const next =
          e.key === "ArrowDown"
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [handleClose]);

  // Focus first menu item on mount
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus();
  }, []);

  // Clamp position so menu doesn't overflow the window
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 16;
    if (x > maxX) menuRef.current.style.left = `${maxX}px`;
    if (y > maxY) menuRef.current.style.top = `${maxY}px`;
  }, [x, y]);

  const { isImage, contentType } = useContentType(item);
  const urls = useMemo(
    () => (contentType === "url" ? extractUrls(item.content) : []),
    [contentType, item.content],
  );

  const matchingPrompts = useMemo(() => {
    if (!quickAccessPrompts) return [];
    const promptType = isImage ? "image" : "text";
    return quickAccessPrompts.filter((p) => (p.type || "text") === promptType);
  }, [quickAccessPrompts, isImage]);

  return (
    <div
      ref={menuRef}
      className={`context-menu${isExiting ? " context-menu--exiting" : ""}`}
      style={{ left: x, top: y }}
      role="menu"
      aria-label={t("aria.contextMenu")}
    >
      {!isCopyOnly && onPaste && (
        <button
          className="context-menu__item"
          role="menuitem"
          onClick={() => {
            onPaste(item);
            handleClose();
          }}
        >
          <span className="context-menu__icon">
            <IconClipboardCopy size={14} />
          </span>
          {t("ctx.paste")}
          <span className="context-menu__hint">Enter</span>
        </button>
      )}
      {onCopy && (
        <button
          className="context-menu__item"
          role="menuitem"
          onClick={() => {
            onCopy(item);
            handleClose();
          }}
        >
          <span className="context-menu__icon">
            <IconClipboardCopy size={14} />
          </span>
          {t("ctx.copy")}
          <span className="context-menu__hint">Ctrl+C</span>
        </button>
      )}
      <button
        className="context-menu__item"
        role="menuitem"
        onClick={() => {
          onStar(item.id, !item.starred);
          handleClose();
        }}
      >
        <span className="context-menu__icon">
          <IconStar size={14} fill={item.starred ? "currentColor" : "none"} />
        </span>
        {item.starred ? t("ctx.unpin") : t("ctx.pin")}
        <span className="context-menu__hint">Alt+S</span>
      </button>
      <button
        className="context-menu__item"
        role="menuitem"
        onClick={() => {
          onPreview(item);
          handleClose();
        }}
      >
        <span className="context-menu__icon">
          <IconEye size={14} />
        </span>
        {t("ctx.preview")}
        <span className="context-menu__hint">Space</span>
      </button>
      {onTransform && (
        <button
          className="context-menu__item"
          role="menuitem"
          onClick={() => {
            onTransform(item);
            handleClose();
          }}
        >
          <span className="context-menu__icon">
            <IconWand size={14} />
          </span>
          {t("ctx.transform")}
          <span className="context-menu__hint">Alt+T</span>
        </button>
      )}
      {isImage && item.image_path && onShowInExplorer && (
        <button
          className="context-menu__item"
          role="menuitem"
          onClick={() => {
            onShowInExplorer(item.image_path!);
            handleClose();
          }}
        >
          <span className="context-menu__icon">
            <IconFolderOpen size={14} />
          </span>
          {t("ctx.showInExplorer")}
        </button>
      )}
      {isImage && onOcr && (
        <button
          className="context-menu__item"
          role="menuitem"
          onClick={() => {
            onOcr(item);
            handleClose();
          }}
        >
          <span className="context-menu__icon">
            <IconTextScan2 size={14} />
          </span>
          {t("ctx.ocr")}
        </button>
      )}
      {urls.length > 0 && (
        <button
          className="context-menu__item"
          role="menuitem"
          onClick={() => {
            openUrl(urls[0]);
            handleClose();
          }}
        >
          <span className="context-menu__icon">
            <IconWorld size={14} />
          </span>
          {t("ctx.openUrl")}
        </button>
      )}
      {matchingPrompts.length > 0 && submitJob && aiConfig && isAIReady(aiConfig) && (
        <>
          <div className="context-menu__separator" />
          {matchingPrompts.map((p) => (
            <button
              key={p.id}
              className="context-menu__item"
              role="menuitem"
              onClick={async () => {
                let full: ClipboardEntry;
                try {
                  full = await dbGetItem(item.id);
                } catch {
                  onError(t("toast.loadFailed"));
                  handleClose();
                  return;
                }
                let inputText = full.content;
                let imageBase64: string | undefined;
                let imageMime: string | undefined;

                if (full.content_type === "image" && full.image_path) {
                  try {
                    imageBase64 = await readImageBase64(full.image_path);
                    imageMime = getMimeFromPath(full.image_path);
                    inputText = "";
                  } catch {
                    onError(t("toast.loadFailed"));
                    handleClose();
                    return;
                  }
                } else if (full.content_type === "image") {
                  // Image clip without image_path — can't process
                  onError(t("toast.loadFailed"));
                  handleClose();
                  return;
                }

                try {
                  await submitJob({
                    provider: aiConfig!.provider,
                    model: getActiveModel(aiConfig!),
                    endpoint: aiConfig!.provider === "local" ? aiConfig!.localEndpoint : undefined,
                    prompt: p.prompt,
                    promptName: getPromptLabel(p, t),
                    inputText,
                    imageBase64,
                    imageMime,
                  });
                } finally {
                  handleClose();
                }
              }}
            >
              <span className="context-menu__icon">
                <IconSparkles size={14} />
              </span>
              {getPromptLabel(p, t)}
            </button>
          ))}
        </>
      )}
      <div className="context-menu__separator" />
      <button
        className="context-menu__item context-menu__item--danger"
        role="menuitem"
        onClick={() => {
          onDelete(item);
          handleClose();
        }}
      >
        <span className="context-menu__icon">
          <IconTrash size={14} />
        </span>
        {t("delete")}
        <span className="context-menu__hint">Alt+Del</span>
      </button>
    </div>
  );
});
