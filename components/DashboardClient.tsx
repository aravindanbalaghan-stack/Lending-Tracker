"use client";

import { useMemo, useState } from "react";
import { dateKey, formatINR, last15Days } from "@/lib/calculations";
import { useLanguage } from "@/components/LanguageProvider";

export type RepaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  borrower_name: string;
};

export default function DashboardClient({ rows }: { rows: RepaymentRow[] }) {
  const { lang, t } = useLanguage();
  const days = useMemo(() => last15Days(), []);
  const [selected, setSelected] = useState<string>(days[0]);
  const [rangeDays, setRangeDays] = useState<7 | 15>(15);

  const locale = lang === "ta" ? "ta-IN" : "en-IN";

  const byDay = useMemo(() => {
    const map = new Map<string, RepaymentRow[]>();
    for (const day of days) map.set(day, []);
    for (const r of rows) {
      const key = dateKey(r.paid_at);
      if (map.has(key)) map.get(key)!.push(r);
    }
    return map;
  }, [rows, days]);

  const visibleDays = days.slice(0, rangeDays);
  const todayTotal = (byDay.get(days[0]) ?? []).reduce(
    (s, r) => s + r.amount,
    0
  );
  const selectedRows = byDay.get(selected) ?? [];
  const selectedTotal = selectedRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-ink mb-1">
          {t("dashboard_title")}
        </h1>
        <p className="text-sm text-ink-soft">{t("dashboard_subtitle")}</p>
      </div>

      <div className="rounded-lg bg-forest text-white p-5">
        <p className="text-xs uppercase tracking-wide text-forest-soft/80">
          {t("dashboard_receivedToday")}
        </p>
        <p className="tabular text-3xl mt-1">{formatINR(todayTotal)}</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-soft">
          {t("dashboard_dailyTotals")}
        </h2>
        <div className="flex rounded-md border border-ledger-line overflow-hidden text-xs">
          <button
            onClick={() => setRangeDays(7)}
            className={`px-3 py-1.5 ${
              rangeDays === 7 ? "bg-forest text-white" : "bg-white text-ink-soft"
            }`}
          >
            {t("dashboard_7days")}
          </button>
          <button
            onClick={() => setRangeDays(15)}
            className={`px-3 py-1.5 ${
              rangeDays === 15 ? "bg-forest text-white" : "bg-white text-ink-soft"
            }`}
          >
            {t("dashboard_15days")}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
        {visibleDays.map((day) => {
          const dayRows = byDay.get(day) ?? [];
          const total = dayRows.reduce((s, r) => s + r.amount, 0);
          const isSelected = day === selected;
          const label = new Date(day).toLocaleDateString(locale, {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          return (
            <button
              key={day}
              onClick={() => setSelected(day)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${
                isSelected ? "bg-brass-soft" : "hover:bg-paper"
              }`}
            >
              <span className="text-sm text-ink">
                {label}
                {day === days[0] && (
                  <span className="ml-2 text-xs text-forest">
                    {t("dashboard_today")}
                  </span>
                )}
              </span>
              <span className="tabular text-sm text-ink">
                {total > 0 ? formatINR(total) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="text-sm font-medium text-ink-soft mb-2">
          {new Date(selected).toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          <span className="tabular text-ink">— {formatINR(selectedTotal)}</span>
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
                  <p className="text-sm text-ink">{r.borrower_name}</p>
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
    </div>
  );
}
