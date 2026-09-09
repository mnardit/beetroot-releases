import { useState, useEffect, useRef } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useTranslation } from "../lib/i18n";
import type {
  AIProvider,
  CloudProvider,
  OpenAIModel,
  GeminiModel,
  AnthropicModel,
  DeepSeekModel,
  CustomAIPrompt,
} from "../lib/settings";
import {
  MAX_QUICK_ACCESS_PROMPTS,
  MAX_CUSTOM_PROMPTS,
  getPromptLabel,
  normalizeLocalEndpoint,
} from "../lib/settings";
import { testLocalEndpoint, listLocalModels } from "../lib/tauri";

import { CloudKeyEditor } from "./CloudKeyEditor";

export interface KeySettingsProps {
  keyStatuses: Record<CloudProvider, boolean>;
  keysReady: boolean;
  keysError: boolean;
  onKeysChanged: () => Promise<void>;
  onRetryKeys: () => void;
}

interface SettingsAIProps extends KeySettingsProps {
  aiProvider: AIProvider;
  openaiModel: OpenAIModel;
  geminiModel: GeminiModel;
  anthropicModel: AnthropicModel;
  deepseekModel: DeepSeekModel;
  localEndpoint: string;
  localModel: string;
  customAIPrompts: CustomAIPrompt[];
  onProviderChange: (provider: AIProvider) => void;
  onModelChange: (model: OpenAIModel) => void;
  onGeminiModelChange: (model: GeminiModel) => void;
  onAnthropicModelChange: (model: AnthropicModel) => void;
  onDeepSeekModelChange: (model: DeepSeekModel) => void;
  onLocalEndpointChange: (endpoint: string) => void;
  onLocalModelChange: (model: string) => void;
  onPromptsChange: (prompts: CustomAIPrompt[]) => void;
}

function isBuiltin(id: string): boolean {
  return id.startsWith("builtin-");
}

