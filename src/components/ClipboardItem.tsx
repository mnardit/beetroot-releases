import { memo, useMemo, type ReactNode } from "react";
import {
  IconCheck,
  IconStar,
  IconX,
  IconWorld,
  IconMail,
  IconCode,
  IconBraces,
  IconNote,
  IconSparkles,
} from "@tabler/icons-react";
import "../styles/ClipboardItem.css";
import { useImageThumb, THUMB_ERROR } from "../hooks/useImageThumb";
import { useContentType } from "../hooks/useContentType";

import { useTranslation, getActiveLanguage, type TranslationKey } from "../lib/i18n";
import { extractColor, type ContentType } from "../lib/content-detect";
import type { ClipboardEntry } from "../types/clipboard";

const CONTENT_TYPE_LABELS: Record<Exclude<ContentType, "plain">, TranslationKey> = {
  url: "item.type.url",
  email: "item.type.email",
  code: "item.type.code",
  json: "item.type.json",
  color: "item.type.color",
};

interface ClipboardItemProps {
  item: ClipboardEntry;
  index: number;
  totalCount?: number;
  isSelected: boolean;
  onSelect: (item: ClipboardEntry) => void;
  onStar: (id: number, starred: boolean) => void;
  onDelete: (item: ClipboardEntry) => void;
  onItemContextMenu?: (x: number, y: number, item: ClipboardEntry) => void;
  matchIndices?: readonly [number, number][];
  titleMatchIndices?: readonly [number, number][];
  noteMatchIndices?: readonly [number, number][];
  isNew?: boolean;
  isPasting?: boolean;
  isMultiSelected?: boolean;
  onToggleMultiSelect?: (id: number) => void;
  onHover?: (index: number) => void;
  appIcon?: string;
}

let rtf = new Intl.RelativeTimeFormat(getActiveLanguage(), { numeric: "auto", style: "narrow" });
let rtfLang = getActiveLanguage();

function formatTimeAgo(dateStr: string): string {
  // Recreate formatter if in-app language changed
  const lang = getActiveLanguage();
  if (lang !== rtfLang) {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "narrow" });
    rtfLang = lang;
  }
  const date = new Date(dateStr + "Z");
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return rtf.format(0, "second"); // "now" / "сейчас" / "maintenant"
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800) return rtf.format(-Math.floor(seconds / 86400), "day");
  return date.toLocaleDateString();
}

/** Map Rust character indices to collapsed JavaScript UTF-16 offsets. */
function remapIndices(original: string, indices: readonly [number, number][]): [number, number][] {
  // Build mapping: original position → collapsed position
  const chars = Array.from(original);
  const map: number[] = new Array(chars.length);
  let col = 0;
  let inWs = false;
  // Account for leading whitespace trim
  let started = false;
  for (let i = 0; i < chars.length; i++) {
    const isWs = /\s/.test(chars[i]);
    if (!started) {
      if (isWs) {
        map[i] = 0;
        continue;
      }
      started = true;
    }
    if (isWs) {
      if (!inWs) {
        map[i] = col;
        col++;
        inWs = true;
      } else {
        map[i] = col - 1;
      }
    } else {
      map[i] = col;
      col += chars[i].length;
      inWs = false;
    }
  }
  return indices.map(([s, e]) => {
    const ms = map[Math.min(s, chars.length - 1)] ?? 0;
    const end = Math.min(e, chars.length - 1);
    const me = (map[end] ?? ms) + (/\s/.test(chars[end] ?? "") ? 0 : (chars[end]?.length ?? 1) - 1);
    return [ms, me];
  });
}

function highlightText(
  text: string,
  maxLen: number,
  indices?: readonly [number, number][],
): ReactNode {
  const single = text.replace(/\s+/g, " ").trim();

  // Remap backend character indices to collapsed UTF-16 positions.
  const mapped = indices && indices.length > 0 ? remapIndices(text, indices) : indices;

  // Determine visible window: shift to first match if it's beyond maxLen
  let offset = 0;
  if (mapped && mapped.length > 0 && mapped[0][0] >= maxLen && single.length > maxLen) {
    // Center the window around the first match
    const matchStart = mapped[0][0];
    const matchEnd = mapped[mapped.length - 1]?.[1] ?? matchStart;
    const matchSpan = matchEnd - matchStart + 1;
    const contextBefore = Math.max(10, Math.floor((maxLen - matchSpan) / 3));
    offset = Math.max(0, matchStart - contextBefore);
    // Don't overshoot past end
    if (offset + maxLen > single.length) offset = Math.max(0, single.length - maxLen);
  }

  const prefix = offset > 0 ? "..." : "";
  const slice = single.slice(offset, offset + maxLen);
  const display = prefix + (offset + maxLen < single.length ? slice + "..." : slice);

  if (!mapped || mapped.length === 0) {
    // No matches — show from beginning
    if (single.length <= maxLen) return single;
    return single.slice(0, maxLen) + "...";
  }

  const prefixLen = prefix.length;
  const parts: ReactNode[] = [];
  let lastEnd = 0;
  if (prefixLen > 0) {
    parts.push(prefix);
    lastEnd = prefixLen;
  }

  for (const [start, end] of mapped) {
    // Shift indices relative to the window
    const adjStart = start - offset + prefixLen;
    const suffixLen = offset + maxLen < single.length ? 3 : 0;
    const adjEnd = Math.min(end - offset + prefixLen + 1, display.length - suffixLen);
    if (adjEnd <= prefixLen) continue; // before visible window
    if (adjStart >= display.length) break; // after visible window
    const clampedStart = Math.max(adjStart, prefixLen);
    if (clampedStart > lastEnd) {
      parts.push(display.slice(lastEnd, clampedStart));
    }
    parts.push(
      <mark key={start} className="clip-item__highlight">
        {display.slice(clampedStart, adjEnd)}
      </mark>,
    );
    lastEnd = adjEnd;
  }
  if (lastEnd < display.length) {
    parts.push(display.slice(lastEnd));
  }
  return parts.length > 0 ? parts : display;
}

