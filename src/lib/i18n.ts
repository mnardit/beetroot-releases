import { createContext, useContext } from "react";

export type Language =
  | "en"
  | "ru"
  | "de"
  | "es"
  | "zh"
  | "ja"
  | "fr"
  | "pt"
  | "ko"
  | "tr"
  | "it"
  | "pl"
  | "nl"
  | "uk"
  | "th"
  | "hi"
  | "id"
  | "vi"
  | "cs"
  | "hu"
  | "ro"
  | "sv"
  | "da"
  | "fi"
  | "nb"
  | "ms";
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
  { id: "de", label: "Deutsch" },
  { id: "es", label: "Español" },
  { id: "zh", label: "中文" },
  { id: "ja", label: "日本語" },
  { id: "fr", label: "Français" },
  { id: "pt", label: "Português" },
  { id: "ko", label: "한국어" },
  { id: "tr", label: "Türkçe" },
  { id: "it", label: "Italiano" },
  { id: "pl", label: "Polski" },
  { id: "nl", label: "Nederlands" },
  { id: "uk", label: "Українська" },
  { id: "th", label: "ไทย" },
  { id: "hi", label: "हिन्दी" },
  { id: "id", label: "Bahasa Indonesia" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "cs", label: "Čeština" },
  { id: "hu", label: "Magyar" },
  { id: "ro", label: "Română" },
  { id: "sv", label: "Svenska" },
  { id: "da", label: "Dansk" },
  { id: "fi", label: "Suomi" },
  { id: "nb", label: "Norsk Bokmål" },
  { id: "ms", label: "Bahasa Melayu" },
];

