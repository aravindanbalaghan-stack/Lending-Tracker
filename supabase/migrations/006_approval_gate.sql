-- Run this in Supabase SQL Editor if you already created the tables before.
-- Adds an approval gate: new users can't access their data until an admin
-- (you) approves them.

create table if not exists user_approvals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table user_approvals enable row level security;

-- A user may read only their own approval row (so the app can check its own
-- status), but may NOT change it — only the service role / SQL editor can.
create policy "Users read own approval"
  on user_approvals for select
  using (auth.uid() = user_id);

-- Auto-create a pending approval row whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_approvals (user_id, email, status)
  values (new.id, new.email, 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper the app calls to check its own status (returns 'pending' if no row).
create or replace function my_approval_status()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select status from public.user_approvals where user_id = auth.uid()),
    'pending'
  );
$$;

-- Gate the data tables on approval: even with a valid login, a non-approved
-- user's own rows are invisible until approved. This is belt-and-suspenders
-- on top of the app-level redirect.
create or replace function is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.user_approvals
    where user_id = auth.uid() and status = 'approved'
  );
$$;
