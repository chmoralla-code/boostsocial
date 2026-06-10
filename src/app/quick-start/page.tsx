"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Megaphone, X, UserPlus, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const ANNOUNCEMENT_DISMISS_KEY = "pb_apk_announcement_dismissed";
const ANNOUNCEMENT_VERSION = "pinoyboosting-apk-v1";
const APK_DOWNLOAD_PATH = "/downloads/pinoyboosting.apk";

type AnnouncementState = "checking" | "open" | "dismissed";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function AnnouncementModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickstart-announcement-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#1DB954]/25 bg-[#121212] p-5 text-center text-white shadow-2xl shadow-black/50 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close announcement"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-black/30 text-slate-400 transition hover:border-slate-600 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954]">
          <Megaphone size={22} />
        </div>

        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#1DB954]">
          Announcement
        </p>
        <h2
          id="quickstart-announcement-title"
          className="pr-8 text-xl font-black tracking-tight sm:text-2xl"
        >
          What&apos;s new?
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-relaxed text-slate-300">
          Pinoyboosting APK v1.0 available
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={APK_DOWNLOAD_PATH}
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1DB954] px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760]"
          >
            Download
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-700 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-slate-500 hover:bg-white/5"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

type StepperEntry = { num: number; label: string };

const STEPPER: StepperEntry[] = [
  { num: 1, label: "Account Setup" },
  { num: 2, label: "Pick Boost" },
  { num: 3, label: "Checkout" },
  { num: 4, label: "Launch & Track" },
];

