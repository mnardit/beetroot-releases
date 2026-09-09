import { useEffect, useMemo } from "react";
import "../styles/ClipboardList.css";
import { List, useListRef } from "react-window";
import type { CSSProperties, ReactElement } from "react";
import type { ClipboardEntry } from "../types/clipboard";
import type { AppIconData } from "../hooks/useAppIcons";
import { ClipboardItem } from "./ClipboardItem";
import { useTranslation } from "../lib/i18n";
import type { TranslationKey } from "../lib/i18n";
import { ITEM_ROW_HEIGHT, VIRTUAL_LIST_OVERSCAN } from "../lib/constants";

interface ClipboardListProps {
  items: ClipboardEntry[];
  selectedIndex: number;
  onSelect: (item: ClipboardEntry) => void;
  onStar: (id: number, starred: boolean) => void;
  onDelete: (item: ClipboardEntry) => void;
  onItemContextMenu?: (x: number, y: number, item: ClipboardEntry) => void;
  matchMap?: Map<number, readonly [number, number][]>;
  titleMatchMap?: Map<number, readonly [number, number][]>;
  noteMatchMap?: Map<number, readonly [number, number][]>;
  newItemId?: number | null;
  pastingItemId?: number | null;
  multiSelected?: Set<number>;
  onToggleMultiSelect?: (id: number) => void;
  onHover?: (index: number) => void;
  appIcons?: Record<string, AppIconData>;
}

interface RowExtraProps {
  items: ClipboardEntry[];
  selectedIndex: number;
  onSelect: (item: ClipboardEntry) => void;
  onStar: (id: number, starred: boolean) => void;
  onDelete: (item: ClipboardEntry) => void;
  onItemContextMenu?: (x: number, y: number, item: ClipboardEntry) => void;
  matchMap?: Map<number, readonly [number, number][]>;
  titleMatchMap?: Map<number, readonly [number, number][]>;
  noteMatchMap?: Map<number, readonly [number, number][]>;
  groupLabels: Map<number, string>;
  newItemId?: number | null;
  pastingItemId?: number | null;
  multiSelected?: Set<number>;
  onToggleMultiSelect?: (id: number) => void;
  onHover?: (index: number) => void;
  appIcons?: Record<string, AppIconData>;
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0 && date.getDate() === now.getDate()) return "group.today";
  if (diffDays <= 1 || (diffDays === 0 && date.getDate() !== now.getDate()))
    return "group.yesterday";
  if (diffDays < 7) return "group.thisWeek";
  return "group.older";
}

function computeGroupLabels(items: ClipboardEntry[]): Map<number, string> {
  const labels = new Map<number, string>();
  let lastGroup = "";
  for (let i = 0; i < items.length; i++) {
    const group = getDateGroup(items[i].last_used);
    if (group !== lastGroup) {
      labels.set(i, group);
      lastGroup = group;
    }
  }
  return labels;
}

function Row({
  index,
  style,
  items,
  selectedIndex,
  onSelect,
  onStar,
  onDelete,
  onItemContextMenu,
  matchMap,
  titleMatchMap,
  noteMatchMap,
  groupLabels,
  newItemId,
  pastingItemId,
  multiSelected,
  onToggleMultiSelect,
  onHover,
  appIcons,
}: RowExtraProps & {
  ariaAttributes: object;
  index: number;
  style: CSSProperties;
}): ReactElement | null {
  const t = useTranslation();
  const item = items[index];
  const groupKey = groupLabels.get(index);
  return (
    <div style={style}>
      {groupKey && <div className="clip-list__group-label">{t(groupKey as TranslationKey)}</div>}
      <ClipboardItem
        item={item}
        index={index}
        totalCount={items.length}
        isSelected={index === selectedIndex}
        onSelect={onSelect}
        onStar={onStar}
        onDelete={onDelete}
        onItemContextMenu={onItemContextMenu}
        matchIndices={matchMap?.get(item.id)}
        titleMatchIndices={titleMatchMap?.get(item.id)}
        noteMatchIndices={noteMatchMap?.get(item.id)}
        isNew={item.id === newItemId}
        isPasting={item.id === pastingItemId}
        isMultiSelected={multiSelected?.has(item.id) ?? false}
        onToggleMultiSelect={onToggleMultiSelect}
        onHover={onHover}
        appIcon={
          item.content_type !== "image" &&
          item.source_app &&
          appIcons?.[item.source_app]?.iconBase64
            ? `data:image/png;base64,${appIcons[item.source_app].iconBase64}`
            : undefined
        }
      />
    </div>
  );
}

const GROUP_HEADER_HEIGHT = 28;

export function ClipboardList({
  items,
  selectedIndex,
  onSelect,
  onStar,
  onDelete,
  onItemContextMenu,
  matchMap,
  titleMatchMap,
  noteMatchMap,
  newItemId,
  pastingItemId,
  multiSelected,
  onToggleMultiSelect,
  onHover,
  appIcons,
}: ClipboardListProps) {
  const t = useTranslation();
  const listRef = useListRef(null);
  const groupLabels = useMemo(() => computeGroupLabels(items), [items]);

  const getRowHeight = useMemo(() => {
    return (index: number) =>
      groupLabels.has(index) ? ITEM_ROW_HEIGHT + GROUP_HEADER_HEIGHT : ITEM_ROW_HEIGHT;
  }, [groupLabels]);

  useEffect(() => {
    if (items.length > 0 && selectedIndex < items.length) {
      listRef.current?.scrollToRow({ index: selectedIndex, align: "auto" });
    }
  }, [selectedIndex, listRef, items.length]);

  return (
    <div
      className="clip-list"
      role="listbox"
      tabIndex={0}
      aria-label={t("aria.clipboardHistory")}
      aria-activedescendant={
        items[selectedIndex] ? `clip-item-${items[selectedIndex].id}` : undefined
      }
    >
      <List<RowExtraProps>
        listRef={listRef}
        rowCount={items.length}
        rowHeight={getRowHeight}
        rowComponent={Row}
        rowProps={{
          items,
          selectedIndex,
          onSelect,
          onStar,
          onDelete,
          onItemContextMenu,
          matchMap,
          titleMatchMap,
          noteMatchMap,
          groupLabels,
          newItemId,
          pastingItemId,
          multiSelected,
          onToggleMultiSelect,
          onHover,
          appIcons,
        }}
        overscanCount={VIRTUAL_LIST_OVERSCAN}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
