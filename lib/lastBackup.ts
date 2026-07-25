"use client";

// Single source of truth for the "last backup" timestamp, shared by the
// weekly auto-backup prompt, the manual Backup page, and the Settings screen
// so the date shown is always accurate regardless of which one ran.

export function lastBackupKey(userId: string) {
  return `kanakku-last-backup:${userId}`;
}

export function getLastBackup(userId: string): number | null {
  try {
    const raw = localStorage.getItem(lastBackupKey(userId));
    return raw ? parseInt(raw) : null;
  } catch {
    return null;
  }
}

export function setLastBackup(userId: string, when: number = Date.now()) {
  try {
    localStorage.setItem(lastBackupKey(userId), String(when));
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}
