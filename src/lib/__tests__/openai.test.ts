import { describe, it, expect } from "vitest";
import { getActiveModel, isAIReady, type AIConfig } from "../openai";

const mkConfig = (overrides?: Partial<AIConfig>): AIConfig => ({
  provider: "openai",
  hasKey: { openai: true, gemini: false, anthropic: false, deepseek: false },
  openaiModel: "gpt-5.4-nano",

  geminiModel: "gemini-2.5-flash-lite",

  anthropicModel: "claude-haiku-4-5",

  deepseekModel: "deepseek-chat",
  localEndpoint: "",
  localModel: "",
  ...overrides,
});

describe("getActiveModel", () => {
  it("returns openai model", () => {
    expect(getActiveModel(mkConfig())).toBe("gpt-5.4-nano");
  });
  it("returns gemini model", () => {
    expect(getActiveModel(mkConfig({ provider: "gemini" }))).toBe("gemini-2.5-flash-lite");
  });
  it("preserves an empty local model for backend auto-detection", () => {
    expect(getActiveModel(mkConfig({ provider: "local" }))).toBe("");
  });
});

describe("isAIReady", () => {
  it("true when openai key set", () => {
    expect(isAIReady(mkConfig())).toBe(true);
  });
  it("false when openai key empty", () => {
    expect(
      isAIReady(
        mkConfig({ hasKey: { openai: false, gemini: false, anthropic: false, deepseek: false } }),
      ),
    ).toBe(false);
  });
  it("true when local endpoint set", () => {
    expect(isAIReady(mkConfig({ provider: "local", localEndpoint: "http://localhost:1234" }))).toBe(
      true,
    );
  });
});

describe("provider credential readiness", () => {
  it("uses the selected provider status without exposing its key", () => {
    expect(isAIReady(mkConfig())).toBe(true);
    expect(isAIReady(mkConfig({ provider: "gemini" }))).toBe(false);
    expect(
      isAIReady(
        mkConfig({
          provider: "gemini",
          hasKey: {
            openai: false,
            gemini: true,
            anthropic: false,
            deepseek: false,
          },
        }),
      ),
    ).toBe(true);
    expect(mkConfig()).not.toHaveProperty("openaiKey");
    expect(isAIReady(mkConfig({ provider: "local" }))).toBe(false);
  });
});
