"use client";

import { createClient } from "@/lib/supabase/client";
import {
  getOutbox,
  removeOutboxEntry,
  putLoans,
  putRepayments,
} from "@/lib/offline/db";

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
      if (entry.type === "insert_loan") {
        const { error } = await supabase
          .from("loans")
          .insert(entry.payload as Record<string, unknown>);
        if (error) throw error;
      } else if (entry.type === "insert_repayment") {
        const { error } = await supabase
          .from("repayments")
          .insert(entry.payload as Record<string, unknown>);
        if (error) throw error;
      } else if (entry.type === "insert_loans_bulk") {
        const { error } = await supabase
          .from("loans")
          .insert(entry.payload as Record<string, unknown>[]);
        if (error) throw error;
      }
      await removeOutboxEntry(entry.localId);
      synced++;
    } catch {
      // Stop here and retry the rest next time — could be offline again,
      // or a genuine error; either way don't skip ahead out of order.
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

  const [loansResult, repaymentsResult] = await Promise.all([
    supabase.from("loans").select("*"),
    supabase.from("repayments").select("*"),
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
}

export async function syncNow(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const { failed } = await processOutbox();
  if (!failed) {
    await pullFromServer();
  }
}
