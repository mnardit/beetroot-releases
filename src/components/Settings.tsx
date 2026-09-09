import { useState, useRef, useCallback, useEffect } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useRestoreFocus } from "../hooks/useRestoreFocus";
import { IconX, IconGripHorizontal } from "@tabler/icons-react";
import "../styles/Settings.css";
import type {
  AppSettings,
  OverlayPosition,
  OverlayDuration,
  OverlayAnimation,
} from "../lib/settings";
import type { TranslationKey } from "../lib/i18n";
import { useTranslation, LANGUAGES } from "../lib/i18n";
import { applyTheme } from "../lib/themes";
import {
  FONT_SIZE_PX,
  resolveUIFontFamily,
  resolveCodeFontFamily,
  normalizeLocalEndpoint,
} from "../lib/settings";
import {
  replaceHotkey,
  enableAutostart,
  disableAutostart,
  isAutostartEnabled,
  getKeyLabels,
} from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { resetOnboarding } from "../hooks/useOnboarding";
import type { UpdateStatus } from "../hooks/useUpdater";

import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsAI, type KeySettingsProps } from "./SettingsAI";
import { SettingsData } from "./SettingsData";
import { SettingsShortcuts } from "./SettingsShortcuts";

type SettingsTab = "general" | "shortcuts" | "language" | "appearance" | "ai" | "data" | "about";

interface SettingsUpdater {
  status: UpdateStatus;
  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
  storeBuild?: boolean;
  isolatedBuild?: boolean;
}

interface SettingsProps extends KeySettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
  onShowOnboarding?: () => void;
  updater?: SettingsUpdater;
}

const AUTO_DELETE_KEYS: { key: TranslationKey; value: number }[] = [
  { key: "settings.never", value: 0 },
  { key: "settings.1day", value: 1 },
  { key: "settings.7days", value: 7 },
  { key: "settings.30days", value: 30 },
];

const HISTORY_OPTIONS: { label: string; value: number }[] = [
  { label: "100", value: 100 },
  { label: "250", value: 250 },
  { label: "500", value: 500 },
  { label: "1000", value: 1000 },
];

const TABS: { id: SettingsTab; labelKey: TranslationKey }[] = [
  { id: "general", labelKey: "settings.tabGeneral" },
  { id: "shortcuts", labelKey: "settings.tabShortcuts" },
  { id: "language", labelKey: "settings.tabLanguage" },
  { id: "appearance", labelKey: "settings.tabAppearance" },
  { id: "ai", labelKey: "settings.tabAI" },
  { id: "data", labelKey: "settings.tabData" },
  { id: "about", labelKey: "settings.tabAbout" },
];

type DraftSettings = AppSettings;

/** Opens a URL externally via tauri-plugin-opener and prevents in-app navigation. */
function tauriLink(url: string) {
  return {
    href: url,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      openUrl(url);
    },
  };
}

function initDraft(s: AppSettings): DraftSettings {
  return { ...s, customAIPrompts: s.customAIPrompts.map((prompt) => ({ ...prompt })) };
}

