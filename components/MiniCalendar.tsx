"use client";

import { useMemo, useState } from "react";
import { dateKey } from "@/lib/calculations";

export default function MiniCalendar({
  selected,
  onSelect,
  markedDates,
}: {
  selected: string;
  onSelect: (date: string) => void;
  markedDates?: Set<string>;
}) {
  const [viewDate, setViewDate] = useState(() => new Date(selected));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayKey = useMemo(() => dateKey(new Date()), []);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(dateKey(new Date(year, month, d)));
    }
    return arr;
  }, [year, month]);

  function goToMonth(offset: number) {
    setViewDate(new Date(year, month + offset, 1));
  }

  return (
    <div className="w-full max-w-[260px] rounded-lg border border-ledger-line bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => goToMonth(-1)}
          className="text-ink-soft hover:text-ink px-1.5 py-0.5 rounded hover:bg-paper"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-sm font-medium text-ink">
          {viewDate.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </p>
        <button
          onClick={() => goToMonth(1)}
          className="text-ink-soft hover:text-ink px-1.5 py-0.5 rounded hover:bg-paper"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-ink-soft mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((key, i) => {
          if (!key) return <div key={`empty-${i}`} />;
          const isSelected = key === selected;
          const isToday = key === todayKey;
          const hasActivity = markedDates?.has(key);
          const day = Number(key.slice(-2));
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`relative aspect-square rounded-md text-xs flex items-center justify-center transition ${
                isSelected
                  ? "bg-forest text-white"
                  : isToday
                  ? "bg-brass-soft text-ink"
                  : "text-ink hover:bg-paper"
              }`}
            >
              {day}
              {hasActivity && !isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-forest" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
