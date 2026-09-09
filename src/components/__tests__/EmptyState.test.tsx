import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("shows empty history message when no query", () => {
    render(<EmptyState hasQuery={false} />);
    expect(screen.getByText("Clipboard history is empty")).toBeInTheDocument();
    expect(screen.getByText("Copy something to get started")).toBeInTheDocument();
  });

  it("shows no results message when query present", () => {
    render(<EmptyState hasQuery={true} />);
    expect(screen.getByText("No matching items")).toBeInTheDocument();
    expect(screen.getByText("Try a different search term")).toBeInTheDocument();
  });
});
