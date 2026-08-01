# Kanakku Book — Lending Ledger

(In the app itself the name displays as **கணக்கு Book** — "Kanakku" in
Tamil script, "Book" in English, as requested.)

A web app (mobile-friendly) for tracking money you've lent out: who you gave
money to, the interest, what they owe back, and every repayment with a
timestamp — plus a daily collections dashboard for the last 15 days.

## Data-safety hardening audit (latest)

A full review of every data-persistence path, to make data loss structurally
very unlikely:

- **Outbox-first bulk import.** Imports now record every batch in the durable
  outbox BEFORE the direct insert, then remove each batch only once the server
  confirms it. If the browser is killed or the network drops mid-import, the
  batches survive and sync on next open. (This directly addresses the earlier
  200-borrower loss.)
- **Local-write failures no longer fail silently.** Every create/save wraps
  the local IndexedDB write in error handling and reports failure instead of
  falsely showing success (important on iOS Safari, where storage can reject).
- **One bad record can't block the whole sync queue.** Sync now separates
  transient errors (network/timeout/5xx → retry in order) from permanent ones
  (schema/constraint → skip that entry, keep the rest flowing, leave it queued
  to succeed once fixed). Previously a single schema mismatch (like a missing
  column) stalled ALL syncing.
- **Duplicate-safe retries.** Records already on the server (duplicate key) are
  treated as synced, so retries never loop forever or double-insert.
- **Every network call is now wrapped** so a thrown fetch queues to the outbox
  rather than crashing the save.
- Sync errors are surfaced prominently in the banner so a stuck state is
  visible, not silent.

No database migration is needed for this update. (But ensure migrations
007-010 have been run in Supabase — a missing column is exactly the kind of
permanent error the queue now tolerates instead of stalling on.)

## Sync reliability — data-loss fix (latest)

Fixes the "imported yesterday, gone today" problem and hardens auto-sync.

**Root cause found:** on login, the app reconciled the local cache with the
signed-in user, and that reconciliation could clear local data BEFORE pending
(unsynced) changes were pushed to the server. Combined with a single all-or-
nothing 200-row import batch, a failed/unfinished sync meant freshly imported
borrowers lived only on the device — and were wiped on the next login.

**Fixes:**
- The local cache is NEVER cleared while the outbox still has unsynced items
  — those changes are kept and flushed first.
- On app start, pending changes are pushed to the server BEFORE any cache
  reconciliation.
- Bulk import now inserts in small batches (50) with a per-batch outbox
  fallback, so one bad row can't lose the whole import, and any failed chunk
  is durably queued for retry.
- Import triggers an immediate sync and waits for it before showing "done".
- A background sync runs every 30s (when online) as a safety net, so nothing
  waits for a manual sync. Single creates already synced immediately; this
  covers everything else.

No database migration is needed for this update.

## Testing bug fixes (latest)

1. **Settled borrowers no longer show Repay on swipe** — the swipe action
   only appears when there's an outstanding balance.
2. **"Start new loan" prompt only on the latest loan** — for a borrower with
   several settled loans, only the most recent one offers to start a new
   loan; older loans still show their history but no renew button.
3. **Repay tab no longer auto-opens the keyboard** — the search box is no
   longer auto-focused; tap it when you want to search.
4. **CSV backup is now re-importable** — the CSV backup uses the exact same
   columns as Import (Name, Name (Tamil), Amount, Interest Rate, Installments,
   Display Order, Phone, Schedule, Date Given, Notes), so a backup file can be
   loaded straight back through Import to restore borrowers. The JSON backup
   still holds everything including repayment history.

No database migration is needed for this update.

## Mobile batch: phone, swipe-repay, dark-mode fix, sync status (latest)

- **Home tidy-up** — removed the "Repayments received / New loans given"
  descriptive labels on mobile (amounts kept), and removed the Total-pending
  card. The green "Collected today" card stays.
- **Swipe = Repay** — swiping a borrower row (Borrowers and Delayed) now
  reveals a green Repay action that opens the repayment form for that person.
- **Dark mode background fixed** — a leftover boilerplate CSS rule was forcing
  a white page background in dark mode; removed. The whole page is now dark.
- **Phone numbers + tap-to-call** — optional phone field on the New Loan and
  Edit forms, and importable from a "Phone" CSV column. When set, the number
  shows under the borrower's name with a 📞 in both Borrowers and Delayed;
  tapping it dials from the phone.
- **Haptic feedback** — a short buzz when a payment is recorded (on devices
  that support vibration; iOS ignores it harmlessly).
- **Sync status indicator** — a small chip in the top bar shows Synced ✓ /
  Saving… / Syncing… / Offline so you can trust your data state.
- **iOS fullscreen meta tags** added so the app runs without Safari's URL bar
  when launched from the home-screen icon.

