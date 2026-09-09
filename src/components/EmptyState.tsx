import { IconClipboard, IconSearchOff } from "@tabler/icons-react";
import "../styles/EmptyState.css";
import { useTranslation } from "../lib/i18n";

interface EmptyStateProps {
  hasQuery: boolean;
}

export function EmptyState({ hasQuery }: EmptyStateProps) {
  const t = useTranslation();
  return (
    <div className="empty-state">
      <div className="empty-state__illustration">
        {hasQuery ? <IconSearchOff size={48} /> : <IconClipboard size={48} />}
      </div>
      <p className="empty-state__title">{hasQuery ? t("empty.noMatch") : t("empty.noItems")}</p>
      <p className="empty-state__hint">
        {hasQuery ? t("empty.noMatchHint") : t("empty.noItemsHint")}
      </p>
    </div>
  );
}
