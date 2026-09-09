import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ClipboardEntry } from "../../types/clipboard";
import type { AppSettings } from "../../lib/settings";
import {
  enableAutostart,
  disableAutostart,
  isAutostartEnabled,
  isIsolatedBuild,
  getApiKeyStatus,
  getOsBuild,
} from "../../lib/tauri";

import { migrateSecretsFromLocalStorage } from "../../lib/secrets-migration";
vi.mock("../../lib/secrets-migration", () => ({
  migrateSecretsFromLocalStorage: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock setup ---

function makeEntry(
  id: number,
  content = `item-${id}`,
  type: "text" | "image" = "text",
): ClipboardEntry {
  return {
    id,
    content,
    content_hash: `hash-${id}`,
    content_type: type,
    image_path: type === "image" ? `/images/${id}.png` : null,
    html_content: null,
    note: null,
    starred: false,
    created_at: "2024-01-01",
    last_used: "2024-01-01",
    source_app: null,
    source_title: null,
  };
}

const defaultSettings: AppSettings = {
  maxHistorySize: 500,
  hotkey: "Ctrl+Backquote",
  plainTextHotkey: "",
  autostart: false,
  autoUpdateEnabled: true,
  theme: "beetroot-dark",
  autoDeleteDays: 0,
  language: "en",
  pasteMode: "auto",
  pasteFormat: "plain",
  accentColor: "",
  fontSize: "default",
  uiFont: "system",
  codeFont: "consolas",
  windowEffect: "mica",
  aiProvider: "openai",

  openaiModel: "gpt-5.4-nano",

  geminiModel: "gemini-2.5-flash-lite",

  anthropicModel: "claude-haiku-4-5",

  deepseekModel: "deepseek-chat",
  localEndpoint: "http://127.0.0.1:1234",
  localModel: "",
  customAIPrompts: [],
  alwaysOnTop: false,
  windowMode: "normal" as const,
  windowPosition: "center" as const,
  shortcutPinWindow: "Alt+KeyP",
  shortcutFollowCursor: "Alt+KeyF",
  rememberTypeFilter: false,
  showCopiedOverlay: true,
  overlayPosition: "cursor",
  overlayDuration: "comfortable",
  overlayAnimation: "fade-down",
};

// Mock dependencies BEFORE importing useAppState

const mockAddItem = vi.fn();
const mockAddImageItem = vi.fn();
const mockRemoveItem = vi.fn().mockResolvedValue(null);
const mockBatchRemoveItems = vi.fn().mockResolvedValue(undefined);
const mockRestoreItem = vi.fn().mockResolvedValue(undefined);
const mockRestoreBatchItems = vi.fn().mockResolvedValue(undefined);
const mockPinItem = vi.fn().mockResolvedValue(undefined);
const mockTouchItem = vi.fn().mockResolvedValue(undefined);
const mockUpdateNote = vi.fn().mockResolvedValue(undefined);
let mockItems: ClipboardEntry[] = [];
let mockRefreshKey = 0;

const mockBump = vi.fn();
vi.mock("../useDatabase", () => ({
  useDatabase: () => ({
    refreshKey: mockRefreshKey,
    bump: mockBump,
    addItem: mockAddItem,
    addImageItem: mockAddImageItem,
    removeItem: mockRemoveItem,
    batchRemoveItems: mockBatchRemoveItems,
    restoreItem: mockRestoreItem,
    restoreBatchItems: mockRestoreBatchItems,
    starItem: mockPinItem,
    touchItem: mockTouchItem,
    updateNote: mockUpdateNote,
  }),
}));

// Mock useSearchAndFilter since it now does IPC calls.
// The mock returns mockItems as filtered results and computes
// filterCounts/hasImages/hasNotes from them.
const mockSearchQuery = { value: "" };
const mockSearchMode = { value: "fuzzy" as string };
const mockTypeFilter = { value: "all" as string };
const mockRegexError = { value: null as string | null };

vi.mock("../useSearchAndFilter", () => ({
  useSearchAndFilter: () => ({
    query: mockSearchQuery.value,
    setQuery: (v: string) => {
      mockSearchQuery.value = v;
    },
    searchMode: mockSearchMode.value,
    setSearchMode: (v: string) => {
      mockSearchMode.value = v;
    },
    typeFilter: mockTypeFilter.value,
    setTypeFilter: (v: string) => {
      mockTypeFilter.value = v;
    },
    appFilter: null,
    setAppFilter: vi.fn(),
    appCounts: {},
    appLastUsed: {},
    filtered: mockItems,
    matchMap: new Map(),
    titleMatchMap: new Map(),
    noteMatchMap: new Map(),
    filterCounts: {
      all: mockItems.length,
      starred: mockItems.filter((i: ClipboardEntry) => i.starred).length,
      text: mockItems.filter((i: ClipboardEntry) => i.content_type === "text").length,
      image: mockItems.filter((i: ClipboardEntry) => i.content_type === "image").length,
      notes: mockItems.filter((i: ClipboardEntry) => i.note && i.note.trim() !== "").length,
    },
    hasImages: mockItems.some((i: ClipboardEntry) => i.content_type === "image"),
    hasNotes: mockItems.some((i: ClipboardEntry) => i.note && i.note.trim() !== ""),
    regexError: mockRegexError.value,
    refresh: vi.fn(),
  }),
}));

vi.mock("../useClipboardMonitor", () => ({
  useClipboardMonitor: vi.fn(),
}));

vi.mock("../useWindowVisibility", () => ({
  useWindowVisibility: vi.fn(),
}));

vi.mock("../useKeyboardNav", () => ({
  useKeyboardNav: vi.fn(),
}));

const mockMarkDone = vi.fn();
vi.mock("../useOnboarding", () => ({
  useOnboarding: () => ({
    shouldShow: false,
    markDone: mockMarkDone,
  }),
}));

vi.mock("../usePlainTextHotkey", () => ({
  usePlainTextHotkey: vi.fn(),
}));

const mockSubmitJob = vi.fn().mockResolvedValue(1);
vi.mock("../useBackgroundJobs", () => ({
  useBackgroundJobs: () => ({
    submitJob: mockSubmitJob,
    cancelJob: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("../useUpdater", () => ({
  useUpdater: () => ({
    status: { state: "idle" },
    checkForUpdates: vi.fn(),
    downloadAndInstall: vi.fn(),
    restartApp: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

const mockSaveSettings = vi.fn((_s: AppSettings) => true);
let mockLoadSettingsOverride: Partial<AppSettings> | null = null;
vi.mock("../../lib/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/settings")>()),
  loadSettings: vi.fn(() => ({ ...defaultSettings, ...mockLoadSettingsOverride })),
  saveSettings: (s: AppSettings) => mockSaveSettings(s),
  FONT_SIZE_PX: { compact: 11, small: 12, default: 13, large: 14, larger: 16, largest: 18 },
  resolveUIFontFamily: (v: string) =>
    v === "system" ? '"Segoe UI", -apple-system, sans-serif' : "sans-serif",
  resolveCodeFontFamily: (v: string) => (v === "consolas" ? '"Consolas", monospace' : "monospace"),
}));

const mockPasteItem = vi.fn().mockResolvedValue(undefined);
const mockCopyToClipboard = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/paste", () => ({
  pasteItem: (...args: unknown[]) => mockPasteItem(...args),
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

const mockApplyTheme = vi.fn();
vi.mock("../../lib/themes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/themes")>()),
  applyTheme: (...args: unknown[]) => mockApplyTheme(...args),
}));

const mockShowInExplorer = vi.fn().mockResolvedValue(undefined);
const mockOcrImage = vi.fn().mockResolvedValue("OCR result text");
const mockCheckRecoveryNotice = vi.fn().mockResolvedValue(null);
vi.mock("../../lib/tauri", () => ({
  showInExplorer: (...args: unknown[]) => mockShowInExplorer(...args),
  ocrImage: (...args: unknown[]) => mockOcrImage(...args),
  checkRecoveryNotice: () => mockCheckRecoveryNotice(),
  changeHotkey: vi.fn().mockResolvedValue(undefined),
  enableAutostart: vi.fn().mockResolvedValue(undefined),
  disableAutostart: vi.fn().mockResolvedValue(undefined),
  isAutostartEnabled: vi.fn().mockResolvedValue(false),
  isIsolatedBuild: vi.fn().mockResolvedValue(false),
  setWindowMode: vi.fn().mockResolvedValue(undefined),
  setWindowPosition: vi.fn().mockResolvedValue(undefined),
  getApiKeyStatus: vi.fn().mockResolvedValue(false),
  getOsBuild: vi.fn().mockResolvedValue(22631),
  getAppIcon: vi.fn().mockResolvedValue({ exe_name: "", display_name: "", icon_base64: null }),
  getAllAppIcons: vi.fn().mockResolvedValue([]),
  hideWindow: vi.fn().mockResolvedValue(undefined),
  activateWindow: vi.fn().mockResolvedValue(undefined),
  dbGetItem: vi.fn().mockImplementation((id: number) => {
    const item = mockItems.find((i: { id: number }) => i.id === id);
    return Promise.resolve(item ?? mockItems[0]);
  }),
}));

// Mock Toast context
const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
vi.mock("../useToast", () => ({
  useToast: () => ({
    showError: mockShowError,
    showInfo: mockShowInfo,
  }),
}));

// Now import the hook under test
import { useAppState } from "../useAppState";

describe("useAppState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(migrateSecretsFromLocalStorage).mockReset().mockResolvedValue(undefined);
    vi.mocked(getApiKeyStatus).mockReset().mockResolvedValue(false);
    vi.mocked(getOsBuild).mockReset().mockResolvedValue(22631);
    vi.mocked(isIsolatedBuild).mockResolvedValue(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockItems = [];
    mockRefreshKey = 0;
    mockSearchQuery.value = "";
    mockSearchMode.value = "fuzzy";
    mockTypeFilter.value = "all";
    mockRegexError.value = null;
    mockLoadSettingsOverride = null;
    // Reset DOM state
    document.documentElement.lang = "";
    document.documentElement.style.cssText = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("credential bootstrap", () => {
    it("waits for migration and statuses before the Win10 settings save", async () => {
      let migrate!: () => void;
      let status!: (value: boolean) => void;
      vi.mocked(migrateSecretsFromLocalStorage).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            migrate = resolve;
          }),
      );
      vi.mocked(getApiKeyStatus).mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            status = resolve;
          }),
      );
      vi.mocked(getOsBuild).mockResolvedValue(19045);
      const { result } = renderHook(() => useAppState());
      await act(async () => {});
      expect(getApiKeyStatus).not.toHaveBeenCalled();
      expect(getOsBuild).not.toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
      await act(async () => {
        migrate();
      });
      expect(getApiKeyStatus).toHaveBeenCalledTimes(4);
      expect(getOsBuild).not.toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
      await act(async () => {
        status(true);
      });
      expect(result.current.keysReady).toBe(true);
      expect(result.current.aiConfig.hasKey.openai).toBe(true);
      expect(result.current.settings.windowEffect).toBe("acrylic");
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ windowEffect: "acrylic" }),
      );
    });

    it("keeps startup saves blocked after migration failure and supports explicit retry", async () => {
      vi.mocked(migrateSecretsFromLocalStorage).mockRejectedValueOnce("Vault unavailable");
      const { result } = renderHook(() => useAppState());
      await act(async () => {});
      expect(result.current.keysReady).toBe(false);
      expect(result.current.keysError).toBe(true);
      expect(getApiKeyStatus).not.toHaveBeenCalled();
      expect(getOsBuild).not.toHaveBeenCalled();
      expect(isAutostartEnabled).not.toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
      await act(async () => {
        result.current.retryKeyMigration();
      });
      expect(result.current.keysReady).toBe(true);
      expect(result.current.keysError).toBe(false);
      expect(migrateSecretsFromLocalStorage).toHaveBeenCalledTimes(2);
      expect(getApiKeyStatus).toHaveBeenCalledTimes(4);
    });

    it("does not report missing keys or save settings when status lookup fails", async () => {
      vi.mocked(getApiKeyStatus).mockRejectedValueOnce("Vault unavailable");
      const { result } = renderHook(() => useAppState());
      await act(async () => {});
      expect(result.current.keysReady).toBe(false);
      expect(result.current.keysError).toBe(true);
      expect(getOsBuild).not.toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
    });

    it("does not continue startup saves after unmount during migration", async () => {
      let finish!: () => void;
      vi.mocked(migrateSecretsFromLocalStorage).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      const { unmount } = renderHook(() => useAppState());
      unmount();
      await act(async () => {
        finish();
      });
      expect(getApiKeyStatus).not.toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
    });
  });

  // --- Initialization ---

  describe("initialization", () => {
    it("never reconciles installed autostart in an isolated build", async () => {
      vi.mocked(isIsolatedBuild).mockResolvedValue(true);
      mockLoadSettingsOverride = { autostart: true };
      renderHook(() => useAppState());
      await act(async () => {
        await Promise.resolve();
      });
      expect(isAutostartEnabled).not.toHaveBeenCalled();
      expect(enableAutostart).not.toHaveBeenCalled();
      expect(disableAutostart).not.toHaveBeenCalled();
    });
    it("returns default state values", () => {
      const { result } = renderHook(() => useAppState());

      expect(result.current.query).toBe("");
      expect(result.current.selectedIndex).toBe(0);
      expect(result.current.showSettings).toBe(false);
      expect(result.current.searchMode).toBe("fuzzy");
      expect(result.current.typeFilter).toBe("all");
      expect(result.current.monitorPaused).toBe(false);
      expect(result.current.previewItem).toBeNull();
      expect(result.current.transformItem).toBeNull();
      expect(result.current.contextMenu).toBeNull();
      expect(result.current.showShortcuts).toBe(false);
      expect(result.current.multiSelected.size).toBe(0);
      expect(result.current.newItemId).toBeNull();
      expect(result.current.pastingItemId).toBeNull();
    });

    it("loads settings from loadSettings()", () => {
      const { result } = renderHook(() => useAppState());

      expect(result.current.settings.theme).toBe("beetroot-dark");
      expect(result.current.settings.language).toBe("en");
      expect(result.current.settings.maxHistorySize).toBe(500);
      expect(result.current.settings.pasteFormat).toBe("plain");
    });

    it("reports loading as false when database is ready", () => {
      const { result } = renderHook(() => useAppState());
      expect(result.current.loading).toBe(false);
    });

    it("provides a translator function for the configured language", () => {
      const { result } = renderHook(() => useAppState());
      expect(typeof result.current.t).toBe("function");
    });

    it("reconciles autostart with OS state on startup: OS off + saved on → saved becomes off", async () => {
      // Seed settings with autostart=true
      mockLoadSettingsOverride = { autostart: true };

      // OS reports autostart as disabled; enable throws (e.g. MSIX disabled_by_user)
      vi.mocked(enableAutostart).mockRejectedValueOnce(new Error("disabled_by_user"));

      renderHook(() => useAppState());

      await vi.waitFor(() => {
        expect(mockSaveSettings).toHaveBeenCalledWith(
          expect.objectContaining({ autostart: false }),
        );
      });
    });
  });

  // --- Derived state ---

  describe("derived state", () => {
    it("returns all items when no query and typeFilter=all", async () => {
      mockItems = [makeEntry(1), makeEntry(2), makeEntry(3)];
      const { result } = renderHook(() => useAppState());

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.filtered).toHaveLength(3);
    });

    // Note: type/search filtering and regexError are tested in
    // useSearchAndFilter.test.ts (IPC-level) and Rust search tests.
    // These tests verify the useAppState wiring passes values through.

    it("sets hasImages from search hook", async () => {
      mockItems = [makeEntry(1, "text", "text"), makeEntry(2, "img", "image")];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.hasImages).toBe(true);
    });

    it("sets hasImages to false when no image items", async () => {
      mockItems = [makeEntry(1), makeEntry(2)];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.hasImages).toBe(false);
    });

    it("empty items list returns empty filtered", async () => {
      mockItems = [];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.filtered).toHaveLength(0);
      expect(result.current.hasImages).toBe(false);
    });
  });

  // --- Effects ---

  describe("effects", () => {
    it("applies theme on mount", () => {
      renderHook(() => useAppState());
      expect(mockApplyTheme).toHaveBeenCalledWith("beetroot-dark", "", "mica");
    });

    it("sets font size CSS variable on mount", () => {
      renderHook(() => useAppState());
      const fontSize = document.documentElement.style.getPropertyValue("--font-size");
      expect(fontSize).toBe("13px");
    });

    it("sets document language on mount", () => {
      renderHook(() => useAppState());
      expect(document.documentElement.lang).toBe("en");
    });

    it("resets selectedIndex when filtered changes", async () => {
      mockItems = [makeEntry(1), makeEntry(2), makeEntry(3)];
      const { result, rerender } = renderHook(() => useAppState());

      // Manually set selectedIndex via the setter
      act(() => {
        result.current.setSelectedIndex(2);
      });

      expect(result.current.selectedIndex).toBe(2);

      // Change the underlying items to trigger reset
      mockItems = [makeEntry(1)];
      rerender();

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  // --- Callbacks ---

  describe("handleSelect", () => {
    it("calls pasteItem with the selected item", async () => {
      mockItems = [makeEntry(1)];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleSelect(mockItems[0]);
        vi.advanceTimersByTime(150);
      });

      expect(mockPasteItem).toHaveBeenCalledWith(
        mockItems[0],
        true, // autoPaste (pasteMode="auto")
        "plain", // pasteFormat
      );
    });

    it("calls touchItem after successful paste to bump last_used", async () => {
      mockItems = [makeEntry(1)];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleSelect(mockItems[0]);
        vi.advanceTimersByTime(150);
      });

      expect(mockTouchItem).toHaveBeenCalledWith(1);
    });

    it("shows error toast when paste fails", async () => {
      mockPasteItem.mockRejectedValueOnce(new Error("paste failed"));
      mockItems = [makeEntry(1)];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleSelect(mockItems[0]);
        vi.advanceTimersByTime(150);
      });

      expect(mockShowError).toHaveBeenCalled();
    });
  });

  describe("handleDelete", () => {
    it("calls removeItem with the item id", async () => {
      mockRemoveItem.mockResolvedValueOnce(undefined);
      const entry = makeEntry(1);
      mockItems = [entry];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleDelete(entry);
      });

      expect(mockRemoveItem).toHaveBeenCalledWith(1);
    });

    it("shows undo toast for deleted text items", async () => {
      const entry = makeEntry(1);
      mockRemoveItem.mockResolvedValueOnce(undefined);
      mockItems = [entry];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleDelete(entry);
      });

      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ label: expect.any(String), onClick: expect.any(Function) }),
      );
    });
  });

  describe("handleStar", () => {
    it("calls starItem with id and pin state", async () => {
      mockItems = [makeEntry(1)];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        result.current.handleStar(1, true);
      });

      expect(mockPinItem).toHaveBeenCalledWith(1, true);
    });
  });

  describe("handlePreview", () => {
    it("sets previewItem", async () => {
      mockItems = [makeEntry(1)];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handlePreview(mockItems[0]);
      });

      // handlePreview fetches full item async via dbGetItem
      await vi.waitFor(() => {
        expect(result.current.previewItem).not.toBeNull();
      });
    });
  });

  describe("handleTransform", () => {
    it("sets transformItem for text items", async () => {
      const textItem = makeEntry(1, "hello", "text");
      mockItems = [textItem];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleTransform(textItem);
      });

      await vi.waitFor(() => {
        expect(result.current.transformItem).not.toBeNull();
      });
    });

    it("does not set transformItem for image items", () => {
      const imageItem = makeEntry(1, "img", "image");
      mockItems = [imageItem];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleTransform(imageItem);
      });

      expect(result.current.transformItem).toBeNull();
    });
  });

  describe("handleApplyTransform", () => {
    it("clears transformItem and pastes transformed text", async () => {
      const item = makeEntry(1);
      mockItems = [item];
      const { result } = renderHook(() => useAppState());

      // First set a transform item (async — dbGetItem)
      act(() => {
        result.current.handleTransform(item);
      });
      await vi.waitFor(() => {
        expect(result.current.transformItem).not.toBeNull();
      });

      await act(async () => {
        await result.current.handleApplyTransform("TRANSFORMED");
      });

      expect(result.current.transformItem).toBeNull();
      expect(mockPasteItem).toHaveBeenCalledWith(
        expect.objectContaining({ content: "TRANSFORMED", content_type: "text" }),
        true,
      );
      expect(mockShowInfo).toHaveBeenCalled();
    });

    it("shows error toast when paste fails", async () => {
      mockPasteItem.mockRejectedValueOnce(new Error("fail"));
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleApplyTransform("text");
      });

      expect(mockShowError).toHaveBeenCalled();
    });
  });

  describe("submitJob", () => {
    it("exposes submitJob from useBackgroundJobs", () => {
      const { result } = renderHook(() => useAppState());
      expect(typeof result.current.submitJob).toBe("function");
    });

    it("delegates to background jobs hook", async () => {
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.submitJob({
          provider: "openai",

          model: "gpt-5.4-nano",
          prompt: "Summarize",
          promptName: "Summarize",
          inputText: "hello world",
        });
      });

      expect(mockSubmitJob).toHaveBeenCalledWith({
        provider: "openai",

        model: "gpt-5.4-nano",
        prompt: "Summarize",
        promptName: "Summarize",
        inputText: "hello world",
      });
    });
  });

  describe("handleOcr", () => {
    it("extracts text from image and adds to history", async () => {
      const imageItem = makeEntry(1, "img", "image");
      mockItems = [imageItem];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleOcr(imageItem);
      });

      expect(mockOcrImage).toHaveBeenCalledWith(imageItem.image_path);
      expect(mockAddItem).toHaveBeenCalledWith("OCR result text");
      expect(mockShowInfo).toHaveBeenCalled();
    });

    it("shows info toast when OCR returns empty text", async () => {
      mockOcrImage.mockResolvedValueOnce("   ");
      const imageItem = makeEntry(1, "img", "image");
      mockItems = [imageItem];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleOcr(imageItem);
      });

      expect(mockAddItem).not.toHaveBeenCalled();
      expect(mockShowInfo).toHaveBeenCalled();
    });

    it("shows error toast when OCR fails", async () => {
      mockOcrImage.mockRejectedValueOnce(new Error("OCR engine error"));
      const imageItem = makeEntry(1, "img", "image");
      mockItems = [imageItem];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleOcr(imageItem);
      });

      expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining("OCR engine error"));
    });

    it("does nothing for non-image items", async () => {
      const textItem = makeEntry(1, "text", "text");
      mockItems = [textItem];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleOcr(textItem);
      });

      expect(mockOcrImage).not.toHaveBeenCalled();
    });
  });

  describe("handleShowInExplorer", () => {
    it("calls showInExplorer with the path", async () => {
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleShowInExplorer("/images/test.png");
      });

      expect(mockShowInExplorer).toHaveBeenCalledWith("/images/test.png");
    });

    it("shows error toast when showInExplorer fails", async () => {
      mockShowInExplorer.mockRejectedValueOnce(new Error("not found"));
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        await result.current.handleShowInExplorer("/images/test.png");
      });

      expect(mockShowError).toHaveBeenCalled();
    });
  });

  describe("handleBatchCopy", () => {
    it("joins selected text items with separator and pastes", async () => {
      mockItems = [
        makeEntry(1, "hello", "text"),
        makeEntry(2, "world", "text"),
        makeEntry(3, "foo", "text"),
      ];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Select items 1 and 3
      act(() => {
        result.current.handleToggleMultiSelect(1);
        result.current.handleToggleMultiSelect(3);
      });

      expect(result.current.multiSelected.size).toBe(2);

      await act(async () => {
        await result.current.handleBatchCopy("\n");
      });

      expect(mockPasteItem).toHaveBeenCalledWith(
        expect.objectContaining({ content: "hello\nfoo" }),
        false,
      );
      // Multi-select should be cleared after batch copy
      expect(result.current.multiSelected.size).toBe(0);
    });

    it("does nothing when no text items are selected", async () => {
      mockItems = [makeEntry(1, "img", "image")];
      const { result } = renderHook(() => useAppState());

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        result.current.handleToggleMultiSelect(1);
      });

      await act(async () => {
        await result.current.handleBatchCopy("\n");
      });

      expect(mockPasteItem).not.toHaveBeenCalled();
    });
  });

  describe("handleBatchDelete", () => {
    it("deletes all selected items and clears selection", async () => {
      mockItems = [makeEntry(1), makeEntry(2)];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleToggleMultiSelect(1);
        result.current.handleToggleMultiSelect(2);
      });

      await act(async () => {
        await result.current.handleBatchDelete();
      });

      expect(mockBatchRemoveItems).toHaveBeenCalledWith([1, 2]);
      expect(result.current.multiSelected.size).toBe(0);
      expect(mockShowInfo).toHaveBeenCalled();
    });
  });

  describe("handleToggleMultiSelect", () => {
    it("adds item to multi-select set", () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleToggleMultiSelect(5);
      });

      expect(result.current.multiSelected.has(5)).toBe(true);
    });

    it("removes item from multi-select set on second toggle", () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleToggleMultiSelect(5);
      });
      expect(result.current.multiSelected.has(5)).toBe(true);

      act(() => {
        result.current.handleToggleMultiSelect(5);
      });
      expect(result.current.multiSelected.has(5)).toBe(false);
    });
  });

  describe("handleSaveSettings", () => {
    it("saves settings and closes the settings panel", () => {
      const { result } = renderHook(() => useAppState());

      // Open settings first
      act(() => {
        result.current.setShowSettings(true);
      });
      expect(result.current.showSettings).toBe(true);

      const newSettings: AppSettings = {
        ...defaultSettings,
        theme: "gruvbox-hard",
        language: "ru",
      };

      act(() => {
        result.current.handleSaveSettings(newSettings);
      });

      expect(mockSaveSettings).toHaveBeenCalledWith(newSettings);
      expect(result.current.showSettings).toBe(false);
      expect(result.current.settings.theme).toBe("gruvbox-hard");
      expect(result.current.settings.language).toBe("ru");
    });

    it("keeps Settings open and shows error toast when localStorage save fails", () => {
      // Simulate quota exceeded by making saveSettings return false.
      mockSaveSettings.mockReturnValueOnce(false);

      const { result } = renderHook(() => useAppState());

      // Open settings first
      act(() => {
        result.current.setShowSettings(true);
      });
      expect(result.current.showSettings).toBe(true);

      const newSettings: AppSettings = {
        ...defaultSettings,
        theme: "gruvbox-hard",
      };

      act(() => {
        result.current.handleSaveSettings(newSettings);
      });

      // Failed persistence must not publish the draft as saved state.
      expect(mockSaveSettings).toHaveBeenCalledWith(newSettings);
      expect(mockShowError).toHaveBeenCalledTimes(1);
      expect(result.current.showSettings).toBe(true);
      expect(result.current.settings.theme).toBe(defaultSettings.theme);
    });
  });

  describe("handleItemContextMenu", () => {
    it("sets context menu position and item", () => {
      const item = makeEntry(1);
      mockItems = [item];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleItemContextMenu(100, 200, item);
      });

      expect(result.current.contextMenu).toEqual({ x: 100, y: 200, item });
    });
  });

  // --- Overlay toggles ---

  describe("overlay state", () => {
    it("toggles showSettings", () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setShowSettings(true);
      });
      expect(result.current.showSettings).toBe(true);

      act(() => {
        result.current.setShowSettings(false);
      });
      expect(result.current.showSettings).toBe(false);
    });

    it("toggles showShortcuts", () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setShowShortcuts(true);
      });
      expect(result.current.showShortcuts).toBe(true);
    });

    it("clears previewItem via setter", async () => {
      const item = makeEntry(1);
      mockItems = [item];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handlePreview(item);
      });
      await vi.waitFor(() => {
        expect(result.current.previewItem).not.toBeNull();
      });

      act(() => {
        result.current.setPreviewItem(null);
      });
      expect(result.current.previewItem).toBeNull();
    });

    it("clears transformItem via setter", async () => {
      const item = makeEntry(1, "hello", "text");
      mockItems = [item];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleTransform(item);
      });
      await vi.waitFor(() => {
        expect(result.current.transformItem).not.toBeNull();
      });

      act(() => {
        result.current.setTransformItem(null);
      });
      expect(result.current.transformItem).toBeNull();
    });

    it("clears contextMenu via setter", () => {
      const item = makeEntry(1);
      mockItems = [item];
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.handleItemContextMenu(10, 20, item);
      });
      expect(result.current.contextMenu).not.toBeNull();

      act(() => {
        result.current.setContextMenu(null);
      });
      expect(result.current.contextMenu).toBeNull();
    });

    it("toggles monitorPaused", () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setMonitorPaused(true);
      });
      expect(result.current.monitorPaused).toBe(true);
    });
  });

  // --- Updater ---

  describe("updater", () => {
    it("exposes updater state", () => {
      const { result } = renderHook(() => useAppState());
      expect(result.current.updater.status).toEqual({ state: "idle" });
    });
  });
});