### Database change required
Run `supabase/migrations/010_phone_number.sql` in Supabase's SQL Editor
(adds a nullable `phone` column). If you haven't already, also run `009`.

### Note on the Delayed tab
Swipe-to-repay and phone display were added there. Drag-and-drop was
intentionally NOT added to Delayed — that list auto-sorts by most-overdue,
which is more useful than manual ordering for an exceptions list.

## Faster tabs + PIN lock (latest)

**Much faster tab switching.** Every page used to run a server-side auth
check (a network round-trip) on each navigation, causing a ~2s delay. Since
the auth middleware already guarantees you're signed in on these pages, that
per-tab check was removed — pages now render instantly from a static shell
and load data from the shared local cache. Added loading skeletons on
navigation so switching feels immediate.

**Optional app PIN lock.** In Settings → App lock, you can set a 4-digit PIN
(numbers only). Once on, opening the app shows a keypad that must be unlocked
with the PIN before the app is accessible. You can change or turn it off from
the same place. The PIN is stored hashed on the device, and is asked once per
app open (not on every internal screen).

Notes: the PIN is a device-level convenience lock on top of the normal
account login — it's set per device, so a user enables it on each phone they
use. No database migration is needed for this update.

## Richer mobile experience (latest)

- **Daily summary card** on the dashboard — two headline figures at the top:
  what you've collected today, and the total still pending across all loans.
  The numbers a lender checks each morning.
- **Swipe to delete** — on mobile, swipe a borrower row left to reveal a
  Delete action (soft-delete, recoverable from the bin). The drag handle
  still handles reordering; the row body handles swipe.
- **Loading skeletons** — screens now show placeholder shapes while data
  loads instead of flashing blank, so the app feels faster.
- **Dark mode** — a Light/Dark toggle in Settings → Appearance. Follows your
  device preference the first time, then remembers your choice. Set before
  first paint, so no light-mode flash on open.

No database migration is needed for this update.

## Fix: drag order no longer bleeds between screens (latest)

Reordering in the Borrowers list and the Repay tab were sharing one order
value, but the two screens show different sets of loans (Repay hides paid
ones), so dragging in one could rearrange the other. Each screen now has its
own independent order — dragging in Repay never disturbs Borrowers and vice
versa.

### Database change required
Run `supabase/migrations/009_repay_display_order.sql` in Supabase's SQL
Editor. Adds a `repay_display_order` column (default 0); touches nothing
existing.

## Cleaner mobile UI (latest)

Reclaimed a lot of vertical space on phones (all desktop layouts unchanged):

- **Page titles and subtitles hidden on mobile** — the bottom tab bar already
  says which screen you're on, so the big "Dashboard" / "Borrowers" / etc.
  headers were redundant. They still show on desktop.
- **Thinner top bar on mobile** — smaller logo, app name, and padding.
- **Tighter spacing** — reduced the gaps between sections and the page
  padding on mobile so more fits on screen.
- **Dashboard date line simplified on mobile** — the date picker already shows
  the selected date, so the long "Wednesday, 30 July 2026" line is replaced by
  just the day's total ("Total: ₹…"). Desktop keeps the full date.
- Language toggle stays in Settings only (not the top bar).

No database migration is needed for this update.

## Drag to reorder in Quick Payment too (latest)

The Repay (Quick Payment) tab now supports the same drag-to-reorder as the
Borrowers list. Grab the handle (⠿) on any row and drag within its group
(Daily, each weekday, or Monthly) to rearrange. Works on web and mobile.

Reordering uses the same display_order as the Borrowers list, so a borrower's
position stays consistent between the two screens.

No database migration is needed for this update (it reuses the display_order
column added earlier).

## Reorder borrowers (latest)

You can now control the order borrowers appear in within each date section on
the Borrowers list:

- **Drag to reorder** — grab the handle (⠿) on any borrower row and drag it up
  or down. Works with a mouse on the web and with your finger on mobile. The
  new order is saved and syncs across devices.
- **Display order field on New Loan** — an optional number field. Lower
  numbers show first within that loan's date. Leave it blank to add at the
  end (you can still drag it later).
- **Import support** — spreadsheets can include a "Display Order" column,
  auto-detected during import.

Ordering is within each date (the list is grouped by date), and falls back to
alphabetical for borrowers that share the same number.

### Database change required
Run `supabase/migrations/008_display_order.sql` in Supabase's SQL Editor. It
adds a `display_order` column to loans (default 0) and touches nothing
existing.

## Deleted-records tidy-ups (latest)

- **The Deleted records section in Settings is now collapsed by default** —
  it shows just a count ("N deleted record(s) — tap to view") and expands to
  the full list only when you tap it.
