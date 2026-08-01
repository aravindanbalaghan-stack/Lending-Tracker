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
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // CRITICAL ORDER: push any pending local changes to the server FIRST,
      // before the user-guard might clear the cache. This prevents the
      // data-loss case where freshly-imported records that hadn't synced yet
      // were wiped on the next login. processOutbox is safe to run for the
      // signed-in user; it only sends what's queued.
      if (navigator.onLine && session?.user?.id) {
        try {
          await syncNow();
        } catch {
          // best-effort; guard below still runs
        }
      }

      // Now it's safe to reconcile the cache with the signed-in user. The
      // guard itself also refuses to clear while the outbox is non-empty.
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

    // Safety net: every 30s, if online, flush anything still queued. This
    // means a change never waits for a manual sync — worst case it syncs
    // within half a minute, and usually immediately on creation.
    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        triggerSync();
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
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
