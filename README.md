# Kanakku Book — Lending Ledger

(In the app itself the name displays as **கணக்கு Book** — "Kanakku" in
Tamil script, "Book" in English, as requested.)

A web app (mobile-friendly) for tracking money you've lent out: who you gave
money to, the interest, what they owe back, and every repayment with a
timestamp — plus a daily collections dashboard for the last 15 days.

## Borrowers grouped by date, and better Tamil names (latest)

- **Borrowers list is now grouped by the date each loan was given** — one
  section per date, most recent first, instead of a flat alphabetical
  list. Applies to all three tabs (Daily / Weekly / Monthly). On the
  Weekly tab, picking a specific weekday still narrows the list first —
  the date sections then apply within that narrowed set.
- **Tamil names now show up everywhere** a borrower's name appears — the
  dashboard's daily list, Quick Repay, Missed Repayments, the Borrowers
  list, and CSV backups — not just the borrower's own detail page.
- **Transliteration accuracy improved.** A few specific, common mistakes
  are fixed: names ending in a plain "a" (Priya, Latha, Uma, Divya) now
  correctly get the long ஆ ending instead of dropping it; "t"/"d" now
  default to the dental த sound used in most names instead of the harder
  retroflex ட; and "n" now correctly becomes the dental ந at the start of
  a word or before another dental sound (Naveen, Nandhini), and the
  alveolar ன everywhere else (Kannan). This remains a best-effort
  phonetic approximation, not a perfect transliteration — the Tamil name
  field stays fully editable everywhere so any remaining mismatch can be
  corrected once and it'll stick.

No database migration needed for this update.

## Five small-but-useful changes (latest)

1. **Default installments is now 10** (was 1) on the New Loan form — still
   fully editable per loan.
2. **Dashboard wording cleaned up** — now that the calendar lets you pick
   any date, the old "last 15 days" text is gone from the subtitle.
3. **Auto-suggested Tamil name field** — every borrower now has a second
   name field in Tamil script, auto-filled as you type the English name
   using a phonetic transliteration. **Important caveat:** this is a
   best-effort approximation, not a linguistically perfect
   transliteration — uncommon consonant clusters (like "pr", "kr") won't
   always come out the way a native speaker would spell them by hand.
   The field is fully editable everywhere it appears (new loan form,
   rename borrower), so a one-time correction sticks for good. Once set,
   searching in the Borrowers list matches either the English or Tamil
   name.
4. **Payment mode (Cash / UPI)** — every repayment now records how it was
   received. Shown as a small tag next to each repayment, editable
   afterward, and available as an optional column when importing
   payments from a spreadsheet.
5. **Clickable names on the dashboard** — tap any borrower's name in the
   selected day's list to jump straight to their page in Borrowers.

### Database change required
Run `supabase/migrations/005_tamil_name_and_payment_mode.sql` in
Supabase's SQL Editor. Adds two new columns, touches nothing existing.

## Editing existing data (latest)

Everything in the app was insert-only until now — if a name was misspelled
or an amount entered wrong, there was no way to fix it. Three new edit
options on the borrower detail page:

- **Edit loan** — under each loan's summary, fixes the amount, interest
  rate, payback amount (with the same manual-override checkbox as when
  creating it), installment count, collection schedule, date given, or
  notes.
- **Edit repayment** — next to any repayment row, fixes its amount or
  date.
- **Rename borrower** — next to the borrower's name at the top of the
  page. This renames **every loan that borrower has**, in one action —
  it deliberately doesn't let you rename just one of their loans, since
  that would split one person into two separate borrower entries by
  accident.

All of this works offline the same way as everything else — edits save
locally immediately and sync automatically once you're back online.

No database migration needed — editing uses the same tables and the same
row-level security that already protects everything else.

## Import payments, not just loans (latest)

The Import page now has a **Loans / Payments** toggle at the top. Payment
import works by matching each row to an existing borrower by name — since
your old system won't have this app's internal loan IDs, matching is done
by borrower name instead:

