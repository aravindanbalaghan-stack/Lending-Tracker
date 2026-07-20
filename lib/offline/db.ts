"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "kanakku-book";
const DB_VERSION = 3;

export type LoanRecord = {
  id: string;
  lender_id: string;
  borrower_name: string;
  borrower_name_ta: string | null;
  principal: number;
  interest_rate: number;
  payback_amount: number;
  installments_count: number;
  collection_schedule: string;
  given_at: string;
  notes: string | null;
};

export type RepaymentRecord = {
  id: string;
  loan_id: string;
  lender_id: string;
  amount: number;
  payment_mode: string;
  paid_at: string;
};

export type DailyEntryRecord = {
  entry_date: string; // yyyy-mm-dd, primary key locally
  lender_id: string;
  opening_balance: number;
  expenses: number;
};

export type SettingsRecord = {
  lender_id: string; // primary key
  mamai_rate: number;
  threshold_daily: number;
  threshold_weekly: number;
  threshold_monthly: number;
};

export type OutboxEntry = {
  localId: number;
  type:
    | "insert_loan"
    | "insert_repayment"
    | "insert_loans_bulk"
    | "insert_repayments_bulk"
    | "update_loan"
    | "update_repayment"
    | "rename_borrower"
    | "upsert_daily_entry"
    | "upsert_settings";
  payload: unknown;
  createdAt: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("loans")) {
          db.createObjectStore("loans", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("repayments")) {
          const store = db.createObjectStore("repayments", { keyPath: "id" });
          store.createIndex("loan_id", "loan_id");
        }
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", {
            keyPath: "localId",
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains("dailyEntries")) {
          db.createObjectStore("dailyEntries", { keyPath: "entry_date" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "lender_id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// Tiny pub-sub so React hooks know to re-read after any local write.
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeDb(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify() {
  listeners.forEach((fn) => fn());
}

export async function getAllLoans(): Promise<LoanRecord[]> {
  const db = await getDb();
  return db.getAll("loans");
}

export async function getAllRepayments(): Promise<RepaymentRecord[]> {
  const db = await getDb();
  return db.getAll("repayments");
}

export async function putLoan(loan: LoanRecord) {
  const db = await getDb();
  await db.put("loans", loan);
  notify();
}

export async function putLoans(loans: LoanRecord[]) {
  if (loans.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("loans", "readwrite");
  await Promise.all(loans.map((l) => tx.store.put(l)));
  await tx.done;
  notify();
}

export async function putRepayment(repayment: RepaymentRecord) {
  const db = await getDb();
  await db.put("repayments", repayment);
  notify();
}

export async function putRepayments(repayments: RepaymentRecord[]) {
  if (repayments.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("repayments", "readwrite");
  await Promise.all(repayments.map((r) => tx.store.put(r)));
  await tx.done;
  notify();
}

export async function getAllDailyEntries(): Promise<DailyEntryRecord[]> {
  const db = await getDb();
  return db.getAll("dailyEntries");
}

export async function putDailyEntry(entry: DailyEntryRecord) {
  const db = await getDb();
  await db.put("dailyEntries", entry);
  notify();
}

export async function putDailyEntries(entries: DailyEntryRecord[]) {
  if (entries.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("dailyEntries", "readwrite");
  await Promise.all(entries.map((e) => tx.store.put(e)));
  await tx.done;
  notify();
}

export async function getSettings(): Promise<SettingsRecord | undefined> {
  const db = await getDb();
  const all = await db.getAll("settings");
  return all[0];
}

export async function putSettings(settings: SettingsRecord) {
  const db = await getDb();
  await db.put("settings", settings);
  notify();
}

export async function enqueueOutbox(
  type: OutboxEntry["type"],
  payload: unknown
) {
  const db = await getDb();
  await db.add("outbox", {
    type,
    payload,
    createdAt: new Date().toISOString(),
  } as OutboxEntry);
  notify();
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  const db = await getDb();
  return db.getAll("outbox");
}

export async function removeOutboxEntry(localId: number) {
  const db = await getDb();
  await db.delete("outbox", localId);
  notify();
}

export async function clearAllLocalData() {
  const db = await getDb();
  await Promise.all([
    db.clear("loans"),
    db.clear("repayments"),
    db.clear("outbox"),
    db.clear("dailyEntries"),
    db.clear("settings"),
  ]);
  notify();
}

// Guards against one browser's local cache ever showing a different
// account's data — e.g. two test accounts used on the same device. Call
// this with the currently authenticated user's id (or null if signed out)
// on every app load and every sign-in. If the cache belongs to a
// different user (or we can't tell whose it is, such as right after
// this check was introduced), it wipes the local cache so a fresh,
// correctly-scoped pull happens from the server.
export async function ensureLocalDataMatchesUser(
  userId: string | null
): Promise<void> {
  const db = await getDb();
  const metaRecord = await db.get("meta", "currentUserId").catch(() => undefined);
  const storedUserId: string | undefined = metaRecord?.value;

  if (!userId) {
    await clearAllLocalData();
    await db.delete("meta", "currentUserId").catch(() => {});
    return;
  }

  if (storedUserId !== userId) {
    await clearAllLocalData();
    await db.put("meta", { key: "currentUserId", value: userId });
  }
}
