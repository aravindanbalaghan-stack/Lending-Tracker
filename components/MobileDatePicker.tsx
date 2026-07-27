"use client";

import { useMemo } from "react";
import { dateKey } from "@/lib/calculations";
import { useLanguage } from "@/components/LanguageProvider";

// Compact 3-column Day / Month / Year selector for mobile, where the full
// calendar grid feels cramped. Selecting any part updates the chosen date.
export default function MobileDatePicker({
  selected,
  onSelect,
}: {
  selected: string; // yyyy-mm-dd
  onSelect: (date: string) => void;
}) {
  const { lang } = useLanguage();
  const [yStr, mStr, dStr] = selected.split("-");
  const year = Number(yStr);
  const month = Number(mStr); // 1-12
  const day = Number(dStr);

  const locale = lang === "ta" ? "ta-IN" : "en-IN";

  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" })
      ),
    [locale]
  );

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  // A sensible range of years around now.
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i);

  function build(y: number, m: number, d: number) {
    // Clamp day to the number of days in the new month/year.
    const maxDay = new Date(y, m, 0).getDate();
    const safeDay = Math.min(d, maxDay);
    return `${y}-${String(m).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
  }

  const selectClass =
    "flex-1 rounded-md border border-ledger-line bg-white px-2 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest";

  return (
    <div className="flex gap-2">
      <select
        value={day}
        onChange={(e) => onSelect(build(year, month, Number(e.target.value)))}
        className={selectClass}
        aria-label="Day"
      >
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onSelect(build(year, Number(e.target.value), day))}
        className={selectClass}
        aria-label="Month"
      >
        {monthNames.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onSelect(build(Number(e.target.value), month, day))}
        className={selectClass}
        aria-label="Year"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

// Re-export so callers can also validate keys if needed.
export { dateKey };
