import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  IconX,
  IconCopy,
  IconSparkles,
  IconPencil,
  IconWand,
  IconTextWrap,
  IconDots,
  IconPlayerPlay,
  IconTrash,
  IconEye,
} from "@tabler/icons-react";
import "../styles/PreviewPanel.css";
import { useTranslation } from "../lib/i18n";
import { activateWindow, ocrImage } from "../lib/tauri";
import type { ClipboardEntry } from "../types/clipboard";
import { useImageThumb, THUMB_ERROR } from "../hooks/useImageThumb";
import { useContentType } from "../hooks/useContentType";
import { extractColor } from "../lib/content-detect";
import { detectLanguage } from "../lib/lang-detect";
import { writeText, writeImageBase64 } from "tauri-plugin-clipboard-api";
import { useToast } from "../hooks/useToast";
import { useRestoreFocus } from "../hooks/useRestoreFocus";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { readImageBase64 } from "../lib/tauri";
import { suppressedWrite } from "../lib/paste";

import type { AppIconData } from "../hooks/useAppIcons";

interface PreviewPanelProps {
  item: ClipboardEntry;
  onClose: () => void;
  onUpdateNote?: (id: number, note: string) => void;
  onPaste?: (item: ClipboardEntry) => void;
  onDelete?: (item: ClipboardEntry) => void;
  onTransform?: (item: ClipboardEntry) => void;
  appIcons?: Record<string, AppIconData>;
}

/** Top-30 exe→human-readable name mapping */
const APP_NAME_MAP: Record<string, string> = {
  "chrome.exe": "Chrome",
  "firefox.exe": "Firefox",
  "msedge.exe": "Edge",
  "Code.exe": "VS Code",
  "Typora.exe": "Typora",
  "notepad.exe": "Notepad",
  "explorer.exe": "Explorer",
  "WINWORD.EXE": "Word",
  "EXCEL.EXE": "Excel",
  "POWERPNT.EXE": "PowerPoint",
  "Teams.exe": "Teams",
  "slack.exe": "Slack",
  "Discord.exe": "Discord",
  "Telegram.exe": "Telegram",
  "WindowsTerminal.exe": "Terminal",
  "cmd.exe": "Command Prompt",
  "powershell.exe": "PowerShell",
  "idea64.exe": "IntelliJ",
  "webstorm64.exe": "WebStorm",
  "sublime_text.exe": "Sublime Text",
  "Obsidian.exe": "Obsidian",
  "notion.exe": "Notion",
  "alacritty.exe": "Alacritty",
  "mintty.exe": "Git Bash",
  "Opera.exe": "Opera",
  "brave.exe": "Brave",
  "vivaldi.exe": "Vivaldi",
  "Cursor.exe": "Cursor",
  "windsurf.exe": "Windsurf",
  "phpstorm64.exe": "PhpStorm",
};

