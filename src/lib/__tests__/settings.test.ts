import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings, DEFAULT_AI_PROMPTS, type AppSettings } from "../settings";

beforeEach(() => {
  localStorage.clear();
});

describe("loadSettings", () => {
  it("returns defaults when no saved settings", () => {
    const s = loadSettings();
    expect(s.maxHistorySize).toBe(500);
    expect(s.hotkey).toBe("Ctrl+Backquote");
    expect(s.autostart).toBe(true);
    expect(s.theme).toBe("auto");
  });

  it("loads saved settings from localStorage", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({ maxHistorySize: 100, theme: "gruvbox-hard" }),
    );
    const s = loadSettings();
    expect(s.maxHistorySize).toBe(100);
    expect(s.theme).toBe("gruvbox-hard");
    // defaults for unset fields
    expect(s.hotkey).toBe("Ctrl+Backquote");
    expect(s.autostart).toBe(true);
  });

  it("returns defaults on corrupted JSON", () => {
    localStorage.setItem("beetroot_settings", "not-json!!!");
    const s = loadSettings();
    expect(s.maxHistorySize).toBe(500);
    expect(s.theme).toBe("auto");
  });

  it("merges partial settings with defaults", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ autostart: true }));
    const s = loadSettings();
    expect(s.autostart).toBe(true);
    expect(s.maxHistorySize).toBe(500);
    expect(s.hotkey).toBe("Ctrl+Backquote");
    expect(s.theme).toBe("auto");
  });

  it("migrates old theme ids to new ones", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ theme: "mocha" }));
    expect(loadSettings().theme).toBe("tokyo-storm");

    localStorage.setItem("beetroot_settings", JSON.stringify({ theme: "latte" }));
    expect(loadSettings().theme).toBe("github-light");

    localStorage.setItem("beetroot_settings", JSON.stringify({ theme: "dracula" }));
    expect(loadSettings().theme).toBe("gruvbox-hard");

    localStorage.setItem("beetroot_settings", JSON.stringify({ theme: "nord" }));
    expect(loadSettings().theme).toBe("nord-snow");
  });

  it("migrates old customColors accent to accentColor", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({
        customColors: {
          "--accent-main": "#ff5500",
        },
      }),
    );
    const s = loadSettings();
    expect(s.accentColor).toBe("#ff5500");
  });
});

describe("saveSettings", () => {
  it("persists settings to localStorage", () => {
    const settings: AppSettings = {
      maxHistorySize: 250,
      hotkey: "Alt+V",
      plainTextHotkey: "",
      autostart: true,
      autoUpdateEnabled: true,
      theme: "tokyo-storm",
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
    };
    saveSettings(settings);
    const raw = localStorage.getItem("beetroot_settings");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.maxHistorySize).toBe(250);
    expect(parsed.hotkey).toBe("Alt+V");
    expect(parsed.autostart).toBe(true);
    expect(parsed.theme).toBe("tokyo-storm");
  });

  it("round-trips AI settings fields", () => {
    const settings: AppSettings = {
      maxHistorySize: 500,
      hotkey: "Ctrl+`",
      plainTextHotkey: "",
      autostart: false,
      autoUpdateEnabled: true,
      theme: "tokyo-storm",
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

      openaiModel: "gpt-5.4-mini",

      geminiModel: "gemini-2.5-flash-lite",

      anthropicModel: "claude-haiku-4-5",

      deepseekModel: "deepseek-chat",
      localEndpoint: "http://127.0.0.1:1234",
      localModel: "",
      customAIPrompts: [{ id: "abc", name: "My custom prompt", prompt: "Do something custom" }],
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
    saveSettings(settings);
    const loaded = loadSettings();
    expect(loaded).not.toHaveProperty("openaiKey");
    expect(loaded.openaiModel).toBe("gpt-5.4-mini");
    // 1 user prompt + 10 merged builtins
    expect(loaded.customAIPrompts).toHaveLength(1 + DEFAULT_AI_PROMPTS.length);
    expect(loaded.customAIPrompts[0].name).toBe("My custom prompt");
  });

  it("overwrites previous settings", () => {
    saveSettings({
      maxHistorySize: 100,
      hotkey: "Ctrl+`",
      plainTextHotkey: "",
      autostart: false,
      autoUpdateEnabled: true,
      theme: "tokyo-storm",
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
    });
    saveSettings({
      maxHistorySize: 1000,
      hotkey: "Alt+Space",
      plainTextHotkey: "",
      autostart: true,
      autoUpdateEnabled: true,
      theme: "gruvbox-hard",
      autoDeleteDays: 7,

      language: "ru",
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
    });
    const s = loadSettings();
    expect(s.maxHistorySize).toBe(1000);
    expect(s.theme).toBe("gruvbox-hard");
  });
});

