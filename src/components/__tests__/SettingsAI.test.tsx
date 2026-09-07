import { invoke } from "@tauri-apps/api/core";
import { en } from "../../lib/i18n";
import {
  MAX_CUSTOM_PROMPTS,
  MAX_QUICK_ACCESS_PROMPTS,
  type CustomAIPrompt,
} from "../../lib/settings";
import { keySettingsProps } from "../../test/fixtures";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, within, act } from "@testing-library/react";
import { SettingsAI } from "../SettingsAI";

const noop = () => {};

const baseProps = {
  ...keySettingsProps(),
  aiProvider: "openai" as const,
  openaiModel: "gpt-5.4-nano" as const,
  geminiModel: "gemini-2.5-flash-lite" as const,
  anthropicModel: "claude-haiku-4-5" as const,
  deepseekModel: "deepseek-chat" as const,
  localEndpoint: "http://127.0.0.1:1234",
  localModel: "",
  customAIPrompts: [],
  onProviderChange: noop,
  onModelChange: noop,
  onGeminiModelChange: noop,
  onAnthropicModelChange: noop,
  onDeepSeekModelChange: noop,
  onLocalEndpointChange: noop,
  onLocalModelChange: noop,
  onPromptsChange: noop,
};

describe("SettingsAI a11y", () => {
  it("provider chips render as a radiogroup with 5 radios and aria-checked", () => {
    const { getAllByRole } = render(<SettingsAI {...baseProps} />);
    const groups = getAllByRole("radiogroup");
    expect(groups.length).toBeGreaterThanOrEqual(1);

    // Provider radiogroup is the one with 5 radio children
    const providerGroup = groups.find((g) => g.querySelectorAll('[role="radio"]').length === 5);
    expect(providerGroup).toBeDefined();

    const radios = providerGroup!.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(5);

    // The selected radio (default openai) has aria-checked="true"
    const selected = providerGroup!.querySelector('[aria-checked="true"]');
    expect(selected).not.toBeNull();
    expect(selected!.textContent?.toLowerCase()).toMatch(/openai|chatgpt|gpt/);
  });
});

