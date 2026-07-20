"use client";

import { createClient } from "@/lib/supabase/client";
import {
  putLoan,
  putLoans,
  putRepayment,
  putDailyEntry,
  putSettings,
  enqueueOutbox,
  type LoanRecord,
  type RepaymentRecord,
  type DailyEntryRecord,
  type SettingsRecord,
} from "@/lib/offline/db";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function createLoanOffline(
  input: Omit<LoanRecord, "id" | "lender_id">
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const loan: LoanRecord = {
    id: crypto.randomUUID(),
    lender_id: userId,
    ...input,
  };

  // Write locally first — this is what makes the UI update instantly and
  // work offline. Syncing to Supabase happens after, best-effort.
  await putLoan(loan);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase.from("loans").insert(loan);
    if (error) {
      console.error("Loan sync failed, queued for retry:", error.message);
      await enqueueOutbox("insert_loan", loan);
    }
  } else {
    await enqueueOutbox("insert_loan", loan);
  }

  return { ok: true, id: loan.id };
}

export async function createRepaymentOffline(
  input: Omit<RepaymentRecord, "id" | "lender_id">
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const repayment: RepaymentRecord = {
    id: crypto.randomUUID(),
    lender_id: userId,
    ...input,
  };

  await putRepayment(repayment);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase.from("repayments").insert(repayment);
    if (error) {
      console.error("Repayment sync failed, queued for retry:", error.message);
      await enqueueOutbox("insert_repayment", repayment);
    }
  } else {
    await enqueueOutbox("insert_repayment", repayment);
  }

  return { ok: true };
}

export async function saveDailyEntry(
  entryDate: string,
  values: { opening_balance: number; expenses: number }
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const entry: DailyEntryRecord = {
    entry_date: entryDate,
    lender_id: userId,
    opening_balance: values.opening_balance,
    expenses: values.expenses,
  };

  await putDailyEntry(entry);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("daily_entries")
      .upsert(entry, { onConflict: "lender_id,entry_date" });
    if (error) await enqueueOutbox("upsert_daily_entry", entry);
  } else {
    await enqueueOutbox("upsert_daily_entry", entry);
  }

  return { ok: true };
}

export async function saveSettings(
  values: Omit<SettingsRecord, "lender_id">
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const settings: SettingsRecord = { lender_id: userId, ...values };

  await putSettings(settings);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("lender_settings")
      .upsert(settings, { onConflict: "lender_id" });
    if (error) await enqueueOutbox("upsert_settings", settings);
  } else {
    await enqueueOutbox("upsert_settings", settings);
  }

  return { ok: true };
}

export async function createLoansBulkOffline(
  inputs: Omit<LoanRecord, "id" | "lender_id">[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, count: 0, error: "You must be signed in." };

  const loans: LoanRecord[] = inputs.map((i) => ({
    id: crypto.randomUUID(),
    lender_id: userId,
    ...i,
  }));

  await putLoans(loans);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const BATCH_SIZE = 200;
    for (let i = 0; i < loans.length; i += BATCH_SIZE) {
      const batch = loans.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("loans").insert(batch);
      if (error) await enqueueOutbox("insert_loans_bulk", batch);
    }
  } else {
    await enqueueOutbox("insert_loans_bulk", loans);
  }

  return { ok: true, count: loans.length };
}