describe("pasteFormat sanitization", () => {
  it("loads valid pasteFormat", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ pasteFormat: "original" }));
    const s = loadSettings();
    expect(s.pasteFormat).toBe("original");
  });

  it("rejects invalid pasteFormat", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ pasteFormat: "rich" }));
    const s = loadSettings();
    expect(s.pasteFormat).toBe("plain");
  });

  it("defaults to plain when not set", () => {
    const s = loadSettings();
    expect(s.pasteFormat).toBe("plain");
  });
});

describe("AI settings sanitization", () => {
  it("rejects invalid openaiModel", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ openaiModel: "gpt-4-turbo" }));
    const s = loadSettings();
    expect(s.openaiModel).toBe("gpt-5.4-nano");
  });

  it("loads valid openaiModel", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ openaiModel: "gpt-5.4-mini" }));
    const s = loadSettings();
    expect(s.openaiModel).toBe("gpt-5.4-mini");
  });

  it("migrates legacy gpt-5-nano to gpt-5.4-nano", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ openaiModel: "gpt-5-nano" }));
    const s = loadSettings();
    expect(s.openaiModel).toBe("gpt-5.4-nano");
  });

  it("migrates legacy gpt-5-mini to gpt-5.4-mini", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ openaiModel: "gpt-5-mini" }));
    const s = loadSettings();
    expect(s.openaiModel).toBe("gpt-5.4-mini");
  });

  it("sanitizes customAIPrompts — rejects invalid entries", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({
        customAIPrompts: [
          { id: "abc", name: "Test", prompt: "Fix grammar" },
          { id: "", name: "", prompt: "" },
          "not-an-object",
        ],
      }),
    );
    const s = loadSettings();
    // 1 valid user prompt + merged builtins
    expect(s.customAIPrompts).toHaveLength(1 + DEFAULT_AI_PROMPTS.length);
    expect(s.customAIPrompts[0].name).toBe("Test");
  });

  it("limits customAIPrompts to 20 before builtin merge", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `id-${i}`,
      name: `Prompt ${i}`,
      prompt: `Do thing ${i}`,
    }));
    localStorage.setItem("beetroot_settings", JSON.stringify({ customAIPrompts: many }));
    const s = loadSettings();
    // 20 user prompts (sanitized limit) + 10 builtins merged
    expect(s.customAIPrompts.length).toBeLessThanOrEqual(20 + DEFAULT_AI_PROMPTS.length);
  });

  it("does not expose non-string legacy openaiKey", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ openaiKey: 12345 }));
    const s = loadSettings();
    expect(s).not.toHaveProperty("openaiKey");
  });

  it("does not expose a long legacy openaiKey", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ openaiKey: "x".repeat(201) }));
    const s = loadSettings();
    expect(s).not.toHaveProperty("openaiKey");
  });
});

describe("windowEffect sanitization", () => {
  it("loads valid windowEffect", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ windowEffect: "acrylic" }));
    const s = loadSettings();
    expect(s.windowEffect).toBe("acrylic");
  });

  it("loads solid windowEffect", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ windowEffect: "solid" }));
    const s = loadSettings();
    expect(s.windowEffect).toBe("solid");
  });

  it("rejects invalid windowEffect", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ windowEffect: "invalid" }));
    const s = loadSettings();
    expect(s.windowEffect).toBe("mica");
  });

  it("defaults to mica when not set", () => {
    const s = loadSettings();
    expect(s.windowEffect).toBe("mica");
  });

  it("migrates glass to mica", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ windowEffect: "glass" }));
    const s = loadSettings();
    expect(s.windowEffect).toBe("mica");
  });

  it("migrates blur to mica", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ windowEffect: "blur" }));
    const s = loadSettings();
    expect(s.windowEffect).toBe("mica");
  });
});

