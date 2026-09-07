import { themes } from "./themes";
import { DEFAULT_MAX_HISTORY, MAX_HISTORY_LIMIT } from "./constants";
import type { Language, TranslationKey } from "./i18n";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const THEME_MIGRATION_MAP: Record<string, string> = {
  mocha: "tokyo-storm",
  latte: "github-light",
  tokyo: "tokyo-storm",
  rosepine: "tokyo-storm",
  dracula: "gruvbox-hard",
  nord: "nord-snow",
  gruvbox: "gruvbox-hard",
  solarized: "github-light",
};

export type PasteMode = "auto" | "copy";
export type PasteFormat = "plain" | "original";
export type FontSize = "compact" | "small" | "default" | "large" | "larger" | "largest";
export type WindowEffect = "mica" | "acrylic" | "solid";
export type WindowMode = "normal" | "pinned" | "follow-cursor";
export type WindowPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface CustomAIPrompt {
  id: string;
  name: string;
  prompt: string;
  quickAccess?: boolean;
  type?: "text" | "image"; // defaults to "text" if missing
}

export const MAX_QUICK_ACCESS_PROMPTS = 5;

/** Returns the i18n-translated name for a prompt, falling back to its raw name. */
export function getPromptLabel(
  prompt: { id: string; name: string },
  t: (key: TranslationKey) => string,
): string {
  const entry = BUILTIN_I18N[prompt.id];
  return entry ? t(entry.name as TranslationKey) : prompt.name;
}

export const BUILTIN_I18N: Record<string, { name: string; desc: string }> = {
  "builtin-grammar": { name: "ai.grammar", desc: "ai.grammarDesc" },
  "builtin-translate": { name: "ai.translate", desc: "ai.translateDesc" },
  "builtin-summarize": { name: "ai.summarize", desc: "ai.summarizeDesc" },
  "builtin-professional": { name: "ai.professional", desc: "ai.professionalDesc" },
  "builtin-code-format": { name: "ai.codeFormat", desc: "ai.codeFormatDesc" },
  "builtin-bullet-points": { name: "ai.bulletPoints", desc: "ai.bulletPointsDesc" },
  "builtin-simplify": { name: "ai.simplify", desc: "ai.simplifyDesc" },
  "builtin-make-shorter": { name: "ai.makeShorter", desc: "ai.makeShorterDesc" },
  "builtin-explain": { name: "ai.explain", desc: "ai.explainDesc" },
  "builtin-extract-data": { name: "ai.extractData", desc: "ai.extractDataDesc" },
  "builtin-read-text": { name: "ai.readText", desc: "ai.readTextDesc" },
  "builtin-describe": { name: "ai.describe", desc: "ai.describeDesc" },
  "builtin-extract-image-data": { name: "ai.extractImageData", desc: "ai.extractImageDataDesc" },
  "builtin-summarize-image": { name: "ai.summarizeImage", desc: "ai.summarizeImageDesc" },
  "builtin-translate-image": { name: "ai.translateImage", desc: "ai.translateImageDesc" },
};

