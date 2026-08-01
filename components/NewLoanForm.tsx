"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createLoanOffline } from "@/lib/offline/actions";
import { formatINR, installmentAmount, paybackAmount } from "@/lib/calculations";
import {
  SCHEDULE_OPTIONS,
  defaultScheduleForDate,
  type CollectionSchedule,
} from "@/lib/schedule";
import { transliterateToTamil } from "@/lib/transliterate";
import { useLocalData } from "@/lib/offline/useLocalData";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";

export default function NewLoanForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const { loans } = useLocalData();
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerNameTa, setBorrowerNameTa] = useState("");
  const [tamilTouched, setTamilTouched] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("25");
  const [installments, setInstallments] = useState("10");
  const [displayOrder, setDisplayOrder] = useState("");
  const [givenAt, setGivenAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [schedule, setSchedule] = useState<CollectionSchedule>(() =>
    defaultScheduleForDate(new Date())
  );
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [overridePayback, setOverridePayback] = useState(false);
  const [paybackOverrideValue, setPaybackOverrideValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // A ref guard blocks duplicate submits immediately — React state updates are
  // async, so relying on `loading` alone can still let a fast double-tap
  // through before the disabled state applies. This is what prevents the
  // "clicked multiple times, got multiple loans" bug.
  const submittingRef = useRef(false);

  function handleNameChange(value: string) {
    setBorrowerName(value);
    if (tamilTouched) return;

    const trimmed = value.trim();

    // If the name itself is already typed in Tamil script, don't run the
    // English→Tamil transliterator on it (it would produce garbage). Leave
    // the Tamil field empty so it isn't populated with a bad guess — the
    // user is clearly entering Tamil directly.
    const hasTamil = /[\u0B80-\u0BFF]/.test(trimmed);
    if (hasTamil) {
      setBorrowerNameTa("");
      return;
    }

    // If this name already belongs to an existing borrower, reuse their
    // Tamil name instead of re-guessing it, so it stays consistent.
    const existing = loans.find((l) => l.borrower_name === trimmed);
    setBorrowerNameTa(
      existing?.borrower_name_ta ||
        (trimmed ? transliterateToTamil(trimmed) : "")
    );
  }

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

  function toggleOverride(checked: boolean) {
    setOverridePayback(checked);
    if (checked && !paybackOverrideValue) {
      setPaybackOverrideValue(String(computedPayback));
    }
  }

  function handleDateChange(value: string) {
    setGivenAt(value);
    // Keep the schedule tag in sync with the chosen date unless the
    // person has deliberately picked a different schedule themselves.
    if (!scheduleTouched && value) {
      setSchedule(defaultScheduleForDate(new Date(value)));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Hard guard: if a submit is already in flight, ignore further taps.
    if (submittingRef.current) return;

    if (!borrowerName.trim() || principalNum <= 0) {
      setError(t("newLoan_error"));
      return;
    }
    if (overridePayback && (!payback || payback <= 0)) {
      setError(t("newLoan_paybackError"));
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const result = await createLoanOffline({
        borrower_name: borrowerName.trim(),
        borrower_name_ta: borrowerNameTa.trim() || null,
        principal: principalNum,
        interest_rate: rateNum,
        payback_amount: payback,
        installments_count: installmentsNum,
        display_order: displayOrder.trim() ? parseInt(displayOrder) || 0 : 0,
        collection_schedule: schedule,
        given_at: new Date(givenAt).toISOString(),
        notes: notes.trim() || null,
        phone: phone.trim() || null,
      });

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      // Success — navigate. Keep the guard on so the form can't be
      // re-submitted during the navigation transition.
      router.push(`/borrowers/${encodeURIComponent(borrowerName.trim())}`);
    } catch (err) {
      console.error("Create loan failed:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
      <h1 className="font-serif text-2xl text-ink mb-6">{t("newLoan_title")}</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-ledger-line rounded-lg p-6 space-y-4 shadow-sm"
      >
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">
            {t("newLoan_borrowerName")}
          </label>
          <input
            value={borrowerName}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
            placeholder="e.g. Ramesh Kumar / ரமேஷ் குமார்"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">
            {t("newLoan_borrowerNameTamil")}
          </label>
          <input
            value={borrowerNameTa}
            onChange={(e) => {
              setTamilTouched(true);
              setBorrowerNameTa(e.target.value);
            }}
            className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
            placeholder="ரமேஷ் குமார்"
          />
          <p className="text-[10px] text-ink-soft mt-1">
            {t("newLoan_tamilNameHint")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("newLoan_amountGiven")}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              required
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("newLoan_interestRate")}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("newLoan_installments")}
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("newLoan_dateGiven")}
            </label>
            <input
              type="date"
              value={givenAt}
              onChange={(e) => handleDateChange(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">
            {t("newLoan_displayOrder")}
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            placeholder={t("newLoan_displayOrderPlaceholder")}
            className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
          />
          <p className="text-[10px] text-ink-soft mt-1">
            {t("newLoan_displayOrderHint")}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">
            {t("newLoan_collectionSchedule")}
          </label>
          <select
            value={schedule}
            onChange={(e) => {
              setScheduleTouched(true);
              setSchedule(e.target.value as CollectionSchedule);
            }}
            className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest bg-white"
          >
            {SCHEDULE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`schedule_${option}` as TranslationKey)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">
            {t("newLoan_phone")}
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
            placeholder={t("newLoan_phonePlaceholder")}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">
            {t("newLoan_notes")}
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
            placeholder={t("newLoan_notesPlaceholder")}
          />
        </div>

        <div className="rounded-md bg-brass-soft px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-soft">{t("newLoan_totalPayback")}</p>
              {overridePayback ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paybackOverrideValue}
                  onChange={(e) => setPaybackOverrideValue(e.target.value)}
                  className="tabular text-lg text-ink bg-white rounded-md border border-ledger-line px-2 py-1 w-32 mt-0.5"
                />
              ) : (
                <p className="tabular text-lg text-ink">{formatINR(payback)}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-soft">{t("newLoan_perInstallment")}</p>
              <p className="tabular text-lg text-ink">
                {formatINR(perInstallment)}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={overridePayback}
              onChange={(e) => toggleOverride(e.target.checked)}
              className="rounded border-ledger-line"
            />
            {t("newLoan_overridePayback")}
          </label>
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-forest text-white text-sm font-medium py-2.5 hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? t("newLoan_saving") : t("newLoan_save")}
        </button>
      </form>
    </div>
  );
}