- **Fixed "Unknown" payments on the dashboard.** Repayments belonging to a
  deleted loan were showing as "Unknown" in the day view and still counting
  in the daily total. They're now excluded consistently — from the day's
  repayment list and from the cash totals — matching how the loan is hidden
  everywhere else. (Restoring the loan brings its repayments back into the
  dashboard too.)

No database migration is needed for this update.

## Delete with recycle bin (latest)

Loans can now be deleted, with a safety net:

- Each loan on a borrower's page has a **Delete** button that asks for
  confirmation first.
- Deleting doesn't remove anything immediately — the loan (with all its
  repayments) moves to a **Deleted records** bin in Settings, and disappears
  from every normal screen.
- The bin shows a **countdown** for each item ("N days left before permanent
  deletion").
- **Restore** brings the borrower back exactly as before — every repayment
  and detail intact, because nothing was actually removed, just hidden.
- After **8 days**, deleted loans are permanently purged automatically (this
  happens both on app open and when the bin is viewed). There's also a manual
  "Delete now" with its own confirmation for immediate permanent removal.

### Database change required
Run `supabase/migrations/007_soft_delete.sql` in Supabase's SQL Editor. It
adds a `deleted_at` column to loans and touches nothing existing. The file
also contains an OPTIONAL server-side auto-purge (pg_cron) you can enable if
you want purging to happen even when nobody opens the app — not required, the
app handles it client-side.

## Mobile polish, IST time, and renew fix (latest)

**Mobile date picker instead of calendar.** On phones the dashboard now shows
three compact Day / Month / Year dropdowns (defaulting to today) instead of
the full calendar grid, which was cramped. Desktop keeps the calendar.

**All times are now IST.** Date/day logic was reworked to use Asia/Kolkata
consistently, so a repayment made late at night is filed under the correct
Indian calendar day regardless of the device or server timezone. All
displayed dates and times now show in IST too.

**Import & Backup removed from the top bar** — they live in Settings only now
(reachable there and on the desktop Settings page).

**Fixed the mobile bottom tabs.** Equal-width columns, no more label
overlap/misalignment, short labels that fit, and a small highlighter bar above
the active tab so you can see which screen you're on. (Kept at the bottom —
that's the right place for mobile; left-side tabs would hide navigation
behind an extra tap.)

**Renew prompt fix.** A settled loan no longer shows the "start a new loan?"
option if the borrower already has another open loan. Once you create a new
loan for an old borrower, their old settled loan stops offering to renew.

No database migration is needed for this update.

## Refinements (latest)

- **Removed the duplicate language toggle** from the top bar — language now
  lives only in Settings.
- **Smarter Tamil name handling** — if you type the borrower's name directly
  in Tamil script, the separate Tamil field is left empty instead of being
  filled with a wrong auto-guess. Transliteration only runs when you type in
  English, as intended.
- **Faster tab switching** — local data now loads once at app start and is
  shared across every screen, instead of each tab re-reading the local
  database and briefly showing a blank screen. Moving between tabs is now
  instant.
- **Last backup date in Settings** — the Backup row shows when you last
  backed up. Both the weekly auto-backup and any manual backup update it.

No database migration is needed for this update.

## Mobile view, settings, password reset (latest)

**Cleaner mobile layout.** On phones the crowded top row of links is replaced
by a **bottom tab bar** (Dashboard, Borrowers, Repay, Delayed, Settings) —
the pattern native apps use — plus a floating **+** button for a new loan.
Desktop keeps the full top navigation unchanged.

**New Settings tab** with: the signed-in email, links to Backup and Import,
the language switch, and sign out. (Import and Backup still work from the
desktop top bar too.)

**Password reset.** The login screen now has a "Forgot password?" link. It
emails a reset link that opens a new *Set a new password* screen. This relies
on email delivery being configured — see EMAIL-SETUP-GUIDE.md.

**Email/signup limit (important):** the 2-signups issue is a Supabase email
limit, not an app bug. The fix is connecting a free email provider (custom
SMTP), which keeps verification ON and also powers password resets. Full
steps in EMAIL-SETUP-GUIDE.md — it's a ~15-minute dashboard setup, no code.

No database migration is needed for this update.

## Renewals, day breakdown, and delayed payments (latest)

**Start a new loan when one is cleared.** When a borrower pays a loan off in
full, a prompt appears on that loan offering to start a fresh one. Say yes,
type the new amount, save — and a new loan is created for them carrying over
their existing rate, schedule and installment count, dated today.

> **A note on how this is stored:** the new loan is recorded as a *new* entry
> for the same borrower rather than overwriting the settled one. Overwriting
> would have broken the maths — every repayment is linked to its loan, so
> resetting that loan's amount and date would make the old repayments count
> against the new amount and the loan would look partly paid the moment it
> was created. It would also erase the borrower's payment history. Because
> the Borrowers list groups by person, the borrower still shows a single
> entry with the new amount and today's date — which is the behaviour you
> wanted — while the old record stays intact underneath for reference.

