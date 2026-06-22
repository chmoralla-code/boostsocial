"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Megaphone, X, UserPlus, Check, Loader2 } from "lucide-react";
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
    <div className="relative grid grid-cols-4 items-center w-full max-w-xs sm:max-w-md md:max-w-xl mx-auto select-none bg-[#121212]/90 border border-slate-800/80 p-3 sm:p-4 md:p-5 rounded-full shadow-lg overflow-hidden">
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
    <h1 className="px-2 text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-tight leading-tight select-none text-center">
      {renderWord("WELCOME", 0)}
      {" "}
      {renderWord("TO", 8)}
      <br className="sm:hidden" />
      {" "}
      <span className="inline-block sm:inline animate-neon">
        <span className="spotify-shimmer-text" style={{ WebkitTextFillColor: "#1DB954" }}>
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

  // OTP verification states
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

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

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        setFormMessage({ type: "error", text: data.error || "Failed to create account." });
        return;
      }

      // Switch to OTP verification mode
      setOtpMode(true);
      setFormMessage({
        type: "success",
        text: "📬 Verification code sent! Please check your inbox for the 6-digit code."
      });

      // Auto-send OTP code
      try {
        setOtpSending(true);
        await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() })
        });
        setOtpSending(false);
        setOtpCountdown(30);
      } catch {
        setOtpSending(false);
      }
    } catch (err) {
      setFormMessage({
        type: "error",
        text: getErrorMessage(err) || "Sign-up failed. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email.trim() || otpSending || otpCountdown > 0) return;
    setOtpSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpCountdown(30);
        setFormMessage({ type: "success", text: "📬 A new verification code has been sent." });
      } else if (data.error === "rate_limited") {
        if (data.remaining) setOtpCountdown(data.remaining);
        setFormMessage({ type: "error", text: data.message });
      } else {
        setFormMessage({ type: "error", text: data.error || "Failed to send code." });
      }
    } catch {
      setFormMessage({ type: "error", text: "Network error." });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!email.trim() || !otpCode || otpVerifying) return;
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: otpCode })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpVerified(true);
        setFormMessage({
          type: "success",
          text: "✅ Email verified successfully! You can now sign in."
        });
      } else {
        setFormMessage({ type: "error", text: data.error || "Invalid code." });
      }
    } catch {
      setFormMessage({ type: "error", text: "Network error." });
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("onboarded", "true");
      } catch {
        // ignore storage errors (private mode / quota)
      }
    }
    router.replace("/");
  };

  return (
    <main
      className="flex-grow flex flex-col items-center pt-10 sm:pt-20 min-h-screen text-slate-300 relative overflow-hidden"
      style={{ backgroundColor: "#000000", color: "#cbd5e1" }}
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute('data-theme','dark');`,
        }}
      />
      {/* Minimal floating top bar — back to home */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={handleSkip}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-800/80 bg-[#121212]/80 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 backdrop-blur-sm transition-colors hover:border-[#1DB954]/40 hover:text-[#1DB954]"
          aria-label="Back to home"
          title="Back to home"
        >
          ← Home
        </button>
      </div>

      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-30%] left-[10%] w-[500px] h-[500px] rounded-full fb-glow-blob opacity-30" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full galaxy-glow-blob opacity-35" />
      </div>

      <div className="w-full max-w-xs sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto z-10 space-y-8 pb-20 sm:px-6">
        <div className="text-center space-y-4 sm:space-y-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 text-[10px] font-black uppercase tracking-widest animate-pulse">
            ✨ Quick Start Guide
          </span>

          <ShimmerHero />

          <p className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-wide max-w-xl mx-auto leading-relaxed">
            CONGRATS, YOU HAVE ARRIVE AT DIRECT SUPPLIER BOOSTING. MEANING YOU WILL GET EVERYTHING AFFORDABLE
          </p>
        </div>

        <div className="w-full max-w-lg md:max-w-2xl mx-auto">
          <Stepper />
        </div>

        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto bg-[#121212]/95 border border-slate-800/85 p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
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

          {!otpMode ? (
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
          ) : (
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
              <div className="w-full px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-800 text-xs font-semibold text-white">{email}</div>
            </div>

            <div className="bg-[#0a0a0a] border border-slate-800/80 p-4 rounded-xl space-y-3">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">Verify Your Email</p>
                <p className="text-[11px] text-slate-400 mt-1">Enter the 6-digit code sent to your email</p>
              </div>

              <div className="flex justify-center">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-40 bg-black border border-slate-800 px-4 py-3 rounded-xl text-center text-white text-lg font-black tracking-[0.3em] focus:outline-none focus:border-[#1DB954] transition-all font-mono"
                  disabled={otpVerified}
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otpCode.length !== 6 || otpVerifying || otpVerified}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-[#1DB954]/50 disabled:cursor-not-allowed text-black font-black py-3 rounded-xl transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                {otpVerifying ? (
                  <><Loader2 className="animate-spin" size={13} /> Verifying...</>
                ) : otpVerified ? (
                  <>✅ Verified</>
                ) : (
                  <>Verify Code</>
                )}
              </button>

              {!otpVerified && (
                <div className="text-center">
                  {otpCountdown > 0 ? (
                    <span className="text-[10px] text-slate-500 font-bold">Resend in {otpCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpSending}
                      className="text-[10px] text-[#1DB954] hover:underline font-bold cursor-pointer"
                    >
                      {otpSending ? "Sending..." : "📬 Resend Code"}
                    </button>
                  )}
                </div>
              )}

              {otpVerified && (
                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-block w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-3 rounded-xl transition-all duration-200 text-xs uppercase tracking-wider text-center"
                  >
                    Go to Sign In →
                  </Link>
                </div>
              )}
            </div>
          </div>
          )}

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
