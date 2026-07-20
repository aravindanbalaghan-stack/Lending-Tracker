"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/calculations";
import { scheduleGroup, type ScheduleGroup } from "@/lib/schedule";
import { findMissedLoans, type LoanForMissedCheck } from "@/lib/missed";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import RepaymentQuickForm from "@/components/RepaymentQuickForm";
import { useLocalData } from "@/lib/offline/useLocalData";

const GROUP_LABEL: Record<ScheduleGroup, TranslationKey> = {
  daily: "borrowers_tabDaily",
  weekly: "borrowers_tabWeekly",
  monthly: "borrowers_tabMonthly",
};

export default function MissedClient() {
  const { t } = useLanguage();
  const { loans: allLoans, repayments: allRepayments, loading } =
    useLocalData();
  const [openLoanId, setOpenLoanId] = useState<string | null>(null);

  const loans = useMemo(() => {
    const repaymentsByLoanId = new Map<
      string,
      { amount: number; paid_at: string }[]
    >();
    for (const r of allRepayments) {
      const list = repaymentsByLoanId.get(r.loan_id) ?? [];
      list.push({ amount: Number(r.amount), paid_at: r.paid_at });
      repaymentsByLoanId.set(r.loan_id, list);
    }

    const forCheck: LoanForMissedCheck[] = allLoans.map((l) => ({
      id: l.id,
      borrower_name: l.borrower_name,
      borrower_name_ta: l.borrower_name_ta,
      principal: Number(l.principal),
      payback_amount: Number(l.payback_amount),
      collection_schedule: l.collection_schedule,
      given_at: l.given_at,
      repayments: repaymentsByLoanId.get(l.id) ?? [],
    }));

    return findMissedLoans(forCheck);
  }, [allLoans, allRepayments]);

  const grouped = useMemo(() => {
    const map = new Map<ScheduleGroup, typeof loans>([
      ["daily", []],
      ["weekly", []],
      ["monthly", []],
    ]);
    for (const loan of loans) {
      map.get(scheduleGroup(loan.collection_schedule))!.push(loan);
    }
    return map;
  }, [loans]);

  if (loading) return null;

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">{t("missed_title")}</h1>
      <p className="text-sm text-ink-soft mb-6">{t("missed_subtitle")}</p>

      {loans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ledger-line p-8 text-center">
          <p className="text-sm text-ink-soft">{t("missed_empty")}</p>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-ink font-medium">
                          {loan.borrower_name}
                          {loan.borrower_name_ta && (
                            <span className="text-ink-soft font-normal"> · {loan.borrower_name_ta}</span>
                          )}
                        </p>
                        <p className="text-xs text-rust">
                          {loan.daysSinceActivity} {t("missed_daysSince")}
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
                          onSaved={() => setOpenLoanId(null)}
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
