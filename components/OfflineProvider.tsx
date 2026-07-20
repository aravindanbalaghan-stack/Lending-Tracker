"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getOutbox, subscribeDb, ensureLocalDataMatchesUser } from "@/lib/offline/db";
import { syncNow, getLastSyncError } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";

type OfflineContextValue = {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastError: string | null;
  triggerSync: () => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const outbox = await getOutbox();
    setPendingCount(outbox.length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
      setLastError(getLastSyncError());
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser's online status on mount
    setIsOnline(navigator.onLine);

    async function init() {
      // Guard first: make sure the local cache actually belongs to
      // whoever is currently signed in before reading or syncing anything.
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await ensureLocalDataMatchesUser(session?.user?.id ?? null);

      refreshPendingCount();
      if (navigator.onLine) triggerSync();
    }
    init();

    function handleOnline() {
      setIsOnline(true);
      triggerSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const unsubscribe = subscribeDb(refreshPendingCount);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OfflineContext.Provider
      value={{ isOnline, pendingCount, syncing, lastError, triggerSync }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return ctx;
}
