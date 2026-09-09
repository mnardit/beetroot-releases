import { invoke } from "@tauri-apps/api/core";
import { en } from "../../lib/i18n";
import { keySettingsProps } from "../../test/fixtures";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, within, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "../Settings";
import type { AppSettings } from "../../lib/settings";

const defaultSettings: AppSettings = {
  maxHistorySize: 500,
  hotkey: "Ctrl+Backquote",
  plainTextHotkey: "",
  autostart: false,
  autoUpdateEnabled: true,
  theme: "beetroot-dark",
  autoDeleteDays: 0,
  language: "en",
  pasteMode: "auto",
  pasteFormat: "plain",
  accentColor: "",
  fontSize: "default",
  uiFont: "system",
  codeFont: "consolas",
  windowEffect: "mica",
  aiProvider: "openai",

  openaiModel: "gpt-5.4-nano",

  geminiModel: "gemini-2.5-flash-lite",

  anthropicModel: "claude-haiku-4-5",

  deepseekModel: "deepseek-chat",
  localEndpoint: "http://127.0.0.1:1234",
  localModel: "",
  customAIPrompts: [],
  alwaysOnTop: false,
  windowMode: "normal" as const,
  windowPosition: "center" as const,
  shortcutPinWindow: "Alt+KeyP",
  shortcutFollowCursor: "Alt+KeyF",
  rememberTypeFilter: false,
  showCopiedOverlay: true,
  overlayPosition: "cursor" as const,
  overlayDuration: "comfortable" as const,
  overlayAnimation: "fade-down" as const,
};

function renderSettings(overrides: Partial<AppSettings> = {}) {
  const props = {
    settings: { ...defaultSettings, ...overrides },
    onSave: vi.fn(),
    onClose: vi.fn(),
  };
  const result = render(<Settings {...keySettingsProps()} {...props} />);
  return { ...result, props };
}

