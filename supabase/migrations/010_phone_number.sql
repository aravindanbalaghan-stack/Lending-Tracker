-- Optional phone number per loan/borrower, shown under the name with a
-- tap-to-call link on mobile.

alter table loans
  add column if not exists phone text;
