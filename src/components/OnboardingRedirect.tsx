"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingRedirect() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const onboarded = localStorage.getItem("onboarded");
      if (!onboarded) {
        router.push("/quick-start");
      } else {
        setLoading(false);
      }
    }
  }, [router]);

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
