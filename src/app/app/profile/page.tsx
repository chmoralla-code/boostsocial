"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Copy, Crown, Home, LogIn, LogOut, RefreshCw, UserPlus, Wallet } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { TopUpModal } from "@/components/TopUpModal";
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

export default function AppProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
            <button type="button" onClick={() => setTopUpOpen(true)} className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-950 text-sm font-black text-white">
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

          <button type="button" onClick={signOut} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-zinc-700">
            <LogOut size={16} />
            Sign out
          </button>
        </section>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-1">
          <Link href="/app" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <Home size={18} />
            Services
          </Link>
          <Link href="/app/orders" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <ClipboardList size={18} />
            Orders
          </Link>
          <Link href="/app/profile" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-emerald-700">
            <Wallet size={18} />
            Wallet
          </Link>
        </div>
      </nav>

      {user && (
        <TopUpModal
          isOpen={topUpOpen}
          onClose={() => setTopUpOpen(false)}
          user={user}
          onTopUpSuccess={() => void loadProfile(user)}
        />
      )}
    </main>
  );
}
