import { forwardRef } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import "../styles/SearchBar.css";
import { useTranslation } from "../lib/i18n";
import type { SearchMode } from "../types/clipboard";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  searchMode?: SearchMode;
  onToggleMode?: () => void;
  regexError?: string | null;
  resultCount?: number;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange, searchMode = "fuzzy", onToggleMode, regexError, resultCount }, ref) => {
    const t = useTranslation();

    return (
      <div className="search-bar" role="search">
        <IconSearch size={16} className="search-bar__icon" />
        <input
          ref={ref}
          type="text"
          className={`search-input ${regexError ? "search-input--error" : ""}`}
          placeholder={
            searchMode === "regex" ? t("search.regexPlaceholder") : t("search.placeholder")
          }
          aria-label={t("search.placeholder")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          spellCheck={false}
        />
        {regexError && (
          <span className="search-error" role="alert">
            {t("search.regexError", { detail: regexError })}
          </span>
        )}
        {!regexError && value && resultCount !== undefined && (
          <span className="search-result-count">
            {t("search.resultCount", { count: resultCount })}
          </span>
        )}
        {value && (
          <button
            className="search-clear"
            onClick={() => onChange("")}
            title={t("search.clear")}
            aria-label={t("search.clear")}
          >
            <IconX size={16} />
          </button>
        )}
        {onToggleMode && (
          <button
            className={`search-mode ${searchMode === "regex" ? "search-mode--active" : ""}`}
            onClick={onToggleMode}
            title={t("search.regexTooltip")}
            aria-label={t("search.modeLabel", { mode: searchMode })}
          >
            .*
          </button>
        )}
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";
