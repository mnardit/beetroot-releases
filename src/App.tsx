import { useCallback, useMemo } from "react";
import { IconGripHorizontal } from "@tabler/icons-react";
import { SearchBar } from "./components/SearchBar";
import { ClipboardList } from "./components/ClipboardList";
import { EmptyState } from "./components/EmptyState";
import { Settings } from "./components/Settings";
import { PreviewPanel } from "./components/PreviewPanel";
import { TransformMenu } from "./components/TransformMenu";
import { ContextMenu } from "./components/ContextMenu";
import { activateWindow } from "./lib/tauri";
import { Onboarding } from "./components/Onboarding";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { FooterBar } from "./components/FooterBar";
import { AppFilterDropdown } from "./components/AppFilterDropdown";
import { UpdateBanner } from "./components/UpdateBanner";
import { I18nContext } from "./lib/i18n";
import { useAppState } from "./hooks/useAppState";
import "./styles/FilterBar.css";

export default function App() {
  const state = useAppState();
  const {
    query,
    setQuery,
    searchRef,
    searchMode,
    setSearchMode,
    regexError,
    loading,
    filtered,
    matchMap,
    titleMatchMap,
    noteMatchMap,
    hasImages,
    hasNotes,
    typeFilter,
    setTypeFilter,
    selectedIndex,
    setSelectedIndex,
    showSettings,
    setShowSettings,
    previewItem,
    setPreviewItem,
    transformItem,
    setTransformItem,
    contextMenu,
    setContextMenu,
    showShortcuts,
    setShowShortcuts,
    onboardingVisible,
    setOnboardingVisible,
    markOnboardingDone,
    newItemId,
    pastingItemId,
    multiSelected,
    setMultiSelected,
    monitorPaused,
    setMonitorPaused,
    settings,
    aiConfig,
    keyStatuses,
    keysReady,
    keysError,
    refreshKeyStatuses,
    retryKeyMigration,
    handleSaveSettings,
    handleSelect,
    handleCopyToClipboard,
    handleDelete,
    handleStar,
    handlePreview,
    handleTransform,
    handleApplyTransform,
    submitJob,
    handleItemContextMenu,
    handleShowInExplorer,
    handleOcr,
    handleUpdateNote,
    handleToggleMultiSelect,
    handleBatchDelete,
    handleBatchCopy,
    handleHover,
    handleTogglePin,
    handleToggleFollowCursor,
    filterCounts,
    appIcons,
    appFilter,
    setAppFilter,
    appCounts,
    appLastUsed,
    t,
    showError,
    updater,
  } = state;

  const filters = useMemo(
    () =>
      [
        "all",
        "starred",
        "text",
        ...(hasImages ? ["image"] : []),
        ...(hasNotes ? ["notes"] : []),
      ] as const,
    [hasImages, hasNotes],
  );

  // Activate window on search bar click — transitions from no-focus to focused mode.
  // Only wraps SearchBar, not the whole container — item clicks work without activation.
  const handleMouseDown = useCallback(() => {
    activateWindow().catch(() => {});
  }, []);

  if (showSettings) {
    return (
      <I18nContext.Provider value={t}>
        <div className="app-container">
          <Settings
            settings={settings}
            keyStatuses={keyStatuses}
            keysReady={keysReady}
            keysError={keysError}
            onKeysChanged={refreshKeyStatuses}
            onRetryKeys={retryKeyMigration}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
            onShowOnboarding={() => {
              setShowSettings(false);
              setOnboardingVisible(true);
            }}
            updater={updater}
          />
        </div>
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={t}>
      <div className="app-container">
        {!updater.storeBuild && !updater.isolatedBuild && (
          <UpdateBanner
            status={updater.status}
            onDownload={updater.downloadAndInstall}
            onRestart={updater.restartApp}
            onDismiss={updater.dismiss}
          />
        )}
        {settings.windowMode === "pinned" && (
          <div className="drag-handle" data-tauri-drag-region>
            <IconGripHorizontal size={14} />
          </div>
        )}
        {onboardingVisible && (
          <Onboarding
            hotkey={settings.hotkey}
            onDone={() => {
              markOnboardingDone();
              setOnboardingVisible(false);
            }}
          />
        )}
        {previewItem && (
          <PreviewPanel
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onUpdateNote={handleUpdateNote}
            onPaste={handleSelect}
            onDelete={handleDelete}
            onTransform={handleTransform}
            appIcons={appIcons}
          />
        )}
        {transformItem && (
          <TransformMenu
            item={transformItem}
            contentType={transformItem.content_type === "image" ? "image" : "text"}
            onApply={(text: string) => handleApplyTransform(text, transformItem.id)}
            onClose={() => setTransformItem(null)}
            aiPrompts={settings.customAIPrompts ?? []}
            aiConfig={aiConfig}
            submitJob={submitJob}
          />
        )}
        {showShortcuts && (
          <ShortcutsHelp
            onClose={() => setShowShortcuts(false)}
            shortcutPinWindow={settings.shortcutPinWindow}
            shortcutFollowCursor={settings.shortcutFollowCursor}
            windowMode={settings.windowMode}
            pasteMode={settings.pasteMode}
          />
        )}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            item={contextMenu.item}
            onClose={() => setContextMenu(null)}
            onPaste={handleSelect}
            onCopy={handleCopyToClipboard}
            isCopyOnly={settings.windowMode === "pinned" || settings.pasteMode === "copy"}
            onStar={handleStar}
            onDelete={handleDelete}
            onPreview={handlePreview}
            onShowInExplorer={handleShowInExplorer}
            onOcr={handleOcr}
            onTransform={handleTransform}
            quickAccessPrompts={
              settings.customAIPrompts?.filter((p) => p.quickAccess && p.name && p.prompt) ?? []
            }
            aiConfig={aiConfig}
            submitJob={submitJob}
            onError={showError}
          />
        )}
        <div onMouseDown={handleMouseDown}>
          <SearchBar
            ref={searchRef}
            value={query}
            onChange={setQuery}
            searchMode={searchMode}
            onToggleMode={() => setSearchMode((m) => (m === "fuzzy" ? "regex" : "fuzzy"))}
            regexError={regexError}
            resultCount={query ? filtered.length : undefined}
          />
        </div>
        <div
          className="filter-bar"
          role="tablist"
          onKeyDown={(e) => {
            const idx = filters.indexOf(typeFilter as (typeof filters)[number]);
            let next = -1;
            if (e.key === "ArrowRight") next = (idx + 1) % filters.length;
            else if (e.key === "ArrowLeft") next = (idx - 1 + filters.length) % filters.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = filters.length - 1;
            if (next >= 0) {
              e.preventDefault();
              setTypeFilter(filters[next] as typeof typeFilter);
              setSelectedIndex(0);
              const buttons = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
              buttons[next]?.focus();
            }
          }}
        >
          {filters.map((f) => (
            <button
              key={f}
              className={`filter-bar__chip ${typeFilter === f ? "filter-bar__chip--active" : ""}`}
              role="tab"
              aria-selected={typeFilter === f}
              tabIndex={typeFilter === f ? 0 : -1}
              onClick={() => {
                setTypeFilter(f as typeof typeFilter);
                setSelectedIndex(0);
              }}
            >
              {f === "all"
                ? `${t("filter.all")} (${filterCounts.all})`
                : f === "starred"
                  ? `${t("filter.pinned")} (${filterCounts.starred})`
                  : f === "text"
                    ? `${t("filter.text")} (${filterCounts.text})`
                    : f === "image"
                      ? `${t("filter.images")} (${filterCounts.image})`
                      : `${t("filter.notes")} (${filterCounts.notes})`}
            </button>
          ))}
          {Object.keys(appCounts).length > 0 && (
            <AppFilterDropdown
              appFilter={appFilter}
              setAppFilter={setAppFilter}
              appCounts={appCounts}
              appLastUsed={appLastUsed}
              appIcons={appIcons}
            />
          )}
        </div>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {t("aria.listCount", { count: filtered.length })}
        </span>
        {monitorPaused && (
          <div className="paused-banner" role="status" aria-live="polite">
            {t("footer.monitorPaused")}
          </div>
        )}
        {loading ? (
          <div className="empty-state">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={!!query} />
        ) : (
          <ClipboardList
            items={filtered}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            onStar={handleStar}
            onDelete={handleDelete}
            onItemContextMenu={handleItemContextMenu}
            matchMap={matchMap}
            titleMatchMap={titleMatchMap}
            noteMatchMap={noteMatchMap}
            newItemId={newItemId}
            pastingItemId={pastingItemId}
            multiSelected={multiSelected}
            onToggleMultiSelect={handleToggleMultiSelect}
            onHover={handleHover}
            appIcons={appIcons}
          />
        )}
        <FooterBar
          multiSelectedCount={multiSelected.size}
          onBatchCopy={handleBatchCopy}
          onBatchDelete={handleBatchDelete}
          onCancelSelection={() => setMultiSelected(new Set())}
          onShowShortcuts={() => setShowShortcuts(true)}
          monitorPaused={monitorPaused}
          onTogglePause={() => setMonitorPaused((p) => !p)}
          onTogglePin={handleTogglePin}
          windowMode={settings.windowMode ?? "normal"}
          pasteMode={settings.pasteMode ?? "auto"}
          onToggleFollowCursor={handleToggleFollowCursor}
          onShowSettings={() => setShowSettings(true)}
          hasSearchQuery={!!query}
          isPreviewOpen={!!previewItem}
        />
      </div>
    </I18nContext.Provider>
  );
}
