"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatINR } from "@/lib/calculations";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import RepaymentQuickForm from "@/components/RepaymentQuickForm";
import EditLoanForm from "@/components/EditLoanForm";
import { loansToCsv, downloadTextFile } from "@/lib/export";
import { useLocalData } from "@/lib/offline/useLocalData";
import { renameBorrowerOffline, updateRepaymentOffline } from "@/lib/offline/actions";
import { transliterateToTamil } from "@/lib/transliterate";
import type { LoanRecord } from "@/lib/offline/db";

type Repayment = { id: string; amount: number; payment_mode: string; paid_at: string };

type LoanWithRepayments = LoanRecord & { repayments: Repayment[] };

export default function BorrowerDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const borrowerName = decodeURIComponent(params.id);
  const { lang, t } = useLanguage();
  const { loans: allLoans, repayments: allRepayments, loading } =
    useLocalData();
  const locale = lang === "ta" ? "ta-IN" : "en-IN";

  const currentNameTa = useMemo(
    () => allLoans.find((l) => l.borrower_name === borrowerName)?.borrower_name_ta ?? "",
    [allLoans, borrowerName]
  );

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(borrowerName);
  const [newNameTa, setNewNameTa] = useState(currentNameTa);
  const [tamilTouched, setTamilTouched] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);

  const loans: LoanWithRepayments[] = useMemo(() => {
    const repaymentsByLoanId = new Map<string, Repayment[]>();
    for (const r of allRepayments) {
      const list = repaymentsByLoanId.get(r.loan_id) ?? [];
      list.push({
        id: r.id,
        amount: Number(r.amount),
        payment_mode: r.payment_mode,
        paid_at: r.paid_at,
      });
      repaymentsByLoanId.set(r.loan_id, list);
    }

    return allLoans
      .filter((l) => l.borrower_name === borrowerName)
      .map((l) => ({
        ...l,
        repayments: repaymentsByLoanId.get(l.id) ?? [],
      }))
      .sort(
        (a, b) => new Date(b.given_at).getTime() - new Date(a.given_at).getTime()
      );
  }, [allLoans, allRepayments, borrowerName]);

  function handleDownload() {
    const csv = loansToCsv(
      loans.map((loan) => ({
        ...loan,
        principal: Number(loan.principal),
        interest_rate: Number(loan.interest_rate),
        payback_amount: Number(loan.payback_amount),
        borrower_name: borrowerName,
      }))
    );
    downloadTextFile(
      `${borrowerName.replace(/\s+/g, "-")}-backup.csv`,
      csv,
      "text/csv"
    );
  }

  function startRenaming() {
    setNewName(borrowerName);
    setNewNameTa(currentNameTa);
    setTamilTouched(false);
    setRenaming(true);
  }

  function handleNewNameChange(value: string) {
    setNewName(value);
    if (!tamilTouched) {
      setNewNameTa(value.trim() ? transliterateToTamil(value.trim()) : "");
    }
  }

  async function handleRenameSave() {
    if (!newName.trim()) return;
    if (newName.trim() === borrowerName && newNameTa.trim() === currentNameTa) {
      setRenaming(false);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    const result = await renameBorrowerOffline(
      borrowerName,
      newName.trim(),
      newNameTa.trim() || null
    );
    setRenameSaving(false);
    if (!result.ok) {
      setRenameError(result.error ?? "Something went wrong.");
      return;
    }
    if (newName.trim() !== borrowerName) {
      router.push(`/borrowers/${encodeURIComponent(newName.trim())}`);
    } else {
      setRenaming(false);
    }
  }

  if (loading) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        {renaming ? (
          <div className="flex-1 space-y-2">
            <input
              value={newName}
              onChange={(e) => handleNewNameChange(e.target.value)}
              autoFocus
              className="font-serif text-xl text-ink border border-ledger-line rounded-md px-2 py-1 w-full"
              placeholder="English name"
            />
            <input
              value={newNameTa}
              onChange={(e) => {
                setTamilTouched(true);
                setNewNameTa(e.target.value);
              }}
              className="text-sm text-ink border border-ledger-line rounded-md px-2 py-1 w-full"
              placeholder="தமிழ் பெயர்"
            />
            <div className="flex gap-2">
              <button
                onClick={handleRenameSave}
                disabled={renameSaving}
                className="text-xs rounded-md bg-forest text-white px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
              >
                {t("detail_save")}
              </button>
              <button
                onClick={() => {
                  setRenaming(false);
                  setRenameError(null);
                }}
                className="text-xs text-ink-soft"
              >
                {t("detail_cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="font-serif text-2xl text-ink flex items-center gap-2 flex-wrap">
              {borrowerName}
              <button
                onClick={startRenaming}
                className="text-xs text-forest underline underline-offset-2 font-normal"
              >
                {t("detail_renameBorrower")}
              </button>
            </h1>
            {currentNameTa && (
              <p className="text-sm text-ink-soft">{currentNameTa}</p>
            )}
          </div>
        )}
        {loans.length > 0 && !renaming && (
          <button
            onClick={handleDownload}
            className="text-xs text-forest font-medium underline underline-offset-2 whitespace-nowrap"
          >
            {t("backup_downloadCsv")}
          </button>
        )}
      </div>
      {renameError && <p className="text-sm text-rust mb-2">{renameError}</p>}
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
  const [showRepayForm, setShowRepayForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRepaymentId, setEditingRepaymentId] = useState<string | null>(
    null
  );

  const totalPaid = loan.repayments.reduce((s, r) => s + Number(r.amount), 0);
  const outstanding = Number(loan.payback_amount) - totalPaid;
  const sortedRepayments = [...loan.repayments].sort(
    (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
  );
  const scheduleLabel = t(`schedule_${loan.collection_schedule}` as TranslationKey);

  return (
    <div className="rounded-lg border border-ledger-line bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-ledger-line">
        <div className="flex items-center justify-between">
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
        {!showEditForm ? (
          <button
            onClick={() => setShowEditForm(true)}
            className="text-xs text-forest underline underline-offset-2 mt-2"
          >
            {t("detail_editLoan")}
          </button>
        ) : (
          <EditLoanForm
            loan={loan}
            onSaved={() => setShowEditForm(false)}
            onCancel={() => setShowEditForm(false)}
          />
        )}
      </div>

      {sortedRepayments.length > 0 && (
        <div className="divide-y divide-ledger-line">
          {sortedRepayments.map((r) =>
            editingRepaymentId === r.id ? (
              <EditRepaymentRow
                key={r.id}
                repayment={r}
                onSaved={() => setEditingRepaymentId(null)}
                onCancel={() => setEditingRepaymentId(null)}
                t={t}
              />
            ) : (
              <div
                key={r.id}
                className="px-4 py-2 flex items-center justify-between text-sm"
              >
                <div>
                  <span className="text-ink-soft">
                    {new Date(r.paid_at).toLocaleString(locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-soft border border-ledger-line rounded px-1.5 py-0.5">
                    {r.payment_mode === "UPI" ? t("repay_modeUpi") : t("repay_modeCash")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular text-forest">
                    +{formatINR(r.amount)}
                  </span>
                  <button
                    onClick={() => setEditingRepaymentId(r.id)}
                    className="text-xs text-ink-soft underline underline-offset-2"
                  >
                    {t("detail_edit")}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="px-4 py-3 bg-paper">
        {!showRepayForm ? (
          <button
            onClick={() => setShowRepayForm(true)}
            className="text-sm text-forest font-medium underline underline-offset-2"
          >
            {t("detail_recordRepayment")}
          </button>
        ) : (
          <RepaymentQuickForm
            loanId={loan.id}
            onSaved={() => setShowRepayForm(false)}
            onCancel={() => setShowRepayForm(false)}
          />
        )}
      </div>
    </div>
  );
}

function EditRepaymentRow({
  repayment,
  onSaved,
  onCancel,
  t,
}: {
  repayment: Repayment;
  onSaved: () => void;
  onCancel: () => void;
  t: (key: TranslationKey) => string;
}) {
  const [amount, setAmount] = useState(String(repayment.amount));
  const [paymentMode, setPaymentMode] = useState<"Cash" | "UPI">(
    repayment.payment_mode === "UPI" ? "UPI" : "Cash"
  );
  const [paidAt, setPaidAt] = useState(repayment.paid_at.slice(0, 16));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError(t("newLoan_error"));
      return;
    }
    setLoading(true);
    const result = await updateRepaymentOffline(repayment.id, {
      amount: amountNum,
      payment_mode: paymentMode,
      paid_at: new Date(paidAt).toISOString(),
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    onSaved();
  }

  return (
    <div className="px-4 py-2 bg-paper">
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-md border border-ledger-line px-2 py-1 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
        />
        <div className="flex rounded-md border border-ledger-line overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setPaymentMode("Cash")}
            className={`px-2 py-1.5 ${
              paymentMode === "Cash" ? "bg-forest text-white" : "bg-white text-ink-soft"
            }`}
          >
            {t("repay_modeCash")}
          </button>
          <button
            type="button"
            onClick={() => setPaymentMode("UPI")}
            className={`px-2 py-1.5 ${
              paymentMode === "UPI" ? "bg-forest text-white" : "bg-white text-ink-soft"
            }`}
          >
            {t("repay_modeUpi")}
          </button>
        </div>
        <input
          type="datetime-local"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          max={new Date().toISOString().slice(0, 16)}
          className="rounded-md border border-ledger-line px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="text-xs rounded-md bg-forest text-white px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? t("detail_saving") : t("detail_save")}
        </button>
        <button onClick={onCancel} className="text-xs text-ink-soft">
          {t("detail_cancel")}
        </button>
      </div>
      {error && <p className="text-xs text-rust mt-1">{error}</p>}
    </div>
  );
}
