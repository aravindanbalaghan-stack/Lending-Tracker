# Kanakku Book — Lending Ledger

(In the app itself the name displays as **கணக்கு Book** — "Kanakku" in
Tamil script, "Book" in English, as requested.)

A web app (mobile-friendly) for tracking money you've lent out: who you gave
money to, the interest, what they owe back, and every repayment with a
timestamp — plus a daily collections dashboard for the last 15 days.

## Security

This app handles real money and real people's data, so here's exactly
what's protecting it and what you should double-check yourself.

### What's enforced automatically (in the database, not just the app)
- **Every lender only ever sees their own data.** This is enforced by
  Postgres Row Level Security, not by the app's UI — even if someone
  inspected network requests or called the database directly with a
  valid login, they could not read or write another lender's borrowers,
  loans, or repayments. This is checked at the database level on every
  single query, not something the app can accidentally forget to check.
- **A repayment can't be attached to someone else's loan.** Fixed in
  `003_security_hardening.sql` — previously a malicious user could only
  be blocked from *seeing* another lender's data, but a crafted request
  could still reference another lender's loan ID. That gap is now closed
  at the database level.
- **Bad data is rejected at the database, not just the form.** Negative
  amounts, negative interest rates, blank borrower names — even if
  someone bypassed the app's UI entirely and talked to the database
  directly, these are rejected by database constraints, not just
  JavaScript validation.
- **The secret/service-role key is never used in this app.** Only the
  publishable key is used, which is safe to expose in the browser —
  Row Level Security is what actually protects the data, not keeping the
  key secret. Keep the secret key out of this project entirely.
- Standard security HTTP headers (clickjacking protection, MIME-sniffing
  protection, HTTPS enforcement, restricted browser permissions) are set
  on every response.

### Steps to check yourself in the Supabase dashboard
These are account-level settings the database migrations can't set for
you:
1. **Authentication → Policies → Password requirements**: Supabase
   defaults to a 6-character minimum. For real financial data, raise
   this (8+ recommended).
2. **Authentication → Providers → Email → Confirm email**: keep this
   **on** for your real deployment (it's fine to turn off temporarily
   while testing locally, per the setup steps above). Without it,
   anyone can sign up with an email they don't own.
3. **Leaked password protection** (under Authentication settings, if
   available on your Supabase plan): blocks passwords known to be in
   public breach databases.
4. Never commit `.env.local` to a public GitHub repo — it's already in
   `.gitignore` here, but double-check before pushing if you ever copy
   files manually.

### Run the security migration
If you already had the tables from before, run
`supabase/migrations/003_security_hardening.sql` in Supabase's SQL
Editor. It's safe to run on live data — it only adds constraints and
tightens one policy, nothing is deleted or changed.

## New in this update (latest)

- **Editable payback amount** — the New Loan form has a checkbox
  ("Change the total payback amount manually"). Leave it unchecked and
  the payback stays auto-calculated as before; check it to type in a
  different final amount (useful for negotiated settlements, rounding,
  or special arrangements).
- **Backup** — a new page that downloads all your borrowers, loans, and
  full repayment history as either a CSV (opens in Excel) or a JSON file
  (exact copy of everything, good as a true backup). There's also a
  quick "Download CSV" link on each borrower's own page for just their
  history.

### Database change required
The payback amount used to be auto-computed by the database, which
blocked manual edits. Run this once in Supabase **SQL Editor → New
query**: `supabase/migrations/002_editable_payback.sql`. Your existing
data is untouched — this only changes how new values get set going
forward.

## New in this update

- **Quick Repay tab** — search any borrower by name and record a repayment
  in one step, without drilling into their full history. If more than one
  borrower shares a name, results are shown grouped by their collection
  schedule (Daily / by weekday / Monthly) so you can tell them apart.
- **Weekly day filter** — on the Borrowers page, the Weekly tab now has a
  row of day buttons (Monday–Sunday) to narrow the list to just that day's
  borrowers.
- **Missed Repayments tab** — automatically lists anyone who's gone
  2 full collection cycles without paying: 2 days for Daily borrowers,
  2 weeks for Weekly, 2 months for Monthly. Grouped the same way, with a
  one-tap repayment action right there.
- **Import from Excel/CSV** — bring in existing records from another
  system. Upload a `.csv` or `.xlsx` file, map its columns to Khata's
  fields (borrower name and amount are required; interest rate,
  installments, schedule, date, and notes are optional with sensible
  defaults), preview what will be imported, then confirm. A sample CSV
  template is downloadable from the Import page.

