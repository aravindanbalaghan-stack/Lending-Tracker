"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalData } from "@/lib/offline/useLocalData";
import { loansToJson, downloadTextFile, type BackupLoan } from "@/lib/export";
import { getCurrentUserId } from "@/lib/offline/actions";
import { useLanguage } from "@/components/LanguageProvider";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function lastBackupKey(userId: string) {
  return `kanakku-last-backup:${userId}`;
}

// Builds the backup payload from local data and hands it to the user as a
// downloadable JSON file. On mobile, the OS share/save sheet lets them send
// it to Google Drive; on desktop it saves to their downloads folder.
function buildBackup(loans: BackupLoan[]): string {
  return loansToJson(loans);
}

export default function WeeklyBackup() {
  const { loans: allLoans, repayments: allRepayments, loading } =
    useLocalData();
  const { t } = useLanguage();
  const [due, setDue] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (loading || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      const userId = await getCurrentUserId();
      if (!userId) return;
      let last = 0;
      try {
        const raw = localStorage.getItem(lastBackupKey(userId));
        last = raw ? parseInt(raw) : 0;
      } catch {
        last = 0;
      }
      if (Date.now() - last >= WEEK_MS) {
        setDue(true);
      }
    })();
  }, [loading]);

  async function runBackup() {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const repaymentsByLoanId = new Map<
      string,
      { amount: number; paid_at: string }[]
    >();
    for (const r of allRepayments) {
      const list = repaymentsByLoanId.get(r.loan_id) ?? [];
      list.push({ amount: Number(r.amount), paid_at: r.paid_at });
      repaymentsByLoanId.set(r.loan_id, list);
    }
    const loans: BackupLoan[] = allLoans.map((l) => ({
      id: l.id,
      borrower_name: l.borrower_name,
      borrower_name_ta: l.borrower_name_ta,
      principal: Number(l.principal),
      interest_rate: Number(l.interest_rate),
      payback_amount: Number(l.payback_amount),
      installments_count: l.installments_count,
      collection_schedule: l.collection_schedule,
      given_at: l.given_at,
      notes: l.notes,
      repayments: repaymentsByLoanId.get(l.id) ?? [],
    }));

    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `kanakku-weekly-backup-${date}.json`,
      buildBackup(loans),
      "application/json"
    );

    try {
      localStorage.setItem(lastBackupKey(userId), String(Date.now()));
    } catch {
      // ignore storage errors
    }
    setDue(false);
  }

  async function dismiss() {
    const userId = await getCurrentUserId();
    if (userId) {
      try {
        localStorage.setItem(lastBackupKey(userId), String(Date.now()));
      } catch {
        // ignore
      }
    }
    setDue(false);
  }

  if (!due) return null;

  return (
    <div className="bg-brass-soft border-b border-ledger-line px-4 py-2 text-sm text-ink flex items-center justify-between gap-3 flex-wrap">
      <span>{t("backup_weeklyPrompt")}</span>
      <div className="flex gap-2">
        <button
          onClick={runBackup}
          className="rounded-md bg-forest text-white text-xs font-medium px-3 py-1.5 hover:opacity-90"
        >
          {t("backup_weeklyNow")}
        </button>
        <button onClick={dismiss} className="text-xs text-ink-soft">
          {t("backup_weeklyLater")}
        </button>
      </div>
    </div>
  );
}
