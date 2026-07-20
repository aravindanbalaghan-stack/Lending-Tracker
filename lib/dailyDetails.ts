import { scheduleGroup } from "@/lib/schedule";
import { dateKey, round2 } from "@/lib/calculations";
import type { LoanRecord, RepaymentRecord } from "@/lib/offline/db";

export type Thresholds = {
  threshold_daily: number;
  threshold_weekly: number;
  threshold_monthly: number;
};

export const DEFAULT_SETTINGS = {
  lender_id: "",
  mamai_rate: 30,
  threshold_daily: 15,
  threshold_weekly: 15,
  threshold_monthly: 15,
};

function daysBetween(a: Date, b: Date): number {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - aMid.getTime()) / 86400000);
}

// Whether a repayment counts as "on time" (நடப்பு வரவு): received within the
// configured window of the loan's given date, measured in the unit that
// matches the loan's own collection schedule (days/weeks/months).
export function isOnTimeRepayment(
  givenAt: string,
  paidAt: string,
  schedule: string,
  thresholds: Thresholds
): boolean {
  const group = scheduleGroup(schedule);
  const given = new Date(givenAt);
  const paid = new Date(paidAt);
  const diffDays = daysBetween(given, paid);

  if (group === "daily") return diffDays <= thresholds.threshold_daily;
  if (group === "weekly") return diffDays <= thresholds.threshold_weekly * 7;

  // monthly: calendar-aware month difference, consistent with how the
  // "missed repayments" feature measures monthly gaps elsewhere in the app.
  const monthsDiff =
    (paid.getFullYear() - given.getFullYear()) * 12 +
    (paid.getMonth() - given.getMonth()) -
    (paid.getDate() < given.getDate() ? 1 : 0);
  return monthsDiff <= thresholds.threshold_monthly;
}

export type DaySummary = {
  munnirupu: number; // opening balance (manual)
  vasool: number; // total collected (auto)
  nadapuVaravu: number; // on-time collection (auto)
  nibuVaravu: number; // other/late collection (auto)
  mamai: number; // rate-based figure on new loans given (auto)
  selavu: number; // expenses (manual)
  adappu: number; // amount given as new loans (auto)
  total: number; // munnirupu + vasool + mamai - selavu - adappu
};

export function computeDaySummary(
  date: string,
  loans: LoanRecord[],
  repayments: RepaymentRecord[],
  thresholds: Thresholds,
  mamaiRate: number,
  openingBalance: number,
  expenses: number
): DaySummary {
  const loanById = new Map(loans.map((l) => [l.id, l]));

  const loansGivenThatDay = loans.filter((l) => dateKey(l.given_at) === date);
  const adappu = loansGivenThatDay.reduce(
    (s, l) => s + Number(l.principal),
    0
  );
  const mamai = round2((adappu / 1000) * mamaiRate);

  const repaymentsThatDay = repayments.filter(
    (r) => dateKey(r.paid_at) === date
  );
  const vasool = repaymentsThatDay.reduce((s, r) => s + Number(r.amount), 0);

  let nadapuVaravu = 0;
  for (const r of repaymentsThatDay) {
    const loan = loanById.get(r.loan_id);
    if (
      loan &&
      isOnTimeRepayment(loan.given_at, r.paid_at, loan.collection_schedule, thresholds)
    ) {
      nadapuVaravu += Number(r.amount);
    }
  }
  const nibuVaravu = round2(vasool - nadapuVaravu);

  const total = round2(
    openingBalance + vasool + mamai - expenses - adappu
  );

  return {
    munnirupu: openingBalance,
    vasool: round2(vasool),
    nadapuVaravu: round2(nadapuVaravu),
    nibuVaravu,
    mamai,
    selavu: expenses,
    adappu: round2(adappu),
    total,
  };
}
