import { IconDownload, IconRefresh, IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "../lib/i18n";
import type { UpdateStatus } from "../hooks/useUpdater";
import "../styles/UpdateBanner.css";

interface UpdateBannerProps {
  status: UpdateStatus;
  onDownload: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ status, onDownload, onRestart, onDismiss }: UpdateBannerProps) {
  const t = useTranslation();

  // Only show for certain states
  if (status.state === "idle" || status.state === "checking" || status.state === "upToDate") {
    return null;
  }

  return (
    <div className="update-banner" role="alert" aria-live="polite">
      {status.state === "available" && (
        <>
          <span className="update-banner__text">
            <IconDownload size={16} className="update-banner__icon" />
            {t("update.available", { version: status.version })}
          </span>
          <div className="update-banner__actions">
            <button className="update-banner__btn update-banner__btn--primary" onClick={onDownload}>
              {t("update.download")}
            </button>
            <button
              className="update-banner__btn update-banner__btn--secondary"
              onClick={onDismiss}
            >
              {t("update.later")}
            </button>
          </div>
        </>
      )}

      {status.state === "downloading" && (
        <span className="update-banner__text">
          {t("update.downloading")} {status.progress}%
        </span>
      )}

      {status.state === "ready" && (
        <>
          <span className="update-banner__text">
            <IconRefresh size={16} className="update-banner__icon" />
            {t("update.ready")}
          </span>
          <button className="update-banner__btn update-banner__btn--primary" onClick={onRestart}>
            {t("update.restart")}
          </button>
        </>
      )}

      {status.state === "error" && (
        <>
          <span className="update-banner__text update-banner__text--error">
            <IconAlertCircle size={16} className="update-banner__icon" />
            {t("update.error", { error: status.message })}
          </span>
          <button className="update-banner__btn update-banner__btn--secondary" onClick={onDismiss}>
            {t("close")}
          </button>
        </>
      )}
    </div>
  );
}