**Dashboard day view now has two sections.** Clicking a date shows
*Repayments received* (money in) and, below it, *New loans given* (money
out), each with its own total.

**New "Delayed payments" tab** (Tamil: நிப்பு புள்ளிகள்). Any loan still
outstanding past its allowed window moves out of Borrowers and into this tab,
so each borrower appears in exactly one place. The window uses the same
per-schedule thresholds you configure on the dashboard — days for Daily,
weeks for Weekly, months for Monthly. Record a repayment here; once the loan
is fully cleared the borrower drops out of this tab automatically and the
"start a new loan?" prompt appears, returning them to the normal Borrowers
list.

No database migration is needed for this update.

## PWA-ready for easy APK generation (latest)

The app is now fully prepared to be packaged into an Android APK using
**PWABuilder** (free, no Android Studio needed). See **PWA-APK-GUIDE.md**.

What was added to make it pass cleanly:
- Manifest now includes `id`, `scope`, `lang`, `dir`, `categories`, app
  `shortcuts` (New Loan / Quick Repay), and `display_override`.
- Proper **maskable icons** with safe-zone padding (`icon-192-maskable.png`,
  `icon-512-maskable.png`) so the icon isn't clipped when Android crops it
  to a circle.
- **Screenshots** (mobile + desktop) for a richer install prompt.
- A **Digital Asset Links** file at `public/.well-known/assetlinks.json`
  (placeholder — you paste in the fingerprint PWABuilder gives you) so the
  installed app runs full-screen with no browser address bar.

The installed PWA keeps all existing behaviour: login, approval gate, offline
support, per-user data isolation, and auto-update on deploy.

## Approval gate, APK, and weekly backup (latest)

### Approve users before they can access the app
New sign-ups now land in a **"waiting for approval"** state and can't see any
data until you approve them. How it works:
- When someone registers, a row is auto-created in a `user_approvals` table
  with status `pending`.
- They're held on a waiting screen; the app won't let them reach any data
  page, and the database itself (row-level security) also blocks their data
  until approved — two layers.
- **To approve someone:** open Supabase → Table Editor → `user_approvals`,
  find their row (by email), and change `status` from `pending` to
  `approved`. That's it — they can get in on their next check.
- To block someone later, set their status to `blocked`.

Run `supabase/migrations/006_approval_gate.sql` to enable this. Until you run
it, the gate stays inactive and the app behaves as before (so nothing breaks
if you deploy the code before running the migration). **Note:** you'll need
to approve your own account once after enabling this.

If you'd rather get an email or push notification on each signup instead of
checking Supabase, that can be added — Supabase can fire a webhook on new
rows — but it's a separate piece to wire up.

### Android APK
The project is now set up with Capacitor to build an installable Android APK.
See **APK-BUILD-GUIDE.md** for the full steps. Key points:
- The APK wraps your live web app, so login, the approval gate, offline
  support, and per-user data isolation all work inside it exactly as on the
  web.
- **It auto-updates when you deploy** — you only rebuild the APK for name/icon
  changes.
- The actual `.apk` file must be compiled on your machine with Android Studio
  (it can't be produced in the build environment here); everything is
  configured and the commands are in the guide.

### Automatic weekly backup
Once a week, when you open the app, a bar appears offering to save a full
backup of your data. Tap it and the app generates a dated JSON file — on a
phone, the save sheet lets you send it straight to Google Drive; on desktop
it goes to your downloads. It only prompts once per week per account.

**Honest note on "automatic to Google Drive":** a version that silently
uploads to your Drive every week *without you doing anything*, even when the
app is closed, would need Google sign-in permissions, a stored access token,
and a scheduled server job — a much larger piece of infrastructure. The
in-app weekly prompt above gives you the same safety (a real weekly backup
file) with a single tap and none of that complexity. If you later want the
fully-silent Drive version, it can be built as a separate project.

## Better Tamil transliteration

The English→Tamil auto-suggestion was retrained against real name examples
and is noticeably more accurate now. It correctly handles nasal sounds
(Venkatesh → வெங்க...), the ச sound for "s" in names like Saranya →
சரண்யா, and long vowels in common name endings (Kumar → குமார், Ramesh →
ரமேஷ், Deepa → தீபா). It passes 13 of 14 names in the internal test set.

It's still a best-effort phonetic tool, not perfect — a few genuinely
ambiguous cases remain (e.g. a mid-word "t" that's retroflex in one name
but dental in another can't be told apart from spelling alone). The Tamil
name field stays fully editable everywhere, so any residual mismatch is a
one-time fix that sticks.

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
