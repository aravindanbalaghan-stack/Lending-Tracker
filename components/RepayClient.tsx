"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/calculations";
import { scheduleGroup, WEEKDAYS } from "@/lib/schedule";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";
import RepaymentQuickForm from "@/components/RepaymentQuickForm";
import RenewLoanPrompt from "@/components/RenewLoanPrompt";
import { useLocalData } from "@/lib/offline/useLocalData";
import { SkeletonList } from "@/components/Skeletons";
import { reorderLoansOffline } from "@/lib/offline/actions";

type RepayLoan = {
  id: string;
  borrower_name: string;
  borrower_name_ta: string | null;
  outstanding: number;
  collection_schedule: string;
  given_at: string;
  displayOrder: number;
};

export default function RepayClient() {
  const { t } = useLanguage();
  const { loans: allLoans, repayments: allRepayments, loading } =
    useLocalData();
  const [query, setQuery] = useState("");
  const [openLoanId, setOpenLoanId] = useState<string | null>(null);
  // When a payment settles a loan, we stash its id here to show a "start new
  // loan?" prompt for that borrower.
  const [settledLoanId, setSettledLoanId] = useState<string | null>(null);
  // Filter by collection schedule: "all", "Daily", "Monthly", or a weekday.
  const [scheduleFilter, setScheduleFilter] = useState<string>("all");

  const settledLoanRecord = useMemo(
    () => allLoans.find((l) => l.id === settledLoanId) ?? null,
    [allLoans, settledLoanId]
  );

  const loans: RepayLoan[] = useMemo(() => {
    const paidByLoanId = new Map<string, number>();
    for (const r of allRepayments) {
      paidByLoanId.set(
        r.loan_id,
        (paidByLoanId.get(r.loan_id) ?? 0) + Number(r.amount)
      );
    }
    return allLoans
      .map((l) => ({
        id: l.id,
        borrower_name: l.borrower_name,
        borrower_name_ta: l.borrower_name_ta,
        outstanding: Number(l.payback_amount) - (paidByLoanId.get(l.id) ?? 0),
        collection_schedule: l.collection_schedule,
        given_at: l.given_at,
        displayOrder: l.repay_display_order ?? 0,
      }))
      .filter((l) => l.outstanding > 0)
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          a.borrower_name.localeCompare(b.borrower_name)
      );
  }, [allLoans, allRepayments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans.filter((l) => {
      // Schedule filter: "all" shows everything; otherwise match the exact
      // schedule tag (Daily / Monthly / a specific weekday).
      if (scheduleFilter !== "all" && l.collection_schedule !== scheduleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        l.borrower_name.toLowerCase().includes(q) ||
        (l.borrower_name_ta ?? "").toLowerCase().includes(q)
      );
    });
  }, [loans, query, scheduleFilter]);

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

  // Persist a group's new order as sequential display_order values. Shared
  // with the Borrowers list — a loan's position is one value, so reordering
  // in either place stays consistent.
  async function handleReorder(orderedIds: string[]) {
    await reorderLoansOffline(
      orderedIds.map((id, index) => ({ id, display_order: index })),
      "repay_display_order"
    );
  }

  const hasResults =
    sections.daily.length > 0 ||
    sections.weeklyByDay.length > 0 ||
    sections.monthly.length > 0;

  if (loading) return <SkeletonList rows={6} />;

  return (
    <div>
      <div className="hidden md:block">
        <h1 className="font-serif text-2xl text-ink mb-1">{t("repay_title")}</h1>
        <p className="text-sm text-ink-soft mb-4">{t("repay_subtitle")}</p>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("borrowers_searchPlaceholder")}
          className="flex-1 min-w-0 rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest bg-white"
        />
        <select
          value={scheduleFilter}
          onChange={(e) => setScheduleFilter(e.target.value)}
          className="shrink-0 rounded-md border border-ledger-line px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest"
          aria-label={t("repay_filterBy")}
        >
          <option value="all">{t("repay_filterAll")}</option>
          <option value="Daily">{t("schedule_Daily")}</option>
          <option value="Monthly">{t("schedule_Monthly")}</option>
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>
              {t(`schedule_${day}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>

      {!hasResults ? (
        <div className="rounded-lg border border-dashed border-ledger-line p-8 text-center">
          <p className="text-sm text-ink-soft">
            {loans.length === 0 ? t("repay_empty") : t("borrowers_emptySearch")}
          </p>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {sections.daily.length > 0 && (
            <ResultGroup
              title={t("borrowers_tabDaily")}
              items={sections.daily}
              openLoanId={openLoanId}
              setOpenLoanId={setOpenLoanId}
              onSaved={() => setOpenLoanId(null)}
              onSettled={(id) => { setOpenLoanId(null); setSettledLoanId(id); }}
              onReorder={handleReorder}
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
              onSaved={() => setOpenLoanId(null)}
              onSettled={(id) => { setOpenLoanId(null); setSettledLoanId(id); }}
              onReorder={handleReorder}
              t={t}
            />
          ))}
          {sections.monthly.length > 0 && (
            <ResultGroup
              title={t("borrowers_tabMonthly")}
              items={sections.monthly}
              openLoanId={openLoanId}
              setOpenLoanId={setOpenLoanId}
              onSaved={() => setOpenLoanId(null)}
              onSettled={(id) => { setOpenLoanId(null); setSettledLoanId(id); }}
              onReorder={handleReorder}
              t={t}
            />
          )}
        </div>
      )}

      {/* When a payment clears a loan in full, offer to start a new loan for
          the same borrower — right here, without leaving the Repay tab. */}
      {settledLoanRecord && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-paper p-4 shadow-lg">
            <p className="text-sm text-ink font-medium mb-1">
              {t("renew_settledTitle")}
            </p>
            <p className="text-xs text-ink-soft mb-3">
              {settledLoanRecord.borrower_name} · {t("renew_settledDone")}
            </p>
            <RenewLoanPrompt
              settledLoan={settledLoanRecord}
              onDone={() => setSettledLoanId(null)}
            />
            <button
              onClick={() => setSettledLoanId(null)}
              className="mt-3 w-full text-center text-xs text-ink-soft py-2"
            >
              {t("renew_notNow")}
            </button>
          </div>
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
  onSettled,
  onReorder,
  t,
}: {
  title: string;
  items: RepayLoan[];
  openLoanId: string | null;
  setOpenLoanId: (id: string | null) => void;
  onSaved: () => void;
  onSettled: (loanId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  t: (key: TranslationKey) => string;
}) {
  const [order, setOrder] = useState<string[]>(items.map((i) => i.id));
  const [dragging, setDragging] = useState<string | null>(null);

  // Resync local order when the underlying set changes (add/remove/settle)
  // and we're not mid-drag.
  const incoming = items.map((i) => i.id).join(",");
  if (!dragging && incoming !== order.join(",") && items.length !== order.length) {
    setOrder(items.map((i) => i.id));
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((l): l is RepayLoan => Boolean(l));

  function moveTo(targetId: string) {
    if (!dragging || dragging === targetId) return;
    setOrder((prev) => {
      const from = prev.indexOf(dragging);
      const to = prev.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, dragging);
      return next;
    });
  }

  function endDrag() {
    setDragging(null);
    onReorder(order);
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-ink-soft mb-2">
        {title} ({items.length})
      </h2>
      <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
        {ordered.map((loan) => (
          <div
            key={loan.id}
            data-loan-id={loan.id}
            className={`px-3 py-3 ${
              dragging === loan.id ? "bg-paper opacity-60" : ""
            }`}
            onDragOver={(ev) => ev.preventDefault()}
            onDragEnter={() => moveTo(loan.id)}
          >
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={() => setDragging(loan.id)}
                onDragEnd={endDrag}
                className="cursor-grab active:cursor-grabbing text-ink-soft select-none touch-none px-1"
                aria-label={t("borrowers_dragHandle")}
                title={t("borrowers_dragHandle")}
                onPointerDown={(ev) => {
                  if (ev.pointerType !== "touch") return;
                  setDragging(loan.id);
                }}
                onPointerMove={(ev) => {
                  if (ev.pointerType !== "touch" || dragging !== loan.id) return;
                  const el = document.elementFromPoint(ev.clientX, ev.clientY);
                  const row = el?.closest("[data-loan-id]") as HTMLElement | null;
                  const targetId = row?.dataset.loanId;
                  if (targetId) moveTo(targetId);
                }}
                onPointerUp={(ev) => {
                  if (ev.pointerType !== "touch") return;
                  endDrag();
                }}
              >
                ⠿
              </span>
              <button
                type="button"
                onClick={() =>
                  setOpenLoanId(openLoanId === loan.id ? null : loan.id)
                }
                className="flex-1 min-w-0 text-left"
                aria-label={`${t("repay_action")}: ${loan.borrower_name}`}
              >
                <p className="text-sm text-ink font-medium break-words">
                  {loan.borrower_name}
                </p>
                {loan.borrower_name_ta && (
                  <p className="text-sm text-ink-soft font-normal break-words">
                    {loan.borrower_name_ta}
                  </p>
                )}
              </button>
              <div className="text-right shrink-0">
                <p className="tabular text-sm text-rust">
                  {formatINR(loan.outstanding)}
                </p>
                <span className="text-xs text-ink-soft">
                  {t("repay_tapToRecord")}
                </span>
              </div>
              <Link
                href={`/borrowers/${encodeURIComponent(loan.borrower_name)}`}
                className="text-ink-soft text-lg px-1 leading-none shrink-0"
                aria-label={`${loan.borrower_name} details`}
              >
                ›
              </Link>
            </div>
            {openLoanId === loan.id && (
              <div className="mt-3">
                <RepaymentQuickForm
                  loanId={loan.id}
                  outstandingBefore={loan.outstanding}
                  onSettled={() => onSettled(loan.id)}
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
