import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipboardItem } from "../ClipboardItem";
import { makeEntry as makeFixture } from "../../test/fixtures";

function makeEntry(overrides: Partial<Parameters<typeof makeFixture>[1] & { id?: number }> = {}) {
  const { id, ...rest } = { id: 1, content: "test content", ...overrides };
  return makeFixture(id, rest);
}

describe("ClipboardItem", () => {
  const defaultProps = {
    index: 0,
    isSelected: false,
    onSelect: vi.fn(),
    onStar: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders text content", () => {
    const { container } = render(
      <ClipboardItem item={makeEntry({ content: "hello world" })} {...defaultProps} />,
    );
    expect(within(container).getByText("hello world")).toBeInTheDocument();
  });

  it.each([
    ["\u{1f600} cafe\u0301 next", [8, 11], "next"],
    ["  \u{1f600}\n\uac00\ub098 ab", [7, 8], "ab"],
    ["\u{1f600} text", [0, 0], "\u{1f600}"],
    ["cafe\u0301 next", [0, 4], "cafe\u0301"],
  ] as const)(
    "highlights original Unicode character indices in %s",
    (content, indices, expected) => {
      const { container } = render(
        <ClipboardItem
          item={makeEntry({ content })}
          {...defaultProps}
          matchIndices={[[...indices]]}
        />,
      );
      expect(container.querySelector("mark")?.textContent).toBe(expected);
    },
  );

  it("truncates long content", () => {
    const longText = "a".repeat(150);
    const { container } = render(
      <ClipboardItem item={makeEntry({ content: longText })} {...defaultProps} />,
    );
    const content = container.querySelector(".clip-item__content");
    expect(content?.textContent).toMatch(/\.\.\.$/);
  });

  it("does not show index number", () => {
    const { container } = render(<ClipboardItem item={makeEntry()} {...defaultProps} index={0} />);
    const indexSpan = container.querySelector(".clip-item__index");
    expect(indexSpan).toBeNull();
  });

  it("applies selected class", () => {
    const { container } = render(
      <ClipboardItem item={makeEntry()} {...defaultProps} isSelected={true} />,
    );
    expect(container.firstChild).toHaveClass("clip-item--selected");
  });

  it("applies starred class", () => {
    const { container } = render(
      <ClipboardItem item={makeEntry({ starred: true })} {...defaultProps} />,
    );
    expect(container.firstChild).toHaveClass("clip-item--starred");
  });

  it("shows Unpin title for starred items", () => {
    const { container } = render(
      <ClipboardItem item={makeEntry({ starred: true })} {...defaultProps} />,
    );
    const pinBtn = container.querySelector(".clip-item__star");
    expect(pinBtn?.getAttribute("title")).toBe("Unstar");
  });

  it("shows Pin title for unstarred items", () => {
    const { container } = render(
      <ClipboardItem item={makeEntry({ starred: false })} {...defaultProps} />,
    );
    const pinBtn = container.querySelector(".clip-item__star");
    expect(pinBtn?.getAttribute("title")).toBe("Star");
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const entry = makeEntry();
    const { container } = render(
      <ClipboardItem item={entry} {...defaultProps} onSelect={onSelect} />,
    );
    await user.click(container.querySelector(".clip-item__content")!);
    expect(onSelect).toHaveBeenCalledWith(entry);
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ClipboardItem item={makeEntry({ id: 42 })} {...defaultProps} onDelete={onDelete} />,
    );
    await user.click(container.querySelector(".clip-item__delete")!);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });

  it("calls onStar when star button clicked", async () => {
    const onStar = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ClipboardItem
        item={makeEntry({ id: 7, starred: false })}
        {...defaultProps}
        onStar={onStar}
      />,
    );
    await user.click(container.querySelector(".clip-item__star")!);
    expect(onStar).toHaveBeenCalledWith(7, true);
  });

  it("shows time ago for recent items", () => {
    const now = new Date().toISOString().replace("Z", "");
    const { container } = render(
      <ClipboardItem item={makeEntry({ created_at: now, last_used: now })} {...defaultProps} />,
    );
    const timeSpan = container.querySelector(".clip-item__time");
    expect(timeSpan?.textContent).toBe("now");
  });

  it("shows thumbnail container for image entries", () => {
    const { container } = render(
      <ClipboardItem
        item={makeEntry({ content_type: "image", image_path: "/fake/path.png" })}
        {...defaultProps}
      />,
    );
    expect(container.querySelector(".clip-item__content--image")).toBeInTheDocument();
  });
});
