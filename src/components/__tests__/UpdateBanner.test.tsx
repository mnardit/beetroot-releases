import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateBanner } from "../UpdateBanner";
import type { UpdateStatus } from "../../hooks/useUpdater";

describe("UpdateBanner", () => {
  function renderBanner(
    status: UpdateStatus,
    callbacks?: Partial<{
      onDownload: () => void;
      onRestart: () => void;
      onDismiss: () => void;
    }>,
  ) {
    return render(
      <UpdateBanner
        status={status}
        onDownload={callbacks?.onDownload ?? vi.fn()}
        onRestart={callbacks?.onRestart ?? vi.fn()}
        onDismiss={callbacks?.onDismiss ?? vi.fn()}
      />,
    );
  }

  it("renders nothing for idle status", () => {
    const { container } = renderBanner({ state: "idle" });
    expect(container.querySelector(".update-banner")).toBeNull();
  });

  it("renders nothing for checking status", () => {
    const { container } = renderBanner({ state: "checking" });
    expect(container.querySelector(".update-banner")).toBeNull();
  });

  it("renders nothing for upToDate status", () => {
    const { container } = renderBanner({ state: "upToDate" });
    expect(container.querySelector(".update-banner")).toBeNull();
  });

  it("renders 'available' state with Download and Later buttons", () => {
    const { container } = renderBanner({
      state: "available",
      version: "1.6.6",
      update: { version: "1.6.6" } as never,
    });

    const banner = container.querySelector(".update-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("1.6.6");
    expect(container.querySelectorAll(".update-banner__btn").length).toBe(2);
    expect(container.querySelector(".update-banner__btn--primary")).not.toBeNull();
    expect(container.querySelector(".update-banner__btn--secondary")).not.toBeNull();
  });

  it("calls onDownload when Download button clicked", async () => {
    const onDownload = vi.fn();
    const { container } = renderBanner(
      {
        state: "available",
        version: "1.6.6",
        update: { version: "1.6.6" } as never,
      },
      { onDownload },
    );

    const button = container.querySelector(".update-banner__btn--primary") as HTMLButtonElement;
    await userEvent.click(button);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when Later button clicked", async () => {
    const onDismiss = vi.fn();
    const { container } = renderBanner(
      {
        state: "available",
        version: "1.6.6",
        update: { version: "1.6.6" } as never,
      },
      { onDismiss },
    );

    const button = container.querySelector(".update-banner__btn--secondary") as HTMLButtonElement;
    await userEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders 'downloading' state with progress percentage", () => {
    const { container } = renderBanner({ state: "downloading", progress: 47 });

    const banner = container.querySelector(".update-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("47");
  });

  it("renders 'ready' state with Restart button", async () => {
    const onRestart = vi.fn();
    const { container } = renderBanner({ state: "ready" }, { onRestart });

    const button = container.querySelector(".update-banner__btn--primary") as HTMLButtonElement;
    expect(button).not.toBeNull();
    await userEvent.click(button);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("renders 'error' state with message and Close button", async () => {
    const onDismiss = vi.fn();
    const message = "Network unreachable";
    const { container } = renderBanner({ state: "error", message }, { onDismiss });

    const banner = container.querySelector(".update-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain(message);

    const closeBtn = container.querySelector(".update-banner__btn--secondary") as HTMLButtonElement;
    await userEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses role='alert' with aria-live='polite' for screen readers", () => {
    const { container } = renderBanner({ state: "ready" });
    const banner = container.querySelector(".update-banner");
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute("role")).toBe("alert");
    expect(banner?.getAttribute("aria-live")).toBe("polite");
  });
});
