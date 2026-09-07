import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { ContextMenu } from "../ContextMenu";
import { makeEntry } from "../../test/fixtures";

const textItem = makeEntry(1, { content: "test content" });

const imageItem = makeEntry(2, {
  content_type: "image",
  image_path: "/images/abc.png",
});

function renderMenu(overrides: Partial<Parameters<typeof ContextMenu>[0]> = {}) {
  const props = {
    x: 100,
    y: 200,
    item: textItem,
    onClose: vi.fn(),
    onError: vi.fn(),
    onCopy: vi.fn(),
    onStar: vi.fn(),
    onDelete: vi.fn(),
    onPreview: vi.fn(),
    onShowInExplorer: vi.fn(),
    onTransform: vi.fn(),
    ...overrides,
  };
  const result = render(<ContextMenu {...props} />);
  return { ...result, props };
}

describe("ContextMenu", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders copy, pin, preview, transform, delete for text items", () => {
    const { container } = renderMenu();
    const items = container.querySelectorAll("[role='menuitem']");
    expect(items.length).toBe(5); // copy, pin, preview, transform, delete
  });

  it("shows Copy as first menu item", () => {
    const { container } = renderMenu();
    const firstItem = container.querySelector("[role='menuitem']")!;
    expect(firstItem.textContent).toContain("Copy");
  });

  it("shows unpin label for starred items", () => {
    const { container } = renderMenu({ item: { ...textItem, starred: true } });
    const items = container.querySelectorAll("[role='menuitem']");
    expect(items[1].textContent).toContain("Unstar");
  });

  it("shows pin label for unpinned items", () => {
    const { container } = renderMenu();
    const items = container.querySelectorAll("[role='menuitem']");
    expect(items[1].textContent).toContain("Star");
  });

  it("calls onCopy and onClose when copy is clicked", () => {
    const { container, props } = renderMenu();
    const copyBtn = container.querySelector("[role='menuitem']")!;
    fireEvent.click(copyBtn);
    expect(props.onCopy).toHaveBeenCalledWith(textItem);
    act(() => vi.advanceTimersByTime(100));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("calls onStar and onClose when star is clicked", () => {
    const { container, props } = renderMenu();
    const items = container.querySelectorAll("[role='menuitem']");
    fireEvent.click(items[1]); // pin is second after copy
    expect(props.onStar).toHaveBeenCalledWith(1, true);
    act(() => vi.advanceTimersByTime(100));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("calls onDelete and onClose when delete is clicked", () => {
    const { container, props } = renderMenu();
    const buttons = container.querySelectorAll("[role='menuitem']");
    const deleteBtn = buttons[buttons.length - 1];
    fireEvent.click(deleteBtn);
    expect(props.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    act(() => vi.advanceTimersByTime(100));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("calls onPreview and onClose when preview is clicked", () => {
    const { container, props } = renderMenu();
    const buttons = container.querySelectorAll("[role='menuitem']");
    fireEvent.click(buttons[2]); // third button is preview (after copy, pin)
    expect(props.onPreview).toHaveBeenCalledWith(textItem);
    act(() => vi.advanceTimersByTime(100));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows Show in Explorer for image items", () => {
    const { container } = renderMenu({ item: imageItem, onOcr: vi.fn() });
    const items = container.querySelectorAll("[role='menuitem']");
    // image: copy, pin, preview, transform, show in explorer, OCR, delete
    expect(items.length).toBe(7);
    const texts = Array.from(items).map((i) => i.textContent);
    expect(texts.some((t) => t?.includes("Explorer"))).toBe(true);
  });

  it("shows transform for image items", () => {
    const { container } = renderMenu({ item: imageItem });
    const texts = Array.from(container.querySelectorAll("[role='menuitem']")).map(
      (i) => i.textContent,
    );
    expect(texts.some((t) => t?.includes("Transform"))).toBe(true);
  });

  it("shows OCR button for image items and calls onOcr", () => {
    const onOcr = vi.fn();
    const { container, props } = renderMenu({ item: imageItem, onOcr });
    const items = container.querySelectorAll("[role='menuitem']");
    const texts = Array.from(items).map((i) => i.textContent);
    expect(texts.some((t) => t?.includes("OCR"))).toBe(true);
    const ocrBtn = Array.from(items).find((i) => i.textContent?.includes("OCR"))!;
    fireEvent.click(ocrBtn);
    expect(onOcr).toHaveBeenCalledWith(imageItem);
    act(() => vi.advanceTimersByTime(100));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("hides OCR button for text items", () => {
    const { container } = renderMenu({ onOcr: vi.fn() });
    const texts = Array.from(container.querySelectorAll("[role='menuitem']")).map(
      (i) => i.textContent,
    );
    expect(texts.some((t) => t?.includes("OCR"))).toBe(false);
  });

  it("closes on Escape key", () => {
    const { props } = renderMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(100));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("renders AI quick-access prompts when provided", () => {
    const prompts = [
      { id: "p1", name: "Summarize", prompt: "Summarize this", quickAccess: true },
      { id: "p2", name: "Fix grammar", prompt: "Fix grammar", quickAccess: true },
    ];
    const { container } = renderMenu({
      quickAccessPrompts: prompts,
      aiConfig: {
        provider: "openai" as const,
        hasKey: { openai: true, gemini: false, anthropic: false, deepseek: false },
        openaiModel: "gpt-5.4-nano" as const,

        geminiModel: "gemini-2.5-flash-lite" as const,

        anthropicModel: "claude-haiku-4-5" as const,

        deepseekModel: "deepseek-chat" as const,
        localEndpoint: "",
        localModel: "",
      },
      submitJob: vi.fn().mockResolvedValue(1),
    });

    const items = container.querySelectorAll("[role='menuitem']");
    const texts = Array.from(items).map((i) => i.textContent);
    expect(texts.some((t) => t?.includes("Summarize"))).toBe(true);
    expect(texts.some((t) => t?.includes("Fix grammar"))).toBe(true);
  });

  it("does not render AI prompts without a saved key", () => {
    const prompts = [{ id: "p1", name: "Summarize", prompt: "Summarize this", quickAccess: true }];
    const { container } = renderMenu({
      quickAccessPrompts: prompts,
      aiConfig: {
        provider: "openai" as const,
        hasKey: { openai: false, gemini: false, anthropic: false, deepseek: false },
        openaiModel: "gpt-5.4-nano" as const,

        geminiModel: "gemini-2.5-flash-lite" as const,

        anthropicModel: "claude-haiku-4-5" as const,

        deepseekModel: "deepseek-chat" as const,
        localEndpoint: "",
        localModel: "",
      },
      submitJob: vi.fn().mockResolvedValue(1),
    });

    const texts = Array.from(container.querySelectorAll("[role='menuitem']")).map(
      (i) => i.textContent,
    );
    expect(texts.some((t) => t?.includes("Summarize"))).toBe(false);
  });
});
