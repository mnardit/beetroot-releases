import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "../SearchBar";

describe("SearchBar", () => {
  it("renders with placeholder", () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} />);
    const input = container.querySelector("input")!;
    expect(input.getAttribute("placeholder")).toBe("Search clipboard history...");
  });

  it("displays the current value", () => {
    const { container } = render(<SearchBar value="hello" onChange={() => {}} />);
    const input = container.querySelector("input")!;
    expect(input.value).toBe("hello");
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<SearchBar value="" onChange={onChange} />);
    const input = container.querySelector("input")!;
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("renders as text input", () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} />);
    const input = container.querySelector("input")!;
    expect(input.getAttribute("type")).toBe("text");
  });
});
