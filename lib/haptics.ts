// A short vibration on supported devices (most Android phones). iOS Safari
// doesn't support the Vibration API, so this is a no-op there — harmless.
export function haptic(pattern: number | number[] = 30) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}
