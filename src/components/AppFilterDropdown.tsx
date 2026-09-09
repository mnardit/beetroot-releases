import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import {
  IconChevronDown,
  IconSortAscendingLetters,
  IconSortDescendingNumbers,
  IconClock,
  IconX,
  IconSparkles,
} from "@tabler/icons-react";
import { useTranslation } from "../lib/i18n";
import type { AppIconData } from "../hooks/useAppIcons";

type AppSortMode = "last_used" | "most_used" | "alpha";

interface AppFilterDropdownProps {
  appFilter: string | null;
  setAppFilter: (filter: string | null) => void;
  appCounts: Record<string, number>;
  appLastUsed: Record<string, string>;
  appIcons: Record<string, AppIconData>;
}

export const AppFilterDropdown = memo(function AppFilterDropdown({
  appFilter,
  setAppFilter,
  appCounts,
  appLastUsed,
  appIcons,
}: AppFilterDropdownProps) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<AppSortMode>(() => {
    const saved = localStorage.getItem("appSortMode");
    return saved === "most_used" || saved === "alpha" ? saved : "last_used";
  });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSetSortMode = useCallback((mode: AppSortMode) => {
    setSortMode(mode);
    localStorage.setItem("appSortMode", mode);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === "Tab") {
        close();
        return;
      }

      const items = ref.current?.querySelectorAll<HTMLButtonElement>(".app-filter__item");
      if (!items || items.length === 0) return;

      const focused = document.activeElement as HTMLElement;
      const index = Array.from(items).indexOf(focused as HTMLButtonElement);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (index === -1) {
            items[0].focus();
          } else {
            items[index < items.length - 1 ? index + 1 : 0].focus();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (index <= 0) {
            // From first item (or not in list), go back to search input
            searchRef.current?.focus();
          } else {
            items[index - 1].focus();
          }
          break;
        case "Home":
          e.preventDefault();
          items[0].focus();
          break;
        case "End":
          e.preventDefault();
          items[items.length - 1].focus();
          break;
      }
    },
    [close],
  );

  const apps = useMemo(() => {
    const entries = Object.entries(appCounts);

    // Filter by search
    const filtered = search
      ? entries.filter(([exeName]) => {
          const displayName = appIcons[exeName]?.displayName || exeName;
          return displayName.toLowerCase().includes(search.toLowerCase());
        })
      : entries;

    // Sort
    switch (sortMode) {
      case "alpha":
        return filtered.sort((a, b) => {
          const nameA = appIcons[a[0]]?.displayName || a[0];
          const nameB = appIcons[b[0]]?.displayName || b[0];
          return nameA.localeCompare(nameB);
        });
      case "most_used":
        return filtered.sort((a, b) => b[1] - a[1]);
      case "last_used":
      default:
        return filtered.sort((a, b) => {
          const tA = appLastUsed[a[0]] || "";
          const tB = appLastUsed[b[0]] || "";
          return tB.localeCompare(tA);
        });
    }
  }, [appCounts, appIcons, appLastUsed, search, sortMode]);

  if (Object.keys(appCounts).length === 0) return null;

  const activeLabel = appFilter
    ? appFilter === "AI"
      ? t("filter.aiTransform")
      : appIcons[appFilter]?.displayName || appFilter.replace(/\.exe$/i, "")
    : t("filter.apps");

  const sortOptions: { mode: AppSortMode; icon: typeof IconClock; title: string }[] = [
    { mode: "last_used", icon: IconClock, title: t("filter.sortLastUsed") },
    { mode: "most_used", icon: IconSortDescendingNumbers, title: t("filter.sortMostUsed") },
    { mode: "alpha", icon: IconSortAscendingLetters, title: t("filter.sortAlpha") },
  ];

  return (
    <div className="app-filter" ref={ref}>
      <button
        ref={triggerRef}
        className={`filter-bar__chip ${appFilter ? "filter-bar__chip--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {appFilter &&
          (appFilter === "AI" ? (
            <IconSparkles size={14} className="app-filter__chip-icon app-filter__chip-icon--ai" />
          ) : appIcons[appFilter]?.iconBase64 ? (
            <img
              src={`data:image/png;base64,${appIcons[appFilter].iconBase64}`}
              alt=""
              className="app-filter__chip-icon"
            />
          ) : null)}
        {activeLabel}
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div
          className="app-filter__dropdown"
          role="menu"
          aria-label={t("filter.apps")}
          onKeyDown={handleKeyDown}
        >
          <div className="app-filter__toolbar">
            <div className="app-filter__search-wrap">
              <input
                ref={searchRef}
                type="text"
                className="app-filter__search"
                placeholder={t("filter.searchApps")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (search) {
                      e.stopPropagation();
                      setSearch("");
                    }
                  }
                }}
              />
              {search && (
                <button
                  className="app-filter__search-clear"
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
            <div className="app-filter__sort-buttons">
              {sortOptions.map(({ mode, icon: Icon, title }) => (
                <button
                  key={mode}
                  className={`app-filter__sort-btn ${sortMode === mode ? "app-filter__sort-btn--active" : ""}`}
                  title={title}
                  aria-label={title}
                  aria-pressed={sortMode === mode}
                  onClick={() => handleSetSortMode(mode)}
                  type="button"
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="app-filter__list">
            {appFilter && (
              <button
                className="app-filter__item"
                role="menuitem"
                onClick={() => {
                  setAppFilter(null);
                  close();
                }}
              >
                <span className="app-filter__name">{t("filter.all")}</span>
              </button>
            )}
            {apps.map(([exeName, count]) => {
              const icon = appIcons[exeName];
              const displayName = icon?.displayName || exeName.replace(/\.exe$/i, "");
              return (
                <button
                  key={exeName}
                  className={`app-filter__item ${appFilter === exeName ? "app-filter__item--active" : ""}`}
                  role="menuitemradio"
                  aria-checked={appFilter === exeName}
                  onClick={() => {
                    setAppFilter(exeName);
                    close();
                  }}
                >
                  {exeName === "AI" ? (
                    <IconSparkles size={16} className="app-filter__icon app-filter__icon--ai" />
                  ) : icon?.iconBase64 ? (
                    <img
                      src={`data:image/png;base64,${icon.iconBase64}`}
                      alt=""
                      className="app-filter__icon"
                    />
                  ) : null}
                  <span className="app-filter__name">
                    {exeName === "AI" ? t("filter.aiTransform") : displayName}
                  </span>
                  <span className="app-filter__count">{count}</span>
                </button>
              );
            })}
            {apps.length === 0 && search && (
              <div className="app-filter__empty">{t("filter.noAppsFound")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
