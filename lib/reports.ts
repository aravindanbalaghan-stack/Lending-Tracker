import { dateKey } from "@/lib/calculations";

// Minimal shapes we need from local data.
export type ReportLoan = {
  id: string;
  borrower_name: string;
  principal: number;
  interest_rate: number;
  payback_amount: number;
  given_at: string;
  collection_schedule: string;
};

export type ReportRepayment = {
  loan_id: string;
  amount: number;
  paid_at: string;
};

export type BorrowerRisk = {
  name: string;
  outstanding: number;
  lastPaidDaysAgo: number | null; // null = never paid
};

export type ReportSummary = {
  // Money on the street: total still owed across all active loans.
  totalOutstanding: number;
  // Principal currently lent out (unrecovered principal portion, approx).
  principalOnStreet: number;
  // Expected profit = payback - principal across loans still open.
  expectedProfitOpen: number;
  // Realized profit so far = repayments received - principal of settled loans.
  // (Simple, transparent model: profit is booked as it's collected above
  // principal; see note in the Reports UI.)
  totalLent: number; // sum of principal ever given
  totalCollected: number; // sum of all repayments
  totalExpectedReturn: number; // sum of payback_amount ever given
  activeLoans: number;
  settledLoans: number;
  // Collections in the current calendar month (by paid_at).
  collectedThisMonth: number;
  collectedLastMonth: number;
  // New money lent this month.
  lentThisMonth: number;
};

function monthKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function paidByLoan(
  repayments: ReportRepayment[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of repayments) {
    m.set(r.loan_id, (m.get(r.loan_id) ?? 0) + Number(r.amount));
  }
  return m;
}

export function computeSummary(
  loans: ReportLoan[],
  repayments: ReportRepayment[],
  now: Date = new Date()
): ReportSummary {
  const paid = paidByLoan(repayments);

  let totalOutstanding = 0;
  let principalOnStreet = 0;
  let expectedProfitOpen = 0;
  let totalLent = 0;
  let totalExpectedReturn = 0;
  let activeLoans = 0;
  let settledLoans = 0;

  for (const l of loans) {
    const principal = Number(l.principal);
    const payback = Number(l.payback_amount);
    const paidAmt = paid.get(l.id) ?? 0;
    const outstanding = Math.max(0, payback - paidAmt);

    totalLent += principal;
    totalExpectedReturn += payback;

    if (outstanding > 0) {
      activeLoans++;
      totalOutstanding += outstanding;
      expectedProfitOpen += payback - principal;
      // Approximate unrecovered principal: principal scaled by how much of the
      // payback is still outstanding.
      principalOnStreet += payback > 0 ? (outstanding / payback) * principal : 0;
    } else {
      settledLoans++;
    }
  }

  const thisMonth = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastMonthDate);

  let collectedThisMonth = 0;
  let collectedLastMonth = 0;
  let totalCollected = 0;
  for (const r of repayments) {
    const amt = Number(r.amount);
    totalCollected += amt;
    const mk = monthKey(r.paid_at);
    if (mk === thisMonth) collectedThisMonth += amt;
    else if (mk === lastMonth) collectedLastMonth += amt;
  }

  let lentThisMonth = 0;
  for (const l of loans) {
    if (monthKey(l.given_at) === thisMonth) lentThisMonth += Number(l.principal);
  }

  return {
    totalOutstanding,
    principalOnStreet,
    expectedProfitOpen,
    totalLent,
    totalCollected,
    totalExpectedReturn,
    activeLoans,
    settledLoans,
    collectedThisMonth,
    collectedLastMonth,
    lentThisMonth,
  };
}

// Daily collections for the last N days, for a simple bar trend.
export function dailyCollections(
  repayments: ReportRepayment[],
  days: number,
  now: Date = new Date()
): { date: string; total: number }[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(dateKey(d), 0);
  }
  for (const r of repayments) {
    const k = dateKey(r.paid_at);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + Number(r.amount));
  }
  return Array.from(buckets.entries()).map(([date, total]) => ({ date, total }));
}

// Monthly collections for the last N months.
export function monthlyCollections(
  repayments: ReportRepayment[],
  months: number,
  now: Date = new Date()
): { month: string; total: number }[] {
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), 0);
  }
  for (const r of repayments) {
    const k = monthKey(r.paid_at);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + Number(r.amount));
  }
  return Array.from(buckets.entries()).map(([month, total]) => ({
    month,
    total,
  }));
}

// Borrowers with an outstanding balance who haven't paid in a while — the
// lender's follow-up list, sorted by most-overdue.
export function topRisks(
  loans: ReportLoan[],
  repayments: ReportRepayment[],
  limit: number,
  now: Date = new Date()
): BorrowerRisk[] {
  const paid = paidByLoan(repayments);
  const lastPaidByLoan = new Map<string, number>();
  for (const r of repayments) {
    const t = new Date(r.paid_at).getTime();
    if (!lastPaidByLoan.has(r.loan_id) || t > lastPaidByLoan.get(r.loan_id)!) {
      lastPaidByLoan.set(r.loan_id, t);
    }
  }

  const risks: BorrowerRisk[] = [];
  for (const l of loans) {
    const outstanding = Number(l.payback_amount) - (paid.get(l.id) ?? 0);
    if (outstanding <= 0) continue;
    const lastPaid = lastPaidByLoan.get(l.id);
    const lastPaidDaysAgo =
      lastPaid != null
        ? Math.floor((now.getTime() - lastPaid) / (1000 * 60 * 60 * 24))
        : null;
    risks.push({
      name: l.borrower_name,
      outstanding,
      lastPaidDaysAgo,
    });
  }

  // Never-paid first, then longest since last payment, then biggest balance.
  risks.sort((a, b) => {
    const aDays = a.lastPaidDaysAgo ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.lastPaidDaysAgo ?? Number.MAX_SAFE_INTEGER;
    if (aDays !== bDays) return bDays - aDays;
    return b.outstanding - a.outstanding;
  });

  return risks.slice(0, limit);
}