describe("Settings", () => {
  it("renders Settings title", () => {
    const { container } = renderSettings();
    expect(within(container).getByText("Settings")).toBeInTheDocument();
  });

  it("renders sidebar with seven tabs", () => {
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    expect(tabs.length).toBe(7);
    const labels = Array.from(tabs).map((t) => t.textContent?.trim());
    expect(labels).toContain("General");
    expect(labels).toContain("Shortcuts");
    expect(labels).toContain("Language");
    expect(labels).toContain("Appearance");
    expect(labels).toContain("AI");
    expect(labels).toContain("Data");
    expect(labels).toContain("About");
  });

  it("shows General tab as active by default", () => {
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    const generalTab = Array.from(tabs).find((t) => t.textContent?.trim() === "General");
    expect(generalTab).toHaveAttribute("aria-selected", "true");
  });

  it("renders tabpanel for content", () => {
    const { container } = renderSettings();
    expect(container.querySelector("[role='tabpanel']")).toBeInTheDocument();
  });

  it("renders all theme buttons on Appearance tab", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    const appearanceTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Appearance")!;
    await user.click(appearanceTab);

    const chips = container.querySelectorAll(".settings__chip");
    const labels = Array.from(chips).map((c) => c.textContent?.trim());
    expect(labels.some((l) => l?.includes("Tokyo Night Storm"))).toBe(true);
    expect(labels.some((l) => l?.includes("Gruvbox Material Hard"))).toBe(true);
    expect(labels.some((l) => l?.includes("GitHub Light Pro"))).toBe(true);
    expect(labels.some((l) => l?.includes("Nord Snow"))).toBe(true);
  });

  it("renders history limit options on General tab", () => {
    const { container } = renderSettings();
    const buttons = container.querySelectorAll(".settings__chip");
    const labels = Array.from(buttons).map((b) => b.textContent?.trim());
    expect(labels).toContain("100");
    expect(labels).toContain("250");
    expect(labels).toContain("1000");
    expect(labels).toContain("Unlimited");
  });

  it("renders hotkey recorder on Shortcuts tab", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    const shortcutsTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Shortcuts")!;
    await user.click(shortcutsTab);
    const recorder = container.querySelector(".settings__hotkey-recorder");
    expect(recorder).toBeInTheDocument();
    expect(recorder?.textContent).toBe("Ctrl+`");
  });

  it("shows recording state when hotkey recorder is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    const shortcutsTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Shortcuts")!;
    await user.click(shortcutsTab);
    const recorder = container.querySelector(".settings__hotkey-recorder")!;
    await user.click(recorder);
    expect(recorder.textContent).toBe("Press a key combination...");
    expect(recorder).toHaveClass("settings__hotkey-recorder--recording");
  });

  it("shows reset button when hotkey differs from default", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings({ hotkey: "Alt+V" });
    const tabs = container.querySelectorAll("[role='tab']");
    const shortcutsTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Shortcuts")!;
    await user.click(shortcutsTab);
    const recorder = container.querySelector(".settings__hotkey-recorder");
    expect(recorder?.textContent).toBe("Alt+V");
    expect(within(container).getByText(/Reset/)).toBeInTheDocument();
  });

  it("does not show reset button when hotkey is default", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings({ hotkey: "Ctrl+Backquote" });
    const tabs = container.querySelectorAll("[role='tab']");
    const shortcutsTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Shortcuts")!;
    await user.click(shortcutsTab);
    // First hotkey row is for global hotkey — check no reset chip
    const hotkeyRows = container.querySelectorAll(".settings__hotkey-row");
    const firstResetChip = hotkeyRows[0]?.querySelector(".settings__chip");
    expect(firstResetChip).toBeNull();
  });

  it("shows autostart toggle as OFF", () => {
    const { container } = renderSettings();
    const toggle = container.querySelector(".settings__toggle");
    expect(toggle?.textContent).toBe("OFF");
  });

  it("shows ON when autostart is enabled", () => {
    const { container } = renderSettings({ autostart: true });
    const toggle = container.querySelector(".settings__toggle");
    expect(toggle?.textContent).toBe("ON");
  });

  it("calls onClose when Cancel clicked", async () => {
    const user = userEvent.setup();
    const { container, props } = renderSettings();
    const footer = container.querySelector(".settings__footer") as HTMLElement;
    await user.click(within(footer).getByText("Cancel"));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("toggles autostart on click", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const toggle = container.querySelector(".settings__toggle")!;
    expect(toggle.textContent).toBe("OFF");
    await user.click(toggle);
    expect(toggle.textContent).toBe("ON");
  });

  it("selects theme on click in Appearance tab", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    const appearanceTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Appearance")!;
    await user.click(appearanceTab);

    const chips = container.querySelectorAll(".settings__chip");
    const ghBtn = Array.from(chips).find((c) =>
      c.textContent?.trim().includes("GitHub Light Pro"),
    )!;
    expect(ghBtn).not.toHaveClass("settings__chip--active");
    await user.click(ghBtn);
    expect(ghBtn).toHaveClass("settings__chip--active");
  });

  it("renders Save and Cancel buttons in footer", () => {
    const { container } = renderSettings();
    const footer = container.querySelector(".settings__footer") as HTMLElement;
    expect(within(footer).getByText("Save")).toBeInTheDocument();
    expect(within(footer).getByText("Cancel")).toBeInTheDocument();
  });

  it("renders System theme button on Appearance tab", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    const appearanceTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Appearance")!;
    await user.click(appearanceTab);

    const chips = container.querySelectorAll(".settings__chip");
    const labels = Array.from(chips).map((c) => c.textContent?.trim());
    expect(labels.some((l) => l?.includes("System"))).toBe(true);
  });

  it("has aria-modal on dialog", () => {
    const { container } = renderSettings();
    const dialog = container.querySelector("[role='dialog']");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("autostart toggle has role switch and aria-checked", () => {
    const { container } = renderSettings();
    const toggle = container.querySelector("[role='switch']");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("renders auto-delete options on General tab", () => {
    const { container } = renderSettings();
    expect(within(container).getByText("Never")).toBeInTheDocument();
    expect(within(container).getByText("7 days")).toBeInTheDocument();
    expect(within(container).getByText("30 days")).toBeInTheDocument();
  });

  it("switches tabs when sidebar items are clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();

    // Click Language tab — should see language chips
    const tabs = container.querySelectorAll("[role='tab']");
    const langTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Language")!;
    await user.click(langTab);
    expect(within(container).getByText("English")).toBeInTheDocument();

    // Click AI tab
    const aiTab = Array.from(tabs).find((t) => t.textContent?.trim() === "AI")!;
    await user.click(aiTab);

    // Should see AI section
    expect(within(container).getByText("AI Transforms")).toBeInTheDocument();
  });

  it("renders About section on About tab", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const tabs = container.querySelectorAll("[role='tab']");
    const aboutTab = Array.from(tabs).find((t) => t.textContent?.trim() === "About")!;
    await user.click(aboutTab);

    expect(within(container).getByText("Beetroot")).toBeInTheDocument();
    expect(within(container).getByText("GitHub")).toBeInTheDocument();
    expect(within(container).getByText("Report issue")).toBeInTheDocument();
    expect(within(container).getByText("Built with Tauri + React")).toBeInTheDocument();
  });

  it("renders Welcome Guide button on About tab when onShowOnboarding provided", async () => {
    const user = userEvent.setup();
    const onShowOnboarding = vi.fn();
    const props = {
      settings: { ...defaultSettings },
      onSave: vi.fn(),
      onClose: vi.fn(),
      onShowOnboarding,
    };
    const { container } = render(<Settings {...keySettingsProps()} {...props} />);
    const tabs = container.querySelectorAll("[role='tab']");
    const aboutTab = Array.from(tabs).find((t) => t.textContent?.trim() === "About")!;
    await user.click(aboutTab);

    const btn = within(container).getByText("Show welcome guide");
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onShowOnboarding).toHaveBeenCalled();
  });

  it("sidebar has tablist role", () => {
    const { container } = renderSettings();
    const tablist = container.querySelector("[role='tablist']");
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveClass("settings__sidebar");
  });

  describe("autostart error handling", () => {
    it("shows disabledByUser error when autostart_enable rejects", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === "autostart_enable") throw new Error("disabled_by_user");
        return undefined;
      });

      const user = userEvent.setup();
      const onSave = vi.fn();
      const { container } = render(
        <Settings
          {...keySettingsProps()}
          settings={{ ...defaultSettings, autostart: false }}
          onSave={onSave}
          onClose={() => {}}
        />,
      );

      // Flip the autostart toggle ON
      const toggle = container.querySelector("[role='switch']") as HTMLElement;
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-checked", "true");

      // Click Save
      const footer = container.querySelector(".settings__footer") as HTMLElement;
      await user.click(within(footer).getByText("Save"));

      // An alert should appear
      await waitFor(() => {
        const alert = container.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
      });

      // Toggle should have reverted to OFF
      expect(toggle).toHaveAttribute("aria-checked", "false");

      // onSave should NOT have been called
      expect(onSave).not.toHaveBeenCalled();
    });

    it("shows disabledByPolicy error when autostart_enable rejects with policy code", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === "autostart_enable") throw new Error("disabled_by_policy");
        return undefined;
      });

      const user = userEvent.setup();
      const onSave = vi.fn();
      const { container } = render(
        <Settings
          {...keySettingsProps()}
          settings={{ ...defaultSettings, autostart: false }}
          onSave={onSave}
          onClose={() => {}}
        />,
      );

      const toggle = container.querySelector("[role='switch']") as HTMLElement;
      await user.click(toggle);

      const footer = container.querySelector(".settings__footer") as HTMLElement;
      await user.click(within(footer).getByText("Save"));

      await waitFor(() => {
        const alert = container.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
      });

      expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(onSave).not.toHaveBeenCalled();
    });

    it("clears autostart error when toggle is clicked again", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === "autostart_enable") throw new Error("disabled_by_user");
        return undefined;
      });

      const user = userEvent.setup();
      const { container } = render(
        <Settings
          {...keySettingsProps()}
          settings={{ ...defaultSettings, autostart: false }}
          onSave={vi.fn()}
          onClose={() => {}}
        />,
      );

      // Trigger the error
      const toggle = container.querySelector("[role='switch']") as HTMLElement;
      await user.click(toggle);
      const footer = container.querySelector(".settings__footer") as HTMLElement;
      await user.click(within(footer).getByText("Save"));
      await waitFor(() => {
        const alert = container.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
      });

      // Clicking the toggle again should clear the error
      await user.click(toggle);
      expect(container.querySelector("[role='alert']")).toBeNull();
    });

    it("rethrows non-locked autostart errors to outer handler", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === "autostart_enable") {
          throw new Error("auto-launch enable: io error");
        }
        return undefined;
      });

      const user = userEvent.setup();
      const onSave = vi.fn();
      const { container } = render(
        <Settings
          {...keySettingsProps()}
          settings={{ ...defaultSettings, autostart: false }}
          onSave={onSave}
          onClose={() => {}}
        />,
      );

      // Flip the autostart toggle ON
      const toggle = container.querySelector("[role='switch']") as HTMLElement;
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-checked", "true");

      // Click Save
      const footer = container.querySelector(".settings__footer") as HTMLElement;
      await user.click(within(footer).getByText("Save"));

      // onSave must not have been called
      await waitFor(() => {
        expect(onSave).not.toHaveBeenCalled();
      });

      // The outer error handler renders at least one [role="alert"]
      const alerts = container.querySelectorAll('[role="alert"]');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("overlay selects have accessible labels via <label> wrap", () => {
    const { container } = renderSettings({ showCopiedOverlay: true });
    const scoped = within(container);
    expect((scoped.getByLabelText("Position") as HTMLElement).tagName).toBe("SELECT");
    expect((scoped.getByLabelText("Duration") as HTMLElement).tagName).toBe("SELECT");
    expect((scoped.getByLabelText("Animation") as HTMLElement).tagName).toBe("SELECT");
  });
});

