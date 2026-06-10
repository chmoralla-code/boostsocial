"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { Rocket, LogOut, ClipboardList, X, Loader2, Wallet, Gift, Crown } from 'lucide-react';
import { ThemeToggle } from "./ThemeToggle";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import { format } from "date-fns";
import { isVipActive, getVipDiscountPercent } from "@/utils/vip";
import { TopUpModal } from "./TopUpModal";
import { ReferralsModal } from "./ReferralsModal";

type UserProfile = {
  id: string;
  vip_plan?: string | null;
  vip_expires_at?: string | null;
  balance?: number | string | null;
  email?: string | null;
};

type UserOrder = {
  id: string;
  created_at: string;
  services?: { title?: string } | null;
  quantity: number;
  amount: number | string;
  target_url: string;
  status: "Pending" | "Processing" | "Completed" | string;
};

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showReferralsModal, setShowReferralsModal] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) setProfile(data as UserProfile);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) fetchProfile(data.user.id);
    });

    const handleBalanceUpdate = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) fetchProfile(data.user.id);
      });
    };

    window.addEventListener("balance-update", handleBalanceUpdate);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("balance-update", handleBalanceUpdate);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const fetchUserOrders = async () => {
    if (!user?.email) return;
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, services(title)")
      .eq("customer_email", user.email)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoadingOrders(false);
  };

  useEffect(() => {
    if (showOrdersModal && user) {
      fetchUserOrders();
    }
  }, [showOrdersModal, user]);

  return (
    <>
      <header className="w-full border-b border-border/40 relative z-50 overflow-hidden">
        <div className={user ? "mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-6" : "mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 md:gap-4 md:px-6 md:py-6"}>
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 group">
          <div className="shrink-0 text-primary drop-shadow-[0_0_10px_rgba(29,185,84,0.3)] group-hover:scale-110 transition-transform duration-300">
            <Rocket size={28} strokeWidth={2.5} />
          </div>
          <span className="text-xl sm:text-2xl font-black tracking-normal text-fg flex items-center whitespace-nowrap">
            {"CYNETWORK".split("").map((letter, idx) => (
              <span
                key={idx}
                className="inline-block transition-all duration-300 transform hover:scale-135 hover:text-primary hover:rotate-6 hover:-translate-y-1 cursor-default select-none drop-shadow-[0_0_8px_transparent] hover:drop-shadow-[0_0_12px_rgba(29,185,84,0.6)] font-black"
                style={{
                  transitionDelay: `${idx * 15}ms`
                }}
              >
                {letter}
              </span>
            ))}
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 md:flex md:flex-wrap md:items-center md:justify-center md:gap-x-3 md:gap-y-1 lg:gap-x-5 font-bold text-muted text-sm">
          <Link href="/quick-start" className="text-primary hover:text-primary-dark font-extrabold uppercase text-xs tracking-wider flex items-center gap-1 transition-colors animate-pulse whitespace-nowrap">🚀 Quick Start</Link>
          <Link href="/order-page" className="text-[#1877F2] hover:text-[#4e8df5] font-extrabold uppercase text-xs tracking-wider transition-colors whitespace-nowrap">Order Page</Link>
          <Link href="/affiliate" className="hover:text-fg transition-colors whitespace-nowrap">Affiliate</Link>
          <Link href="/vip" className="hover:text-primary transition-colors flex items-center gap-1.5 uppercase tracking-wider text-xs font-extrabold whitespace-nowrap">
            <Crown size={14} />
            VIP
          </Link>
          <Link href="/services" className="hover:text-fg transition-colors whitespace-nowrap">Services</Link>
          <Link href="/track" className="hover:text-fg transition-colors whitespace-nowrap hidden lg:inline">Status Tracker</Link>
        </nav>

        <div className={user ? "grid w-full grid-cols-[minmax(0,1fr)_44px_44px_44px] items-center gap-2 md:flex md:w-auto md:shrink-0 md:gap-2 lg:gap-3" : "flex w-full items-center justify-end md:w-auto md:shrink-0"}>
              {user ? (
                <>
                  {profile?.vip_plan && isVipActive(profile) && (
                    <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-primary">
                      <Crown size={12} />
                      VIP {getVipDiscountPercent(profile)}% OFF
                    </span>
                  )}

                  <button
                    onClick={() => setShowTopUpModal(true)}
                    className="flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border border-[#1877F2]/30 bg-[#1877F2]/10 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#1877F2] transition-all hover:bg-[#1877F2]/20 md:h-auto md:py-2 md:text-xs cursor-pointer"
                  >
                <Wallet size={14} /> 
                ₱{profile?.balance ? Number(profile.balance).toFixed(0) : "0"}
              </button>

              <button 
                onClick={() => setShowReferralsModal(true)}
                className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-full border border-border/80 bg-card px-0 py-2 text-xs font-extrabold uppercase tracking-wider text-[#1877F2] transition-all hover:bg-elevated md:w-auto md:px-4 cursor-pointer"
                title="Invite & Earn"
              >
                <Gift size={14} /> 
                <span className="hidden lg:inline">Invite & Earn</span>
              </button>

              <button 
                onClick={() => setShowOrdersModal(true)}
                className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-full border border-border/80 bg-card px-0 py-2 text-xs font-extrabold uppercase tracking-wider text-[#1877F2] transition-all hover:bg-elevated md:w-auto md:px-4 cursor-pointer"
                title="My Orders"
              >
                <ClipboardList size={14} /> 
                <span className="hidden lg:inline">My Orders</span>
              </button>
              
              <span className="hidden md:inline text-xs font-semibold text-muted max-w-[120px] truncate">
                {user.email}
              </span>

              <ThemeToggle />

              <button 
                onClick={handleSignOut}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 md:h-auto md:w-auto md:p-1.5 md:rounded-lg cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link
                href="/login"
                className="bg-[#1877F2] hover:bg-[#4e8df5] text-fg font-extrabold py-2.5 px-5 sm:px-6 rounded-full transition-all duration-300 transform hover:scale-[1.03] shadow-md shadow-blue-500/10 text-xs uppercase tracking-wider"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
        </div>
        <div className="border-t border-border/40 px-4 pb-4 pt-3 md:hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <ThemeToggle />
            <Link
              href="/vip"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 text-[11px] font-black uppercase tracking-wider text-primary shadow-lg shadow-emerald-500/5 transition-all hover:bg-primary/20"
            >
              <Crown size={15} />
              {profile?.vip_plan && isVipActive(profile)
                ? `VIP ${getVipDiscountPercent(profile)}% OFF`
                : "VIP Account"}
            </Link>
          </div>
        </div>
      </header>

      {/* Sleek Spotify-Themed User Orders Dashboard Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <button 
              onClick={() => setShowOrdersModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-fg transition-colors p-1 hover:bg-elevated/50 rounded-lg cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <div className="p-6 border-b border-border/60">
              <h2 className="text-xl font-black text-fg tracking-tight flex items-center gap-2">
                📋 Your <span className="text-[#1877F2]">Order History</span>
              </h2>
              <p className="text-muted text-xs mt-1">Real-time status tracking for your accounts</p>
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              {loadingOrders ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="animate-spin text-[#1877F2]" size={28} />
                  <span className="text-xs text-muted font-bold uppercase tracking-wider">Retrieving history...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12 bg-elevated border border-border p-6 rounded-xl space-y-2">
                  <p className="text-muted text-sm font-bold">No orders found.</p>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    Once you place an amplification order, it will automatically register under your account profile here!
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {orders.map((order) => {
                    const displayId = `BS-${order.id.slice(0, 8).toUpperCase()}`;
                    return (
                      <div key={order.id} className="bg-elevated border border-border/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1.5 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#1877F2] tracking-widest">{displayId}</span>
                            <span className="text-[10px] text-muted font-bold uppercase">
                              {format(new Date(order.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-fg flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>{order.services?.title}</span>
                            <span className="text-muted font-normal">•</span>
                            <span className="text-fg">{order.quantity.toLocaleString()} units</span>
                            <span className="text-muted font-normal">•</span>
                            <span className="text-[#1877F2]">₱{Number(order.amount).toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] text-muted truncate max-w-xs sm:max-w-md font-mono select-all">
                            🔗 {order.target_url}
                          </div>
                        </div>

                        <div className="flex items-center sm:justify-end">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                            order.status === 'Pending' ? 'bg-[#ff9800]/10 text-[#ff9800] border border-[#ff9800]/20' :
                            order.status === 'Processing' ? 'bg-[#2196f3]/10 text-[#2196f3] border border-[#2196f3]/20' :
                            order.status === 'Completed' ? 'bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20' :
                            'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {user && (
        <TopUpModal 
          isOpen={showTopUpModal} 
          onClose={() => setShowTopUpModal(false)} 
          user={user}
          onTopUpSuccess={() => fetchProfile(user.id)}
        />
      )}

      {user && (
        <ReferralsModal 
          isOpen={showReferralsModal} 
          onClose={() => setShowReferralsModal(false)} 
          user={user}
          profile={profile}
        />
      )}
    </>
  );
}
