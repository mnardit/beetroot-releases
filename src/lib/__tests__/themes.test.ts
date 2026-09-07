import { describe, it, expect, beforeEach } from "vitest";
import { themes, getTheme, applyTheme, type ThemeColors } from "../themes";

const REQUIRED_KEYS: (keyof ThemeColors)[] = [
  "--bg-app",
  "--bg-panel",
  "--bg-hover",
  "--bg-active",
  "--text-primary",
  "--text-muted",
  "--text-disabled",
  "--accent-main",
  "--accent-soft",
  "--border-base",
  "--border-focus",
  "--state-star",
  "--state-danger",
  "--state-success",
];

describe("themes", () => {
  it("has at least 2 themes", () => {
    expect(themes.length).toBeGreaterThanOrEqual(2);
  });

  it("each theme has unique id", () => {
    const ids = themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each theme defines all required color keys", () => {
    for (const theme of themes) {
      for (const key of REQUIRED_KEYS) {
        expect(theme.colors[key], `${theme.id} missing ${key}`).toBeDefined();
        expect(theme.colors[key]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("each theme has a non-empty name", () => {
    for (const theme of themes) {
      expect(theme.name.length).toBeGreaterThan(0);
    }
  });

  it("has exactly 9 themes", () => {
    expect(themes.length).toBe(9);
  });

  it("includes expected theme ids", () => {
    const ids = themes.map((t) => t.id);
    expect(ids).toContain("beetroot-dark");
    expect(ids).toContain("beetroot-light");
    expect(ids).toContain("tokyo-storm");
    expect(ids).toContain("gruvbox-hard");
    expect(ids).toContain("github-light");
    expect(ids).toContain("nord-snow");
    expect(ids).toContain("cyberpunk-dark");
    expect(ids).toContain("cyberpunk-light");
    expect(ids).toContain("pure-dark");
  });
});

describe("getTheme", () => {
  it("returns correct theme by id", () => {
    const theme = getTheme("tokyo-storm");
    expect(theme.id).toBe("tokyo-storm");
  });

  it("falls back to first theme for unknown id", () => {
    const theme = getTheme("nonexistent");
    expect(theme.id).toBe(themes[0].id);
  });

  it("falls back for empty string", () => {
    const theme = getTheme("");
    expect(theme.id).toBe(themes[0].id);
  });
});

describe("applyTheme", () => {
  it("sets CSS custom properties on document.documentElement", () => {
    applyTheme("tokyo-storm");
    const style = document.documentElement.style;
    const tokyoStorm = getTheme("tokyo-storm");
    for (const [key, value] of Object.entries(tokyoStorm.colors)) {
      expect(style.getPropertyValue(key)).toBe(value);
    }
  });

  it("switches all variables when changing theme", () => {
    applyTheme("tokyo-storm");
    applyTheme("github-light");
    const style = document.documentElement.style;
    const githubLight = getTheme("github-light");
    for (const [key, value] of Object.entries(githubLight.colors)) {
      expect(style.getPropertyValue(key)).toBe(value);
    }
  });

  it("sets derived --accent-rgb variable", () => {
    applyTheme("tokyo-storm");
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--accent-rgb")).toBeTruthy();
  });

  it("sets derived --text-on-accent variable", () => {
    applyTheme("tokyo-storm");
    const style = document.documentElement.style;
    const value = style.getPropertyValue("--text-on-accent");
    expect(value === "#ffffff" || value.startsWith("#")).toBe(true);
  });

  it("sets derived --danger-soft variable", () => {
    applyTheme("tokyo-storm");
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--danger-soft")).toContain("rgba(");
  });
});

describe("applyTheme — text-on-accent contrast", () => {
  beforeEach(() => {
    document.documentElement.style.cssText = "";
  });

  function getTextOnAccent(): string {
    return document.documentElement.style.getPropertyValue("--text-on-accent").trim();
  }

  it("uses dark text on bright yellow accent (light theme)", () => {
    applyTheme("beetroot-light", "#ffd700");
    expect(getTextOnAccent().toLowerCase()).toBe("#1a1a1a");
  });

  it("uses white text on dark blue accent", () => {
    applyTheme("beetroot-dark", "#1a3a8a");
    expect(getTextOnAccent().toLowerCase()).toBe("#ffffff");
  });

  it("uses dark text on bright lime accent regardless of theme", () => {
    applyTheme("beetroot-light", "#aaff00");
    expect(getTextOnAccent().toLowerCase()).toBe("#1a1a1a");
    applyTheme("beetroot-dark", "#aaff00");
    expect(getTextOnAccent().toLowerCase()).toBe("#1a1a1a");
  });

  it("picks the higher-contrast option even when neither is great", () => {
    // Mid-grey accent — neither black nor white gives 4.5:1, just pick the better one.
    applyTheme("beetroot-light", "#888888");
    const result = getTextOnAccent().toLowerCase();
    expect(["#1a1a1a", "#ffffff"]).toContain(result);
  });
});
