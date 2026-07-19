"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAllLoans,
  getAllRepayments,
  subscribeDb,
  type LoanRecord,
  type RepaymentRecord,
} from "@/lib/offline/db";

export function useLocalData() {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [repayments, setRepayments] = useState<RepaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [l, r] = await Promise.all([getAllLoans(), getAllRepayments()]);
    setLoans(l);
    setRepayments(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from IndexedDB on mount
    reload();
    const unsubscribe = subscribeDb(reload);
    return unsubscribe;
  }, [reload]);

  return { loans, repayments, loading };
}
