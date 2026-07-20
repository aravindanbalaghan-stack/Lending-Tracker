"use client";

import { useMemo, useState } from "react";
import { formatINR, installmentAmount, paybackAmount } from "@/lib/calculations";
import { SCHEDULE_OPTIONS, type CollectionSchedule } from "@/lib/schedule";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import { updateLoanOffline } from "@/lib/offline/actions";
import type { LoanRecord } from "@/lib/offline/db";

export default function EditLoanForm({
  loan,
  onSaved,
  onCancel,
}: {
  loan: LoanRecord;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [principal, setPrincipal] = useState(String(loan.principal));
  const [rate, setRate] = useState(String(loan.interest_rate));
  const [installments, setInstallments] = useState(
    String(loan.installments_count)
  );
  const [givenAt, setGivenAt] = useState(loan.given_at.slice(0, 10));
  const [schedule, setSchedule] = useState<CollectionSchedule>(
    loan.collection_schedule as CollectionSchedule
  );
  const [notes, setNotes] = useState(loan.notes ?? "");
  const [overridePayback, setOverridePayback] = useState(false);
  const [paybackOverrideValue, setPaybackOverrideValue] = useState(
    String(loan.payback_amount)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const principalNum = parseFloat(principal) || 0;
  const rateNum = parseFloat(rate) || 0;
  const installmentsNum = Math.max(1, parseInt(installments) || 1);

  const computedPayback = useMemo(
    () => paybackAmount(principalNum, rateNum),
    [principalNum, rateNum]
  );
  const payback = overridePayback
    ? parseFloat(paybackOverrideValue) || 0
    : computedPayback;
  const perInstallment = useMemo(
    () => installmentAmount(payback, installmentsNum),
    [payback, installmentsNum]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (principalNum <= 0) {
      setError(t("newLoan_error"));
      return;
    }
    if (overridePayback && (!payback || payback <= 0)) {
      setError(t("newLoan_paybackError"));
      return;
    }

    setLoading(true);
    const result = await updateLoanOffline(loan.id, {
      principal: principalNum,
      interest_rate: rateNum,
      payback_amount: payback,
      installments_count: installmentsNum,
      collection_schedule: schedule,
      given_at: new Date(givenAt).toISOString(),
      notes: notes.trim() || null,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 bg-paper rounded-md p-3 mt-2"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-ink-soft mb-1">
            {t("newLoan_amountGiven")}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>
        <div>
          <label className="block text-[10px] text-ink-soft mb-1">
            {t("newLoan_interestRate")}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-ink-soft mb-1">
            {t("newLoan_installments")}
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
            className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>
        <div>
          <label className="block text-[10px] text-ink-soft mb-1">
            {t("newLoan_dateGiven")}
          </label>
          <input
            type="date"
            value={givenAt}
            onChange={(e) => setGivenAt(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-ink-soft mb-1">
          {t("newLoan_collectionSchedule")}
        </label>
        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value as CollectionSchedule)}
          className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm bg-white"
        >
          {SCHEDULE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`schedule_${option}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] text-ink-soft mb-1">
          {t("newLoan_notes")}
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>

      <div className="rounded-md bg-brass-soft px-3 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-ink-soft">
              {t("newLoan_totalPayback")}
            </p>
            {overridePayback ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={paybackOverrideValue}
                onChange={(e) => setPaybackOverrideValue(e.target.value)}
                className="tabular text-sm text-ink bg-white rounded-md border border-ledger-line px-2 py-1 w-28"
              />
            ) : (
              <p className="tabular text-sm text-ink">{formatINR(payback)}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ink-soft">
              {t("newLoan_perInstallment")}
            </p>
            <p className="tabular text-sm text-ink">
              {formatINR(perInstallment)}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[10px] text-ink-soft">
          <input
            type="checkbox"
            checked={overridePayback}
            onChange={(e) => setOverridePayback(e.target.checked)}
            className="rounded border-ledger-line"
          />
          {t("newLoan_overridePayback")}
        </label>
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
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-ink-soft"
        >
          {t("detail_cancel")}
        </button>
      </div>
    </form>
  );
}
