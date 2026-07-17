import { scheduleGroup } from "@/lib/schedule";

export type LoanForMissedCheck = {
  id: string;
  borrower_name: string;
  principal: number;
  payback_amount: number;
  collection_schedule: string;
  given_at: string;
  repayments: { amount: number; paid_at: string }[];
};

export type MissedLoan = LoanForMissedCheck & {
  outstanding: number;
  lastActivityAt: string;
  daysSinceActivity: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// "Missed" thresholds: 2 missed cycles in a row.
// Daily -> 2 days since last payment/loan date. Weekly -> 2 weeks (14 days).
// Monthly -> 2 months (approximated as 60 days, calendar-aware below).
function isMissed(schedule: string, lastActivity: Date, now: Date): boolean {
  const group = scheduleGroup(schedule);
  if (group === "daily") {
    return daysBetween(lastActivity, now) >= 2;
  }
  if (group === "weekly") {
    return daysBetween(lastActivity, now) >= 14;
  }
  // monthly: compare calendar months, not just day count
  const monthsDiff =
    (now.getFullYear() - lastActivity.getFullYear()) * 12 +
    (now.getMonth() - lastActivity.getMonth()) -
    (now.getDate() < lastActivity.getDate() ? 1 : 0);
  return monthsDiff >= 2;
}

function daysBetween(a: Date, b: Date): number {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - aMid.getTime()) / MS_PER_DAY);
}

export function findMissedLoans(
  loans: LoanForMissedCheck[],
  now: Date = new Date()
): MissedLoan[] {
  const result: MissedLoan[] = [];

  for (const loan of loans) {
    const totalPaid = loan.repayments.reduce(
      (s, r) => s + Number(r.amount),
      0
    );
    const outstanding = Number(loan.payback_amount) - totalPaid;
    if (outstanding <= 0) continue; // settled, nothing to miss

    const lastActivityAt = loan.repayments.length
      ? loan.repayments.reduce((latest, r) =>
          r.paid_at > latest ? r.paid_at : latest, loan.repayments[0].paid_at)
      : loan.given_at;

    const lastActivityDate = new Date(lastActivityAt);

    if (isMissed(loan.collection_schedule, lastActivityDate, now)) {
      result.push({
        ...loan,
        outstanding,
        lastActivityAt,
        daysSinceActivity: daysBetween(lastActivityDate, now),
      });
    }
  }

  return result.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
}
