import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, within } from "@testing-library/react";
import { StrictMode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CloudKeyEditor } from "../CloudKeyEditor";
import { CLOUD_PROVIDERS, SETTINGS_KEY, loadSettings, saveSettings } from "../../lib/settings";
import { migrateSecretsFromLocalStorage } from "../../lib/secrets-migration";
import { en } from "../../lib/i18n";

const ipc = vi.mocked(invoke);
const props = () => ({
  provider: "openai" as const,
  hasKey: true,
  ready: true,
  migrationError: false,
  onKeysChanged: vi.fn().mockResolvedValue(undefined),
  onRetry: vi.fn(),
});
beforeEach(() => {
  ipc.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
});

describe("CloudKeyEditor", () => {
  it("requires confirmation to discard only the selected legacy key and resume migration", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        geminiKey: "bad\nkey",
        anthropicKey: "valid-later-key",
        theme: "light",
      }),
    );
    ipc.mockImplementation(async (command, args) => {
      if (command === "save_api_key" && (args as { provider: string }).provider === "gemini") {
        throw new Error("Invalid key");
      }
    });
    await expect(migrateSecretsFromLocalStorage()).rejects.toThrow("Invalid key");
    expect(saveSettings(loadSettings())).toBe(false);
    ipc.mockClear();
    const callbacks = props();
    callbacks.onRetry.mockImplementation(() => migrateSecretsFromLocalStorage());
    const { container } = render(
      <CloudKeyEditor {...callbacks} provider="gemini" ready={false} migrationError />,
    );
    const ui = within(container);
    fireEvent.click(ui.getByRole("button", { name: "Discard old key" }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).geminiKey).toBe("bad\nkey");
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(callbacks.onRetry).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole("button", { name: "Discard old key" }));
    await act(async () => {
      fireEvent.click(ui.getByRole("button", { name: "Confirm discard" }));
    });
    expect(callbacks.onRetry).toHaveBeenCalledTimes(1);
    expect(ipc).toHaveBeenCalledExactlyOnceWith("save_api_key", {
      provider: "anthropic",
      apiKey: "valid-later-key",
      overwrite: false,
    });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({ theme: "light" });
    expect(saveSettings(loadSettings())).toBe(true);
  });

  it.each(CLOUD_PROVIDERS)(
    "saves %s only on an explicit save and clears the password",
    async (provider) => {
      const callbacks = props();
      const { container } = render(
        <StrictMode>
          <CloudKeyEditor {...callbacks} provider={provider} />
        </StrictMode>,
      );
      const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
      fireEvent.change(input, { target: { value: "fixture-secret" } });
      expect(ipc).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.click(within(container).getByRole("button", { name: en["settings.aiSaveKey"] }));
      });
      expect(ipc).toHaveBeenCalledExactlyOnceWith("save_api_key", {
        provider,
        apiKey: "fixture-secret",
        overwrite: true,
      });
      expect(callbacks.onKeysChanged).toHaveBeenCalledTimes(1);
      expect(input.value).toBe("");
      expect(localStorage.length).toBe(0);
    },
  );

  it("validates the saved key through Rust with no renderer HTTP request", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { container } = render(<CloudKeyEditor {...props()} />);
    await act(async () => {
      fireEvent.click(within(container).getByRole("button", { name: en["settings.aiTestKey"] }));
    });
    expect(ipc).toHaveBeenCalledExactlyOnceWith("validate_api_key", { provider: "openai" });
    expect(container.textContent).toContain(en["settings.aiKeyValid"]);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("deletes only the selected provider and refreshes status", async () => {
    const callbacks = props();
    const { container } = render(<CloudKeyEditor {...callbacks} />);
    await act(async () => {
      fireEvent.click(within(container).getByRole("button", { name: en["settings.aiDeleteKey"] }));
    });
    expect(ipc).toHaveBeenCalledExactlyOnceWith("delete_api_key", { provider: "openai" });
    expect(callbacks.onKeysChanged).toHaveBeenCalledTimes(1);
  });

  it("retains unsaved input after vault failure without echoing backend errors", async () => {
    ipc.mockRejectedValueOnce("fixture-secret in untrusted error");
    const callbacks = props();
    const { container } = render(<CloudKeyEditor {...callbacks} />);
    const input = container.querySelector<HTMLInputElement>("input")!;
    fireEvent.change(input, { target: { value: "fixture-secret" } });
    await act(async () => {
      fireEvent.click(within(container).getByRole("button", { name: en["settings.aiSaveKey"] }));
    });
    expect(input.value).toBe("fixture-secret");
    expect(container.textContent).toContain(en["settings.aiKeyStorageError"]);
    expect(container.textContent).not.toContain("fixture-secret");
    expect(callbacks.onKeysChanged).not.toHaveBeenCalled();
  });

  it("disables key actions until bootstrap succeeds and offers retry after failure", () => {
    const callbacks = props();
    const { container } = render(<CloudKeyEditor {...callbacks} ready={false} migrationError />);
    for (const key of [
      "settings.aiSaveKey",
      "settings.aiDeleteKey",
      "settings.aiTestKey",
    ] as const) {
      expect(within(container).getByRole("button", { name: en[key] })).toBeDisabled();
    }
    fireEvent.click(within(container).getByRole("button", { name: en["settings.aiRetryKeys"] }));
    expect(callbacks.onRetry).toHaveBeenCalledTimes(1);
    expect(ipc).not.toHaveBeenCalled();
  });

  it("refreshes app status even when the editor unmounts during save", async () => {
    let finish!: () => void;
    ipc.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const callbacks = props();
    const { container, unmount } = render(<CloudKeyEditor {...callbacks} />);
    fireEvent.change(container.querySelector("input")!, { target: { value: "fixture" } });
    fireEvent.click(within(container).getByRole("button", { name: en["settings.aiSaveKey"] }));
    unmount();
    await act(async () => {
      finish();
    });
    expect(callbacks.onKeysChanged).toHaveBeenCalledTimes(1);
  });
});