export const DEFAULT_AI_PROMPTS: CustomAIPrompt[] = [
  {
    id: "builtin-grammar",
    name: "Fix Grammar",
    prompt:
      "Fix all grammatical errors in the following text. Do not change the meaning. Do not add any extra explanations. Return only the corrected text.",
    quickAccess: true,
  },
  {
    id: "builtin-translate",
    name: "Any to English",
    prompt:
      "Detect the source language automatically. Translate the text into natural American English. Preserve meaning, tone, and style. Do not add any explanations. Return only the translated text.",
    quickAccess: true,
  },
  {
    id: "builtin-summarize",
    name: "Summarize",
    prompt:
      "Summarize the following text into 2-3 concise sentences. Capture the key points and main idea. Do not add opinions or extra context. Return only the summary.",
    quickAccess: false,
  },
  {
    id: "builtin-professional",
    name: "Make Professional",
    prompt:
      "Rewrite the following text in a clear, professional tone suitable for business communication. Keep the original meaning and key details. Do not add extra information. Return only the rewritten text.",
    quickAccess: false,
  },
  {
    id: "builtin-code-format",
    name: "Format as Code",
    prompt:
      "Format the following as clean, readable code. Apply proper indentation, spacing, and line breaks. If the language is ambiguous, infer it from context. Return only the formatted code without explanation.",
    quickAccess: false,
  },
  {
    id: "builtin-bullet-points",
    name: "Bullet Points",
    prompt:
      "Convert the following text into a clear bulleted list. Each bullet should be one concise point. Preserve all key information. Return only the bulleted list.",
    quickAccess: false,
  },
  {
    id: "builtin-simplify",
    name: "Simplify",
    prompt:
      "Rewrite the following text in plain, simple language that anyone can understand. Use short sentences. Avoid jargon and complex words. Do not change the meaning. Return only the simplified text.",
    quickAccess: false,
  },
  {
    id: "builtin-make-shorter",
    name: "Make Shorter",
    prompt:
      "Condense the following text to roughly half its length. Keep all essential information and meaning. Remove filler words and redundant phrases. Return only the shortened text.",
    quickAccess: false,
  },
  {
    id: "builtin-explain",
    name: "Explain This",
    prompt:
      "Explain the following text in simple terms as if to someone unfamiliar with the topic. Be brief and clear. Return only the explanation.",
    quickAccess: false,
  },
  {
    id: "builtin-extract-data",
    name: "Extract Key Data",
    prompt:
      "Extract all key data points from the following text: names, dates, numbers, URLs, emails, and other structured information. Return as a clean, organized list.",
    quickAccess: false,
  },
  // Vision prompts
  {
    id: "builtin-read-text",
    name: "Read Text",
    prompt:
      "Extract all text from this image exactly as written. Preserve layout and formatting where possible.",
    quickAccess: true,
    type: "image",
  },
  {
    id: "builtin-describe",
    name: "Describe Image",
    prompt: "Describe what you see in this image in detail.",
    quickAccess: true,
    type: "image",
  },
  {
    id: "builtin-extract-image-data",
    name: "Extract Data",
    prompt:
      "Extract structured data (tables, lists, key-value pairs) from this image. Return as organized plain text.",
    quickAccess: false,
    type: "image",
  },
  {
    id: "builtin-summarize-image",
    name: "Summarize Image",
    prompt: "Summarize the content of this image in a few sentences.",
    quickAccess: false,
    type: "image",
  },
  {
    id: "builtin-translate-image",
    name: "Translate Image Text",
    prompt:
      "Extract text from this image and translate it to English. Return only the translated text.",
    quickAccess: false,
    type: "image",
  },
];

export type OverlayPosition = "cursor" | "top-center" | "bottom-center";
export type OverlayDuration = "quick" | "comfortable" | "visible";
export type OverlayAnimation = "fade-down" | "fade-up" | "fade" | "scale-down" | "pop" | "blur";

export const OVERLAY_DURATION_MS: Record<OverlayDuration, number> = {
  quick: 350,
  comfortable: 1000,
  visible: 2500,
};

export type OpenAIModel = "gpt-5.4-nano" | "gpt-5.4-mini";
export type GeminiModel = "gemini-2.5-flash-lite" | "gemini-2.5-flash";
export type AnthropicModel = "claude-haiku-4-5" | "claude-sonnet-4-6";
export type DeepSeekModel = "deepseek-chat" | "deepseek-reasoner";
export type AIProvider = "openai" | "gemini" | "anthropic" | "deepseek" | "local";
export type CloudProvider = Exclude<AIProvider, "local">;
export const CLOUD_PROVIDERS: readonly CloudProvider[] = [
  "openai",
  "gemini",
  "anthropic",
  "deepseek",
];

