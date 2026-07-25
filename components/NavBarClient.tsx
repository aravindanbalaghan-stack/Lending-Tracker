"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";

// Primary destinations get a bottom tab bar on mobile and inline links on
// desktop. Secondary items (Missed, Import, Backup) live under Settings to
// keep the mobile screen uncluttered.
const PRIMARY: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: "/dashboard", labelKey: "nav_dashboard", icon: "▤" },
  { href: "/borrowers", labelKey: "nav_borrowers", icon: "☰" },
  { href: "/repay", labelKey: "nav_repay", icon: "₹" },
  { href: "/delayed", labelKey: "nav_delayed", icon: "⏱" },
  { href: "/settings", labelKey: "nav_settings", icon: "⚙" },
];

const DESKTOP_LINKS: { href: string; labelKey: TranslationKey }[] = [
  { href: "/dashboard", labelKey: "nav_dashboard" },
  { href: "/borrowers", labelKey: "nav_borrowers" },
  { href: "/repay", labelKey: "nav_repay" },
  { href: "/delayed", labelKey: "nav_delayed" },
  { href: "/missed", labelKey: "nav_missed" },
  { href: "/import", labelKey: "nav_import" },
  { href: "/backup", labelKey: "nav_backup" },
  { href: "/settings", labelKey: "nav_settings" },
];

export default function NavBarClient({ hasUser }: { hasUser: boolean }) {
  const { t } = useLanguage();
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <header className="border-b border-ledger-line bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-forest text-brass-soft text-sm font-serif">
              ₹
            </span>
            <span className="font-serif text-lg text-ink">{t("appName")}</span>
          </Link>

          {/* Desktop links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-3 text-sm flex-wrap justify-end">
            {DESKTOP_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isActive(link.href)
                    ? "text-ink font-medium"
                    : "text-ink-soft hover:text-ink"
                }
              >
                {t(link.labelKey)}
              </Link>
            ))}
            <Link
              href="/borrowers/new"
              className="rounded-md bg-forest text-white px-3 py-1.5 font-medium hover:opacity-90"
            >
              {t("nav_newLoan")}
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile bottom tab bar — hidden on desktop */}
      {hasUser && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ledger-line flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {PRIMARY.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 ${
                  active ? "text-forest" : "text-ink-soft"
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-[10px] leading-none">
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
