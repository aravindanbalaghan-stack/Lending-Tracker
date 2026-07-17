-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query)

-- 1. Loans: one row per amount given to a borrower
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references auth.users(id) on delete cascade,
  borrower_name text not null check (length(trim(borrower_name)) > 0),
  principal numeric(12,2) not null check (principal > 0),
  interest_rate numeric(5,2) not null default 25 check (interest_rate >= 0),
  payback_amount numeric(12,2) not null check (payback_amount >= 0),
  installments_count integer not null default 1 check (installments_count >= 1),
  collection_schedule text not null default 'Daily' check (
    collection_schedule in (
      'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
      'Daily','Monthly'
    )
  ),
  given_at timestamptz not null default now(),
  notes text
);

-- 2. Repayments: one row per payment received against a loan
create table if not exists repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  lender_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_loans_lender on loans(lender_id);
create index if not exists idx_repayments_lender_date on repayments(lender_id, paid_at);
create index if not exists idx_repayments_loan on repayments(loan_id);

-- Row Level Security: every lender only ever sees their own rows
alter table loans enable row level security;
alter table repayments enable row level security;

create policy "Lenders manage their own loans"
  on loans for all
  using (auth.uid() = lender_id)
  with check (auth.uid() = lender_id);

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
