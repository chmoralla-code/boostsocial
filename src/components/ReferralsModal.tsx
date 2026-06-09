"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Award,
  Calendar,
  Check,
  Copy,
  Gift,
  Loader2,
  Megaphone,
  Wallet,
  X,
} from "lucide-react";
import {
  REFERRAL_MIN_PAYOUT,
  REFERRAL_TIERS,
  ReferralTier,
  formatReferralRate,
  getNextReferralTier,
  getReferralTier,
} from "@/utils/referral-program";

type ReferralTransaction = {
  id: string;
  amount: number;
  description: string;
  created_at: string;
  refereeLabel: string;
};

type ReferralSummary = {
  inviteCount: number;
  totalEarned: number;
  totalReferralSpend: number;
  tier: ReferralTier;
  nextTier: ReferralTier | null;
  minPayout: number;
  tiers: ReferralTier[];
  transactions: ReferralTransaction[];
};

type ReferralDashboardContentProps = {
  user: any;
  profile: any;
  compact?: boolean;
};

const defaultSummary: ReferralSummary = {
  inviteCount: 0,
  totalEarned: 0,
  totalReferralSpend: 0,
  tier: REFERRAL_TIERS[0],
  nextTier: REFERRAL_TIERS[1],
  minPayout: REFERRAL_MIN_PAYOUT,
  tiers: REFERRAL_TIERS,
  transactions: [],
};

function money(value: number) {
  return `PHP ${Number(value || 0).toFixed(2)}`;
}

