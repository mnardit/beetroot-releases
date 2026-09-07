import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, within } from "@testing-library/react";
import { ContextMenu } from "../ContextMenu";
import { TransformMenu } from "../TransformMenu";
import { defaultSettings, makeEntry } from "../../test/fixtures";
import type { AIConfig } from "../../lib/openai";
import { invoke } from "@tauri-apps/api/core";

describe.each(["context", "transform"] as const)("%s menu local model contract", (menu) => {
  it.each(["", "chosen-model"])("submits model %j unchanged", async (model) => {
    const settings = defaultSettings();
    const aiConfig: AIConfig = {
      provider: "local",
      hasKey: { openai: false, gemini: false, anthropic: false, deepseek: false },
      openaiModel: settings.openaiModel,
      geminiModel: settings.geminiModel,
      anthropicModel: settings.anthropicModel,
      deepseekModel: settings.deepseekModel,
      localEndpoint: "http://127.0.0.1:1234",
      localModel: model,
    };
    const prompt = {
      id: "local-test",
      name: "Summarize",
      prompt: "Summarize this",
      quickAccess: true,
    };
    const item = makeEntry(1, { content: "Local-only fixture" });
    const submitJob = vi.fn().mockResolvedValue(1);
    const props = { item, aiConfig, submitJob, onClose: vi.fn() };
    const { container } = render(
      menu === "context" ? (
        <ContextMenu
          {...props}
          x={0}
          y={0}
          quickAccessPrompts={[prompt]}
          onCopy={vi.fn()}
          onError={vi.fn()}
          onStar={vi.fn()}
          onDelete={vi.fn()}
          onPreview={vi.fn()}
          onShowInExplorer={vi.fn()}
          onTransform={vi.fn()}
        />
      ) : (
        <TransformMenu {...props} contentType="text" onApply={vi.fn()} aiPrompts={[prompt]} />
      ),
    );
    await act(async () => {
      vi.mocked(invoke).mockImplementation(async (command) =>
        command === "db_get_item" ? item : undefined,
      );
      fireEvent.click(
        within(container).getByRole(menu === "context" ? "menuitem" : "button", {
          name: /Summarize/,
        }),
      );
    });
    expect(submitJob).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        provider: "local",
        endpoint: aiConfig.localEndpoint,
        model,
        inputText: item.content,
      }),
    );
    if (menu === "transform") {
      expect(container.querySelector(".transform-menu__provider-badge")?.textContent).toBe(
        model || "local",
      );
    }
  });
});
