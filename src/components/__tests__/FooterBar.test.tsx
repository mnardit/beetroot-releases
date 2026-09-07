import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FooterBar } from "../FooterBar";

function renderFooter(overrides: Partial<Parameters<typeof FooterBar>[0]> = {}) {
  const props = {
    multiSelectedCount: 0,
    onBatchCopy: vi.fn(),
    onBatchDelete: vi.fn(),
    onCancelSelection: vi.fn(),
    onShowShortcuts: vi.fn(),
    monitorPaused: false,
    onTogglePause: vi.fn(),
    onTogglePin: vi.fn(),
    windowMode: "normal" as const,
    pasteMode: "auto" as const,
    onToggleFollowCursor: vi.fn(),
    onShowSettings: vi.fn(),
    ...overrides,
  };
  const result = render(<FooterBar {...props} />);
  return { ...result, props };
}

describe("FooterBar", () => {
  it("renders hint text and action buttons in default mode", () => {
    const { container } = renderFooter();
    expect(container.querySelector(".footer__hint")).toBeTruthy();
    expect(container.querySelector(".footer__help")).toBeTruthy();
    expect(container.querySelector(".footer__pause")).toBeTruthy();
    expect(container.querySelector(".footer__settings")).toBeTruthy();
  });

  it("calls onShowSettings when settings button clicked", () => {
    const { container, props } = renderFooter();
    fireEvent.click(container.querySelector(".footer__settings")!);
    expect(props.onShowSettings).toHaveBeenCalled();
  });

  it("calls onTogglePause when pause button clicked", () => {
    const { container, props } = renderFooter();
    fireEvent.click(container.querySelector(".footer__pause")!);
    expect(props.onTogglePause).toHaveBeenCalled();
  });

  it("shows active class when paused", () => {
    const { container } = renderFooter({ monitorPaused: true });
    expect(container.querySelector(".footer__pause--active")).toBeTruthy();
  });

  it("renders batch mode when items are selected", () => {
    const { container } = renderFooter({ multiSelectedCount: 3 });
    expect(container.querySelector(".footer__hint")!.textContent).toContain("3");
    expect(container.querySelector(".footer__batch-btn")).toBeTruthy();
  });

  it("calls onBatchDelete in batch mode", () => {
    const { container, props } = renderFooter({ multiSelectedCount: 2 });
    const dangerBtn = container.querySelector(".footer__batch-btn--danger")!;
    fireEvent.click(dangerBtn);
    expect(props.onBatchDelete).toHaveBeenCalled();
  });

  it("calls onCancelSelection when cancel clicked in batch mode", () => {
    const { container, props } = renderFooter({ multiSelectedCount: 2 });
    const buttons = container.querySelectorAll(".footer__batch-btn");
    const cancelBtn = buttons[buttons.length - 1]; // last button is cancel
    fireEvent.click(cancelBtn);
    expect(props.onCancelSelection).toHaveBeenCalled();
  });

  it("renders pin button", () => {
    const { container } = renderFooter();
    expect(container.querySelector(".footer__pin")).toBeTruthy();
  });

  it("calls onTogglePin when pin button clicked", () => {
    const { container, props } = renderFooter();
    fireEvent.click(container.querySelector(".footer__pin")!);
    expect(props.onTogglePin).toHaveBeenCalled();
  });

  it("shows active class when pinned", () => {
    const { container } = renderFooter({ windowMode: "pinned" });
    expect(container.querySelector(".footer__pin--active")).toBeTruthy();
  });

  it("updates aria-label when pinned", () => {
    const { container } = renderFooter({ windowMode: "pinned" });
    const btn = container.querySelector(".footer__pin") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBeTruthy();
    // When pinned, label should differ from unpinned
    const { container: c2 } = renderFooter({ windowMode: "normal" });
    const btn2 = c2.querySelector(".footer__pin") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).not.toBe(btn2.getAttribute("aria-label"));
  });

  it("separator trigger has aria-haspopup and aria-expanded", () => {
    const { container } = renderFooter({ multiSelectedCount: 2 });
    const trigger = container.querySelector(".footer__batch-btn") as HTMLButtonElement;
    expect(trigger.getAttribute("aria-haspopup")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("separator menu has role=menu and items have role=menuitem", () => {
    const { container } = renderFooter({ multiSelectedCount: 2 });
    const trigger = container.querySelector(".footer__batch-btn") as HTMLButtonElement;
    fireEvent.click(trigger);

    const menu = container.querySelector(".sep-menu");
    expect(menu?.getAttribute("role")).toBe("menu");
    expect(menu?.getAttribute("aria-label")).toBeTruthy();

    const items = container.querySelectorAll(".sep-menu__item");
    items.forEach((item) => {
      expect(item.getAttribute("role")).toBe("menuitem");
    });
  });

  it("aria-expanded updates when separator menu opens", () => {
    const { container } = renderFooter({ multiSelectedCount: 2 });
    const trigger = container.querySelector(".footer__batch-btn") as HTMLButtonElement;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes separator menu on Escape", () => {
    const { container } = renderFooter({ multiSelectedCount: 2 });
    const trigger = container.querySelector(".footer__batch-btn") as HTMLButtonElement;
    fireEvent.click(trigger);

    const menu = container.querySelector(".sep-menu")!;
    expect(menu).toBeTruthy();

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(container.querySelector(".sep-menu")).toBeFalsy();
  });
});
