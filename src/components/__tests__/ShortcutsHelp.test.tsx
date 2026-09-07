import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ShortcutsHelp } from "../ShortcutsHelp";

const defaultProps = {
  onClose: vi.fn(),
  shortcutPinWindow: "Alt+KeyP",
  shortcutFollowCursor: "Alt+KeyF",
};

describe("ShortcutsHelp", () => {
  it("renders all shortcut entries", () => {
    const { container } = render(<ShortcutsHelp {...defaultProps} />);
    const rows = container.querySelectorAll(".shortcuts__row");
    expect(rows.length).toBe(13);
  });

  it("displays shortcut keys and actions", () => {
    const { container } = render(<ShortcutsHelp {...defaultProps} />);
    const keys = container.querySelectorAll(".shortcuts__key");
    const keyTexts = Array.from(keys).map((k) => k.textContent);
    expect(keyTexts).toContain("Enter");
    expect(keyTexts).toContain("Space");
    expect(keyTexts).toContain("Esc");
  });

  it("shows configured shortcut keys", () => {
    const { container } = render(<ShortcutsHelp {...defaultProps} />);
    const keys = container.querySelectorAll(".shortcuts__key");
    const keyTexts = Array.from(keys).map((k) => k.textContent);
    expect(keyTexts).toContain("Alt+P");
    expect(keyTexts).toContain("Alt+F");
  });

  it("hides disabled shortcuts", () => {
    const { container } = render(
      <ShortcutsHelp onClose={vi.fn()} shortcutPinWindow="" shortcutFollowCursor="" />,
    );
    const rows = container.querySelectorAll(".shortcuts__row");
    expect(rows.length).toBe(11);
  });

  it("shows custom shortcut keys", () => {
    const { container } = render(
      <ShortcutsHelp
        onClose={vi.fn()}
        shortcutPinWindow="Ctrl+KeyX"
        shortcutFollowCursor="Shift+KeyG"
      />,
    );
    const keys = container.querySelectorAll(".shortcuts__key");
    const keyTexts = Array.from(keys).map((k) => k.textContent);
    expect(keyTexts).toContain("Ctrl+X");
    expect(keyTexts).toContain("Shift+G");
  });

  it("shows title", () => {
    const { container } = render(<ShortcutsHelp {...defaultProps} />);
    expect(container.querySelector(".shortcuts__title")?.textContent).toBe("Keyboard Shortcuts");
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on ? key", () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "?" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on overlay click", () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutsHelp {...defaultProps} onClose={onClose} />);
    fireEvent.click(container.querySelector(".shortcuts-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when clicking the panel", () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutsHelp {...defaultProps} onClose={onClose} />);
    fireEvent.click(container.querySelector(".shortcuts")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders close button", () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutsHelp {...defaultProps} onClose={onClose} />);
    const closeBtn = container.querySelector(".shortcuts__close")!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
