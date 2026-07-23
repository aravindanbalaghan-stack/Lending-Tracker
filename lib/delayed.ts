import { scheduleGroup } from "@/lib/schedule";
import type { Thresholds } from "@/lib/dailyDetails";

export type LoanForDelayCheck = {
  id: string;
  borrower_name: string;
  borrower_name_ta: string | null;
  principal: number;
  payback_amount: number;
  collection_schedule: string;
  given_at: string;
  interest_rate: number;
  installments_count: number;
};

export type DelayedLoan = LoanForDelayCheck & {
  outstanding: number;
  daysOverdue: number;
};

function daysBetween(a: Date, b: Date): number {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - aMid.getTime()) / 86400000);
}

// How many days a loan is allowed to run before it counts as delayed, using
// the same per-schedule thresholds that drive நடப்பு வரவு on the dashboard:
// days for Daily borrowers, weeks for Weekly, months for Monthly.
export function allowedDays(schedule: string, thresholds: Thresholds): number {
  const group = scheduleGroup(schedule);
  if (group === "daily") return thresholds.threshold_daily;
  if (group === "weekly") return thresholds.threshold_weekly * 7;
  return thresholds.threshold_monthly * 30;
}

// A loan is delayed when it still has money owing AND its allowed window has
// already passed. Fully settled loans are never delayed — which is what makes
// a borrower move back out of this tab automatically once they clear it.
export function findDelayedLoans(
  loans: LoanForDelayCheck[],
  paidByLoanId: Map<string, number>,
  thresholds: Thresholds,
  now: Date = new Date()
): DelayedLoan[] {
  const result: DelayedLoan[] = [];

  for (const loan of loans) {
    const paid = paidByLoanId.get(loan.id) ?? 0;
    const outstanding = Number(loan.payback_amount) - paid;
    if (outstanding <= 0) continue;

    const elapsed = daysBetween(new Date(loan.given_at), now);
    const allowed = allowedDays(loan.collection_schedule, thresholds);
    if (elapsed > allowed) {
      result.push({
        ...loan,
        outstanding,
        daysOverdue: elapsed - allowed,
      });
    }
  }

  return result.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// The set of loan ids currently delayed — used by the Borrowers list to hide
// them, so a borrower appears in exactly one place at a time.
export function delayedLoanIdSet(delayed: DelayedLoan[]): Set<string> {
  return new Set(delayed.map((l) => l.id));
}
