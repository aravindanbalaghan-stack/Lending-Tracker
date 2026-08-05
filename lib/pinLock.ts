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
const PIN_LAST_ACTIVE_KEY = "kanakku-pin-last-active"; // localStorage timestamp
const PIN_SESSION_KEY = "kanakku-pin-session"; // sessionStorage: same run?
const PIN_QUESTION_KEY = "kanakku-pin-question"; // security question (plain)
const PIN_RECOVERY_KEY = "kanakku-pin-recovery"; // PIN encrypted with the answer

// How long the app can be backgrounded/idle before the PIN is required again.
const LOCK_AFTER_MS = 60 * 60 * 1000; // 1 hour

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode("kanakku-salt:" + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---- Recovery via security question -------------------------------------
// To let a user recover a forgotten PIN, the PIN must be retrievable — but we
// never store it in plain text. Instead we encrypt it with a key derived from
// the security answer. Only the correct answer can decrypt it; a wrong answer
// simply fails to decrypt. This keeps the "show my PIN" feature possible
// without leaving the PIN readable on the device.

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKeyFromAnswer(answer: string): Promise<CryptoKey> {
  // Normalize so "Blue " and "blue" match — answers are case/space-insensitive.
  const normalized = answer.trim().toLowerCase();
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode("kanakku-recovery:" + normalized),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("kanakku-recovery-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPinWithAnswer(
  pin: string,
  answer: string
): Promise<string> {
  const key = await deriveKeyFromAnswer(answer);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(pin)
  );
  return JSON.stringify({ iv: toB64(iv), ct: toB64(new Uint8Array(ct)) });
}

export function isPinEnabled(): boolean {
  try {
    return localStorage.getItem(PIN_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasSecurityQuestion(): boolean {
  try {
    return (
      !!localStorage.getItem(PIN_QUESTION_KEY) &&
      !!localStorage.getItem(PIN_RECOVERY_KEY)
    );
  } catch {
    return false;
  }
}

export function getSecurityQuestion(): string | null {
  try {
    return localStorage.getItem(PIN_QUESTION_KEY);
  } catch {
    return null;
  }
}

// Recover the PIN by answering the security question. Returns the PIN string
// on the correct answer, or null if the answer is wrong (decryption fails).
export async function recoverPinWithAnswer(
  answer: string
): Promise<string | null> {
  try {
    const raw = localStorage.getItem(PIN_RECOVERY_KEY);
    if (!raw) return null;
    const { iv, ct } = JSON.parse(raw);
    const key = await deriveKeyFromAnswer(answer);
    const ivBytes = fromB64(iv);
    const ctBytes = fromB64(ct);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes as BufferSource },
      key,
      ctBytes as BufferSource
    );
    return new TextDecoder().decode(pt);
  } catch {
    // Wrong answer → AES-GCM auth tag mismatch → decrypt throws.
    return null;
  }
}

export async function setPin(
  pin: string,
  security?: { question: string; answer: string }
): Promise<void> {
  const hash = await hashPin(pin);
  try {
    localStorage.setItem(PIN_KEY, hash);
    localStorage.setItem(PIN_ENABLED_KEY, "1");
    if (security && security.question.trim() && security.answer.trim()) {
      const encrypted = await encryptPinWithAnswer(pin, security.answer);
      localStorage.setItem(PIN_QUESTION_KEY, security.question.trim());
      localStorage.setItem(PIN_RECOVERY_KEY, encrypted);
    }
  } catch {
    // ignore
  }
}

export function disablePin(): void {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(PIN_ENABLED_KEY);
    localStorage.removeItem(PIN_LAST_ACTIVE_KEY);
    localStorage.removeItem(PIN_QUESTION_KEY);
    localStorage.removeItem(PIN_RECOVERY_KEY);
    sessionStorage.removeItem(PIN_SESSION_KEY);
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

// Decide whether the app is currently unlocked WITHOUT needing the PIN.
//
// Two cases, deliberately different for security:
//   • Fresh app launch (cold start): sessionStorage is empty because it's
//     cleared when the app/tab is fully closed. In this case we ALWAYS
//     require the PIN, regardless of how recently it was last used.
//   • Backgrounding within the same run: sessionStorage still has our flag,
//     so we apply the 1-hour grace — returning within the hour skips the PIN,
//     after an hour it locks.
export function isUnlockedThisSession(): boolean {
  try {
    const sameSession = sessionStorage.getItem(PIN_SESSION_KEY) === "1";
    if (!sameSession) {
      // Fresh launch → must enter PIN.
      return false;
    }
    const raw = localStorage.getItem(PIN_LAST_ACTIVE_KEY);
    if (!raw) return false;
    const last = parseInt(raw, 10);
    if (Number.isNaN(last)) return false;
    return Date.now() - last < LOCK_AFTER_MS;
  } catch {
    return false;
  }
}

// Called on successful unlock and periodically while the app is active. Marks
// this as an active run (sessionStorage) and records the activity time
// (localStorage) so the 1-hour backgrounding grace is measured from last use.
export function markUnlocked(): void {
  try {
    sessionStorage.setItem(PIN_SESSION_KEY, "1");
    localStorage.setItem(PIN_LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function touchActivity(): void {
  // Only refresh the activity time; do not create a session flag (a fresh
  // launch must still require the PIN even if activity was recent).
  try {
    localStorage.setItem(PIN_LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function lockNow(): void {
  try {
    localStorage.removeItem(PIN_LAST_ACTIVE_KEY);
    sessionStorage.removeItem(PIN_SESSION_KEY);
  } catch {
    // ignore
  }
}
