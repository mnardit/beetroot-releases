import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ClipboardList } from "../ClipboardList";
import { makeEntry } from "../../test/fixtures";

describe("ClipboardList", () => {
  const defaultProps = {
    selectedIndex: 0,
    onSelect: vi.fn(),
    onStar: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders items via virtual list", () => {
    const items = [
      makeEntry(1, { content: "first" }),
      makeEntry(2, { content: "second" }),
      makeEntry(3, { content: "third" }),
    ];
    const { container } = render(<ClipboardList items={items} {...defaultProps} />);
    // react-window renders items with absolute positioning
    const clipItems = container.querySelectorAll(".clip-item");
    expect(clipItems.length).toBeGreaterThanOrEqual(3);
  });

  it("marks selected item", () => {
    const items = [makeEntry(1, { content: "first" }), makeEntry(2, { content: "second" })];
    const { container } = render(
      <ClipboardList items={items} {...defaultProps} selectedIndex={1} />,
    );
    const clipItems = container.querySelectorAll(".clip-item");
    expect(clipItems[0]).not.toHaveClass("clip-item--selected");
    expect(clipItems[1]).toHaveClass("clip-item--selected");
  });

  it("renders empty for empty items array", () => {
    const { container } = render(<ClipboardList items={[]} {...defaultProps} />);
    expect(container.querySelectorAll(".clip-item").length).toBe(0);
  });
});
