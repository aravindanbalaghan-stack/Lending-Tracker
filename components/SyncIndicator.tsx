"use client";

import { useOffline } from "@/components/OfflineProvider";
import { useLanguage } from "@/components/LanguageProvider";

// A compact status chip so the lender can trust their data state at a glance:
//   • Offline  → no connection; changes are saved locally and will sync later
//   • Syncing  → currently pushing/pulling
//   • Pending  → queued changes waiting to reach the server
//   • Synced ✓ → everything saved to the server
export default function SyncIndicator() {
  const { isOnline, pendingCount, syncing } = useOffline();
  const { t } = useLanguage();

  let label: string;
  let dot: string;
  let text: string;

  if (!isOnline) {
    label = t("sync_offline");
    dot = "bg-rust";
    text = "text-rust";
  } else if (syncing) {
    label = t("sync_syncing");
    dot = "bg-brass animate-pulse";
    text = "text-ink-soft";
  } else if (pendingCount > 0) {
    label = t("sync_pending");
    dot = "bg-brass";
    text = "text-ink-soft";
  } else {
    label = `${t("sync_synced")} ✓`;
    dot = "bg-forest";
    text = "text-forest";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${text}`}
      title={label}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="hidden xs:inline sm:inline">{label}</span>
    </span>
  );
}
