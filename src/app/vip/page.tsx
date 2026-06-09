"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Crown, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import type { User } from "@supabase/supabase-js";
import {
  getActiveVipPlan,
  getVipDiscountPercent,
  getVipPlanById,
  formatVipPlanDiscount,
  isVipActive,
  type VipPlan,
} from "@/utils/vip";

interface UserProfile {
  id: string;
  email?: string | null;
  balance?: number | string | null;
  vip_plan?: string | null;
  vip_started_at?: string | null;
  vip_expires_at?: string | null;
}

function parseDate(value?: string | null) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString("en-PH");
}

function addDays(baseDate: string | null, days: number) {
  if (!baseDate) return "N/A";
  const start = new Date(baseDate);
  if (Number.isNaN(start.getTime())) return "N/A";
  const next = new Date(start);
  next.setDate(next.getDate() + days);
  return next.toLocaleDateString("en-PH");
}

export default function VipPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [planCode, setPlanCode] = useState<string>("vip_starter");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "gcash">("gcash");
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const activeVip = useMemo(() => getActiveVipPlan(profile), [profile]);
  const isActiveVip = isVipActive(profile);
  const selectedPlan = getVipPlanById(planCode);
  const currentDiscount = getVipDiscountPercent(profile);
  const walletBalance = Number(profile?.balance || 0);

  useEffect(() => {
    const load = async () => {
      const session = await supabase.auth.getUser();
      const currentUser = session.data.user;
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, email, balance, vip_plan, vip_started_at, vip_expires_at")
        .eq("id", currentUser.id)
        .single();

      if (profileData) setProfile(profileData as UserProfile);
      setLoading(false);
    };
    load();
  }, [supabase]);

  const resolvedPlan = selectedPlan || getVipPlanById("vip_starter");

  const loadFreshProfile = async () => {
    if (!user?.id) return;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, email, balance, vip_plan, vip_started_at, vip_expires_at")
      .eq("id", user.id)
      .single();
    if (profileData) setProfile(profileData as UserProfile);
  };

  const handleSubscribe = async (evt: FormEvent) => {
    evt.preventDefault();
    setError("");
    setSuccessText("");

    if (!user || !selectedPlan) return;
    if (paymentMethod === "gcash" && !receipt) {
      setError("Please upload your GCash receipt for manual VIP verification.");
      return;
    }
    if (paymentMethod === "wallet" && walletBalance < selectedPlan.price) {
      setError("Your wallet balance is not enough for this plan.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("planCode", selectedPlan.id);
      formData.append("paymentMethod", paymentMethod);
      formData.append("amount", selectedPlan.price.toString());

      if (receipt) {
        formData.append("receipt", receipt);
      }

      const res = await fetch("/api/vip/subscribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create VIP request.");

      if (data.status === "approved") {
        setSuccessText("VIP subscription activated! Your discounts are now applied to all eligible orders.");
        await loadFreshProfile();
      } else {
        setSuccessText("VIP request submitted and waiting for admin approval. Please wait for verification.");
      }

      setReceipt(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not subscribe at this time.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-slate-200 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl space-y-7">
          <div className="text-center">
            <span className="inline-flex rounded-full border border-[#1DB954]/25 bg-[#1DB954]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
              VIP Access
            </span>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">Unlock Faster Service Access</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-slate-400">
              Upgrade to VIP for order discount and priority handling. This plan works with your current order flow immediately.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-slate-800/80 bg-[#121212]/95 p-5 sm:p-6 space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Crown size={18} className="text-[#1DB954]" /> Membership Levels
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {["vip_starter", "vip_pro", "vip_royal"].map((code) => {
                  const plan = getVipPlanById(code) as VipPlan | null;
                  if (!plan) return null;
                  const isSelected = plan.id === planCode;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setPlanCode(plan.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-[#1DB954] bg-[#1DB954]/10"
                          : "border-slate-800 bg-[#181818] hover:border-slate-600"
                      }`}
                      type="button"
                    >
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{plan.name}</p>
                      <h3 className="mt-1 text-lg font-black text-white">{plan.label}</h3>
                      <p className="mt-2 text-sm font-black text-[#1DB954]">PHP {plan.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-500">Duration: {plan.durationDays} days</p>
                      <p className="text-[10px] font-black text-slate-300 mt-2">Discount: {formatVipPlanDiscount(plan.discountPercent)}</p>
                    </button>
                  );
                })}
              </div>
              {selectedPlan && (
                <p className="rounded-xl border border-slate-800 bg-[#181818] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300">
                  Includes: {selectedPlan.perks.join(" | ")}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800/80 bg-[#121212]/95 p-5 sm:p-6 space-y-4">
              <h2 className="text-xl font-black text-white">Current Status</h2>
              {loading ? (
                <div className="rounded-2xl border border-slate-800 p-4 text-sm font-semibold text-slate-500">Loading...</div>
              ) : user ? (
                activeVip ? (
                  <div className="space-y-2 rounded-2xl border border-[#1DB954]/30 bg-[#1DB954]/10 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-[#1DB954]">Active</p>
                    <p className="text-lg font-black text-white">{activeVip.label}</p>
                    <p className="text-xs font-semibold text-slate-700">
                      Ends: {parseDate(profile?.vip_expires_at)}
                    </p>
                    <p className="text-xs font-semibold text-slate-700">
                      Renewal discount: {formatVipPlanDiscount(isActiveVip && profile ? getVipDiscountPercent(profile) : 0)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-slate-800 bg-[#181818] p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">No active VIP</p>
                    <p className="text-sm font-bold text-slate-300">Upgrade to save on every eligible order.</p>
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-[#181818] p-4 text-xs font-bold text-slate-500">Sign in required</div>
              )}

              <div className="rounded-2xl border border-slate-800 bg-[#181818] p-4 text-xs">
                <p className="font-black uppercase tracking-widest text-slate-500">Wallet Balance</p>
                <p className="mt-2 text-xl font-black text-[#1DB954]">PHP {walletBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubscribe} className="rounded-3xl border border-slate-800/80 bg-[#121212]/95 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr] items-end">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("gcash")}
                    className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-wider ${
                      paymentMethod === "gcash"
                        ? "border-[#1877F2] bg-[#1877F2]/10 text-[#4e8df5]"
                        : "border-slate-800 bg-black/40 text-slate-500"
                    }`}
                  >
                    Pay via GCash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("wallet")}
                    className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-wider ${
                      paymentMethod === "wallet"
                        ? "border-[#1DB954] bg-[#1DB954]/10 text-[#1DB954]"
                        : "border-slate-800 bg-black/40 text-slate-500"
                    }`}
                  >
                    Pay with Wallet
                  </button>
                </div>
              </div>
              <div className="text-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Amount to Pay</p>
                <p className="text-lg font-black text-white">PHP {resolvedPlan ? resolvedPlan.price.toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "--"}</p>
              </div>
            </div>

            {paymentMethod === "gcash" && (
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Upload GCash Receipt <span className="text-[#f43f5e]">*</span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full rounded-xl border border-slate-800 bg-black/40 p-3 text-xs text-slate-300 file:mr-4 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
                  onChange={(event) => setReceipt(event.target.files?.[0] || null)}
                />
              </label>
            )}

            {paymentMethod === "wallet" && !isActiveVip && (
              <p className="mt-4 rounded-xl border border-slate-800 bg-[#181818] p-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                Wallet activation is instant. Discount starts immediately after payment is confirmed.
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300 font-black uppercase tracking-wider">{error}</div>
            )}
            {successText && (
              <div className="mt-4 rounded-xl border border-[#1DB954]/25 bg-[#1DB954]/10 p-3 text-sm text-[#1DB954] font-black uppercase tracking-wider">{successText}</div>
            )}

            <button
              type="submit"
              disabled={submitting || loading || !user}
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#1DB954] px-6 py-3.5 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {resolvedPlan ? `Subscribe: ${resolvedPlan.label}` : "Select a plan"}
            </button>
          </form>

          <div className="grid gap-4 sm:grid-cols-3">
            <p className="rounded-2xl border border-slate-800 bg-[#181818] p-4 text-xs">
              <span className="text-[#1DB954] font-black">Current Wallet Discount:</span> {formatVipPlanDiscount(currentDiscount)} on every eligible order.
            </p>
            <p className="rounded-2xl border border-slate-800 bg-[#181818] p-4 text-xs">
              <span className="text-[#1DB954] font-black">Active Plan Expires:</span> {parseDate(profile?.vip_expires_at)}
            </p>
            <p className="rounded-2xl border border-slate-800 bg-[#181818] p-4 text-xs">
              <span className="text-[#1DB954] font-black">Renewal preview:</span> {resolvedPlan ? addDays(profile?.vip_expires_at || new Date().toISOString(), resolvedPlan.durationDays) : "N/A"}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