export function ReferralDashboardContent({ user, profile, compact = false }: ReferralDashboardContentProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReferralSummary>(defaultSummary);

  const referralCode = profile?.referral_code || `REF-${user?.id?.slice(0, 8).toUpperCase()}`;
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/login?ref=${referralCode}`
    : `https://pinoyboosting.com/login?ref=${referralCode}`;

  const activeTier = summary.tier || getReferralTier(summary.totalReferralSpend);
  const nextTier = summary.nextTier || getNextReferralTier(summary.totalReferralSpend);
  const payoutReady = summary.totalEarned >= summary.minPayout;
  const progressToNextTier = nextTier
    ? Math.min((summary.totalReferralSpend / nextTier.minSpend) * 100, 100)
    : 100;

  const shareMessage = useMemo(() => {
    return [
      "Want to earn passive income with PinoyBoosting?",
      "",
      "1. Sign up using my referral link.",
      "2. Share your own link with clients or friends.",
      "3. Earn commission when your referrals order services or top up their wallet.",
      "",
      `Start here: ${inviteLink}`,
    ].join("\n");
  }, [inviteLink]);

  const copyText = async (text: string, kind: "link" | "message") => {
    await navigator.clipboard.writeText(text);
    if (kind === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  const requestPayout = () => {
    if (!payoutReady || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("open-support-chat", {
      detail: {
        message: `Hi admin, I want to request my referral payout to GCash. My referral code is ${referralCode}. My tracked commission is ${money(summary.totalEarned)}.`,
      },
    }));
  };

  useEffect(() => {
    if (!user?.id) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/referrals/summary", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load referral summary.");
        setSummary({ ...defaultSummary, ...data });
      } catch (err) {
        console.error("Failed to fetch referral dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [user?.id]);

  return (
    <div className={compact ? "space-y-5" : "space-y-6"}>
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#1DB954]/20 bg-[#1DB954]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
          <Gift size={12} /> Reseller & Referral Program
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">Earn by sharing your link</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-relaxed text-muted">
            Share your referral link. When someone signs up with it, you earn whenever they place orders or top up their wallet.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {["Copy your link", "Share it online", "Earn commission"].map((step, index) => (
          <div key={step} className="rounded-xl border border-border bg-elevated p-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Step {index + 1}</span>
            <p className="mt-1 text-sm font-extrabold text-fg">{step}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Your referral link</span>
            <div className="mt-2 truncate rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs font-bold text-fg">
              {inviteLink}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-72">
            <button
              onClick={() => copyText(inviteLink, "link")}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#1DB954] px-4 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760]"
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? "Copied" : "Copy Link"}
            </button>
            <button
              onClick={() => copyText(shareMessage, "message")}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs font-black uppercase tracking-wider text-fg transition hover:bg-elevated"
            >
              {copiedMessage ? <Check size={14} /> : <Megaphone size={14} />}
              {copiedMessage ? "Copied" : "Copy Post"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-[#1DB954]/25 bg-[#1DB954]/10 p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">Current Tier</span>
          <p className="mt-1 text-lg font-black text-fg">{activeTier.name}</p>
        </div>
        <div className="rounded-xl border border-border bg-elevated p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Order Rate</span>
          <p className="mt-1 text-lg font-black text-fg">{formatReferralRate(activeTier.orderRate)}</p>
        </div>
        <div className="rounded-xl border border-border bg-elevated p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Top-Up Rate</span>
          <p className="mt-1 text-lg font-black text-fg">{formatReferralRate(activeTier.topupRate)}</p>
        </div>
        <div className="rounded-xl border border-border bg-elevated p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Total Earned</span>
          <p className="mt-1 text-lg font-black text-[#1DB954]">{money(summary.totalEarned)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-border bg-elevated p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted">Tier progress</span>
              <p className="mt-1 text-sm font-bold text-fg">
                {nextTier
                  ? `${money(summary.totalReferralSpend)} referral spend. ${money(Math.max(nextTier.minSpend - summary.totalReferralSpend, 0))} until ${nextTier.name}.`
                  : "Elite unlocked. You are on the highest commission tier."}
              </p>
            </div>
            <Award className="text-[#1DB954]" size={24} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900">
            <div className="h-full rounded-full bg-[#1DB954]" style={{ width: `${progressToNextTier}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {summary.tiers.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-lg border p-3 ${
                  tier.id === activeTier.id
                    ? "border-[#1DB954]/40 bg-[#1DB954]/10"
                    : "border-border bg-card"
                }`}
              >
                <p className="text-xs font-black text-fg">{tier.name}</p>
                <p className="mt-1 text-[10px] font-semibold text-muted">
                  {formatReferralRate(tier.orderRate)} orders / {formatReferralRate(tier.topupRate)} top-ups
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-elevated p-4 sm:p-5">
          <div className="flex items-center gap-2 text-fg">
            <Wallet size={18} className="text-[#1DB954]" />
            <h3 className="text-sm font-black">GCash Payout</h3>
          </div>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-muted">
            Minimum payout is {money(summary.minPayout)}. Request payout when your tracked commission reaches the minimum.
          </p>
          <button
            onClick={requestPayout}
            disabled={!payoutReady}
            className="mt-4 w-full rounded-lg bg-[#1DB954] px-4 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-muted"
          >
            {payoutReady ? "Request GCash Payout" : `${money(Math.max(summary.minPayout - summary.totalEarned, 0))} to payout`}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted">Recent referral activity</h3>
          <span className="text-[10px] font-bold text-muted">{summary.inviteCount} referrals</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Loader2 className="animate-spin text-[#1DB954]" size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Loading dashboard...</span>
          </div>
        ) : summary.transactions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-5 text-center text-xs font-semibold text-muted">
            No commissions yet. Share your link to start earning.
          </div>
        ) : (
          <div className="max-h-56 divide-y divide-slate-850 overflow-y-auto">
            {summary.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 py-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-fg">{tx.refereeLabel}</p>
                  <p className="truncate text-[10px] font-semibold text-muted">{tx.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black text-[#1DB954]">+{money(tx.amount)}</p>
                  <p className="flex items-center justify-end gap-1 text-[9px] text-muted">
                    <Calendar size={9} />
                    {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReferralsModal({
  isOpen,
  onClose,
  user,
  profile,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profile: any;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1 text-muted transition-colors hover:bg-elevated/50 hover:text-fg"
          aria-label="Close referral dashboard"
        >
          <X size={20} />
        </button>
        <div className="overflow-y-auto p-5 sm:p-6">
          <ReferralDashboardContent user={user} profile={profile} compact />
        </div>
      </div>
    </div>
  );
}
