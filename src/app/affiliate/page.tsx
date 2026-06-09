"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ReferralDashboardContent } from "@/components/ReferralsModal";
import { createClient } from "@/utils/supabase/client";

export default function AffiliatePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();
        setProfile(profileData);
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-bg px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-[#121212] p-8 text-center text-sm font-bold text-slate-400">
              Loading affiliate dashboard...
            </div>
          ) : user ? (
            <ReferralDashboardContent user={user} profile={profile} />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#121212] p-8 text-center">
              <h1 className="text-2xl font-black text-white">Affiliate Dashboard</h1>
              <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-relaxed text-slate-400">
                Sign in or create an account to get your referral link, track commissions, and request GCash payout.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex rounded-full bg-[#1DB954] px-6 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760]"
              >
                Sign In To Start
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
