import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import App from "../../App";
import { useAppState } from "../../hooks/useAppState";
import { activateWindow } from "../../lib/tauri";
import { makeEntry, defaultSettings } from "../../test/fixtures";
import { createTranslator } from "../../lib/i18n";

vi.mock("../../hooks/useAppState");

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>("../../lib/tauri");
  return {
    ...actual,
    activateWindow: vi.fn().mockResolvedValue(undefined),
  };
});

// Returns a complete state shape matching `useAppState`'s return type. Each
// test spreads this and overrides only the fields it cares about.
function defaultMockAppState() {
  const t = createTranslator("en");
  return {
    // Search
    query: "",
    setQuery: vi.fn(),
    searchRef: createRef<HTMLInputElement>(),
    searchMode: "fuzzy" as const,
    setSearchMode: vi.fn(),
    regexError: null,

    // Items & filtering
    loading: false as const,
    filtered: [],
    matchMap: new Map(),
    titleMatchMap: new Map(),
    noteMatchMap: new Map(),
    hasImages: false,
    hasNotes: false,
    typeFilter: "all" as const,
    setTypeFilter: vi.fn(),
    filterCounts: { all: 0, starred: 0, text: 0, image: 0, notes: 0 },
    appIcons: {},
    appFilter: null,
    setAppFilter: vi.fn(),
    appCounts: {},
    appLastUsed: {},
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),

    // Overlays
    showSettings: false,
    setShowSettings: vi.fn(),
    previewItem: null,
    setPreviewItem: vi.fn(),
    transformItem: null,
    setTransformItem: vi.fn(),
    contextMenu: null,
    setContextMenu: vi.fn(),
    showShortcuts: false,
    setShowShortcuts: vi.fn(),
    onboardingVisible: false,
    setOnboardingVisible: vi.fn(),
    markOnboardingDone: vi.fn(),

    // Item state
    newItemId: null,
    pastingItemId: null,
    multiSelected: new Set<number>(),
    setMultiSelected: vi.fn(),
    monitorPaused: false,
    setMonitorPaused: vi.fn(),
    isNoFocus: false,

    // Settings
    aiConfig: {
      provider: "openai",
      hasKey: { openai: false, gemini: false, anthropic: false, deepseek: false },
      openaiModel: "gpt-5.4-nano",
      geminiModel: "gemini-2.5-flash-lite",
      anthropicModel: "claude-haiku-4-5",
      deepseekModel: "deepseek-chat",
      localEndpoint: "",
      localModel: "",
    },
    keyStatuses: { openai: false, gemini: false, anthropic: false, deepseek: false },
    keysReady: true,
    keysError: false,
    refreshKeyStatuses: vi.fn().mockResolvedValue(undefined),
    retryKeyMigration: vi.fn(),
    settings: defaultSettings(),
    handleSaveSettings: vi.fn(),

    // Callbacks
    handleSelect: vi.fn(),
    handleCopyToClipboard: vi.fn(),
    handleDelete: vi.fn(),
    handleStar: vi.fn(),
    handlePreview: vi.fn(),
    handleTransform: vi.fn(),
    handleApplyTransform: vi.fn(),
    submitJob: vi.fn(),
    handleItemContextMenu: vi.fn(),
    handleShowInExplorer: vi.fn(),
    handleOcr: vi.fn(),
    handleUpdateNote: vi.fn(),
    handleToggleMultiSelect: vi.fn(),
    handleBatchDelete: vi.fn(),
    handleBatchCopy: vi.fn(),
    handleHover: vi.fn(),
    handleTogglePin: vi.fn(),
    handleToggleFollowCursor: vi.fn(),

    // i18n & toast
    t,
    showError: vi.fn(),

    // Updater
    updater: {
      status: { state: "idle" as const },
      checkForUpdates: vi.fn(),
      downloadAndInstall: vi.fn(),
      restartApp: vi.fn(),
      dismiss: vi.fn(),
      storeBuild: false,
    },
  };
}

