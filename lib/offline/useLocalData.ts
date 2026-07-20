"use client";

import { useEffect, useState, useCallback } from "react";
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

export function useLocalData() {
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

  return {
    loans,
    repayments,
    dailyEntries,
    settings: settings ?? DEFAULT_SETTINGS,
    loading,
  };
}
