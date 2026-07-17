"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/calculations";
import { WEEKDAYS, type ScheduleGroup } from "@/lib/schedule";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";

export type BorrowerSummary = {
  name: string;
  totalGiven: number;
  outstanding: number;
  loanCount: number;
  schedule: string;
  group: ScheduleGroup;
};

const TABS: { key: ScheduleGroup; labelKey: TranslationKey }[] = [
  { key: "daily", labelKey: "borrowers_tabDaily" },
  { key: "weekly", labelKey: "borrowers_tabWeekly" },
  { key: "monthly", labelKey: "borrowers_tabMonthly" },
];

export default function BorrowersClient({
  borrowers,
}: {
  borrowers: BorrowerSummary[];
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ScheduleGroup>("daily");
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<ScheduleGroup, number> = { daily: 0, weekly: 0, monthly: 0 };
    for (const b of borrowers) c[b.group]++;
    return c;
  }, [borrowers]);

  const dayCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const b of borrowers) {
      if (b.group === "weekly") c.set(b.schedule, (c.get(b.schedule) ?? 0) + 1);
    }
    return c;
  }, [borrowers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return borrowers.filter((b) => {
      if (b.group !== activeTab) return false;
      if (activeTab === "weekly" && activeDay && b.schedule !== activeDay) {
        return false;
      }
      if (!q) return true;
      // Plain substring match works for both English and Tamil script.
      return b.name.toLowerCase().includes(q);
    });
  }, [borrowers, activeTab, activeDay, query]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-2xl text-ink">{t("borrowers_title")}</h1>
        <Link
          href="/borrowers/new"
          className="rounded-md bg-forest text-white px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          {t("nav_newLoan")}
        </Link>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("borrowers_searchPlaceholder")}
        className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-forest bg-white"
      />

      <div className="flex rounded-md border border-ledger-line overflow-hidden text-sm mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setActiveDay(null);
            }}
            className={`flex-1 px-3 py-2 transition ${
              activeTab === tab.key
                ? "bg-forest text-white"
                : "bg-white text-ink-soft hover:bg-paper"
            }`}
          >
            {t(tab.labelKey)}
            <span className="ml-1 opacity-70">({counts[tab.key]})</span>
          </button>
        ))}
      </div>

      {activeTab === "weekly" && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setActiveDay(null)}
            className={`rounded-full px-3 py-1 text-xs border ${
              activeDay === null
                ? "bg-brass text-white border-brass"
                : "border-ledger-line text-ink-soft bg-white"
            }`}
          >
            {t("borrowers_allDays")}
          </button>
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`rounded-full px-3 py-1 text-xs border ${
                activeDay === day
                  ? "bg-brass text-white border-brass"
                  : "border-ledger-line text-ink-soft bg-white"
              }`}
            >
              {t(`schedule_${day}` as TranslationKey)}
              <span className="ml-1 opacity-70">
                ({dayCounts.get(day) ?? 0})
              </span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ledger-line p-8 text-center">
          <p className="text-sm text-ink-soft">
            {borrowers.length === 0
              ? t("borrowers_empty")
              : t("borrowers_emptySearch")}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
          {filtered.map((b) => (
            <Link
              key={b.name}
              href={`/borrowers/${encodeURIComponent(b.name)}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-paper transition"
            >
              <div>
                <p className="text-sm text-ink font-medium">{b.name}</p>
                <p className="text-xs text-ink-soft">
                  {b.loanCount} {t(b.loanCount > 1 ? "borrowers_loans" : "borrowers_loan")} ·{" "}
                  {t("borrowers_given")} {formatINR(b.totalGiven)}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`tabular text-sm ${
                    b.outstanding > 0 ? "text-rust" : "text-forest"
                  }`}
                >
                  {b.outstanding > 0
                    ? `${formatINR(b.outstanding)} ${t("borrowers_due")}`
                    : t("borrowers_settled")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
