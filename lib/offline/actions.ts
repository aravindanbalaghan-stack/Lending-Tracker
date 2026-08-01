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
  enqueueOutboxReturningId,
  removeOutboxEntry,
  getAllLoans,
  getAllRepayments,
  deleteLoanLocal,
  deleteRepaymentsForLoanLocal,
  type LoanRecord,
  type RepaymentRecord,
  type DailyEntryRecord,
  type SettingsRecord,
} from "@/lib/offline/db";

// Sentinel returned when a server request takes too long. Callers treat this
// like a failure and queue the change to the outbox for durable retry.
const TIMED_OUT = Symbol("timed-out");

type InsertError = { message: string; code?: string } | null;

// Race a Supabase insert/update against a timeout so flaky connectivity can't
// freeze the UI. Returns the error (or null on success), or TIMED_OUT.
async function withInsertTimeout(
  promise: PromiseLike<{ error: InsertError }>,
  ms = 3000
): Promise<InsertError | typeof TIMED_OUT> {
  const timeout = new Promise<typeof TIMED_OUT>((resolve) =>
    setTimeout(() => resolve(TIMED_OUT), ms)
  );
  const result = await Promise.race([
    Promise.resolve(promise).then((r) => r.error),
    timeout,
  ]);
  return result;
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  // getSession() reads the persisted session from local storage and should
  // not require the network. But to be safe against any implementation that
  // attempts a token refresh (which would hang offline), we race it against a
  // short timeout and fall back to reading the stored session directly. This
  // is critical: offline creates must never hang waiting on auth.
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1500)
    );
    const result = await Promise.race([sessionPromise, timeout]);
    if (result && "data" in result) {
      const id = result.data.session?.user?.id;
      if (id) return id;
    }
  } catch {
    // fall through to the cached lookup below
  }

  // Fallback: read the Supabase session straight from localStorage. The
  // supabase-js client persists it under a key like "sb-<ref>-auth-token".
  try {
    if (typeof localStorage !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const id =
              parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
            if (id) return id;
          }
        }
      }
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

