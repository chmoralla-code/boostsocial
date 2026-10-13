"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from 'next/link';
import { Rocket, LogOut, ClipboardList, X, Loader2, Wallet, Gift, Crown, Menu, ChevronDown, Sparkles, Share2, Key } from 'lucide-react';
import { ThemeToggle } from "./ThemeToggle";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import { format } from "date-fns";
import { isVipActive } from "@/utils/vip";
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // One-letter avatar for the account menu.
  const accountInitial = useMemo(() => {
    const source = (user?.email ?? "").trim();
    return source ? source[0].toUpperCase() : "U";
  }, [user?.email]);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!showAccountMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAccountMenu(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showAccountMenu]);

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
      <header className="header-sticky w-full border-b border-border/40 relative z-50 overflow-visible">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:gap-4 md:px-6 md:py-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 group">
          <div className="shrink-0 text-primary drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] group-hover:scale-110 transition-transform duration-300">
            <Rocket size={24} strokeWidth={2.5} />
          </div>
          <span className="text-xl sm:text-2xl font-black tracking-normal text-fg flex items-center whitespace-nowrap">
            {"PINOYBOOSTING".split("").map((letter, idx) => (
              <span
                key={idx}
                className="inline-block transition-all duration-300 transform hover:scale-135 hover:text-primary hover:rotate-6 hover:-translate-y-1 cursor-default select-none drop-shadow-[0_0_8px_transparent] hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] font-black"
                style={{
                  transitionDelay: `${idx * 15}ms`
                }}
              >
                {letter}
              </span>
            ))}
          </span>
        </Link>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="flex md:hidden h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-card/80 text-muted transition-all duration-300 hover:border-primary/40 hover:text-fg cursor-pointer"
          aria-label="Toggle menu"
        >
          {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Shop nav: one weight for every link, one clear call to action. */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-x-0.5 md:flex lg:gap-x-1 font-semibold text-sm">
          <Link href="/quick-start" className="nav-underline rounded-full px-3 py-2 text-muted transition-colors hover:text-fg whitespace-nowrap">Quick Start</Link>
          <Link href="/services" className="nav-underline rounded-full px-3 py-2 text-muted transition-colors hover:text-fg whitespace-nowrap">Services</Link>
          <Link href="/track" className="nav-underline hidden rounded-full px-3 py-2 text-muted transition-colors hover:text-fg whitespace-nowrap lg:inline-flex">Status Tracker</Link>
          {!user && (
            <>
              <Link href="/vip" className="nav-underline rounded-full px-3 py-2 text-muted transition-colors hover:text-fg whitespace-nowrap">VIP</Link>
              <Link href="/affiliate" className="nav-underline hidden rounded-full px-3 py-2 text-muted transition-colors hover:text-fg whitespace-nowrap lg:inline-flex">Affiliate</Link>
            </>
          )}
          <Link href="/order-page" className="ml-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-black shadow-md shadow-white/10 transition-all duration-300 hover:bg-[#d4d4d8] whitespace-nowrap">Order Page</Link>
        </nav>

        {/* Money + account: two targets instead of five loose icons. */}
        <div className="hidden md:flex md:w-auto md:shrink-0 md:items-center md:justify-end md:gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTopUpModal(true)}
                className="flex h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 pl-3 pr-3.5 text-primary transition-all hover:bg-primary/20 cursor-pointer"
                title="Wallet balance — click to top up"
              >
                <Wallet size={14} />
                <span className="text-sm font-black tabular-nums tracking-tight">
                  ₱{profile?.balance ? Number(profile.balance).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}
                </span>
              </button>

              {profile?.vip_plan && isVipActive(profile) && (
                <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary">
                  <Crown size={12} />
                  VIP
                </span>
              )}

              <div className="relative" ref={accountMenuRef}>
                <button
                  onClick={() => setShowAccountMenu((open) => !open)}
                  className="flex h-10 items-center gap-1.5 rounded-full border border-border/80 bg-card pl-1 pr-2.5 transition-all hover:border-primary/40 cursor-pointer"
                  aria-haspopup="menu"
                  aria-expanded={showAccountMenu}
                  title="My account"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-black uppercase text-primary">
                    {accountInitial}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-muted transition-transform duration-200 ${showAccountMenu ? "rotate-180" : ""}`}
                  />
                </button>

                {showAccountMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+10px)] z-50 w-60 overflow-hidden rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="border-b border-border/60 px-3 pb-2.5 pt-2">
                      <p className="truncate text-xs font-bold text-fg">{user.email}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Signed in</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        setShowOrdersModal(true);
                      }}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated cursor-pointer"
                    >
                      <ClipboardList size={16} className="text-muted" />
                      My Orders
                    </button>
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        setShowReferralsModal(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated cursor-pointer"
                    >
                      <Gift size={16} className="text-muted" />
                      Invite &amp; Earn
                    </button>
                    <Link
                      href="/vip"
                      onClick={() => setShowAccountMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
                    >
                      <Sparkles size={16} className="text-muted" />
                      VIP Account
                    </Link>
                    <Link
                      href="/affiliate"
                      onClick={() => setShowAccountMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
                    >
                      <Share2 size={16} className="text-muted" />
                      Affiliate Program
                    </Link>
                    <Link
                      href="/app/api-access"
                      onClick={() => setShowAccountMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
                    >
                      <Key size={16} className="text-muted" />
                      Reseller API
                    </Link>
                    <div className="my-1 border-t border-border/60" />
                    <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
                      <span className="text-sm font-semibold text-fg">Appearance</span>
                      <ThemeToggle />
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/login"
                className="magnetic bg-white hover:bg-[#d4d4d8] text-black font-extrabold py-2 px-4 rounded-full transition-all duration-300 transform shadow-md shadow-white/10 text-xs uppercase tracking-wider"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
        </div>
        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-border/40 bg-card/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
            <div className="border-b border-border/40 px-4 py-3">
              {user ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowTopUpModal(true);
                    }}
                    className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-xs font-black uppercase tracking-wider text-primary transition-all hover:bg-primary/20"
                  >
                    <Wallet size={15} />
                    Top Up: ₱{profile?.balance ? Number(profile.balance).toFixed(0) : "0"}
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowReferralsModal(true);
                    }}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-elevated text-xs font-black uppercase tracking-wider text-primary transition-all hover:bg-card"
                  >
                    <Gift size={15} />
                    Invite
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowOrdersModal(true);
                    }}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-elevated text-xs font-black uppercase tracking-wider text-primary transition-all hover:bg-card"
                  >
                    <ClipboardList size={15} />
                    Orders
                  </button>
                  <Link
                    href="/vip"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-elevated text-xs font-black uppercase tracking-wider text-primary transition-all hover:bg-card"
                  >
                    <Sparkles size={15} />
                    VIP
                  </Link>
                  <Link
                    href="/affiliate"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-elevated text-xs font-black uppercase tracking-wider text-primary transition-all hover:bg-card"
                  >
                    <Share2 size={15} />
                    Affiliate
                  </Link>
                  <div className="col-span-2 flex items-center justify-between rounded-xl border border-border/80 bg-elevated px-3 py-2">
                    <span className="text-xs font-black uppercase tracking-wider text-muted">Appearance</span>
                    <ThemeToggle />
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-black uppercase tracking-wider text-red-400 transition-all hover:bg-red-500/15"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex h-11 flex-1 items-center justify-center rounded-xl bg-white px-4 text-xs font-black uppercase tracking-wider text-black shadow-md shadow-white/10 transition-all hover:bg-[#d4d4d8]"
                  >
                    Sign In
                  </Link>
                  <ThemeToggle />
                </div>
              )}
            </div>
            <nav className="flex flex-col px-4 py-3 gap-1">
              <Link 
                href="/quick-start" 
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                Quick Start
              </Link>
              <Link 
                href="/order-page" 
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                Order Page
              </Link>
              <Link 
                href="/services" 
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-fg hover:bg-white/5 transition-colors"
              >
                Services
              </Link>
              {!user && (
                <>
                  <Link 
                    href="/vip" 
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-fg hover:bg-white/5 transition-colors"
                  >
                    VIP Account
                  </Link>
                  <Link 
                    href="/affiliate" 
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-fg hover:bg-white/5 transition-colors"
                  >
                    Affiliate
                  </Link>
                </>
              )}
              <Link 
                href="/track" 
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-fg hover:bg-white/5 transition-colors"
              >
                Status Tracker
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* User Orders Dashboard Modal */}
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
                Your <span className="text-primary">Order History</span>
              </h2>
              <p className="text-muted text-xs mt-1">Real-time status tracking for your accounts</p>
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              {loadingOrders ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="animate-spin text-primary" size={28} />
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
                            <span className="font-mono text-xs font-black text-primary tracking-widest">{displayId}</span>
                            <span className="text-[10px] text-muted font-bold uppercase">
                              {format(new Date(order.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-fg flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>{order.services?.title}</span>
                            <span className="text-muted font-normal">•</span>
                            <span className="text-fg">{order.quantity.toLocaleString()} units</span>
                            <span className="text-muted font-normal">•</span>
                            <span className="text-primary">₱{Number(order.amount).toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] text-muted truncate max-w-xs sm:max-w-md font-mono select-all">
                            {order.target_url}
                          </div>
                        </div>

                        <div className="flex items-center sm:justify-end">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                            order.status === 'Pending' ? 'bg-white/10 text-white border border-white/30' :
                            order.status === 'Processing' ? 'bg-white/5 text-[#d4d4d8] border border-white/20' :
                            order.status === 'Completed' ? 'bg-white text-black border border-white' :
                            'bg-white/10 text-white border border-white/30'
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
