"use client";

import { loansToCsv, loansToJson, downloadTextFile, type BackupLoan } from "@/lib/export";
import { useLanguage } from "@/components/LanguageProvider";

export default function BackupClient({ loans }: { loans: BackupLoan[] }) {
  const { t } = useLanguage();

  function handleCsv() {
    const csv = loansToCsv(loans);
    downloadTextFile(
      `kanakku-book-backup-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv"
    );
  }

  function handleJson() {
    const json = loansToJson(loans);
    downloadTextFile(
      `kanakku-book-backup-${new Date().toISOString().slice(0, 10)}.json`,
      json,
      "application/json"
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-2xl text-ink mb-1">{t("backup_title")}</h1>
      <p className="text-sm text-ink-soft mb-6">{t("backup_subtitle")}</p>

      <div className="rounded-lg border border-ledger-line bg-white p-6 space-y-4">
        <p className="text-sm text-ink-soft">
          {loans.length} {t("backup_loanCount")}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCsv}
            disabled={loans.length === 0}
            className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {t("backup_downloadCsv")}
          </button>
          <button
            onClick={handleJson}
            disabled={loans.length === 0}
            className="rounded-md border border-ledger-line text-ink text-sm font-medium px-4 py-2 hover:bg-paper disabled:opacity-50"
          >
            {t("backup_downloadJson")}
          </button>
        </div>

        <p className="text-xs text-ink-soft">{t("backup_hint")}</p>
      </div>
    </div>
  );
}
