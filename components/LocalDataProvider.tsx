"use client";

import {
  createContext,
  useContext,
  useEffect,
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

type LocalData = {
  loans: LoanRecord[];
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
  const [loans, setLoans] = useState<LoanRecord[]>([]);
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
    setLoans(l);
    setRepayments(r);
    setDailyEntries(d);
    setSettings(s ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from IndexedDB on mount
    reload();
    const unsubscribe = subscribeDb(reload);
    return unsubscribe;
  }, [reload]);

  return (
    <LocalDataContext.Provider
      value={{
        loans,
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
