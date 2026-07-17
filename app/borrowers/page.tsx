import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import BorrowersClient, {
  type BorrowerSummary,
} from "@/components/BorrowersClient";
import { scheduleGroup } from "@/lib/schedule";

export default async function BorrowersPage() {
  const supabase = await createClient();

  const { data: loans, error } = await supabase
    .from("loans")
    .select(
      "id, borrower_name, principal, payback_amount, given_at, collection_schedule, repayments(amount)"
    )
    .order("borrower_name", { ascending: true });

  type LoanRow = {
    id: string;
    borrower_name: string;
    principal: number;
    payback_amount: number;
    given_at: string;
    collection_schedule: string;
    repayments: { amount: number }[];
  };

  const grouped = new Map<
    string,
    {
      totalGiven: number;
      totalOwed: number;
      totalPaid: number;
      loanCount: number;
      latestGivenAt: string;
      latestSchedule: string;
    }
  >();

  for (const loan of (loans ?? []) as LoanRow[]) {
    const paid = loan.repayments.reduce((s, r) => s + Number(r.amount), 0);
    const existing = grouped.get(loan.borrower_name) ?? {
      totalGiven: 0,
      totalOwed: 0,
      totalPaid: 0,
      loanCount: 0,
      latestGivenAt: loan.given_at,
      latestSchedule: loan.collection_schedule,
    };
    existing.totalGiven += Number(loan.principal);
    existing.totalOwed += Number(loan.payback_amount);
    existing.totalPaid += paid;
    existing.loanCount += 1;
    // Keep the schedule tag from whichever loan was given most recently
    if (loan.given_at >= existing.latestGivenAt) {
      existing.latestGivenAt = loan.given_at;
      existing.latestSchedule = loan.collection_schedule;
    }
    grouped.set(loan.borrower_name, existing);
  }

  const borrowers: BorrowerSummary[] = Array.from(grouped.entries())
    .map(([name, stats]) => ({
      name,
      totalGiven: stats.totalGiven,
      outstanding: stats.totalOwed - stats.totalPaid,
      loanCount: stats.loanCount,
      schedule: stats.latestSchedule,
      group: scheduleGroup(stats.latestSchedule),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {error && <p className="text-sm text-rust">{error.message}</p>}
        <BorrowersClient borrowers={borrowers} />
      </main>
    </>
  );
}
