"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dateKey, formatINR } from "@/lib/calculations";
import { computeDaySummary } from "@/lib/dailyDetails";
import { useLanguage } from "@/components/LanguageProvider";
import { useLocalData } from "@/lib/offline/useLocalData";
import { SkeletonDashboard } from "@/components/Skeletons";
import MiniCalendar from "@/components/MiniCalendar";
import MobileDatePicker from "@/components/MobileDatePicker";
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
  const { loans, repayments, dailyEntries, settings, loading } =
    useLocalData();
  const [selected, setSelected] = useState<string>(() => dateKey(new Date()));

  const locale = lang === "ta" ? "ta-IN" : "en-IN";

  const rows: RepaymentRow[] = useMemo(() => {
    const nameByLoanId = new Map(loans.map((l) => [l.id, l.borrower_name]));
    const nameTaByLoanId = new Map(loans.map((l) => [l.id, l.borrower_name_ta]));
    // Repayments belonging to deleted loans shouldn't appear on the dashboard
    // at all (the loan is hidden everywhere else too) — filtering by whether
    // the loan is in the active set also removes the old "Unknown" rows.
    const activeLoanIds = new Set(loans.map((l) => l.id));
    return repayments
      .filter((r) => activeLoanIds.has(r.loan_id))
      .map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        paid_at: r.paid_at,
        borrower_name: nameByLoanId.get(r.loan_id) ?? "",
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

  // Loans handed out on the selected date — shown as its own section under
  // the repayments, so a day's money-in and money-out are both visible.
  const selectedLoans = useMemo(
    () => loans.filter((l) => dateKey(l.given_at) === selected),
    [loans, selected]
  );
  const selectedLoansTotal = selectedLoans.reduce(
    (s, l) => s + Number(l.principal),
    0
  );

  const entryForSelected = useMemo(
    () => dailyEntries.find((e) => e.entry_date === selected),
    [dailyEntries, selected]
  );

  // Headline figures for the summary card: money collected today, and the
  // total still owed across all active loans. Always "today" (IST), not the
  // selected date, so it's a stable daily snapshot.
  const todayKey = dateKey(new Date());
  const collectedToday = useMemo(
    () =>
      rows
        .filter((r) => dateKey(r.paid_at) === todayKey)
        .reduce((s, r) => s + r.amount, 0),
    [rows, todayKey]
  );

  // Only repayments whose loan is still active feed the daily cash summary,
  // so a deleted loan's money is removed from the totals consistently (rather
  // than counting in vasool but not nadapu varavu).
  const activeRepayments = useMemo(() => {
    const activeLoanIds = new Set(loans.map((l) => l.id));
    return repayments.filter((r) => activeLoanIds.has(r.loan_id));
  }, [loans, repayments]);

  const summary = useMemo(
    () =>
      computeDaySummary(
        selected,
        loans,
        activeRepayments,
        settings,
        settings.mamai_rate,
        entryForSelected?.opening_balance ?? 0,
        entryForSelected?.expenses ?? 0
      ),
    [selected, loans, activeRepayments, settings, entryForSelected]
  );

  if (loading)
    return (
      <SkeletonDashboard />
    );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="hidden md:block">
        <h1 className="font-serif text-2xl text-ink mb-1">
          {t("dashboard_title")}
        </h1>
        <p className="text-sm text-ink-soft">{t("dashboard_subtitle")}</p>
      </div>

      {/* Daily snapshot — the number a lender checks each morning. */}
      <div>
        <div className="rounded-xl bg-forest text-white p-4">
          <p className="text-[11px] uppercase tracking-wide text-white/70">
            {t("summary_collectedToday")}
          </p>
          <p className="tabular text-2xl font-semibold mt-1">
            {formatINR(collectedToday)}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
        <div className="flex-1 order-2 md:order-1">
          <h2 className="text-sm font-medium text-ink-soft mb-2">
            <span className="hidden md:inline">
              {new Date(selected).toLocaleDateString(locale, {
                timeZone: "Asia/Kolkata",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
            </span>
            <span className="tabular text-ink">
              <span className="md:hidden">{t("dashboard_dayTotal")} </span>
              <span className="hidden md:inline">— </span>
              {formatINR(selectedTotal)}
            </span>
          </h2>

          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft mb-1.5">
            <span className="hidden md:inline">
              {t("dashboard_sectionRepayments")}{" "}
            </span>
            <span className="tabular normal-case text-forest">
              {formatINR(selectedTotal)}
            </span>
          </h3>
          {selectedRows.length === 0 ? (
            <p className="text-sm text-ink-soft italic mb-5">
              {t("dashboard_noRepayments")}
            </p>
          ) : (
            <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden mb-5">
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
                      timeZone: "Asia/Kolkata",
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

          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft mb-1.5">
            <span className="hidden md:inline">
              {t("dashboard_sectionNewLoans")}{" "}
            </span>
            <span className="tabular normal-case text-rust">
              {formatINR(selectedLoansTotal)}
            </span>
          </h3>
          {selectedLoans.length === 0 ? (
            <p className="text-sm text-ink-soft italic">
              {t("dashboard_noNewLoans")}
            </p>
          ) : (
            <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
              {selectedLoans.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/borrowers/${encodeURIComponent(l.borrower_name)}`}
                      className="text-sm text-ink hover:text-forest hover:underline underline-offset-2"
                    >
                      {l.borrower_name}
                      {l.borrower_name_ta && (
                        <span className="text-ink-soft"> · {l.borrower_name_ta}</span>
                      )}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {l.interest_rate}% · {l.installments_count}× ·{" "}
                      {l.collection_schedule}
                    </p>
                  </div>
                  <span className="tabular text-sm text-rust">
                    −{formatINR(Number(l.principal))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 md:order-2 md:ml-auto">
          {/* Desktop: full calendar. Mobile: compact D/M/Y pickers. */}
          <div className="hidden md:block">
            <MiniCalendar
              selected={selected}
              onSelect={setSelected}
              markedDates={markedDates}
            />
          </div>
          <div className="md:hidden">
            <MobileDatePicker selected={selected} onSelect={setSelected} />
          </div>
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
