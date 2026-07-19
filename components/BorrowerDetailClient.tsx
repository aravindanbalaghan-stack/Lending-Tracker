"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatINR } from "@/lib/calculations";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import RepaymentQuickForm from "@/components/RepaymentQuickForm";
import { loansToCsv, downloadTextFile } from "@/lib/export";
import { useLocalData } from "@/lib/offline/useLocalData";

type Repayment = { id: string; amount: number; paid_at: string };

type LoanWithRepayments = {
  id: string;
  principal: number;
  interest_rate: number;
  payback_amount: number;
  installments_count: number;
  collection_schedule: string;
  given_at: string;
  notes: string | null;
  repayments: Repayment[];
};

export default function BorrowerDetailClient() {
  const params = useParams<{ id: string }>();
  const borrowerName = decodeURIComponent(params.id);
  const { lang, t } = useLanguage();
  const { loans: allLoans, repayments: allRepayments, loading } =
    useLocalData();
  const locale = lang === "ta" ? "ta-IN" : "en-IN";

  const loans: LoanWithRepayments[] = useMemo(() => {
    const repaymentsByLoanId = new Map<string, Repayment[]>();
    for (const r of allRepayments) {
      const list = repaymentsByLoanId.get(r.loan_id) ?? [];
      list.push({ id: r.id, amount: Number(r.amount), paid_at: r.paid_at });
      repaymentsByLoanId.set(r.loan_id, list);
    }

    return allLoans
      .filter((l) => l.borrower_name === borrowerName)
      .map((l) => ({
        id: l.id,
        principal: Number(l.principal),
        interest_rate: Number(l.interest_rate),
        payback_amount: Number(l.payback_amount),
        installments_count: l.installments_count,
        collection_schedule: l.collection_schedule,
        given_at: l.given_at,
        notes: l.notes,
        repayments: repaymentsByLoanId.get(l.id) ?? [],
      }))
      .sort(
        (a, b) => new Date(b.given_at).getTime() - new Date(a.given_at).getTime()
      );
  }, [allLoans, allRepayments, borrowerName]);

  function handleDownload() {
    const csv = loansToCsv(
      loans.map((loan) => ({ ...loan, borrower_name: borrowerName }))
    );
    downloadTextFile(
      `${borrowerName.replace(/\s+/g, "-")}-backup.csv`,
      csv,
      "text/csv"
    );
  }

  if (loading) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl text-ink">{borrowerName}</h1>
        {loans.length > 0 && (
          <button
            onClick={handleDownload}
            className="text-xs text-forest font-medium underline underline-offset-2"
          >
            {t("backup_downloadCsv")}
          </button>
        )}
      </div>
      <p className="text-sm text-ink-soft mb-6">{t("detail_subtitle")}</p>

      {loans.length === 0 ? (
        <p className="text-sm text-ink-soft italic">{t("detail_noLoans")}</p>
      ) : (
        <div className="space-y-6">
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} locale={locale} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function LoanCard({
  loan,
  locale,
  t,
}: {
  loan: LoanWithRepayments;
  locale: string;
  t: (key: TranslationKey) => string;
}) {
  const [showForm, setShowForm] = useState(false);

  const totalPaid = loan.repayments.reduce((s, r) => s + Number(r.amount), 0);
  const outstanding = Number(loan.payback_amount) - totalPaid;
  const sortedRepayments = [...loan.repayments].sort(
    (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
  );
  const scheduleLabel = t(`schedule_${loan.collection_schedule}` as TranslationKey);

  return (
    <div className="rounded-lg border border-ledger-line bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-ledger-line flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-soft">
            {new Date(loan.given_at).toLocaleDateString(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {loan.interest_rate}% · {loan.installments_count}× ·{" "}
            <span className="text-brass font-medium">{scheduleLabel}</span>
          </p>
          <p className="tabular text-sm text-ink">
            {formatINR(loan.principal)} {t("detail_given")} →{" "}
            {formatINR(loan.payback_amount)} {t("detail_owed")}
          </p>
          {loan.notes && (
            <p className="text-xs text-ink-soft italic mt-0.5">{loan.notes}</p>
          )}
        </div>
        <div className="text-right">
          <p
            className={`tabular text-sm ${
              outstanding > 0 ? "text-rust" : "text-forest"
            }`}
          >
            {outstanding > 0 ? formatINR(outstanding) : t("detail_settled")}
          </p>
          {outstanding > 0 && (
            <p className="text-xs text-ink-soft">{t("detail_outstanding")}</p>
          )}
        </div>
      </div>

      {sortedRepayments.length > 0 && (
        <div className="divide-y divide-ledger-line">
          {sortedRepayments.map((r) => (
            <div
              key={r.id}
              className="px-4 py-2 flex items-center justify-between text-sm"
            >
              <span className="text-ink-soft">
                {new Date(r.paid_at).toLocaleString(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="tabular text-forest">
                +{formatINR(r.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 bg-paper">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-forest font-medium underline underline-offset-2"
          >
            {t("detail_recordRepayment")}
          </button>
        ) : (
          <RepaymentQuickForm
            loanId={loan.id}
            onSaved={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  );
}
