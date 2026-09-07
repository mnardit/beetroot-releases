import { memo, useState, useEffect, useRef, useMemo } from "react";
import "../styles/TransformMenu.css";
import { transforms } from "../lib/transforms";
import { getActiveModel, isAIReady } from "../lib/openai";
import type { AIConfig } from "../lib/openai";
import type { ClipboardEntry } from "../types/clipboard";
import type { CustomAIPrompt } from "../lib/settings";
import { BUILTIN_I18N, getPromptLabel } from "../lib/settings";
import { useTranslation } from "../lib/i18n";
import type { TranslationKey } from "../lib/i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { activateWindow, readImageBase64 } from "../lib/tauri";
import type { SubmitJobParams } from "../lib/tauri";
import { getMimeFromPath } from "../lib/image-utils";

interface TransformMenuProps {
  item: ClipboardEntry;
  contentType: "text" | "image";
  onApply: (transformed: string) => void;
  onClose: () => void;
  aiPrompts: CustomAIPrompt[];
  aiConfig: AIConfig;
  submitJob: (params: SubmitJobParams) => Promise<number | null>;
}

const transformKeys: Record<string, TranslationKey> = {
  upper: "transform.upper",
  lower: "transform.lower",
  title: "transform.titleCase",
  trim: "transform.trim",
  nospaces: "transform.nospaces",
  singleline: "transform.singleline",
  sortlines: "transform.sortlines",
  dedup: "transform.dedup",
};

export const TransformMenu = memo(function TransformMenu({
  item,
  contentType,
  onApply,
  onClose,
  aiPrompts,
  aiConfig,
  submitJob,
}: TransformMenuProps) {
  const t = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const trapFocus = useFocusTrap(menuRef);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      trapFocus(e);
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose, trapFocus]);

  const typeFilteredPrompts = useMemo(
    () => aiPrompts.filter((p) => (p.type || "text") === contentType),
    [aiPrompts, contentType],
  );

  const totalItems = (contentType === "text" ? transforms.length : 0) + typeFilteredPrompts.length;
  const showSearch = totalItems >= 6;

  useEffect(() => {
    if (showSearch) {
      searchRef.current?.focus();
    } else {
      menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [showSearch]);

  const aiReady = isAIReady(aiConfig);

  const q = searchQuery.toLowerCase();
  const filteredTransforms = useMemo(
    () =>
      q
        ? transforms.filter((tr) => {
            const label = t(transformKeys[tr.id]) || tr.label;
            return label.toLowerCase().includes(q);
          })
        : transforms,
    [q, t],
  );
  const filteredPrompts = useMemo(
    () =>
      q
        ? typeFilteredPrompts.filter((p) => getPromptLabel(p, t).toLowerCase().includes(q))
        : typeFilteredPrompts,
    [q, typeFilteredPrompts, t],
  );

  // Memoize transform previews — avoids re-running transforms on every render
  const previews = useMemo(
    () => new Map(filteredTransforms.map((tr) => [tr.id, tr.fn(item.content).slice(0, 60)])),
    [filteredTransforms, item.content],
  );

  async function handleAITransform(prompt: CustomAIPrompt) {
    if (!aiReady) return;

    let imageBase64: string | undefined;
    let imageMime: string | undefined;

    if (contentType === "image") {
      if (!item.image_path) return; // no image file
      try {
        imageBase64 = await readImageBase64(item.image_path);
        imageMime = getMimeFromPath(item.image_path);
      } catch {
        onClose();
        return;
      }
    }

    try {
      await submitJob({
        provider: aiConfig.provider,
        model: getActiveModel(aiConfig),
        endpoint: aiConfig.provider === "local" ? aiConfig.localEndpoint : undefined,
        prompt: prompt.prompt,
        promptName: getPromptLabel(prompt, t),
        inputText: contentType === "text" ? item.content : "",
        imageBase64,
        imageMime,
      });
    } finally {
      onClose();
    }
  }

  return (
    <div className="transform-overlay" onClick={onClose}>
      <div
        className="transform-menu"
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("aria.transformMenu")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="transform-menu__header">{t("transform.title")}</div>
        {showSearch && (
          <input
            ref={searchRef}
            type="text"
            className="transform-menu__search"
            placeholder={t("transform.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              // Activate window so keystrokes go to the search input,
              // not the foreground app. Clears NO_FOCUS_ACTIVE → hook stops intercepting.
              activateWindow().catch(() => {});
            }}
          />
        )}
        <div className="transform-menu__list">
          {contentType === "text" &&
            filteredTransforms.map((tr) => (
              <button
                key={tr.id}
                className="transform-menu__item"
                onClick={() => onApply(tr.fn(item.content))}
              >
                <span className="transform-menu__label">{t(transformKeys[tr.id]) || tr.label}</span>
                <span className="transform-menu__preview">{previews.get(tr.id)}</span>
              </button>
            ))}
          {filteredPrompts.length > 0 && (
            <>
              {!q && (
                <div className="transform-menu__divider">
                  <span className="transform-menu__divider-text">
                    {t("transform.aiSection")}
                    {aiReady && (
                      <span className="transform-menu__provider-badge">
                        {getActiveModel(aiConfig) || "local"}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {!aiReady ? (
                <div className="transform-menu__cta">
                  {t(aiConfig.provider === "local" ? "transform.noEndpoint" : "transform.noApiKey")}
                </div>
              ) : (
                filteredPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    className="transform-menu__item transform-menu__item--ai"
                    onClick={() => handleAITransform(prompt)}
                  >
                    <span className="transform-menu__label">{getPromptLabel(prompt, t)}</span>
                    <span className="transform-menu__preview">
                      {BUILTIN_I18N[prompt.id]
                        ? t(BUILTIN_I18N[prompt.id].desc as TranslationKey)
                        : prompt.prompt.slice(0, 60)}
                    </span>
                  </button>
                ))
              )}
            </>
          )}
          {q && filteredTransforms.length === 0 && filteredPrompts.length === 0 && (
            <div className="transform-menu__cta">{t("transform.noResults")}</div>
          )}
        </div>
      </div>
    </div>
  );
});
