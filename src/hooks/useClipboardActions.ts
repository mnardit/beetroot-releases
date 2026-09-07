import { useCallback, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { pasteItem, copyToClipboard } from "../lib/paste";
import {
  showInExplorer,
  ocrImage,
  hideWindow,
  dbGetItem,
  readImageBase64,
  showCopyOverlay,
} from "../lib/tauri";
import { textEntry } from "../lib/clipboard-utils";
import { OVERLAY_DURATION_MS } from "../lib/settings";
import { createLogger } from "../lib/log";
import type { ClipboardEntry } from "../types/clipboard";
import type { AppSettings } from "../lib/settings";
import type { TFunction } from "../lib/i18n";

const log = createLogger("clipboardActions");

interface UseClipboardActionsDeps {
  settings: AppSettings;
  addItem: (content: string, html?: string, sourceApp?: string, sourceTitle?: string) => void;
  removeItem: (id: number) => Promise<void>;
  restoreItem: (entry: ClipboardEntry, imageBase64?: string) => Promise<void>;
  starItem: (id: number, starred: boolean) => Promise<void>;
  touchItem: (id: number) => Promise<void>;
  previewItem: ClipboardEntry | null;
  transformItem: ClipboardEntry | null;
  setPreviewItem: (item: ClipboardEntry | null) => void;
  setTransformItem: (item: ClipboardEntry | null) => void;
  setContextMenu: (menu: { x: number; y: number; item: ClipboardEntry } | null) => void;
  showError: (msg: string) => void;
  showInfo: (msg: string, action?: { label: string; onClick: () => void }) => void;
  t: TFunction;
}

export function useClipboardActions(deps: UseClipboardActionsDeps) {
  const {
    settings,
    addItem,
    removeItem,
    restoreItem,
    starItem: starItemDb,
    touchItem,
    previewItem,
    transformItem,
    setPreviewItem,
    setTransformItem,
    setContextMenu,
    showError,
    showInfo,
    t,
  } = deps;
  const [pastingItemId, setPastingItemId] = useState<number | null>(null);
  const isPastingRef = useRef(false);
  const showCopyFeedback = useCallback(async () => {
    showInfo(t("toast.copied"));
    if (!settings.showCopiedOverlay) return;
    try {
      // A final focus/modifier guard may reject paste after the popup has hidden.
      if (!(await getCurrentWindow().isVisible())) {
        await showCopyOverlay(
          t("overlay.copied"),
          settings.overlayPosition,
          OVERLAY_DURATION_MS[settings.overlayDuration],
          settings.overlayAnimation,
        );
      }
    } catch (error) {
      // Clipboard writing already succeeded; feedback failure must not retry it.
      log.warn("Copy-only feedback unavailable", error);
    }
  }, [
    showInfo,
    t,
    settings.showCopiedOverlay,
    settings.overlayPosition,
    settings.overlayDuration,
    settings.overlayAnimation,
  ]);
  const loadItem = useCallback(
    async (id: number) => {
      try {
        return await dbGetItem(id);
      } catch {
        showError(t("toast.loadFailed"));
        return null;
      }
    },
    [showError, t],
  );

  const handleSelect = useCallback(
    async (item: ClipboardEntry) => {
      if (isPastingRef.current) return;
      isPastingRef.current = true;
      // When pinned (alwaysOnTop), always copy-only — window stays visible
      const autoPaste = settings.pasteMode === "auto" && !settings.alwaysOnTop;
      setPastingItemId(item.id);
      // Brief delay so the visual selection feedback renders before window hides for paste
      if (autoPaste) await new Promise((r) => setTimeout(r, 120));
      try {
        // Fetch full content — search results have truncated content/no html
        const fullItem = await loadItem(item.id);
        if (!fullItem) return;
        const result = await pasteItem(fullItem, autoPaste, settings.pasteFormat ?? "plain");
        // Bump last_used so the item moves to the top of the list
        touchItem(item.id);
        if (result?.status === "copied") {
          await showCopyFeedback();
        } else if (settings.alwaysOnTop) {
          // Pinned mode: window stays visible, show toast as feedback
          showInfo(t("toast.copied"));
        } else if (!autoPaste) {
          await hideWindow();
        }
      } catch {
        showError(t("toast.pasteFailed"));
      } finally {
        setPastingItemId(null);
        isPastingRef.current = false;
      }
    },
    [
      showError,
      showInfo,
      showCopyFeedback,
      touchItem,
      settings.pasteMode,
      settings.pasteFormat,
      settings.alwaysOnTop,
      loadItem,
      t,
    ],
  );

  const handleCopyToClipboard = useCallback(
    async (item: ClipboardEntry) => {
      try {
        const fullItem = await loadItem(item.id);
        if (!fullItem) return;
        await copyToClipboard(fullItem, settings.pasteFormat ?? "plain");
        touchItem(item.id);
        showInfo(t("toast.copied"));
      } catch {
        showError(t("toast.pasteFailed"));
      }
    },
    [touchItem, showInfo, showError, settings.pasteFormat, t, loadItem],
  );

  const handleDelete = useCallback(
    async (item: ClipboardEntry) => {
      const fullItem = await loadItem(item.id);
      if (!fullItem) return;
      // Snapshot the image BEFORE delete — db_delete_item also removes the
      // PNG from disk, so undo needs a source to restore from.
      let imageBase64: string | undefined;
      if (fullItem.content_type === "image" && fullItem.image_path) {
        try {
          imageBase64 = await readImageBase64(fullItem.image_path);
        } catch {
          // Without the bytes, this image cannot be restored after deletion.
        }
      }
      try {
        await removeItem(item.id);
      } catch {
        return; // error toast already shown by useDatabase.reportError
      }
      if (fullItem.content_type === "image" && !imageBase64) {
        showInfo(t("deleted"));
        return;
      }
      showInfo(t("deleted"), {
        label: t("undo"),
        onClick: () => restoreItem(fullItem, imageBase64).catch(() => {}),
      });
    },
    [removeItem, restoreItem, showInfo, t, loadItem],
  );

  const handleStar = useCallback(
    async (id: number, starred: boolean) => {
      try {
        await starItemDb(id, starred);
      } catch {
        return;
      }
      showInfo(starred ? t("toast.pinned") : t("toast.unpinned"));
    },
    [starItemDb, showInfo, t],
  );

  const handlePreview = useCallback(
    async (item: ClipboardEntry) => {
      // Toggle: Space opens preview, second Space on same item closes it
      if (previewItem?.id === item.id) {
        setPreviewItem(null);
      } else {
        // Fetch full content for preview (search results are truncated to 200 chars)
        const full = await loadItem(item.id);
        if (full) setPreviewItem(full);
      }
    },
    [setPreviewItem, previewItem, loadItem],
  );

  const handlePreviewNavigate = useCallback(
    async (item: ClipboardEntry) => {
      const full = await loadItem(item.id);
      if (full) setPreviewItem(full);
    },
    [setPreviewItem, loadItem],
  );

  const handleTransform = useCallback(
    async (item: ClipboardEntry) => {
      // Allow both text and image clips (vision prompts for images)
      // Toggle: Alt+T opens, second Alt+T on same item closes
      if (transformItem?.id === item.id) {
        setTransformItem(null);
      } else {
        // Always fetch full content — search results are truncated to 200 chars
        const full = await loadItem(item.id);
        if (full) setTransformItem(full);
      }
    },
    [setTransformItem, transformItem, loadItem],
  );

  const handleApplyTransform = useCallback(
    async (text: string, sourceItemId?: number) => {
      setTransformItem(null);
      const autoPaste = settings.pasteMode === "auto" && !settings.alwaysOnTop;
      try {
        const result = await pasteItem(textEntry(text), autoPaste);
        if (sourceItemId) touchItem(sourceItemId);
        addItem(text); // save transformed text to history
        if (result?.status === "copied") await showCopyFeedback();
        else showInfo(t(autoPaste ? "toast.pasted" : "toast.copied"));
      } catch {
        showError(t("toast.pasteFailed"));
      }
    },
    [
      setTransformItem,
      touchItem,
      addItem,
      showInfo,
      showCopyFeedback,
      showError,
      settings.pasteMode,
      settings.alwaysOnTop,
      t,
    ],
  );

  const handleItemContextMenu = useCallback(
    (x: number, y: number, item: ClipboardEntry) => {
      setContextMenu({ x, y, item });
    },
    [setContextMenu],
  );

  const handleShowInExplorer = useCallback(
    async (path: string) => {
      try {
        await showInExplorer(path);
      } catch {
        showError(t("toast.explorerFailed"));
      }
    },
    [showError, t],
  );

  const handleOcr = useCallback(
    async (item: ClipboardEntry) => {
      if (item.content_type !== "image" || !item.image_path) return;
      showInfo(t("toast.ocrStarted"));
      try {
        const text = await ocrImage(item.image_path);
        const trimmed = text.trim();
        if (trimmed) {
          addItem(trimmed);
          showInfo(t("toast.ocrSuccess"));
        } else {
          showInfo(t("toast.ocrEmpty"));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showError(t("toast.ocrFailed") + ": " + msg);
      }
    },
    [addItem, showInfo, showError, t],
  );

  return {
    pastingItemId,
    handleSelect,
    handleCopyToClipboard,
    handleDelete,
    handleStar,
    handlePreview,
    handlePreviewNavigate,
    handleTransform,
    handleApplyTransform,
    handleItemContextMenu,
    handleShowInExplorer,
    handleOcr,
  };
}
