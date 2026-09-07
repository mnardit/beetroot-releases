import { useState, useRef } from "react";
import type { TranslationKey } from "../lib/i18n";
import { useTranslation } from "../lib/i18n";
import {
  DEFAULT_HOTKEY,
  buildHotkey,
  displayHotkey,
  MODIFIER_MAP,
  applyAltGrStrip,
} from "../lib/hotkey-utils";

interface SettingsShortcutsProps {
  hotkey: string;
  plainTextHotkey: string;
  shortcutPinWindow: string;
  shortcutFollowCursor: string;
  keyLabels: Record<string, string>;
  onHotkeyChange: (v: string) => void;
  onPlainTextHotkeyChange: (v: string) => void;
  onShortcutPinWindowChange: (v: string) => void;
  onShortcutFollowCursorChange: (v: string) => void;
}

interface RecorderConfig {
  labelKey: TranslationKey;
  hintKey?: TranslationKey;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
  /** Whether the shortcut is optional (can be cleared). */
  optional: boolean;
}

export function SettingsShortcuts({
  hotkey,
  plainTextHotkey,
  shortcutPinWindow,
  shortcutFollowCursor,
  keyLabels,
  onHotkeyChange,
  onPlainTextHotkeyChange,
  onShortcutPinWindowChange,
  onShortcutFollowCursorChange,
}: SettingsShortcutsProps) {
  const t = useTranslation();

  const recorders: RecorderConfig[] = [
    {
      labelKey: "settings.shortcutGlobalHotkey",
      value: hotkey,
      defaultValue: DEFAULT_HOTKEY,
      onChange: onHotkeyChange,
      optional: false,
    },
    {
      labelKey: "settings.shortcutPlainText",
      hintKey: "settings.plainTextHotkeyHint",
      value: plainTextHotkey,
      defaultValue: "",
      onChange: onPlainTextHotkeyChange,
      optional: true,
    },
    {
      labelKey: "settings.shortcutPinWindow",
      value: shortcutPinWindow,
      defaultValue: "Alt+KeyP",
      onChange: onShortcutPinWindowChange,
      optional: true,
    },
    {
      labelKey: "settings.shortcutFollowCursor",
      value: shortcutFollowCursor,
      defaultValue: "Alt+KeyF",
      onChange: onShortcutFollowCursorChange,
      optional: true,
    },
  ];

  return (
    <>
      <div className="settings__data-hint">{t("settings.shortcutsGlobalHint")}</div>

      {recorders.slice(0, 2).map((rec) => (
        <ShortcutRecorder key={rec.labelKey} config={rec} keyLabels={keyLabels} />
      ))}

      <div className="settings__separator" />
      <div className="settings__data-hint">{t("settings.shortcutsLocalHint")}</div>

      {recorders.slice(2).map((rec) => (
        <ShortcutRecorder key={rec.labelKey} config={rec} keyLabels={keyLabels} />
      ))}
    </>
  );
}

function ShortcutRecorder({
  config,
  keyLabels,
}: {
  config: RecorderConfig;
  keyLabels: Record<string, string>;
}) {
  const t = useTranslation();
  const [recording, setRecording] = useState(false);
  const [liveModifiers, setLiveModifiers] = useState("");
  const modifiersRef = useRef(new Set<string>());

  const display = config.value
    ? displayHotkey(config.value, keyLabels)
    : t("settings.plainTextHotkeyNone");
  const defaultDisplay = config.defaultValue ? displayHotkey(config.defaultValue, keyLabels) : "";
  const showReset = config.value !== config.defaultValue;

  return (
    <div className="settings__field">
      <label className="settings__label">{t(config.labelKey)}</label>
      {config.hintKey && <div className="settings__data-hint">{t(config.hintKey)}</div>}
      <div className="settings__hotkey-row">
        <button
          className={`settings__hotkey-recorder ${recording ? "settings__hotkey-recorder--recording" : ""}`}
          onClick={() => setRecording(true)}
          onKeyDown={(e) => {
            if (!recording) return;
            e.preventDefault();
            e.stopPropagation();
            const mod = MODIFIER_MAP[e.code];
            if (mod) modifiersRef.current.add(mod);
            modifiersRef.current = applyAltGrStrip(modifiersRef.current, e.code);
            if (["Control", "Alt", "Shift", "Meta", "AltGraph"].includes(e.key)) {
              const mods = [...modifiersRef.current].join("+");
              setLiveModifiers(mods ? `${mods}+...` : "");
              return;
            }
            const combo = buildHotkey(modifiersRef.current, e.code);
            if (combo) {
              config.onChange(combo);
              setRecording(false);
              setLiveModifiers("");
              modifiersRef.current.clear();
            }
          }}
          onKeyUp={(e) => {
            const mod = MODIFIER_MAP[e.code];
            if (mod) modifiersRef.current.delete(mod);
            const mods = [...modifiersRef.current].join("+");
            setLiveModifiers(mods ? `${mods}+...` : "");
          }}
          onBlur={() => {
            setRecording(false);
            setLiveModifiers("");
            modifiersRef.current.clear();
          }}
          aria-label={t(config.labelKey)}
        >
          {recording ? liveModifiers || t("settings.hotkeyRecording") : display}
        </button>
        {showReset && (
          <button
            className="settings__chip"
            onClick={() => {
              config.onChange(config.defaultValue);
              setRecording(false);
            }}
          >
            {defaultDisplay
              ? `${t("settings.hotkeyReset")} (${defaultDisplay})`
              : t("settings.hotkeyReset")}
          </button>
        )}
        {config.optional && config.value && (
          <button
            className="settings__chip"
            onClick={() => {
              config.onChange("");
              setRecording(false);
            }}
          >
            {t("settings.shortcutClear")}
          </button>
        )}
      </div>
    </div>
  );
}
