import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../ErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>All good</div>;
}

describe("ErrorBoundary", () => {
  // Suppress React error boundary console.error in tests
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    const { container } = render(
      <ErrorBoundary>
        <div>child content</div>
      </ErrorBoundary>,
    );
    expect(within(container).getByText("child content")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(within(container).getByText("Something went wrong")).toBeInTheDocument();
    expect(within(container).getByText("Test error")).toBeInTheDocument();
  });

  it("shows retry button in error state", () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(within(container).getByText("Retry")).toBeInTheDocument();
  });

  it("recovers when retry is clicked and error is resolved", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalChild() {
      if (shouldThrow) throw new Error("Temporary error");
      return <div>Recovered</div>;
    }

    const { container } = render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>,
    );

    expect(within(container).getByText("Something went wrong")).toBeInTheDocument();

    // Fix the error condition before retry
    shouldThrow = false;
    await user.click(within(container).getByText("Retry"));

    expect(within(container).getByText("Recovered")).toBeInTheDocument();
  });
});
