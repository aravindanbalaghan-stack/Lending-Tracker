"use client";

import { useState } from "react";
import Link from "next/link";
import { createLoansBulkOffline } from "@/lib/offline/actions";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import {
  parseSpreadsheetFile,
  mapRows,
  SYSTEM_FIELDS,
  type ParsedFile,
  type FieldMapping,
  type MapResult,
  type SystemFieldKey,
} from "@/lib/import";
import { formatINR, paybackAmount } from "@/lib/calculations";

type Step = "upload" | "map" | "preview" | "done";

const MAX_IMPORT_ROWS = 5000;

function guessMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const guesses: Record<SystemFieldKey, string[]> = {
    borrower_name: ["name", "borrowername", "customer", "customername", "borrower"],
    principal: ["amount", "principal", "amountgiven", "loanamount", "given"],
    interest_rate: ["interest", "interestrate", "rate"],
    installments_count: ["installments", "installment", "emi", "noofinstallments"],
    collection_schedule: ["schedule", "frequency", "collectionday", "day"],
    given_at: ["date", "dategiven", "loandate", "givenon"],
    notes: ["notes", "note", "remarks", "comment", "purpose"],
  };

  headers.forEach((header, idx) => {
    const norm = normalize(header);
    for (const [field, patterns] of Object.entries(guesses) as [
      SystemFieldKey,
      string[]
    ][]) {
      if (mapping[field] !== undefined) continue;
      if (patterns.some((p) => norm.includes(p))) {
        mapping[field] = idx;
      }
    }
  });

  return mapping;
}

export default function ImportWizard() {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [mapResult, setMapResult] = useState<MapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);

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
      setMapping(guessMapping(result.headers));
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  function handleContinueToPreview() {
    if (!parsed) return;
    if (mapping.borrower_name === undefined || mapping.principal === undefined) {
      setError(t("import_needRequired"));
      return;
    }
    setError(null);
    const result = mapRows(parsed.rows, mapping);
    setMapResult(result);
    setStep("preview");
  }

  async function handleConfirmImport() {
    if (!mapResult || mapResult.valid.length === 0) return;
    setImporting(true);
    setError(null);

    const rows = mapResult.valid.map((loan) => ({
      borrower_name: loan.borrower_name,
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
  }

  function reset() {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setMapResult(null);
    setError(null);
    setImported(0);
  }

  function downloadSampleCsv() {
    const header = "Name,Amount,Interest Rate,Installments,Schedule,Date Given,Notes";
    const sample = "Ramesh Kumar,10000,25,1,Daily,2026-07-01,";
    const csv = `${header}\n${sample}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kanakku-book-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-2xl text-ink mb-1">{t("import_title")}</h1>
      <p className="text-sm text-ink-soft mb-6">{t("import_subtitle")}</p>

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
            {SYSTEM_FIELDS.map((field) => (
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

      {step === "preview" && mapResult && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <p className="text-forest">
              {mapResult.valid.length} {t("import_readyToImport")}
            </p>
            {mapResult.invalid.length > 0 && (
              <p className="text-rust">
                {mapResult.invalid.length} {t("import_willBeSkipped")}
              </p>
            )}
          </div>

          {mapResult.valid.length > 0 && (
            <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden max-h-80 overflow-y-auto">
              {mapResult.valid.slice(0, 10).map((loan, idx) => (
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
              {mapResult.valid.length > 10 && (
                <p className="px-4 py-2 text-xs text-ink-soft italic">
                  +{mapResult.valid.length - 10} {t("import_more")}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirmImport}
              disabled={importing || mapResult.valid.length === 0}
              className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {importing
                ? t("import_importing")
                : `${t("import_confirm")} (${mapResult.valid.length})`}
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
