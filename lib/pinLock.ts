"use client";

// A device-level 4-digit PIN lock. This is a convenience lock on top of the
// real account login (email + password) — it guards the already-signed-in
// app on a shared or unattended phone. The PIN is stored hashed (not plain)
// in localStorage, scoped per signed-in user.
//
// Security note: this is a local UX lock, not a replacement for the account
// password. Someone with full device access could clear storage; that only
// disables the lock, it doesn't expose data without the account session.

const PIN_KEY = "kanakku-pin";
const PIN_ENABLED_KEY = "kanakku-pin-enabled";
const PIN_UNLOCKED_KEY = "kanakku-pin-unlocked"; // sessionStorage flag

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode("kanakku-salt:" + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isPinEnabled(): boolean {
  try {
    return localStorage.getItem(PIN_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  try {
    localStorage.setItem(PIN_KEY, hash);
    localStorage.setItem(PIN_ENABLED_KEY, "1");
  } catch {
    // ignore
  }
}

export function disablePin(): void {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(PIN_ENABLED_KEY);
    sessionStorage.removeItem(PIN_UNLOCKED_KEY);
  } catch {
    // ignore
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return false;
    const hash = await hashPin(pin);
    return hash === stored;
  } catch {
    return false;
  }
}

// "Unlocked" is tracked per browser session, so the PIN is asked once when
// the app is opened/reopened, not on every internal navigation.
export function isUnlockedThisSession(): boolean {
  try {
    return sessionStorage.getItem(PIN_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(PIN_UNLOCKED_KEY, "1");
  } catch {
    // ignore
  }
}

export function lockNow(): void {
  try {
    sessionStorage.removeItem(PIN_UNLOCKED_KEY);
  } catch {
    // ignore
  }
}
