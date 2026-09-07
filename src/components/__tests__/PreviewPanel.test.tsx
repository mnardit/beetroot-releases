import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PreviewPanel } from "../PreviewPanel";
import { makeEntry } from "../../test/fixtures";
import * as pasteModule from "../../lib/paste";
import { writeText } from "tauri-plugin-clipboard-api";

vi.mock("../../hooks/useImageThumb", () => ({
  useImageThumb: vi.fn(() => null),
  THUMB_ERROR: "__error__",
}));

vi.mock("../../lib/content-detect", () => ({
  detectContentType: vi.fn(() => "plain"),
}));

const textItem = makeEntry(1, { content: "preview text content" });

const imageItem = makeEntry(2, {
  content_type: "image",
  image_path: "/images/test.png",
});

describe("PreviewPanel", () => {
  it("renders text content in a pre element", () => {
    const { container } = render(<PreviewPanel item={textItem} onClose={vi.fn()} />);
    const pre = container.querySelector(".preview-panel__text");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe("preview text content");
  });

  it("shows full text content without truncation", () => {
    const longContent = "a".repeat(3000);
    const item = { ...textItem, content: longContent };
    const { container } = render(<PreviewPanel item={item} onClose={vi.fn()} />);
    const pre = container.querySelector(".preview-panel__text");
    expect(pre?.textContent?.length).toBe(3000);
  });

  it("shows loading state for images", () => {
    const { container } = render(<PreviewPanel item={imageItem} onClose={vi.fn()} />);
    const placeholder = container.querySelector(".preview-panel__placeholder");
    expect(placeholder).not.toBeNull();
  });

  it("closes on overlay click", () => {
    const onClose = vi.fn();
    const { container } = render(<PreviewPanel item={textItem} onClose={onClose} />);
    fireEvent.click(container.querySelector(".preview-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when clicking the panel itself", () => {
    const onClose = vi.fn();
    const { container } = render(<PreviewPanel item={textItem} onClose={onClose} />);
    fireEvent.click(container.querySelector(".preview-panel")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Space key", () => {
    const onClose = vi.fn();
    render(<PreviewPanel item={textItem} onClose={onClose} />);
    fireEvent.keyDown(window, { key: " " });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(<PreviewPanel item={textItem} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders header with type badge and close button", () => {
    const { container } = render(<PreviewPanel item={textItem} onClose={vi.fn()} />);
    const badge = container.querySelector(".preview-panel__type-badge");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("Text");
    // Only close button in header
    const headerBtns = container.querySelectorAll(".preview-panel__header-btn");
    expect(headerBtns.length).toBe(1);
  });

  it("shows Image badge for image items", () => {
    const { container } = render(<PreviewPanel item={imageItem} onClose={vi.fn()} />);
    const badge = container.querySelector(".preview-panel__type-badge");
    expect(badge?.textContent).toBe("Image");
  });

  it("renders action bar with Copy button", () => {
    const { container } = render(<PreviewPanel item={textItem} onClose={vi.fn()} />);
    const actions = container.querySelector(".preview-panel__actions");
    expect(actions).not.toBeNull();
    const actionBtns = container.querySelectorAll(".preview-panel__action-btn");
    expect(actionBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("shows human-readable app name from exe", () => {
    const item = makeEntry(1, { content: "test", source_app: "chrome.exe" });
    const { container } = render(<PreviewPanel item={item} onClose={vi.fn()} />);
    const title = container.querySelector(".preview-panel__title");
    expect(title?.textContent).toContain("Chrome");
  });

  it("shows relative timestamp in header", () => {
    const item = makeEntry(1, {
      content: "test",
      last_used: new Date().toISOString().replace("Z", ""),
    });
    const { container } = render(<PreviewPanel item={item} onClose={vi.fn()} />);
    const meta = container.querySelector(".preview-panel__meta");
    // Intl.RelativeTimeFormat with style:"narrow" returns locale-dependent output for 0 seconds
    // e.g. "in 0 sec." in English — just verify it contains "0"
    expect(meta?.textContent).toContain("0");
  });

  it("closes when clicking header close button", () => {
    const onClose = vi.fn();
    const { container } = render(<PreviewPanel item={textItem} onClose={onClose} />);
    const closeBtn = container.querySelector(".preview-panel__header-btn");
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows collapsed note toggle with 'Add note' when no note exists", () => {
    const item = makeEntry(1, { content: "test", note: undefined });
    const { container } = render(
      <PreviewPanel item={item} onClose={vi.fn()} onUpdateNote={vi.fn()} />,
    );
    const toggle = container.querySelector(".preview-panel__note-toggle");
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toContain("Add note");
    const input = container.querySelector(".preview-panel__note-input");
    expect(input).toBeNull();
  });

  it("shows collapsed note toggle with note text when note exists", () => {
    const item = makeEntry(1, { content: "test", note: "my note" });
    const { container } = render(
      <PreviewPanel item={item} onClose={vi.fn()} onUpdateNote={vi.fn()} />,
    );
    const toggle = container.querySelector(".preview-panel__note-toggle--has-note");
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toBe("my note");
  });

  it("expands note input when toggle is clicked", () => {
    const item = makeEntry(1, { content: "test", note: undefined });
    const { container } = render(
      <PreviewPanel item={item} onClose={vi.fn()} onUpdateNote={vi.fn()} />,
    );
    const toggle = container.querySelector(".preview-panel__note-toggle");
    fireEvent.click(toggle!);
    const input = container.querySelector(".preview-panel__note-input");
    expect(input).not.toBeNull();
  });

  it("calls onPaste from More menu", () => {
    const onPaste = vi.fn();
    const { container } = render(
      <PreviewPanel item={textItem} onClose={vi.fn()} onPaste={onPaste} />,
    );
    // Open More dropdown
    const moreBtn = container.querySelector(".preview-panel__more-wrap .preview-panel__action-btn");
    fireEvent.click(moreBtn!);
    // Click Paste
    const pasteBtn = container.querySelector(".preview-panel__more-item");
    fireEvent.click(pasteBtn!);
    expect(onPaste).toHaveBeenCalledWith(textItem);
  });

  it("does not render metadata or source sections separately", () => {
    const item = makeEntry(1, { content: "test", source_app: "notepad.exe" });
    const { container } = render(<PreviewPanel item={item} onClose={vi.fn()} />);
    expect(container.querySelector(".preview-panel__metadata")).toBeNull();
    expect(container.querySelector(".preview-panel__source")).toBeNull();
  });

  it("uses suppressedWrite for the Copy button so the monitor ignores the event", async () => {
    const suppressedWriteSpy = vi.spyOn(pasteModule, "suppressedWrite");
    const writeTextMock = vi.mocked(writeText);
    writeTextMock.mockClear();

    const { container } = render(<PreviewPanel item={textItem} onClose={vi.fn()} />);
    const copyBtn = container.querySelector(
      ".preview-panel__actions .preview-panel__action-btn",
    ) as HTMLButtonElement | null;
    expect(copyBtn).not.toBeNull();
    fireEvent.click(copyBtn!);

    // Confirms the Copy button routes its write through the suppression
    // wrapper. The wrapper sets the existing suppress flag (covered by
    // pasteItem.test.ts), so the clipboard monitor will ignore the resulting
    // event instead of re-recording the same item.
    await vi.waitFor(() => {
      expect(suppressedWriteSpy).toHaveBeenCalledTimes(1);
      expect(writeTextMock).toHaveBeenCalledWith("preview text content");
    });

    suppressedWriteSpy.mockRestore();
  });

  it("flushes pending note to the original item, not the new one when item changes", () => {
    const onUpdateNote = vi.fn();
    const itemA = makeEntry(1, { content: "item A", note: null });
    const itemB = makeEntry(2, { content: "item B", note: null });

    const { container, rerender } = render(
      <PreviewPanel item={itemA} onClose={vi.fn()} onUpdateNote={onUpdateNote} />,
    );

    // Open the note editor by clicking the "Add note" toggle
    const toggle = container.querySelector(".preview-panel__note-toggle");
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle!);

    const noteInput = container.querySelector(
      ".preview-panel__note-input",
    ) as HTMLInputElement | null;
    expect(noteInput).not.toBeNull();

    // Type a note while item A is the current item
    fireEvent.change(noteInput!, { target: { value: "note-for-A" } });

    // Re-render with item B. Cleanup of [item.id] effect should flush the
    // pending note to A's id, not B's. Bug: itemRef.current is reassigned
    // to B before cleanup runs, so flushNote writes A's note to B's id.
    rerender(<PreviewPanel item={itemB} onClose={vi.fn()} onUpdateNote={onUpdateNote} />);

    expect(onUpdateNote).toHaveBeenCalledWith(itemA.id, "note-for-A");
    expect(onUpdateNote).not.toHaveBeenCalledWith(itemB.id, expect.anything());
  });
});