function hasLegacyApiKeys(raw: Record<string, unknown>): boolean {
  return CLOUD_PROVIDERS.some((provider) => {
    const value = raw[`${provider}Key`];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export const FONT_SIZE_PX: Record<FontSize, number> = {
  compact: 11,
  small: 12,
  default: 13,
  large: 14,
  larger: 16,
  largest: 18,
};

export const UI_FONTS = [
  { value: "system", label: "System Default", family: '"Segoe UI", -apple-system, sans-serif' },
  { value: "inter", label: "Inter", family: '"Inter", sans-serif' },
  { value: "opensans", label: "Open Sans", family: '"Open Sans", sans-serif' },
  { value: "montserrat", label: "Montserrat", family: '"Montserrat", sans-serif' },
  { value: "noto", label: "Noto Sans", family: '"Noto Sans", sans-serif' },
  { value: "verdana", label: "Verdana", family: "Verdana, sans-serif" },
  { value: "tahoma", label: "Tahoma", family: "Tahoma, sans-serif" },
  { value: "arial", label: "Arial", family: "Arial, sans-serif" },
] as const;

export const CODE_FONTS = [
  { value: "consolas", label: "Consolas", family: '"Consolas", monospace' },
  { value: "cascadia", label: "Cascadia Mono", family: '"Cascadia Mono", monospace' },
  { value: "jetbrains", label: "JetBrains Mono", family: '"JetBrains Mono", monospace' },
  { value: "courier", label: "Courier New", family: '"Courier New", monospace' },
  { value: "lucida", label: "Lucida Console", family: '"Lucida Console", monospace' },
] as const;

const VALID_UI_FONTS: string[] = UI_FONTS.map((f) => f.value);
const VALID_CODE_FONTS: string[] = CODE_FONTS.map((f) => f.value);

export function resolveUIFontFamily(value: string): string {
  return UI_FONTS.find((f) => f.value === value)?.family ?? UI_FONTS[0].family;
}

export function resolveCodeFontFamily(value: string): string {
  return CODE_FONTS.find((f) => f.value === value)?.family ?? CODE_FONTS[0].family;
}

export interface AppSettings {
  maxHistorySize: number;
  hotkey: string;
  plainTextHotkey: string;
  autostart: boolean;
  autoUpdateEnabled: boolean;
  theme: string;
  autoDeleteDays: number;
  language: Language;
  pasteMode: PasteMode;
  pasteFormat: PasteFormat;
  accentColor: string;
  fontSize: FontSize;
  uiFont: string;
  codeFont: string;
  windowEffect: WindowEffect;
  aiProvider: AIProvider;
  openaiModel: OpenAIModel;
  geminiModel: GeminiModel;
  anthropicModel: AnthropicModel;
  deepseekModel: DeepSeekModel;
  localEndpoint: string;
  localModel: string;
  customAIPrompts: CustomAIPrompt[];
  alwaysOnTop: boolean;
  windowMode: WindowMode;
  windowPosition: WindowPosition;
  shortcutPinWindow: string;
  shortcutFollowCursor: string;
  rememberTypeFilter: boolean;
  showCopiedOverlay: boolean;
  overlayPosition: OverlayPosition;
  overlayDuration: OverlayDuration;
  overlayAnimation: OverlayAnimation;
}

export const SETTINGS_KEY = "beetroot_settings";

const SUPPORTED_LANGS: Language[] = [
  "en",
  "ru",
  "de",
  "es",
  "zh",
  "ja",
  "fr",
  "pt",
  "ko",
  "tr",
  "it",
  "pl",
  "nl",
  "uk",
  "th",
  "hi",
  "id",
  "vi",
  "cs",
  "hu",
  "ro",
  "sv",
  "da",
  "fi",
  "nb",
  "ms",
];

function detectLanguage(): Language {
  try {
    const tag = navigator.language.split("-")[0].toLowerCase();
    if (SUPPORTED_LANGS.includes(tag as Language)) return tag as Language;
  } catch {
    // navigator.language unavailable
  }
  return "en";
}

const defaults: AppSettings = {
  maxHistorySize: DEFAULT_MAX_HISTORY,
  hotkey: "Ctrl+Backquote",
  plainTextHotkey: "",
  autostart: true,
  autoUpdateEnabled: true,
  theme: "auto",
  autoDeleteDays: 0,
  language: detectLanguage(),
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
};

/** Map legacy symbol characters to e.code names for hotkey normalization. */
const SYMBOL_TO_CODE: Record<string, string> = {
  "`": "Backquote",
  ";": "Semicolon",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  "-": "Minus",
  "=": "Equal",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  "'": "Quote",
  "<": "IntlBackslash",
};

/** Normalize a hotkey string from legacy symbol format to e.code format.
 *  "Ctrl+`" → "Ctrl+Backquote", "Alt+V" → "Alt+KeyV" */
function normalizeHotkey(hotkey: string): string {
  const parts = hotkey.split("+");
  const key = parts[parts.length - 1];
  if (key.length === 1) {
    if (key in SYMBOL_TO_CODE) {
      parts[parts.length - 1] = SYMBOL_TO_CODE[key];
    } else if (/^[A-Z]$/i.test(key)) {
      parts[parts.length - 1] = `Key${key.toUpperCase()}`;
    } else if (/^[0-9]$/.test(key)) {
      parts[parts.length - 1] = `Digit${key}`;
    }
  }
  return parts.join("+");
}

/** Validate hotkey format: modifier(s)+key.
 *  Accepts both legacy symbol format ("Ctrl+V", "Alt+;") and
 *  new e.code format ("Ctrl+KeyV", "Alt+Semicolon"). */
const HOTKEY_RE =
  /^(Ctrl|Alt|AltGr|Shift|Super|Win|Cmd)(\+(Ctrl|Alt|AltGr|Shift|Super|Win|Cmd))*\+([A-Za-z0-9`;,./'=<[\]\\-]|Key[A-Z]|Digit[0-9]|F[1-9]|F1[0-2]|Space|Backquote|Semicolon|Comma|Period|Slash|Minus|Equal|BracketLeft|BracketRight|Backslash|Quote|IntlBackslash)$/;

function isValidHotkey(value: string): boolean {
  return (
    value.length <= 50 &&
    HOTKEY_RE.test(value) &&
    value
      .split("+")
      .slice(0, -1)
      .some((modifier) => modifier !== "Shift")
  );
}
const VALID_THEME_IDS = ["auto", ...themes.map((t) => t.id)];
const VALID_LANGUAGES = SUPPORTED_LANGS;
const VALID_PASTE_MODES: PasteMode[] = ["auto", "copy"];
const VALID_PASTE_FORMATS: PasteFormat[] = ["plain", "original"];
const VALID_FONT_SIZES: FontSize[] = ["compact", "small", "default", "large", "larger", "largest"];
const VALID_WINDOW_EFFECTS: WindowEffect[] = ["mica", "acrylic", "solid"];
const WINDOW_EFFECT_MIGRATION: Record<string, WindowEffect> = {
  glass: "mica",
  blur: "mica",
};
const OPENAI_MODEL_MIGRATION: Record<string, OpenAIModel> = {
  "gpt-5-nano": "gpt-5.4-nano",
  "gpt-5-mini": "gpt-5.4-mini",
};
const VALID_OPENAI_MODELS: OpenAIModel[] = ["gpt-5.4-nano", "gpt-5.4-mini"];
const VALID_GEMINI_MODELS: GeminiModel[] = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const VALID_ANTHROPIC_MODELS: AnthropicModel[] = ["claude-haiku-4-5", "claude-sonnet-4-6"];
const VALID_DEEPSEEK_MODELS: DeepSeekModel[] = ["deepseek-chat", "deepseek-reasoner"];
const VALID_AI_PROVIDERS: AIProvider[] = ["openai", "gemini", "anthropic", "deepseek", "local"];
export const MAX_CUSTOM_PROMPTS = 20;

/** Validate and extract only known settings fields with safe values */
function sanitize(raw: Record<string, unknown>): Partial<AppSettings> {
  const result: Partial<AppSettings> = {};

  if (
    typeof raw.maxHistorySize === "number" &&
    raw.maxHistorySize >= 0 &&
    raw.maxHistorySize <= MAX_HISTORY_LIMIT
  ) {
    result.maxHistorySize = raw.maxHistorySize;
  }
  if (typeof raw.hotkey === "string" && isValidHotkey(raw.hotkey)) {
    result.hotkey = normalizeHotkey(raw.hotkey);
  }
  if (typeof raw.plainTextHotkey === "string") {
    if (raw.plainTextHotkey === "" || isValidHotkey(raw.plainTextHotkey)) {
      result.plainTextHotkey = normalizeHotkey(raw.plainTextHotkey);
    }
  }
  if (typeof raw.autostart === "boolean") {
    result.autostart = raw.autostart;
  }
  if (typeof raw.autoUpdateEnabled === "boolean") {
    result.autoUpdateEnabled = raw.autoUpdateEnabled;
  }
  if (typeof raw.alwaysOnTop === "boolean") {
    result.alwaysOnTop = raw.alwaysOnTop;
  }
  if (typeof raw.rememberTypeFilter === "boolean") {
    result.rememberTypeFilter = raw.rememberTypeFilter;
  }
  if (typeof raw.showCopiedOverlay === "boolean") {
    result.showCopiedOverlay = raw.showCopiedOverlay;
  }
  const VALID_OVERLAY_POSITIONS: OverlayPosition[] = ["cursor", "top-center", "bottom-center"];
  if (
    typeof raw.overlayPosition === "string" &&
    VALID_OVERLAY_POSITIONS.includes(raw.overlayPosition as OverlayPosition)
  ) {
    result.overlayPosition = raw.overlayPosition as OverlayPosition;
  }
  const VALID_OVERLAY_DURATIONS: OverlayDuration[] = ["quick", "comfortable", "visible"];
  if (
    typeof raw.overlayDuration === "string" &&
    VALID_OVERLAY_DURATIONS.includes(raw.overlayDuration as OverlayDuration)
  ) {
    result.overlayDuration = raw.overlayDuration as OverlayDuration;
  }
  const VALID_OVERLAY_ANIMATIONS: OverlayAnimation[] = [
    "fade-down",
    "fade-up",
    "fade",
    "scale-down",
    "pop",
    "blur",
  ];
  if (
    typeof raw.overlayAnimation === "string" &&
    VALID_OVERLAY_ANIMATIONS.includes(raw.overlayAnimation as OverlayAnimation)
  ) {
    result.overlayAnimation = raw.overlayAnimation as OverlayAnimation;
  }
  const VALID_WINDOW_MODES: WindowMode[] = ["normal", "pinned", "follow-cursor"];
  if (
    typeof raw.windowMode === "string" &&
    VALID_WINDOW_MODES.includes(raw.windowMode as WindowMode)
  ) {
    result.windowMode = raw.windowMode as WindowMode;
    // Derive alwaysOnTop from windowMode
    result.alwaysOnTop = result.windowMode === "pinned";
  } else if (result.alwaysOnTop) {
    // Backward-compat migration: alwaysOnTop true but no windowMode → pinned
    result.windowMode = "pinned";
  }
  const VALID_WINDOW_POSITIONS: WindowPosition[] = [
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];
  if (
    typeof raw.windowPosition === "string" &&
    VALID_WINDOW_POSITIONS.includes(raw.windowPosition as WindowPosition)
  ) {
    result.windowPosition = raw.windowPosition as WindowPosition;
  }
  if (typeof raw.theme === "string") {
    if (VALID_THEME_IDS.includes(raw.theme)) {
      result.theme = raw.theme;
    } else if (raw.theme in THEME_MIGRATION_MAP) {
      result.theme = THEME_MIGRATION_MAP[raw.theme];
    }
  }
  if (typeof raw.autoDeleteDays === "number" && [0, 1, 7, 30].includes(raw.autoDeleteDays)) {
    result.autoDeleteDays = raw.autoDeleteDays;
  }
  if (typeof raw.language === "string" && VALID_LANGUAGES.includes(raw.language as Language)) {
    result.language = raw.language as Language;
  }
  if (typeof raw.pasteMode === "string" && VALID_PASTE_MODES.includes(raw.pasteMode as PasteMode)) {
    result.pasteMode = raw.pasteMode as PasteMode;
  }
  if (
    typeof raw.pasteFormat === "string" &&
    VALID_PASTE_FORMATS.includes(raw.pasteFormat as PasteFormat)
  ) {
    result.pasteFormat = raw.pasteFormat as PasteFormat;
  }
  if (typeof raw.fontSize === "string" && VALID_FONT_SIZES.includes(raw.fontSize as FontSize)) {
    result.fontSize = raw.fontSize as FontSize;
  }
  if (typeof raw.uiFont === "string" && VALID_UI_FONTS.includes(raw.uiFont)) {
    result.uiFont = raw.uiFont;
  }
  if (typeof raw.codeFont === "string" && VALID_CODE_FONTS.includes(raw.codeFont)) {
    result.codeFont = raw.codeFont;
  }
  if (typeof raw.windowEffect === "string") {
    if (VALID_WINDOW_EFFECTS.includes(raw.windowEffect as WindowEffect)) {
      result.windowEffect = raw.windowEffect as WindowEffect;
    } else if (raw.windowEffect in WINDOW_EFFECT_MIGRATION) {
      result.windowEffect = WINDOW_EFFECT_MIGRATION[raw.windowEffect];
    }
  }
  // Migrate old customColors to accentColor
  if (
    raw.customColors &&
    typeof raw.customColors === "object" &&
    !Array.isArray(raw.customColors)
  ) {
    const cc = raw.customColors as Record<string, unknown>;
    const accent = cc["--accent-main"] ?? cc["--accent"];
    if (typeof accent === "string" && HEX_COLOR_RE.test(accent)) {
      result.accentColor = accent;
    }
  }
  if (typeof raw.accentColor === "string") {
    if (raw.accentColor === "" || HEX_COLOR_RE.test(raw.accentColor)) {
      result.accentColor = raw.accentColor;
    }
  }
  if (
    typeof raw.aiProvider === "string" &&
    VALID_AI_PROVIDERS.includes(raw.aiProvider as AIProvider)
  ) {
    result.aiProvider = raw.aiProvider as AIProvider;
  }
  if (typeof raw.openaiModel === "string") {
    // Migrate legacy model names (gpt-5-nano → gpt-5.4-nano, gpt-5-mini → gpt-5.4-mini)
    const migrated = OPENAI_MODEL_MIGRATION[raw.openaiModel] ?? raw.openaiModel;
    if (VALID_OPENAI_MODELS.includes(migrated as OpenAIModel)) {
      result.openaiModel = migrated as OpenAIModel;
    }
  }
  if (
    typeof raw.geminiModel === "string" &&
    VALID_GEMINI_MODELS.includes(raw.geminiModel as GeminiModel)
  ) {
    result.geminiModel = raw.geminiModel as GeminiModel;
  }
  if (
    typeof raw.anthropicModel === "string" &&
    VALID_ANTHROPIC_MODELS.includes(raw.anthropicModel as AnthropicModel)
  ) {
    result.anthropicModel = raw.anthropicModel as AnthropicModel;
  }
  if (
    typeof raw.deepseekModel === "string" &&
    VALID_DEEPSEEK_MODELS.includes(raw.deepseekModel as DeepSeekModel)
  ) {
    result.deepseekModel = raw.deepseekModel as DeepSeekModel;
  }
  if (typeof raw.localEndpoint === "string") {
    const endpoint = normalizeLocalEndpoint(raw.localEndpoint);
    if (endpoint !== null) result.localEndpoint = endpoint;
  }
  if (typeof raw.localModel === "string" && raw.localModel.length <= 100) {
    result.localModel = raw.localModel.trim();
  }
  if (Array.isArray(raw.customAIPrompts)) {
    const validated: CustomAIPrompt[] = [];
    const quickAccessCount: Record<string, number> = { text: 0, image: 0 };
    for (const item of raw.customAIPrompts) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        item.id.length > 0 &&
        item.id.length <= 36 &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        item.name.length <= 20 &&
        typeof item.prompt === "string" &&
        item.prompt.trim().length > 0 &&
        item.prompt.length <= 500 &&
        validated.length < MAX_CUSTOM_PROMPTS
      ) {
        const itemType = item.type === "image" ? "image" : "text";
        const qa =
          item.quickAccess === true && quickAccessCount[itemType] < MAX_QUICK_ACCESS_PROMPTS;
        if (qa) quickAccessCount[itemType]++;
        validated.push({
          id: item.id,
          name: item.name,
          prompt: item.prompt,
          quickAccess: qa,
          type: item.type === "image" ? "image" : "text",
        });
      }
    }
    result.customAIPrompts = validated;
  }
  // Local shortcut fields (optional, empty = disabled)
  for (const field of ["shortcutPinWindow", "shortcutFollowCursor"] as const) {
    if (typeof raw[field] === "string") {
      if (raw[field] === "") {
        result[field] = "";
      } else if (isValidHotkey(raw[field])) {
        result[field] = normalizeHotkey(raw[field]);
      }
    }
  }
  return result;
}

/** Load settings from localStorage, sanitizing all fields. Returns defaults for missing/invalid values. */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const result = { ...defaults, ...sanitize(parsed) };
        // Populate default AI prompts only on first run (field never existed)
        if (result.customAIPrompts.length === 0 && !Array.isArray(parsed.customAIPrompts)) {
          result.customAIPrompts = DEFAULT_AI_PROMPTS.map((p) => ({ ...p }));
        } else if (result.customAIPrompts.length > 0) {
          // Merge: add missing builtins, update existing ones (builtins are read-only in UI)
          const existingIds = new Set(result.customAIPrompts.map((p) => p.id));
          for (const bp of DEFAULT_AI_PROMPTS) {
            if (!existingIds.has(bp.id)) {
              // Skip if user has a custom prompt with same name
              const nameExists = result.customAIPrompts.some(
                (p) => p.name.toLowerCase() === bp.name.toLowerCase(),
              );
              if (!nameExists && result.customAIPrompts.length < MAX_CUSTOM_PROMPTS) {
                result.customAIPrompts.push({ ...bp });
              }
            } else {
              // Auto-update builtin prompt text (safe — builtins are read-only in UI)
              const idx = result.customAIPrompts.findIndex((p) => p.id === bp.id);
              if (idx !== -1) {
                result.customAIPrompts[idx].name = bp.name;
                result.customAIPrompts[idx].prompt = bp.prompt;
                result.customAIPrompts[idx].type = bp.type;
              }
            }
          }
        }
        return result;
      }
    }
  } catch {
    // ignore
  }
  return { ...defaults, customAIPrompts: DEFAULT_AI_PROMPTS.map((p) => ({ ...p })) };
}

/** Accept loopback shorthand while preserving already valid endpoint spelling. */
export function normalizeLocalEndpoint(endpoint: string): string | null {
  if (endpoint.length > 200) return null;
  const trimmed = endpoint.trim();
  if (!trimmed) return "";
  try {
    const canonical = /^(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(trimmed)
      ? `http://${trimmed}`
      : trimmed;
    if (canonical.length > 200) return null;
    const url = new URL(canonical);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      return null;
    return canonical;
  } catch {
    return null;
  }
}

/** Persist the public settings. False means callers must retain saved state. */
export function saveSettings(settings: AppSettings): boolean {
  try {
    const localEndpoint = normalizeLocalEndpoint(settings.localEndpoint);
    if (localEndpoint === null) return false;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        hasLegacyApiKeys(parsed as Record<string, unknown>)
      ) {
        return false;
      }
    }
    const publicSettings: Record<string, unknown> = { ...settings, localEndpoint };
    for (const provider of CLOUD_PROVIDERS) delete publicSettings[`${provider}Key`];
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(publicSettings));
    return true;
  } catch (e) {
    if (typeof console !== "undefined") {
      console.error(
        "[settings] saveSettings failed:",
        e instanceof Error ? e.name : "Storage error",
      );
    }
    return false;
  }
}
