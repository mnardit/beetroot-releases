import { useState, useCallback, useRef, useEffect, useMemo, type SetStateAction } from "react";
import { useDatabase } from "./useDatabase";
import { useClipboardMonitor } from "./useClipboardMonitor";
import { useWindowVisibility } from "./useWindowVisibility";
import { useKeyboardNav } from "./useKeyboardNav";
import { useUpdater } from "./useUpdater";
import { useSearchAndFilter } from "./useSearchAndFilter";
import { useAppIcons } from "./useAppIcons";
import { useOnboarding } from "./useOnboarding";
import { useClipboardActions } from "./useClipboardActions";
import { useBatchOperations } from "./useBatchOperations";
import { useWindowPosition } from "./useWindowPosition";
import { usePlainTextHotkey } from "./usePlainTextHotkey";
import { useBackgroundJobs } from "./useBackgroundJobs";
import type { JobCompletedPayload } from "./useBackgroundJobs";
import { copyToClipboard } from "../lib/paste";
import { dialogActive } from "../lib/dialogState";
import { listen } from "@tauri-apps/api/event";
import {
  CLOUD_PROVIDERS,
  type CloudProvider,
  loadSettings,
  saveSettings,
  FONT_SIZE_PX,
  resolveUIFontFamily,
  resolveCodeFontFamily,
  OVERLAY_DURATION_MS,
  type AppSettings,
} from "../lib/settings";
import { applyTheme } from "../lib/themes";
import {
  changeHotkey,
  checkRecoveryNotice,
  disableAutostart,
  enableAutostart,
  getOsBuild,
  getApiKeyStatus,
  isAutostartEnabled,
  isIsolatedBuild,
  setWindowMode,
  setWindowPosition,
  showCopyOverlay,
} from "../lib/tauri";
import { useToast } from "./useToast";
import { createLogger } from "../lib/log";
import { createTranslator, loadLanguage, type TranslationDictionary } from "../lib/i18n";
import { TYPE_FILTER_VALUES, type TypeFilter } from "../types/clipboard";
import type { ClipboardEntry } from "../types/clipboard";

import type { AIConfig } from "../lib/openai";
import { migrateSecretsFromLocalStorage } from "../lib/secrets-migration";

const log = createLogger("app");
const LAST_FILTER_KEY = "beetroot_last_type_filter";

