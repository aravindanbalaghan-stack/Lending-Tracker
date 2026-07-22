"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureLocalDataMatchesUser } from "@/lib/offline/db";
import { useLanguage } from "@/components/LanguageProvider";

export default function PendingClient() {
  const { t } = useLanguage();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  async function recheck() {
    setChecking(true);
    setStillPending(false);
    const supabase = createClient();
    const { data } = await supabase.rpc("my_approval_status");
    setChecking(false);
    if (data === "approved") {
      router.push("/dashboard");
      router.refresh();
    } else {
      setStillPending(true);
    }
  }

  async function signOut() {
    await ensureLocalDataMatchesUser(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="max-w-md w-full text-center bg-white rounded-lg border border-ledger-line p-8">
      <div className="text-4xl mb-3">⏳</div>
      <h1 className="font-serif text-2xl text-ink mb-2">
        {t("pending_title")}
      </h1>
      <p className="text-sm text-ink-soft mb-6">{t("pending_body")}</p>

      {stillPending && (
        <p className="text-sm text-brass bg-brass-soft rounded-md px-3 py-2 mb-4">
          {t("pending_stillWaiting")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={recheck}
          disabled={checking}
          className="rounded-md bg-forest text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {checking ? t("pending_checking") : t("pending_recheck")}
        </button>
        <button
          onClick={signOut}
          className="text-sm text-ink-soft hover:text-rust"
        >
          {t("nav_signOut")}
        </button>
      </div>
    </div>
  );
}
