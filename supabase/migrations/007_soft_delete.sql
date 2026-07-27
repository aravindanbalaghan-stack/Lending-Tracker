-- Soft-delete for loans: instead of removing a loan, mark it with a deletion
-- timestamp. Deleted loans are hidden everywhere, shown in the "Deleted
-- records" bin in Settings, restorable within 8 days, then purged.

alter table loans
  add column if not exists deleted_at timestamptz;

-- Index so the common "not deleted" filter stays fast.
create index if not exists loans_deleted_at_idx on loans (deleted_at);

-- OPTIONAL server-side auto-purge (only if you want deletion to happen even
-- when nobody opens the app). Requires the pg_cron extension. The app also
-- purges client-side on open, so this is not required.
--
-- To enable:
--   1. Dashboard → Database → Extensions → enable "pg_cron"
--   2. Run the block below.
--
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'purge-deleted-loans',
--   '0 2 * * *',  -- 2am daily
--   $$ delete from loans
--      where deleted_at is not null
--        and deleted_at < now() - interval '8 days' $$
-- );
