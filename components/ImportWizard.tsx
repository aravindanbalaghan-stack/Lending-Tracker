"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createLoansBulkOffline,
  createRepaymentsBulkOffline,
} from "@/lib/offline/actions";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import {
  parseSpreadsheetFile,
  mapRows,
  mapPaymentRows,
  LOAN_FIELDS,
  PAYMENT_FIELDS,
  type ParsedFile,
  type FieldMapping,
  type MapResult,
  type PaymentMapResult,
} from "@/lib/import";
import { formatINR, paybackAmount } from "@/lib/calculations";
import { useLocalData } from "@/lib/offline/useLocalData";

type ImportKind = "loans" | "payments";
type Step = "upload" | "map" | "preview" | "done";

const MAX_IMPORT_ROWS = 5000;

function guessLoanMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const guesses: Record<string, string[]> = {
    borrower_name: ["name", "borrowername", "customer", "customername", "borrower"],
    borrower_name_ta: ["nametamil", "tamilname", "nameta"],
    principal: ["amount", "principal", "amountgiven", "loanamount", "given"],
    interest_rate: ["interest", "interestrate", "rate"],
    installments_count: ["installments", "installment", "emi", "noofinstallments"],
    collection_schedule: ["schedule", "frequency", "collectionday", "day"],
    given_at: ["date", "dategiven", "loandate", "givenon"],
    notes: ["notes", "note", "remarks", "comment", "purpose"],
  };
  headers.forEach((header, idx) => {
    const norm = normalize(header);
    for (const [field, patterns] of Object.entries(guesses)) {
      if (mapping[field] !== undefined) continue;
      if (patterns.some((p) => norm.includes(p))) mapping[field] = idx;
    }
  });
  return mapping;
}

function guessPaymentMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const guesses: Record<string, string[]> = {
    borrower_name: ["name", "borrowername", "customer", "customername", "borrower"],
    amount: ["amount", "paymentamount", "paid", "received", "collection"],
    payment_mode: ["mode", "paymentmode", "paymenttype", "method"],
    paid_at: ["date", "paiddate", "paymentdate", "receiveddate", "collectiondate"],
  };
  headers.forEach((header, idx) => {
    const norm = normalize(header);
    for (const [field, patterns] of Object.entries(guesses)) {
      if (mapping[field] !== undefined) continue;
      if (patterns.some((p) => norm.includes(p))) mapping[field] = idx;
    }
  });
  return mapping;
}

