"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/calculations";
import { scheduleGroup, type ScheduleGroup } from "@/lib/schedule";
import { findDelayedLoans } from "@/lib/delayed";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import RepaymentQuickForm from "@/components/RepaymentQuickForm";
import RenewLoanPrompt from "@/components/RenewLoanPrompt";
import { useLocalData } from "@/lib/offline/useLocalData";
import type { LoanRecord } from "@/lib/offline/db";

const GROUP_LABEL: Record<ScheduleGroup, TranslationKey> = {
  daily: "borrowers_tabDaily",
  weekly: "borrowers_tabWeekly",
  monthly: "borrowers_tabMonthly",
};

export default function DelayedClient() {
  const { t } = useLanguage();
  const { loans, repayments, settings, loading } = useLocalData();
  const [openLoanId, setOpenLoanId] = useState<string | null>(null);
  // A loan that was just cleared from this screen — kept visible for one
  // moment so the "start a new loan?" prompt can be acted on before the row
  // disappears back into the Borrowers list.
  const [justSettled, setJustSettled] = useState<LoanRecord | null>(null);

  const paidByLoanId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of repayments) {
      map.set(r.loan_id, (map.get(r.loan_id) ?? 0) + Number(r.amount));
    }
    return map;
  }, [repayments]);

  const delayed = useMemo(
    () => findDelayedLoans(loans, paidByLoanId, settings),
    [loans, paidByLoanId, settings]
  );

  const grouped = useMemo(() => {
    const map = new Map<ScheduleGroup, typeof delayed>([
      ["daily", []],
      ["weekly", []],
      ["monthly", []],
    ]);
    for (const loan of delayed) {
      map.get(scheduleGroup(loan.collection_schedule))!.push(loan);
    }
    return map;
  }, [delayed]);

  function handleSaved(loanId: string) {
    setOpenLoanId(null);
    const loan = loans.find((l) => l.id === loanId);
    if (loan) setJustSettled(loan);
  }

  if (loading) return null;

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">{t("delayed_title")}</h1>
      <p className="text-sm text-ink-soft mb-6">{t("delayed_subtitle")}</p>

      {justSettled &&
        !delayed.some((d) => d.id === justSettled.id) && (
          <div className="mb-6">
            <p className="text-sm text-forest mb-2">
              ✓ {justSettled.borrower_name} — {t("delayed_cleared")}
            </p>
            <RenewLoanPrompt
              settledLoan={justSettled}
              onDone={() => setJustSettled(null)}
            />
          </div>
        )}

      {delayed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ledger-line p-8 text-center">
          <p className="text-sm text-ink-soft">{t("delayed_empty")}</p>
        </div>
      ) : (
        (["daily", "weekly", "monthly"] as ScheduleGroup[]).map((group) => {
          const items = grouped.get(group) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-6">
              <h2 className="text-sm font-medium text-ink-soft mb-2">
                {t(GROUP_LABEL[group])} ({items.length})
              </h2>
              <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
                {items.map((loan) => (
                  <div key={loan.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/borrowers/${encodeURIComponent(loan.borrower_name)}`}
                          className="text-sm text-ink font-medium hover:text-forest hover:underline underline-offset-2"
                        >
                          {loan.borrower_name}
                          {loan.borrower_name_ta && (
                            <span className="text-ink-soft font-normal">
                              {" "}
                              · {loan.borrower_name_ta}
                            </span>
                          )}
                        </Link>
                        <p className="text-xs text-rust">
                          {loan.daysOverdue} {t("delayed_daysOver")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-sm text-rust">
                          {formatINR(loan.outstanding)}
                        </p>
                        <button
                          onClick={() =>
                            setOpenLoanId(
                              openLoanId === loan.id ? null : loan.id
                            )
                          }
                          className="text-xs text-forest font-medium underline underline-offset-2"
                        >
                          {t("detail_recordRepayment")}
                        </button>
                      </div>
                    </div>
                    {openLoanId === loan.id && (
                      <div className="mt-3">
                        <RepaymentQuickForm
                          loanId={loan.id}
                          onSaved={() => handleSaved(loan.id)}
                          onCancel={() => setOpenLoanId(null)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