describe("SettingsAI behavior", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["openai", "openaiModel", "onModelChange", "gpt-5.4-nano", "gpt-5.4-mini"],
    ["gemini", "geminiModel", "onGeminiModelChange", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
    [
      "anthropic",
      "anthropicModel",
      "onAnthropicModelChange",
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
    ],
    ["deepseek", "deepseekModel", "onDeepSeekModelChange", "deepseek-chat", "deepseek-reasoner"],
  ] as const)(
    "selects models for %s without touching credentials",
    (provider, field, callback, first, second) => {
      const onChange = vi.fn();
      const props = { ...baseProps, aiProvider: provider, [callback]: onChange };
      const { container, rerender } = render(<SettingsAI {...props} />);
      expect(within(container).getByRole("radio", { name: first })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      fireEvent.click(within(container).getByRole("radio", { name: second }));
      expect(onChange).toHaveBeenCalledWith(second);
      rerender(<SettingsAI {...props} {...{ [field]: second }} />);
      expect(within(container).getByRole("radio", { name: second })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(vi.mocked(invoke)).not.toHaveBeenCalled();
    },
  );

  it("forwards all provider choices and clears an unsaved key on provider change", () => {
    const onProviderChange = vi.fn();
    const { container, rerender } = render(
      <SettingsAI {...baseProps} onProviderChange={onProviderChange} />,
    );
    fireEvent.change(container.querySelector('input[type="password"]')!, {
      target: { value: "unsaved-fixture" },
    });
    const group = within(container).getByRole("radiogroup", { name: en["settings.aiProvider"] });
    for (const radio of within(group).getAllByRole("radio")) fireEvent.click(radio);
    expect(onProviderChange.mock.calls.map(([provider]) => provider)).toEqual([
      "openai",
      "gemini",
      "anthropic",
      "deepseek",
      "local",
    ]);
    rerender(<SettingsAI {...baseProps} aiProvider="gemini" />);
    expect(container.querySelector('input[type="password"]')).toHaveValue("");
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it("edits, toggles, adds and deletes custom prompts without mutating the caller's draft", () => {
    const prompts: CustomAIPrompt[] = [
      { id: "builtin-grammar", name: "Fix Grammar", prompt: "Fix" },
      { id: "user-1", name: "One", prompt: "Original", type: "text" },
      { id: "user-2", name: "Two", prompt: "Keep", type: "image", quickAccess: true },
    ];
    const onPromptsChange = vi.fn();
    const { container } = render(
      <SettingsAI {...baseProps} customAIPrompts={prompts} onPromptsChange={onPromptsChange} />,
    );
    const rows = container.querySelectorAll(".settings__ai-prompt-row");
    const userRow = Array.from(rows).find((r) =>
      r.querySelector('input[value="One"]'),
    )! as HTMLElement;
    fireEvent.change(within(userRow).getByLabelText(en["settings.aiPromptName"]), {
      target: { value: "Renamed" },
    });
    expect(onPromptsChange).toHaveBeenLastCalledWith([
      prompts[0],
      { ...prompts[1], name: "Renamed" },
      prompts[2],
    ]);
    fireEvent.change(within(userRow).getByLabelText(en["settings.aiPromptText"]), {
      target: { value: "New instruction" },
    });
    expect(onPromptsChange.mock.lastCall![0][1].prompt).toBe("New instruction");
    fireEvent.change(within(userRow).getByLabelText(en["settings.promptType"]), {
      target: { value: "image" },
    });
    expect(onPromptsChange.mock.lastCall![0][1].type).toBe("image");
    fireEvent.click(within(userRow).getByRole("checkbox"));
    expect(onPromptsChange.mock.lastCall![0][1].quickAccess).toBe(true);
    fireEvent.click(within(container).getAllByRole("checkbox")[0]);
    expect(onPromptsChange.mock.lastCall![0][0].quickAccess).toBe(true);
    fireEvent.click(within(userRow).getByRole("button", { name: en.delete }));
    expect(onPromptsChange).toHaveBeenLastCalledWith([prompts[0], prompts[2]]);
    fireEvent.click(within(container).getByRole("button", { name: en["settings.aiAddPrompt"] }));
    expect(onPromptsChange.mock.lastCall![0]).toEqual([
      ...prompts,
      { id: expect.any(String), name: "", prompt: "" },
    ]);
    expect(prompts[1]).toEqual({ id: "user-1", name: "One", prompt: "Original", type: "text" });
  });

  it("enforces the prompt cap and separate text/image quick-access caps", () => {
    const prompts: CustomAIPrompt[] = Array.from({ length: MAX_CUSTOM_PROMPTS }, (_, i) => ({
      id: i < 6 ? "builtin-" + i : "user-" + i,
      name: "Prompt " + i,
      prompt: "Text",
      quickAccess: i < MAX_QUICK_ACCESS_PROMPTS,
      type: i === 6 ? "image" : "text",
    }));
    const onPromptsChange = vi.fn();
    const { container } = render(
      <SettingsAI {...baseProps} customAIPrompts={prompts} onPromptsChange={onPromptsChange} />,
    );
    const checks = within(container).getAllByRole("checkbox");
    expect(checks[0]).not.toBeDisabled();
    expect(checks[5]).toBeDisabled();
    expect(checks[6]).not.toBeDisabled();
    const add = within(container).getByRole("button", { name: en["settings.aiAddPrompt"] });
    expect(add).toBeDisabled();
    fireEvent.click(add);
    expect(onPromptsChange).not.toHaveBeenCalled();
  });

  it("switches local presets and forwards manual endpoint/model edits", () => {
    const onLocalEndpointChange = vi.fn(),
      onLocalModelChange = vi.fn();
    const { container, rerender } = render(
      <SettingsAI
        {...baseProps}
        aiProvider="local"
        onLocalEndpointChange={onLocalEndpointChange}
        onLocalModelChange={onLocalModelChange}
      />,
    );
    fireEvent.click(within(container).getByRole("radio", { name: "Ollama" }));
    expect(onLocalEndpointChange).toHaveBeenLastCalledWith("http://127.0.0.1:11434");
    fireEvent.click(within(container).getByRole("radio", { name: "LM Studio" }));
    expect(onLocalEndpointChange).toHaveBeenLastCalledWith("http://127.0.0.1:1234");
    fireEvent.click(within(container).getByRole("radio", { name: en["settings.localCustom"] }));
    expect(onLocalEndpointChange).toHaveBeenLastCalledWith("");
    fireEvent.change(within(container).getByLabelText(en["settings.localEndpoint"]), {
      target: { value: "localhost:4321" },
    });
    expect(onLocalEndpointChange).toHaveBeenLastCalledWith("localhost:4321");
    fireEvent.change(within(container).getByLabelText(en["settings.localModel"]), {
      target: { value: "local-fixture" },
    });
    expect(onLocalModelChange).toHaveBeenLastCalledWith("local-fixture");
    rerender(<SettingsAI {...baseProps} aiProvider="local" localEndpoint="" />);
    expect(
      within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
    ).toBeDisabled();
  });

  it("tests a local endpoint, normalizes its URL and applies the detected model", async () => {
    vi.useFakeTimers();
    vi.mocked(invoke).mockImplementation(async (command) =>
      command === "list_local_models" ? ["detected-model"] : { ok: true, model: "detected-model" },
    );
    const onLocalModelChange = vi.fn();
    const { container } = render(
      <SettingsAI
        {...baseProps}
        aiProvider="local"
        localEndpoint="localhost:1234"
        onLocalModelChange={onLocalModelChange}
      />,
    );
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
      );
    });
    expect(invoke).toHaveBeenCalledWith("test_local_endpoint", {
      endpoint: "http://localhost:1234",
    });
    expect(onLocalModelChange).toHaveBeenCalledWith("detected-model");
    expect(container.textContent).toContain(en["settings.localConnectedShort"]);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
    ).not.toBeDisabled();
  });

  it.each(["rejected", "not-ok"])(
    "shows a failed local connection for %s responses",
    async (mode) => {
      if (mode === "rejected") vi.mocked(invoke).mockRejectedValue("offline");
      else vi.mocked(invoke).mockResolvedValue({ ok: false });
      const { container } = render(<SettingsAI {...baseProps} aiProvider="local" />);
      await act(async () => {
        fireEvent.click(
          within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
        );
      });
      expect(container.textContent).toContain(en["settings.localFailed"]);
    },
  );

  it.each(["test", "list"] as const)(
    "ignores a pending %s response after unmount",
    async (stage) => {
      let resolve!: (value: { ok: boolean; model: string } | string[]) => void;
      const pending = new Promise<{ ok: boolean; model: string } | string[]>((r) => {
        resolve = r;
      });
      let lists = 0;
      vi.mocked(invoke).mockImplementation(async (command) => {
        if (command === "list_local_models") return ++lists === 1 ? [] : pending;
        if (command === "test_local_endpoint")
          return stage === "test" ? pending : { ok: true, model: "first-model" };
      });
      const onLocalModelChange = vi.fn();
      const { container, unmount } = render(
        <SettingsAI
          {...baseProps}
          aiProvider="local"
          localEndpoint="http://127.0.0.1:11434"
          localModel="chosen-model"
          onLocalModelChange={onLocalModelChange}
        />,
      );
      await act(async () => {
        fireEvent.click(
          within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
        );
      });
      unmount();
      await act(async () => {
        resolve(stage === "test" ? { ok: true, model: "first-model" } : ["first-model"]);
      });
      expect(onLocalModelChange).not.toHaveBeenCalled();
    },
  );

  it("ignores an older model list after a repeated Test", async () => {
    let resolve!: (models: string[]) => void;
    const oldList = new Promise<string[]>((r) => {
      resolve = r;
    });
    let lists = 0;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "list_local_models")
        return ++lists === 1 ? [] : lists === 2 ? oldList : ["new-model"];
      return { ok: true, model: "first-model" };
    });
    const onLocalModelChange = vi.fn();
    const { container } = render(
      <SettingsAI
        {...baseProps}
        aiProvider="local"
        localEndpoint="http://127.0.0.1:11434"
        localModel="missing"
        onLocalModelChange={onLocalModelChange}
      />,
    );
    const test = container.querySelector(".settings__ai-key-row button")!;
    await act(async () => {
      fireEvent.click(test);
    });
    await act(async () => {
      fireEvent.click(test);
    });
    await act(async () => {
      resolve(["old-model"]);
    });
    expect(onLocalModelChange).toHaveBeenCalledExactlyOnceWith("new-model");
    expect(
      within(container)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["new-model"]);
  });

  it("lists Ollama models and syncs a stale selection after connection", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) =>
      cmd === "list_local_models" ? ["model-a", "model-b"] : { ok: true },
    );
    const onLocalModelChange = vi.fn();
    const { container } = render(
      <SettingsAI
        {...baseProps}
        aiProvider="local"
        localEndpoint="http://127.0.0.1:11434"
        localModel="stale"
        onLocalModelChange={onLocalModelChange}
      />,
    );
    await act(async () => {});
    const select = within(container).getByRole("combobox", { name: en["settings.localModel"] });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["model-a", "model-b"]);
    fireEvent.change(select, { target: { value: "model-b" } });
    expect(onLocalModelChange).toHaveBeenLastCalledWith("model-b");
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
      );
    });
    expect(onLocalModelChange).toHaveBeenLastCalledWith("model-a");
  });
});
