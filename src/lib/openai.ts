import type {
  AIProvider,
  CloudProvider,
  OpenAIModel,
  GeminiModel,
  AnthropicModel,
  DeepSeekModel,
} from "./settings";

export const MAX_AI_INPUT_LENGTH = 50_000;

export interface AIConfig {
  provider: AIProvider;
  hasKey: Record<CloudProvider, boolean>;
  openaiModel: OpenAIModel;
  geminiModel: GeminiModel;
  anthropicModel: AnthropicModel;
  deepseekModel: DeepSeekModel;
  localEndpoint: string;
  localModel: string;
}

/** Returns the request model; an empty local model asks the backend to auto-detect it. */
export function getActiveModel(config: AIConfig): string {
  if (config.provider === "openai") return config.openaiModel;
  if (config.provider === "gemini") return config.geminiModel;
  if (config.provider === "anthropic") return config.anthropicModel;
  if (config.provider === "deepseek") return config.deepseekModel;
  return config.localModel;
}

/** Readiness uses presence flags only; saved secrets never return to the renderer. */
export function isAIReady(config: AIConfig): boolean {
  return config.provider === "local" ? !!config.localEndpoint : config.hasKey[config.provider];
}
