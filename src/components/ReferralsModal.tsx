"use client";

import { useState, useEffect } from "react";
import { X, Gift, Users, Award, Copy, Check, Loader2, Sparkles, Calendar } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatDistanceToNow } from "date-fns";

export function ReferralsModal({
  isOpen,
  onClose,
  user,
  profile
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profile: any;
}) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteCount, setInviteCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const supabase = createClient();

  const referralCode = profile?.referral_code || `REF-${user?.id?.slice(0, 8).toUpperCase()}`;
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/login?ref=${referralCode}`
    : `https://fboosting.vercel.app/login?ref=${referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchReferralStats = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // 1. Fetch total invite count
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", user.id);

      if (!countError && count !== null) {
        setInviteCount(count);
      }

      // 2. Fetch referral transactions
      const { data: txns, error: txnsError } = await supabase
        .from("referral_transactions")
        .select("*, referee_profile:profiles!referee_id(email)")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (!txnsError && txns) {
        setTransactions(txns);
        const sum = txns.reduce((acc, curr) => acc + Number(curr.amount), 0);
        setTotalEarned(sum);
      }
    } catch (err) {
      console.error("Failed to fetch referral stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchReferralStats();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const obscureEmail = (email: string) => {
    if (!email) return "Friend";
    const parts = email.split("@");
    if (parts.length !== 2) return "Friend";
    const [local, domain] = parts;
    if (local.length <= 2) return `${local}**@${domain}`;
    return `${local.slice(0, 2)}***@${domain}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#181818] border border-slate-800/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800/50 rounded-lg cursor-pointer"
        >
          <X size={20} />
        </button>
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800/60 bg-[#1c1c1c]/50">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Gift className="text-[#1877F2]" size={22} /> BoostSocial <span className="text-[#1877F2]">Invite & Earn</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Get paid for sharing top-tier Facebook boosting services</p>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          {/* Rules / Rewards Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl text-center space-y-1 relative group">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/25 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">Referee Gets</span>
              <h3 className="text-xl font-black text-white pt-1">₱20.00</h3>
              <p className="text-[10px] text-slate-400 leading-tight">Instant wallet signup bonus</p>
            </div>
            
            <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl text-center space-y-1 relative group">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">You Earn</span>
              <h3 className="text-xl font-black text-[#1877F2] pt-1">10%</h3>
              <p className="text-[10px] text-slate-400 leading-tight">Commission on all approved GCash top-ups</p>
            </div>
          </div>

          {/* Referral Code Share HUD */}
          <div className="bg-[#121212] p-5 rounded-xl border border-slate-800/60 text-center space-y-3.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-550 block">Your Unique Referral Link</span>
            
            <div className="flex flex-col sm:flex-row gap-2 items-stretch justify-center">
              <div className="bg-[#181818] border border-slate-800 px-4 py-2.5 rounded-xl text-sm font-mono font-bold text-slate-350 select-all truncate max-w-full text-center sm:text-left flex-grow flex items-center justify-center sm:justify-start">
                {inviteLink}
              </div>
              <button
                onClick={copyToClipboard}
                className={`px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                  copied 
                    ? "bg-[#1877F2] text-white shadow-blue-500/10" 
                    : "bg-[#282828] hover:bg-[#333] border border-slate-800 text-white hover:border-slate-700"
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} strokeWidth={3} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Link
                  </>
                )}
              </button>
            </div>
            
            <div className="inline-flex items-center gap-1 text-[10px] text-[#1877F2] font-bold bg-[#1877F2]/5 border border-[#1877F2]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Sparkles size={10} /> Sharing code: {referralCode}
            </div>
          </div>

          {/* Live Dynamic Telemetry Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/25 rounded-xl">
                <Users size={16} />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-550">Friends Invited</span>
                <h4 className="text-lg font-black text-white">{inviteCount}</h4>
              </div>
            </div>

            <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded-xl">
                <Award size={16} />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-550">Total Earned</span>
                <h4 className="text-lg font-black text-purple-400">₱{totalEarned.toFixed(2)}</h4>
              </div>
            </div>
          </div>

          {/* Referral Transaction Feed */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Referral Activity Log</h3>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="animate-spin text-[#1877F2]" size={20} />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Fetching activity log...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 bg-[#121212] border border-slate-850 p-4 rounded-xl text-slate-500 text-xs font-semibold leading-relaxed">
                No referral transactions yet. <br />
                <span className="text-[10px] text-slate-550 uppercase font-black tracking-widest mt-1.5 block">Invite friends to get started!</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-slate-850">
                {transactions.map((tx) => (
                  <div key={tx.id} className="pt-2 first:pt-0 pb-2 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{obscureEmail(tx.referee_profile?.email)}</span>
                        {tx.referee_profile?.email ? (
                          <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700/50 px-1.5 py-0.2 rounded font-mono">Referee</span>
                        ) : (
                          <span className="text-[9px] bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 px-1.5 py-0.2 rounded font-mono">Bonus</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-550 tracking-tight leading-tight">{tx.description}</p>
                    </div>
                    <div className="text-right space-y-0.5 pl-3 flex-shrink-0">
                      <span className="font-extrabold text-[#1877F2]">+₱{Number(tx.amount).toFixed(2)}</span>
                      <p className="text-[8px] text-slate-550 flex items-center justify-end gap-0.5">
                        <Calendar size={8} /> {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
