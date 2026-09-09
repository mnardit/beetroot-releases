import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Onboarding } from "../Onboarding";

describe("Onboarding", () => {
  it("renders the first step initially", () => {
    const { container } = render(<Onboarding onDone={vi.fn()} />);
    const title = container.querySelector(".onboarding__title")!;
    expect(title.textContent).toBeTruthy();
  });

  it("shows Next button on first step", () => {
    const { container } = render(<Onboarding onDone={vi.fn()} />);
    const nextBtn = container.querySelector(".onboarding__next")!;
    expect(nextBtn.textContent).toBe("Next");
  });

  it("advances to next step when clicking Next", () => {
    const { container } = render(<Onboarding onDone={vi.fn()} />);
    const nextBtn = container.querySelector(".onboarding__next")!;
    const titleBefore = container.querySelector(".onboarding__title")!.textContent;
    fireEvent.click(nextBtn);
    const titleAfter = container.querySelector(".onboarding__title")!.textContent;
    expect(titleAfter).not.toBe(titleBefore);
  });

  it("shows Get Started button on last step (step 5)", () => {
    const { container } = render(<Onboarding onDone={vi.fn()} />);
    const nextBtn = container.querySelector(".onboarding__next")!;
    fireEvent.click(nextBtn); // step 2
    fireEvent.click(nextBtn); // step 3
    fireEvent.click(nextBtn); // step 4
    fireEvent.click(nextBtn); // step 5 (last)
    expect(nextBtn.textContent).toBe("Get started");
  });

  it("calls onDone when clicking Get Started on last step", () => {
    const onDone = vi.fn();
    const { container } = render(<Onboarding onDone={onDone} />);
    const nextBtn = container.querySelector(".onboarding__next")!;
    fireEvent.click(nextBtn); // step 2
    fireEvent.click(nextBtn); // step 3
    fireEvent.click(nextBtn); // step 4
    fireEvent.click(nextBtn); // step 5 (last)
    fireEvent.click(nextBtn); // finish
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onDone when clicking Skip", () => {
    const onDone = vi.fn();
    const { container } = render(<Onboarding onDone={onDone} />);
    const skipBtn = container.querySelector(".onboarding__skip")!;
    fireEvent.click(skipBtn);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onDone when clicking overlay", () => {
    const onDone = vi.fn();
    const { container } = render(<Onboarding onDone={onDone} />);
    fireEvent.click(container.querySelector(".onboarding-overlay")!);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("does not call onDone when clicking the panel itself", () => {
    const onDone = vi.fn();
    const { container } = render(<Onboarding onDone={onDone} />);
    fireEvent.click(container.querySelector(".onboarding")!);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("navigates through all 5 steps", () => {
    const { container } = render(<Onboarding onDone={vi.fn()} />);
    const nextBtn = container.querySelector(".onboarding__next")!;
    expect(nextBtn.textContent).toBe("Next");
    fireEvent.click(nextBtn); // step 2
    expect(nextBtn.textContent).toBe("Next");
    fireEvent.click(nextBtn); // step 3
    expect(nextBtn.textContent).toBe("Next");
    fireEvent.click(nextBtn); // step 4
    expect(nextBtn.textContent).toBe("Next");
    fireEvent.click(nextBtn); // step 5 (last)
    expect(nextBtn.textContent).toBe("Get started");
  });
});
