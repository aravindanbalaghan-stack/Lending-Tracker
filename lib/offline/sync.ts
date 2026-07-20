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
}> {
  const supabase = createClient();
  const entries = await getOutbox();
  entries.sort((a, b) => a.localId - b.localId);

  let synced = 0;
  // Process strictly in order: a repayment created offline may reference a
  // loan created offline in the same session, so the loan must sync first.
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
        // record already reached the server on an earlier attempt — e.g.
        // the insert succeeded but the response was lost. Treat that as
        // synced instead of retrying it forever. (Upserts don't hit this,
        // but inserts can.)
        const isDuplicate = error.code === "23505";
        if (!isDuplicate) {
          lastError = error.message;
          console.error("Sync failed:", entry.type, error.message);
          return { synced, failed: true };
        }
      } else {
        lastError = null;
      }

      await removeOutboxEntry(entry.localId);
      synced++;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Sync failed.";
      console.error("Sync failed:", entry.type, err);
      return { synced, failed: true };
    }
  }
  return { synced, failed: false };
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
  if (!failed) {
    await pullFromServer();
  }
}
