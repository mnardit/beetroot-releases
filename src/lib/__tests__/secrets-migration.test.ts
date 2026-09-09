import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  discardLegacyApiKey,
  hasLegacyApiKey,
  migrateSecretsFromLocalStorage,
} from "../secrets-migration";
import { CLOUD_PROVIDERS, SETTINGS_KEY, loadSettings, saveSettings } from "../settings";
import { saveApiKey, deleteApiKey, getApiKeyStatus, validateApiKey, submitJob } from "../tauri";

const ipc = vi.mocked(invoke);
const read = () => JSON.parse(localStorage.getItem(SETTINGS_KEY)!);

beforeEach(() => {
  localStorage.clear();
  ipc.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("legacy credential migration", () => {
  it("discards only the chosen legacy field without touching the vault or unrelated settings", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ geminiKey: "bad\nkey", anthropicKey: "keep", theme: "light" }),
    );
    expect(hasLegacyApiKey("gemini")).toBe(true);
    expect(hasLegacyApiKey("openai")).toBe(false);
    discardLegacyApiKey("gemini");
    expect(read()).toEqual({ anthropicKey: "keep", theme: "light" });
    expect(hasLegacyApiKey("gemini")).toBe(false);
    expect(ipc).not.toHaveBeenCalled();
  });

  it("does not discard a key during an in-flight migration", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openaiKey: "keep" }));
    let finish!: () => void;
    ipc.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = migrateSecretsFromLocalStorage();
    expect(() => discardLegacyApiKey("openai")).toThrow("Wait for API key migration");
    expect(read().openaiKey).toBe("keep");
    finish();
    await pending;
  });

  it("preserves legacy storage when a confirmed discard cannot be written", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ geminiKey: "keep" }));
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new Error("Storage unavailable");
    });
    expect(() => discardLegacyApiKey("gemini")).toThrow("Storage unavailable");
    expect(read().geminiKey).toBe("keep");
    expect(ipc).not.toHaveBeenCalled();
  });

  it("does not offer provider discard for malformed settings JSON", () => {
    localStorage.setItem(SETTINGS_KEY, "{");
    expect(hasLegacyApiKey("openai")).toBe(false);
    expect(() => discardLegacyApiKey("openai")).toThrow("could not be read");
    expect(localStorage.getItem(SETTINGS_KEY)).toBe("{");
  });

  it("moves all four keys using the real settings key and preserves unrelated settings", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        theme: "auto",
        ...Object.fromEntries(
          CLOUD_PROVIDERS.map((provider) => [`${provider}Key`, `fixture-${provider}`]),
        ),
      }),
    );
    await migrateSecretsFromLocalStorage();
    expect(read()).toEqual({ theme: "auto" });
    for (const provider of CLOUD_PROVIDERS) {
      expect(ipc).toHaveBeenCalledWith("save_api_key", {
        provider,
        apiKey: `fixture-${provider}`,
        overwrite: false,
      });
    }
    expect(ipc).toHaveBeenCalledTimes(4);
    await migrateSecretsFromLocalStorage();
    expect(ipc).toHaveBeenCalledTimes(4);
  });

  it("retains a failed provider and resumes without repeating completed providers", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ openaiKey: "first", geminiKey: "second", theme: "auto" }),
    );
    ipc.mockResolvedValueOnce(undefined).mockRejectedValueOnce("Vault unavailable");
    await expect(migrateSecretsFromLocalStorage()).rejects.toBe("Vault unavailable");
    expect(read()).toEqual({ geminiKey: "second", theme: "auto" });
    expect(saveSettings(loadSettings())).toBe(false);
    await migrateSecretsFromLocalStorage();
    expect(read()).toEqual({ theme: "auto" });
    expect(ipc.mock.calls.map(([, args]) => args)).toEqual([
      { provider: "openai", apiKey: "first", overwrite: false },
      { provider: "gemini", apiKey: "second", overwrite: false },
      { provider: "gemini", apiKey: "second", overwrite: false },
    ]);
    expect(saveSettings(loadSettings())).toBe(true);
  });

  it("keeps legacy keys when localStorage cleanup fails after a vault write", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openaiKey: "fixture" }));
    const write = vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await expect(migrateSecretsFromLocalStorage()).rejects.toThrow("Quota exceeded");
    expect(read().openaiKey).toBe("fixture");
    write.mockRestore();
    await migrateSecretsFromLocalStorage();
    expect(read()).toEqual({});
    expect(ipc).toHaveBeenLastCalledWith("save_api_key", {
      provider: "openai",
      apiKey: "fixture",
      overwrite: false,
    });
  });

  it("shares one in-flight migration and does not erase concurrent unrelated edits", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openaiKey: "fixture", theme: "auto" }));
    let finish!: () => void;
    ipc.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = migrateSecretsFromLocalStorage();
    const second = migrateSecretsFromLocalStorage();
    expect(second).toBe(first);
    expect(saveSettings(loadSettings())).toBe(false);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...read(), theme: "github-light" }));
    finish();
    await first;
    expect(read()).toEqual({ theme: "github-light" });
    expect(ipc).toHaveBeenCalledTimes(1);
  });

  it("refuses to erase a legacy key that changed during the vault write", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openaiKey: "first" }));
    ipc.mockImplementationOnce(async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openaiKey: "changed" }));
    });
    await expect(migrateSecretsFromLocalStorage()).rejects.toThrow("changed during");
    expect(read().openaiKey).toBe("changed");
  });

  it("removes empty and invalid legacy fields without creating vault entries", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ openaiKey: "", geminiKey: "  ", anthropicKey: null, deepseekKey: 42 }),
    );
    await migrateSecretsFromLocalStorage();
    expect(read()).toEqual({});
    expect(ipc).not.toHaveBeenCalled();
  });

  it("never includes malformed credential-bearing JSON in an error", async () => {
    const raw = '{"openaiKey":"fixture-private", broken';
    localStorage.setItem(SETTINGS_KEY, raw);
    await expect(migrateSecretsFromLocalStorage()).rejects.toThrow(
      "Saved settings could not be read for API key migration",
    );
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(raw);
    expect(ipc).not.toHaveBeenCalled();
  });

  it("never reintroduces key fields from a stale in-memory settings object", () => {
    const stale = { ...loadSettings(), openaiKey: "fixture-private" };
    expect(saveSettings(stale)).toBe(true);
    expect(read()).not.toHaveProperty("openaiKey");
    expect(loadSettings()).not.toHaveProperty("openaiKey");
  });
});

