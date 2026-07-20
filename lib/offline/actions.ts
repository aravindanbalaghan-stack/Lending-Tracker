"use client";

import { createClient } from "@/lib/supabase/client";
import {
  putLoan,
  putLoans,
  putRepayment,
  putRepayments,
  putDailyEntry,
  putSettings,
  enqueueOutbox,
  getAllLoans,
  getAllRepayments,
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

export async function createRepaymentsBulkOffline(
  inputs: Omit<RepaymentRecord, "id" | "lender_id">[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, count: 0, error: "You must be signed in." };

  const repayments: RepaymentRecord[] = inputs.map((i) => ({
    id: crypto.randomUUID(),
    lender_id: userId,
    ...i,
  }));

  await putRepayments(repayments);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const BATCH_SIZE = 200;
    for (let i = 0; i < repayments.length; i += BATCH_SIZE) {
      const batch = repayments.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("repayments").insert(batch);
      if (error) await enqueueOutbox("insert_repayments_bulk", batch);
    }
  } else {
    await enqueueOutbox("insert_repayments_bulk", repayments);
  }

  return { ok: true, count: repayments.length };
}

export async function updateLoanOffline(
  loanId: string,
  changes: Omit<
    LoanRecord,
    "id" | "lender_id" | "borrower_name" | "borrower_name_ta"
  >
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const existing = (await getAllLoans()).find((l) => l.id === loanId);
  if (!existing) return { ok: false, error: "Loan not found locally." };

  const updated: LoanRecord = { ...existing, ...changes };
  await putLoan(updated);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("loans")
      .update(changes)
      .eq("id", loanId);
    if (error) {
      await enqueueOutbox("update_loan", { id: loanId, changes });
    }
  } else {
    await enqueueOutbox("update_loan", { id: loanId, changes });
  }

  return { ok: true };
}

export async function updateRepaymentOffline(
  repaymentId: string,
  changes: { amount: number; payment_mode: string; paid_at: string }
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const existing = (await getAllRepayments()).find(
    (r) => r.id === repaymentId
  );
  if (!existing) return { ok: false, error: "Repayment not found locally." };

  const updated: RepaymentRecord = { ...existing, ...changes };
  await putRepayment(updated);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("repayments")
      .update(changes)
      .eq("id", repaymentId);
    if (error) {
      await enqueueOutbox("update_repayment", { id: repaymentId, changes });
    }
  } else {
    await enqueueOutbox("update_repayment", { id: repaymentId, changes });
  }

  return { ok: true };
}

export async function renameBorrowerOffline(
  oldName: string,
  newName: string,
  newNameTa: string | null
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };
  if (!newName.trim()) return { ok: false, error: "Name cannot be empty." };

  const affected = (await getAllLoans()).filter(
    (l) => l.borrower_name === oldName
  );
  await putLoans(
    affected.map((l) => ({
      ...l,
      borrower_name: newName.trim(),
      borrower_name_ta: newNameTa?.trim() || null,
    }))
  );

  const payload = {
    lender_id: userId,
    old_name: oldName,
    new_name: newName.trim(),
    new_name_ta: newNameTa?.trim() || null,
  };

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("loans")
      .update({
        borrower_name: newName.trim(),
        borrower_name_ta: newNameTa?.trim() || null,
      })
      .eq("lender_id", userId)
      .eq("borrower_name", oldName);
    if (error) {
      await enqueueOutbox("rename_borrower", payload);
    }
  } else {
    await enqueueOutbox("rename_borrower", payload);
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
