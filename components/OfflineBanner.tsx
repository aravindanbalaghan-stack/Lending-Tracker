"use client";

import { useOffline } from "@/components/OfflineProvider";
import { useLanguage } from "@/components/LanguageProvider";

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing, triggerSync } = useOffline();
  const { t } = useLanguage();

  if (isOnline && pendingCount === 0 && !syncing) return null;

  return (
    <div
      className={`text-xs text-center py-1.5 px-4 ${
        isOnline ? "bg-brass-soft text-ink" : "bg-rust-soft text-rust"
      }`}
    >
      {!isOnline && <span>{t("offline_banner")}</span>}
      {isOnline && syncing && <span>{t("offline_syncing")}</span>}
      {isOnline && !syncing && pendingCount > 0 && (
        <span>
          {pendingCount} {t("offline_pending")}{" "}
          <button onClick={triggerSync} className="underline font-medium">
            {t("offline_syncNow")}
          </button>
        </span>
      )}
    </div>
  );
}
