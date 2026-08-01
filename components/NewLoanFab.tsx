"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

// Mobile-only floating action button for the most common action. Hidden on
// desktop (the top bar has the button there) and on auth screens.
export default function NewLoanFab() {
  const { t } = useLanguage();
  const pathname = usePathname();

  // Hide only where the button doesn't belong: auth screens and the new-loan
  // form itself. Use exact matches (plus sub-paths for auth) so a stale or
  // transitional pathname can't leave the button hidden on normal screens.
  const hidden =
    pathname === "/borrowers/new" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/pending" ||
    pathname.startsWith("/pending/");

  if (hidden) return null;

  return (
    <Link
      href="/borrowers/new"
      aria-label={t("nav_newLoan")}
      className="md:hidden fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full bg-forest text-white shadow-lg flex items-center justify-center text-2xl active:scale-95 transition"
    >
      +
    </Link>
  );
}
