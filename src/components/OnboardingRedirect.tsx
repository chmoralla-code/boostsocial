"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function OnboardingRedirect() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== "undefined") {
      const onboarded = localStorage.getItem("onboarded");
      if (onboarded === "true") {
        if (isMounted) setLoading(false);
        return;
      }

      // Check if user is logged in
      supabase.auth.getUser().then(({ data }) => {
        if (!isMounted) return;
        if (data?.user) {
          // If they are an existing/logged in user, mark as onboarded and do not redirect
          localStorage.setItem("onboarded", "true");
          setLoading(false);
        } else {
          // No active session and not onboarded -> redirect to quick start
          router.push("/quick-start");
        }
      }).catch(() => {
        if (isMounted) {
          router.push("/quick-start");
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  if (loading && typeof window !== "undefined" && !localStorage.getItem("onboarded")) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] z-[9999] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1DB954] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Loading CYNETWORK...</span>
        </div>
      </div>
    );
  }

  return null;
}
