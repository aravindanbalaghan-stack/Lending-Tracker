"use client";

import { useEffect, useState } from "react";
import {
  isPinEnabled,
  setPin as savePin,
  disablePin,
} from "@/lib/pinLock";
import { useLanguage } from "@/components/LanguageProvider";

export default function PinSettings() {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [setting, setSetting] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read on mount
    setEnabled(isPinEnabled());
  }, []);

  function onlyDigits(v: string, setter: (s: string) => void) {
    setter(v.replace(/\D/g, "").slice(0, 4));
  }

  async function handleSave() {
    setError(null);
    if (pin.length !== 4) {
      setError(t("pin_needFour"));
      return;
    }
    if (pin !== confirm) {
      setError(t("pin_mismatch"));
      return;
    }
    if (!question.trim() || !answer.trim()) {
      setError(t("pin_securityRequired"));
      return;
    }
    await savePin(pin, { question: question.trim(), answer: answer.trim() });
    setEnabled(true);
    setSetting(false);
    setPin("");
    setConfirm("");
    setQuestion("");
    setAnswer("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleDisable() {
    disablePin();
    setEnabled(false);
    setSetting(false);
  }

  return (
    <div className="rounded-lg border border-ledger-line bg-white p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-soft">
            {t("pin_title")}
          </p>
          <p className="text-sm text-ink mt-0.5">
            {enabled ? t("pin_on") : t("pin_off")}
          </p>
        </div>
        {!setting && (
          <div className="flex gap-2">
            {enabled ? (
              <>
                <button
                  onClick={() => setSetting(true)}
                  className="text-xs text-forest font-medium underline underline-offset-2"
                >
                  {t("pin_change")}
                </button>
                <button
                  onClick={handleDisable}
                  className="text-xs text-rust underline underline-offset-2"
                >
                  {t("pin_turnOff")}
                </button>
              </>
            ) : (
              <button
                onClick={() => setSetting(true)}
                className="text-xs rounded-md bg-forest text-white px-3 py-1.5 font-medium hover:opacity-90"
              >
                {t("pin_setUp")}
              </button>
            )}
          </div>
        )}
      </div>

      {saved && (
        <p className="text-sm text-forest mt-3">✓ {t("pin_saved")}</p>
      )}

      {setting && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("pin_newPin")}
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => onlyDigits(e.target.value, setPin)}
              placeholder="••••"
              className="w-28 rounded-md border border-ledger-line px-3 py-2 text-lg tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-forest"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("pin_confirmPin")}
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={confirm}
              onChange={(e) => onlyDigits(e.target.value, setConfirm)}
              placeholder="••••"
              className="w-28 rounded-md border border-ledger-line px-3 py-2 text-lg tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-forest"
            />
          </div>

          <div className="pt-2 border-t border-ledger-line">
            <p className="text-xs text-ink-soft mb-2">
              {t("pin_securityIntro")}
            </p>
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("pin_securityQuestion")}
            </label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("pin_securityQuestionPlaceholder")}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-forest"
            />
            <label className="block text-xs font-medium text-ink-soft mb-1">
              {t("pin_securityAnswer")}
            </label>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t("pin_securityAnswerPlaceholder")}
              className="w-full rounded-md border border-ledger-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest"
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="text-xs rounded-md bg-forest text-white px-4 py-2 font-medium hover:opacity-90"
            >
              {t("detail_save")}
            </button>
            <button
              onClick={() => {
                setSetting(false);
                setError(null);
                setPin("");
                setConfirm("");
                setQuestion("");
                setAnswer("");
              }}
              className="text-xs text-ink-soft"
            >
              {t("detail_cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
