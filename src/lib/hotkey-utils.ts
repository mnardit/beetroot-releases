/** Hotkey recording, display, and validation utilities.
 *  Extracted from Settings.tsx for testability. */

/** Default hotkey for the main toggle shortcut. */
export const DEFAULT_HOTKEY = "Ctrl+Backquote";

/** Allowed physical key codes for hotkey registration (e.code values). */
export const ALLOWED_KEY_CODES = new Set([
  "Space",
  "Backquote",
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
]);

/** Check if a physical key code is valid for hotkey binding. */
export function isAllowedKeyCode(code: string): boolean {
  if (/^Key[A-Z]$/.test(code)) return true;
  if (/^Digit\d$/.test(code)) return true;
  if (/^F([1-9]|1[0-2])$/.test(code)) return true;
  return ALLOWED_KEY_CODES.has(code);
}

/** Build hotkey string from tracked modifier set and a physical key code (e.code).
 *  Stores physical codes directly (e.g. "Ctrl+KeyV", "Alt+Semicolon") so that
 *  registration works correctly on any keyboard layout (QWERTY, AZERTY, etc.).
 *  Uses manually tracked modifiers instead of e.ctrlKey/e.altKey because
 *  AltGr on some layouts (Russian, AZERTY) doesn't set e.altKey on the key event. */
export function buildHotkey(modifiers: Set<string>, code: string): string | null {
  // Shift alone is normal typing, not a command shortcut.
  if (!["Ctrl", "Alt", "AltGr", "Win"].some((modifier) => modifiers.has(modifier))) return null;
  if (!isAllowedKeyCode(code)) return null;
  const parts: string[] = [];
  if (modifiers.has("Ctrl")) parts.push("Ctrl");
  if (modifiers.has("AltGr")) parts.push("AltGr");
  else if (modifiers.has("Alt")) parts.push("Alt");
  if (modifiers.has("Shift")) parts.push("Shift");
  if (modifiers.has("Win")) parts.push("Win");
  parts.push(code);
  return parts.join("+");
}

/** Map physical code names to display symbols (QWERTY-based fallback). */
export const CODE_DISPLAY: Record<string, string> = {
  Backquote: "`",
  Space: "Space",
  Semicolon: ";",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Quote: "'",
  IntlBackslash: "<",
};

/** Convert a stored hotkey string to a human-readable display label.
 *  When `labels` is provided (from `ToUnicodeEx`), shows the actual character
 *  for the user's current keyboard layout. Falls back to QWERTY symbols. */
export function displayHotkey(hotkey: string, labels?: Record<string, string>): string {
  return hotkey
    .split("+")
    .map((part) => {
      // Layout-aware label from Rust (ToUnicodeEx)
      if (labels && part in labels) {
        const ch = labels[part];
        return ch.length === 1 ? ch.toUpperCase() : ch;
      }
      // Static fallbacks
      const letter = part.match(/^Key([A-Z])$/);
      if (letter) return letter[1];
      const digit = part.match(/^Digit(\d)$/);
      if (digit) return digit[1];
      if (part in CODE_DISPLAY) return CODE_DISPLAY[part];
      return part;
    })
    .join("+");
}

/** Map physical modifier key codes to canonical modifier names. */
export const MODIFIER_MAP: Record<string, string> = {
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  MetaLeft: "Win",
  MetaRight: "Win",
};

/** Simulate AltGr modifier tracking: when AltRight is pressed, Windows
 *  synthesizes a ControlLeft event first.  The recorder strips that synthetic
 *  Ctrl and replaces "Alt" with "AltGr" so the shortcut is stored as
 *  "AltGr+..." (Rust auto-registers a Ctrl+Alt companion via
 *  `needs_altgr_variant()`). */
export function applyAltGrStrip(modifiers: Set<string>, code: string): Set<string> {
  const result = new Set(modifiers);
  if (code === "AltRight") {
    result.delete("Ctrl");
    if (result.has("Alt")) {
      result.delete("Alt");
      result.add("AltGr");
    }
  }
  return result;
}
