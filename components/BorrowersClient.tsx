"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dateKey, formatINR } from "@/lib/calculations";
import { WEEKDAYS, scheduleGroup, type ScheduleGroup } from "@/lib/schedule";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import { useLocalData } from "@/lib/offline/useLocalData";
import { findDelayedLoans, delayedLoanIdSet } from "@/lib/delayed";

type LoanEntry = {
  loanId: string;
  name: string;
  nameTa: string | null;
  principal: number;
  outstanding: number;
  dateKey: string;
  givenAt: string;
  schedule: string;
  group: ScheduleGroup;
};

const TABS: { key: ScheduleGroup; labelKey: TranslationKey }[] = [
  { key: "daily", labelKey: "borrowers_tabDaily" },
  { key: "weekly", labelKey: "borrowers_tabWeekly" },
  { key: "monthly", labelKey: "borrowers_tabMonthly" },
];

export default function BorrowersClient() {
  const { lang, t } = useLanguage();
  const { loans, repayments, settings, loading } = useLocalData();
  const [activeTab, setActiveTab] = useState<ScheduleGroup>("daily");
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const locale = lang === "ta" ? "ta-IN" : "en-IN";

  const entries: LoanEntry[] = useMemo(() => {
    const paidByLoanId = new Map<string, number>();
    for (const r of repayments) {
      paidByLoanId.set(
        r.loan_id,
        (paidByLoanId.get(r.loan_id) ?? 0) + Number(r.amount)
      );
    }

    // Loans past their allowed window live in the Delayed tab instead, so a
    // borrower shows in exactly one list at a time. They return here
    // automatically once the loan is settled or a new one is started.
    const delayedIds = delayedLoanIdSet(
      findDelayedLoans(loans, paidByLoanId, settings)
    );

    return loans
      .filter((l) => !delayedIds.has(l.id))
      .map((l) => ({
        loanId: l.id,
        name: l.borrower_name,
        nameTa: l.borrower_name_ta,
        principal: Number(l.principal),
        outstanding:
          Number(l.payback_amount) - (paidByLoanId.get(l.id) ?? 0),
        dateKey: dateKey(l.given_at),
        givenAt: l.given_at,
        schedule: l.collection_schedule,
        group: scheduleGroup(l.collection_schedule),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [loans, repayments, settings]);

  const counts = useMemo(() => {
    const c: Record<ScheduleGroup, number> = { daily: 0, weekly: 0, monthly: 0 };
    for (const e of entries) c[e.group]++;
    return c;
  }, [entries]);

  const dayCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of entries) {
      if (e.group === "weekly") c.set(e.schedule, (c.get(e.schedule) ?? 0) + 1);
    }
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (e.group !== activeTab) return false;
      if (activeTab === "weekly" && activeDay && e.schedule !== activeDay) {
        return false;
      }
      if (!q) return true;
      // Plain substring match works for both English and Tamil script.
      return (
        e.name.toLowerCase().includes(q) ||
        (e.nameTa ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, activeTab, activeDay, query]);

  // Group into date sections, most recent date first — applies within
  // whichever tab (and, for Weekly, whichever day) is currently active.
  const dateSections = useMemo(() => {
    const map = new Map<string, LoanEntry[]>();
    for (const e of filtered) {
      const list = map.get(e.dateKey) ?? [];
      list.push(e);
      map.set(e.dateKey, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  if (loading) return null;

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

      {dateSections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ledger-line p-8 text-center">
          <p className="text-sm text-ink-soft">
            {entries.length === 0
              ? t("borrowers_empty")
              : t("borrowers_emptySearch")}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {dateSections.map(([date, dayEntries]) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-ink-soft mb-2">
                {new Date(date).toLocaleDateString(locale, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </h2>
              <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
                {dayEntries.map((e) => (
                  <Link
                    key={e.loanId}
                    href={`/borrowers/${encodeURIComponent(e.name)}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-paper transition"
                  >
                    <div>
                      <p className="text-sm text-ink font-medium">
                        {e.name}
                        {e.nameTa && (
                          <span className="text-ink-soft font-normal"> · {e.nameTa}</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {t("borrowers_given")} {formatINR(e.principal)}
                      </p>
                    </div>
                    <p
                      className={`tabular text-sm ${
                        e.outstanding > 0 ? "text-rust" : "text-forest"
                      }`}
                    >
                      {e.outstanding > 0
                        ? `${formatINR(e.outstanding)} ${t("borrowers_due")}`
                        : t("borrowers_settled")}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