export function Settings({
  settings,
  onSave,
  onClose,
  onShowOnboarding,
  updater,
  keyStatuses,
  keysReady,
  keysError,
  onKeysChanged,
  onRetryKeys,
}: SettingsProps) {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [draft, setDraft] = useState<DraftSettings>(() => initDraft(settings));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [rollbackFailed, setRollbackFailed] = useState(false);
  const [error, setError] = useState("");
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const updateDraft = useCallback(
    <K extends keyof DraftSettings>(key: K, value: DraftSettings[K]) => {
      if (savingRef.current) return;
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );
  const settingsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const trapFocus = useFocusTrap(settingsRef);
  useRestoreFocus();

  // Auto-focus close button on mount
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Layout-aware key display labels (e.g. "²" for Backquote on AZERTY).
  // Rust pre-warms a per-HKL cache at startup, so getKeyLabels() is instant.
  // We use both an event listener (immediate) and a 1s poll (fallback) to
  // ensure labels always update — even if the listener breaks on remount.
  const [keyLabels, setKeyLabels] = useState<Record<string, string>>({});
  const keyLabelsJson = useRef("");
  useEffect(() => {
    let active = true;
    const applyLabels = (labels: Record<string, string>) => {
      if (!active) return;
      const json = JSON.stringify(labels);
      if (json !== keyLabelsJson.current) {
        keyLabelsJson.current = json;
        setKeyLabels(labels);
      }
    };
    getKeyLabels()
      .then(applyLabels)
      .catch(() => {});
    // Primary: event from Rust hotkey timer (0-250ms latency)
    let unlisten: (() => void) | null = null;
    listen<Record<string, string>>("keyboard-layout-changed", (event) =>
      applyLabels(event.payload),
    ).then((fn) => {
      if (active) unlisten = fn;
      else fn(); // already unmounted — clean up immediately
    });
    // Fallback: poll cached labels every 1s (instant, reads from cache)
    const interval = setInterval(() => {
      getKeyLabels()
        .then(applyLabels)
        .catch(() => {});
    }, 1000);
    return () => {
      active = false;
      clearInterval(interval);
      unlisten?.();
    };
  }, []);

  const handleCancel = useCallback(() => {
    if (savingRef.current) return;
    // Revert live-previewed visual settings to original values
    applyTheme(settings.theme, settings.accentColor, settings.windowEffect);
    const origPx = FONT_SIZE_PX[settings.fontSize ?? "default"] ?? FONT_SIZE_PX.default;
    document.documentElement.style.setProperty("--font-size", `${origPx}px`);
    document.documentElement.style.setProperty(
      "--font-ui",
      resolveUIFontFamily(settings.uiFont ?? "inter"),
    );
    document.documentElement.style.setProperty(
      "--font-code",
      resolveCodeFontFamily(settings.codeFont ?? "jetbrains-mono"),
    );
    onClose();
  }, [onClose, settings]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
        return;
      }
      trapFocus(e);
    },
    [handleCancel, trapFocus],
  );

  async function handleSave() {
    if (savingRef.current || rollbackFailed) return;
    setSaving(true);
    setError("");

    if (draft.plainTextHotkey && draft.plainTextHotkey === draft.hotkey) {
      setError(t("settings.plainTextHotkeyConflict"));
      setSaving(false);
      return;
    }

    // Check shortcut conflicts (custom + hardcoded)
    const HARDCODED_SHORTCUTS = ["Alt+KeyS", "Alt+KeyT", "Alt+Delete", "Ctrl+KeyC"];
    const allShortcuts = [
      draft.hotkey,
      draft.plainTextHotkey,
      draft.shortcutPinWindow,
      draft.shortcutFollowCursor,
    ].filter(Boolean);
    if (new Set(allShortcuts).size !== allShortcuts.length) {
      setError(t("settings.shortcutConflict"));
      setSaving(false);
      return;
    }
    const localShortcuts = [draft.shortcutPinWindow, draft.shortcutFollowCursor].filter(Boolean);
    if (localShortcuts.some((s) => HARDCODED_SHORTCUTS.includes(s))) {
      setError(t("settings.shortcutConflict"));
      setSaving(false);
      return;
    }

    savingRef.current = true;
    const rollback: (() => Promise<unknown>)[] = [];
    let autostartMessage: string | null = null;
    try {
      const localEndpoint = normalizeLocalEndpoint(draft.localEndpoint);
      if (localEndpoint === null)
        throw new Error(
          "Invalid local endpoint. Use http/https with localhost, 127.0.0.1 or [::1], without credentials.",
        );
      if (draft.hotkey !== settings.hotkey) {
        const previous = await replaceHotkey("main", draft.hotkey);
        rollback.push(() => replaceHotkey("main", previous));
      }
      if (draft.plainTextHotkey !== settings.plainTextHotkey) {
        const previous = await replaceHotkey("plain_text", draft.plainTextHotkey);
        rollback.push(() => replaceHotkey("plain_text", previous));
      }
      if (draft.autostart !== settings.autostart) {
        try {
          const previous = await isAutostartEnabled();
          if (draft.autostart !== previous) {
            if (draft.autostart) {
              await enableAutostart();
            } else {
              await disableAutostart();
            }
            rollback.push(() => (previous ? enableAutostart() : disableAutostart()));
          }
        } catch (e) {
          const code = String(e instanceof Error ? e.message : e);
          let messageKey: TranslationKey | null = null;
          if (code === "disabled_by_user") {
            messageKey = "settings.autostart.disabledByUser";
          } else if (code === "disabled_by_policy") {
            messageKey = "settings.autostart.disabledByPolicy";
          }
          if (messageKey) {
            autostartMessage = t(messageKey);
            setAutostartError(autostartMessage);
            // Keep saved state in sync with reality: user request didn't take.
            setDraft((d) => ({ ...d, autostart: settings.autostart }));
          }
          throw e;
        }
      }
      if ((await onSave({ ...draft, localEndpoint })) === false) {
        throw new Error(t("toast.settingsSaveFailed"));
      }
    } catch (e) {
      if (/rollback failed/i.test(String(e))) setRollbackFailed(true);
      const rollbackErrors: string[] = [];
      for (const undo of rollback.reverse()) {
        try {
          await undo();
        } catch (error) {
          rollbackErrors.push(String(error));
        }
      }
      if (rollbackErrors.length) {
        setRollbackFailed(true);
        setError(
          `${autostartMessage ?? String(e)}. Rollback failed: ${rollbackErrors.join("; ")}. Native settings may differ. Restart the app before saving again.`,
        );
      } else {
        setError(autostartMessage ? "" : String(e));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function renderGeneralTab() {
    return (
      <>
        <div className="settings__field">
          <label className="settings__label">{t("settings.historyLimit")}</label>
          <div className="settings__data-hint">{t("settings.historyLimitHint")}</div>
          <div
            className="settings__options"
            role="radiogroup"
            aria-label={t("aria.historyLimitGroup")}
          >
            {HISTORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings__chip ${draft.maxHistorySize === opt.value ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={draft.maxHistorySize === opt.value}
                onClick={() => updateDraft("maxHistorySize", opt.value)}
              >
                {opt.label}
              </button>
            ))}
            <button
              className={`settings__chip ${draft.maxHistorySize === 0 ? "settings__chip--active" : ""}`}
              role="radio"
              aria-checked={draft.maxHistorySize === 0}
              onClick={() => updateDraft("maxHistorySize", 0)}
            >
              {t("settings.unlimited")}
            </button>
          </div>
        </div>

        <div className="settings__field">
          <label className="settings__label">{t("settings.pasteMode")}</label>
          <div className="settings__data-hint">{t("settings.pasteModeHint")}</div>
          <div
            className="settings__options"
            role="radiogroup"
            aria-label={t("aria.pasteModeGroup")}
          >
            {(
              [
                { value: "auto", key: "settings.pasteAuto" },
                { value: "copy", key: "settings.pasteCopy" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                className={`settings__chip ${draft.pasteMode === opt.value ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={draft.pasteMode === opt.value}
                onClick={() => updateDraft("pasteMode", opt.value)}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings__field">
          <label className="settings__label">{t("settings.pasteFormat")}</label>
          <div className="settings__data-hint">{t("settings.pasteFormatHint")}</div>
          <div
            className="settings__options"
            role="radiogroup"
            aria-label={t("aria.pasteFormatGroup")}
          >
            {(
              [
                { value: "plain", key: "settings.pasteFormatPlain" },
                { value: "original", key: "settings.pasteFormatOriginal" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                className={`settings__chip ${draft.pasteFormat === opt.value ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={draft.pasteFormat === opt.value}
                onClick={() => updateDraft("pasteFormat", opt.value)}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings__field">
          <label className="settings__label">{t("settings.autoDelete")}</label>
          <div className="settings__data-hint">{t("settings.autoDeleteHint")}</div>
          <div
            className="settings__options"
            role="radiogroup"
            aria-label={t("aria.autoDeleteGroup")}
          >
            {AUTO_DELETE_KEYS.map((opt) => (
              <button
                key={opt.value}
                className={`settings__chip ${draft.autoDeleteDays === opt.value ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={draft.autoDeleteDays === opt.value}
                onClick={() => updateDraft("autoDeleteDays", opt.value)}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings__field">
          <label className="settings__label">{t("settings.autostart")}</label>
          <button
            className={`settings__toggle ${draft.autostart ? "settings__toggle--on" : ""}`}
            role="switch"
            aria-checked={draft.autostart}
            disabled={updater?.isolatedBuild}
            onClick={() => {
              setAutostartError(null);
              updateDraft("autostart", !draft.autostart);
            }}
          >
            {draft.autostart ? t("settings.on") : t("settings.off")}
          </button>
          {autostartError && (
            <div className="settings__error" role="alert">
              {autostartError}
            </div>
          )}
        </div>

        {!updater?.storeBuild && !updater?.isolatedBuild && (
          <div className="settings__field">
            <label className="settings__label">{t("settings.autoUpdate")}</label>
            <div className="settings__data-hint">{t("settings.autoUpdateHint")}</div>
            <button
              className={`settings__toggle ${draft.autoUpdateEnabled ? "settings__toggle--on" : ""}`}
              role="switch"
              aria-checked={draft.autoUpdateEnabled}
              onClick={() => updateDraft("autoUpdateEnabled", !draft.autoUpdateEnabled)}
            >
              {draft.autoUpdateEnabled ? t("settings.on") : t("settings.off")}
            </button>
          </div>
        )}

        <div className="settings__field">
          <label className="settings__label">{t("settings.rememberFilter")}</label>
          <div className="settings__data-hint">{t("settings.rememberFilterHint")}</div>
          <button
            className={`settings__toggle ${draft.rememberTypeFilter ? "settings__toggle--on" : ""}`}
            role="switch"
            aria-checked={draft.rememberTypeFilter}
            onClick={() => updateDraft("rememberTypeFilter", !draft.rememberTypeFilter)}
          >
            {draft.rememberTypeFilter ? t("settings.on") : t("settings.off")}
          </button>
        </div>

        <div className="settings__field">
          <label className="settings__label">{t("settings.copiedOverlay")}</label>
          <div className="settings__data-hint">{t("settings.copiedOverlayHint")}</div>
          <button
            className={`settings__toggle ${draft.showCopiedOverlay ? "settings__toggle--on" : ""}`}
            role="switch"
            aria-checked={draft.showCopiedOverlay}
            onClick={() => updateDraft("showCopiedOverlay", !draft.showCopiedOverlay)}
          >
            {draft.showCopiedOverlay ? t("settings.on") : t("settings.off")}
          </button>
          {draft.showCopiedOverlay && (
            <div className="settings__sub-options">
              <label className="settings__inline-field">
                <span className="settings__sub-label">{t("settings.overlayPosition")}</span>
                <select
                  className="settings__select"
                  value={draft.overlayPosition}
                  onChange={(e) =>
                    updateDraft("overlayPosition", e.target.value as OverlayPosition)
                  }
                >
                  <option value="cursor">{t("settings.overlayPosition.cursor")}</option>
                  <option value="top-center">{t("settings.overlayPosition.topCenter")}</option>
                  <option value="bottom-center">
                    {t("settings.overlayPosition.bottomCenter")}
                  </option>
                </select>
              </label>
              <label className="settings__inline-field">
                <span className="settings__sub-label">{t("settings.overlayDuration")}</span>
                <select
                  className="settings__select"
                  value={draft.overlayDuration}
                  onChange={(e) =>
                    updateDraft("overlayDuration", e.target.value as OverlayDuration)
                  }
                >
                  <option value="quick">{t("settings.overlayDuration.quick")}</option>
                  <option value="comfortable">{t("settings.overlayDuration.comfortable")}</option>
                  <option value="visible">{t("settings.overlayDuration.visible")}</option>
                </select>
              </label>
              <label className="settings__inline-field">
                <span className="settings__sub-label">{t("settings.overlayAnimation")}</span>
                <select
                  className="settings__select"
                  value={draft.overlayAnimation}
                  onChange={(e) =>
                    updateDraft("overlayAnimation", e.target.value as OverlayAnimation)
                  }
                >
                  <option value="fade-down">{t("settings.overlayAnimation.fadeDown")}</option>
                  <option value="fade-up">{t("settings.overlayAnimation.fadeUp")}</option>
                  <option value="fade">{t("settings.overlayAnimation.fade")}</option>
                  <option value="scale-down">{t("settings.overlayAnimation.scaleDown")}</option>
                  <option value="pop">{t("settings.overlayAnimation.pop")}</option>
                  <option value="blur">{t("settings.overlayAnimation.blur")}</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="settings__field">
          <label className="settings__label">{t("settings.windowPosition")}</label>
          <div className="settings__data-hint">{t("settings.windowPositionHint")}</div>
          <div
            className="settings__options"
            role="radiogroup"
            aria-label={t("aria.windowPositionGroup")}
          >
            {(
              [
                { value: "center", key: "settings.positionCenter" },
                { value: "top-left", key: "settings.positionTopLeft" },
                { value: "top-right", key: "settings.positionTopRight" },
                { value: "bottom-left", key: "settings.positionBottomLeft" },
                { value: "bottom-right", key: "settings.positionBottomRight" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                className={`settings__chip ${draft.windowPosition === opt.value ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={draft.windowPosition === opt.value}
                onClick={() => updateDraft("windowPosition", opt.value)}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "general":
        return renderGeneralTab();
      case "language":
        return (
          <div className="settings__field">
            <label className="settings__label">{t("settings.language")}</label>
            <div
              className="settings__options"
              role="radiogroup"
              aria-label={t("aria.languageGroup")}
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  className={`settings__chip ${draft.language === lang.id ? "settings__chip--active" : ""}`}
                  role="radio"
                  aria-checked={draft.language === lang.id}
                  onClick={() => updateDraft("language", lang.id)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        );
      case "shortcuts":
        return (
          <SettingsShortcuts
            hotkey={draft.hotkey}
            plainTextHotkey={draft.plainTextHotkey}
            shortcutPinWindow={draft.shortcutPinWindow}
            shortcutFollowCursor={draft.shortcutFollowCursor}
            keyLabels={keyLabels}
            onHotkeyChange={(v) => updateDraft("hotkey", v)}
            onPlainTextHotkeyChange={(v) => updateDraft("plainTextHotkey", v)}
            onShortcutPinWindowChange={(v) => updateDraft("shortcutPinWindow", v)}
            onShortcutFollowCursorChange={(v) => updateDraft("shortcutFollowCursor", v)}
          />
        );
      case "appearance":
        return (
          <SettingsAppearance
            theme={draft.theme}
            accentColor={draft.accentColor}
            fontSize={draft.fontSize}
            uiFont={draft.uiFont}
            codeFont={draft.codeFont}
            windowEffect={draft.windowEffect}
            onThemeChange={(v) => updateDraft("theme", v)}
            onAccentColorChange={(v) => updateDraft("accentColor", v)}
            onFontSizeChange={(v) => updateDraft("fontSize", v)}
            onUIFontChange={(v) => updateDraft("uiFont", v)}
            onCodeFontChange={(v) => updateDraft("codeFont", v)}
            onWindowEffectChange={(v) => updateDraft("windowEffect", v)}
          />
        );
      case "ai":
        return (
          <SettingsAI
            keyStatuses={keyStatuses}
            keysReady={keysReady}
            keysError={keysError}
            onKeysChanged={onKeysChanged}
            onRetryKeys={onRetryKeys}
            aiProvider={draft.aiProvider}
            openaiModel={draft.openaiModel}
            geminiModel={draft.geminiModel}
            localEndpoint={draft.localEndpoint}
            localModel={draft.localModel}
            customAIPrompts={draft.customAIPrompts}
            onProviderChange={(v) => updateDraft("aiProvider", v)}
            onModelChange={(v) => updateDraft("openaiModel", v)}
            onGeminiModelChange={(v) => updateDraft("geminiModel", v)}
            anthropicModel={draft.anthropicModel}
            onAnthropicModelChange={(v) => updateDraft("anthropicModel", v)}
            deepseekModel={draft.deepseekModel}
            onDeepSeekModelChange={(v) => updateDraft("deepseekModel", v)}
            onLocalEndpointChange={(v) => updateDraft("localEndpoint", v)}
            onLocalModelChange={(v) => updateDraft("localModel", v)}
            onPromptsChange={(v) => updateDraft("customAIPrompts", v)}
          />
        );
      case "data":
        return <SettingsData onError={setError} />;
      case "about":
        return (
          <div className="settings__field">
            <div className="settings__about">
              <div className="settings__about-name">Beetroot</div>
              <div className="settings__about-version">
                {t("settings.aboutVersion", { version: __APP_VERSION__ })}
              </div>
              {updater && !updater.storeBuild && !updater.isolatedBuild && (
                <div className="settings__about-update">
                  <button
                    className="settings__chip"
                    onClick={updater.checkForUpdates}
                    disabled={
                      updater.status.state === "checking" || updater.status.state === "downloading"
                    }
                  >
                    {updater.status.state === "checking"
                      ? t("update.checking")
                      : t("settings.checkForUpdates")}
                  </button>
                  {updater.status.state === "upToDate" && (
                    <span className="settings__about-update-status">{t("update.upToDate")}</span>
                  )}
                  {updater.status.state === "available" && (
                    <span className="settings__about-update-status">
                      {t("update.available", { version: updater.status.version })}
                      <button
                        className="settings__chip settings__chip--active"
                        onClick={updater.downloadAndInstall}
                      >
                        {t("update.download")}
                      </button>
                    </span>
                  )}
                  {updater.status.state === "downloading" && (
                    <span className="settings__about-update-status">
                      {t("update.downloading")} {updater.status.progress}%
                    </span>
                  )}
                  {updater.status.state === "ready" && (
                    <span className="settings__about-update-status">
                      {t("update.ready")}
                      <button
                        className="settings__chip settings__chip--active"
                        onClick={updater.restartApp}
                      >
                        {t("update.restart")}
                      </button>
                    </span>
                  )}
                  {updater.status.state === "error" && (
                    <span className="settings__about-update-status settings__about-update-status--error">
                      {t("update.error", { error: updater.status.message })}
                    </span>
                  )}
                </div>
              )}
              <div className="settings__about-links">
                <a
                  className="settings__about-link"
                  {...tauriLink("https://github.com/mnardit/beetroot-releases")}
                >
                  {t("settings.aboutGithub")}
                </a>
                <a
                  className="settings__about-link"
                  {...tauriLink("https://github.com/mnardit/beetroot-releases/issues")}
                >
                  {t("settings.aboutReportIssue")}
                </a>
              </div>
              <div className="settings__about-links">
                <a
                  className="settings__about-link"
                  {...tauriLink(
                    "https://github.com/mnardit/beetroot-releases/blob/main/PRIVACY.md",
                  )}
                >
                  {t("settings.aboutPrivacy")}
                </a>
                <a
                  className="settings__about-link"
                  {...tauriLink("https://github.com/mnardit/beetroot-releases/blob/main/TERMS.md")}
                >
                  {t("settings.aboutTerms")}
                </a>
              </div>
              <div className="settings__about-credits">{t("settings.aboutCredits")}</div>
            </div>
            {onShowOnboarding && (
              <div className="settings__about-welcome">
                <button
                  className="settings__chip"
                  onClick={() => {
                    resetOnboarding();
                    onShowOnboarding();
                  }}
                >
                  {t("settings.showWelcomeGuide")}
                </button>
              </div>
            )}
          </div>
        );
    }
  }

  return (
    <div
      className="settings"
      ref={settingsRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onKeyDown={handleKeyDown}
    >
      {settings.windowMode === "pinned" && (
        <div className="drag-handle" data-tauri-drag-region>
          <IconGripHorizontal size={14} />
        </div>
      )}
      <div className="settings__header">
        <span className="settings__title">{t("settings.title")}</span>
        <button
          className="settings__close"
          ref={closeRef}
          disabled={saving}
          onClick={handleCancel}
          aria-label={t("aria.closeSettings")}
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="settings__layout" inert={saving}>
        <div
          className="settings__sidebar"
          role="tablist"
          aria-label={t("settings.title")}
          aria-orientation="vertical"
          onKeyDown={(e) => {
            const tabIds = TABS.map((t) => t.id);
            const idx = tabIds.indexOf(activeTab);
            let next = -1;
            if (e.key === "ArrowDown") next = (idx + 1) % tabIds.length;
            else if (e.key === "ArrowUp") next = (idx - 1 + tabIds.length) % tabIds.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = tabIds.length - 1;
            if (next >= 0) {
              e.preventDefault();
              setActiveTab(tabIds[next]);
              const tablist = e.currentTarget;
              const buttons = tablist.querySelectorAll<HTMLElement>('[role="tab"]');
              buttons[next]?.focus();
            }
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              className={`settings__sidebar-item ${activeTab === tab.id ? "settings__sidebar-item--active" : ""}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`settings-tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div
          className="settings__content"
          role="tabpanel"
          id={`settings-tabpanel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
        >
          {renderTabContent()}

          {error && (
            <div className="settings__error" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="settings__footer">
        <button className="settings__btn" onClick={handleCancel} disabled={saving}>
          {t("cancel")}
        </button>
        <button
          className="settings__btn settings__btn--primary"
          onClick={handleSave}
          disabled={saving || rollbackFailed}
        >
          {saving ? t("settings.saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
