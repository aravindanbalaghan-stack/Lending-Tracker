import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import BorrowerDetailClient, {
  type LoanWithRepayments,
} from "@/components/BorrowerDetailClient";

export default async function BorrowerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const borrowerName = decodeURIComponent(id);
  const supabase = await createClient();

  const { data: loans, error } = await supabase
    .from("loans")
    .select(
      "id, principal, interest_rate, payback_amount, installments_count, collection_schedule, given_at, notes, repayments(id, amount, paid_at)"
    )
    .eq("borrower_name", borrowerName)
    .order("given_at", { ascending: false });

  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {error && <p className="text-sm text-rust">{error.message}</p>}
        <BorrowerDetailClient
          borrowerName={borrowerName}
          loans={(loans ?? []) as unknown as LoanWithRepayments[]}
        />
      </main>
    </>
  );
}
