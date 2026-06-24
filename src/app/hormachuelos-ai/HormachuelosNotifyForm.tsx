"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail, Bell } from "lucide-react";

export function HormachuelosNotifyForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/hormachuelos-ai/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to subscribe.");
      }
      setStatus("done");
      setMessage("You are on the list. We will email you the moment Hormachuelos AI goes live.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-[#1DB954]/25 bg-[#1DB954]/10 p-4 text-left">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#1DB954]" />
        <p className="text-xs font-semibold leading-relaxed text-[#1DB954]">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
        Get notified at launch
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="you@email.com"
            disabled={status === "loading"}
            className="w-full rounded-xl border border-slate-800 bg-[#121212] py-3 pl-11 pr-4 text-sm font-semibold text-white placeholder-slate-600 transition focus:border-[#8B5CF6] focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#a78bfa] disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Bell size={14} />
          )}
          {status === "loading" ? "Saving" : "Notify Me"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-left text-[11px] font-semibold text-red-400">{message}</p>
      )}
    </form>
  );
}