export function SettingsAI({
  aiProvider,
  keyStatuses,
  keysReady,
  keysError,
  onKeysChanged,
  onRetryKeys,
  openaiModel,
  geminiModel,
  anthropicModel,
  deepseekModel,
  localEndpoint,
  localModel,
  customAIPrompts,
  onProviderChange,
  onModelChange,
  onGeminiModelChange,
  onAnthropicModelChange,
  onDeepSeekModelChange,
  onLocalEndpointChange,
  onLocalModelChange,
  onPromptsChange,
}: SettingsAIProps) {
  const t = useTranslation();
  const mountedRef = useRef(true);
  const localRequestRef = useRef(0);
  const modelRef = useRef(localModel);
  useEffect(() => {
    modelRef.current = localModel;
  }, [localModel]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      timers.forEach(clearTimeout);
    };
  }, []);
  const safeTimeout = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  };
  const [localTestStatus, setLocalTestStatus] = useState<
    "idle" | "testing" | "connected" | "failed"
  >("idle");
  const [localPreset, setLocalPreset] = useState<"lmstudio" | "ollama" | "custom">(() => {
    if (localEndpoint === "http://127.0.0.1:1234") return "lmstudio";
    if (localEndpoint === "http://127.0.0.1:11434") return "ollama";
    return "custom";
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const canonicalEndpoint = normalizeLocalEndpoint(localEndpoint);
  // Auto-fetch Ollama models on mount
  useEffect(() => {
    const generation = ++localRequestRef.current;
    if (localPreset === "ollama" && canonicalEndpoint) {
      listLocalModels(canonicalEndpoint)
        .then((models) => {
          if (mountedRef.current && generation === localRequestRef.current)
            setAvailableModels(models);
        })
        .catch(() => {});
    }
  }, [localPreset, canonicalEndpoint, aiProvider]);

  const builtinPrompts = customAIPrompts.filter((p) => isBuiltin(p.id));
  const userPrompts = customAIPrompts.filter((p) => !isBuiltin(p.id));
  const textQuickCount = customAIPrompts.filter(
    (p) => p.quickAccess && (p.type || "text") === "text",
  ).length;
  const imageQuickCount = customAIPrompts.filter(
    (p) => p.quickAccess && (p.type || "text") === "image",
  ).length;

  async function handleTestLocalConnection() {
    if (!localEndpoint) return;
    const generation = ++localRequestRef.current;
    const current = () => mountedRef.current && generation === localRequestRef.current;
    setLocalTestStatus("testing");
    try {
      const ep = normalizeLocalEndpoint(localEndpoint);
      if (!ep) throw new Error("Invalid local endpoint");
      onLocalEndpointChange(ep);
      const result = await testLocalEndpoint(ep);
      if (!current()) return;
      if (result.ok) {
        setLocalTestStatus("connected");
        safeTimeout(() => {
          if (current()) setLocalTestStatus("idle");
        }, 3000);
        listLocalModels(ep)
          .then((models) => {
            if (!current()) return;
            setAvailableModels(models);
            if (models.length > 0 && !models.includes(modelRef.current)) {
              onLocalModelChange(models[0]);
            }
          })
          .catch(() => {});
      } else {
        setLocalTestStatus("failed");
        safeTimeout(() => {
          if (current()) setLocalTestStatus("idle");
        }, 3000);
      }
    } catch {
      if (!current()) return;
      setLocalTestStatus("failed");
      safeTimeout(() => {
        if (current()) setLocalTestStatus("idle");
      }, 3000);
    }
  }

  function handleAddPrompt() {
    if (customAIPrompts.length >= MAX_CUSTOM_PROMPTS) return;
    onPromptsChange([...customAIPrompts, { id: crypto.randomUUID(), name: "", prompt: "" }]);
  }

  function handleUpdatePrompt(id: string, field: "name" | "prompt" | "type", value: string) {
    onPromptsChange(customAIPrompts.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  function handleToggleQuickAccess(id: string, checked: boolean) {
    onPromptsChange(customAIPrompts.map((p) => (p.id === id ? { ...p, quickAccess: checked } : p)));
  }

  function handleDeletePrompt(id: string) {
    onPromptsChange(customAIPrompts.filter((p) => p.id !== id));
  }

  return (
    <div className="settings__field">
      <label className="settings__label">{t("settings.ai")}</label>

      {/* Provider selector */}
      <div className="settings__options" role="radiogroup" aria-label={t("settings.aiProvider")}>
        {(["openai", "gemini", "anthropic", "deepseek", "local"] as const).map((p) => {
          const labelKey =
            p === "openai"
              ? "settings.aiProviderOpenai"
              : p === "gemini"
                ? "settings.aiProviderGemini"
                : p === "anthropic"
                  ? "settings.aiProviderAnthropic"
                  : p === "deepseek"
                    ? "settings.aiProviderDeepSeek"
                    : "settings.aiProviderLocal";
          const isSelected = aiProvider === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`settings__chip ${isSelected ? "settings__chip--active" : ""}`}
              onClick={() => {
                localRequestRef.current++;
                setLocalTestStatus("idle");
                onProviderChange(p);
              }}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {aiProvider !== "local" && (
        <CloudKeyEditor
          key={aiProvider}
          provider={aiProvider}
          hasKey={keyStatuses[aiProvider]}
          ready={keysReady}
          migrationError={keysError}
          onKeysChanged={onKeysChanged}
          onRetry={onRetryKeys}
        />
      )}

      {/* OpenAI config */}
      {aiProvider === "openai" && (
        <>
          <div className="settings__ai-description">{t("settings.aiDescription")}</div>
          <div
            className="settings__options settings__section-gap"
            role="radiogroup"
            aria-label={t("aria.aiModelGroup")}
          >
            {(["gpt-5.4-nano", "gpt-5.4-mini"] as const).map((m) => (
              <button
                key={m}
                className={`settings__chip ${openaiModel === m ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={openaiModel === m}
                onClick={() => onModelChange(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="settings__ai-model-desc">
            {openaiModel === "gpt-5.4-nano"
              ? t("settings.aiModelNanoDesc")
              : t("settings.aiModelMiniDesc")}
          </div>
        </>
      )}

      {/* Gemini config */}
      {aiProvider === "gemini" && (
        <>
          <div className="settings__ai-description">{t("settings.geminiDescription")}</div>
          <div
            className="settings__options settings__section-gap"
            role="radiogroup"
            aria-label={t("aria.aiModelGroup")}
          >
            {(["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const).map((m) => (
              <button
                key={m}
                className={`settings__chip ${geminiModel === m ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={geminiModel === m}
                onClick={() => onGeminiModelChange(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="settings__ai-model-desc">
            {geminiModel === "gemini-2.5-flash-lite"
              ? t("settings.geminiModelFlashLiteDesc")
              : t("settings.geminiModelFlashDesc")}
          </div>
        </>
      )}

      {/* Anthropic config */}
      {aiProvider === "anthropic" && (
        <>
          <div className="settings__ai-description">{t("settings.anthropicDescription")}</div>
          <div
            className="settings__options settings__section-gap"
            role="radiogroup"
            aria-label={t("aria.aiModelGroup")}
          >
            {(["claude-haiku-4-5", "claude-sonnet-4-6"] as const).map((m) => (
              <button
                key={m}
                className={`settings__chip ${anthropicModel === m ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={anthropicModel === m}
                onClick={() => onAnthropicModelChange(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="settings__ai-model-desc">
            {anthropicModel === "claude-haiku-4-5"
              ? t("settings.anthropicModelHaikuDesc")
              : t("settings.anthropicModelSonnetDesc")}
          </div>
        </>
      )}

      {/* DeepSeek config */}
      {aiProvider === "deepseek" && (
        <>
          <div className="settings__ai-description">{t("settings.deepseekDescription")}</div>
          <div
            className="settings__options settings__section-gap"
            role="radiogroup"
            aria-label={t("aria.aiModelGroup")}
          >
            {(["deepseek-chat", "deepseek-reasoner"] as const).map((m) => (
              <button
                key={m}
                className={`settings__chip ${deepseekModel === m ? "settings__chip--active" : ""}`}
                role="radio"
                aria-checked={deepseekModel === m}
                onClick={() => onDeepSeekModelChange(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="settings__ai-model-desc">
            {deepseekModel === "deepseek-chat"
              ? t("settings.deepseekModelChatDesc")
              : t("settings.deepseekModelReasonerDesc")}
          </div>
        </>
      )}

      {/* Local LLM config */}
      {aiProvider === "local" && (
        <>
          <div className="settings__ai-description">{t("settings.localEndpointHint")}</div>
          {/* Endpoint presets */}
          <div
            className="settings__options"
            role="radiogroup"
            aria-label={t("settings.aiLocalPreset")}
          >
            {[
              { label: "LM Studio", url: "http://127.0.0.1:1234", key: "lmstudio" as const },
              { label: "Ollama", url: "http://127.0.0.1:11434", key: "ollama" as const },
            ].map((preset) => {
              const isSelected = localPreset === preset.key;
              return (
                <button
                  key={preset.label}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`settings__chip ${isSelected ? "settings__chip--active" : ""}`}
                  onClick={() => {
                    localRequestRef.current++;
                    setLocalPreset(preset.key);
                    onLocalEndpointChange(preset.url);
                    setLocalTestStatus("idle");
                    setAvailableModels([]);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={localPreset === "custom"}
              className={`settings__chip ${localPreset === "custom" ? "settings__chip--active" : ""}`}
              onClick={() => {
                localRequestRef.current++;
                setLocalPreset("custom");
                onLocalEndpointChange("");
                setLocalTestStatus("idle");
                setAvailableModels([]);
              }}
            >
              {t("settings.localCustom")}
            </button>
          </div>
          <div className="settings__ai-key-row">
            <input
              type="text"
              className="settings__ai-input"
              placeholder="http://127.0.0.1:1234"
              aria-label={t("settings.localEndpoint")}
              value={localEndpoint}
              onChange={(e) => {
                localRequestRef.current++;
                setLocalTestStatus("idle");
                onLocalEndpointChange(e.target.value);
              }}
              autoComplete="off"
            />
            <button
              className={`settings__chip ${localTestStatus === "connected" ? "settings__chip--success" : ""} ${localTestStatus === "failed" ? "settings__chip--danger" : ""}`}
              onClick={handleTestLocalConnection}
              disabled={!localEndpoint || localTestStatus === "testing"}
            >
              {localTestStatus === "testing" && t("settings.aiKeyTesting")}
              {localTestStatus === "connected" && (
                <>
                  <IconCheck size={14} /> {t("settings.localConnectedShort")}
                </>
              )}
              {localTestStatus === "failed" && t("settings.localFailed")}
              {localTestStatus === "idle" && t("settings.localTestConnect")}
            </button>
          </div>
          {/* LM Studio: show detected model as text */}
          {localPreset === "lmstudio" && localModel && (
            <div className="settings__ai-model-info settings__section-gap">{localModel}</div>
          )}
          {/* Ollama: dropdown when models available, text input as fallback */}
          {localPreset === "ollama" && availableModels.length > 0 && (
            <div className="settings__section-gap">
              <select
                className="settings__ai-input settings__ai-select"
                aria-label={t("settings.localModel")}
                value={localModel}
                onChange={(e) => onLocalModelChange(e.target.value)}
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          {localPreset === "ollama" && availableModels.length === 0 && (
            <div className="settings__section-gap">
              <input
                type="text"
                className="settings__ai-input"
                placeholder="llama3.2"
                aria-label={t("settings.localModel")}
                value={localModel}
                onChange={(e) => onLocalModelChange(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
          {/* Custom: text input for model */}
          {localPreset === "custom" && (
            <div className="settings__section-gap">
              <input
                type="text"
                className="settings__ai-input"
                placeholder={t("settings.localModelHint")}
                aria-label={t("settings.localModel")}
                value={localModel}
                onChange={(e) => onLocalModelChange(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
        </>
      )}

      {/* Prompts (shared across providers) */}
      <div className="settings__ai-prompts settings__section-gap">
        <label className="settings__label">{t("settings.aiPrompts")}</label>
        <div className="settings__ai-quick-hint">{t("settings.aiQuickAccessHint")}</div>
        {builtinPrompts.length > 0 && (
          <>
            <div className="settings__ai-prompt-row settings__ai-column-header">
              <span className="settings__ai-header-check">
                {t("settings.aiQuickHeader")} ({textQuickCount + imageQuickCount}/
                {MAX_QUICK_ACCESS_PROMPTS})
              </span>
              <span className="settings__ai-flex-fill">{t("settings.aiPromptName")}</span>
            </div>
            {builtinPrompts.map((p) => (
              <div key={p.id} className="settings__ai-prompt-row">
                <input
                  type="checkbox"
                  className="settings__ai-checkbox"
                  checked={p.quickAccess ?? false}
                  disabled={
                    !p.quickAccess &&
                    ((p.type || "text") === "image" ? imageQuickCount : textQuickCount) >=
                      MAX_QUICK_ACCESS_PROMPTS
                  }
                  title={t("settings.aiQuickAccess")}
                  aria-label={t("settings.aiQuickAccess")}
                  onChange={(e) => handleToggleQuickAccess(p.id, e.target.checked)}
                />
                <span className="settings__ai-builtin-name settings__ai-flex-fill">
                  {getPromptLabel(p, t)}
                </span>
                <span
                  className={`settings__ai-type-badge settings__ai-type-badge--${p.type === "image" ? "image" : "text"}`}
                >
                  {p.type === "image"
                    ? t("settings.promptTypeImage")
                    : t("settings.promptTypeText")}
                </span>
              </div>
            ))}
          </>
        )}
        {userPrompts.length > 0 && (
          <div
            className={`settings__ai-prompt-row settings__ai-column-header${builtinPrompts.length > 0 ? " settings__section-gap--sm" : ""}`}
          >
            <span className="settings__ai-spacer" />
            <span className="settings__ai-flex-name">{t("settings.aiPromptName")}</span>
            <span className="settings__ai-flex-fill">{t("settings.aiPromptText")}</span>
            <span className="settings__ai-delete-placeholder" />
          </div>
        )}
        {userPrompts.map((p) => (
          <div key={p.id} className="settings__ai-prompt-row">
            <input
              type="checkbox"
              className="settings__ai-checkbox"
              checked={p.quickAccess ?? false}
              disabled={
                !p.quickAccess &&
                ((p.type || "text") === "image" ? imageQuickCount : textQuickCount) >=
                  MAX_QUICK_ACCESS_PROMPTS
              }
              title={t("settings.aiQuickAccess")}
              aria-label={t("settings.aiQuickAccess")}
              onChange={(e) => handleToggleQuickAccess(p.id, e.target.checked)}
            />
            <input
              className="settings__ai-input settings__ai-input--name"
              placeholder={t("settings.aiPromptName")}
              aria-label={t("settings.aiPromptName")}
              value={p.name}
              maxLength={20}
              onChange={(e) => handleUpdatePrompt(p.id, "name", e.target.value)}
            />
            <select
              className="settings__ai-select settings__ai-select--type"
              value={p.type || "text"}
              aria-label={t("settings.promptType")}
              onChange={(e) => handleUpdatePrompt(p.id, "type", e.target.value)}
            >
              <option value="text">{t("settings.promptTypeText")}</option>
              <option value="image">{t("settings.promptTypeImage")}</option>
            </select>
            <input
              className="settings__ai-input settings__ai-input--prompt"
              placeholder={t("settings.aiPromptText")}
              aria-label={t("settings.aiPromptText")}
              value={p.prompt}
              maxLength={500}
              onChange={(e) => handleUpdatePrompt(p.id, "prompt", e.target.value)}
            />
            <button
              className="settings__ai-delete"
              onClick={() => handleDeletePrompt(p.id)}
              title={t("delete")}
              aria-label={t("delete")}
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
        <button
          className="settings__btn settings__btn--ghost"
          onClick={handleAddPrompt}
          disabled={customAIPrompts.length >= MAX_CUSTOM_PROMPTS}
        >
          {t("settings.aiAddPrompt")}
        </button>
      </div>
    </div>
  );
}
