"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function NavBarClient({ hasUser }: { hasUser: boolean }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="border-b border-ledger-line bg-white">
      <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-forest text-brass-soft text-sm font-serif">
            ₹
          </span>
          <span className="font-serif text-lg text-ink">{t("appName")}</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm flex-wrap justify-end">
          <Link href="/dashboard" className="text-ink-soft hover:text-ink">
            {t("nav_dashboard")}
          </Link>
          <Link href="/borrowers" className="text-ink-soft hover:text-ink">
            {t("nav_borrowers")}
          </Link>
          <Link href="/repay" className="text-ink-soft hover:text-ink">
            {t("nav_repay")}
          </Link>
          <Link href="/missed" className="text-ink-soft hover:text-ink">
            {t("nav_missed")}
          </Link>
          <Link href="/import" className="text-ink-soft hover:text-ink">
            {t("nav_import")}
          </Link>
          <Link href="/backup" className="text-ink-soft hover:text-ink">
            {t("nav_backup")}
          </Link>
          <Link
            href="/borrowers/new"
            className="rounded-md bg-forest text-white px-3 py-1.5 font-medium hover:opacity-90"
          >
            {t("nav_newLoan")}
          </Link>

          <div className="flex rounded-md border border-ledger-line overflow-hidden text-xs">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1 ${
                lang === "en" ? "bg-forest text-white" : "text-ink-soft"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("ta")}
              className={`px-2 py-1 ${
                lang === "ta" ? "bg-forest text-white" : "text-ink-soft"
              }`}
            >
              த
            </button>
          </div>

          {hasUser && (
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="text-ink-soft hover:text-rust text-xs"
              >
                {t("nav_signOut")}
              </button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
