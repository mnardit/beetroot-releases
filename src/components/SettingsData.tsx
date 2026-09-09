import { useState, useEffect } from "react";
import { useTranslation } from "../lib/i18n";
import {
  getDataPath,
  changeDataPath,
  switchDataPath,
  pickFolder,
  checkDataPathDrive,
  checkCloudSync,
  dbGetStats,
} from "../lib/tauri";
import { setDialogActive } from "../lib/dialogState";
import type { DbStats } from "../lib/tauri";
import { createLogger } from "../lib/log";

const log = createLogger("settings-data");

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SettingsDataProps {
  onError: (error: string) => void;
}

export function SettingsData({ onError }: SettingsDataProps) {
  const t = useTranslation();
  const [dataPath, setDataPath] = useState("");
  const [migrating, setMigrating] = useState<"move" | "switch" | null>(null);
  const [stats, setStats] = useState<DbStats | null>(null);

  useEffect(() => {
    getDataPath()
      .then(setDataPath)
      .catch((e) => log.warn("failed to get data path", e));
    dbGetStats()
      .then(setStats)
      .catch((e) => log.warn("failed to get stats", e));
    return () => setDialogActive(false);
  }, []);

  async function handleAction(mode: "move" | "switch") {
    try {
      setDialogActive(true);
      const selected = await pickFolder();
      setDialogActive(false);
      if (!selected) return;

      // Block if target is on a removable or network drive
      const driveKind = await checkDataPathDrive(selected);
      if (driveKind) {
        onError(t("warning.unstableDrive"));
        return;
      }

      // Block if target is inside a cloud sync folder
      const cloudService = await checkCloudSync(selected);
      if (cloudService) {
        onError(t("warning.cloudSync", { service: cloudService }));
        return;
      }

      setMigrating(mode);
      if (mode === "move") {
        await changeDataPath(selected);
      } else {
        await switchDataPath(selected);
      }
      setMigrating(null);
    } catch (e) {
      setDialogActive(false);
      setMigrating(null);
      onError(String(e));
    }
  }

  if (!dataPath) return null;

  return (
    <>
      <div className="settings__field">
        <label className="settings__label">{t("settings.dataLocation")}</label>
        <div className="settings__data-hint">{t("settings.dataLocationHint")}</div>
        <div className="settings__path-row">
          <div className="settings__path">{dataPath}</div>
          <button
            className="settings__btn"
            onClick={() => handleAction("move")}
            disabled={migrating !== null}
          >
            {migrating === "move" ? t("settings.moving") : t("settings.move")}
          </button>
          <button
            className="settings__btn"
            onClick={() => handleAction("switch")}
            disabled={migrating !== null}
          >
            {migrating === "switch" ? t("settings.switching") : t("settings.switch")}
          </button>
        </div>
      </div>
      {stats && (
        <div className="settings__field">
          <label className="settings__label">{t("settings.data")}</label>
          <div className="settings__stats-grid">
            <span className="settings__stats-label">{t("stats.totalItems")}</span>
            <span>{stats.total_items}</span>
            <span className="settings__stats-label">{t("stats.textItems")}</span>
            <span>{stats.text_items}</span>
            <span className="settings__stats-label">{t("stats.imageItems")}</span>
            <span>{stats.image_items}</span>
            <span className="settings__stats-label">{t("stats.pinnedItems")}</span>
            <span>{stats.starred_items}</span>
            <span className="settings__stats-label">{t("stats.dbSize")}</span>
            <span>{formatBytes(stats.db_size_bytes)}</span>
            <span className="settings__stats-label">{t("stats.imagesDirSize")}</span>
            <span>{formatBytes(stats.images_dir_size_bytes)}</span>
          </div>
        </div>
      )}
    </>
  );
}