describe("Settings draft persistence", () => {
  beforeEach(() => {
    vi.mocked(invoke)
      .mockReset()
      .mockImplementation(async (cmd) => {
        if (cmd === "get_os_build") return 22631;
        if (cmd === "get_key_labels") return {};
      });
  });

  it("saves changed general fields in one complete keyless draft", async () => {
    const { container, props } = renderSettings();
    const ui = within(container);
    for (const name of ["250", "Copy only", "Original", "7 days", "Top left"]) {
      fireEvent.click(ui.getByRole("radio", { name }));
    }
    const switches = ui.getAllByRole("switch");
    fireEvent.click(switches[1]);
    fireEvent.click(switches[2]);
    fireEvent.change(ui.getByLabelText(en["settings.overlayPosition"]), {
      target: { value: "top-center" },
    });
    fireEvent.change(ui.getByLabelText(en["settings.overlayDuration"]), {
      target: { value: "visible" },
    });
    fireEvent.change(ui.getByLabelText(en["settings.overlayAnimation"]), {
      target: { value: "pop" },
    });
    fireEvent.click(switches[3]);
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(props.onSave).toHaveBeenCalledExactlyOnceWith({
      ...props.settings,
      maxHistorySize: 250,
      pasteMode: "copy",
      pasteFormat: "original",
      autoDeleteDays: 7,
      windowPosition: "top-left",
      autoUpdateEnabled: false,
      rememberTypeFilter: true,
      showCopiedOverlay: false,
      overlayPosition: "top-center",
      overlayDuration: "visible",
      overlayAnimation: "pop",
    });
    expect(props.settings.maxHistorySize).toBe(500);
    expect(props.onSave.mock.calls[0][0]).not.toHaveProperty("openaiKey");
  });

  it("persists appearance choices and language without resetting other fields", async () => {
    const { container, props } = renderSettings({ maxHistorySize: 250 });
    const ui = within(container);
    fireEvent.click(ui.getByRole("tab", { name: "Appearance" }));
    await act(async () => {});
    fireEvent.click(ui.getByRole("radio", { name: "GitHub Light Pro" }));
    fireEvent.change(ui.getByLabelText(en["settings.accentColor"]), {
      target: { value: "#123456" },
    });
    fireEvent.click(ui.getByRole("button", { name: en["settings.resetAccent"] }));
    fireEvent.click(ui.getByRole("radio", { name: /Large \(14px\)/ }));
    fireEvent.click(
      within(ui.getByRole("radiogroup", { name: en["settings.uiFont"] })).getByRole("radio", {
        name: "Inter",
      }),
    );
    fireEvent.click(
      within(ui.getByRole("radiogroup", { name: en["settings.codeFont"] })).getByRole("radio", {
        name: /JetBrains/,
      }),
    );
    fireEvent.click(ui.getByRole("radio", { name: en["settings.effectSolid"] }));
    fireEvent.click(ui.getByRole("tab", { name: "Language" }));
    fireEvent.click(ui.getByRole("radio", { name: "Deutsch" }));
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(props.onSave).toHaveBeenCalledExactlyOnceWith({
      ...props.settings,
      theme: "github-light",
      accentColor: "",
      fontSize: "large",
      uiFont: "inter",
      codeFont: "jetbrains",
      windowEffect: "solid",
      language: "de",
    });
  });

  it("keeps provider models and custom prompts across AI provider switches", async () => {
    const { container, props } = renderSettings();
    const ui = within(container);
    fireEvent.click(ui.getByRole("tab", { name: "AI" }));
    for (const [provider, model] of [
      ["OpenAI", "gpt-5.4-mini"],
      ["Google Gemini", "gemini-2.5-flash"],
      ["Anthropic", "claude-sonnet-4-6"],
      ["DeepSeek", "deepseek-reasoner"],
    ]) {
      fireEvent.click(ui.getByRole("radio", { name: provider }));
      fireEvent.click(ui.getByRole("radio", { name: model }));
    }
    fireEvent.click(ui.getByRole("button", { name: en["settings.aiAddPrompt"] }));
    fireEvent.change(ui.getByLabelText(en["settings.aiPromptName"]), {
      target: { value: "Summary" },
    });
    fireEvent.change(ui.getByLabelText(en["settings.aiPromptText"]), {
      target: { value: "Summarize this" },
    });
    fireEvent.click(ui.getByRole("radio", { name: "Local LLM" }));
    fireEvent.click(ui.getByRole("radio", { name: en["settings.localCustom"] }));
    fireEvent.change(ui.getByLabelText(en["settings.localEndpoint"]), {
      target: { value: "http://127.0.0.1:4321" },
    });
    fireEvent.change(ui.getByLabelText(en["settings.localModel"]), {
      target: { value: "fixture-model" },
    });
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Save" }));
    });
    expect(props.onSave).toHaveBeenCalledExactlyOnceWith({
      ...props.settings,
      aiProvider: "local",
      openaiModel: "gpt-5.4-mini",
      geminiModel: "gemini-2.5-flash",
      anthropicModel: "claude-sonnet-4-6",
      deepseekModel: "deepseek-reasoner",
      localEndpoint: "http://127.0.0.1:4321",
      localModel: "fixture-model",
      customAIPrompts: [{ id: expect.any(String), name: "Summary", prompt: "Summarize this" }],
    });
    expect(props.settings.customAIPrompts).toEqual([]);
  });

  it("cancels draft edits without persisting them", () => {
    const { container, props } = renderSettings();
    const ui = within(container);
    fireEvent.click(ui.getByRole("radio", { name: "100" }));
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.settings.maxHistorySize).toBe(500);
  });

  it("supports sidebar arrow, home and end navigation", () => {
    const { container } = renderSettings();
    const ui = within(container);
    const tabs = ui.getByRole("tablist");
    for (const [key, name] of [
      ["End", "About"],
      ["Home", "General"],
      ["ArrowUp", "About"],
      ["ArrowDown", "General"],
    ]) {
      fireEvent.keyDown(tabs, { key });
      expect(ui.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      expect(ui.getByRole("tab", { name })).toHaveFocus();
    }
  });
});