describe("font sanitization", () => {
  it("loads valid fontSize including new compact/larger/largest", () => {
    for (const size of ["compact", "small", "default", "large", "larger", "largest"]) {
      localStorage.setItem("beetroot_settings", JSON.stringify({ fontSize: size }));
      expect(loadSettings().fontSize).toBe(size);
    }
  });

  it("rejects invalid fontSize", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ fontSize: "huge" }));
    expect(loadSettings().fontSize).toBe("default");
  });

  it("loads valid uiFont", () => {
    for (const font of ["system", "inter", "noto", "verdana", "tahoma", "arial"]) {
      localStorage.setItem("beetroot_settings", JSON.stringify({ uiFont: font }));
      expect(loadSettings().uiFont).toBe(font);
    }
  });

  it("rejects invalid uiFont", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ uiFont: "comic-sans" }));
    expect(loadSettings().uiFont).toBe("system");
  });

  it("defaults uiFont to system when not set", () => {
    expect(loadSettings().uiFont).toBe("system");
  });

  it("loads valid codeFont", () => {
    for (const font of ["consolas", "cascadia", "jetbrains", "courier", "lucida"]) {
      localStorage.setItem("beetroot_settings", JSON.stringify({ codeFont: font }));
      expect(loadSettings().codeFont).toBe(font);
    }
  });

  it("rejects invalid codeFont", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ codeFont: "papyrus" }));
    expect(loadSettings().codeFont).toBe("consolas");
  });

  it("defaults codeFont to consolas when not set", () => {
    expect(loadSettings().codeFont).toBe("consolas");
  });
});

describe("default AI prompts", () => {
  it("populates default prompts on fresh load", () => {
    const s = loadSettings();
    expect(s.customAIPrompts.length).toBe(DEFAULT_AI_PROMPTS.length);
    expect(s.customAIPrompts[0].id).toBe("builtin-grammar");
  });

  it("populates default prompts when no customAIPrompts key in saved settings", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ theme: "gruvbox-hard" }));
    const s = loadSettings();
    expect(s.customAIPrompts.length).toBe(DEFAULT_AI_PROMPTS.length);
  });

  it("keeps empty array when user explicitly saved empty prompts", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ customAIPrompts: [] }));
    const s = loadSettings();
    expect(s.customAIPrompts).toHaveLength(0);
  });

  it("merges builtins into user-saved prompts", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({
        customAIPrompts: [{ id: "user-1", name: "My prompt", prompt: "Do something" }],
      }),
    );
    const s = loadSettings();
    // 1 user prompt + 10 builtins
    expect(s.customAIPrompts).toHaveLength(1 + DEFAULT_AI_PROMPTS.length);
    expect(s.customAIPrompts[0].id).toBe("user-1");
    expect(s.customAIPrompts[1].id).toBe(DEFAULT_AI_PROMPTS[0].id);
  });

  it("does not duplicate builtins when user has prompt with same name", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({
        customAIPrompts: [
          { id: "user-grammar", name: "Fix Grammar", prompt: "My custom grammar fix" },
          { id: "user-translate", name: "any to english", prompt: "My custom translate" },
        ],
      }),
    );
    const s = loadSettings();
    // 2 user prompts + 8 builtins (Fix Grammar and Any to English skipped by name match)
    expect(s.customAIPrompts).toHaveLength(2 + DEFAULT_AI_PROMPTS.length - 2);
    const names = s.customAIPrompts.map((p) => p.name.toLowerCase());
    const grammarCount = names.filter((n) => n === "fix grammar").length;
    const translateCount = names.filter((n) => n === "any to english").length;
    expect(grammarCount).toBe(1);
    expect(translateCount).toBe(1);
  });
});

