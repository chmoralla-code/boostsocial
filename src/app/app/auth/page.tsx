"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Home, Loader2, LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type AuthMode = "login" | "register";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function AppAuthPage() {
  const [mode, setMode] = useState<AuthMode>(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("mode") === "register") {
        setMode("register");
      }

      supabase.auth.getUser().then(({ data }) => {
        if (data.user) router.replace("/app");
      }).catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [router, supabase.auth]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed.");
        setSuccess("Account created. Logging you in...");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) throw signInError;
      router.replace("/app");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] text-zinc-950">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Link href="/app" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm" aria-label="Back to app">
          <ArrowLeft size={17} />
        </Link>
        <Link href="/app" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-emerald-700 shadow-sm" aria-label="App home">
          <Home size={17} />
        </Link>
      </div>

      <section className="mx-auto mt-8 max-w-md rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            {mode === "login" ? <LogIn size={21} /> : <UserPlus size={21} />}
          </span>
          <h1 className="mt-4 text-2xl font-black">{mode === "login" ? "Login to app" : "Create account"}</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
            Register or login before buying services, then the APK returns you to the app screen.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`h-10 rounded-xl text-sm font-black ${mode === "login" ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-500"}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`h-10 rounded-xl text-sm font-black ${mode === "register" ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-500"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold outline-none focus:border-emerald-500"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Password</span>
            <span className="mt-1 flex h-12 items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 focus-within:border-emerald-500">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                placeholder="Minimum 8 characters"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-zinc-500" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          {mode === "register" && (
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Confirm Password</span>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold outline-none focus:border-emerald-500"
                placeholder="Repeat password"
              />
            </label>
          )}

          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
          {success && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</p>}

          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white disabled:opacity-60">
            {loading && <Loader2 size={17} className="animate-spin" />}
            {mode === "login" ? "Login and continue" : "Register and continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
