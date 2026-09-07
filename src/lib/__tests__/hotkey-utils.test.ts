import { describe, it, expect } from "vitest";
import {
  isAllowedKeyCode,
  buildHotkey,
  displayHotkey,
  MODIFIER_MAP,
  applyAltGrStrip,
  DEFAULT_HOTKEY,
  CODE_DISPLAY,
} from "../hotkey-utils";

// ── Simulated AZERTY labels (from ToUnicodeEx / LABEL_CACHE) ──
// These mirror what the Rust backend returns for French AZERTY layout.
const AZERTY_LABELS: Record<string, string> = {
  KeyA: "q",
  KeyB: "b",
  KeyC: "c",
  KeyD: "d",
  KeyE: "e",
  KeyF: "f",
  KeyG: "g",
  KeyH: "h",
  KeyI: "i",
  KeyJ: "j",
  KeyK: "k",
  KeyL: "l",
  KeyM: ",",
  KeyN: "n",
  KeyO: "o",
  KeyP: "p",
  KeyQ: "a",
  KeyR: "r",
  KeyS: "s",
  KeyT: "t",
  KeyU: "u",
  KeyV: "v",
  KeyW: "z",
  KeyX: "x",
  KeyY: "y",
  KeyZ: "w",
  Digit1: "&",
  Digit2: "é",
  Digit3: '"',
  Digit4: "'",
  Digit5: "(",
  Digit6: "-",
  Digit7: "è",
  Digit8: "_",
  Digit9: "ç",
  Digit0: "à",
  Backquote: "²",
  Minus: ")",
  Equal: "=",
  BracketLeft: "^",
  BracketRight: "$",
  Backslash: "*",
  Semicolon: "m",
  Quote: "ù",
  Comma: ";",
  Period: ":",
  Slash: "!",
  IntlBackslash: "<",
};

// ── Simulated QWERTZ labels (German) ──
const QWERTZ_LABELS: Record<string, string> = {
  KeyY: "z",
  KeyZ: "y",
  Backquote: "^",
  Minus: "ß",
  BracketLeft: "ü",
  BracketRight: "+",
  Semicolon: "ö",
  Quote: "ä",
  Slash: "-",
};

describe("isAllowedKeyCode", () => {
  it("accepts letter codes KeyA-KeyZ", () => {
    expect(isAllowedKeyCode("KeyA")).toBe(true);
    expect(isAllowedKeyCode("KeyZ")).toBe(true);
    expect(isAllowedKeyCode("KeyM")).toBe(true);
  });

  it("accepts digit codes Digit0-Digit9", () => {
    expect(isAllowedKeyCode("Digit0")).toBe(true);
    expect(isAllowedKeyCode("Digit9")).toBe(true);
  });

  it("accepts function keys F1-F12", () => {
    expect(isAllowedKeyCode("F1")).toBe(true);
    expect(isAllowedKeyCode("F12")).toBe(true);
  });

  it("rejects F13 and above", () => {
    expect(isAllowedKeyCode("F13")).toBe(false);
    expect(isAllowedKeyCode("F20")).toBe(false);
  });

  it("accepts punctuation codes", () => {
    expect(isAllowedKeyCode("Backquote")).toBe(true);
    expect(isAllowedKeyCode("Slash")).toBe(true);
    expect(isAllowedKeyCode("IntlBackslash")).toBe(true);
    expect(isAllowedKeyCode("Space")).toBe(true);
    expect(isAllowedKeyCode("Semicolon")).toBe(true);
  });

  it("rejects modifier keys and navigation", () => {
    expect(isAllowedKeyCode("ControlLeft")).toBe(false);
    expect(isAllowedKeyCode("AltRight")).toBe(false);
    expect(isAllowedKeyCode("ShiftLeft")).toBe(false);
    expect(isAllowedKeyCode("Escape")).toBe(false);
    expect(isAllowedKeyCode("Enter")).toBe(false);
    expect(isAllowedKeyCode("Tab")).toBe(false);
    expect(isAllowedKeyCode("ArrowUp")).toBe(false);
  });

  it("rejects invalid/empty strings", () => {
    expect(isAllowedKeyCode("")).toBe(false);
    expect(isAllowedKeyCode("key")).toBe(false);
    expect(isAllowedKeyCode("KeyAB")).toBe(false);
    expect(isAllowedKeyCode("Digit10")).toBe(false);
  });
});

