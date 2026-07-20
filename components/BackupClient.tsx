"use client";

import { useMemo } from "react";
import { loansToCsv, loansToJson, downloadTextFile, type BackupLoan } from "@/lib/export";
import { useLanguage } from "@/components/LanguageProvider";
import { useLocalData } from "@/lib/offline/useLocalData";

export default function BackupClient() {
  const { t } = useLanguage();
  const { loans: allLoans, repayments: allRepayments, loading } =
    useLocalData();

  const loans: BackupLoan[] = useMemo(() => {
    const repaymentsByLoanId = new Map<
      string,
      { amount: number; paid_at: string }[]
    >();
    for (const r of allRepayments) {
      const list = repaymentsByLoanId.get(r.loan_id) ?? [];
      list.push({ amount: Number(r.amount), paid_at: r.paid_at });
      repaymentsByLoanId.set(r.loan_id, list);
    }
    return allLoans.map((l) => ({
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
  }, [allLoans, allRepayments]);

  function handleCsv() {
    const csv = loansToCsv(loans);
    downloadTextFile(
      `kanakku-book-backup-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv"
    );
  }

  function handleJson() {
    const json = loansToJson(loans);
    downloadTextFile(
      `kanakku-book-backup-${new Date().toISOString().slice(0, 10)}.json`,
      json,
      "application/json"
    );
  }

  if (loading) return null;

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-2xl text-ink mb-1">{t("backup_title")}</h1>
      <p className="text-sm text-ink-soft mb-6">{t("backup_subtitle")}</p>

      <div className="rounded-lg border border-ledger-line bg-white p-6 space-y-4">
        <p className="text-sm text-ink-soft">
          {loans.length} {t("backup_loanCount")}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCsv}
            disabled={loans.length === 0}
            className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {t("backup_downloadCsv")}
          </button>
          <button
            onClick={handleJson}
            disabled={loans.length === 0}
            className="rounded-md border border-ledger-line text-ink text-sm font-medium px-4 py-2 hover:bg-paper disabled:opacity-50"
          >
            {t("backup_downloadJson")}
          </button>
        </div>

        <p className="text-xs text-ink-soft">{t("backup_hint")}</p>
      </div>
    </div>
  );
}