export async function createLoanOffline(
  input: Omit<
    LoanRecord,
    | "id"
    | "lender_id"
    | "deleted_at"
    | "display_order"
    | "repay_display_order"
    | "phone"
  > & {
    display_order?: number;
    phone?: string | null;
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
    phone: null,
    ...rest,
  };

  // Write locally first — this is what makes the UI update instantly and
  // work offline. If this throws (quota, private mode, etc.) we surface it
  // rather than pretending the save worked.
  try {
    await putLoan(loan);
  } catch (e) {
    console.error("Local save failed:", e);
    return { ok: false, error: "Could not save locally. Please try again." };
  }

  // Durably queue for sync, then return IMMEDIATELY so the UI never waits on
  // the network. The actual server push happens in the background (below) and
  // removes this queued entry on success; if the app closes first, the next
  // sync flushes it. This makes Save feel instant online, offline, or on a
  // flaky connection.
  const entryId = await enqueueOutboxReturningId("insert_loan", loan);

  // Fire-and-forget background push. We intentionally do NOT await this.
  if (typeof navigator !== "undefined" && navigator.onLine) {
    void (async () => {
      try {
        const supabase = createClient();
        const insert = supabase.from("loans").insert(loan);
        const error = await withInsertTimeout(insert);
        if (error !== TIMED_OUT && (!error || error.code === "23505")) {
          // Reached the server (or already there) → drop the queued copy.
          await removeOutboxEntry(entryId);
        }
        // On timeout or real error, leave it queued for automatic retry.
      } catch (e) {
        console.error("Background loan sync failed, will retry:", e);
      }
    })();
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

  try {
    await putRepayment(repayment);
  } catch (e) {
    console.error("Local save failed:", e);
    return { ok: false, error: "Could not save locally. Please try again." };
  }

  // Queue durably, return immediately, push in the background (same pattern as
  // loan creation) so recording a payment is instant regardless of network.
  const entryId = await enqueueOutboxReturningId("insert_repayment", repayment);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    void (async () => {
      try {
        const supabase = createClient();
        const insert = supabase.from("repayments").insert(repayment);
        const error = await withInsertTimeout(insert);
        if (error !== TIMED_OUT && (!error || error.code === "23505")) {
          await removeOutboxEntry(entryId);
        }
      } catch (e) {
        console.error("Background repayment sync failed, will retry:", e);
      }
    })();
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

  try {
    await putDailyEntry(entry);
  } catch (e) {
    console.error("Local save failed:", e);
    return { ok: false, error: "Could not save locally. Please try again." };
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("daily_entries")
        .upsert(entry, { onConflict: "lender_id,entry_date" });
      if (error) await enqueueOutbox("upsert_daily_entry", entry);
    } catch {
      await enqueueOutbox("upsert_daily_entry", entry);
    }
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

  try {
    await putSettings(settings);
  } catch (e) {
    console.error("Local save failed:", e);
    return { ok: false, error: "Could not save locally. Please try again." };
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("lender_settings")
        .upsert(settings, { onConflict: "lender_id" });
      if (error) await enqueueOutbox("upsert_settings", settings);
    } catch {
      await enqueueOutbox("upsert_settings", settings);
    }
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

  try {
    await putRepayments(repayments);
  } catch (e) {
    console.error("Local bulk repayment save failed:", e);
    return {
      ok: false,
      count: 0,
      error: "Could not save the import locally. Please try again.",
    };
  }

  const BATCH_SIZE = 50;
  const batches: { entryId: number; batch: RepaymentRecord[] }[] = [];
  for (let i = 0; i < repayments.length; i += BATCH_SIZE) {
    const batch = repayments.slice(i, i + BATCH_SIZE);
    const entryId = await enqueueOutboxReturningId(
      "insert_repayments_bulk",
      batch
    );
    batches.push({ entryId, batch });
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    for (const { entryId, batch } of batches) {
      try {
        const { error } = await supabase.from("repayments").insert(batch);
        if (!error || error.code === "23505") {
          await removeOutboxEntry(entryId);
        } else {
          console.error("Repayment import batch failed, will retry:", error.message);
        }
      } catch (e) {
        console.error("Repayment import batch threw, will retry:", e);
      }
    }
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
    | "phone"
  > & { display_order?: number; phone?: string | null })[]
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
      phone: null,
      ...rest,
    };
  });

  try {
    await putLoans(loans);
  } catch (e) {
    console.error("Local bulk save failed:", e);
    return {
      ok: false,
      count: 0,
      error: "Could not save the import locally. Please try again.",
    };
  }

  // OUTBOX-FIRST durability: queue every batch to the outbox BEFORE attempting
  // the direct insert. This is the key protection against "imported, then
  // gone" — even if the browser is killed mid-import or the network drops, the
  // batches are durably recorded and will sync on the next app open. We then
  // try a direct insert for speed; on success we remove that batch's outbox
  // entry, on failure we leave it for automatic retry.
  const BATCH_SIZE = 50;
  const batches: { entryId: number; batch: LoanRecord[] }[] = [];
  for (let i = 0; i < loans.length; i += BATCH_SIZE) {
    const batch = loans.slice(i, i + BATCH_SIZE);
    const entryId = await enqueueOutboxReturningId("insert_loans_bulk", batch);
    batches.push({ entryId, batch });
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const supabase = createClient();
    for (const { entryId, batch } of batches) {
      try {
        const { error } = await supabase.from("loans").insert(batch);
        if (!error || error.code === "23505") {
          // Reached the server (or already there) → drop the queued copy.
          await removeOutboxEntry(entryId);
        } else {
          console.error("Import batch failed, will retry:", error.message);
        }
      } catch (e) {
        console.error("Import batch threw, will retry:", e);
      }
    }
  }

  return { ok: true, count: loans.length };
}