describe("buildHotkey", () => {
  it("builds Ctrl+code", () => {
    expect(buildHotkey(new Set(["Ctrl"]), "Backquote")).toBe("Ctrl+Backquote");
  });

  it("builds multi-modifier combos in canonical order", () => {
    expect(buildHotkey(new Set(["Shift", "Ctrl", "Alt"]), "KeyV")).toBe("Ctrl+Alt+Shift+KeyV");
  });

  it("returns null without modifiers", () => {
    expect(buildHotkey(new Set(), "KeyA")).toBeNull();
  });

  it.each(["KeyV", "Space", "Digit1", "F1"])("rejects Shift-only %s", (code) => {
    expect(buildHotkey(new Set(["Shift"]), code)).toBeNull();
  });

  it.each(["Ctrl", "Alt", "AltGr", "Win"])("allows Shift with %s", (modifier) => {
    expect(buildHotkey(new Set([modifier, "Shift"]), "KeyV")).not.toBeNull();
  });

  it("returns null for disallowed key codes", () => {
    expect(buildHotkey(new Set(["Ctrl"]), "Escape")).toBeNull();
    expect(buildHotkey(new Set(["Ctrl"]), "Enter")).toBeNull();
  });

  it("builds AltGr+Slash (AltGr+! on AZERTY after Ctrl strip)", () => {
    // AltGr scenario: user presses AltGr+!, recorder strips synthetic Ctrl
    const mods = new Set(["AltGr"]);
    expect(buildHotkey(mods, "Slash")).toBe("AltGr+Slash");
  });

  it("builds Alt+Slash (left Alt+/ on QWERTY)", () => {
    const mods = new Set(["Alt"]);
    expect(buildHotkey(mods, "Slash")).toBe("Alt+Slash");
  });

  it("builds Ctrl+IntlBackslash (Ctrl+< on AZERTY)", () => {
    expect(buildHotkey(new Set(["Ctrl"]), "IntlBackslash")).toBe("Ctrl+IntlBackslash");
  });

  it("builds Win+code", () => {
    expect(buildHotkey(new Set(["Win"]), "KeyA")).toBe("Win+KeyA");
  });
});

describe("displayHotkey", () => {
  describe("without labels (QWERTY fallback)", () => {
    it("displays default hotkey", () => {
      expect(displayHotkey("Ctrl+Backquote")).toBe("Ctrl+`");
    });

    it("displays letter codes as uppercase letters", () => {
      expect(displayHotkey("Ctrl+KeyV")).toBe("Ctrl+V");
      expect(displayHotkey("Alt+KeyA")).toBe("Alt+A");
    });

    it("displays digit codes as digits", () => {
      expect(displayHotkey("Ctrl+Digit1")).toBe("Ctrl+1");
    });

    it("displays punctuation with QWERTY symbols", () => {
      expect(displayHotkey("Alt+Slash")).toBe("Alt+/");
      expect(displayHotkey("Ctrl+Semicolon")).toBe("Ctrl+;");
      expect(displayHotkey("Ctrl+IntlBackslash")).toBe("Ctrl+<");
    });

    it("passes through modifiers unchanged", () => {
      expect(displayHotkey("Ctrl+Alt+Shift+KeyV")).toBe("Ctrl+Alt+Shift+V");
    });

    it("passes through function keys", () => {
      expect(displayHotkey("Ctrl+F1")).toBe("Ctrl+F1");
      expect(displayHotkey("Alt+F12")).toBe("Alt+F12");
    });
  });

  describe("with AZERTY labels", () => {
    it("shows ² for Backquote on AZERTY", () => {
      expect(displayHotkey("Ctrl+Backquote", AZERTY_LABELS)).toBe("Ctrl+²");
    });

    it("shows ! for Slash on AZERTY", () => {
      expect(displayHotkey("Alt+Slash", AZERTY_LABELS)).toBe("Alt+!");
    });

    it("shows Q for KeyA on AZERTY (physical A → Q)", () => {
      expect(displayHotkey("Ctrl+KeyA", AZERTY_LABELS)).toBe("Ctrl+Q");
    });

    it("shows A for KeyQ on AZERTY (physical Q → A)", () => {
      expect(displayHotkey("Ctrl+KeyQ", AZERTY_LABELS)).toBe("Ctrl+A");
    });

    it("shows , for KeyM on AZERTY", () => {
      expect(displayHotkey("Alt+KeyM", AZERTY_LABELS)).toBe("Alt+,");
    });

    it("shows M for Semicolon on AZERTY", () => {
      expect(displayHotkey("Ctrl+Semicolon", AZERTY_LABELS)).toBe("Ctrl+M");
    });

    it("shows < for IntlBackslash on AZERTY", () => {
      expect(displayHotkey("Ctrl+IntlBackslash", AZERTY_LABELS)).toBe("Ctrl+<");
    });

    it("shows É for Digit2 on AZERTY (uppercase)", () => {
      expect(displayHotkey("Ctrl+Shift+Digit2", AZERTY_LABELS)).toBe("Ctrl+Shift+É");
    });

    it("shows & for Digit1 on AZERTY", () => {
      expect(displayHotkey("Ctrl+Digit1", AZERTY_LABELS)).toBe("Ctrl+&");
    });
  });

  describe("with QWERTZ labels", () => {
    it("shows Z for KeyY on QWERTZ", () => {
      expect(displayHotkey("Ctrl+KeyY", QWERTZ_LABELS)).toBe("Ctrl+Z");
    });

    it("shows Y for KeyZ on QWERTZ", () => {
      expect(displayHotkey("Ctrl+KeyZ", QWERTZ_LABELS)).toBe("Ctrl+Y");
    });

    it("shows ^ for Backquote on QWERTZ", () => {
      expect(displayHotkey("Ctrl+Backquote", QWERTZ_LABELS)).toBe("Ctrl+^");
    });

    it("falls back to letter for keys not in labels", () => {
      // QWERTZ_LABELS doesn't include KeyA, should fall back to "A"
      expect(displayHotkey("Ctrl+KeyA", QWERTZ_LABELS)).toBe("Ctrl+A");
    });
  });

  describe("edge cases", () => {
    it("handles empty labels object", () => {
      expect(displayHotkey("Ctrl+Backquote", {})).toBe("Ctrl+`");
    });

    it("handles unknown parts as pass-through", () => {
      expect(displayHotkey("Ctrl+UnknownKey")).toBe("Ctrl+UnknownKey");
    });
  });
});

