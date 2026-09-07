import { CLOUD_PROVIDERS, SETTINGS_KEY, type CloudProvider } from "./settings";
import { saveApiKey } from "./tauri";

let migration: Promise<void> | null = null;

export function hasLegacyApiKey(provider: CloudProvider): boolean {
  try {
    return Object.prototype.hasOwnProperty.call(readRawSettings() ?? {}, `${provider}Key`);
  } catch {
    return false;
  }
}

/** Explicit user-confirmed recovery; never removes keys already stored in the vault. */
export function discardLegacyApiKey(provider: CloudProvider): void {
  if (migration) throw new Error("Wait for API key migration to finish before discarding a key");
  const settings = readRawSettings();
  if (!settings) return;
  delete settings[`${provider}Key`];
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function readRawSettings(): Record<string, unknown> | null {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // JSON parser messages can contain fragments of the credential-bearing input.
    throw new Error("Saved settings could not be read for API key migration");
  }
  return null;
}

async function migrateProvider(provider: CloudProvider): Promise<void> {
  const raw = readRawSettings();
  const field = `${provider}Key`;
  if (!raw || !(field in raw)) return;
  const key = raw[field];
  if (typeof key === "string" && key.trim()) {
    await saveApiKey(provider, key, false);
  }
  // Re-read after IPC so cleanup never replaces unrelated edits with an old snapshot.
  const current = readRawSettings();
  if (!current || current[field] !== key) {
    throw new Error("Saved settings changed during API key migration; retry");
  }
  delete current[field];
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
}

/** Resume from remaining legacy fields after failure; successful vault writes are never overwritten. */
export function migrateSecretsFromLocalStorage(): Promise<void> {
  migration ??= (async () => {
    for (const provider of CLOUD_PROVIDERS) await migrateProvider(provider);
  })().finally(() => {
    migration = null;
  });
  return migration;
}
