import { useState, useEffect, useCallback, useRef } from "react";
import { useDebouncedValue } from "./useDebouncedValue";
import { SEARCH_DEBOUNCE_MS } from "../lib/constants";
import { searchItems, type SearchResponse, type FilterCounts } from "../lib/tauri";
import type { ClipboardEntry, SearchMode, TypeFilter } from "../types/clipboard";

export function useSearchAndFilter(maxHistorySize: number, refreshKey: number) {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fuzzy");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [appFilter, setAppFilter] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  // Search result state
  const [filtered, setFiltered] = useState<ClipboardEntry[]>([]);
  const [matchMap, setMatchMap] = useState<Map<number, readonly [number, number][]>>(new Map());
  const [titleMatchMap, setTitleMatchMap] = useState<Map<number, readonly [number, number][]>>(
    new Map(),
  );
  const [noteMatchMap, setNoteMatchMap] = useState<Map<number, readonly [number, number][]>>(
    new Map(),
  );
  const [filterCounts, setFilterCounts] = useState<FilterCounts>({
    all: 0,
    starred: 0,
    text: 0,
    image: 0,
    notes: 0,
  });
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [appLastUsed, setAppLastUsed] = useState<Record<string, string>>({});
  const [regexError, setRegexError] = useState<string | null>(null);

  // Stale response protection
  const requestCounter = useRef(0);

  const doSearch = useCallback(async () => {
    const seq = ++requestCounter.current;

    // Validate regex client-side for user-friendly error message.
    // Rust also validates (different regex engine), and its result is
    // authoritative — we use the JS message only for display.
    let clientRegexError: string | null = null;
    if (searchMode === "regex" && debouncedQuery) {
      try {
        new RegExp(debouncedQuery);
      } catch (e) {
        const raw = (e as Error).message;
        const detail = raw.match(/: \/.*?\/: (.+)$/);
        clientRegexError = detail ? detail[1] : raw;
      }
    }

    try {
      const response: SearchResponse = await searchItems({
        query: debouncedQuery,
        search_mode: searchMode,
        type_filter: typeFilter,
        app_filter: appFilter,
        limit: maxHistorySize,
      });

      // Discard stale responses
      if (seq !== requestCounter.current) return;

      // Extract items and match maps
      const items: ClipboardEntry[] = [];
      const newMatchMap = new Map<number, readonly [number, number][]>();
      const newTitleMatchMap = new Map<number, readonly [number, number][]>();
      const newNoteMatchMap = new Map<number, readonly [number, number][]>();

      for (const result of response.items) {
        // Extract the ClipboardEntry (all fields except matches)
        const { matches, ...entry } = result;
        items.push(entry);

        // Build match maps for highlighting
        if (debouncedQuery && matches) {
          for (const m of matches) {
            if (m.indices.length > 0) {
              if (m.field === "content") {
                newMatchMap.set(entry.id, m.indices);
              } else if (m.field === "source_title") {
                newTitleMatchMap.set(entry.id, m.indices);
              } else if (m.field === "note") {
                newNoteMatchMap.set(entry.id, m.indices);
              }
            }
          }
        }
      }

      setFiltered(items);
      setMatchMap(newMatchMap);
      setTitleMatchMap(newTitleMatchMap);
      setNoteMatchMap(newNoteMatchMap);
      setFilterCounts(response.filter_counts);
      setAppCounts(response.app_counts);
      setAppLastUsed(response.app_last_used);
      // Use Rust-side regex_error as authoritative (different engine than JS),
      // but prefer client-side error message for display since it's more descriptive.
      setRegexError(response.regex_error ? (clientRegexError ?? "Invalid regex") : null);
    } catch (e) {
      if (seq !== requestCounter.current) return;
      console.error("search_items failed:", e);
    }
  }, [debouncedQuery, searchMode, typeFilter, appFilter, maxHistorySize]);

  // Run search whenever inputs change or refreshKey bumps.
  // The async IPC call sets state in its .then() callback, not synchronously.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    doSearch();
  }, [doSearch, refreshKey]);

  const hasImages = filterCounts.image > 0;
  const hasNotes = filterCounts.notes > 0;

  // Auto-clear app filter when selected app no longer has any items
  useEffect(() => {
    if (appFilter && !appCounts[appFilter]) {
      setAppFilter(null); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [appFilter, appCounts]);

  return {
    query,
    setQuery,
    searchMode,
    setSearchMode,
    typeFilter,
    setTypeFilter,
    appFilter,
    setAppFilter,
    appCounts,
    appLastUsed,
    filtered,
    matchMap,
    titleMatchMap,
    noteMatchMap,
    filterCounts,
    hasImages,
    hasNotes,
    regexError,
  };
}
