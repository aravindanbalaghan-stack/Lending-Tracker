"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/calculations";
import type { TranslationKey } from "@/lib/i18n";
import RepaymentQuickForm from "@/components/RepaymentQuickForm";

export type DraggableEntry = {
  loanId: string;
  name: string;
  nameTa: string | null;
  phone: string | null;
  principal: number;
  outstanding: number;
};

// One date's list of borrowers, reorderable by dragging the handle. Uses
// pointer events so the same code works with a mouse on desktop and a finger
// on mobile. On drop, it reports the new id order to the parent, which
// persists new display_order numbers.
export default function DraggableBorrowerList({
  entries,
  t,
  onReorder,
}: {
  entries: DraggableEntry[];
  t: (key: TranslationKey) => string;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>(entries.map((e) => e.loanId));
  const [dragging, setDragging] = useState<string | null>(null);
  // Which loan's repayment form is open inline. Recording a payment happens
  // right here in the list — NO navigation — so it works identically offline.
  const [repayOpenId, setRepayOpenId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep local order in sync if the parent data changes (e.g. after sync)
  // and we're not mid-drag.
  const incoming = entries.map((e) => e.loanId).join(",");
  const currentJoined = order.join(",");
  if (
    !dragging &&
    incoming !== currentJoined &&
    entries.length !== order.length
  ) {
    setOrder(entries.map((e) => e.loanId));
  }

  const byId = new Map(entries.map((e) => [e.loanId, e]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((e): e is DraggableEntry => Boolean(e));

  function handleDragStart(id: string) {
    setDragging(id);
  }

  function handleDragEnterRow(targetId: string) {
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

  function handleDrop() {
    setDragging(null);
    onReorder(order);
  }

  return (
    <div
      ref={listRef}
      className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden"
    >
      {ordered.map((e) => (
        <div key={e.loanId}>
          <div
            draggable
            onDragStart={() => handleDragStart(e.loanId)}
            onDragEnter={() => handleDragEnterRow(e.loanId)}
            onDragEnd={handleDrop}
            onDragOver={(ev) => ev.preventDefault()}
            className={`flex items-center gap-2 px-3 transition ${
              dragging === e.loanId ? "bg-paper opacity-60" : "hover:bg-paper"
            }`}
          >
          {/* Drag handle */}
          <span
            className="cursor-grab active:cursor-grabbing text-ink-soft select-none touch-none px-1"
            aria-label={t("borrowers_dragHandle")}
            title={t("borrowers_dragHandle")}
            // Pointer-based reordering for touch devices, where HTML5 drag is
            // unreliable. Uses the row's position under the finger.
            onPointerDown={(ev) => {
              if (ev.pointerType !== "touch") return;
              handleDragStart(e.loanId);
            }}
            onPointerMove={(ev) => {
              if (ev.pointerType !== "touch" || dragging !== e.loanId) return;
              const el = document.elementFromPoint(ev.clientX, ev.clientY);
              const row = el?.closest("[data-loan-id]") as HTMLElement | null;
              const targetId = row?.dataset.loanId;
              if (targetId) handleDragEnterRow(targetId);
            }}
            onPointerUp={(ev) => {
              if (ev.pointerType !== "touch") return;
              handleDrop();
            }}
          >
            ⠿
          </span>

          <div className="flex-1 min-w-0">
            <div
              data-loan-id={e.loanId}
              className="flex items-center justify-between min-w-0 py-3 pr-2"
            >
              {/* Tapping the name/body opens the borrower's loan details. */}
              <Link
                href={`/borrowers/${encodeURIComponent(e.name)}`}
                className="flex-1 min-w-0 text-left"
                aria-label={`${e.name} details`}
              >
                <span className="block text-sm text-ink font-medium break-words">
                  {e.name}
                </span>
                {e.nameTa && (
                  <span className="block text-sm text-ink-soft font-normal break-words">
                    {e.nameTa}
                  </span>
                )}
                <span className="block text-xs text-ink-soft">
                  {t("borrowers_given")} {formatINR(e.principal)}
                </span>
              </Link>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                {e.phone && (
                  <a
                    href={`tel:${e.phone}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-forest text-base"
                    aria-label={`Call ${e.name}`}
                  >
                    📞
                  </a>
                )}
                <span
                  className={`tabular text-sm ${
                    e.outstanding > 0 ? "text-rust" : "text-forest"
                  }`}
                >
                  {e.outstanding > 0
                    ? `${formatINR(e.outstanding)} ${t("borrowers_due")}`
                    : t("borrowers_settled")}
                </span>
                {/* The arrow now records a payment inline (only when there's an
                    outstanding balance). Settled loans show no arrow. */}
                {e.outstanding > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setRepayOpenId(
                        repayOpenId === e.loanId ? null : e.loanId
                      )
                    }
                    className="text-forest text-lg px-1 leading-none"
                    aria-label={`${t("repay_action")}: ${e.name}`}
                  >
                    ›
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Inline repayment form — opens in place, no navigation, so it
              works identically online and offline. */}
          {repayOpenId === e.loanId && (
            <div className="px-3 pb-3 pt-1 bg-paper">
              <p className="text-xs text-ink-soft mb-2">
                {t("repay_action")}: {e.name}
              </p>
              <RepaymentQuickForm
                loanId={e.loanId}
                onSaved={() => setRepayOpenId(null)}
                onCancel={() => setRepayOpenId(null)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