function setMockState(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAppState).mockReturnValue({
    ...defaultMockAppState(),
    ...overrides,
  } as unknown as ReturnType<typeof useAppState>);
}

describe("App composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockState();
  });

  it("renders SearchBar at all times", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".search-bar")).toBeTruthy();
  });

  it("renders EmptyState when no items are present", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".empty-state")).toBeTruthy();
  });

  it("renders ClipboardList (and not EmptyState) when items present", () => {
    const item = makeEntry(1);
    setMockState({ filtered: [item] });
    const { container } = render(<App />);
    expect(container.querySelector(".empty-state")).toBeNull();
    // ClipboardList renders a virtualized list with role="list"
    expect(container.querySelector('[role="list"], .clipboard-list')).toBeTruthy();
  });

  it("renders Settings overlay when showSettings is true", () => {
    setMockState({ showSettings: true });
    const { container } = render(<App />);
    expect(container.querySelector(".settings")).toBeTruthy();
    // When settings are showing, the search bar (main view) should NOT render
    expect(container.querySelector(".search-bar")).toBeNull();
  });

  it("renders PreviewPanel when previewItem is set", () => {
    const item = makeEntry(1);
    setMockState({
      filtered: [item],
      previewItem: item,
    });
    const { container } = render(<App />);
    expect(container.querySelector(".preview-overlay, .preview-panel")).toBeTruthy();
  });

  it("renders ContextMenu when contextMenu state is set", () => {
    const item = makeEntry(1);
    setMockState({
      filtered: [item],
      contextMenu: { x: 100, y: 200, item },
    });
    const { container } = render(<App />);
    expect(container.querySelector(".context-menu")).toBeTruthy();
  });

  it("renders TransformMenu when transformItem is set", () => {
    const item = makeEntry(1);
    setMockState({
      filtered: [item],
      transformItem: item,
    });
    const { container } = render(<App />);
    expect(container.querySelector(".transform-menu")).toBeTruthy();
  });

  it("renders Onboarding overlay when onboardingVisible is true", () => {
    setMockState({ onboardingVisible: true });
    const { container } = render(<App />);
    expect(container.querySelector(".onboarding-overlay")).toBeTruthy();
  });

  it("renders ShortcutsHelp overlay when showShortcuts is true", () => {
    setMockState({ showShortcuts: true });
    const { container } = render(<App />);
    expect(container.querySelector(".shortcuts-overlay, .shortcuts")).toBeTruthy();
  });

  it("renders UpdateBanner when status is non-idle and not a store build", () => {
    setMockState({
      updater: {
        status: { state: "ready" as const },
        checkForUpdates: vi.fn(),
        downloadAndInstall: vi.fn(),
        restartApp: vi.fn(),
        dismiss: vi.fn(),
        storeBuild: false,
      },
    });
    const { container } = render(<App />);
    expect(container.querySelector(".update-banner")).toBeTruthy();
  });

  it("does NOT render UpdateBanner when status is idle", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".update-banner")).toBeNull();
  });

  it("does NOT render UpdateBanner on store builds even with non-idle status", () => {
    setMockState({
      updater: {
        status: { state: "ready" as const },
        checkForUpdates: vi.fn(),
        downloadAndInstall: vi.fn(),
        restartApp: vi.fn(),
        dismiss: vi.fn(),
        storeBuild: true,
      },
    });
    const { container } = render(<App />);
    expect(container.querySelector(".update-banner")).toBeNull();
  });

  it("activates window when SearchBar is mousedown'd", () => {
    const { container } = render(<App />);
    const searchBar = container.querySelector(".search-bar")!;
    // The wrapper around SearchBar has the onMouseDown handler
    const wrapper = searchBar.parentElement!;
    wrapper.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(activateWindow).toHaveBeenCalled();
  });
});
