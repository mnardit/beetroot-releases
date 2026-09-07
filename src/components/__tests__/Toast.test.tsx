import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, within, act } from "@testing-library/react";
import { ToastProvider } from "../Toast";
import { useToast } from "../../hooks/useToast";

const mockUndoAction = vi.fn();

function ToastTrigger() {
  const { showError, showInfo } = useToast();
  return (
    <div>
      <button onClick={() => showError("error msg")}>Error</button>
      <button onClick={() => showInfo("info msg")}>Info</button>
      <button onClick={() => showInfo("undo msg", { label: "Undo", onClick: mockUndoAction })}>
        Undo
      </button>
    </div>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children without toasts by default", () => {
    const { container } = render(
      <ToastProvider>
        <div>content</div>
      </ToastProvider>,
    );
    expect(within(container).getByText("content")).toBeInTheDocument();
    expect(container.querySelector(".toast-container")).toBeNull();
  });

  it("shows error toast", async () => {
    const { container } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")!.click();
    });

    const toast = container.querySelector(".toast--error");
    expect(toast).not.toBeNull();
    expect(toast!.textContent).toBe("error msg");
  });

  it("shows info toast", async () => {
    const { container } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    const buttons = container.querySelectorAll("button");
    await act(async () => {
      buttons[1].click(); // Info button
    });

    const toast = container.querySelector(".toast--info");
    expect(toast).not.toBeNull();
    expect(toast!.textContent).toBe("info msg");
  });

  it("auto-dismisses after TOAST_DISMISS_MS", async () => {
    const { container } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")!.click();
    });

    expect(container.querySelector(".toast")).not.toBeNull();

    // Advance past TOAST_DISMISS_MS to trigger exit animation
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Toast should be in exiting state with exit animation class
    expect(container.querySelector(".toast--exiting")).not.toBeNull();

    // Advance past exit animation duration (200ms) to fully remove
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(container.querySelector(".toast")).toBeNull();
  });

  it("renders undo action button and calls onClick", async () => {
    mockUndoAction.mockClear();
    const { container } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    const buttons = container.querySelectorAll("button");
    // Click the "Undo" trigger button (3rd button)
    await act(async () => {
      buttons[2].click();
    });

    const actionBtn = container.querySelector(".toast__action");
    expect(actionBtn).not.toBeNull();
    expect(actionBtn!.textContent).toBe("Undo");

    await act(async () => {
      (actionBtn as HTMLButtonElement).click();
    });

    expect(mockUndoAction).toHaveBeenCalledTimes(1);
  });

  it("can show multiple toasts", async () => {
    const { container } = render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    const buttons = container.querySelectorAll("button");

    await act(async () => {
      buttons[0].click();
      buttons[1].click();
    });

    const toasts = container.querySelectorAll(".toast");
    expect(toasts.length).toBe(2);
  });
});
