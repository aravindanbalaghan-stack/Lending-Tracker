"use client";

import { useState } from "react";
import { createRepaymentOffline } from "@/lib/offline/actions";
import { useLanguage } from "@/components/LanguageProvider";

export default function RepaymentQuickForm({
  loanId,
  onSaved,
  onCancel,
}: {
  loanId: string;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError(t("newLoan_error"));
      return;
    }

    setLoading(true);
    const result = await createRepaymentOffline({
      loan_id: loanId,
      amount: amountNum,
      paid_at: new Date(paidAt).toISOString(),
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    setAmount("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("detail_amountPlaceholder")}
          className="flex-1 min-w-[140px] rounded-md border border-ledger-line px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
          autoFocus
        />
        <input
          type="datetime-local"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          max={new Date().toISOString().slice(0, 16)}
          className="rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>
      {error && <p className="text-sm text-rust">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {loading ? t("detail_saving") : t("detail_save")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-ink-soft"
          >
            {t("detail_cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
