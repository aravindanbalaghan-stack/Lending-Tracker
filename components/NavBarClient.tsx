"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";

// Primary destinations get a bottom tab bar on mobile and inline links on
// desktop. Secondary items (Missed, Import, Backup) live under Settings to
// keep the mobile screen uncluttered.
const PRIMARY: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: "/dashboard", labelKey: "tab_dashboard", icon: "▤" },
  { href: "/borrowers", labelKey: "tab_borrowers", icon: "☰" },
  { href: "/repay", labelKey: "tab_repay", icon: "₹" },
  { href: "/delayed", labelKey: "tab_delayed", icon: "⏱" },
  { href: "/settings", labelKey: "tab_settings", icon: "⚙" },
];

const DESKTOP_LINKS: { href: string; labelKey: TranslationKey }[] = [
  { href: "/dashboard", labelKey: "nav_dashboard" },
  { href: "/borrowers", labelKey: "nav_borrowers" },
  { href: "/repay", labelKey: "nav_repay" },
  { href: "/delayed", labelKey: "nav_delayed" },
  { href: "/missed", labelKey: "nav_missed" },
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
        <div className="max-w-3xl mx-auto px-4 py-1.5 md:py-3 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full bg-forest text-brass-soft text-xs md:text-sm font-serif">
              ₹
            </span>
            <span className="font-serif text-base md:text-lg text-ink">
              {t("appName")}
            </span>
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
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ledger-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {PRIMARY.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center py-2 px-0.5 min-w-0 ${
                  active ? "text-forest" : "text-ink-soft"
                }`}
              >
                {/* Active highlighter bar across the top of the tab */}
                {active && (
                  <span className="absolute top-0 inset-x-2 h-0.5 rounded-full bg-forest" />
                )}
                <span className="text-lg leading-none mb-0.5">{item.icon}</span>
                <span className="text-[10px] leading-tight text-center truncate w-full">
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
