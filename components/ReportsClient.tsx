"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/calculations";
import { useLocalData } from "@/lib/offline/useLocalData";
import { useLanguage } from "@/components/LanguageProvider";
import { SkeletonList } from "@/components/Skeletons";
import {
  computeSummary,
  dailyCollections,
  monthlyCollections,
  topRisks,
} from "@/lib/reports";

export default function ReportsClient() {
  const { t } = useLanguage();
  const { loans, repayments, loading } = useLocalData();
  const [trendMode, setTrendMode] = useState<"daily" | "monthly">("daily");

  const reportLoans = useMemo(
    () =>
      loans.map((l) => ({
        id: l.id,
        borrower_name: l.borrower_name,
        principal: Number(l.principal),
        interest_rate: Number(l.interest_rate),
        payback_amount: Number(l.payback_amount),
        given_at: l.given_at,
        collection_schedule: l.collection_schedule,
      })),
    [loans]
  );
  const reportReps = useMemo(
    () =>
      repayments.map((r) => ({
        loan_id: r.loan_id,
        amount: Number(r.amount),
        paid_at: r.paid_at,
      })),
    [repayments]
  );

  const summary = useMemo(
    () => computeSummary(reportLoans, reportReps),
    [reportLoans, reportReps]
  );
  const daily = useMemo(
    () => dailyCollections(reportReps, 14),
    [reportReps]
  );
  const monthly = useMemo(
    () => monthlyCollections(reportReps, 6),
    [reportReps]
  );
  const risks = useMemo(
    () => topRisks(reportLoans, reportReps, 5),
    [reportLoans, reportReps]
  );

  if (loading) return <SkeletonList rows={6} />;

  const monthDelta = summary.collectedThisMonth - summary.collectedLastMonth;
  const trend: { label: string; total: number }[] =
    trendMode === "daily"
      ? daily.map((d) => ({ label: d.date.slice(8), total: d.total }))
      : monthly.map((m) => ({ label: m.month.slice(5), total: m.total }));
  const maxTrend = Math.max(1, ...trend.map((d) => d.total));

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="hidden md:block">
        <h1 className="font-serif text-2xl text-ink mb-1">
          {t("reports_title")}
        </h1>
        <p className="text-sm text-ink-soft">{t("reports_subtitle")}</p>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3">
        <Metric
          label={t("reports_onStreet")}
          value={formatINR(summary.totalOutstanding)}
          tone="rust"
          hint={`${summary.activeLoans} ${t("reports_activeLoans")}`}
        />
        <Metric
          label={t("reports_collectedMonth")}
          value={formatINR(summary.collectedThisMonth)}
          tone="forest"
          hint={
            monthDelta >= 0
              ? `▲ ${formatINR(monthDelta)} ${t("reports_vsLastMonth")}`
              : `▼ ${formatINR(Math.abs(monthDelta))} ${t("reports_vsLastMonth")}`
          }
        />
        <Metric
          label={t("reports_expectedProfit")}
          value={formatINR(summary.expectedProfitOpen)}
          tone="brass"
          hint={t("reports_expectedProfitHint")}
        />
        <Metric
          label={t("reports_lentMonth")}
          value={formatINR(summary.lentThisMonth)}
          tone="ink"
          hint={`${t("reports_totalLent")} ${formatINR(summary.totalLent)}`}
        />
      </div>

      {/* Collections trend */}
      <div className="rounded-xl border border-ledger-line bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wide text-ink-soft">
            {t("reports_collectionsTrend")}
          </p>
          <div className="flex rounded-md border border-ledger-line overflow-hidden text-xs">
            <button
              onClick={() => setTrendMode("daily")}
              className={`px-2.5 py-1 ${
                trendMode === "daily"
                  ? "bg-forest text-white"
                  : "text-ink-soft"
              }`}
            >
              {t("reports_daily")}
            </button>
            <button
              onClick={() => setTrendMode("monthly")}
              className={`px-2.5 py-1 ${
                trendMode === "monthly"
                  ? "bg-forest text-white"
                  : "text-ink-soft"
              }`}
            >
              {t("reports_monthly")}
            </button>
          </div>
        </div>
        <div className="flex items-end gap-1 h-32">
          {trend.map((d, i) => {
            const h = Math.round((d.total / maxTrend) * 100);
            const label = d.label;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full"
                title={`${label}: ${formatINR(d.total)}`}
              >
                <div
                  className="w-full rounded-t bg-forest/80"
                  style={{ height: `${Math.max(2, h)}%` }}
                />
                <span className="text-[9px] text-ink-soft mt-1">{label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-soft mt-2 text-right">
          {t("reports_totalCollected")}: {formatINR(summary.totalCollected)}
        </p>
      </div>

      {/* Follow-up list */}
      <div className="rounded-xl border border-ledger-line bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-3">
          {t("reports_followUp")}
        </p>
        {risks.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("reports_allCaughtUp")}</p>
        ) : (
          <div className="divide-y divide-ledger-line">
            {risks.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink font-medium break-words">
                    {r.name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {r.lastPaidDaysAgo == null
                      ? t("reports_neverPaid")
                      : `${t("reports_lastPaid")} ${r.lastPaidDaysAgo} ${t(
                          "reports_daysAgo"
                        )}`}
                  </p>
                </div>
                <p className="tabular text-sm text-rust shrink-0 ml-2">
                  {formatINR(r.outstanding)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-ink-soft leading-relaxed">
        {t("reports_note")}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "rust" | "forest" | "brass" | "ink";
  hint?: string;
}) {
  const toneClass =
    tone === "rust"
      ? "text-rust"
      : tone === "forest"
        ? "text-forest"
        : tone === "brass"
          ? "text-brass"
          : "text-ink";
  return (
    <div className="rounded-xl border border-ledger-line bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-soft">
        {label}
      </p>
      <p className={`tabular text-xl font-semibold mt-1 ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-ink-soft mt-1">{hint}</p>}
    </div>
  );
}
