import { getCurrentWindow, Effect, EffectState } from "@tauri-apps/api/window";

/** Enable a native window effect (Mica or Acrylic) or clear all effects. */
function toggleNativeEffects(effect: "mica" | "acrylic" | "off"): void {
  const win = getCurrentWindow();
  if (effect === "off") {
    win.clearEffects().catch((e) => console.warn("Failed to clear window effects:", e));
  } else {
    win
      .setEffects({
        effects: [effect === "mica" ? Effect.Mica : Effect.Acrylic],
        state: EffectState.FollowsWindowActiveState,
      })
      .catch((e) => console.warn("Failed to set window effects:", e));
  }
}

export interface ThemeColors {
  "--bg-app": string;
  "--bg-panel": string;
  "--bg-hover": string;
  "--bg-active": string;
  "--text-primary": string;
  "--text-muted": string;
  "--text-disabled": string;
  "--accent-main": string;
  "--accent-soft": string;
  "--border-base": string;
  "--border-focus": string;
  "--text-hint": string;
  "--state-star": string;
  "--state-danger": string;
  "--state-success": string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const themes: Theme[] = [
  {
    id: "beetroot-dark",
    name: "Beetroot Dark",
    colors: {
      "--bg-app": "#1A1416",
      "--bg-panel": "#221B1E",
      "--bg-hover": "#2E2427",
      "--bg-active": "#3A2C31",
      "--text-primary": "#E2D6D0",
      "--text-muted": "#A0908A",
      "--text-disabled": "#665B57",
      "--text-hint": "#A0908A",
      "--accent-main": "#D94E82",
      "--accent-soft": "#2E1D24",
      "--border-base": "#2A2224",
      "--border-focus": "#D94E82",
      "--state-star": "#D4A04A",
      "--state-danger": "#E5484D",
      "--state-success": "#45A85C",
    },
  },
  {
    id: "beetroot-light",
    name: "Beetroot Light",
    colors: {
      "--bg-app": "#F8F1EE",
      "--bg-panel": "#F0E7E3",
      "--bg-hover": "#E5DAD5",
      "--bg-active": "#D9CEC8",
      "--text-primary": "#2A1C20",
      "--text-muted": "#6B525A",
      "--text-disabled": "#9A8690",
      "--text-hint": "#6B525A",
      "--accent-main": "#B22D6E",
      "--accent-soft": "#F5DDE8",
      "--border-base": "#D9CEC8",
      "--border-focus": "#B22D6E",
      "--state-star": "#8B6510",
      "--state-danger": "#CC3340",
      "--state-success": "#2A7D40",
    },
  },
  {
    id: "tokyo-storm",
    name: "Tokyo Night Storm",
    colors: {
      "--bg-app": "#1A1B26",
      "--bg-panel": "#1F2335",
      "--bg-hover": "#292E42",
      "--bg-active": "#3B4261",
      "--text-primary": "#C0CAF5",
      "--text-muted": "#9AA5CE",
      "--text-disabled": "#6B7394",
      "--text-hint": "#9AA5CE",
      "--accent-main": "#7AA2F7",
      "--accent-soft": "#414868",
      "--border-base": "#2A2E3F",
      "--border-focus": "#7AA2F7",
      "--state-star": "#E0AF68",
      "--state-danger": "#F7768E",
      "--state-success": "#9ECE6A",
    },
  },
  {
    id: "gruvbox-hard",
    name: "Gruvbox Material Hard",
    colors: {
      "--bg-app": "#1D2021",
      "--bg-panel": "#282828",
      "--bg-hover": "#32302F",
      "--bg-active": "#3C3836",
      "--text-primary": "#EBDBB2",
      "--text-muted": "#BDAE93",
      "--text-disabled": "#928374",
      "--text-hint": "#BDAE93",
      "--accent-main": "#83A598",
      "--accent-soft": "#504945",
      "--border-base": "#3C3836",
      "--border-focus": "#83A598",
      "--state-star": "#D79921",
      "--state-danger": "#FB4934",
      "--state-success": "#B8BB26",
    },
  },
  {
    id: "github-light",
    name: "GitHub Light Pro",
    colors: {
      "--bg-app": "#FFFFFF",
      "--bg-panel": "#F6F8FA",
      "--bg-hover": "#EAEEF2",
      "--bg-active": "#DDE4EB",
      "--text-primary": "#24292F",
      "--text-muted": "#57606A",
      "--text-disabled": "#6B7280",
      "--text-hint": "#57606A",
      "--accent-main": "#0969DA",
      "--accent-soft": "#D0E3FF",
      "--border-base": "#D0D7DE",
      "--border-focus": "#0969DA",
      "--state-star": "#996B00",
      "--state-danger": "#CF222E",
      "--state-success": "#1A7F37",
    },
  },
  {
    id: "nord-snow",
    name: "Nord Snow",
    colors: {
      "--bg-app": "#ECEFF4",
      "--bg-panel": "#E5E9F0",
      "--bg-hover": "#D8DEE9",
      "--bg-active": "#C8D0E0",
      "--text-primary": "#2E3440",
      "--text-muted": "#4C566A",
      "--text-disabled": "#576170",
      "--text-hint": "#4C566A",
      "--accent-main": "#4A6F97",
      "--accent-soft": "#B7C7E0",
      "--border-base": "#D8DEE9",
      "--border-focus": "#4A6F97",
      "--state-star": "#7A6020",
      "--state-danger": "#BF616A",
      "--state-success": "#548A3C",
    },
  },
  {
    id: "cyberpunk-dark",
    name: "Cyberpunk Dark",
    colors: {
      "--bg-app": "#0D0D1A",
      "--bg-panel": "#141428",
      "--bg-hover": "#1C1C38",
      "--bg-active": "#282850",
      "--text-primary": "#E8E8F0",
      "--text-muted": "#8A8AB0",
      "--text-disabled": "#5A5A7A",
      "--text-hint": "#8A8AB0",
      "--accent-main": "#00D4FF",
      "--accent-soft": "#0D2A35",
      "--border-base": "#1E1E38",
      "--border-focus": "#00D4FF",
      "--state-star": "#FFE100",
      "--state-danger": "#FF2266",
      "--state-success": "#00FF7F",
    },
  },
  {
    id: "cyberpunk-light",
    name: "Cyberpunk Light",
    colors: {
      "--bg-app": "#F0F0F5",
      "--bg-panel": "#E8E8F0",
      "--bg-hover": "#DDDDE8",
      "--bg-active": "#D0D0E0",
      "--text-primary": "#1A1A2E",
      "--text-muted": "#4A4A6A",
      "--text-disabled": "#7A7A95",
      "--text-hint": "#4A4A6A",
      "--accent-main": "#C61878",
      "--accent-soft": "#FFD6EE",
      "--border-base": "#D0D0E0",
      "--border-focus": "#C61878",
      "--state-star": "#8B6510",
      "--state-danger": "#D41C50",
      "--state-success": "#007A4D",
    },
  },
  {
    id: "pure-dark",
    name: "Pure Dark",
    colors: {
      "--bg-app": "#000000",
      "--bg-panel": "#000000",
      "--bg-hover": "#111111",
      "--bg-active": "#1A1A1A",
      "--text-primary": "#E8E8E8",
      "--text-muted": "#8A8A8A",
      "--text-disabled": "#424242",
      "--text-hint": "#8A8A8A",
      "--accent-main": "#D94E82",
      "--accent-soft": "#180A10",
      "--border-base": "#1A1A1A",
      "--border-focus": "#D94E82",
      "--state-star": "#D4A04A",
      "--state-danger": "#E5484D",
      "--state-success": "#45A85C",
    },
  },
];

/** Look up a theme by ID, falling back to the first theme (beetroot-dark). */
export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function hexToRgb(hex: string): string {
  const [r, g, b] = parseHex(hex);
  return `${r}, ${g}, ${b}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Resolve "auto" to a concrete theme based on system preference. */
export function resolveThemeId(id: string): string {
  if (id !== "auto") return id;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "beetroot-dark"
    : "beetroot-light";
}

/** Apply a theme's CSS custom properties to the document root, with optional accent color override. */
export function applyTheme(id: string, accentColor?: string, windowEffect?: string): void {
  const theme = getTheme(resolveThemeId(id));
  const merged =
    accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor)
      ? {
          ...theme.colors,
          "--accent-main": accentColor,
          "--accent-soft": accentColor + "33",
          "--border-focus": accentColor,
        }
      : theme.colors;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(merged)) {
    root.style.setProperty(key, value);
  }
  // Derived: RGB version of accent for rgba() usage in CSS
  root.style.setProperty("--accent-rgb", hexToRgb(merged["--accent-main"]));
  // Derived: RGB version of app background for transparency
  root.style.setProperty("--bg-app-rgb", hexToRgb(merged["--bg-app"]));
  // Window effect — Pure Dark forces solid to guarantee true OLED black
  const effect = windowEffect || "solid";
  const forceOpaque = theme.id === "pure-dark";
  if (forceOpaque || effect === "solid") {
    root.style.setProperty("--bg-app-alpha", "1");
    root.style.setProperty("--backdrop-blur", "0px");
    document.body.style.background = merged["--bg-app"];
    toggleNativeEffects("off");
  } else if (effect === "acrylic") {
    root.style.setProperty("--bg-app-alpha", "0.85");
    root.style.setProperty("--backdrop-blur", "20px");
    document.body.style.background = "transparent";
    toggleNativeEffects("acrylic");
  } else {
    // mica (default) — no CSS backdrop-blur, Mica handles its own wallpaper blur
    root.style.setProperty("--bg-app-alpha", "0.78");
    root.style.setProperty("--backdrop-blur", "0px");
    document.body.style.background = "transparent";
    toggleNativeEffects("mica");
  }
  // Derived: text color for use on accent/danger backgrounds.
  // Pick the foreground colour with higher WCAG contrast against the accent.
  // Doesn't reject low-contrast accents — just always picks the better of the
  // two extremes so custom accents stay readable across any theme.
  const accentLum = relativeLuminance(merged["--accent-main"]);
  const whiteLum = 1.0; // luminance of #ffffff
  const darkLum = 0.018; // luminance of #1a1a1a (sRGB)
  const ratioWhite = contrastRatio(accentLum, whiteLum);
  const ratioDark = contrastRatio(accentLum, darkLum);
  root.style.setProperty("--text-on-accent", ratioDark > ratioWhite ? "#1a1a1a" : "#ffffff");
  // Derived: soft danger background for error states
  root.style.setProperty("--danger-soft", `rgba(${hexToRgb(merged["--state-danger"])}, 0.1)`);
  // Derived: shadow elevation tokens (light themes use softer shadow base)
  const isLight = relativeLuminance(merged["--bg-app"]) > 0.4;
  const shadowRgb = isLight ? "100, 100, 100" : "0, 0, 0";
  root.style.setProperty("--shadow-rgb", shadowRgb);
  root.style.setProperty("--shadow-sm", `0 1px 3px rgba(${shadowRgb}, 0.12)`);
  root.style.setProperty("--shadow-md", `0 4px 12px rgba(${shadowRgb}, 0.16)`);
  root.style.setProperty("--shadow-lg", `0 8px 24px rgba(${shadowRgb}, 0.24)`);
}
