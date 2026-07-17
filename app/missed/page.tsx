import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import MissedClient from "@/components/MissedClient";
import { findMissedLoans, type LoanForMissedCheck } from "@/lib/missed";

export default async function MissedPage() {
  const supabase = await createClient();

  const { data: loans, error } = await supabase
    .from("loans")
    .select(
      "id, borrower_name, principal, payback_amount, collection_schedule, given_at, repayments(amount, paid_at)"
    );

  const missed = findMissedLoans((loans ?? []) as LoanForMissedCheck[]);

  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {error && <p className="text-sm text-rust">{error.message}</p>}
        <MissedClient loans={missed} />
      </main>
    </>
  );
}
