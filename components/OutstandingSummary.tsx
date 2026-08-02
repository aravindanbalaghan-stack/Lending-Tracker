"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/calculations";
import { useLocalData } from "@/lib/offline/useLocalData";
import { useLanguage } from "@/components/LanguageProvider";

// A collapsible field in Settings showing the total amount still owed across
// all active loans. Collapsed by default; tap to reveal the figure. Computed
// entirely from local data, so it works offline too.
export default function OutstandingSummary() {
  const { t } = useLanguage();
  const { loans, repayments } = useLocalData();
  const [open, setOpen] = useState(false);

  const { totalOutstanding, borrowerCount } = useMemo(() => {
    const paidByLoan = new Map<string, number>();
    for (const r of repayments) {
      paidByLoan.set(
        r.loan_id,
        (paidByLoan.get(r.loan_id) ?? 0) + Number(r.amount)
      );
    }
    let total = 0;
    let count = 0;
    for (const l of loans) {
      const outstanding =
        Number(l.payback_amount) - (paidByLoan.get(l.id) ?? 0);
      if (outstanding > 0) {
        total += outstanding;
        count++;
      }
    }
    return { totalOutstanding: total, borrowerCount: count };
  }, [loans, repayments]);

  return (
    <div className="rounded-lg border border-ledger-line bg-white p-4 mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-soft">
            {t("settings_outstanding")}
          </p>
          {!open && (
            <p className="text-sm text-ink-soft mt-0.5">
              {t("settings_outstandingTapToView")}
            </p>
          )}
        </div>
        <span className="text-ink-soft text-lg leading-none">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="tabular text-2xl font-semibold text-rust">
            {formatINR(totalOutstanding)}
          </p>
          <p className="text-xs text-ink-soft mt-1">
            {borrowerCount} {t("settings_outstandingLoans")}
          </p>
        </div>
      )}
    </div>
  );
}