function getAppDisplayName(exeName: string | null, appIcons?: Record<string, AppIconData>): string {
  if (!exeName) return "";
  // Check hardcoded map first (curated names > OS names)
  const lower = exeName.toLowerCase();
  for (const [key, val] of Object.entries(APP_NAME_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }
  // Check app icons cache (OS-provided display name)
  if (appIcons?.[exeName]?.displayName) return appIcons[exeName]!.displayName;
  // Fallback: strip .exe, capitalize first letter
  const stripped = exeName.replace(/\.exe$/i, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always", style: "narrow" });

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return rtf.format(0, "second");
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800) return rtf.format(-Math.floor(seconds / 86400), "day");
  return date.toLocaleDateString();
}

function getImageFormat(path: string | null): string {
  if (!path) return "";
  const ext = path.split(".").pop()?.toUpperCase() ?? "";
  return ext === "JPG" ? "JPEG" : ext;
}

export function PreviewPanel({
  item,
  onClose,
  onUpdateNote,
  onPaste,
  onDelete,
  onTransform,
  appIcons,
}: PreviewPanelProps) {
  const t = useTranslation();
  const { showInfo } = useToast();
  useRestoreFocus();
  const panelRef = useRef<HTMLDivElement>(null);
  const trapFocus = useFocusTrap(panelRef);
  const { isImage, contentType } = useContentType(item);
  const thumbSrc = useImageThumb(isImage ? item.image_path : null);
  const [zoomed, setZoomed] = useState(false);
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);
  const isCode = contentType === "code" || contentType === "json";
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [localNote, setLocalNote] = useState(item.note);
  const [wrapCode, setWrapCode] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Reset all state when switching to a different item
  useEffect(() => {
    setNoteExpanded(false);
    setZoomed(false);
    setImgDimensions(null);
    setLocalNote(item.note);
    setWrapCode(false);
    setMoreOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Sync localNote when item.note updates from DB (e.g. after save)
  useEffect(() => {
    setLocalNote(item.note);
  }, [item.note]);

  const colorValue = useMemo(
    () => (contentType === "color" ? extractColor(item.content) : null),
    [contentType, item.content],
  );

  // Track pending note changes so they're saved on unmount (e.g. Escape, window hide).
  // Bind to the item id at write time — when the user types on item A and quickly
  // switches to item B, the [item.id] effect cleanup runs AFTER React reassigns
  // the closure to B during the new render. Reading itemRef.current at flush time
  // would route A's pending note to B's id and corrupt B's data.
  const pendingNoteRef = useRef<{ id: number; value: string; originalNote: string | null } | null>(
    null,
  );
  const onUpdateNoteRef = useRef(onUpdateNote);
  onUpdateNoteRef.current = onUpdateNote;

  const flushNote = useCallback(() => {
    const pending = pendingNoteRef.current;
    const updateNote = onUpdateNoteRef.current;
    if (pending !== null && updateNote) {
      const val = pending.value.trim();
      if (val !== (pending.originalNote ?? "")) {
        updateNote(pending.id, val);
      }
      pendingNoteRef.current = null;
    }
  }, []);

  useEffect(() => flushNote, [flushNote]);

  // Flush pending note when navigating to a different item
  useEffect(() => {
    return () => {
      flushNote();
    };
  }, [item.id, flushNote]);

  const [highlighted, setHighlighted] = useState<{
    html: string;
    language: string;
  } | null>(null);

  useEffect(() => {
    if (!isCode || isImage) {
      setHighlighted(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const hljs = (await import("highlight.js/lib/common")).default;
        const lang = await detectLanguage(item.content);
        if (cancelled) return;
        const hljsLangs = hljs.listLanguages();
        const result =
          lang && hljsLangs.includes(lang)
            ? hljs.highlight(item.content, { language: lang, ignoreIllegals: true })
            : hljs.highlightAuto(item.content);
        if (!cancelled) {
          setHighlighted({
            html: result.value,
            language: result.language ?? lang,
          });
        }
      } catch {
        // highlight.js or ML model failed to load, fall back to plain text
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCode, isImage, item.content]);

  // --- Header ---

  const appName = useMemo(() => {
    if (item.source_app === "AI") return t("filter.aiTransform");
    return getAppDisplayName(item.source_app, appIcons);
  }, [item.source_app, appIcons, t]);

  const headerIcon = useMemo(() => {
    if (item.source_app === "AI") {
      return <IconSparkles size={14} className="preview-panel__title-icon--ai" />;
    }
    if (item.source_app && appIcons?.[item.source_app]?.iconBase64) {
      return (
        <img
          src={`data:image/png;base64,${appIcons[item.source_app]!.iconBase64}`}
          alt=""
          className="preview-panel__title-icon"
        />
      );
    }
    return null;
  }, [item.source_app, appIcons]);

  const typeBadge = useMemo(() => {
    if (isImage) return t("item.type.image");
    if (isCode && highlighted?.language) return highlighted.language.toUpperCase();
    if (contentType === "json") return "JSON";
    if (contentType === "url") return "URL";
    if (contentType === "email") return t("item.type.email");
    if (contentType === "color") return t("item.type.color");
    return t("item.type.text");
  }, [isImage, isCode, contentType, highlighted?.language, t]);

  const metaInfo = useMemo(() => {
    if (isImage && imgDimensions) {
      const fmt = getImageFormat(item.image_path);
      return `${imgDimensions.w}\u00D7${imgDimensions.h}${fmt ? " " + fmt : ""}`;
    }
    return formatTimeAgo(item.last_used || item.created_at);
  }, [isImage, imgDimensions, item.image_path, item.last_used, item.created_at]);

  // --- Line numbers for code ---

  const codeLines = useMemo(() => {
    if (!isCode || isImage) return null;
    if (highlighted) {
      return highlighted.html.split("\n");
    }
    return item.content.split("\n");
  }, [isCode, isImage, highlighted, item.content]);

  // --- Handlers ---

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      if (isImage && item.image_path) {
        const b64 = await readImageBase64(item.image_path);
        await suppressedWrite(() => writeImageBase64(b64));
      } else {
        await suppressedWrite(() => writeText(item.content));
      }
      showInfo(t("toast.copied"));
    } catch {
      showInfo(t("toast.pasteFailed"));
    }
  }, [isImage, item.image_path, item.content, showInfo, t]);

  async function handleOcrClick() {
    if (!item.image_path) return;
    try {
      const text = await ocrImage(item.image_path);
      if (text.trim()) {
        await suppressedWrite(() => writeText(text));
        showInfo(t("toast.copied"));
      }
    } catch {
      // OCR failed silently
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " || e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.code === "KeyC" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCopy();
        return;
      }
      trapFocus(e);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, isImage, isCode, item, onTransform, trapFocus]);

  // Close More dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick() {
      setMoreOpen(false);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [moreOpen]);

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div
        className="preview-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("aria.previewPanel")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="preview-panel__header">
          <span className="preview-panel__title">
            {headerIcon}
            {appName && <>{appName} &middot; </>}
            <span className="preview-panel__type-badge">{typeBadge}</span>
            <span className="preview-panel__meta"> &middot; {metaInfo}</span>
          </span>
          <button
            className="preview-panel__header-btn"
            onClick={onClose}
            title={t("close")}
            aria-label={t("close")}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="preview-panel__actions">
          <button className="preview-panel__action-btn" onClick={handleCopy}>
            <IconCopy size={14} />
            <span>{isImage ? t("preview.copyImage") : t("preview.copy")}</span>
          </button>
          {isImage && (
            <>
              <button className="preview-panel__action-btn" onClick={handleOcrClick}>
                <IconEye size={14} />
                <span>{t("preview.ocr")}</span>
              </button>
              {onTransform && (
                <button className="preview-panel__action-btn" onClick={() => onTransform(item)}>
                  <IconSparkles size={14} />
                  <span>{t("preview.ai")}</span>
                </button>
              )}
            </>
          )}
          {onTransform && !isImage && (
            <button className="preview-panel__action-btn" onClick={() => onTransform(item)}>
              <IconWand size={14} />
              <span>{t("preview.transform")}</span>
            </button>
          )}
          {isCode && (
            <button
              className={`preview-panel__action-btn${wrapCode ? " preview-panel__action-btn--active" : ""}`}
              onClick={() => setWrapCode((w) => !w)}
            >
              <IconTextWrap size={14} />
              <span>{t("preview.wrap")}</span>
            </button>
          )}
          <div className="preview-panel__more-wrap">
            <button
              className="preview-panel__action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMoreOpen((o) => !o);
              }}
            >
              <IconDots size={14} />
            </button>
            {moreOpen && (
              <div className="preview-panel__more-menu" onClick={(e) => e.stopPropagation()}>
                {onPaste && (
                  <button
                    className="preview-panel__more-item"
                    onClick={() => {
                      onPaste(item);
                      setMoreOpen(false);
                    }}
                  >
                    <IconPlayerPlay size={14} />
                    {t("preview.paste")}
                  </button>
                )}
                {!isImage && (
                  <button
                    className="preview-panel__more-item"
                    onClick={async () => {
                      await suppressedWrite(() => writeText(item.content));
                      showInfo(t("toast.copied"));
                      setMoreOpen(false);
                    }}
                  >
                    <IconCopy size={14} />
                    {t("preview.copyPlain")}
                  </button>
                )}
                {onDelete && (
                  <button
                    className="preview-panel__more-item preview-panel__more-item--danger"
                    onClick={() => {
                      onDelete(item);
                      setMoreOpen(false);
                    }}
                  >
                    <IconTrash size={14} />
                    {t("preview.delete")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          className={`preview-panel__body${isImage ? " preview-panel__body--image" : ""}${isImage && zoomed ? " preview-panel__body--zoomed" : ""}`}
        >
          {colorValue && (
            <div className="preview-panel__color-swatch" style={{ backgroundColor: colorValue }} />
          )}
          {isImage ? (
            thumbSrc && thumbSrc !== THUMB_ERROR ? (
              <img
                src={thumbSrc}
                alt={t("preview.imageAlt")}
                className={`preview-panel__image${zoomed ? " preview-panel__image--zoomed" : ""}`}
                onClick={() => setZoomed((z) => !z)}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                ref={(img) => {
                  // Fallback: if onLoad already fired before React attached handler
                  // (can happen with cached data: URLs), read dimensions from complete image
                  if (img?.complete && img.naturalWidth > 0 && !imgDimensions) {
                    setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                  }
                }}
              />
            ) : (
              <span className="preview-panel__placeholder">
                {thumbSrc === THUMB_ERROR ? t("preview.failed") : t("preview.loading")}
              </span>
            )
          ) : isCode && codeLines ? (
            <pre
              className={`preview-panel__text preview-panel__text--code${wrapCode ? " preview-panel__text--wrap" : ""}`}
            >
              <code>
                {codeLines.map((line, i) => (
                  <div key={i} className="preview-panel__code-line">
                    <span className="preview-panel__line-num">{i + 1}</span>
                    {highlighted ? (
                      <span dangerouslySetInnerHTML={{ __html: line }} />
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))}
              </code>
            </pre>
          ) : (
            <pre className="preview-panel__text" data-content-type={contentType}>
              {item.content}
            </pre>
          )}
        </div>

        {/* Note Footer */}
        {onUpdateNote &&
          (noteExpanded ? (
            <div className="preview-panel__note">
              <input
                key={item.id}
                className="preview-panel__note-input"
                type="text"
                placeholder={t("preview.addNote")}
                aria-label={t("preview.note")}
                autoFocus
                defaultValue={localNote ?? ""}
                onChange={(e) => {
                  pendingNoteRef.current = {
                    id: item.id,
                    value: e.target.value,
                    originalNote: item.note,
                  };
                  setLocalNote(e.target.value);
                }}
                onFocus={() => {
                  activateWindow().catch(() => {});
                }}
                onBlur={() => {
                  flushNote();
                  setNoteExpanded(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                  e.stopPropagation();
                }}
              />
            </div>
          ) : localNote ? (
            <button
              className="preview-panel__note-toggle preview-panel__note-toggle--has-note"
              onClick={() => setNoteExpanded(true)}
            >
              <IconPencil size={12} className="preview-panel__note-icon" />
              {localNote}
            </button>
          ) : (
            <button className="preview-panel__note-toggle" onClick={() => setNoteExpanded(true)}>
              <IconPencil size={12} className="preview-panel__note-icon" />
              {t("preview.addNoteShort")}
            </button>
          ))}
      </div>
    </div>
  );
}