describe("MODIFIER_MAP", () => {
  it("maps all physical modifier codes", () => {
    expect(MODIFIER_MAP["ControlLeft"]).toBe("Ctrl");
    expect(MODIFIER_MAP["ControlRight"]).toBe("Ctrl");
    expect(MODIFIER_MAP["AltLeft"]).toBe("Alt");
    expect(MODIFIER_MAP["AltRight"]).toBe("Alt");
    expect(MODIFIER_MAP["ShiftLeft"]).toBe("Shift");
    expect(MODIFIER_MAP["ShiftRight"]).toBe("Shift");
    expect(MODIFIER_MAP["MetaLeft"]).toBe("Win");
    expect(MODIFIER_MAP["MetaRight"]).toBe("Win");
  });

  it("does not map non-modifier keys", () => {
    expect(MODIFIER_MAP["KeyA"]).toBeUndefined();
    expect(MODIFIER_MAP["Escape"]).toBeUndefined();
  });
});

describe("applyAltGrStrip", () => {
  it("strips Ctrl and replaces Alt with AltGr when AltRight is pressed", () => {
    // Windows AltGr sends ControlLeft first, then AltRight.
    // After processing ControlLeft, modifiers = {Ctrl, Alt}.
    // applyAltGrStrip on AltRight should remove Ctrl and replace Alt → AltGr.
    const mods = new Set(["Ctrl", "Alt"]);
    const result = applyAltGrStrip(mods, "AltRight");
    expect(result.has("Ctrl")).toBe(false);
    expect(result.has("Alt")).toBe(false);
    expect(result.has("AltGr")).toBe(true);
  });

  it("does not strip Ctrl for AltLeft", () => {
    const mods = new Set(["Ctrl", "Alt"]);
    const result = applyAltGrStrip(mods, "AltLeft");
    expect(result.has("Ctrl")).toBe(true);
    expect(result.has("Alt")).toBe(true);
    expect(result.has("AltGr")).toBe(false);
  });

  it("does not strip Ctrl for non-Alt keys", () => {
    const mods = new Set(["Ctrl"]);
    const result = applyAltGrStrip(mods, "KeyA");
    expect(result.has("Ctrl")).toBe(true);
  });

  it("replaces Alt with AltGr even when Ctrl not present", () => {
    const mods = new Set(["Alt"]);
    const result = applyAltGrStrip(mods, "AltRight");
    expect(result.has("Alt")).toBe(false);
    expect(result.has("AltGr")).toBe(true);
    expect(result.size).toBe(1);
  });
});

