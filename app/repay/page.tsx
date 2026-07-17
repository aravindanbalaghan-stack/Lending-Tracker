import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import RepayClient, { type RepayLoan } from "@/components/RepayClient";

export default async function RepayPage() {
  const supabase = await createClient();

  const { data: loans, error } = await supabase
    .from("loans")
    .select(
      "id, borrower_name, principal, payback_amount, collection_schedule, given_at, repayments(amount)"
    )
    .order("borrower_name", { ascending: true });

  type LoanRow = {
    id: string;
    borrower_name: string;
    principal: number;
    payback_amount: number;
    collection_schedule: string;
    given_at: string;
    repayments: { amount: number }[];
  };

  const repayLoans: RepayLoan[] = ((loans ?? []) as LoanRow[])
    .map((loan) => {
      const paid = loan.repayments.reduce((s, r) => s + Number(r.amount), 0);
      return {
        id: loan.id,
        borrower_name: loan.borrower_name,
        outstanding: Number(loan.payback_amount) - paid,
        collection_schedule: loan.collection_schedule,
        given_at: loan.given_at,
      };
    })
    .filter((loan) => loan.outstanding > 0);

  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {error && <p className="text-sm text-rust">{error.message}</p>}
        <RepayClient loans={repayLoans} />
      </main>
    </>
  );
}
