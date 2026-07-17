import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import BackupClient from "@/components/BackupClient";
import { type BackupLoan } from "@/lib/export";

export default async function BackupPage() {
  const supabase = await createClient();

  const { data: loans, error } = await supabase
    .from("loans")
    .select(
      "id, borrower_name, principal, interest_rate, payback_amount, installments_count, collection_schedule, given_at, notes, repayments(amount, paid_at)"
    )
    .order("borrower_name", { ascending: true });

  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {error && <p className="text-sm text-rust">{error.message}</p>}
        <BackupClient loans={(loans ?? []) as unknown as BackupLoan[]} />
      </main>
    </>
  );
}
