"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2, Lock, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";

type Mode = "setup" | "unlock" | "change";
type Variant = "fullscreen" | "inline";

type Props = {
  mode: Mode;
  variant?: Variant;
  email: string;
  onAfterChange?: () => void;
};

type Step =
  | "enter"
  | "confirm"
  | "current"
  | "new"
  | "newConfirm"
  | "submitting"
  | "done";

type StepCopy = { title: string; subtitle: string };

const STEP_COPY: Record<Mode, Partial<Record<Step, StepCopy>>> = {
  setup: {
    enter: { title: "Create your admin PIN", subtitle: "Choose a 4-digit PIN to lock the dashboard." },
    confirm: { title: "Confirm your PIN", subtitle: "Re-enter the same 4 digits to confirm." },
    submitting: { title: "Saving PIN…", subtitle: "Securing your dashboard." },
    done: { title: "PIN saved", subtitle: "Your dashboard is now protected." },
  },
  unlock: {
    enter: { title: "Enter your PIN", subtitle: "Unlock the admin dashboard to continue." },
    submitting: { title: "Verifying…", subtitle: "Checking your PIN." },
    done: { title: "Unlocked", subtitle: "Welcome back." },
  },
  change: {
    current: { title: "Enter current PIN", subtitle: "Verify it is really you." },
    new: { title: "Enter new PIN", subtitle: "Choose a new 4-digit PIN." },
    newConfirm: { title: "Confirm new PIN", subtitle: "Re-enter the new 4 digits." },
    submitting: { title: "Updating PIN…", subtitle: "Saving your new PIN." },
    done: { title: "PIN updated", subtitle: "Your new PIN is active." },
  },
};

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PinGate({ mode, variant = "fullscreen", email, onAfterChange }: Props) {
  const router = useRouter();
  const initialStep: Step = mode === "change" ? "current" : "enter";
  const [step, setStep] = useState<Step>(initialStep);
  const [entry, setEntry] = useState("");
  const [firstEntry, setFirstEntry] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [lockedRemainingMs, setLockedRemainingMs] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const lockTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (lockTimer.current) clearInterval(lockTimer.current);
    };
  }, []);

  useEffect(() => {
    if (lockedRemainingMs <= 0) return;
    lockTimer.current = setInterval(() => {
      setLockedRemainingMs((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          if (lockTimer.current) clearInterval(lockTimer.current);
          setError("");
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (lockTimer.current) clearInterval(lockTimer.current);
    };
  }, [lockedRemainingMs]);

  const submitToApi = useCallback(
    async (action: "setup" | "unlock" | "change", payload: { pin: string; currentPin?: string }) => {
      setStep("submitting");
      setError("");
      setSchemaMissing(false);
      try {
        const res = await fetch("/api/admin/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.schemaMissing === true) {
            setSchemaMissing(true);
          }
          if (data?.locked && data?.remainingMs) {
            setLockedRemainingMs(data.remainingMs);
            setError(
              typeof data.error === "string" ? data.error : "Too many attempts. Locked."
            );
          } else {
            setError(typeof data.error === "string" ? data.error : "Something went wrong.");
          }
          if (typeof data.attemptsRemaining === "number") {
            setAttemptsRemaining(data.attemptsRemaining);
          }
          // On failure, restart the relevant flow.
          if (mode === "setup") {
            setFirstEntry("");
            setStep("enter");
          } else if (mode === "change") {
            setCurrentPin("");
            setNewPin("");
            setStep("current");
          } else {
            setStep("enter");
          }
          return false;
        }
        setAttemptsRemaining(null);
        setStep("done");
        return true;
      } catch {
        setError("Network error. Please try again.");
        setStep(mode === "change" ? "current" : "enter");
        return false;
      }
    },
    [mode]
  );

  const handleComplete = useCallback(
    async (value: string) => {
      if (mode === "setup") {
        if (step === "enter") {
          setFirstEntry(value);
          setEntry("");
          setStep("confirm");
          return;
        }
        if (step === "confirm") {
          if (value !== firstEntry) {
            setError("PINs do not match. Start over.");
            setFirstEntry("");
            setEntry("");
            setStep("enter");
            return;
          }
          const ok = await submitToApi("setup", { pin: value });
          if (ok) {
            setTimeout(() => router.refresh(), 600);
          }
          return;
        }
      }

      if (mode === "unlock") {
        const ok = await submitToApi("unlock", { pin: value });
        if (ok) {
          setTimeout(() => router.refresh(), 500);
        } else {
          setEntry("");
        }
        return;
      }

      if (mode === "change") {
        if (step === "current") {
          setCurrentPin(value);
          setEntry("");
          setStep("new");
          return;
        }
        if (step === "new") {
          setNewPin(value);
          setEntry("");
          setStep("newConfirm");
          return;
        }
        if (step === "newConfirm") {
          if (value !== newPin) {
            setError("New PINs do not match. Start over.");
            setNewPin("");
            setEntry("");
            setStep("new");
            return;
          }
          const ok = await submitToApi("change", { currentPin, pin: value });
          if (ok) {
            setInfo("");
            setTimeout(() => {
              if (onAfterChange) onAfterChange();
              else router.refresh();
            }, 700);
          }
          return;
        }
      }
    },
    [mode, step, firstEntry, currentPin, newPin, submitToApi, router, onAfterChange]
  );

  const pressDigit = useCallback(
    (d: string) => {
      if (step === "submitting" || step === "done") return;
      if (lockedRemainingMs > 0) return;
      setError("");
      setInfo("");
      setEntry((prev) => {
        if (prev.length >= 4) return prev;
        const next = prev + d;
        if (next.length === 4) {
          // Defer to allow the 4th dot to render before submit.
          setTimeout(() => handleComplete(next), 120);
        }
        return next;
      });
    },
    [step, lockedRemainingMs, handleComplete]
  );

  const pressBackspace = useCallback(() => {
    if (step === "submitting" || step === "done") return;
    setError("");
    setEntry((prev) => prev.slice(0, -1));
  }, [step]);

  // Keyboard support: 0-9 + Backspace + Enter.
  useEffect(() => {
    if (variant !== "fullscreen") return;
    const onKey = (e: KeyboardEvent) => {
      if (lockedRemainingMs > 0) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pressBackspace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressDigit, pressBackspace, lockedRemainingMs, variant]);

  const copy = STEP_COPY[mode][step] ?? STEP_COPY[mode][initialStep] ?? {
    title: "",
    subtitle: "",
  };
  const isBusy = step === "submitting";
  const isDone = step === "done";

  const card = (
    <div
      className={
        variant === "fullscreen"
          ? "w-full max-w-sm"
          : "w-full"
      }
    >
      {variant === "fullscreen" && (
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg transition-colors ${
              isDone
                ? "border-[#1DB954]/40 bg-[#1DB954]/15 text-[#1DB954]"
                : "border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954]"
            }`}
          >
            {isDone ? <ShieldCheck size={30} /> : <Lock size={28} className="animate-pulse" />}
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#1DB954]">
            Admin Security
          </div>
        </div>
      )}

      <div className={variant === "fullscreen" ? "text-center" : "mb-4"}>
        <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          {copy.title}
        </h2>
        <p className="mt-1 text-xs font-semibold text-slate-400">{copy.subtitle}</p>
        {variant === "inline" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <KeyRound size={11} /> {email}
          </div>
        )}
      </div>

      {/* PIN dots */}
      <div className="my-6 flex items-center justify-center gap-3">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < entry.length;
          return (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                filled
                  ? "border-[#1DB954] bg-[#1DB954] shadow-[0_0_10px_rgba(29,185,84,0.6)]"
                  : "border-slate-700 bg-transparent"
              }`}
            />
          );
        })}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-left text-xs font-semibold text-red-300">
          <ShieldAlert className="mt-0.5 shrink-0" size={14} />
          <span className="break-words whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {schemaMissing && (
        <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-left text-[11px] text-orange-200">
          <p className="font-bold">
            The <code className="rounded bg-black/40 px-1">admin_secrets</code> table is missing
            on your Supabase database. Run the SQL shown in the error above in the Supabase SQL
            Editor (Database → SQL Editor), then retry.
          </p>
          <a
            href="https://supabase.com/dashboard/project/_/sql/new"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-orange-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-orange-100 hover:bg-orange-500/30"
          >
            Open Supabase SQL Editor
          </a>
        </div>
      )}

      {lockedRemainingMs > 0 && (
        <div className="mb-4 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-center text-xs font-bold text-orange-300">
          Locked. Try again in {formatCountdown(lockedRemainingMs)}
        </div>
      )}

      {!error && lockedRemainingMs === 0 && attemptsRemaining !== null && attemptsRemaining < 5 && (
        <div className="mb-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
        </div>
      )}

      {info && (
        <div className="mb-4 text-center text-xs font-semibold text-[#1DB954]">{info}</div>
      )}

      {/* Keypad */}
      {!isDone && (
        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pressDigit(d)}
              disabled={isBusy || lockedRemainingMs > 0}
              className="flex h-14 items-center justify-center rounded-xl border border-slate-800 bg-[#181818] text-lg font-black text-slate-100 transition-all hover:border-[#1DB954]/40 hover:bg-[#1e1e1e] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <div className="flex h-14 items-center justify-center">
            {isBusy && <Loader2 className="animate-spin text-[#1DB954]" size={20} />}
          </div>
          <button
            type="button"
            onClick={() => pressDigit("0")}
            disabled={isBusy || lockedRemainingMs > 0}
            className="flex h-14 items-center justify-center rounded-xl border border-slate-800 bg-[#181818] text-lg font-black text-slate-100 transition-all hover:border-[#1DB954]/40 hover:bg-[#1e1e1e] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            onClick={pressBackspace}
            disabled={isBusy || entry.length === 0 || lockedRemainingMs > 0}
            className="flex h-14 items-center justify-center rounded-xl border border-slate-800 bg-[#181818] text-slate-300 transition-all hover:border-red-500/30 hover:text-red-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Delete"
          >
            <Delete size={18} />
          </button>
        </div>
      )}

      {variant === "fullscreen" && (
        <div className="mt-7 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">
          Signed in as {email}
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return <div className="rounded-2xl border border-slate-800 bg-[#121212]/80 p-5">{card}</div>;
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-8">
      <div className="pointer-events-none absolute -left-[10%] -top-[20%] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-[20%] -right-[10%] h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:30px_30px]" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#121212]/90 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        {card}
      </div>
    </div>
  );
}
