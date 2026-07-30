"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ensureLocalDataMatchesUser } from "@/lib/offline/db";
import { getLastBackup } from "@/lib/lastBackup";
import DeletedRecords from "@/components/DeletedRecords";
import { useLanguage } from "@/components/LanguageProvider";

export default function SettingsClient() {
  const { lang, setLang, t } = useLanguage();
  const [email, setEmail] = useState<string | null>(null);
  const [lastBackup, setLastBackupState] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
      if (user?.id) setLastBackupState(getLastBackup(user.id));
    })();
  }, []);

  const locale = lang === "ta" ? "ta-IN" : "en-IN";
  const lastBackupText = lastBackup
    ? new Date(lastBackup).toLocaleDateString(locale, {
                      timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : t("settings_backupNever");

  async function handleSignOut() {
    await ensureLocalDataMatchesUser(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="max-w-xl">
      <div className="hidden md:block">
        <h1 className="font-serif text-2xl text-ink mb-1">{t("settings_title")}</h1>
      <p className="text-sm text-ink-soft mb-6">{t("settings_subtitle")}</p>
      </div>

      {/* Account */}
      <div className="rounded-lg border border-ledger-line bg-white p-4 mb-4">
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">
          {t("settings_account")}
        </p>
        <p className="text-sm text-ink break-all">{email ?? "…"}</p>
      </div>

      {/* Data */}
      <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line mb-4 overflow-hidden">
        <Link
          href="/backup"
          className="flex items-center justify-between px-4 py-3.5 hover:bg-paper transition"
        >
          <span>
            <span className="text-sm text-ink">{t("nav_backup")}</span>
            <span className="block text-xs text-ink-soft">
              {t("settings_lastBackup")}: {lastBackupText}
            </span>
          </span>
          <span className="text-ink-soft">›</span>
        </Link>
        <Link
          href="/import"
          className="flex items-center justify-between px-4 py-3.5 hover:bg-paper transition"
        >
          <span className="text-sm text-ink">{t("nav_import")}</span>
          <span className="text-ink-soft">›</span>
        </Link>
      </div>

      {/* Language */}
      <div className="rounded-lg border border-ledger-line bg-white p-4 mb-4">
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">
          {t("settings_language")}
        </p>
        <div className="flex rounded-md border border-ledger-line overflow-hidden text-sm w-fit">
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-1.5 ${
              lang === "en" ? "bg-forest text-white" : "text-ink-soft"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang("ta")}
            className={`px-4 py-1.5 ${
              lang === "ta" ? "bg-forest text-white" : "text-ink-soft"
            }`}
          >
            தமிழ்
          </button>
        </div>
      </div>

      <div className="mb-4">
        <DeletedRecords />
      </div>

      <button
        onClick={handleSignOut}
        className="w-full rounded-lg border border-ledger-line bg-white px-4 py-3.5 text-sm text-rust hover:bg-paper transition text-left"
      >
        {t("nav_signOut")}
      </button>
    </div>
  );
}
