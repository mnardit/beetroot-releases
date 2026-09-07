import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings } from "../settings";
import { getTheme, themes } from "../themes";

// Search security tests (XSS, long content, unicode) are now in Rust:
// src-tauri/src/search.rs — the search engine runs server-side.

describe("security: settings injection", () => {
  beforeEach(() => localStorage.clear());

  it("rejects prototype pollution via __proto__", () => {
    localStorage.setItem("beetroot_settings", '{"__proto__": {"polluted": true}}');
    const s = loadSettings();
    // should not pollute Object prototype
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({} as any).polluted,
    ).toBeUndefined();
    expect(s.maxHistorySize).toBe(500);
  });

  it("handles constructor pollution attempt", () => {
    localStorage.setItem("beetroot_settings", '{"constructor": {"prototype": {"polluted": true}}}');
    const s = loadSettings();
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({} as any).polluted,
    ).toBeUndefined();
    expect(s.maxHistorySize).toBe(500);
  });

  it("strips unknown fields via sanitize", () => {
    localStorage.setItem("beetroot_settings", '{"maxHistorySize": 100, "maliciousField": "evil"}');
    const s = loadSettings();
    expect(s.maxHistorySize).toBe(100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((s as any).maliciousField).toBeUndefined();
  });

  it("rejects negative maxHistorySize", () => {
    localStorage.setItem("beetroot_settings", '{"maxHistorySize": -1}');
    const s = loadSettings();
    expect(s.maxHistorySize).toBe(500); // falls back to default
  });

  it("rejects non-string hotkey", () => {
    localStorage.setItem("beetroot_settings", '{"hotkey": 12345}');
    const s = loadSettings();
    expect(typeof s.hotkey).toBe("string");
    expect(s.hotkey).toBe("Ctrl+Backquote"); // falls back to default
  });

  it("rejects hotkey not in whitelist", () => {
    localStorage.setItem("beetroot_settings", '{"hotkey": "Ctrl+Delete"}');
    const s = loadSettings();
    expect(s.hotkey).toBe("Ctrl+Backquote"); // falls back to default
  });

  it("rejects maxHistorySize above limit", () => {
    localStorage.setItem("beetroot_settings", '{"maxHistorySize": 99999}');
    const s = loadSettings();
    expect(s.maxHistorySize).toBe(500); // falls back to default
  });

  it("rejects non-boolean autostart", () => {
    localStorage.setItem("beetroot_settings", '{"autostart": "yes"}');
    const s = loadSettings();
    expect(s.autostart).toBe(true); // falls back to default
  });
});

describe("security: theme id injection", () => {
  it("handles path traversal in theme id", () => {
    const theme = getTheme("../../../etc/passwd");
    // should fallback to default, not crash
    expect(theme.id).toBe(themes[0].id);
  });

  it("handles script injection in theme id", () => {
    const theme = getTheme("<script>alert(1)</script>");
    expect(theme.id).toBe(themes[0].id);
  });

  it("handles empty/null-like theme id", () => {
    expect(getTheme("").id).toBe(themes[0].id);
    expect(getTheme("undefined").id).toBe(themes[0].id);
    expect(getTheme("null").id).toBe(themes[0].id);
  });
});

describe("security: CSS variable values are safe hex colors", () => {
  it("all theme color values are valid hex only", () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const theme of themes) {
      for (const [key, value] of Object.entries(theme.colors)) {
        expect(
          hexRegex.test(value),
          `${theme.id}.${key} = "${value}" is not a valid hex color`,
        ).toBe(true);
      }
    }
  });

  it("no color value contains CSS injection", () => {
    const dangerousPatterns = [/url\(/i, /expression\(/i, /javascript:/i, /import/i, /@charset/i];
    for (const theme of themes) {
      for (const [key, value] of Object.entries(theme.colors)) {
        for (const pattern of dangerousPatterns) {
          expect(
            pattern.test(value),
            `${theme.id}.${key} matches dangerous pattern ${pattern}`,
          ).toBe(false);
        }
      }
    }
  });
});
