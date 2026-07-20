-- Run this in Supabase SQL Editor if you already created the tables before.
-- Adds two new tables for the dashboard's daily cash-tracking section.

create table if not exists daily_entries (
  lender_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  opening_balance numeric(12,2) not null default 0,
  expenses numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (lender_id, entry_date)
);

create table if not exists lender_settings (
  lender_id uuid primary key references auth.users(id) on delete cascade,
  mamai_rate numeric(6,2) not null default 30,
  threshold_daily integer not null default 15,
  threshold_weekly integer not null default 15,
  threshold_monthly integer not null default 15,
  updated_at timestamptz not null default now()
);

alter table daily_entries enable row level security;
alter table lender_settings enable row level security;

create policy "Lenders manage their own daily entries"
  on daily_entries for all
  using (auth.uid() = lender_id)
  with check (auth.uid() = lender_id);

create policy "Lenders manage their own settings"
  on lender_settings for all
  using (auth.uid() = lender_id)
  with check (auth.uid() = lender_id);
