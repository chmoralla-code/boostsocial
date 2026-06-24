"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, KeyRound, Loader2, X } from "lucide-react";
import { PinGate } from "@/app/admin/(dashboard)/PinGate";

export function AdminSecurityControls({ email }: { email: string }) {
  const router = useRouter();
  const [locking, setLocking] = useState(false);
  const [showChange, setShowChange] = useState(false);

  const handleLock = async () => {
    setLocking(true);
    try {
      await fetch("/api/admin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      });
    } catch {
      // ignore — refresh will still surface the gate
    } finally {
      router.refresh();
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleLock}
        disabled={locking}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#121212] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:border-[#1DB954]/35 hover:text-[#1DB954] disabled:opacity-50"
      >
        {locking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
        Lock now
      </button>

      <button
        type="button"
        onClick={() => setShowChange((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#121212] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:border-[#1DB954]/35 hover:text-[#1DB954]"
      >
        <KeyRound size={14} />
        {showChange ? "Hide" : "Change PIN"}
      </button>

      {showChange && (
        <div className="relative rounded-2xl border border-slate-800 bg-[#0f0f0f]/80 p-3">
          <button
            type="button"
            onClick={() => setShowChange(false)}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition hover:text-white"
            aria-label="Close change PIN"
          >
            <X size={14} />
          </button>
          <PinGate
            mode="change"
            variant="inline"
            email={email}
            onAfterChange={() => setShowChange(false)}
          />
        </div>
      )}
    </div>
  );
}
