"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError(t("reset_tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("reset_mismatch"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    // When the user arrives via the emailed link, Supabase establishes a
    // recovery session automatically, so updateUser can set the new password.
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setMessage(t("reset_success"));
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-forest text-brass-soft text-xl font-serif mb-3">
            ₹
          </div>
          <h1 className="font-serif text-2xl text-ink">{t("reset_title")}</h1>
          <p className="text-sm text-ink-soft mt-1">{t("reset_subtitle")}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-ledger-line rounded-lg p-6 space-y-4 shadow-sm"
        >
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("reset_newPassword")}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("reset_confirmPassword")}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-rust">{error}</p>}
          {message && <p className="text-sm text-forest">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-forest text-white text-sm font-medium py-2.5 hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? t("login_pleaseWait") : t("reset_save")}
          </button>
        </form>
      </div>
    </main>
  );
}
