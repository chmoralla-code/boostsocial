"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export const TOPUP_BASELINE_KEY = "pinoyboosting:topup-baseline";

type Tone = "waiting" | "credited" | "cancelled";

type Notice = {
  tone: Tone;
  title: string;
  body: string;
};

const POLL_EVERY_MS = 3000;
const MAX_ATTEMPTS = 6;

function pesos(value: number) {
  return `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * TopUpReturnWatcher — the "you came back from PayMongo" notice.
 *
 * PayMongo returns the customer to the main website as `/?topup=processing`.
 * The wallet is credited by the webhook, which can land a moment AFTER this
 * page loads — so this polls the balance briefly and tells the header to
 * re-read it, instead of showing the old number and letting the customer
 * think their payment failed.
 *
 * The starting balance is remembered in sessionStorage when checkout begins
 * (TOPUP_BASELINE_KEY). Without it we can still show the live balance, but we
 * cannot honestly claim the amount was credited — so we do not.
 *
 * Only the public pages run this; the app area has its own poller on
 * /app/profile. The `topup` marker is cleared from the address bar first, so
 * a refresh or a shared link never replays the notice.
 */
export function TopUpReturnWatcher() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const state = params.get("topup");
    if (!state) return;

    params.delete("topup");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );

    if (state === "cancelled") {
      window.sessionStorage.removeItem(TOPUP_BASELINE_KEY);
      setNotice({
        tone: "cancelled",
        title: "Payment cancelled",
        body: "No money was taken. You can start a new top-up any time.",
      });
      const dismiss = window.setTimeout(() => setNotice(null), 8000);
      return () => window.clearTimeout(dismiss);
    }

    if (state !== "processing") return;

    const rawBaseline = window.sessionStorage.getItem(TOPUP_BASELINE_KEY);
    window.sessionStorage.removeItem(TOPUP_BASELINE_KEY);
    const baselineValue = Number(rawBaseline);
    const baseline =
      rawBaseline !== null && Number.isFinite(baselineValue) ? baselineValue : null;

    const supabase = createClient();
    const timers: number[] = [];
    let alive = true;
    let attempts = 0;

    setNotice({
      tone: "waiting",
      title: "Payment received",
      body: "Confirming with PayMongo and updating your wallet…",
    });

    const finish = (next: Notice, hideAfterMs: number) => {
      setNotice(next);
      timers.push(window.setTimeout(() => setNotice(null), hideAfterMs));
    };

    const poll = async () => {
      if (!alive) return;
      attempts += 1;

      let balance: number | null = null;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", user.id)
          .single();
        const parsed = Number(data?.balance ?? NaN);
        if (Number.isFinite(parsed)) balance = parsed;
      }

      if (!alive) return;

      // The header wallet pill listens for this and re-reads the profile.
      window.dispatchEvent(new Event("balance-update"));

      if (balance !== null && baseline !== null && balance > baseline) {
        finish(
          {
            tone: "credited",
            title: "Wallet updated",
            body: `Your new balance is ${pesos(balance)}.`,
          },
          9000
        );
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        finish(
          {
            tone: "waiting",
            title: "Payment received",
            body:
              balance !== null
                ? `Your wallet shows ${pesos(balance)}. PayMongo is still confirming — the amount is added automatically, so refresh in a minute if it looks unchanged.`
                : "PayMongo is still confirming. The amount is added to your wallet automatically, so refresh in a minute if it looks unchanged.",
          },
          14000
        );
        return;
      }

      timers.push(window.setTimeout(poll, POLL_EVERY_MS));
    };

    timers.push(window.setTimeout(poll, 2000));

    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  if (!notice) return null;

  const Icon =
    notice.tone === "credited"
      ? CheckCircle2
      : notice.tone === "cancelled"
        ? XCircle
        : Loader2;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[95] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-start gap-3">
          <Icon
            size={18}
            className={`mt-0.5 shrink-0 text-primary ${
              notice.tone === "waiting" ? "animate-spin" : ""
            }`}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-black text-fg">{notice.title}</p>
            <p className="text-xs font-semibold leading-relaxed text-muted">{notice.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
