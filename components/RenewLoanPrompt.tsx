"use client";

import { useState } from "react";
import { formatINR, paybackAmount } from "@/lib/calculations";
import { createLoanOffline } from "@/lib/offline/actions";
import { useLanguage } from "@/components/LanguageProvider";
import type { LoanRecord } from "@/lib/offline/db";

// Shown when a borrower has cleared a loan in full. Starting a fresh loan
// carries over their existing terms (rate, schedule, installments, Tamil
// name) so it's a single-field action: just the new amount.
export default function RenewLoanPrompt({
  settledLoan,
  onDone,
}: {
  settledLoan: LoanRecord;
  onDone?: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const principalNum = parseFloat(amount) || 0;
  const rate = Number(settledLoan.interest_rate);
  const preview = paybackAmount(principalNum, rate);

  async function handleSave() {
    setError(null);
    if (principalNum <= 0) {
      setError(t("newLoan_error"));
      return;
    }
    setSaving(true);
    const result = await createLoanOffline({
      borrower_name: settledLoan.borrower_name,
      borrower_name_ta: settledLoan.borrower_name_ta,
      principal: principalNum,
      interest_rate: rate,
      payback_amount: preview,
      installments_count: settledLoan.installments_count,
      collection_schedule: settledLoan.collection_schedule,
      given_at: new Date().toISOString(),
      notes: null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setAmount("");
    setOpen(false);
    onDone?.();
  }

  if (!open) {
    return (
      <div className="rounded-md bg-brass-soft px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-ink">{t("renew_question")}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md bg-forest text-white text-xs font-medium px-3 py-1.5 hover:opacity-90"
          >
            {t("renew_yes")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-brass-soft px-3 py-3 space-y-2">
      <p className="text-sm text-ink font-medium">{t("renew_newAmount")}</p>
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("detail_amountPlaceholder")}
          autoFocus
          className="w-36 rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular bg-white focus:outline-none focus:ring-2 focus:ring-forest"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-forest text-white text-xs font-medium px-3 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("detail_saving") : t("detail_save")}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-ink-soft"
        >
          {t("detail_cancel")}
        </button>
      </div>
      {principalNum > 0 && (
        <p className="text-xs text-ink-soft">
          {rate}% · {t("newLoan_totalPayback")} {formatINR(preview)} ·{" "}
          {settledLoan.collection_schedule}
        </p>
      )}
      {error && <p className="text-xs text-rust">{error}</p>}
    </div>
  );
}
