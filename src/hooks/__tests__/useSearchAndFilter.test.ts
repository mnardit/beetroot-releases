import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { makeEntry } from "../../test/fixtures";

// Mock useDebouncedValue to return value immediately (no delay)
vi.mock("../useDebouncedValue", () => ({
  useDebouncedValue: <T>(value: T) => value,
}));

// Mock the Tauri IPC searchItems function
const mockSearchItems = vi.fn();

vi.mock("../../lib/tauri", () => ({
  searchItems: (...args: unknown[]) => mockSearchItems(...args),
}));

import { useSearchAndFilter } from "../useSearchAndFilter";

const textItems = [
  makeEntry(1, { content: "hello world" }),
  makeEntry(2, { content: "foo bar baz" }),
  makeEntry(3, { content: "clipboard manager", starred: true }),
];

const mixedItems = [
  makeEntry(1, { content: "text item" }),
  makeEntry(2, { content_type: "image", image_path: "/img/2.png" }),
  makeEntry(3, { content: "another text", starred: true }),
  makeEntry(4, { content_type: "image", image_path: "/img/4.png" }),
];

function makeSearchResponse(
  items: ReturnType<typeof makeEntry>[],
  matches?: Record<number, { field: string; indices: [number, number][] }[]>,
) {
  return {
    items: items.map((item) => ({
      ...item,
      matches: matches?.[item.id] ?? [],
    })),
    total_unfiltered: items.length,
    filter_counts: {
      all: items.length,
      starred: items.filter((i) => i.starred).length,
      text: items.filter((i) => i.content_type === "text").length,
      image: items.filter((i) => i.content_type === "image").length,
      notes: items.filter((i) => i.note && i.note.trim() !== "").length,
    },
    app_counts: {},
    app_last_used: {},
    regex_error: false,
  };
}

describe("useSearchAndFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return all text items
    mockSearchItems.mockResolvedValue(makeSearchResponse(textItems));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls searchItems on mount and returns filtered results", async () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => {
      expect(result.current.filtered).toHaveLength(3);
    });

    expect(mockSearchItems).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "",
        search_mode: "fuzzy",
        type_filter: "all",
        app_filter: null,
        limit: 500,
      }),
    );
  });

  it("passes type_filter to searchItems when typeFilter changes", async () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => expect(result.current.filtered.length).toBeGreaterThan(0));

    // Now change to starred filter
    mockSearchItems.mockResolvedValue(makeSearchResponse(textItems.filter((i) => i.starred)));

    act(() => {
      result.current.setTypeFilter("starred");
    });

    await waitFor(() => {
      expect(mockSearchItems).toHaveBeenCalledWith(
        expect.objectContaining({ type_filter: "starred" }),
      );
    });
  });

  it("passes search_mode and query to searchItems", async () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => expect(result.current.filtered.length).toBeGreaterThan(0));

    act(() => {
      result.current.setSearchMode("regex");
      result.current.setQuery("hello.*");
    });

    await waitFor(() => {
      expect(mockSearchItems).toHaveBeenCalledWith(
        expect.objectContaining({ query: "hello.*", search_mode: "regex" }),
      );
    });
  });

  it("sets regexError for invalid regex in regex mode", async () => {
    mockSearchItems.mockResolvedValue({ ...makeSearchResponse([]), regex_error: true });
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => expect(mockSearchItems).toHaveBeenCalled());

    act(() => {
      result.current.setSearchMode("regex");
      result.current.setQuery("[invalid");
    });

    await waitFor(() => {
      expect(result.current.regexError).toBeTruthy();
    });
  });

  it("regexError is null for valid regex in regex mode", async () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => expect(mockSearchItems).toHaveBeenCalled());

    act(() => {
      result.current.setSearchMode("regex");
      result.current.setQuery("hello.*");
    });

    await waitFor(() => {
      expect(result.current.regexError).toBeNull();
    });
  });

  it("regexError is null in fuzzy mode even with invalid regex chars", async () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => expect(mockSearchItems).toHaveBeenCalled());

    act(() => {
      result.current.setSearchMode("fuzzy");
      result.current.setQuery("[invalid");
    });

    await waitFor(() => {
      expect(result.current.regexError).toBeNull();
    });
  });

  it("defaults to fuzzy search mode", async () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    expect(result.current.searchMode).toBe("fuzzy");
  });

  it("builds matchMap from response matches", async () => {
    mockSearchItems.mockResolvedValue({
      items: [
        {
          ...textItems[0],
          matches: [{ field: "content", indices: [[0, 4]] }],
        },
      ],
      total_unfiltered: 1,
      filter_counts: { all: 1, starred: 0, text: 1, image: 0, notes: 0 },
      app_counts: {},
      app_last_used: {},
    });

    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    act(() => {
      result.current.setQuery("hello");
    });

    await waitFor(() => {
      expect(result.current.matchMap.size).toBe(1);
      expect(result.current.matchMap.get(1)).toEqual([[0, 4]]);
    });
  });

  it("matchMap is empty when no query", async () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => expect(result.current.filtered.length).toBeGreaterThan(0));

    expect(result.current.matchMap.size).toBe(0);
  });

  it("handles empty items from search response", async () => {
    mockSearchItems.mockResolvedValue(makeSearchResponse([]));
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => {
      expect(result.current.filtered).toHaveLength(0);
    });

    expect(result.current.regexError).toBeNull();
  });

  it("defaults typeFilter to all", () => {
    const { result } = renderHook(() => useSearchAndFilter(500, 0));
    expect(result.current.typeFilter).toBe("all");
  });

  it("returns filter_counts from search response", async () => {
    mockSearchItems.mockResolvedValue(makeSearchResponse(mixedItems));
    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => {
      expect(result.current.filterCounts.all).toBe(4);
      expect(result.current.filterCounts.text).toBe(2);
      expect(result.current.filterCounts.image).toBe(2);
    });
  });

  it("returns app_counts from search response", async () => {
    mockSearchItems.mockResolvedValue({
      ...makeSearchResponse(textItems),
      app_counts: { "chrome.exe": 2, "code.exe": 1 },
      app_last_used: { "chrome.exe": "2024-01-02", "code.exe": "2024-01-01" },
    });

    const { result } = renderHook(() => useSearchAndFilter(500, 0));

    await waitFor(() => {
      expect(result.current.appCounts["chrome.exe"]).toBe(2);
      expect(result.current.appCounts["code.exe"]).toBe(1);
    });
  });

  it("re-searches when refreshKey changes", async () => {
    const { rerender } = renderHook(({ limit, key }) => useSearchAndFilter(limit, key), {
      initialProps: { limit: 500, key: 0 },
    });

    await waitFor(() => expect(mockSearchItems).toHaveBeenCalledTimes(1));

    rerender({ limit: 500, key: 1 });

    await waitFor(() => {
      expect(mockSearchItems).toHaveBeenCalledTimes(2);
    });
  });
});