export const en = {
  // General
  cancel: "Cancel",
  save: "Save",
  delete: "Delete",
  close: "Close",
  paste: "Paste",
  create: "Create",
  rename: "Rename",
  export: "Export",
  import: "Import",
  edit: "Edit",
  deleted: "Deleted",
  undo: "Undo",

  // Search
  "search.placeholder": "Search clipboard history...",
  "search.regexPlaceholder": "Regex pattern...",
  "search.modeSwitch": "Switch to {mode} search",
  "search.modeLabel": "Search mode: {mode}",
  "search.resultCount": "{count} found",
  "search.clear": "Clear search",
  "search.regexTooltip": "Toggle regex search",
  "search.regexError": "Invalid pattern: {detail}",

  // Filter
  "filter.all": "All",
  "filter.pinned": "Starred",
  "filter.text": "Text",
  "filter.images": "Images",
  "filter.notes": "Notes",
  "filter.apps": "Apps",
  "filter.searchApps": "Search apps…",
  "filter.sortLastUsed": "Last used",
  "filter.sortMostUsed": "Most used",
  "filter.sortAlpha": "Alphabetical",
  "filter.noAppsFound": "No apps found",
  "filter.aiTransform": "AI Transform",

  // Empty state
  "empty.noMatch": "No matching items",
  "empty.noMatchHint": "Try a different search term",
  "empty.noItems": "Clipboard history is empty",
  "empty.noItemsHint": "Copy something to get started",

  // Footer
  "footer.selected": "{count} selected \u00B7 Ctrl+Click to toggle",
  "footer.pasteDropdown": "Paste \u25BE",
  "footer.hint": "Enter paste \u00B7 Space preview \u00B7 Alt+T transform \u00B7 Esc close",
  "footer.hintPinned": "Enter copy \u00B7 Space preview \u00B7 Alt+T transform \u00B7 Esc close",
  "footer.hintNoFocus":
    "\u2191\u2193 Navigate \u00B7 Enter paste \u00B7 Esc close \u00B7 Click to search",
  "footer.hintPreview":
    "Space close \u00B7 Enter paste \u00B7 Ctrl+C copy \u00B7 \u2191\u2193 navigate",
  "footer.shortcuts": "Keyboard shortcuts (?)",
  "footer.resumeMonitor": "Resume monitoring",
  "footer.pauseMonitor": "Pause monitoring",
  "footer.pinWindow": "Pin on top",
  "footer.unpinWindow": "Unpin",
  "footer.settings": "Settings",
  "footer.followCursorOn": "Follow cursor",
  "footer.followCursorOff": "Stop following cursor",
  "footer.monitorPaused": "Clipboard monitoring paused",

  // Separator menu
  "sep.newline": "Newline",
  "sep.comma": "Comma",
  "sep.space": "Space",
  "sep.tab": "Tab",
  "sep.none": "None",

  // Toast
  "toast.pasted": "Pasted",
  "toast.copied": "Copied to clipboard",
  "toast.pasteFailed": "Paste failed",
  "toast.loadFailed": "Could not load the full item. Try again.",
  "toast.explorerFailed": "Failed to open Explorer",
  "toast.deletedItems": "Deleted {count} items",
  "toast.deletedItemsSkipped": "Deleted {count} items ({skipped} images cannot be undone)",
  "toast.pastedItems": "Pasted {count} items",
  "toast.pastedItemsSkipped": "Pasted {count} items ({skipped} images skipped)",
  "toast.importedItems": "Imported {count} items",
  "toast.ocrSuccess": "Text extracted and added to history",
  "toast.ocrEmpty": "No text found in image",
  "toast.ocrFailed": "OCR failed",
  "toast.aiProcessing": "Processing {name}...",
  "toast.aiCompleted": "✓ {name}",
  "toast.aiFailed": "{name} — {error}",
  "toast.pinned": "Starred",
  "toast.unpinned": "Unstarred",
  "toast.ocrStarted": "Extracting text...",
  "toast.imageFormatNotSupported": "Only PNG images are supported from File Explorer",
  "toast.settingsSaveFailed": "Couldn't save settings — your browser storage may be full",

  // Settings
  "settings.title": "Settings",
  "settings.theme": "Theme",
  "settings.system": "System",
  "settings.historyLimit": "History limit",
  "settings.unlimited": "Unlimited",
  "settings.hotkey": "Hotkey",
  "settings.hotkeyRecording": "Press a key combination...",
  "settings.hotkeyReset": "Reset",
  "settings.plainTextHotkey": "Plain text hotkey",
  "settings.plainTextHotkeyHint": "Paste clipboard as plain text, stripping formatting",
  "settings.plainTextHotkeyNone": "None (click to set)",
  "settings.plainTextHotkeyConflict": "Plain text hotkey must differ from the main hotkey",
  "settings.shortcutConflict":
    "Shortcuts must be unique — two actions cannot share the same key combination",
  "settings.autostart": "Autostart",
  "settings.autostart.disabledByUser":
    "Autostart was disabled in Windows Task Manager. Re-enable it there: Task Manager → Startup apps → Beetroot → Enable.",
  "settings.autostart.disabledByPolicy":
    "Autostart is disabled by your organization's policy or not supported on this device.",
  "settings.autoUpdate": "Auto-update",
  "settings.autoUpdateHint":
    "When disabled, the app makes no automatic network connections (unless you use AI transforms)",
  "settings.rememberFilter": "Remember selected filter",
  "settings.rememberFilterHint":
    "Keep the last selected filter (Starred, Text, etc.) when closing the window",
  "settings.copiedOverlay": "Copy notification",
  "settings.copiedOverlayHint": "Show a brief confirmation when you copy something",
  "settings.overlayPosition": "Position",
  "settings.overlayPosition.cursor": "Near cursor",
  "settings.overlayPosition.topCenter": "Top center",
  "settings.overlayPosition.bottomCenter": "Bottom center",
  "settings.overlayDuration": "Duration",
  "settings.overlayDuration.quick": "Quick",
  "settings.overlayDuration.comfortable": "Comfortable",
  "settings.overlayDuration.visible": "Visible",
  "settings.overlayAnimation": "Animation",
  "settings.overlayAnimation.fadeDown": "Fade down",
  "settings.overlayAnimation.fadeUp": "Fade up",
  "settings.overlayAnimation.fade": "Fade",
  "settings.overlayAnimation.scaleDown": "Scale down",
  "settings.overlayAnimation.pop": "Pop",
  "settings.overlayAnimation.blur": "Blur",
  "overlay.copied": "Copied",
  "overlay.imageCopied": "Image copied",
  "settings.on": "ON",
  "settings.off": "OFF",
  "settings.autoDelete": "Auto-delete after",
  "settings.never": "Never",
  "settings.1day": "1 day",
  "settings.7days": "7 days",
  "settings.30days": "30 days",
  "settings.dataLocation": "Data location",
  "settings.dataLocationHint":
    "Move copies your database and images to a new folder. Switch points to a different folder without copying (empty folder = fresh start).",
  "settings.moving": "Moving...",
  "settings.move": "Move",
  "settings.switch": "Switch",
  "settings.switching": "Switching...",
  "settings.data": "Data",
  "settings.saving": "Saving...",
  "settings.language": "Language",
  "settings.pasteMode": "Item click action",
  "settings.pasteAuto": "Auto-paste",
  "settings.pasteCopy": "Copy only",
  "settings.accentColor": "Accent color",
  "settings.resetAccent": "Reset",
  "settings.fontSize": "Font size",
  "settings.fontCompact": "Compact",
  "settings.fontSmall": "Small",
  "settings.fontDefault": "Default",
  "settings.fontLarge": "Large",
  "settings.fontLarger": "Larger",
  "settings.fontLargest": "Largest",
  "settings.uiFont": "UI font",
  "settings.uiFontHint": "Font for interface elements and plain text",
  "settings.codeFont": "Code font",
  "settings.codeFontHint": "Font for code, regex, JSON, and monospace content",
  "settings.pasteFormat": "Paste format",
  "settings.pasteFormatPlain": "Plain text",
  "settings.pasteFormatOriginal": "Original",
  "settings.pasteModeHint": "Auto-paste types directly into the active app",
  "settings.pasteFormatHint": "Plain text strips formatting. Original keeps rich text",
  "settings.autoDeleteHint": "Automatically removes unstarred items older than this",
  "settings.historyLimitHint": "Oldest unstarred items are removed when limit is reached",
  "settings.windowEffectHint": "Mica requires Windows 11. Acrylic works on Windows 10+.",
  "settings.windowPosition": "Window position",
  "settings.windowPositionHint": "Where the window appears on the monitor when opened via hotkey",
  "settings.positionCenter": "Center",
  "settings.positionTopLeft": "Top left",
  "settings.positionTopRight": "Top right",
  "settings.positionBottomLeft": "Bottom left",
  "settings.positionBottomRight": "Bottom right",

  // Settings tabs
  "settings.tabGeneral": "General",
  "settings.tabAppearance": "Appearance",
  "settings.tabAI": "AI",
  "settings.tabData": "Data",
  "settings.tabShortcuts": "Shortcuts",
  "settings.tabAbout": "About",
  "settings.tabLanguage": "Language",

  // About
  "settings.about": "About",
  "settings.aboutVersion": "Version {version}",
  "settings.aboutGithub": "GitHub",
  "settings.aboutReportIssue": "Report issue",
  "settings.aboutPrivacy": "Privacy Policy",
  "settings.aboutTerms": "Terms of Service",
  "settings.aboutCredits": "Built with Tauri + React",
  "settings.checkForUpdates": "Check for updates",

  // AI
  "settings.ai": "AI Transforms",
  "settings.aiKey": "OpenAI API Key",
  "settings.aiKeyPlaceholder": "sk-...",
  "settings.aiModel": "Model",
  "settings.aiPrompts": "Custom prompts",
  "settings.aiPromptName": "Name",
  "settings.aiPromptText": "Prompt instruction",
  "settings.aiAddPrompt": "+ Add prompt",
  "settings.aiNoPrompts": "No custom prompts yet",
  "settings.aiQuickAccess": "Quick menu (max 5)",
  "settings.aiQuickAccessHint": "Appears in right-click menu",
  "settings.aiKeyInput": "API key",
  "settings.aiSaveKey": "Save key now",
  "settings.aiDeleteKey": "Delete saved key",
  "settings.aiKeySaved": "Key saved in Windows Credential Manager",
  "settings.aiKeyMissing": "No saved key",
  "settings.aiKeyStorageError": "Could not update the saved key or its status. Try again.",
  "settings.aiMigrationError":
    "Could not migrate or load API keys. Existing keys have been preserved.",
  "settings.aiRetryKeys": "Retry key migration",
  "settings.aiDiscardLegacy": "Discard old key",
  "settings.aiConfirmDiscard": "Confirm discard",
  "settings.aiDiscardLegacyConfirm":
    "Discard the old {provider} API key? You will need to enter it again. Other keys and keys already in Windows Credential Manager will be kept.",
  "settings.aiTestKey": "Test",
  "settings.aiKeyValid": "API key is valid",
  "settings.aiKeyInvalid": "API key is invalid",
  "settings.aiKeyTesting": "Testing...",
  "settings.aiModelNanoDesc":
    "Fastest and cheapest — simple transforms (uppercase, cleanup, summarize)",
  "settings.aiModelMiniDesc": "Smarter — complex tasks (rewrite, translate, code generation)",
  "settings.aiDescription":
    "Requires your own OpenAI API key (BYOK). Get one at platform.openai.com.",
  "settings.aiProvider": "AI Provider",
  "settings.aiLocalPreset": "Local AI Preset",
  "settings.aiProviderOpenai": "OpenAI",
  "settings.aiProviderLocal": "Local LLM",
  "settings.localEndpoint": "Endpoint URL",
  "settings.localEndpointHint": "OpenAI-compatible endpoint (LM Studio, Ollama, llama.cpp)",
  "settings.localModel": "Model name",
  "settings.localModelHint": "Leave empty to auto-detect",
  "settings.localTestConnect": "Test",
  "settings.localConnectedShort": "Connected",
  "settings.localFailed": "Failed",
  "settings.localCustom": "Custom",
  "settings.aiProviderGemini": "Google Gemini",
  "settings.geminiDescription":
    "Requires your own Gemini API key (BYOK). Get one at aistudio.google.com.",
  "settings.geminiKeyPlaceholder": "AIza...",
  "settings.geminiModelFlashDesc": "Fast & smart — best price-performance for reasoning tasks",
  "settings.geminiModelFlashLiteDesc": "Fastest & cheapest — lightweight, high-volume tasks",
  "settings.aiProviderAnthropic": "Anthropic",
  "settings.anthropicDescription":
    "Requires your own Anthropic API key (BYOK). Get one at console.anthropic.com.",
  "settings.anthropicKeyPlaceholder": "sk-ant-...",
  "settings.anthropicModelHaikuDesc": "Fastest & cheapest — lightweight tasks, high throughput",
  "settings.anthropicModelSonnetDesc": "Fast & smart — best balance of speed and quality",
  "settings.aiProviderDeepSeek": "DeepSeek",
  "settings.deepseekDescription":
    "Requires your own DeepSeek API key (BYOK). Get one at platform.deepseek.com.",
  "settings.deepseekKeyPlaceholder": "sk-...",
  "settings.deepseekModelChatDesc": "Fast & versatile — best for everyday text transformations",
  "settings.deepseekModelReasonerDesc": "Deep reasoning — complex tasks, chain-of-thought analysis",
  "settings.aiQuickHeader": "Quick",
  "settings.promptType": "Prompt type",
  "settings.promptTypeText": "Text",
  "settings.promptTypeImage": "Image",

  // Loading
  loading: "Loading...",

  // Context menu
  "ctx.paste": "Paste",
  "ctx.copy": "Copy",
  "ctx.pin": "Star",
  "ctx.unpin": "Unstar",
  "ctx.preview": "Preview",
  "ctx.transform": "Transform",
  "ctx.showInExplorer": "Show in Explorer",
  "ctx.ocr": "Extract text (OCR)",

  // Transform
  "transform.title": "Transform text",
  "transform.upper": "UPPERCASE",
  "transform.lower": "lowercase",
  "transform.titleCase": "Title Case",
  "transform.trim": "Normalize whitespace",
  "transform.nospaces": "Remove spaces",
  "transform.singleline": "Single line",
  "transform.sortlines": "Sort lines",
  "transform.dedup": "Remove duplicates",

  // AI Transforms
  "transform.aiSection": "AI Transforms",
  "transform.aiLoading": "Processing...",
  "transform.aiError": "AI error: {error}",
  "transform.searchPlaceholder": "Search transforms...",
  "transform.noResults": "No matches",
  "transform.noApiKey": "Set API key in Settings",
  "transform.noEndpoint": "Set Local LLM endpoint in Settings",

  // AI Builtin prompt names
  "ai.grammar": "Fix Grammar",
  "ai.grammarDesc": "Fix grammatical errors without changing meaning",
  "ai.translate": "Any to English",
  "ai.translateDesc": "Auto-detect language and translate to English",
  "ai.summarize": "Summarize",
  "ai.summarizeDesc": "Condense into 2-3 key sentences",
  "ai.professional": "Make Professional",
  "ai.professionalDesc": "Rewrite in a clear, business-appropriate tone",
  "ai.codeFormat": "Format as Code",
  "ai.codeFormatDesc": "Apply proper indentation and formatting",
  "ai.bulletPoints": "Bullet Points",
  "ai.bulletPointsDesc": "Convert text into a bulleted list",
  "ai.simplify": "Simplify",
  "ai.simplifyDesc": "Rewrite in plain, simple language",
  "ai.makeShorter": "Make Shorter",
  "ai.makeShorterDesc": "Condense to roughly half the length",
  "ai.explain": "Explain This",
  "ai.explainDesc": "Explain in simple terms for anyone",
  "ai.extractData": "Extract Key Data",
  "ai.extractDataDesc": "Extract names, dates, numbers, URLs",

  // AI Vision prompts
  "ai.readText": "Read Text",
  "ai.readTextDesc": "Extract text from image as written",
  "ai.describe": "Describe Image",
  "ai.describeDesc": "Describe what's visible in the image",
  "ai.extractImageData": "Extract Data",
  "ai.extractImageDataDesc": "Extract tables, lists, key-value pairs from image",
  "ai.summarizeImage": "Summarize Image",
  "ai.summarizeImageDesc": "Summarize image content in a few sentences",
  "ai.translateImage": "Translate Image Text",
  "ai.translateImageDesc": "Extract and translate image text to English",

  // Preview
  "preview.title": "Preview",
  "preview.chars": "chars",
  "preview.char": "char",
  "preview.words": "words",
  "preview.word": "word",
  "preview.lines": "lines",
  "preview.line": "line",
  "preview.copy": "Copy to clipboard",
  "preview.failed": "Failed to load image",
  "preview.loading": "Loading...",
  "preview.fit": "Fit",
  "preview.sourceApp": "Source",
  "preview.sourceTitle": "Window",

  // Shortcuts
  "shortcuts.title": "Keyboard Shortcuts",
  "shortcuts.paste": "Paste selected item",
  "shortcuts.copy": "Copy selected item",
  "shortcuts.preview": "Preview selected item",
  "shortcuts.transform": "Transform text",
  "shortcuts.pin": "Star / unstar item",
  "shortcuts.deleteItem": "Delete selected item",
  "shortcuts.quickPaste": "Quick paste by position",
  "shortcuts.multiSelect": "Multi-select items",
  "shortcuts.contextMenu": "Context menu",
  "shortcuts.navigate": "Navigate list",
  "shortcuts.closeWindow": "Close window",
  "shortcuts.pinWindow": "Pin / unpin window",
  "shortcuts.followCursor": "Toggle follow cursor",

  // Onboarding
  "onboarding.step1.title": "Meet Beetroot",
  "onboarding.step1.desc":
    "Your smart clipboard manager. Beetroot captures everything you copy and keeps it organized with search, filters, and AI transforms.",
  "onboarding.step2.title": "Press {hotkey} to open",
  "onboarding.step2.desc":
    "Beetroot lives in your system tray and captures everything you copy. Use this hotkey to instantly show or hide the window.",
  "onboarding.step3.title": "Smart Search",
  "onboarding.step3.desc":
    "Type to search your clipboard history. Press Space to preview any item. Toggle .* for regex search.",
  "onboarding.step4.title": "AI Transforms",
  "onboarding.step4.desc":
    "Select any text item and press Alt+T to transform it with AI — summarize, translate, fix grammar, and more.",
  "onboarding.step5.title": "You're all set!",
  "onboarding.step5.desc":
    "Click any item to paste it. Right-click for options like star, preview, transform, and OCR. Open Settings to customize themes, hotkey, and more.",
  "onboarding.skip": "Skip",
  "onboarding.next": "Next",
  "onboarding.getStarted": "Get started",

  // Clipboard item
  "item.type.url": "URL",
  "item.type.email": "Email",
  "item.type.code": "Code",
  "item.type.json": "JSON",
  "item.type.color": "Color",
  "item.type.text": "Text",
  "item.type.image": "Image",
  "item.pin": "Star",
  "item.unpin": "Unstar",
  "item.deleteHint": "Delete (Alt+Del)",
  "item.hasNote": "Has note",
  "item.image": "Image",
  "item.imageError": "Error",
  "item.imageLoading": "Loading...",
  "item.imageAlt": "Clipboard image",
  "preview.imageAlt": "Clipboard image preview",

  // Date groups
  "group.today": "Today",
  "group.yesterday": "Yesterday",
  "group.thisWeek": "This week",
  "group.older": "Older",

  // Aria labels
  "aria.clipboardHistory": "Clipboard history",
  "aria.contextMenu": "Context menu",
  "aria.closeSettings": "Close settings",
  "aria.onboarding": "Welcome guide",
  "aria.previewPanel": "Content preview",
  "aria.transformMenu": "Transform text menu",
  "aria.languageGroup": "Language",
  "aria.themeGroup": "Theme",
  "aria.historyLimitGroup": "History limit",
  "aria.hotkeyGroup": "Hotkey",
  "aria.pasteModeGroup": "Item click action",
  "aria.pasteFormatGroup": "Paste format",
  "aria.fontSizeGroup": "Font size",
  "aria.autoDeleteGroup": "Auto-delete after",
  "aria.listCount": "{count} items",
  "aria.aiModelGroup": "AI model",
  "aria.windowPositionGroup": "Window position",

  // Error boundary
  "error.title": "Something went wrong",
  "error.retry": "Retry",
  "error.dbCorrupted": "Database corrupted. Restart Beetroot to auto-recover.",
  "error.dbBusy": "Database is busy. Try again in a moment.",
  "error.dbGeneric": "Database error: {0}",
  "warning.unstableDrive":
    "This drive type (USB/network) may cause database corruption. A local drive is recommended.",
  "warning.cloudSync":
    "{service} sync detected. Cloud-synced folders can corrupt the database. Choose a local folder instead.",
  "notification.dbRestored": "Database restored from backup. Some recent items may be missing.",
  "notification.dbFreshCreated":
    "Database was corrupted and could not be recovered. A fresh database was created.",
  "notification.dbCorrupted":
    "Database corruption detected. Please restart Beetroot to auto-recover.",

  // Update
  "update.available": "Update available: v{version}",
  "update.downloading": "Downloading update...",
  "update.ready": "Update ready. Restart to apply.",
  "update.restart": "Restart now",
  "update.later": "Later",
  "update.error": "Update failed: {error}",
  "update.checking": "Checking for updates...",
  "update.upToDate": "You're up to date",
  "update.download": "Download and install",

  // Context menu notes
  "ctx.addNote": "Add note",
  "ctx.editNote": "Edit note",

  // Preview notes
  "preview.note": "Note",
  "preview.addNote": "Add a note...",
  "preview.addNoteShort": "Add note",
  "preview.copyImage": "Copy image",
  "preview.transform": "Transform",
  "preview.ocr": "OCR",
  "preview.ai": "AI",
  "preview.wrap": "Wrap",
  "preview.paste": "Paste",
  "preview.copyPlain": "Copy as plain text",
  "preview.delete": "Delete",

  // Context menu URL
  "ctx.openUrl": "Open in browser",

  // Welcome guide
  "settings.welcomeGuide": "Welcome guide",
  "settings.showWelcomeGuide": "Show welcome guide",

  // Window effect
  "settings.windowEffect": "Window effect",
  "settings.effectMica": "Mica",
  "settings.effectAcrylic": "Acrylic",
  "settings.effectSolid": "Solid",
  "settings.shortcutGlobalHotkey": "Global hotkey",
  "settings.shortcutPlainText": "Plain text paste hotkey",
  "settings.shortcutPinWindow": "Pin window on top",
  "settings.shortcutFollowCursor": "Follow cursor",
  "settings.shortcutsGlobalHint": "Global hotkeys work even when Beetroot is minimized.",
  "settings.shortcutsLocalHint": "Local shortcuts work only when Beetroot is focused.",
  "settings.shortcutClear": "Clear",

  // Statistics
  "stats.totalItems": "Total items",
  "stats.textItems": "Text items",
  "stats.imageItems": "Image items",
  "stats.pinnedItems": "Starred items",
  "stats.dbSize": "Database size",
  "stats.imagesDirSize": "Images folder size",
} as const;

