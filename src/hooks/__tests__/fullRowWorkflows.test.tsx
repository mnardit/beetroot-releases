import { useState } from "react";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useDatabase } from "../useDatabase";
import { useClipboardActions } from "../useClipboardActions";
import { useBatchOperations } from "../useBatchOperations";
import { ContextMenu } from "../../components/ContextMenu";
import { pasteItem, copyToClipboard } from "../../lib/paste";
import { defaultSettings, makeEntry } from "../../test/fixtures";
import type { ClipboardEntry } from "../../types/clipboard";
import type { AIConfig } from "../../lib/openai";

vi.mock("../../lib/paste", () => ({
  pasteItem: vi.fn().mockResolvedValue(undefined),
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const full = makeEntry(1, {
  content: "  long document\n".repeat(100),
  html_content: "<pre>complete rich document</pre>",
  note: "keep this note",
  starred: true,
  created_at: "2025-01-02 03:04:05",
  last_used: "2025-06-07 08:09:10",
  source_app: "Editor",
  source_title: "Original document",
});
const preview = { ...full, content: full.content.slice(0, 200), html_content: null };
const second = makeEntry(2, { content: "second full document ".repeat(60) });
const image = makeEntry(3, {
  content_type: "image",
  image_path: "/images/a.png",
  note: "image note",
  starred: true,
});
const aiConfig: AIConfig = {
  provider: "local",
  hasKey: { openai: false, gemini: false, anthropic: false, deepseek: false },
  openaiModel: "gpt-5.4-nano",
  geminiModel: "gemini-2.5-flash-lite",
  anthropicModel: "claude-haiku-4-5",
  deepseekModel: "deepseek-chat",
  localEndpoint: "http://127.0.0.1:1234",
  localModel: "fixture",
};

function setup(filtered: ClipboardEntry[] = [preview]) {
  const showInfo = vi.fn();
  const showError = vi.fn();
  const hook = renderHook(() => {
    const db = useDatabase(0, showError);
    const [previewItem, setPreviewItem] = useState<ClipboardEntry | null>(null);
    const [transformItem, setTransformItem] = useState<ClipboardEntry | null>(null);
    const deps = {
      ...db,
      settings: defaultSettings({ pasteMode: "copy" }),
      previewItem,
      transformItem,
      setPreviewItem,
      setTransformItem,
      setContextMenu: vi.fn(),
      showInfo,
      showError,
      t: (key: string) => key,
    };
    return {
      ...db,
      ...useClipboardActions(deps),
      batch: useBatchOperations({ ...deps, filtered }),
      previewItem,
      transformItem,
      setPreviewItem,
      setTransformItem,
    };
  });
  return { ...hook, showInfo, showError };
}

describe("full-row consuming workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "db_get_item") {
        const row = [full, second, image].find((row) => row.id === (args as { id: number }).id);
        if (!row) throw new Error("Row not found");
        return row;
      }
      if (command === "read_image_base64") return "image-snapshot";
      return undefined;
    });
  });

  it.each(["single", "batch"])(
    "%s delete/undo sends a complete row through the restore IPC",
    async (mode) => {
      const { result, showInfo } = setup();
      if (mode === "batch") act(() => result.current.batch.handleToggleMultiSelect(1));
      await act(async () => {
        if (mode === "single") await result.current.handleDelete(preview);
        else await result.current.batch.handleBatchDelete();
      });
      expect(invoke).toHaveBeenCalledWith("db_get_item", { id: 1 });
      await act(async () => {
        await showInfo.mock.calls[0][1].onClick();
      });
      expect(invoke).toHaveBeenCalledWith("db_restore_item", {
        entry: full,
        imageBase64: undefined,
      });
      expect(invoke).not.toHaveBeenCalledWith("db_upsert_item", expect.anything());
    },
  );

  it("image undo sends metadata and bytes together, not a separately saved path", async () => {
    const { result, showInfo } = setup([image]);
    await act(async () => {
      await result.current.handleDelete(image);
    });
    await act(async () => {
      await showInfo.mock.calls[0][1].onClick();
    });
    expect(invoke).toHaveBeenCalledWith("db_restore_item", {
      entry: image,
      imageBase64: "image-snapshot",
    });
    expect(invoke).not.toHaveBeenCalledWith("save_image", expect.anything());
  });

  it("new image capture persists bytes and row in one IPC operation", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.addImageItem("image-snapshot", "Editor", "Image");
    });
    expect(invoke).toHaveBeenCalledWith("db_save_image_item", {
      base64Data: "image-snapshot",
      contentHash: expect.any(String),
      sourceApp: "Editor",
      sourceTitle: "Image",
    });
    expect(invoke).not.toHaveBeenCalledWith("save_image", expect.anything());
    expect(invoke).not.toHaveBeenCalledWith("db_upsert_image_item", expect.anything());
  });

  it.each(["single", "batch"])("%s delete aborts if a full row cannot be read", async (mode) => {
    vi.mocked(invoke).mockRejectedValue(new Error("Row unavailable"));
    const { result, showInfo, showError } = setup();
    act(() => result.current.batch.handleToggleMultiSelect(1));
    await act(async () => {
      if (mode === "single") await result.current.handleDelete(preview);
      else await result.current.batch.handleBatchDelete();
    });
    expect(invoke).not.toHaveBeenCalledWith("db_delete_item", expect.anything());
    expect(invoke).not.toHaveBeenCalledWith("db_batch_delete_items", expect.anything());
    expect(showInfo).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith("toast.loadFailed");
    expect(result.current.batch.multiSelected.has(1)).toBe(true);
  });

  it("batch copy loads full text, keeps display order and reports skipped images", async () => {
    const { result, showInfo } = setup([
      preview,
      image,
      { ...second, content: second.content.slice(0, 200) },
    ]);
    act(() => [2, 3, 1].forEach((id) => result.current.batch.handleToggleMultiSelect(id)));
    await act(async () => {
      await result.current.batch.handleBatchCopy("\n---\n");
    });
    expect(pasteItem).toHaveBeenCalledWith(
      expect.objectContaining({ content: full.content + "\n---\n" + second.content }),
      false,
    );
    expect(showInfo).toHaveBeenCalledWith("toast.pastedItemsSkipped");
    expect(result.current.batch.multiSelected.size).toBe(0);
  });

  it.each(["delete", "copy"])(
    "batch %s does not partially consume when a later row is missing",
    async (operation) => {
      const { result, showError, showInfo } = setup([preview, makeEntry(99)]);
      act(() => [1, 99].forEach((id) => result.current.batch.handleToggleMultiSelect(id)));
      await act(async () => {
        if (operation === "delete") await result.current.batch.handleBatchDelete();
        else await result.current.batch.handleBatchCopy("\n");
      });
      expect(invoke).toHaveBeenCalledWith("db_get_item", { id: 1 });
      expect(invoke).toHaveBeenCalledWith("db_get_item", { id: 99 });
      expect(invoke).not.toHaveBeenCalledWith("db_batch_delete_items", expect.anything());
      expect(pasteItem).not.toHaveBeenCalled();
      expect(showInfo).not.toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith("toast.loadFailed");
      expect([...result.current.batch.multiSelected]).toEqual([1, 99]);
    },
  );

  it.each(["handleSelect", "handleCopyToClipboard"] as const)(
    "%s consumes full content and HTML",
    async (action) => {
      const { result } = setup();
      await act(async () => {
        await result.current[action](preview);
      });
      if (action === "handleSelect") expect(pasteItem).toHaveBeenCalledWith(full, false, "plain");
      else expect(copyToClipboard).toHaveBeenCalledWith(full, "plain");
    },
  );

  it.each(["handleSelect", "handleCopyToClipboard", "handleTransform", "batchCopy"] as const)(
    "%s aborts rather than consuming a preview on load failure",
    async (action) => {
      vi.mocked(invoke).mockRejectedValue(new Error("Row unavailable"));
      const { result, showError, showInfo } = setup();
      act(() => result.current.batch.handleToggleMultiSelect(1));
      await act(async () => {
        if (action === "batchCopy") await result.current.batch.handleBatchCopy("\n");
        else await result.current[action](preview);
      });
      expect(pasteItem).not.toHaveBeenCalled();
      expect(copyToClipboard).not.toHaveBeenCalled();
      expect(result.current.transformItem).toBeNull();
      expect(invoke).not.toHaveBeenCalledWith("db_touch_item", expect.anything());
      expect(showInfo).not.toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith("toast.loadFailed");
      expect(result.current.batch.multiSelected.has(1)).toBe(true);
    },
  );

  it.each(["preview", "transform"] as const)(
    "%s reopens on the first action after an external close",
    async (overlay) => {
      const { result } = setup();
      const open = () =>
        overlay === "preview"
          ? result.current.handlePreview(preview)
          : result.current.handleTransform(preview);
      const current = () =>
        overlay === "preview" ? result.current.previewItem : result.current.transformItem;
      await act(async () => {
        await open();
      });
      expect(current()).toEqual(full);
      act(() => {
        if (overlay === "preview") result.current.setPreviewItem(null);
        else result.current.setTransformItem(null);
      });
      await act(async () => {
        await open();
      });
      expect(current()).toEqual(full);
      await act(async () => {
        await open();
      });
      expect(current()).toBeNull();
    },
  );

  it.each([false, true])("quick AI uses only full content (load fails: %s)", async (fails) => {
    if (fails) vi.mocked(invoke).mockRejectedValue(new Error("Row unavailable"));
    const submitJob = vi.fn().mockResolvedValue(7);
    const onError = vi.fn();
    const { container } = render(
      <ContextMenu
        x={0}
        y={0}
        item={preview}
        onClose={vi.fn()}
        onStar={vi.fn()}
        onDelete={vi.fn()}
        onPreview={vi.fn()}
        onError={onError}
        quickAccessPrompts={[
          { id: "fixture", name: "Summarize", prompt: "Summarize", quickAccess: true },
        ]}
        aiConfig={aiConfig}
        submitJob={submitJob}
      />,
    );
    fireEvent.click(
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Summarize"),
      )!,
    );
    await waitFor(() => {
      if (fails) expect(onError).toHaveBeenCalled();
      else
        expect(submitJob).toHaveBeenCalledWith(
          expect.objectContaining({ inputText: full.content }),
        );
    });
    if (fails) expect(submitJob).not.toHaveBeenCalled();
  });
});
