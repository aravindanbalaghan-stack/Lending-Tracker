"use client";

import { createClient } from "@/lib/supabase/client";
import {
  getOutbox,
  removeOutboxEntry,
  putLoans,
  putRepayments,
  putDailyEntries,
  putSettings,
} from "@/lib/offline/db";

let lastError: string | null = null;
export function getLastSyncError(): string | null {
  return lastError;
}

export async function processOutbox(): Promise<{
  synced: number;
  failed: boolean;
  hadPermanentError: boolean;
}> {
  const supabase = createClient();
  const entries = await getOutbox();
  entries.sort((a, b) => a.localId - b.localId);

  let synced = 0;
  let hadPermanentError = false;
  // Process strictly in order: a repayment created offline may reference a
  // loan created offline in the same session, so the loan must sync first.
  // BUT a single un-processable entry must not block the whole queue forever
  // (e.g. a schema mismatch, or one malformed row). We distinguish:
  //   • transient errors (network, timeout, 5xx) -> stop and retry later
  //   • permanent errors (schema/constraint) -> skip that entry, keep going,
  //     so healthy records still reach the server
  for (const entry of entries) {
    try {
      let error: { message: string; code?: string } | null = null;

      if (entry.type === "insert_loan") {
        ({ error } = await supabase
          .from("loans")
          .insert(entry.payload as Record<string, unknown>));
      } else if (entry.type === "insert_repayment") {
        ({ error } = await supabase
          .from("repayments")
          .insert(entry.payload as Record<string, unknown>));
      } else if (entry.type === "insert_loans_bulk") {
        ({ error } = await supabase
          .from("loans")
          .insert(entry.payload as Record<string, unknown>[]));
      } else if (entry.type === "insert_repayments_bulk") {
        ({ error } = await supabase
          .from("repayments")
          .insert(entry.payload as Record<string, unknown>[]));
      } else if (entry.type === "update_loan") {
        const payload = entry.payload as {
          id: string;
          changes: Record<string, unknown>;
        };
        ({ error } = await supabase
          .from("loans")
          .update(payload.changes)
          .eq("id", payload.id));
      } else if (entry.type === "hard_delete_loan") {
        const payload = entry.payload as { id: string };
        ({ error } = await supabase
          .from("loans")
          .delete()
          .eq("id", payload.id));
      } else if (entry.type === "update_repayment") {
        const payload = entry.payload as {
          id: string;
          changes: Record<string, unknown>;
        };
        ({ error } = await supabase
          .from("repayments")
          .update(payload.changes)
          .eq("id", payload.id));
      } else if (entry.type === "rename_borrower") {
        const payload = entry.payload as {
          lender_id: string;
          old_name: string;
          new_name: string;
          new_name_ta: string | null;
        };
        ({ error } = await supabase
          .from("loans")
          .update({
            borrower_name: payload.new_name,
            borrower_name_ta: payload.new_name_ta,
          })
          .eq("lender_id", payload.lender_id)
          .eq("borrower_name", payload.old_name));
      } else if (entry.type === "upsert_daily_entry") {
        ({ error } = await supabase
          .from("daily_entries")
          .upsert(entry.payload as Record<string, unknown>, {
            onConflict: "lender_id,entry_date",
          }));
      } else if (entry.type === "upsert_settings") {
        ({ error } = await supabase
          .from("lender_settings")
          .upsert(entry.payload as Record<string, unknown>, {
            onConflict: "lender_id",
          }));
      }

      if (error) {
        // A duplicate-key error (Postgres code 23505) means this exact
        // record already reached the server on an earlier attempt — treat as
        // synced instead of retrying forever.
        const isDuplicate = error.code === "23505";
        if (isDuplicate) {
          await removeOutboxEntry(entry.localId);
          synced++;
          lastError = null;
          continue;
        }

        // Classify the failure. Transient (network/timeout/server) errors
        // should stop processing and retry later without dropping anything.
        // Permanent errors (bad schema, constraint violations) would block
        // the queue forever, so we record them but SKIP the entry and keep
        // going, letting healthy records through. The skipped entry is NOT
        // deleted — it stays queued so it can succeed once the underlying
        // issue (e.g. a missing DB column) is fixed.
        const code = error.code ?? "";
        const msg = (error.message ?? "").toLowerCase();
        const isTransient =
          msg.includes("network") ||
          msg.includes("timeout") ||
          msg.includes("fetch") ||
          msg.includes("temporarily") ||
          code.startsWith("5") ||
          code === "";

        lastError = error.message;
        console.error(
          `Sync ${isTransient ? "transient" : "permanent"} error:`,
          entry.type,
          error.message
        );

        if (isTransient) {
          // Stop; retry the whole remaining queue next time, in order.
          return { synced, failed: true, hadPermanentError };
        } else {
          // Permanent: leave the entry queued but move past it so it can't
          // wedge everything else. Surface the error to the user via the
          // banner (lastError). Do NOT count as synced, do NOT delete.
          hadPermanentError = true;
          continue;
        }
      } else {
        lastError = null;
      }

      await removeOutboxEntry(entry.localId);
      synced++;
    } catch (err) {
      // A thrown exception is almost always a network/connectivity problem
      // (fetch rejected) — treat as transient and retry later.
      lastError = err instanceof Error ? err.message : "Sync failed.";
      console.error("Sync threw (transient):", entry.type, err);
      return { synced, failed: true, hadPermanentError };
    }
  }
  return { synced, failed: false, hadPermanentError };
}

export async function pullFromServer(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [loansResult, repaymentsResult, dailyEntriesResult, settingsResult] =
    await Promise.all([
      supabase.from("loans").select("*"),
      supabase.from("repayments").select("*"),
      supabase.from("daily_entries").select("*"),
      supabase.from("lender_settings").select("*"),
    ]);

  // Upsert by id only — never delete local records. This preserves any
  // offline-created loan/repayment that hasn't synced yet, since it simply
  // won't appear in this server response until its outbox entry succeeds.
  if (loansResult.data) {
    await putLoans(loansResult.data as never[]);
  }
  if (repaymentsResult.data) {
    await putRepayments(repaymentsResult.data as never[]);
  }
  if (dailyEntriesResult.data) {
    await putDailyEntries(
      dailyEntriesResult.data.map((d: Record<string, unknown>) => ({
        entry_date: String(d.entry_date),
        lender_id: String(d.lender_id),
        opening_balance: Number(d.opening_balance),
        expenses: Number(d.expenses),
      }))
    );
  }
  if (settingsResult.data && settingsResult.data[0]) {
    const s = settingsResult.data[0] as Record<string, unknown>;
    await putSettings({
      lender_id: String(s.lender_id),
      mamai_rate: Number(s.mamai_rate),
      threshold_daily: Number(s.threshold_daily),
      threshold_weekly: Number(s.threshold_weekly),
      threshold_monthly: Number(s.threshold_monthly),
    });
  }
}

export async function syncNow(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const { failed } = await processOutbox();
  // Pull unless a transient failure stopped us mid-queue (in which case we'll
  // retry the push first next time). A permanent error doesn't block the
  // pull, since the healthy records still went through.
  if (!failed) {
    await pullFromServer();
  }
}
