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

// yyyy-mm-dd in local time, used as the key for "which day" a payment falls on
export function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function last15Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}