- If a borrower has exactly one loan, every imported payment attaches to it
- If a borrower has more than one loan, payments are applied to their
  **oldest loan that still has a balance owing** first — like a natural
  repayment waterfall — falling back to their most recent loan only once
  everything else is settled, so nothing is silently dropped
- **Import loans before importing payments** — payments can only match
  against loans that already exist in the app

Rows for borrowers with no matching loan are flagged as skipped in the
preview step, with the reason shown, rather than silently failing.

## Calendar dashboard & daily cash tracking (latest)

The dashboard is now built around a compact calendar (top-right on
desktop, above the details on mobile) instead of a flat list of dates —
click any date, past or present, to see that day's activity.

Below it, a new daily details section tracks the day's full cash
picture, with these fields (Tamil labels as requested, with a small
English gloss under each so the app stays usable either way):

| Field | Tamil | Meaning |
|---|---|---|
| Opening balance | முன்னிருப்பு | Manual — cash in hand at the start of the day |
| Total collected | வசூல் | Automatic — sum of all repayments received that day |
| On-time collection | நடப்பு வரவு | Automatic — the portion of வசூல் received within your configured window of each loan's start date |
| Other collection | நிபு வரவு | Automatic — வசூல் minus நடப்பு வரவு |
| Rate-based figure | மைமை | Automatic — calculated from new loans given that day, at a configurable rate per ₹1000 (default 30) |
| Expenses | செலவு | Manual |
| Amount given | அடப்பு | Automatic — sum of new loans given that day |
| **Total** | **மொத்தம்** | முன்னிருப்பு + வசூல் + மைமை − செலவு − அடப்பு |

**"On-time" window is configurable per schedule type** — a small
settings panel under the daily details card lets you set how many days
(for Daily borrowers), weeks (for Weekly), or months (for Monthly)
counts as "on time," and the மைமை rate per ₹1000. These apply globally
across all your loans and can be changed anytime.

Both the manual fields (opening balance, expenses) and the settings are
saved per-lender and sync the same offline-first way as everything else
in the app — editable with no connection, syncing automatically once
you're back online.

### Database change required
Two new tables support this. Run
`supabase/migrations/004_daily_details.sql` in Supabase's SQL Editor.
Nothing existing is touched.

## Works offline (latest)

The app now works with no internet connection at all, and catches up
automatically once you're back online.

**How it works:**
- Every loan and repayment is written to a local database on your device
  (IndexedDB) the instant you save it — this happens whether you're
  online or not, so the UI never waits on the network.
- If you're online at that moment, it's also pushed to Supabase right
  away. If you're offline, it's queued.
- All the pages you use — Dashboard, Borrowers, Repay, Missed, Backup —
  now read from that same local database, so they display instantly and
  keep working with zero connection.
- The moment your device regains internet, a background sync kicks in
  automatically: queued items are pushed to Supabase in the order they
  were created (so a repayment always syncs after the loan it belongs
  to), then fresh data is pulled down.
- A slim status bar appears at the top whenever you're offline or have
  unsynced changes waiting — it disappears once everything's caught up.
  There's also a manual "Sync now" button if you don't want to wait.
- Previously visited pages also open even with **zero network at all**
  (not just a slow connection) — a service worker caches the app shell
  itself, not just the data.

**What this means in practice:** you can be out collecting repayments in
an area with no signal, keep adding loans and repayments the whole time,
and everything saves normally. Walk back into coverage and it syncs on
its own — nothing to remember to do.

**One limitation to know:** since there's no editing feature (only
adding loans/repayments), there's no possibility of two conflicting
edits to reconcile — the sync is a simple queue-and-replay, not a full
conflict-resolution system.

### Testing it yourself
In Chrome DevTools: **Network tab → Throttling dropdown → Offline**. Add
a loan or repayment, confirm it appears immediately, then switch back to
"No throttling" and watch the status bar clear as it syncs.

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
