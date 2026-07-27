"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  getAllLoans,
  getAllRepayments,
  getAllDailyEntries,
  getSettings,
  subscribeDb,
  type LoanRecord,
  type RepaymentRecord,
  type DailyEntryRecord,
  type SettingsRecord,
} from "@/lib/offline/db";
import { DEFAULT_SETTINGS } from "@/lib/dailyDetails";
import { purgeExpiredLoansOffline } from "@/lib/offline/actions";

type LocalData = {
  loans: LoanRecord[]; // active (not soft-deleted) only
  deletedLoans: LoanRecord[]; // soft-deleted, for the Settings bin
  repayments: RepaymentRecord[];
  dailyEntries: DailyEntryRecord[];
  settings: SettingsRecord;
  loading: boolean;
};

const LocalDataContext = createContext<LocalData | null>(null);

// Loads everything from IndexedDB ONCE at the app level and keeps it in
// memory, refreshing only when the local database actually changes (via the
// subscribeDb pub-sub). Every page reads from this shared cache, so moving
// between tabs is instant instead of re-reading IndexedDB and flashing a
// blank screen each time.
export function LocalDataProvider({ children }: { children: React.ReactNode }) {
  const [allLoans, setAllLoans] = useState<LoanRecord[]>([]);
  const [repayments, setRepayments] = useState<RepaymentRecord[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntryRecord[]>([]);
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [l, r, d, s] = await Promise.all([
      getAllLoans(),
      getAllRepayments(),
      getAllDailyEntries(),
      getSettings(),
    ]);
    setAllLoans(l);
    setRepayments(r);
    setDailyEntries(d);
    setSettings(s ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from IndexedDB on mount
    reload();
    // Clean up anything past the 8-day retention window on app open, so the
    // bin doesn't accumulate stale records even if its screen is never opened.
    purgeExpiredLoansOffline(8).then((r) => {
      if (r.purged > 0) reload();
    });
    const unsubscribe = subscribeDb(reload);
    return unsubscribe;
  }, [reload]);

  // Active loans (shown everywhere) vs soft-deleted (shown only in the bin).
  const loans = useMemo(
    () => allLoans.filter((l) => !l.deleted_at),
    [allLoans]
  );
  const deletedLoans = useMemo(
    () => allLoans.filter((l) => l.deleted_at),
    [allLoans]
  );

  return (
    <LocalDataContext.Provider
      value={{
        loans,
        deletedLoans,
        repayments,
        dailyEntries,
        settings: settings ?? DEFAULT_SETTINGS,
        loading,
      }}
    >
      {children}
    </LocalDataContext.Provider>
  );
}

export function useLocalData(): LocalData {
  const ctx = useContext(LocalDataContext);
  if (!ctx) {
    throw new Error("useLocalData must be used within LocalDataProvider");
  }
  return ctx;
}
