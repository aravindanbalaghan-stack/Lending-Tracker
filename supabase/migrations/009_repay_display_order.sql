-- The Borrowers list (grouped by date) and the Repay tab (grouped by
-- schedule, and only showing unpaid loans) contain different sets of loans,
-- so they can't share a single display_order without corrupting each other.
-- Give Repay its own independent order column.

alter table loans
  add column if not exists repay_display_order integer not null default 0;

create index if not exists loans_repay_display_order_idx
  on loans (repay_display_order);