describe("credential IPC contract", () => {
  it("only explicit save transmits a key; status, delete and validation use the provider", async () => {
    await saveApiKey("openai", "fixture");
    expect(ipc).toHaveBeenLastCalledWith("save_api_key", {
      provider: "openai",
      apiKey: "fixture",
      overwrite: true,
    });
    ipc.mockResolvedValueOnce(true);
    expect(await getApiKeyStatus("openai")).toBe(true);
    expect(ipc).toHaveBeenLastCalledWith("get_api_key_status", { provider: "openai" });
    await validateApiKey("openai");
    expect(ipc).toHaveBeenLastCalledWith("validate_api_key", { provider: "openai" });
    await deleteApiKey("openai");
    expect(ipc).toHaveBeenLastCalledWith("delete_api_key", { provider: "openai" });
  });

  it("submits jobs without a key and propagates vault failures", async () => {
    await submitJob({
      provider: "openai",
      model: "gpt-5.4-nano",
      prompt: "Summarize",
      inputText: "Text",
      promptName: "Summarize",
    });
    expect(JSON.stringify(ipc.mock.calls)).not.toContain("apiKey");
    ipc.mockRejectedValueOnce("Vault unavailable");
    await expect(getApiKeyStatus("openai")).rejects.toBe("Vault unavailable");
  });
});