export const ClipboardItem = memo(function ClipboardItem({
  item,
  index,
  totalCount,
  isSelected,
  onSelect,
  onStar,
  onDelete,
  onItemContextMenu,
  matchIndices,
  titleMatchIndices,
  noteMatchIndices,
  isNew,
  isPasting,
  isMultiSelected,
  onToggleMultiSelect,
  onHover,
  appIcon,
}: ClipboardItemProps) {
  const t = useTranslation();
  const { isImage, contentType } = useContentType(item);
  const thumbSrc = useImageThumb(isImage ? item.image_path : null, 96);
  const colorValue = useMemo(
    () => (contentType === "color" ? extractColor(item.content) : null),
    [contentType, item.content],
  );

  return (
    <div
      id={`clip-item-${item.id}`}
      role="option"
      aria-selected={isSelected}
      aria-posinset={index + 1}
      aria-setsize={totalCount ?? -1}
      className={`clip-item ${isSelected ? "clip-item--selected" : ""} ${item.starred ? "clip-item--starred" : ""} ${isMultiSelected ? "clip-item--multi" : ""} ${isNew ? "clip-item--new" : ""} ${isPasting ? "clip-item--pasting" : ""}`}
      onMouseEnter={() => onHover?.(index)}
      onClick={(e) => {
        if (e.ctrlKey && onToggleMultiSelect) {
          e.preventDefault();
          onToggleMultiSelect(item.id);
        } else {
          onSelect(item);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onItemContextMenu) {
          onItemContextMenu(e.clientX, e.clientY, item);
        } else {
          onStar(item.id, !item.starred);
        }
      }}
    >
      {isMultiSelected && (
        <span className="clip-item__index">
          <IconCheck size={14} />
        </span>
      )}
      {appIcon ? (
        <img src={appIcon} alt="" className="clip-item__app-icon" />
      ) : item.source_app === "AI" ? (
        <span className="clip-item__app-icon clip-item__app-icon--ai">
          <IconSparkles size={16} />
        </span>
      ) : null}
      {isImage ? (
        <span className="clip-item__content clip-item__content--image">
          {thumbSrc && thumbSrc !== THUMB_ERROR ? (
            <img src={thumbSrc} alt={t("item.imageAlt")} className="clip-item__thumbnail" />
          ) : thumbSrc === THUMB_ERROR ? (
            <span className="clip-item__image-label">{t("item.imageError")}</span>
          ) : (
            <span className="clip-item__image-label">{t("item.imageLoading")}</span>
          )}
        </span>
      ) : (
        <span className="clip-item__content">
          {highlightText(item.content, 100, matchIndices)}
          {titleMatchIndices && item.source_title && (
            <span className="clip-item__source-title">
              {highlightText(item.source_title, 60, titleMatchIndices)}
            </span>
          )}
          {item.note && (
            <span
              className={`clip-item__subtitle${noteMatchIndices ? " clip-item__subtitle--matched" : ""}`}
            >
              {highlightText(item.note, 80, noteMatchIndices)}
            </span>
          )}
        </span>
      )}
      {colorValue && (
        <span
          className="clip-item__swatch"
          style={{ backgroundColor: colorValue }}
          role="img"
          aria-label={colorValue}
        />
      )}
      {contentType !== "plain" && contentType !== "color" && (
        <span
          className="clip-item__badge"
          role="img"
          aria-label={t(CONTENT_TYPE_LABELS[contentType])}
        >
          {contentType === "url" && <IconWorld size={14} />}
          {contentType === "email" && <IconMail size={14} />}
          {contentType === "code" && <IconCode size={14} />}
          {contentType === "json" && <IconBraces size={14} />}
        </span>
      )}
      {item.note && (
        <span
          className="clip-item__note-icon"
          title={item.note}
          role="img"
          aria-label={t("item.hasNote")}
        >
          <IconNote size={14} />
        </span>
      )}
      <span className="clip-item__time">{formatTimeAgo(item.last_used)}</span>
      <button
        className={`clip-item__star ${item.starred ? "clip-item__star--active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onStar(item.id, !item.starred);
        }}
        tabIndex={-1}
        title={item.starred ? t("item.unpin") : t("item.pin")}
        aria-label={item.starred ? t("item.unpin") : t("item.pin")}
      >
        <IconStar size={16} fill={item.starred ? "currentColor" : "none"} />
      </button>
      <button
        className="clip-item__delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item);
        }}
        tabIndex={-1}
        title={t("item.deleteHint")}
        aria-label={t("delete")}
      >
        <IconX size={16} />
      </button>
    </div>
  );
});