export type TranslationKey = keyof typeof en;
export type TranslationDictionary = Partial<Record<TranslationKey, string>>;

/** Replace {key} placeholders in a translation string */
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

type DictLoader = () => Promise<{ default: TranslationDictionary }>;

const loaders: Record<Language, DictLoader> = {
  en: () => Promise.resolve({ default: en }),
  ru: () => import("./locales/ru"),
  de: () => import("./locales/de"),
  es: () => import("./locales/es"),
  zh: () => import("./locales/zh"),
  ja: () => import("./locales/ja"),
  fr: () => import("./locales/fr"),
  pt: () => import("./locales/pt"),
  ko: () => import("./locales/ko"),
  tr: () => import("./locales/tr"),
  it: () => import("./locales/it"),
  pl: () => import("./locales/pl"),
  nl: () => import("./locales/nl"),
  uk: () => import("./locales/uk"),
  th: () => import("./locales/th"),
  hi: () => import("./locales/hi"),
  id: () => import("./locales/id"),
  vi: () => import("./locales/vi"),
  cs: () => import("./locales/cs"),
  hu: () => import("./locales/hu"),
  ro: () => import("./locales/ro"),
  sv: () => import("./locales/sv"),
  da: () => import("./locales/da"),
  fi: () => import("./locales/fi"),
  nb: () => import("./locales/nb"),
  ms: () => import("./locales/ms"),
};

export async function loadLanguage(lang: Language): Promise<TranslationDictionary> {
  const mod = await loaders[lang]();
  return mod.default;
}

/** Module-level active dictionary — updated by createTranslator for non-React consumers. */
let activeDict: TranslationDictionary = en;
let activeLanguage: Language = "en";

/** Get a translation outside React (e.g. ErrorBoundary class component). */
export function getTranslation(key: TranslationKey): string {
  return activeDict[key] ?? en[key];
}

/** Get the active in-app language (for Intl APIs outside React context). */
export function getActiveLanguage(): Language {
  return activeLanguage;
}

export function createTranslator(_lang: Language, dict?: TranslationDictionary) {
  const d = dict ?? en;
  activeDict = d;
  activeLanguage = _lang;
  return function t(key: TranslationKey, params?: Record<string, string | number>): string {
    return interpolate(d[key] ?? en[key], params);
  };
}

export type TFunction = ReturnType<typeof createTranslator>;

export const I18nContext = createContext<TFunction>(createTranslator("en"));

export function useTranslation(): TFunction {
  return useContext(I18nContext);
}
