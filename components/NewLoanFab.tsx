"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

// Mobile-only floating action button for the most common action. Hidden on
// desktop (the top bar has the button there) and on auth screens.
export default function NewLoanFab() {
  const { t } = useLanguage();
  const pathname = usePathname();

  const hideOn = ["/login", "/pending", "/borrowers/new"];
  if (hideOn.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

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
