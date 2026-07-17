-- Run this in Supabase SQL Editor if you already created the tables before.
-- Converts payback_amount from an auto-computed column into a regular
-- column the app can set directly, so it can be manually overridden.
-- Existing rows keep whatever value they already had.

alter table loans alter column payback_amount drop expression if exists;
