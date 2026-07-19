"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "kanakku-book";
const DB_VERSION = 1;

export type LoanRecord = {
  id: string;
  lender_id: string;
  borrower_name: string;
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
  paid_at: string;
};

export type OutboxEntry = {
  localId: number;
  type: "insert_loan" | "insert_repayment" | "insert_loans_bulk";
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
  ]);
  notify();
}