No database changes are needed for this update — it all builds on the
`collection_schedule` column added last time. If you haven't run that
migration yet, see the section below.

**A note on "missed":** a borrower shows up in Missed Repayments when the
time since their last payment (or since the loan was given, if they've
never paid) has passed 2 full cycles for their schedule — 2 days (Daily),
2 weeks (Weekly), or 2 calendar months (Monthly). It only looks at loans
that still have an outstanding balance.

## New in this update

- **Search** on the Borrowers page — filters instantly as you type, works
  for names in English or Tamil script equally.
- **Collection schedule** — every loan is tagged with when you collect
  from that borrower: a day of the week (Monday–Sunday), or **Daily**, or
  **Monthly**. It defaults automatically to the weekday of the date you
  pick as "Date given," and you can override it with the dropdown.
- **Three tabs on the Borrowers page** — Daily / Weekly / Monthly — grouped
  by each borrower's schedule tag (their most recent loan's tag, if they
  have more than one).
- **Language toggle** (EN / த) in the top nav — switches all interface
  text between English and Tamil. Borrower names can be typed in either
  script and are saved and searched exactly as entered.

### If you already ran the old `schema.sql`
Your database needs one new column. In Supabase **SQL Editor → New query**,
run `supabase/migrations/001_add_collection_schedule.sql`. If you're
setting up a brand-new project instead, just run `supabase/schema.sql` as
usual — it already includes this column.

## How the numbers work

- **Payback amount** = `principal x (1 + interest_rate / 100)`, calculated
  automatically. Interest rate defaults to 25% but can be changed per loan.
- **Installments** is just a count you set (e.g. "pays back in 4
  installments") — it divides the payback amount evenly for reference. You
  log actual repayments one at a time as they come in, each with its own
  timestamp, so partial/uneven payments are fully supported.
- **Dashboard** sums repayments by the calendar day they were recorded,
  for the last 15 days, and lets you click any day to see who paid what.

## One-time setup (about 10 minutes)

### 1. Create a free Supabase project
1. Go to https://supabase.com and sign up / sign in.
2. Click **New Project**. Pick any name and a database password (save it
   somewhere safe — you won't need it day-to-day).
3. Wait ~2 minutes for the project to finish setting up.

### 2. Create the database tables
1. In your Supabase project, open **SQL Editor** (left sidebar) -> **New query**.
2. Open `supabase/schema.sql` from this project, copy all of it, paste it
   into the SQL editor, and click **Run**.
3. This creates the `loans` and `repayments` tables and locks them down so
   each signed-up lender only ever sees their own data.

### 3. Turn off email confirmation (optional, for faster testing)
By default Supabase requires email confirmation for new accounts. For quick
testing: **Authentication -> Providers -> Email -> toggle off "Confirm email"**.
For a real launch, leave it on so accounts are verified.

### 4. Get your API keys
In Supabase: **Project Settings -> API**. Copy:
- **Project URL**
- **anon public** key

### 5. Configure this project
1. Copy `.env.local.example` to `.env.local`.
2. Paste in your Project URL and anon key.

### 6. Run it locally
```bash
npm install
npm run dev
```
Open http://localhost:3000 — you'll land on the sign-up page.

## Deploying (Vercel)

1. Push this project to a GitHub repo.
2. Go to https://vercel.com -> **New Project** -> import the repo.
3. In **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values as your `.env.local`.
4. Click **Deploy**. You'll get a `https://your-app.vercel.app` URL that
   works on both desktop and mobile browsers — you can also "Add to Home
   Screen" on a phone so it behaves like an app icon.

## Multi-user

Every visitor creates their own account (email + password) and only ever
sees their own borrowers and repayments — this is enforced at the database
level (Row Level Security), not just in the app's UI, so it's safe for many
independent lenders to use the same deployed app.

## Project structure

- `app/login` — sign in / sign up
- `app/dashboard` — daily collections dashboard, 15-day filter
- `app/borrowers` — list of all borrowers with outstanding balances
- `app/borrowers/new` — add a new loan (live payback calculation)
- `app/borrowers/[id]` — one borrower's full loan + repayment history,
  and where you log a repayment as it comes in
- `lib/calculations.ts` — interest/payback/date math, all in one place
- `supabase/schema.sql` — database schema + security rules
