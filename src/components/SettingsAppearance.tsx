import { useEffect, useState } from "react";
import { useTranslation } from "../lib/i18n";
import type { TranslationKey } from "../lib/i18n";
import { themes, applyTheme, resolveThemeId, getTheme } from "../lib/themes";
import type { FontSize, WindowEffect } from "../lib/settings";
import {
  FONT_SIZE_PX,
  UI_FONTS,
  CODE_FONTS,
  resolveUIFontFamily,
  resolveCodeFontFamily,
} from "../lib/settings";
import { getOsBuild } from "../lib/tauri";

interface SettingsAppearanceProps {
  theme: string;
  accentColor: string;
  fontSize: FontSize;
  uiFont: string;
  codeFont: string;
  windowEffect: WindowEffect;
  onThemeChange: (theme: string) => void;
  onAccentColorChange: (color: string) => void;
  onFontSizeChange: (size: FontSize) => void;
  onUIFontChange: (font: string) => void;
  onCodeFontChange: (font: string) => void;
  onWindowEffectChange: (effect: WindowEffect) => void;
}

export function SettingsAppearance({
  theme,
  accentColor,
  fontSize,
  uiFont,
  codeFont,
  windowEffect,
  onThemeChange,
  onAccentColorChange,
  onFontSizeChange,
  onUIFontChange,
  onCodeFontChange,
  onWindowEffectChange,
}: SettingsAppearanceProps) {
  const t = useTranslation();
  const baseTheme = getTheme(resolveThemeId(theme));
  const currentAccent = accentColor || baseTheme.colors["--accent-main"];

  const [osBuild, setOsBuild] = useState(99999); // assume Win11 until known
  useEffect(() => {
    getOsBuild()
      .then(setOsBuild)
      .catch(() => {});
  }, []);
  const isWin11 = osBuild >= 22000;
  const effectOptions: { value: WindowEffect; key: TranslationKey }[] = [
    ...(isWin11 ? [{ value: "mica" as const, key: "settings.effectMica" as const }] : []),
    { value: "acrylic", key: "settings.effectAcrylic" },
    { value: "solid", key: "settings.effectSolid" },
  ];

  return (
    <div className="settings__field">
      <label className="settings__label">{t("settings.theme")}</label>
      <div className="settings__options" role="radiogroup" aria-label={t("aria.themeGroup")}>
        <button
          className={`settings__chip ${theme === "auto" ? "settings__chip--active" : ""}`}
          role="radio"
          aria-checked={theme === "auto"}
          onClick={() => {
            onThemeChange("auto");
            applyTheme("auto", accentColor, windowEffect);
          }}
        >
          <span
            className="settings__theme-dot"
            style={{ background: getTheme(resolveThemeId("auto")).colors["--accent-main"] }}
          />
          {t("settings.system")}
        </button>
        {themes.map((th) => (
          <button
            key={th.id}
            className={`settings__chip ${theme === th.id ? "settings__chip--active" : ""}`}
            role="radio"
            aria-checked={theme === th.id}
            onClick={() => {
              onThemeChange(th.id);
              applyTheme(th.id, accentColor, windowEffect);
            }}
          >
            <span
              className="settings__theme-dot"
              style={{ background: th.colors["--accent-main"] }}
            />
            {th.name}
          </button>
        ))}
      </div>

      <label className="settings__label settings__section-gap">{t("settings.accentColor")}</label>
      <div className="settings__accent-row">
        <input
          type="color"
          className="settings__color-picker"
          aria-label={t("settings.accentColor")}
          value={currentAccent}
          onChange={(e) => {
            onAccentColorChange(e.target.value);
            applyTheme(theme, e.target.value, windowEffect);
          }}
        />
        {accentColor && (
          <button
            className="settings__chip"
            onClick={() => {
              onAccentColorChange("");
              applyTheme(theme, undefined, windowEffect);
            }}
          >
            {t("settings.resetAccent")}
          </button>
        )}
      </div>

      <label className="settings__label settings__section-gap">{t("settings.fontSize")}</label>
      <div className="settings__options" role="radiogroup" aria-label={t("aria.fontSizeGroup")}>
        {(
          [
            { value: "compact", key: "settings.fontCompact" },
            { value: "small", key: "settings.fontSmall" },
            { value: "default", key: "settings.fontDefault" },
            { value: "large", key: "settings.fontLarge" },
            { value: "larger", key: "settings.fontLarger" },
            { value: "largest", key: "settings.fontLargest" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            className={`settings__chip ${fontSize === opt.value ? "settings__chip--active" : ""}`}
            role="radio"
            aria-checked={fontSize === opt.value}
            onClick={() => {
              onFontSizeChange(opt.value);
              document.documentElement.style.setProperty(
                "--font-size",
                `${FONT_SIZE_PX[opt.value]}px`,
              );
            }}
          >
            {t(opt.key)} ({FONT_SIZE_PX[opt.value]}px)
          </button>
        ))}
      </div>

      <label className="settings__label settings__section-gap">{t("settings.uiFont")}</label>
      <div className="settings__data-hint">{t("settings.uiFontHint")}</div>
      <div className="settings__options" role="radiogroup" aria-label={t("settings.uiFont")}>
        {UI_FONTS.map((font) => (
          <button
            key={font.value}
            className={`settings__chip ${uiFont === font.value ? "settings__chip--active" : ""}`}
            role="radio"
            aria-checked={uiFont === font.value}
            style={{ fontFamily: font.family }}
            onClick={() => {
              onUIFontChange(font.value);
              document.documentElement.style.setProperty(
                "--font-ui",
                resolveUIFontFamily(font.value),
              );
            }}
          >
            {font.label}
          </button>
        ))}
      </div>

      <label className="settings__label settings__section-gap">{t("settings.codeFont")}</label>
      <div className="settings__data-hint">{t("settings.codeFontHint")}</div>
      <div className="settings__options" role="radiogroup" aria-label={t("settings.codeFont")}>
        {CODE_FONTS.map((font) => (
          <button
            key={font.value}
            className={`settings__chip ${codeFont === font.value ? "settings__chip--active" : ""}`}
            role="radio"
            aria-checked={codeFont === font.value}
            style={{ fontFamily: font.family }}
            onClick={() => {
              onCodeFontChange(font.value);
              document.documentElement.style.setProperty(
                "--font-code",
                resolveCodeFontFamily(font.value),
              );
            }}
          >
            {font.label}
          </button>
        ))}
      </div>

      <label className="settings__label settings__section-gap">{t("settings.windowEffect")}</label>
      <div className="settings__data-hint">{t("settings.windowEffectHint")}</div>
      <div className="settings__options" role="radiogroup" aria-label={t("settings.windowEffect")}>
        {effectOptions.map((opt) => (
          <button
            key={opt.value}
            className={`settings__chip ${windowEffect === opt.value ? "settings__chip--active" : ""}`}
            role="radio"
            aria-checked={windowEffect === opt.value}
            onClick={() => {
              onWindowEffectChange(opt.value);
              applyTheme(theme, accentColor, opt.value);
            }}
          >
            {t(opt.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
