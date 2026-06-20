"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle,
  ClipboardList,
  Copy,
  Crown,
  Home,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Upload,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { getActiveVipPlan } from "@/utils/vip";

type AppProfile = {
  id: string;
  email?: string | null;
  balance?: number | string | null;
  referral_code?: string | null;
  vip_plan?: string | null;
  vip_expires_at?: string | null;
};

const GCASH_NUMBER = "09505339963";
const GCASH_NAME = "Henry S.";

type PushStatus = "checking" | "unsupported" | "disabled" | "saving" | "enabled" | "blocked" | "setup";

function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `PHP ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function readableDate(value?: string | null) {
  if (!value) return "Not active";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not active";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index++) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export default function AppProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpReceipt, setTopUpReceipt] = useState<File | null>(null);
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);
  const [topUpError, setTopUpError] = useState("");
  const [topUpSuccess, setTopUpSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedGcash, setCopiedGcash] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [pushMessage, setPushMessage] = useState("Checking phone notification support...");

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setRefreshing(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,email,balance,referral_code,vip_plan,vip_expires_at")
      .eq("id", currentUser.id)
      .single();

    setProfile(data ? (data as AppProfile) : null);
    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    const fallback = window.setTimeout(() => {
      if (!alive) return;
      setLoading(false);
      setRefreshing(false);
    }, 4500);

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const sessionUser = data.session?.user || null;
      setUser(sessionUser);
      void loadProfile(sessionUser).finally(() => window.clearTimeout(fallback));
    }).catch(() => {
      if (!alive) return;
      window.clearTimeout(fallback);
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      alive = false;
      window.clearTimeout(fallback);
    };
  }, [loadProfile, supabase.auth]);

  useEffect(() => {
    let alive = true;

    async function syncPushStatus() {
      await Promise.resolve();
      if (!alive) return;

      if (!user) {
        setPushStatus("disabled");
        setPushMessage("Login to enable phone status updates.");
        return;
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPushStatus("unsupported");
        setPushMessage("This phone browser does not support push notifications.");
        return;
      }

      if (Notification.permission === "denied") {
        setPushStatus("blocked");
        setPushMessage("Notifications are blocked in your phone settings.");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js")
          || await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        if (!alive) return;

        if (subscription && Notification.permission === "granted") {
          setPushStatus("enabled");
          setPushMessage("Phone alerts are enabled for order status updates.");
        } else {
          setPushStatus("disabled");
          setPushMessage("Enable phone alerts for Processing, Completed, Rejected, or Cancelled orders.");
        }
      } catch {
        if (!alive) return;
        setPushStatus("disabled");
        setPushMessage("Enable phone alerts for order status updates.");
      }
    }

    void syncPushStatus();

    return () => {
      alive = false;
    };
  }, [user]);

  const activePlan = getActiveVipPlan(profile);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.replace("/app");
  };

  const copyReferral = async () => {
    if (!profile?.referral_code) return;
    await navigator.clipboard.writeText(profile.referral_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const openTopUp = () => {
    setTopUpError("");
    setTopUpSuccess("");
    setTopUpOpen(true);
  };

  const closeTopUp = () => {
    if (topUpSubmitting) return;
    setTopUpOpen(false);
    setTopUpError("");
    setTopUpSuccess("");
  };

  const copyGcashNumber = async () => {
    await navigator.clipboard.writeText(GCASH_NUMBER);
    setCopiedGcash(true);
    window.setTimeout(() => setCopiedGcash(false), 1600);
  };

  const submitTopUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id || !user.email) {
      setTopUpError("Please login again before submitting a top-up.");
      return;
    }

    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTopUpError("Enter a valid PHP amount.");
      return;
    }

    if (!topUpReceipt) {
      setTopUpError("Upload your GCash receipt screenshot.");
      return;
    }

    setTopUpSubmitting(true);
    setTopUpError("");
    setTopUpSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", topUpReceipt);
      formData.append("userId", user.id);
      formData.append("email", user.email);
      formData.append("amount", String(amount));

      const res = await fetch("/api/topup/create", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; autoApproved?: boolean };

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit top-up request.");
      }

      setTopUpAmount("");
      setTopUpReceipt(null);
      setTopUpSuccess(
        data.autoApproved
          ? "Top-up approved! AI verified and instantly credited to your wallet. 🚀"
          : "Top-up submitted. Admin verification is now pending."
      );
      await loadProfile(user);
    } catch (err: unknown) {
      setTopUpError(err instanceof Error ? err.message : "Failed to submit top-up request.");
    } finally {
      setTopUpSubmitting(false);
    }
  };

  const enablePhoneNotifications = async () => {
    if (!user) return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushStatus("unsupported");
      setPushMessage("This phone browser does not support push notifications.");
      return;
    }

    setPushStatus("saving");
    setPushMessage("Preparing phone notifications...");

    try {
      const keyRes = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
      const keyData = (await keyRes.json()) as { enabled?: boolean; publicKey?: string; error?: string };

      if (!keyRes.ok || !keyData.enabled || !keyData.publicKey) {
        throw new Error(keyData.error || "Phone notification server setup is not ready yet.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "blocked" : "disabled");
        setPushMessage(permission === "denied"
          ? "Notifications are blocked in your phone settings."
          : "Phone notifications were not enabled.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const saveData = (await saveRes.json().catch(() => ({}))) as { error?: string };

      if (!saveRes.ok) {
        throw new Error(saveData.error || "Could not save phone notification subscription.");
      }

      setPushStatus("enabled");
      setPushMessage("Phone alerts are enabled for order status updates.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to enable phone notifications.";
      setPushStatus(message.toLowerCase().includes("migration") || message.toLowerCase().includes("setup") ? "setup" : "disabled");
      setPushMessage(message);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] text-zinc-950">
      <header className="mx-auto flex max-w-3xl items-center gap-2">
        <button type="button" onClick={() => router.back()} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm" aria-label="Go back">
          <ArrowLeft size={17} />
        </button>
        <Link href="/app" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-emerald-700 shadow-sm" aria-label="App home">
          <Home size={17} />
        </Link>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-base font-black">Wallet and Profile</p>
          <p className="truncate text-xs font-semibold text-zinc-500">Balance, VIP, referral, and account</p>
        </div>
        <button type="button" onClick={() => void loadProfile(user)} disabled={!user || refreshing} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm disabled:opacity-50" aria-label="Refresh profile">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {loading ? (
        <section className="mx-auto mt-6 max-w-md space-y-3">
          <div className="h-36 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
          <div className="h-24 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
          <div className="h-24 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
        </section>
      ) : !user ? (
        <section className="mx-auto mt-6 max-w-md rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Wallet size={22} />
          </span>
          <h1 className="mt-4 text-2xl font-black">Login to view wallet</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
            Your app wallet, VIP status, and referral code are private to your account.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href="/app/auth?mode=login&return=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white">
              <LogIn size={16} />
              Login
            </Link>
            <Link href="/app/auth?mode=register&return=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 text-sm font-black text-zinc-800">
              <UserPlus size={16} />
              Register
            </Link>
          </div>
        </section>
      ) : (
        <section className="mx-auto mt-6 max-w-md space-y-3">
          <article className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Wallet balance</p>
                <h1 className="mt-2 text-3xl font-black">{money(profile?.balance)}</h1>
                <p className="mt-2 truncate text-xs font-semibold text-zinc-500">{profile?.email || user.email}</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Wallet size={22} />
              </span>
            </div>
            <button type="button" onClick={openTopUp} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98] transition-all">
              <Wallet size={17} />
              Top up wallet
            </button>
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Crown size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{activePlan ? activePlan.label : "No active VIP"}</p>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  {activePlan ? `${activePlan.discountPercent}% discount until ${readableDate(profile?.vip_expires_at)}` : "VIP discounts can be activated from the VIP page."}
                </p>
              </div>
              <Link href="/vip" className="rounded-full bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-700">
                VIP
              </Link>
            </div>
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Referral code</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-black">
                {profile?.referral_code || "Not ready yet"}
              </span>
              <button type="button" onClick={copyReferral} disabled={!profile?.referral_code} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white disabled:opacity-50" aria-label="Copy referral code">
                <Copy size={16} />
              </button>
            </div>
            {copied && <p className="mt-2 text-xs font-bold text-emerald-700">Referral code copied.</p>}
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                pushStatus === "enabled" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700"
              }`}>
                {pushStatus === "enabled" ? <BellRing size={20} /> : <Bell size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">Phone status alerts</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">{pushMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={enablePhoneNotifications}
              disabled={pushStatus === "enabled" || pushStatus === "saving" || pushStatus === "unsupported" || pushStatus === "blocked"}
              className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all ${
                pushStatus === "enabled"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none"
              }`}
            >
              {pushStatus === "saving" && <Loader2 size={16} className="animate-spin" />}
              {pushStatus === "enabled" ? "Enabled" : pushStatus === "saving" ? "Enabling..." : "Enable phone alerts"}
            </button>
          </article>

          <button type="button" onClick={signOut} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-sm font-black text-red-700 hover:bg-red-100 active:scale-[0.98] transition-all">
            <LogOut size={16} />
            Sign out
          </button>
        </section>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-1">
          <Link href="/app" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-400">
            <Home size={18} />
            Services
          </Link>
          <Link href="/app/orders" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-400">
            <ClipboardList size={18} />
            Orders
          </Link>
          <Link href="/app/profile" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-emerald-500">
            <Wallet size={18} />
            Wallet
          </Link>
        </div>
      </nav>

      {user && topUpOpen && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] backdrop-blur-sm sm:items-center sm:justify-center">
          <button type="button" className="absolute inset-0" aria-label="Close top-up" onClick={closeTopUp} />
          <section className="relative mx-auto max-h-[88vh] w-full max-w-md overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white text-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <Wallet size={21} />
                </span>
                <div>
                  <h2 className="text-lg font-black">App Wallet Top-Up</h2>
                  <p className="text-xs font-semibold text-zinc-500">Stay in the app, upload receipt, wait for approval.</p>
                </div>
              </div>
              <button type="button" onClick={closeTopUp} disabled={topUpSubmitting} className="rounded-full p-2 text-zinc-500 disabled:opacity-50" aria-label="Close top-up">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitTopUp} className="max-h-[74vh] space-y-4 overflow-y-auto p-4">
              {topUpSuccess ? (
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <CheckCircle size={26} />
                  </span>
                  <h3 className="mt-4 text-lg font-black text-emerald-900">Receipt submitted</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">{topUpSuccess}</p>
                  <button type="button" onClick={closeTopUp} className="mt-5 h-11 w-full rounded-2xl bg-emerald-600 text-sm font-black text-white">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {topUpError && (
                    <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      <span>{topUpError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Amount in PHP</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      inputMode="decimal"
                      value={topUpAmount}
                      onChange={(event) => {
                        setTopUpAmount(event.target.value);
                        setTopUpError("");
                      }}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-base font-black outline-none transition focus:border-emerald-500"
                      placeholder="500.00"
                    />
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-center">
                      <p className="text-sm font-black">Pay with GCash</p>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">Send the exact amount before uploading your receipt.</p>
                    </div>
                    <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-3xl bg-white p-3 shadow-sm">
                      <Image src="/gcash-qr.png" alt="GCash QR code" width={192} height={192} className="h-full w-full object-contain" />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-emerald-100 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-zinc-900">{GCASH_NUMBER}</p>
                        <p className="truncate text-[11px] font-semibold text-zinc-500">{GCASH_NAME}</p>
                      </div>
                      <button type="button" onClick={copyGcashNumber} className="shrink-0 rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700">
                        {copiedGcash ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Receipt Screenshot</label>
                    <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-4 text-center transition active:scale-[0.99]">
                      <Upload size={23} className="text-emerald-700" />
                      <span className="mt-2 max-w-full truncate text-sm font-black text-zinc-800">
                        {topUpReceipt ? topUpReceipt.name : "Upload GCash receipt"}
                      </span>
                      <span className="mt-1 text-[11px] font-semibold text-zinc-500">PNG, JPG, or WebP up to 8MB</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          setTopUpReceipt(event.target.files?.[0] || null);
                          setTopUpError("");
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={topUpSubmitting}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                  >
                    {topUpSubmitting ? <Loader2 size={17} className="animate-spin" /> : <Wallet size={17} />}
                    {topUpSubmitting ? "Submitting..." : "Submit top-up"}
                  </button>
                </>
              )}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
