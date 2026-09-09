import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock ResizeObserver (not available in happy-dom)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      // Immediately fire with a fake entry so react-window gets a height
      this.callback(
        [{ contentRect: { height: 400, width: 680 } } as unknown as ResizeObserverEntry],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  };
}

// Mock Tauri core API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
  convertFileSrc: vi.fn((path: string) => `https://asset.localhost/${encodeURIComponent(path)}`),
}));

// Mock Tauri event API
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock Tauri dialog plugin
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

// Mock Tauri webview window
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    onFocusChanged: vi.fn().mockResolvedValue(() => {}),
    listen: vi.fn().mockResolvedValue(() => {}),
    hide: vi.fn(),
    show: vi.fn(),
    setFocus: vi.fn(),
  }),
}));

// Mock Tauri window API
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    outerSize: vi.fn().mockResolvedValue({ width: 680, height: 480 }),
    scaleFactor: vi.fn().mockResolvedValue(1),
    onMoved: vi.fn().mockResolvedValue(() => {}),
    onResized: vi.fn().mockResolvedValue(() => {}),
    onFocusChanged: vi.fn().mockResolvedValue(() => {}),
    setEffects: vi.fn().mockResolvedValue(undefined),
    clearEffects: vi.fn().mockResolvedValue(undefined),
  }),
  Effect: { Mica: "mica" },
  EffectState: { FollowsWindowActiveState: "followsWindowActiveState" },
  availableMonitors: vi.fn().mockResolvedValue([
    {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
    },
  ]),
  LogicalSize: class LogicalSize {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  },
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

// Mock clipboard plugin
vi.mock("tauri-plugin-clipboard-api", () => ({
  onTextUpdate: vi.fn().mockResolvedValue(() => {}),
  onImageUpdate: vi.fn().mockResolvedValue(() => {}),
  startListening: vi.fn().mockResolvedValue(() => {}),
  readText: vi.fn().mockResolvedValue(""),
  writeText: vi.fn().mockResolvedValue(undefined),
  writeImageBase64: vi.fn().mockResolvedValue(undefined),
  writeHtmlAndText: vi.fn().mockResolvedValue(undefined),
  hasHTML: vi.fn().mockResolvedValue(false),
  readHtml: vi.fn().mockResolvedValue(""),
}));

// Mock Tauri updater plugin
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

// Mock Tauri process plugin
vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));