function Stepper() {
  return (
    <div className="relative grid grid-cols-4 items-center w-full max-w-xs sm:max-w-lg mx-auto select-none bg-[#121212]/90 border border-slate-800/80 p-3 sm:p-4.5 rounded-full shadow-lg overflow-hidden">
      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[1px] bg-slate-800 z-0" />
      {STEPPER.map((st) => {
        const isActive = st.num === 1;
        return (
          <div
            key={st.num}
            className="relative z-10 flex flex-col items-center space-y-1.5"
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border transition-all duration-350 ${
                isActive
                  ? "bg-[#0a0a0a] border-[#1DB954] text-[#1DB954] shadow-[0_0_12px_rgba(29,185,84,0.35)]"
                  : "bg-[#121212] border-slate-800 text-slate-500"
              }`}
            >
              {st.num}
            </div>
            <span
              className={`text-[9px] font-black uppercase tracking-wider hidden sm:block ${
                isActive ? "text-white" : "text-slate-500"
              }`}
            >
              {st.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ShimmerHero() {
  const renderWord = (
    word: string,
    startIdx: number,
    options: { shimmer?: boolean; isFloat?: boolean } = {}
  ) => {
    const { shimmer = false, isFloat = false } = options;
    return (
      <span className="inline-block whitespace-nowrap">
        {word.split("").map((letter, i) => {
          const idx = startIdx + i;
          return (
            <span
              key={`${word}-${i}`}
              className={`inline-block ${isFloat ? "animate-letter-float" : "animate-fade-in-up"}`}
              style={{
                animationDelay: isFloat ? `${idx * 120}ms` : `${idx * 20}ms`,
                animationFillMode: isFloat ? undefined : "both",
              }}
            >
              {letter}
            </span>
          );
        })}
        {shimmer ? <span className="sr-only"> </span> : null}
      </span>
    );
  };

  return (
    <h1 className="px-2 text-2xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-tight select-none">
      {renderWord("WELCOME", 0)}
      {" "}
      {renderWord("TO", 8)}
      {" "}
      <span className="block sm:inline animate-neon">
        <span className="spotify-shimmer-text">
          {renderWord("PINOY", 11, { isFloat: true })}
          {" "}
          {renderWord("MADE", 17, { isFloat: true })}
        </span>
      </span>
      <br className="sm:hidden" />
      {" "}
      {renderWord("BOOSTING", 22)}
      {" "}
      {renderWord("SERVICES.", 31)}
    </h1>
  );
}

export default function QuickStartPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [announcement, setAnnouncement] = useState<AnnouncementState>("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismissed = window.localStorage.getItem(
        `${ANNOUNCEMENT_DISMISS_KEY}:${ANNOUNCEMENT_VERSION}`
      );
      setAnnouncement(dismissed === "true" ? "dismissed" : "open");
    } catch {
      setAnnouncement("open");
    }
  }, []);

  const dismissAnnouncement = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          `${ANNOUNCEMENT_DISMISS_KEY}:${ANNOUNCEMENT_VERSION}`,
          "true"
        );
      } catch {
        // Ignore storage errors (private mode / quota)
      }
    }
    setAnnouncement("dismissed");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setFormMessage({
        type: "error",
        text: "Please enter your email and a password to continue.",
      });
      return;
    }

    setSubmitting(true);
    setFormMessage(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormMessage({ type: "error", text: error.message });
        return;
      }

      const created = Boolean(data?.user);
      setFormMessage({
        type: "success",
        text: created
          ? "Account created! Check your inbox to confirm and you're all set."
          : "Sign-up request received. Check your inbox to finish setting up your account.",
      });
    } catch (err) {
      setFormMessage({
        type: "error",
        text: getErrorMessage(err) || "Sign-up failed. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.replace("/");
  };

  return (
    <main className="flex-grow flex flex-col items-center pt-10 sm:pt-20 bg-[#0a0a0a] min-h-screen text-slate-300 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-30%] left-[10%] w-[500px] h-[500px] rounded-full fb-glow-blob opacity-30" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full spotify-glow-blob opacity-30" />
      </div>

      <div className="w-full max-w-xs mx-auto z-10 space-y-8 pb-20 sm:max-w-3xl sm:px-4">
        <div className="text-center space-y-3.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 text-[10px] font-black uppercase tracking-widest animate-pulse">
            ✨ Quick Start Guide
          </span>

          <ShimmerHero />

          <p className="text-slate-400 text-xs font-bold uppercase tracking-wide max-w-lg mx-auto leading-relaxed animate-pulse">
            CONGRATS, YOU HAVE ARRIVE AT DIRECT SUPPLIER BOOSTING. MEANING YOU WILL GET EVERYTHING AFFORDABLE
          </p>
        </div>

        <Stepper />

        <div className="w-full max-w-xs sm:max-w-md mx-auto bg-[#121212]/95 border border-slate-800/85 p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/5 rounded-full blur-xl pointer-events-none" />

          <div className="text-center pb-4 mb-6 border-b border-slate-800/60 select-none">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#1DB954]">
              Register New Account
            </h2>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">
              Quickstart is strictly for new users to amplify their first campaign.
            </p>
          </div>

          {formMessage && (
            <div
              role={formMessage.type === "error" ? "alert" : "status"}
              className={`mb-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] font-bold ${
                formMessage.type === "error"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {formMessage.type === "success" ? (
                <Check size={14} className="mt-0.5 flex-shrink-0" />
              ) : null}
              <span>{formMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-550"
                  size={16}
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-800 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 text-xs font-semibold text-white placeholder-slate-500 transition-all"
                  placeholder="Enter your email address"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-550"
                  size={16}
                />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-800 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 text-xs font-semibold text-white placeholder-slate-500 transition-all"
                  placeholder="Create a secure password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-[#1DB954]/50 disabled:cursor-not-allowed text-black font-black py-3 rounded-xl transition-all duration-200 uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10 mt-2 active:scale-[0.98]"
            >
              <UserPlus size={14} />
              {submitting ? "Creating Account..." : "Create Account & Proceed"}
            </button>
          </form>

          <div className="mt-5 text-center flex flex-col gap-3.5 select-none border-t border-slate-800/50 pt-4">
            <button
              type="button"
              onClick={handleSkip}
              className="text-[10px] font-black text-slate-500 hover:text-[#1DB954] uppercase tracking-widest transition-colors cursor-pointer"
            >
              Skip & Proceed to Main Website →
            </button>
            <Link
              href="/login"
              className="text-[10px] font-black text-[#1DB954] hover:text-[#1ed760] hover:underline uppercase tracking-widest transition-colors"
            >
              Already have an account? Sign In →
            </Link>
          </div>
        </div>
      </div>

      {announcement === "open" && (
        <AnnouncementModal onClose={dismissAnnouncement} />
      )}
    </main>
  );
}
