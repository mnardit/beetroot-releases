import type { ClipboardEntry } from "../types/clipboard";
import type { AppSettings } from "../lib/settings";

export function makeEntry(id: number, overrides?: Partial<ClipboardEntry>): ClipboardEntry {
  return {
    id,
    content: `Item ${id}`,
    content_hash: `hash_${id}`,
    content_type: "text",
    image_path: null,
    html_content: null,
    note: null,
    starred: false,
    created_at: "2024-01-01T00:00:00",
    last_used: "2024-01-01T00:00:00",
    source_app: null,
    source_title: null,
    ...overrides,
  };
}

export function defaultSettings(overrides?: Partial<AppSettings>): AppSettings {
  return {
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
    windowMode: "normal",
    windowPosition: "center",
    shortcutPinWindow: "Alt+KeyP",
    shortcutFollowCursor: "Alt+KeyF",
    rememberTypeFilter: false,
    showCopiedOverlay: true,
    overlayPosition: "cursor",
    overlayDuration: "comfortable",
    overlayAnimation: "fade-down",
    ...overrides,
  };
}

export function keySettingsProps() {
  return {
    keyStatuses: { openai: false, gemini: false, anthropic: false, deepseek: false },
    keysReady: true,
    keysError: false,
    onKeysChanged: async () => {},
    onRetryKeys: () => {},
  };
}
