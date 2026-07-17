import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import DashboardClient, { type RepaymentRow } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14);
  fifteenDaysAgo.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("repayments")
    .select("id, amount, paid_at, loans(borrower_name)")
    .gte("paid_at", fifteenDaysAgo.toISOString())
    .order("paid_at", { ascending: false });

  const rows: RepaymentRow[] = (data ?? []).map((r) => {
    const loan = Array.isArray(r.loans) ? r.loans[0] : r.loans;
    return {
      id: r.id as string,
      amount: Number(r.amount),
      paid_at: r.paid_at as string,
      borrower_name: (loan as { borrower_name: string } | null)?.borrower_name ?? "Unknown",
    };
  });

  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {error ? (
          <p className="text-sm text-rust">
            Couldn&apos;t load repayments: {error.message}
          </p>
        ) : (
          <DashboardClient rows={rows} />
        )}
      </main>
    </>
  );
}
