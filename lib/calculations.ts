export function paybackAmount(principal: number, ratePercent: number): number {
  return round2(principal * (1 + ratePercent / 100));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function installmentAmount(payback: number, count: number): number {
  return round2(payback / Math.max(1, count));
}

// India Standard Time is UTC+5:30, and India does not observe DST, so a
// fixed offset is correct year-round. All "which day" logic goes through
// these helpers so a repayment is filed under the correct IST calendar day
// no matter what timezone the device or server is in.
export const IST_TIME_ZONE = "Asia/Kolkata";

// yyyy-mm-dd for the given moment, as seen in IST. Uses en-CA because it
// formats as yyyy-mm-dd, which is exactly the key shape we want.
export function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Today's date in IST, as {year, month, day} numbers — used to default the
// mobile date pickers and the calendar to the current IST day.
export function istTodayParts(): { year: number; month: number; day: number } {
  const key = dateKey(new Date()); // yyyy-mm-dd in IST
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function last15Days(): string[] {
  const days: string[] = [];
  const base = new Date();
  for (let i = 0; i < 15; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}