export function useAppState() {
  const [selState, setSelState] = useState({ index: 0, resetKey: "" });
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [keyStatuses, setKeyStatuses] = useState<Record<CloudProvider, boolean>>({
    openai: false,
    gemini: false,
    anthropic: false,
    deepseek: false,
  });
  const [keysReady, setKeysReady] = useState(false);
  const [keysError, setKeysError] = useState(false);
  const [keyRetry, setKeyRetry] = useState(0);
  const retryKeyMigration = useCallback(() => setKeyRetry((n) => n + 1), []);
  const refreshKeyStatuses = useCallback(async () => {
    const statuses = await Promise.all(CLOUD_PROVIDERS.map(getApiKeyStatus));
    setKeyStatuses(
      Object.fromEntries(
        CLOUD_PROVIDERS.map((provider, index) => [provider, statuses[index]]),
      ) as Record<CloudProvider, boolean>,
    );
  }, []);
  const aiConfig: AIConfig = useMemo(
    () => ({
      provider: settings.aiProvider,
      hasKey: keyStatuses,
      openaiModel: settings.openaiModel,
      geminiModel: settings.geminiModel,
      anthropicModel: settings.anthropicModel,
      deepseekModel: settings.deepseekModel,
      localEndpoint: settings.localEndpoint,
      localModel: settings.localModel,
    }),
    [
      settings.aiProvider,
      settings.openaiModel,
      settings.geminiModel,
      settings.anthropicModel,
      settings.deepseekModel,
      settings.localEndpoint,
      settings.localModel,
      keyStatuses,
    ],
  );
  const [monitorPaused, setMonitorPaused] = useState(false);
  const [isNoFocus, setIsNoFocus] = useState(false);
  const [newItemId, setNewItemId] = useState<number | null>(null);
  const prevItemsRef = useRef<ClipboardEntry[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastInputRef = useRef<"keyboard" | "mouse">("mouse");
  const { showError, showInfo } = useToast();
  const {
    refreshKey,
    bump,
    addItem,
    addImageItem,
    removeItem,
    batchRemoveItems,
    restoreItem,
    restoreBatchItems,
    starItem,
    touchItem,
    updateNote,
  } = useDatabase(settings.maxHistorySize, showError, settings.autoDeleteDays);

  // --- Sub-hooks ---

  const search = useSearchAndFilter(settings.maxHistorySize, refreshKey);
  const {
    query,
    setQuery,
    searchMode,
    setSearchMode,
    typeFilter,
    setTypeFilter,
    appFilter,
    setAppFilter,
    appCounts,
    appLastUsed,
    filtered,
    matchMap,
    titleMatchMap,
    noteMatchMap,
    filterCounts,
    hasImages,
    hasNotes,
    regexError,
  } = search;

  const appIcons = useAppIcons(filtered);

  // --- Overlay state (inlined from useOverlays) ---
  const [showSettings, setShowSettings] = useState(false);
  const [previewItem, setPreviewItem] = useState<ClipboardEntry | null>(null);
  const [transformItem, setTransformItem] = useState<ClipboardEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: ClipboardEntry;
  } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { shouldShow: showOnboarding, markDone: markOnboardingDone } = useOnboarding();
  const [onboardingVisible, setOnboardingVisible] = useState(showOnboarding);
  const hasActiveOverlayRef = useRef(false);
  const isPreviewOpenRef = useRef(false);
  const isNoFocusRef = useRef(false);
  isNoFocusRef.current = isNoFocus;

  useEffect(() => {
    hasActiveOverlayRef.current = !!(
      previewItem ||
      transformItem ||
      showShortcuts ||
      contextMenu ||
      onboardingVisible ||
      showSettings
    );
  }, [previewItem, transformItem, showShortcuts, contextMenu, onboardingVisible, showSettings]);

  useEffect(() => {
    isPreviewOpenRef.current = !!previewItem;
  }, [previewItem]);

  useEffect(() => {
    const unlisten = listen("open-settings", () => {
      setTimeout(() => setShowSettings(true), 100);
    }).catch((e) => {
      log.warn("failed to listen for open-settings", e);
      return null;
    });
    return () => {
      unlisten.then((fn) => fn?.()).catch((e) => log.warn("failed to unlisten open-settings", e));
    };
  }, []);

  const [langDict, setLangDict] = useState<TranslationDictionary | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLanguage(settings.language).then((dict) => {
      if (!cancelled) setLangDict(dict);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.language]);

  const t = useMemo(
    () => createTranslator(settings.language, langDict ?? undefined),
    [settings.language, langDict],
  );

  // Listen for runtime corruption detection from Rust
  useEffect(() => {
    const unlisten = listen("db-corruption-detected", () => {
      showError(t("notification.dbCorrupted"));
    }).catch((e) => {
      log.warn("failed to listen for db-corruption-detected", e);
      return null;
    });
    return () => {
      unlisten
        .then((fn) => fn?.())
        .catch((e) => log.warn("failed to unlisten db-corruption-detected", e));
    };
  }, [showError, t]);

  // Listen for no-focus mode changes from Rust
  useEffect(() => {
    const unlisten = listen<boolean>("no-focus-changed", ({ payload }) => {
      setIsNoFocus(payload);
      // When entering no-focus mode (window just shown), reset overlays.
      // tauri://focus doesn't fire in no-focus mode, so the onShow callback
      // doesn't run — we handle overlay reset here instead.
      if (payload) {
        setQuery("");
        setSelectedIndex(0);
        setPreviewItem(null);
        setTransformItem(null);
        setContextMenu(null);
        setShowShortcuts(false);
        if (!loadSettings().rememberTypeFilter) {
          setTypeFilter("all");
        }
        setAppFilter(null);
        batch.setMultiSelected(new Set());
      }
    }).catch((e) => {
      log.warn("failed to listen for no-focus-changed", e);
      return null;
    });
    return () => {
      unlisten
        .then((fn) => fn?.())
        .catch((e) => log.warn("failed to unlisten no-focus-changed", e));
    };
    // One-shot listener registration on mount. Listed setters are either stable
    // useState setters or stable useCallbacks; adding `setSelectedIndex` would
    // cause the listener to re-register every time the user types (its deps
    // include `selResetKey`), losing in-flight events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync search focus with window mode:
  // - No-focus mode → blur (no cursor blink, user can't type)
  // - Pinned mode → focus (user expects to type immediately)
  // Handles mode switches while window is visible (Alt+P toggle).
  useEffect(() => {
    if (isNoFocus) {
      searchRef.current?.blur();
    } else if (settings.windowMode === "pinned") {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isNoFocus, settings.windowMode]);

  // One-time check for DB recovery notice on mount
  useEffect(() => {
    checkRecoveryNotice()
      .then((msg) => {
        if (!msg) return;
        if (msg.includes("restored from backup")) {
          showError(t("notification.dbRestored"));
        } else {
          showError(t("notification.dbFreshCreated"));
        }
      })
      .catch((e) => log.warn("failed to check recovery notice", e));
  }, [showError, t]);

  const actions = useClipboardActions({
    settings,
    addItem,
    removeItem,
    restoreItem,
    starItem,
    touchItem,
    setPreviewItem,
    setTransformItem,
    previewItem,
    transformItem,
    setContextMenu,
    showError,
    showInfo,
    t,
  });

  const bgJobs = useBackgroundJobs({
    showInfo,
    showError,
    t,
    onJobCompleted: useCallback(
      (payload: JobCompletedPayload) => {
        if (payload.source === "user") {
          copyToClipboard({
            content: payload.result,
            content_type: "text",
          } as ClipboardEntry).catch(() => {});
        }
        bump();
      },
      [bump],
    ),
  });

  const batch = useBatchOperations({
    filtered,
    batchRemoveItems,
    restoreBatchItems,
    showInfo,
    showError,
    t,
  });

  // --- Updater ---

  const updater = useUpdater(settings.autoUpdateEnabled);

  // --- Window position persistence ---

  useWindowPosition(settings.windowMode ?? "normal", settings.windowPosition);
  usePlainTextHotkey(settings);

  // --- Settings effects ---

  // Credential migration must finish before any startup path can save settings.
  useEffect(() => {
    let cancelled = false;
    const persist = (updated: AppSettings) => {
      settingsRef.current = updated;
      setSettings(updated);
      if (!saveSettings(updated)) showError(t("toast.settingsSaveFailed"));
    };
    (async () => {
      try {
        await migrateSecretsFromLocalStorage();
        if (cancelled) return;
        await refreshKeyStatuses();
        if (cancelled) return;
        setKeysError(false);
        setKeysReady(true);
      } catch {
        if (!cancelled) {
          setKeysError(true);
          setKeysReady(false);
        }
        return;
      }
      try {
        const build = await getOsBuild();
        if (cancelled) return;
        const current = settingsRef.current;
        if (build > 0 && build < 22000 && current.windowEffect === "mica") {
          persist({ ...current, windowEffect: "acrylic" });
        }
      } catch (e) {
        log.warn("failed to check Windows build", e);
      }
      try {
        if (cancelled || (await isIsolatedBuild())) return;
        const osEnabled = await isAutostartEnabled();
        if (cancelled) return;
        const desired = settingsRef.current.autostart;
        if (desired) {
          try {
            await enableAutostart();
          } catch (e) {
            log.warn("autostart enable failed", e);
            if (!cancelled && !osEnabled && settingsRef.current.autostart) {
              persist({ ...settingsRef.current, autostart: false });
            }
          }
        } else if (osEnabled) {
          await disableAutostart();
        }
      } catch (e) {
        log.warn("autostart reconciliation failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Retry is explicit; language/settings edits must not restart migration or OS reconciliation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyRetry, refreshKeyStatuses]);

  useEffect(() => {
    applyTheme(settings.theme, settings.accentColor, settings.windowEffect);
    if (settings.theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme("auto", settings.accentColor, settings.windowEffect);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [settings.theme, settings.accentColor, settings.windowEffect]);

  useEffect(() => {
    const px = FONT_SIZE_PX[settings.fontSize] ?? FONT_SIZE_PX.default;
    document.documentElement.style.setProperty("--font-size", `${px}px`);
  }, [settings.fontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-ui", resolveUIFontFamily(settings.uiFont));
  }, [settings.uiFont]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-code",
      resolveCodeFontFamily(settings.codeFont),
    );
  }, [settings.codeFont]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    setWindowMode(settings.windowMode ?? "normal").catch((e) =>
      log.warn("failed to set window mode", e),
    );
  }, [settings.windowMode]);

  useEffect(() => {
    setWindowPosition(settings.windowPosition ?? "center").catch((e) =>
      log.warn("failed to set window position", e),
    );
  }, [settings.windowPosition]);

  // Register saved hotkey on startup (Rust defaults to Ctrl+Backquote)
  useEffect(() => {
    if (settings.hotkey && settings.hotkey !== "Ctrl+Backquote") {
      changeHotkey(settings.hotkey).catch((e) =>
        log.warn("failed to register saved hotkey on startup", e),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Selection & new-item tracking ---

  // Derive selectedIndex: auto-resets to 0 when query or item count changes.
  const selResetKey = `${query}|${filtered.length}|${filtered[0]?.id ?? 0}`;
  const selectedIndex = selState.resetKey === selResetKey ? selState.index : 0;
  const setSelectedIndex = useCallback(
    (action: SetStateAction<number>) => {
      setSelState((prev) => {
        const index =
          typeof action === "function"
            ? action(prev.resetKey === selResetKey ? prev.index : 0)
            : action;
        return { index, resetKey: selResetKey };
      });
    },
    [selResetKey],
  );

  useEffect(() => {
    const prev = prevItemsRef.current;
    prevItemsRef.current = filtered;
    if (prev.length > 0 && filtered.length > prev.length) {
      const prevIds = new Set(prev.map((i) => i.id));
      const added = filtered.find((i) => !prevIds.has(i.id));
      if (added) {
        setNewItemId(added.id);
        const timer = setTimeout(() => setNewItemId(null), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [filtered]);

  // --- Clipboard monitor ---

  const handleNewClip = useCallback(
    (
      text: string,
      html?: string,
      sourceApp?: string,
      sourceTitle?: string,
      isCurrent?: () => boolean,
    ) => {
      addItem(text, html, sourceApp, sourceTitle, isCurrent);
      if (settings.showCopiedOverlay) {
        showCopyOverlay(
          t("overlay.copied"),
          settings.overlayPosition,
          OVERLAY_DURATION_MS[settings.overlayDuration],
          settings.overlayAnimation,
        ).catch(() => {});
      }
    },
    [
      addItem,
      settings.showCopiedOverlay,
      settings.overlayPosition,
      settings.overlayDuration,
      settings.overlayAnimation,
      t,
    ],
  );

  const handleNewImage = useCallback(
    (base64: string, sourceApp?: string, sourceTitle?: string, isCurrent?: () => boolean) => {
      addImageItem(base64, sourceApp, sourceTitle, isCurrent);
      if (settings.showCopiedOverlay) {
        showCopyOverlay(
          t("overlay.imageCopied"),
          settings.overlayPosition,
          OVERLAY_DURATION_MS[settings.overlayDuration],
          settings.overlayAnimation,
        ).catch(() => {});
      }
    },
    [
      addImageItem,
      settings.showCopiedOverlay,
      settings.overlayPosition,
      settings.overlayDuration,
      settings.overlayAnimation,
      t,
    ],
  );

  useClipboardMonitor(handleNewClip, handleNewImage, monitorPaused, (key) => showInfo(t(key)));

  // --- Window visibility reset ---

  useWindowVisibility(
    () => {
      if (dialogActive || showSettings) return;
      setQuery("");
      setSelectedIndex(0);
      setShowSettings(false);
      if (settings.rememberTypeFilter) {
        const saved = localStorage.getItem(LAST_FILTER_KEY);
        if (saved && TYPE_FILTER_VALUES.includes(saved as TypeFilter)) {
          setTypeFilter(saved as TypeFilter);
        }
      } else {
        setTypeFilter("all");
      }
      setAppFilter(null);
      batch.setMultiSelected(new Set());
      setContextMenu(null);
      setShowShortcuts(false);
      // Only auto-focus search in pinned mode. In normal/follow-cursor (no-focus),
      // the cursor shouldn't blink — user needs to click search to activate.
      if (settings.windowMode === "pinned") {
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    },
    { suppressHideOnBlur: showSettings || settings.windowMode === "pinned" || isNoFocus },
  );

  // Persist typeFilter for "remember filter" setting
  useEffect(() => {
    if (settings.rememberTypeFilter) {
      localStorage.setItem(LAST_FILTER_KEY, typeFilter);
    } else {
      localStorage.removeItem(LAST_FILTER_KEY);
    }
  }, [typeFilter, settings.rememberTypeFilter]);

  // --- Save settings ---

  const handleSaveSettings = useCallback(
    (newSettings: AppSettings) => {
      const ok = saveSettings(newSettings);
      if (!ok) {
        showError(t("toast.settingsSaveFailed"));
        return false;
      }
      setSettings(newSettings);
      setShowSettings(false);
      return true;
    },
    [setShowSettings, showError, t],
  );

  const handleTogglePin = useCallback(() => {
    setSettings((prev) => {
      const nextMode = prev.windowMode === "pinned" ? "normal" : "pinned";
      const next = {
        ...prev,
        windowMode: nextMode as AppSettings["windowMode"],
        alwaysOnTop: nextMode === "pinned",
      };
      if (!saveSettings(next)) {
        showError(t("toast.settingsSaveFailed"));
      }
      return next;
    });
  }, [showError, t]);

  const handleToggleFollowCursor = useCallback(() => {
    setSettings((prev) => {
      const nextMode = prev.windowMode === "follow-cursor" ? "normal" : "follow-cursor";
      const next = {
        ...prev,
        windowMode: nextMode as AppSettings["windowMode"],
        alwaysOnTop: false,
      };
      if (!saveSettings(next)) {
        showError(t("toast.settingsSaveFailed"));
      }
      return next;
    });
  }, [showError, t]);

  // --- Input tracking (keyboard vs mouse) ---

  useEffect(() => {
    function handleMouseMove() {
      lastInputRef.current = "mouse";
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleHover = useCallback(
    (index: number) => {
      if (lastInputRef.current === "keyboard") return;
      setSelectedIndex(index);
    },
    [setSelectedIndex],
  );

  // --- Keyboard navigation ---

  useKeyboardNav({
    items: filtered,
    selectedIndex,
    setSelectedIndex,
    onSelect: actions.handleSelect,
    onDelete: actions.handleDelete,
    onStar: actions.handleStar,
    onPreview: actions.handlePreview,
    onTransform: actions.handleTransform,
    onCopy: actions.handleCopyToClipboard,
    onItemContextMenu: actions.handleItemContextMenu,
    onToggleMultiSelect: batch.handleToggleMultiSelect,
    onTogglePinWindow: handleTogglePin,
    onToggleFollowCursor: handleToggleFollowCursor,
    shortcutPinWindow: settings.shortcutPinWindow,
    shortcutFollowCursor: settings.shortcutFollowCursor,
    lastInputRef,
    hasActiveOverlayRef,
    isPreviewOpenRef,
    onPreviewNavigate: actions.handlePreviewNavigate,
    isNoFocusRef,
  });

  return {
    // Search
    query,
    setQuery,
    searchRef,
    searchMode,
    setSearchMode,
    regexError,

    // Items & filtering
    loading: false as const,
    filtered,
    matchMap,
    titleMatchMap,
    noteMatchMap,
    hasImages,
    hasNotes,
    typeFilter,
    setTypeFilter,
    filterCounts,
    appIcons,
    appFilter,
    setAppFilter,
    appCounts,
    appLastUsed,
    selectedIndex,
    setSelectedIndex,

    // Overlays
    showSettings,
    setShowSettings,
    previewItem,
    setPreviewItem,
    transformItem,
    setTransformItem,
    contextMenu,
    setContextMenu,
    showShortcuts,
    setShowShortcuts,
    onboardingVisible,
    setOnboardingVisible,
    markOnboardingDone,

    // Item state
    newItemId,
    pastingItemId: actions.pastingItemId,
    multiSelected: batch.multiSelected,
    setMultiSelected: batch.setMultiSelected,
    monitorPaused,
    setMonitorPaused,
    isNoFocus,

    // Settings
    aiConfig,
    keyStatuses,
    keysReady,
    keysError,
    refreshKeyStatuses,
    retryKeyMigration,
    settings,
    handleSaveSettings,

    // Callbacks
    handleSelect: actions.handleSelect,
    handleCopyToClipboard: actions.handleCopyToClipboard,
    handleDelete: actions.handleDelete,
    handleStar: actions.handleStar,
    handlePreview: actions.handlePreview,
    handleTransform: actions.handleTransform,
    handleApplyTransform: actions.handleApplyTransform,
    submitJob: bgJobs.submitJob,
    handleItemContextMenu: actions.handleItemContextMenu,
    handleShowInExplorer: actions.handleShowInExplorer,
    handleOcr: actions.handleOcr,
    handleUpdateNote: updateNote,
    handleToggleMultiSelect: batch.handleToggleMultiSelect,
    handleBatchDelete: batch.handleBatchDelete,
    handleBatchCopy: batch.handleBatchCopy,
    handleHover,
    handleTogglePin,
    handleToggleFollowCursor,

    // i18n & toast
    t,
    showError,

    // Updater
    updater,
  };
}
