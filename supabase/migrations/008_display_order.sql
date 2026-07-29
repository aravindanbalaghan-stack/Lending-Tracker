-- Adds a manual display order to loans, used to arrange borrowers within
-- their date section on the Borrowers list (via drag-and-drop or a number
-- entered when creating the loan). Lower numbers appear first.

alter table loans
  add column if not exists display_order integer not null default 0;

create index if not exists loans_display_order_idx on loans (display_order);
