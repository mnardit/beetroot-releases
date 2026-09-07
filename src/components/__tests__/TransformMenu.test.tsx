import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TransformMenu } from "../TransformMenu";
import { makeEntry } from "../../test/fixtures";

vi.mock("../../lib/openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/openai")>();
  return { ...actual };
});

const textItem = makeEntry(1, { content: "hello world" });

function renderMenu(overrides: Partial<Parameters<typeof TransformMenu>[0]> = {}) {
  const props = {
    item: textItem,
    contentType: "text" as const,
    onApply: vi.fn(),
    onClose: vi.fn(),
    aiPrompts: [],
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
    ...overrides,
  };
  const result = render(<TransformMenu {...props} />);
  return { ...result, props };
}

describe("TransformMenu", () => {
  it("renders built-in transform buttons", () => {
    const { container } = renderMenu();
    const buttons = container.querySelectorAll(".transform-menu__item");
    expect(buttons.length).toBeGreaterThanOrEqual(4); // 4 built-in transforms
  });

  it("shows transform title", () => {
    const { container } = renderMenu();
    expect(container.querySelector(".transform-menu__header")?.textContent).toBe("Transform text");
  });

  it("calls onApply with transformed text when clicking a transform", () => {
    const { container, props } = renderMenu();
    const buttons = container.querySelectorAll(".transform-menu__item");
    // First transform is uppercase
    fireEvent.click(buttons[0]);
    expect(props.onApply).toHaveBeenCalledWith("HELLO WORLD");
  });

  it("closes on Escape key", () => {
    const { props } = renderMenu();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("closes when clicking the overlay", () => {
    const { container, props } = renderMenu();
    const overlay = container.querySelector(".transform-overlay")!;
    fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("does not close when clicking the menu itself", () => {
    const { container, props } = renderMenu();
    const menu = container.querySelector(".transform-menu")!;
    fireEvent.click(menu);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("renders AI section when prompts are provided", () => {
    const { container } = renderMenu({
      aiPrompts: [{ id: "1", name: "Translate", prompt: "Translate to English" }],
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
    });
    expect(container.querySelector(".transform-menu__divider")).not.toBeNull();
    const buttons = container.querySelectorAll(".transform-menu__item");
    const labels = Array.from(buttons).map(
      (b) => b.querySelector(".transform-menu__label")?.textContent,
    );
    expect(labels).toContain("Translate");
  });

  it("does not render AI section when no prompts", () => {
    const { container } = renderMenu({ aiPrompts: [] });
    expect(container.querySelector(".transform-menu__divider")).toBeNull();
  });

  it("shows CTA instead of AI prompts when no key is saved", () => {
    const { container } = renderMenu({
      aiPrompts: [{ id: "1", name: "Test", prompt: "Test prompt" }],
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
    });
    const cta = container.querySelector(".transform-menu__cta");
    expect(cta).toBeTruthy();
    expect(cta?.textContent).toContain("API key");
    // AI prompt buttons should NOT be rendered
    const aiButtons = container.querySelectorAll(".transform-menu__item--ai");
    expect(aiButtons.length).toBe(0);
  });
});
