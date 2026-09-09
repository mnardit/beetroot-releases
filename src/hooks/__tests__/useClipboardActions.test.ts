import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClipboardActions } from "../useClipboardActions";
import {
  dbGetItem,
  hideWindow,
  readImageBase64,
  showCopyOverlay,
  showInExplorer,
} from "../../lib/tauri";
import { pasteItem } from "../../lib/paste";
import type { AppSettings } from "../../lib/settings";
import { defaultSettings, makeEntry } from "../../test/fixtures";

const { isVisible } = vi.hoisted(() => ({ isVisible: vi.fn().mockResolvedValue(true) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ isVisible }) }));

vi.mock("../../lib/tauri", () => ({
  readImageBase64: vi.fn(),
  dbGetItem: vi.fn(),
  hideWindow: vi.fn().mockResolvedValue(undefined),
  showInExplorer: vi.fn(),
  showCopyOverlay: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/paste", () => ({ pasteItem: vi.fn(), copyToClipboard: vi.fn() }));

function setup(settings?: Partial<AppSettings>) {
  const deps = {
    settings: defaultSettings(settings),
    addItem: vi.fn(),
    removeItem: vi.fn().mockResolvedValue(undefined),
    restoreItem: vi.fn().mockResolvedValue(undefined),
    starItem: vi.fn(),
    touchItem: vi.fn(),
    previewItem: null,
    transformItem: null,
    setPreviewItem: vi.fn(),
    setTransformItem: vi.fn(),
    setContextMenu: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
    t: (key: string) => key,
  };
  return { ...renderHook(() => useClipboardActions(deps)), deps };
}

describe("single-item deletion undo", () => {
  beforeEach(() => {
    vi.mocked(readImageBase64).mockReset();
    vi.mocked(dbGetItem)
      .mockReset()
      .mockImplementation(async (id) => makeEntry(id));
  });

  it("does not offer undo when reading the image fails", async () => {
    vi.mocked(readImageBase64).mockRejectedValue(new Error("Missing image"));
    const { result, deps } = setup();
    const image = makeEntry(1, { content_type: "image", image_path: "/images/missing.png" });
    vi.mocked(dbGetItem).mockResolvedValue(image);
    await act(async () => {
      await result.current.handleDelete(image);
    });
    expect(deps.removeItem).toHaveBeenCalledWith(image.id);
    expect(deps.showInfo).toHaveBeenCalledWith("deleted");
    expect(deps.restoreItem).not.toHaveBeenCalled();
  });

  it("does not offer undo for an image without a path", async () => {
    const { result, deps } = setup();
    vi.mocked(dbGetItem).mockResolvedValue(makeEntry(1, { content_type: "image" }));
    await act(async () => {
      await result.current.handleDelete(makeEntry(1, { content_type: "image" }));
    });
    expect(readImageBase64).not.toHaveBeenCalled();
    expect(deps.showInfo).toHaveBeenCalledWith("deleted");
  });

  it("restores the captured image snapshot through undo", async () => {
    vi.mocked(readImageBase64).mockResolvedValue("snapshot");
    const { result, deps } = setup();
    const image = makeEntry(1, { content_type: "image", image_path: "/images/a.png" });
    vi.mocked(dbGetItem).mockResolvedValue(image);
    await act(async () => {
      await result.current.handleDelete(image);
    });
    expect(vi.mocked(readImageBase64).mock.invocationCallOrder[0]).toBeLessThan(
      deps.removeItem.mock.invocationCallOrder[0],
    );
    const action = deps.showInfo.mock.calls[0][1];
    expect(action.label).toBe("undo");
    await act(async () => {
      await action.onClick();
    });
    expect(deps.restoreItem).toHaveBeenCalledWith(image, "snapshot");
  });

  it("still offers undo for text", async () => {
    const { result, deps } = setup();
    const entry = makeEntry(2);
    await act(async () => {
      await result.current.handleDelete(entry);
    });
    await act(async () => {
      await deps.showInfo.mock.calls[0][1].onClick();
    });
    expect(deps.restoreItem).toHaveBeenCalledWith(entry, undefined);
  });

  it("does not announce deletion or offer undo after a failed delete", async () => {
    const { result, deps } = setup();
    deps.removeItem.mockRejectedValue(new Error("Database unavailable"));
    await act(async () => {
      await result.current.handleDelete(makeEntry(2));
    });
    expect(deps.showInfo).not.toHaveBeenCalled();
  });
});

describe("window mode selection behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isVisible.mockReset().mockResolvedValue(true);
    vi.mocked(showCopyOverlay).mockReset().mockResolvedValue(undefined);
    vi.mocked(dbGetItem).mockImplementation(async (id) => makeEntry(id));
    vi.mocked(pasteItem).mockResolvedValue(undefined);
  });

  for (const windowMode of ["normal", "follow-cursor", "pinned"] as const) {
    for (const pasteMode of ["auto", "copy"] as const) {
      it(`${windowMode} with ${pasteMode} selects full content with the correct paste and hide behavior`, async () => {
        const pinned = windowMode === "pinned";
        const autoPaste = pasteMode === "auto" && !pinned;
        const { result, deps } = setup({ windowMode, alwaysOnTop: pinned, pasteMode });
        const full = makeEntry(1, { content: "Full stored content", html_content: "<b>Full</b>" });
        vi.mocked(dbGetItem).mockResolvedValue(full);

        await act(async () => {
          await result.current.handleSelect(makeEntry(1, { content: "Truncated" }));
        });

        expect(pasteItem).toHaveBeenCalledWith(full, autoPaste, "plain");
        expect(hideWindow).toHaveBeenCalledTimes(!autoPaste && !pinned ? 1 : 0);
        expect(deps.touchItem).toHaveBeenCalledWith(1);
        expect(deps.showError).not.toHaveBeenCalled();
        if (pinned) expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
      });
    }
  }

  it("keeps pinned image selection copy-only even with auto paste enabled", async () => {
    const { result, deps } = setup({ windowMode: "pinned", alwaysOnTop: true });
    const image = makeEntry(2, { content_type: "image", image_path: "/images/synthetic.png" });
    vi.mocked(dbGetItem).mockResolvedValue(image);
    await act(async () => {
      await result.current.handleSelect(image);
    });
    expect(pasteItem).toHaveBeenCalledWith(image, false, "plain");
    expect(hideWindow).not.toHaveBeenCalled();
    expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
  });

  it("keeps rich format in follow-cursor auto paste", async () => {
    const { result } = setup({ windowMode: "follow-cursor", pasteFormat: "original" });
    const full = makeEntry(3, { html_content: "<b>Rich</b>" });
    vi.mocked(dbGetItem).mockResolvedValue(full);
    await act(async () => {
      await result.current.handleSelect(full);
    });
    expect(pasteItem).toHaveBeenCalledWith(full, true, "original");
  });

  it("announces copy-only without hiding when the original input closed", async () => {
    vi.mocked(pasteItem).mockResolvedValue({ status: "copied" });
    const { result, deps } = setup();
    await act(async () => {
      await result.current.handleSelect(makeEntry(1));
    });
    expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
    expect(hideWindow).not.toHaveBeenCalled();
    expect(deps.showError).not.toHaveBeenCalled();
    expect(showCopyOverlay).not.toHaveBeenCalled();
  });

  for (const windowMode of ["normal", "follow-cursor"] as const) {
    for (const contentType of ["text", "image"] as const) {
      it(`shows an overlay for late copy-only in ${windowMode} with ${contentType}`, async () => {
        vi.mocked(pasteItem).mockResolvedValue({ status: "copied" });
        isVisible.mockResolvedValue(false);
        const { result, deps } = setup({
          windowMode,
          overlayPosition: "top-center",
          overlayDuration: "visible",
          overlayAnimation: "fade",
        });
        const item = makeEntry(1, { content_type: contentType, image_path: "/images/a.png" });
        vi.mocked(dbGetItem).mockResolvedValue(item);
        await act(async () => {
          await result.current.handleSelect(item);
        });
        expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
        expect(showCopyOverlay).toHaveBeenCalledWith("overlay.copied", "top-center", 2500, "fade");
        expect(vi.mocked(pasteItem).mock.invocationCallOrder[0]).toBeLessThan(
          isVisible.mock.invocationCallOrder[0],
        );
        expect(hideWindow).not.toHaveBeenCalled();
        expect(deps.showError).not.toHaveBeenCalled();
      });
    }
  }

  it("respects disabled copy overlays after the popup has hidden", async () => {
    vi.mocked(pasteItem).mockResolvedValue({ status: "copied" });
    isVisible.mockResolvedValue(false);
    const { result, deps } = setup({ showCopiedOverlay: false });
    await act(async () => {
      await result.current.handleSelect(makeEntry(1));
    });
    expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
    expect(showCopyOverlay).not.toHaveBeenCalled();
  });

  it("does not show copy-only feedback after a successful paste", async () => {
    vi.mocked(pasteItem).mockResolvedValue({ status: "pasted" });
    isVisible.mockResolvedValue(false);
    const { result, deps } = setup();
    await act(async () => {
      await result.current.handleSelect(makeEntry(1));
    });
    expect(showCopyOverlay).not.toHaveBeenCalled();
    expect(deps.showInfo).not.toHaveBeenCalled();
  });

  for (const failure of ["visibility", "overlay"] as const) {
    it(`does not report a failed paste or retry it when ${failure} feedback fails`, async () => {
      vi.mocked(pasteItem).mockResolvedValue({ status: "copied" });
      isVisible.mockResolvedValue(false);
      if (failure === "visibility") isVisible.mockRejectedValue(new Error("Window unavailable"));
      else vi.mocked(showCopyOverlay).mockRejectedValue(new Error("Overlay unavailable"));
      const { result, deps } = setup();
      await act(async () => {
        await result.current.handleSelect(makeEntry(1));
      });
      expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
      expect(deps.showError).not.toHaveBeenCalled();
      expect(pasteItem).toHaveBeenCalledTimes(1);
      expect(result.current.pastingItemId).toBeNull();
    });
  }

  it("shows late copy-only feedback for a transformed item", async () => {
    vi.mocked(pasteItem).mockResolvedValue({ status: "copied" });
    isVisible.mockResolvedValue(false);
    const { result, deps } = setup();
    await act(async () => {
      await result.current.handleApplyTransform("Transformed", 1);
    });
    expect(showCopyOverlay).toHaveBeenCalledTimes(1);
    expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
    expect(deps.showInfo).not.toHaveBeenCalledWith("toast.pasted");
    expect(deps.addItem).toHaveBeenCalledWith("Transformed");
    expect(hideWindow).not.toHaveBeenCalled();
  });

  it("does not announce a paste when a transform only copied to the clipboard", async () => {
    vi.mocked(pasteItem).mockResolvedValue({ status: "copied" });
    const { result, deps } = setup();
    await act(async () => {
      await result.current.handleApplyTransform("Transformed", 1);
    });
    expect(deps.showInfo).toHaveBeenCalledWith("toast.copied");
    expect(deps.showInfo).not.toHaveBeenCalledWith("toast.pasted");
    expect(deps.addItem).toHaveBeenCalledWith("Transformed");
    expect(hideWindow).not.toHaveBeenCalled();
  });

  it("lets the native Explorer command own the handoff and shows its errors", async () => {
    vi.mocked(showInExplorer).mockRejectedValue(new Error("Shell failure"));
    const { result, deps } = setup();
    await act(async () => {
      await result.current.handleShowInExplorer("/images/a.png");
    });
    expect(showInExplorer).toHaveBeenCalledWith("/images/a.png");
    expect(hideWindow).not.toHaveBeenCalled();
    expect(deps.showError).toHaveBeenCalledWith("toast.explorerFailed");
  });
});
