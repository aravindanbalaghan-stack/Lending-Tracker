"use client";

import { useMemo, useState, useEffect } from "react";
import { formatINR } from "@/lib/calculations";
import { useLanguage } from "@/components/LanguageProvider";
import { useLocalData } from "@/lib/offline/useLocalData";
import {
  restoreLoanOffline,
  hardDeleteLoanOffline,
  purgeExpiredLoansOffline,
} from "@/lib/offline/actions";

const RETENTION_DAYS = 8;

export default function DeletedRecords() {
  const { lang, t } = useLanguage();
  const { deletedLoans } = useLocalData();
  const locale = lang === "ta" ? "ta-IN" : "en-IN";
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());

  // Purge anything past the retention window whenever this screen opens, and
  // capture the current time in state (kept out of render for purity).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capture of current time on mount for the countdown
    setNow(Date.now());
    purgeExpiredLoansOffline(RETENTION_DAYS);
  }, []);

  const items = useMemo(() => {
    return [...deletedLoans]
      .sort(
        (a, b) =>
          new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()
      )
      .map((loan) => {
        const deletedMs = new Date(loan.deleted_at!).getTime();
        const purgeMs = deletedMs + RETENTION_DAYS * 86400000;
        const daysLeft = Math.max(0, Math.ceil((purgeMs - now) / 86400000));
        return { loan, daysLeft };
      });
  }, [deletedLoans, now]);

  async function handleRestore(id: string) {
    setBusyId(id);
    await restoreLoanOffline(id);
    setBusyId(null);
  }

  async function handlePurge(id: string) {
    setBusyId(id);
    await hardDeleteLoanOffline(id);
    setBusyId(null);
    setConfirmPurgeId(null);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-ledger-line bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">
          {t("deleted_title")}
        </p>
        <p className="text-sm text-ink-soft">{t("deleted_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ledger-line bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-ledger-line">
        <p className="text-xs uppercase tracking-wide text-ink-soft">
          {t("deleted_title")}
        </p>
        <p className="text-xs text-ink-soft mt-0.5">{t("deleted_hint")}</p>
      </div>
      <div className="divide-y divide-ledger-line">
        {items.map(({ loan, daysLeft }) => (
          <div key={loan.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink font-medium">
                  {loan.borrower_name}
                  {loan.borrower_name_ta && (
                    <span className="text-ink-soft font-normal">
                      {" "}
                      · {loan.borrower_name_ta}
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-soft">
                  {formatINR(loan.principal)} {t("detail_given")} ·{" "}
                  {new Date(loan.given_at).toLocaleDateString(locale, {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-[11px] text-rust mt-0.5">
                  {t("deleted_daysLeft").replace("{n}", String(daysLeft))}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  onClick={() => handleRestore(loan.id)}
                  disabled={busyId === loan.id}
                  className="text-xs text-forest font-medium underline underline-offset-2 disabled:opacity-50"
                >
                  {t("deleted_restore")}
                </button>
                {confirmPurgeId === loan.id ? (
                  <span className="text-[11px] text-ink-soft inline-flex items-center gap-1.5">
                    {t("deleted_purgeConfirm")}
                    <button
                      onClick={() => handlePurge(loan.id)}
                      disabled={busyId === loan.id}
                      className="text-rust font-medium underline disabled:opacity-50"
                    >
                      {t("detail_deleteYes")}
                    </button>
                    <button
                      onClick={() => setConfirmPurgeId(null)}
                      className="text-ink-soft"
                    >
                      {t("detail_cancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmPurgeId(loan.id)}
                    className="text-xs text-rust underline underline-offset-2"
                  >
                    {t("deleted_purgeNow")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
