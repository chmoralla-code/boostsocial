"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/quick-start");
  }, [router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-slate-400"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-[#1DB954] border-t-transparent animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">
          Loading PinoyBoosting...
        </span>
      </div>
    </div>
  );
}
