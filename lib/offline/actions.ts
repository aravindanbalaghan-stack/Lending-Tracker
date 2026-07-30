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
  deleteLoanLocal,
  deleteRepaymentsForLoanLocal,
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
  input: Omit<
    LoanRecord,
    "id" | "lender_id" | "deleted_at" | "display_order" | "repay_display_order"
  > & {
    display_order?: number;
  }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const { display_order, ...rest } = input;
  const loan: LoanRecord = {
    id: crypto.randomUUID(),
    lender_id: userId,
    deleted_at: null,
    display_order: display_order ?? 0,
    repay_display_order: display_order ?? 0,
    ...rest,
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
    | "id"
    | "lender_id"
    | "borrower_name"
    | "borrower_name_ta"
    | "deleted_at"
    | "display_order"
    | "repay_display_order"
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

// Soft-delete: mark the loan with a deletion timestamp instead of removing
// it. It vanishes from all normal views but stays in the database so it can
// be restored from the Deleted-records bin within 8 days.
export async function softDeleteLoanOffline(
  loanId: string
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const existing = (await getAllLoans()).find((l) => l.id === loanId);
  if (!existing) return { ok: false, error: "Loan not found locally." };

  const deletedAt = new Date().toISOString();
  await putLoan({ ...existing, deleted_at: deletedAt });

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("loans")
      .update({ deleted_at: deletedAt })
      .eq("id", loanId);
    if (error) {
      await enqueueOutbox("update_loan", {
        id: loanId,
        changes: { deleted_at: deletedAt },
      });
    }
  } else {
    await enqueueOutbox("update_loan", {
      id: loanId,
      changes: { deleted_at: deletedAt },
    });
  }

  return { ok: true };
}

// Restore a soft-deleted loan: clear its deletion timestamp. Because
// repayments were never touched (they stay attached to the loan by loan_id),
// the borrower reappears with all their history exactly as before.
export async function restoreLoanOffline(
  loanId: string
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const existing = (await getAllLoans()).find((l) => l.id === loanId);
  if (!existing) return { ok: false, error: "Loan not found locally." };

  await putLoan({ ...existing, deleted_at: null });

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("loans")
      .update({ deleted_at: null })
      .eq("id", loanId);
    if (error) {
      await enqueueOutbox("update_loan", {
        id: loanId,
        changes: { deleted_at: null },
      });
    }
  } else {
    await enqueueOutbox("update_loan", {
      id: loanId,
      changes: { deleted_at: null },
    });
  }

  return { ok: true };
}

// Permanently remove loans (and their repayments) whose deletion is older
// than the retention window. Runs client-side on app open; also available as
// a manual "delete now" from the bin. This is a real, irreversible delete.
export async function purgeExpiredLoansOffline(
  retentionDays = 8
): Promise<{ ok: boolean; purged: number }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, purged: 0 };

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const expired = (await getAllLoans()).filter(
    (l) => l.deleted_at && new Date(l.deleted_at).getTime() < cutoff
  );
  if (expired.length === 0) return { ok: true, purged: 0 };

  for (const loan of expired) {
    await hardDeleteLoanLocalAndRemote(loan.id);
  }
  return { ok: true, purged: expired.length };
}

// Immediately, permanently delete one loan and its repayments (used by the
// "Delete permanently" button in the bin, and by the purge above).
export async function hardDeleteLoanOffline(
  loanId: string
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };
  await hardDeleteLoanLocalAndRemote(loanId);
  return { ok: true };
}

async function hardDeleteLoanLocalAndRemote(loanId: string): Promise<void> {
  await deleteLoanLocal(loanId);
  await deleteRepaymentsForLoanLocal(loanId);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    // Repayments cascade-delete in the DB via the foreign key, but we delete
    // explicitly too so an offline-queued action is unambiguous.
    const { error } = await supabase.from("loans").delete().eq("id", loanId);
    if (error) {
      await enqueueOutbox("hard_delete_loan", { id: loanId });
    }
  } else {
    await enqueueOutbox("hard_delete_loan", { id: loanId });
  }
}

// Persist a new display order for a set of loans (one date section's worth,
// after a drag-and-drop). Each entry pairs a loan id with its new order
// number. Updates local cache immediately, then the server (queuing if
// offline), so the arrangement survives reloads and syncs across devices.
export async function reorderLoansOffline(
  orders: { id: string; display_order: number }[],
  field: "display_order" | "repay_display_order" = "display_order"
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };

  const all = await getAllLoans();
  const orderById = new Map(orders.map((o) => [o.id, o.display_order]));
  const updated = all
    .filter((l) => orderById.has(l.id))
    .map((l) => ({ ...l, [field]: orderById.get(l.id)! }));
  await putLoans(updated);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    for (const o of orders) {
      const { error } = await supabase
        .from("loans")
        .update({ [field]: o.display_order })
        .eq("id", o.id);
      if (error) {
        await enqueueOutbox("update_loan", {
          id: o.id,
          changes: { [field]: o.display_order },
        });
      }
    }
  } else {
    for (const o of orders) {
      await enqueueOutbox("update_loan", {
        id: o.id,
        changes: { [field]: o.display_order },
      });
    }
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
  inputs: (Omit<
    LoanRecord,
    | "id"
    | "lender_id"
    | "deleted_at"
    | "display_order"
    | "repay_display_order"
  > & { display_order?: number })[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, count: 0, error: "You must be signed in." };

  const loans: LoanRecord[] = inputs.map((i) => {
    const { display_order, ...rest } = i;
    return {
      id: crypto.randomUUID(),
      lender_id: userId,
      deleted_at: null,
      display_order: display_order ?? 0,
      repay_display_order: display_order ?? 0,
      ...rest,
    };
  });

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
