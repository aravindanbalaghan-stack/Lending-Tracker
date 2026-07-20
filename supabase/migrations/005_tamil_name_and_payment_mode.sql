-- Run this in Supabase SQL Editor if you already created the tables before.
-- Adds a Tamil-script name field to loans, and a payment mode to repayments.

alter table loans
  add column if not exists borrower_name_ta text;

alter table repayments
  add column if not exists payment_mode text not null default 'Cash';

alter table repayments
  add constraint repayments_payment_mode_check
  check (payment_mode in ('Cash', 'UPI'));
