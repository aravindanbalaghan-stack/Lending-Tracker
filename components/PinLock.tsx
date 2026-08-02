"use client";

import { useEffect, useState } from "react";
import {
  isPinEnabled,
  isUnlockedThisSession,
  markUnlocked,
  touchActivity,
  verifyPin,
} from "@/lib/pinLock";
import { useLanguage } from "@/components/LanguageProvider";

// Wraps the app. If a PIN is set and this session hasn't been unlocked yet,
// it covers everything with a keypad until the correct PIN is entered.
export default function PinLock({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [checked, setChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const needsLock = isPinEnabled() && !isUnlockedThisSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time lock check on mount
    setLocked(needsLock);
    setChecked(true);

    if (!isPinEnabled()) return;

    // While the app is open and unlocked, record activity periodically so the
    // 1-hour idle window is measured from the last time it was actually used.
    const activity = setInterval(() => {
      if (isPinEnabled() && isUnlockedThisSession()) {
        touchActivity();
      }
    }, 60 * 1000);

    // When the app is brought back to the foreground (or the tab regains
    // focus), re-check whether the idle window has elapsed. If it has, lock.
    const recheck = () => {
      if (document.visibilityState === "visible") {
        if (isPinEnabled() && !isUnlockedThisSession()) {
          setLocked(true);
        } else if (isPinEnabled() && isUnlockedThisSession()) {
          touchActivity();
        }
      }
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);

    return () => {
      clearInterval(activity);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, []);

  async function submit(pin: string) {
    if (await verifyPin(pin)) {
      markUnlocked();
      setLocked(false);
      setEntry("");
      setError(false);
    } else {
      setError(true);
      setEntry("");
      // brief shake/clear
      setTimeout(() => setError(false), 800);
    }
  }

  function press(digit: string) {
    if (entry.length >= 4) return;
    const next = entry + digit;
    setEntry(next);
    if (next.length === 4) {
      submit(next);
    }
  }

  function backspace() {
    setEntry((e) => e.slice(0, -1));
  }

  // Avoid a flash of the app before we've checked lock state.
  if (!checked) return null;
  if (!locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-paper flex flex-col items-center justify-center px-6">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-forest text-brass-soft text-2xl font-serif mb-4">
        ₹
      </div>
      <h1 className="font-serif text-xl text-ink mb-1">{t("pin_enterTitle")}</h1>
      <p className="text-sm text-ink-soft mb-6">{t("pin_enterSubtitle")}</p>

      {/* Dots showing progress */}
      <div className={`flex gap-3 mb-8 ${error ? "animate-pulse" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border ${
              entry.length > i
                ? error
                  ? "bg-rust border-rust"
                  : "bg-forest border-forest"
                : "border-ledger-line"
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-rust mb-4 -mt-4">{t("pin_wrong")}</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="h-16 rounded-xl bg-white border border-ledger-line text-2xl text-ink active:bg-paper"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          onClick={() => press("0")}
          className="h-16 rounded-xl bg-white border border-ledger-line text-2xl text-ink active:bg-paper"
        >
          0
        </button>
        <button
          onClick={backspace}
          className="h-16 rounded-xl text-xl text-ink-soft active:bg-paper"
          aria-label={t("pin_backspace")}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
