-- Run this in Supabase SQL Editor if you already created the tables before.
-- Adds the collection-day/frequency tag to existing loans.

alter table loans
  add column if not exists collection_schedule text not null default 'Daily';

alter table loans
  add constraint loans_collection_schedule_check
  check (
    collection_schedule in (
      'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
      'Daily','Monthly'
    )
  );
