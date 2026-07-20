"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dateKey, formatINR } from "@/lib/calculations";
import { computeDaySummary } from "@/lib/dailyDetails";
import { useLanguage } from "@/components/LanguageProvider";
import { useLocalData } from "@/lib/offline/useLocalData";
import MiniCalendar from "@/components/MiniCalendar";
import DailyDetailsCard from "@/components/DailyDetailsCard";

type RepaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  borrower_name: string;
  borrower_name_ta: string | null;
};

export default function DashboardClient() {
  const { lang, t } = useLanguage();
  const { loans, repayments, dailyEntries, settings, loading } = useLocalData();
  const [selected, setSelected] = useState<string>(() => dateKey(new Date()));

  const locale = lang === "ta" ? "ta-IN" : "en-IN";

  const rows: RepaymentRow[] = useMemo(() => {
    const nameByLoanId = new Map(loans.map((l) => [l.id, l.borrower_name]));
    const nameTaByLoanId = new Map(loans.map((l) => [l.id, l.borrower_name_ta]));
    return repayments.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      paid_at: r.paid_at,
      borrower_name: nameByLoanId.get(r.loan_id) ?? "Unknown",
      borrower_name_ta: nameTaByLoanId.get(r.loan_id) ?? null,
    }));
  }, [loans, repayments]);

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(dateKey(r.paid_at));
    for (const l of loans) set.add(dateKey(l.given_at));
    return set;
  }, [rows, loans]);

  const selectedRows = useMemo(
    () => rows.filter((r) => dateKey(r.paid_at) === selected),
    [rows, selected]
  );
  const selectedTotal = selectedRows.reduce((s, r) => s + r.amount, 0);

  const entryForSelected = useMemo(
    () => dailyEntries.find((e) => e.entry_date === selected),
    [dailyEntries, selected]
  );

  const summary = useMemo(
    () =>
      computeDaySummary(
        selected,
        loans,
        repayments,
        settings,
        settings.mamai_rate,
        entryForSelected?.opening_balance ?? 0,
        entryForSelected?.expenses ?? 0
      ),
    [selected, loans, repayments, settings, entryForSelected]
  );

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-ink mb-1">
          {t("dashboard_title")}
        </h1>
        <p className="text-sm text-ink-soft">{t("dashboard_subtitle")}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:items-start">
        <div className="flex-1 order-2 md:order-1">
          <h2 className="text-sm font-medium text-ink-soft mb-2">
            {new Date(selected).toLocaleDateString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            <span className="tabular text-ink">
              — {formatINR(selectedTotal)}
            </span>
          </h2>
          {selectedRows.length === 0 ? (
            <p className="text-sm text-ink-soft italic">
              {t("dashboard_noRepayments")}
            </p>
          ) : (
            <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
              {selectedRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/borrowers/${encodeURIComponent(r.borrower_name)}`}
                      className="text-sm text-ink hover:text-forest hover:underline underline-offset-2"
                    >
                      {r.borrower_name}
                      {r.borrower_name_ta && (
                        <span className="text-ink-soft"> · {r.borrower_name_ta}</span>
                      )}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {new Date(r.paid_at).toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="tabular text-sm text-forest">
                    +{formatINR(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 md:order-2 md:ml-auto">
          <MiniCalendar
            selected={selected}
            onSelect={setSelected}
            markedDates={markedDates}
          />
        </div>
      </div>

      <DailyDetailsCard
        key={selected}
        date={selected}
        summary={summary}
        settings={settings}
      />
    </div>
  );
}
