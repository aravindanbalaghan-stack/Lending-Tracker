-- Run this in Supabase SQL Editor if you already created the tables before.
-- Closes a cross-tenant data-integrity gap and adds stricter input checks.
-- Safe to run on an existing database; does not delete any data.

-- 1. Prevent a repayment from ever being attached to a loan you don't own.
--    Previously, RLS only checked that the repayment's own lender_id
--    matched you — it didn't check that the loan_id you referenced was
--    actually one of your own loans. This closes that gap.
drop policy if exists "Lenders manage their own repayments" on repayments;

create policy "Lenders manage their own repayments"
  on repayments for all
  using (auth.uid() = lender_id)
  with check (
    auth.uid() = lender_id
    and exists (
      select 1 from loans l
      where l.id = loan_id and l.lender_id = auth.uid()
    )
  );

-- 2. Reject negative interest rates and blank borrower names at the
--    database level (defense in depth, on top of the app's own checks).
alter table loans
  add constraint loans_interest_rate_nonnegative check (interest_rate >= 0);

alter table loans
  add constraint loans_borrower_name_not_blank check (length(trim(borrower_name)) > 0);

alter table loans
  add constraint loans_payback_amount_nonnegative check (payback_amount >= 0);