describe("hotkey sanitization", () => {
  it.each(["Shift+KeyV", "Shift+Space", "Shift+Digit1", "Shift+Shift+V", "KeyV"])(
    "rejects unsafe shortcut %s in every shortcut setting",
    (hotkey) => {
      localStorage.setItem(
        "beetroot_settings",
        JSON.stringify({
          hotkey,
          plainTextHotkey: hotkey,
          shortcutPinWindow: hotkey,
          shortcutFollowCursor: hotkey,
        }),
      );
      const settings = loadSettings();
      expect(settings.hotkey).toBe("Ctrl+Backquote");
      expect(settings.plainTextHotkey).toBe("");
      expect(settings.shortcutPinWindow).toBe("Alt+KeyP");
      expect(settings.shortcutFollowCursor).toBe("Alt+KeyF");
    },
  );

  it("accepts Shift before a command modifier", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Shift+Ctrl+KeyV" }));
    expect(loadSettings().hotkey).toBe("Shift+Ctrl+KeyV");
  });

  it("normalizes legacy symbol hotkeys to e.code format", () => {
    const cases: [string, string][] = [
      [";", "Semicolon"],
      [",", "Comma"],
      [".", "Period"],
      ["/", "Slash"],
      ["-", "Minus"],
      ["=", "Equal"],
      ["[", "BracketLeft"],
      ["]", "BracketRight"],
      ["'", "Quote"],
      ["<", "IntlBackslash"],
    ];
    for (const [symbol, code] of cases) {
      localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: `Ctrl+${symbol}` }));
      expect(loadSettings().hotkey).toBe(`Ctrl+${code}`);
    }
  });

  it("normalizes legacy backslash hotkey", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+\\" }));
    expect(loadSettings().hotkey).toBe("Ctrl+Backslash");
  });

  it("normalizes legacy backtick to Backquote", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+`" }));
    expect(loadSettings().hotkey).toBe("Ctrl+Backquote");
  });

  it("normalizes legacy letter hotkeys to Key* format", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Alt+V" }));
    expect(loadSettings().hotkey).toBe("Alt+KeyV");

    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+a" }));
    expect(loadSettings().hotkey).toBe("Ctrl+KeyA");
  });

  it("normalizes legacy digit hotkeys to Digit* format", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+1" }));
    expect(loadSettings().hotkey).toBe("Ctrl+Digit1");
  });

  it("rejects invalid hotkey", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+Delete" }));
    expect(loadSettings().hotkey).toBe("Ctrl+Backquote");
  });

  it("normalizes plainTextHotkey too", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ plainTextHotkey: "Alt+;" }));
    expect(loadSettings().plainTextHotkey).toBe("Alt+Semicolon");
  });

  it("preserves e.code format hotkeys as-is", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+KeyV" }));
    expect(loadSettings().hotkey).toBe("Ctrl+KeyV");

    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Alt+KeyA" }));
    expect(loadSettings().hotkey).toBe("Alt+KeyA");

    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+Digit1" }));
    expect(loadSettings().hotkey).toBe("Ctrl+Digit1");

    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+Shift+KeyZ" }));
    expect(loadSettings().hotkey).toBe("Ctrl+Shift+KeyZ");
  });

  it("preserves e.code punctuation names as-is", () => {
    const codeNames = [
      "Semicolon",
      "Comma",
      "Period",
      "Slash",
      "Minus",
      "Equal",
      "BracketLeft",
      "BracketRight",
      "Backslash",
      "Quote",
      "IntlBackslash",
    ];
    for (const code of codeNames) {
      localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: `Ctrl+${code}` }));
      expect(loadSettings().hotkey).toBe(`Ctrl+${code}`);
    }
  });

  it("preserves Backquote as default hotkey format", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "Ctrl+Backquote" }));
    expect(loadSettings().hotkey).toBe("Ctrl+Backquote");
  });

  it("accepts AltGr modifier in hotkeys", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ hotkey: "AltGr+KeyV" }));
    expect(loadSettings().hotkey).toBe("AltGr+KeyV");
  });
});

describe("shortcut field sanitization", () => {
  it("defaults shortcutPinWindow when not set", () => {
    const s = loadSettings();
    expect(s.shortcutPinWindow).toBe("Alt+KeyP");
  });

  it("defaults shortcutFollowCursor when not set", () => {
    const s = loadSettings();
    expect(s.shortcutFollowCursor).toBe("Alt+KeyF");
  });

  it("loads valid shortcutPinWindow", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ shortcutPinWindow: "Ctrl+KeyX" }));
    expect(loadSettings().shortcutPinWindow).toBe("Ctrl+KeyX");
  });

  it("accepts empty string as disabled shortcut", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ shortcutPinWindow: "" }));
    expect(loadSettings().shortcutPinWindow).toBe("");
  });

  it("rejects invalid shortcut format", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ shortcutPinWindow: "invalid!" }));
    expect(loadSettings().shortcutPinWindow).toBe("Alt+KeyP");
  });

  it("rejects non-string shortcut", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ shortcutPinWindow: 42 }));
    expect(loadSettings().shortcutPinWindow).toBe("Alt+KeyP");
  });

  it("rejects null shortcut", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ shortcutPinWindow: null }));
    expect(loadSettings().shortcutPinWindow).toBe("Alt+KeyP");
  });

  it("normalizes legacy letter shortcuts", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ shortcutFollowCursor: "Alt+F" }));
    expect(loadSettings().shortcutFollowCursor).toBe("Alt+KeyF");
  });
});

describe("localEndpoint loopback validation", () => {
  it.each([
    "http://localhost:1234@remote.example",
    "http://127.0.0.1:1234@remote.example",
    "http://localhost:1234%40remote.example@remote.example",
    "http://localhost:1234@127.0.0.1:5678",
    "http://user:password@localhost:1234",
    "http://:password@[::1]:1234",
    "http://localhost.remote.example:1234",
    "http://localhost:invalid",
    "http://localhost:65536",
    "http://[::1]:1234@remote.example",
    "ftp://localhost:1234",
    "//localhost:1234",
  ])("rejects unsafe or malformed endpoint %s", (localEndpoint) => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ localEndpoint }));
    expect(loadSettings().localEndpoint).toBe("http://127.0.0.1:1234");
  });

  it.each([
    "http://[::1]:1234",
    "https://[::1]:8443/",
    "https://127.0.0.1:8443/api",
    "http://localhost/api@v1",
    "HTTP://LOCALHOST:1234",
    "  http://localhost:1234/  ",
  ])("preserves valid loopback endpoint %s", (localEndpoint) => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ localEndpoint }));
    expect(loadSettings().localEndpoint).toBe(localEndpoint.trim());
  });

  it("accepts localhost endpoint", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({ localEndpoint: "http://localhost:1234" }),
    );
    expect(loadSettings().localEndpoint).toBe("http://localhost:1234");
  });

  it("accepts 127.0.0.1 endpoint", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({ localEndpoint: "http://127.0.0.1:1234" }),
    );
    expect(loadSettings().localEndpoint).toBe("http://127.0.0.1:1234");
  });

  it("accepts https localhost endpoint", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({ localEndpoint: "https://localhost:8443" }),
    );
    expect(loadSettings().localEndpoint).toBe("https://localhost:8443");
  });

  it("rejects remote URL", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({ localEndpoint: "http://evil.com:1234" }),
    );
    expect(loadSettings().localEndpoint).toBe("http://127.0.0.1:1234"); // default
  });

  it("rejects IP that is not 127.0.0.1", () => {
    localStorage.setItem(
      "beetroot_settings",
      JSON.stringify({ localEndpoint: "http://192.168.1.1:1234" }),
    );
    expect(loadSettings().localEndpoint).toBe("http://127.0.0.1:1234"); // default
  });

  it("accepts empty endpoint", () => {
    localStorage.setItem("beetroot_settings", JSON.stringify({ localEndpoint: "" }));
    expect(loadSettings().localEndpoint).toBe("");
  });
});
