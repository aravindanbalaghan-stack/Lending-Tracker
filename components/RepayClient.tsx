"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/calculations";
import { scheduleGroup, WEEKDAYS } from "@/lib/schedule";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import RepaymentQuickForm from "@/components/RepaymentQuickForm";

export type RepayLoan = {
  id: string;
  borrower_name: string;
  outstanding: number;
  collection_schedule: string;
  given_at: string;
};

export default function RepayClient({ loans }: { loans: RepayLoan[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openLoanId, setOpenLoanId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return loans;
    return loans.filter((l) => l.borrower_name.toLowerCase().includes(q));
  }, [loans, query]);

  // Segregate: Daily section, one section per weekday (Weekly), Monthly section.
  const sections = useMemo(() => {
    const daily = filtered.filter(
      (l) => scheduleGroup(l.collection_schedule) === "daily"
    );
    const monthly = filtered.filter(
      (l) => scheduleGroup(l.collection_schedule) === "monthly"
    );
    const weeklyByDay = WEEKDAYS.map((day) => ({
      day,
      items: filtered.filter((l) => l.collection_schedule === day),
    })).filter((g) => g.items.length > 0);

    return { daily, weeklyByDay, monthly };
  }, [filtered]);

  const hasResults =
    sections.daily.length > 0 ||
    sections.weeklyByDay.length > 0 ||
    sections.monthly.length > 0;

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">{t("repay_title")}</h1>
      <p className="text-sm text-ink-soft mb-4">{t("repay_subtitle")}</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("borrowers_searchPlaceholder")}
        className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-forest bg-white"
        autoFocus
      />

      {!hasResults ? (
        <div className="rounded-lg border border-dashed border-ledger-line p-8 text-center">
          <p className="text-sm text-ink-soft">
            {loans.length === 0 ? t("repay_empty") : t("borrowers_emptySearch")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.daily.length > 0 && (
            <ResultGroup
              title={t("borrowers_tabDaily")}
              items={sections.daily}
              openLoanId={openLoanId}
              setOpenLoanId={setOpenLoanId}
              onSaved={() => {
                setOpenLoanId(null);
                router.refresh();
              }}
              t={t}
            />
          )}
          {sections.weeklyByDay.map(({ day, items }) => (
            <ResultGroup
              key={day}
              title={t(`schedule_${day}` as TranslationKey)}
              items={items}
              openLoanId={openLoanId}
              setOpenLoanId={setOpenLoanId}
              onSaved={() => {
                setOpenLoanId(null);
                router.refresh();
              }}
              t={t}
            />
          ))}
          {sections.monthly.length > 0 && (
            <ResultGroup
              title={t("borrowers_tabMonthly")}
              items={sections.monthly}
              openLoanId={openLoanId}
              setOpenLoanId={setOpenLoanId}
              onSaved={() => {
                setOpenLoanId(null);
                router.refresh();
              }}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  items,
  openLoanId,
  setOpenLoanId,
  onSaved,
  t,
}: {
  title: string;
  items: RepayLoan[];
  openLoanId: string | null;
  setOpenLoanId: (id: string | null) => void;
  onSaved: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-ink-soft mb-2">
        {title} ({items.length})
      </h2>
      <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
        {items.map((loan) => (
          <div key={loan.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink font-medium">
                {loan.borrower_name}
              </p>
              <div className="text-right">
                <p className="tabular text-sm text-rust">
                  {formatINR(loan.outstanding)}
                </p>
                <button
                  onClick={() =>
                    setOpenLoanId(openLoanId === loan.id ? null : loan.id)
                  }
                  className="text-xs text-forest font-medium underline underline-offset-2"
                >
                  {t("repay_action")}
                </button>
              </div>
            </div>
            {openLoanId === loan.id && (
              <div className="mt-3">
                <RepaymentQuickForm
                  loanId={loan.id}
                  onSaved={onSaved}
                  onCancel={() => setOpenLoanId(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