describe("AltGr recording simulation", () => {
  // Simulates the full AltGr + key recording sequence as it happens
  // in the Settings.tsx recorder onKeyDown handler.

  function simulateRecording(events: { code: string; key: string }[]): string | null {
    let modifiers = new Set<string>();
    for (const e of events) {
      const mod = MODIFIER_MAP[e.code];
      if (mod) modifiers.add(mod);
      // AltGr strip (mirrors Settings.tsx)
      modifiers = applyAltGrStrip(modifiers, e.code);
      // Skip bare modifier keys (mirrors Settings.tsx)
      if (["Control", "Alt", "Shift", "Meta", "AltGraph"].includes(e.key)) {
        continue;
      }
      // Non-modifier key pressed — build the hotkey
      return buildHotkey(modifiers, e.code);
    }
    return null;
  }

  it("records AltGr+! as AltGr+Slash on AZERTY", () => {
    // Windows event sequence for AltGr+!:
    // 1. ControlLeft down (synthetic, key="Control")
    // 2. AltRight down (key="AltGraph" or "Alt")
    // 3. Slash down (physical key where ! lives on AZERTY)
    const result = simulateRecording([
      { code: "ControlLeft", key: "Control" },
      { code: "AltRight", key: "AltGraph" },
      { code: "Slash", key: "!" },
    ]);
    expect(result).toBe("AltGr+Slash");
  });

  it("records AltGr+é as AltGr+Digit2 on AZERTY", () => {
    const result = simulateRecording([
      { code: "ControlLeft", key: "Control" },
      { code: "AltRight", key: "AltGraph" },
      { code: "Digit2", key: "~" }, // AltGr+2 = ~ on FR
    ]);
    expect(result).toBe("AltGr+Digit2");
  });

  it("records real Ctrl+Alt+Slash (not AltGr) as Ctrl+Alt+Slash", () => {
    // User holds left Ctrl + left Alt + key (no AltGr involved)
    const result = simulateRecording([
      { code: "ControlLeft", key: "Control" },
      { code: "AltLeft", key: "Alt" },
      { code: "Slash", key: "/" },
    ]);
    expect(result).toBe("Ctrl+Alt+Slash");
  });

  it("records Ctrl+Backquote (default)", () => {
    const result = simulateRecording([
      { code: "ControlLeft", key: "Control" },
      { code: "Backquote", key: "²" }, // key value on AZERTY
    ]);
    expect(result).toBe("Ctrl+Backquote");
  });

  it("records Ctrl+IntlBackslash (Ctrl+< on AZERTY)", () => {
    const result = simulateRecording([
      { code: "ControlLeft", key: "Control" },
      { code: "IntlBackslash", key: "<" },
    ]);
    expect(result).toBe("Ctrl+IntlBackslash");
  });

  it("records Left Alt+key (no AltGr strip)", () => {
    const result = simulateRecording([
      { code: "AltLeft", key: "Alt" },
      { code: "KeyA", key: "q" }, // AZERTY
    ]);
    expect(result).toBe("Alt+KeyA");
  });

  it("ignores bare modifier release without key", () => {
    const result = simulateRecording([
      { code: "ControlLeft", key: "Control" },
      { code: "AltLeft", key: "Alt" },
    ]);
    expect(result).toBeNull();
  });

  it("rejects key without modifier", () => {
    const result = simulateRecording([{ code: "KeyA", key: "a" }]);
    expect(result).toBeNull();
  });
});

describe("displayHotkey with AltGr-recorded shortcuts", () => {
  // After recording, AltGr shortcuts are stored as "AltGr+<code>".
  // The display should show "AltGr" and layout-correct labels.

  it("AltGr+! (stored as AltGr+Slash) → AltGr+! on AZERTY", () => {
    expect(displayHotkey("AltGr+Slash", AZERTY_LABELS)).toBe("AltGr+!");
  });

  it("AltGr+! (stored as AltGr+Slash) → AltGr+/ on QWERTY (no labels)", () => {
    expect(displayHotkey("AltGr+Slash")).toBe("AltGr+/");
  });

  it("Ctrl+² (stored as Ctrl+Backquote) on AZERTY", () => {
    expect(displayHotkey("Ctrl+Backquote", AZERTY_LABELS)).toBe("Ctrl+²");
  });

  it("Ctrl+< (stored as Ctrl+IntlBackslash) on AZERTY", () => {
    expect(displayHotkey("Ctrl+IntlBackslash", AZERTY_LABELS)).toBe("Ctrl+<");
  });

  it("default hotkey constant", () => {
    expect(DEFAULT_HOTKEY).toBe("Ctrl+Backquote");
    expect(displayHotkey(DEFAULT_HOTKEY)).toBe("Ctrl+`");
    expect(displayHotkey(DEFAULT_HOTKEY, AZERTY_LABELS)).toBe("Ctrl+²");
  });
});

describe("CODE_DISPLAY completeness", () => {
  it("has fallback for all punctuation ALLOWED_KEY_CODES", () => {
    const punctuation = [
      "Backquote",
      "Space",
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
    for (const code of punctuation) {
      expect(CODE_DISPLAY[code]).toBeDefined();
    }
  });
});