export default function ImportWizard() {
  const { t } = useLanguage();
  const { loans, repayments } = useLocalData();
  const [kind, setKind] = useState<ImportKind>("loans");
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [loanMapResult, setLoanMapResult] = useState<MapResult | null>(null);
  const [paymentMapResult, setPaymentMapResult] =
    useState<PaymentMapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);

  const fields = kind === "loans" ? LOAN_FIELDS : PAYMENT_FIELDS;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_BYTES) {
      setError(t("import_fileTooLarge"));
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const result = parseSpreadsheetFile(buffer, file.name);
      if (result.rows.length > MAX_IMPORT_ROWS) {
        setError(
          `${t("import_tooManyRows")} (${result.rows.length} > ${MAX_IMPORT_ROWS})`
        );
        return;
      }
      setParsed(result);
      setFileName(file.name);
      setMapping(
        kind === "loans"
          ? guessLoanMapping(result.headers)
          : guessPaymentMapping(result.headers)
      );
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  function handleContinueToPreview() {
    if (!parsed) return;
    const requiredOk =
      kind === "loans"
        ? mapping.borrower_name !== undefined && mapping.principal !== undefined
        : mapping.borrower_name !== undefined && mapping.amount !== undefined;
    if (!requiredOk) {
      setError(t("import_needRequired"));
      return;
    }
    setError(null);

    if (kind === "loans") {
      setLoanMapResult(mapRows(parsed.rows, mapping));
      setPaymentMapResult(null);
    } else {
      setPaymentMapResult(
        mapPaymentRows(parsed.rows, mapping, loans, repayments)
      );
      setLoanMapResult(null);
    }
    setStep("preview");
  }

  async function handleConfirmImport() {
    setImporting(true);
    setError(null);

    if (kind === "loans" && loanMapResult) {
      const rows = loanMapResult.valid.map((loan) => ({
        borrower_name: loan.borrower_name,
        borrower_name_ta: loan.borrower_name_ta,
        principal: loan.principal,
        interest_rate: loan.interest_rate,
        payback_amount: paybackAmount(loan.principal, loan.interest_rate),
        installments_count: loan.installments_count,
        collection_schedule: loan.collection_schedule,
        given_at: loan.given_at,
        notes: loan.notes,
      }));
      const result = await createLoansBulkOffline(rows);
      setImporting(false);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setImported(result.count);
      setStep("done");
    } else if (kind === "payments" && paymentMapResult) {
      const rows = paymentMapResult.valid.map((p) => ({
        loan_id: p.loan_id,
        amount: p.amount,
        payment_mode: p.payment_mode,
        paid_at: p.paid_at,
      }));
      const result = await createRepaymentsBulkOffline(rows);
      setImporting(false);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setImported(result.count);
      setStep("done");
    } else {
      setImporting(false);
    }
  }

  function reset() {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setLoanMapResult(null);
    setPaymentMapResult(null);
    setError(null);
    setImported(0);
  }

  function switchKind(next: ImportKind) {
    setKind(next);
    reset();
  }

  function downloadSampleCsv() {
    const header =
      kind === "loans"
        ? "Name,Name (Tamil),Amount,Interest Rate,Installments,Schedule,Date Given,Notes"
        : "Name,Amount,Mode,Date Paid";
    const sample =
      kind === "loans"
        ? "Ramesh Kumar,,10000,25,10,Daily,2026-07-01,"
        : "Ramesh Kumar,500,Cash,2026-07-15";
    const csv = `${header}\n${sample}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanakku-book-${kind}-sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const validCount =
    kind === "loans"
      ? loanMapResult?.valid.length ?? 0
      : paymentMapResult?.valid.length ?? 0;
  const invalidRows =
    kind === "loans" ? loanMapResult?.invalid ?? [] : paymentMapResult?.invalid ?? [];

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-2xl text-ink mb-1">{t("import_title")}</h1>
      <p className="text-sm text-ink-soft mb-4">{t("import_subtitle")}</p>

      <div className="flex rounded-md border border-ledger-line overflow-hidden text-sm mb-6 w-fit">
        <button
          onClick={() => switchKind("loans")}
          className={`px-4 py-2 transition ${
            kind === "loans" ? "bg-forest text-white" : "bg-white text-ink-soft"
          }`}
        >
          {t("import_kindLoans")}
        </button>
        <button
          onClick={() => switchKind("payments")}
          className={`px-4 py-2 transition ${
            kind === "payments" ? "bg-forest text-white" : "bg-white text-ink-soft"
          }`}
        >
          {t("import_kindPayments")}
        </button>
      </div>

      {kind === "payments" && step === "upload" && (
        <p className="text-xs text-ink-soft mb-4 bg-brass-soft rounded-md px-3 py-2">
          {t("import_paymentsHint")}
        </p>
      )}

      {error && (
        <p className="text-sm text-rust mb-4 bg-rust-soft rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {step === "upload" && (
        <div className="rounded-lg border border-dashed border-ledger-line bg-white p-8 text-center">
          <p className="text-sm text-ink-soft mb-4">{t("import_uploadHint")}</p>
          <label className="inline-block rounded-md bg-forest text-white text-sm font-medium px-4 py-2 cursor-pointer hover:opacity-90">
            {t("import_chooseFile")}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          <div className="mt-3">
            <button
              onClick={downloadSampleCsv}
              className="text-xs text-ink-soft underline underline-offset-2"
            >
              {t("import_downloadSample")}
            </button>
          </div>
        </div>
      )}

      {step === "map" && parsed && (
        <div className="space-y-4">
          <p className="text-xs text-ink-soft">
            {fileName} · {parsed.rows.length} {t("import_rowsFound")}
          </p>
          <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
            {fields.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between px-4 py-3 gap-3"
              >
                <label className="text-sm text-ink">
                  {t(field.labelKey as TranslationKey)}
                  {field.required && <span className="text-rust"> *</span>}
                </label>
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [field.key]:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  className="rounded-md border border-ledger-line px-2 py-1.5 text-sm bg-white max-w-[55%]"
                >
                  <option value="">{t("import_notInFile")}</option>
                  {parsed.headers.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {header || `Column ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleContinueToPreview}
              className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              {t("import_continue")}
            </button>
            <button onClick={reset} className="text-sm text-ink-soft">
              {t("detail_cancel")}
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (loanMapResult || paymentMapResult) && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <p className="text-forest">
              {validCount} {t("import_readyToImport")}
            </p>
            {invalidRows.length > 0 && (
              <p className="text-rust">
                {invalidRows.length} {t("import_willBeSkipped")}
              </p>
            )}
          </div>

          {kind === "loans" && loanMapResult && loanMapResult.valid.length > 0 && (
            <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden max-h-80 overflow-y-auto">
              {loanMapResult.valid.slice(0, 10).map((loan, idx) => (
                <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-ink">{loan.borrower_name}</p>
                    <p className="text-xs text-ink-soft">
                      {loan.interest_rate}% · {loan.collection_schedule} ·{" "}
                      {new Date(loan.given_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="tabular text-ink">
                    {formatINR(loan.principal)}
                  </span>
                </div>
              ))}
              {loanMapResult.valid.length > 10 && (
                <p className="px-4 py-2 text-xs text-ink-soft italic">
                  +{loanMapResult.valid.length - 10} {t("import_more")}
                </p>
              )}
            </div>
          )}

          {kind === "payments" && paymentMapResult && paymentMapResult.valid.length > 0 && (
            <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden max-h-80 overflow-y-auto">
              {paymentMapResult.valid.slice(0, 10).map((p, idx) => (
                <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-ink">{p.borrower_name}</p>
                    <p className="text-xs text-ink-soft">
                      {new Date(p.paid_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="tabular text-forest">
                    +{formatINR(p.amount)}
                  </span>
                </div>
              ))}
              {paymentMapResult.valid.length > 10 && (
                <p className="px-4 py-2 text-xs text-ink-soft italic">
                  +{paymentMapResult.valid.length - 10} {t("import_more")}
                </p>
              )}
            </div>
          )}

          {invalidRows.length > 0 && (
            <div className="rounded-lg border border-rust-soft bg-rust-soft/40 px-3 py-2 max-h-40 overflow-y-auto">
              {invalidRows.slice(0, 5).map((inv, idx) => (
                <p key={idx} className="text-xs text-rust">
                  {inv.reason}
                </p>
              ))}
              {invalidRows.length > 5 && (
                <p className="text-xs text-rust italic">
                  +{invalidRows.length - 5} {t("import_more")}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirmImport}
              disabled={importing || validCount === 0}
              className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {importing
                ? t("import_importing")
                : `${t("import_confirm")} (${validCount})`}
            </button>
            <button onClick={() => setStep("map")} className="text-sm text-ink-soft">
              {t("import_backToMapping")}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-lg border border-ledger-line bg-white p-6 text-center space-y-3">
          <p className="text-forest text-lg">✓ {imported} {t("import_successCount")}</p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/borrowers"
              className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              {t("nav_borrowers")}
            </Link>
            <button onClick={reset} className="text-sm text-ink-soft">
              {t("import_another")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
