import { useEffect, useRef, useState } from "react";
import { IconDeviceFloppy, IconTrash, IconPlugConnected, IconRefresh } from "@tabler/icons-react";
import { useTranslation } from "../lib/i18n";
import type { CloudProvider } from "../lib/settings";
import { saveApiKey, deleteApiKey, validateApiKey } from "../lib/tauri";
import { discardLegacyApiKey, hasLegacyApiKey } from "../lib/secrets-migration";

interface CloudKeyEditorProps {
  provider: CloudProvider;
  hasKey: boolean;
  ready: boolean;
  migrationError: boolean;
  onKeysChanged: () => Promise<void>;
  onRetry: () => void;
}

export function CloudKeyEditor({
  provider,
  hasKey,
  ready,
  migrationError,
  onKeysChanged,
  onRetry,
}: CloudKeyEditorProps) {
  const t = useTranslation();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "valid" | "invalid" | "error">("idle");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const canDiscard = migrationError && hasLegacyApiKey(provider);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function run(action: "save" | "delete" | "test") {
    setBusy(true);
    setStatus("idle");
    try {
      if (action === "test") {
        await validateApiKey(provider);
        if (mounted.current) setStatus("valid");
      } else {
        if (action === "save") await saveApiKey(provider, key);
        else await deleteApiKey(provider);
        if (mounted.current) setKey("");
        await onKeysChanged();
      }
    } catch {
      if (mounted.current) setStatus(action === "test" ? "invalid" : "error");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      <div className="settings__ai-key-row">
        <input
          type="password"
          className="settings__ai-input"
          autoComplete="off"
          aria-label={t("settings.aiKeyInput")}
          placeholder={t("settings.aiKeyInput")}
          value={key}
          maxLength={1024}
          disabled={!ready || busy}
          onChange={(e) => {
            setKey(e.target.value);
            setStatus("idle");
          }}
        />
        <button
          type="button"
          className="settings__chip"
          title={t("settings.aiSaveKey")}
          aria-label={t("settings.aiSaveKey")}
          disabled={!ready || busy || !key.trim()}
          onClick={() => void run("save")}
        >
          <IconDeviceFloppy size={16} />
        </button>
        <button
          type="button"
          className="settings__chip"
          title={t("settings.aiDeleteKey")}
          aria-label={t("settings.aiDeleteKey")}
          disabled={!ready || busy || !hasKey}
          onClick={() => void run("delete")}
        >
          <IconTrash size={16} />
        </button>
        <button
          type="button"
          className="settings__chip"
          title={t("settings.aiTestKey")}
          aria-label={t("settings.aiTestKey")}
          disabled={!ready || busy || !hasKey || !!key}
          onClick={() => void run("test")}
        >
          <IconPlugConnected size={16} />
        </button>
      </div>
      <div className="settings__ai-model-desc" role="status">
        {status === "error"
          ? t("settings.aiKeyStorageError")
          : migrationError
            ? t("settings.aiMigrationError")
            : !ready || busy
              ? t("settings.aiKeyTesting")
              : status === "valid"
                ? t("settings.aiKeyValid")
                : status === "invalid"
                  ? t("settings.aiKeyInvalid")
                  : hasKey
                    ? t("settings.aiKeySaved")
                    : t("settings.aiKeyMissing")}
      </div>
      {migrationError && (
        <button
          type="button"
          className="settings__chip"
          title={t("settings.aiRetryKeys")}
          aria-label={t("settings.aiRetryKeys")}
          onClick={onRetry}
        >
          <IconRefresh size={16} />
        </button>
      )}
      {canDiscard &&
        (confirmDiscard ? (
          <div className="settings__ai-model-desc" role="alert">
            <p>{t("settings.aiDiscardLegacyConfirm", { provider })}</p>
            <div className="settings__ai-key-row">
              <button
                type="button"
                className="settings__chip"
                title={t("settings.aiConfirmDiscard")}
                aria-label={t("settings.aiConfirmDiscard")}
                onClick={() => {
                  try {
                    discardLegacyApiKey(provider);
                    setConfirmDiscard(false);
                    setStatus("idle");
                    onRetry();
                  } catch {
                    setStatus("error");
                  }
                }}
              >
                <IconTrash size={16} />
              </button>
              <button
                type="button"
                className="settings__chip"
                onClick={() => setConfirmDiscard(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="settings__chip"
            title={t("settings.aiDiscardLegacy")}
            aria-label={t("settings.aiDiscardLegacy")}
            onClick={() => setConfirmDiscard(true)}
          >
            <IconTrash size={16} />
          </button>
        ))}
    </>
  );
}
