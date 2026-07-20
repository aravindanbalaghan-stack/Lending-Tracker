"use client";

import { useState } from "react";
import { formatINR } from "@/lib/calculations";
import type { DaySummary } from "@/lib/dailyDetails";
import { saveDailyEntry, saveSettings } from "@/lib/offline/actions";
import type { SettingsRecord } from "@/lib/offline/db";

export default function DailyDetailsCard({
  date,
  summary,
  settings,
}: {
  date: string;
  summary: DaySummary;
  settings: Omit<SettingsRecord, "lender_id">;
}) {
  const [opening, setOpening] = useState(String(summary.munnirupu || ""));
  const [expenses, setExpenses] = useState(String(summary.selavu || ""));
  const [showSettings, setShowSettings] = useState(false);

  function commit(nextOpening: string, nextExpenses: string) {
    saveDailyEntry(date, {
      opening_balance: parseFloat(nextOpening) || 0,
      expenses: parseFloat(nextExpenses) || 0,
    });
  }

  return (
    <div className="rounded-lg border border-ledger-line bg-white p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="முன்னிருப்பு" hint="Opening balance" editable>
          <input
            type="number"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            onBlur={() => commit(opening, expenses)}
            className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </Field>

        <Field label="வசூல்" hint="Total collected">
          <p className="tabular text-sm text-forest font-medium">
            {formatINR(summary.vasool)}
          </p>
        </Field>

        <Field label="நடப்பு வரவு" hint="On-time collection">
          <p className="tabular text-sm text-ink">
            {formatINR(summary.nadapuVaravu)}
          </p>
        </Field>

        <Field label="நிபு வரவு" hint="Other collection">
          <p className="tabular text-sm text-ink">
            {formatINR(summary.nibuVaravu)}
          </p>
        </Field>

        <Field label="மைமை" hint={`Rate: ${settings.mamai_rate}/1000`}>
          <p className="tabular text-sm text-brass font-medium">
            {formatINR(summary.mamai)}
          </p>
        </Field>

        <Field label="செலவு" hint="Expenses" editable>
          <input
            type="number"
            value={expenses}
            onChange={(e) => setExpenses(e.target.value)}
            onBlur={() => commit(opening, expenses)}
            className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </Field>

        <Field label="அடப்பு" hint="Amount given">
          <p className="tabular text-sm text-rust font-medium">
            {formatINR(summary.adappu)}
          </p>
        </Field>

        <Field label="மொத்தம்" hint="Total">
          <p className="tabular text-base text-ink font-semibold">
            {formatINR(summary.total)}
          </p>
        </Field>
      </div>

      <div className="mt-4 pt-3 border-t border-ledger-line">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="text-xs text-forest font-medium underline underline-offset-2"
        >
          {showSettings ? "Hide settings" : "மைமை rate & நடப்பு வரவு thresholds"}
        </button>
        {showSettings && <SettingsPanel settings={settings} />}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  editable,
  children,
}: {
  label: string;
  hint: string;
  editable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-md p-2.5 ${editable ? "bg-brass-soft" : "bg-paper"}`}
    >
      <p className="text-xs text-ink font-medium">{label}</p>
      <p className="text-[10px] text-ink-soft mb-1">{hint}</p>
      {children}
    </div>
  );
}

function SettingsPanel({
  settings,
}: {
  settings: Omit<SettingsRecord, "lender_id">;
}) {
  const [rate, setRate] = useState(String(settings.mamai_rate));
  const [daily, setDaily] = useState(String(settings.threshold_daily));
  const [weekly, setWeekly] = useState(String(settings.threshold_weekly));
  const [monthly, setMonthly] = useState(String(settings.threshold_monthly));
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await saveSettings({
      mamai_rate: parseFloat(rate) || 0,
      threshold_daily: parseInt(daily) || 0,
      threshold_weekly: parseInt(weekly) || 0,
      threshold_monthly: parseInt(monthly) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div>
        <label className="block text-[10px] text-ink-soft mb-1">
          மைமை per 1000
        </label>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>
      <div>
        <label className="block text-[10px] text-ink-soft mb-1">
          Daily threshold (days)
        </label>
        <input
          type="number"
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
          className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>
      <div>
        <label className="block text-[10px] text-ink-soft mb-1">
          Weekly threshold (weeks)
        </label>
        <input
          type="number"
          value={weekly}
          onChange={(e) => setWeekly(e.target.value)}
          className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>
      <div>
        <label className="block text-[10px] text-ink-soft mb-1">
          Monthly threshold (months)
        </label>
        <input
          type="number"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          className="w-full rounded-md border border-ledger-line px-2 py-1.5 text-sm tabular focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <button
          onClick={handleSave}
          className="rounded-md bg-forest text-white text-xs font-medium px-3 py-1.5 hover:opacity-90"
        >
          {saved ? "Saved ✓" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
