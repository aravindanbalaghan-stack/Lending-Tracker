"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureLocalDataMatchesUser } from "@/lib/offline/db";
import { useLanguage } from "@/components/LanguageProvider";

export default function LoginPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        await ensureLocalDataMatchesUser(data.user?.id ?? null);
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    }
    setLoading(false);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-forest text-brass-soft text-xl font-serif mb-3">
            ₹
          </div>
          <h1 className="font-serif text-2xl text-ink">{t("appName")}</h1>
          <p className="text-sm text-ink-soft mt-1">
            {mode === "signin" ? t("login_signInTitle") : t("login_signUpTitle")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-ledger-line rounded-lg p-6 space-y-4 shadow-sm"
        >
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("login_email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("login_password")}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading
              ? t("login_pleaseWait")
              : mode === "signin"
              ? t("login_signIn")
              : t("login_createAccount")}
          </button>
        </form>

        <p className="text-center text-sm text-ink-soft mt-4">
          {mode === "signin" ? t("login_newHere") : t("login_alreadyHave")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="text-forest font-medium underline underline-offset-2"
          >
            {mode === "signin" ? t("login_createLink") : t("login_signInLink")}
          </button>
        </p>
      </div>
    </main>
  );
}
