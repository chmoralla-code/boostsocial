"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  LogIn,
  Plus,
  ShieldAlert,
  Trash2,
  Wallet,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type ApiKeyRow = {
  id: string;
  label: string;
  key_prefix: string;
  is_active: boolean;
  daily_limit: number | string | null;
  monthly_limit: number | string | null;
  spent_day: number | string | null;
  spent_month: number | string | null;
  last_used_at: string | null;
  created_at: string | null;
  revoked_at: string | null;
};

function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `₱${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function readableDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ApiAccessPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");

  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load your keys.");
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setAvailable(data.available !== false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load your keys.");
    }
  }, []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUser(current);
      if (current) await loadKeys();
      if (active) setLoading(false);
    };

    init();

    return () => {
      active = false;
    };
  }, [supabase, loadKeys]);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    setFreshKey(null);
    setCopied(false);

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || "Default key",
          dailyLimit: dailyLimit.trim() ? Number(dailyLimit) : null,
          monthlyLimit: monthlyLimit.trim() ? Number(monthlyLimit) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the key.");

      setFreshKey(data.key);
      setShowKey(true);
      setLabel("");
      setDailyLimit("");
      setMonthlyLimit("");
      await loadKeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create the key.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm("Revoke this key? Any website using it will stop working immediately.")) {
      return;
    }
    setRevokingId(id);
    setError("");
    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not revoke the key.");
      await loadKeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not revoke the key.");
    } finally {
      setRevokingId(null);
    }
  };

  const copyKey = async () => {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copy failed — please select the key and copy it manually.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-8 text-center space-y-4">
          <Key className="mx-auto text-muted" size={32} />
          <h1 className="text-lg font-black text-fg">Sign in to get API access</h1>
          <p className="text-sm text-muted">
            Reseller API keys are tied to your wallet, so you need an account first.
          </p>
          <Link
            href="/app/auth"
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-background font-black text-sm uppercase tracking-wider"
          >
            <LogIn size={16} /> Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <button
          onClick={() => router.push("/app/profile")}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted hover:text-fg transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Wallet
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Key size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-fg tracking-tight">
              Reseller API
            </h1>
            <p className="text-muted text-xs mt-0.5">
              Sell our services from your own website.
            </p>
          </div>
        </div>

        {!available && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <ShieldAlert size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300 leading-relaxed">
              The API is not available yet. The database migration has not been
              applied — ask the site owner to run it.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/25">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* A freshly created key is shown exactly once. */}
        {freshKey && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-400" />
              <h2 className="text-sm font-black text-emerald-300">
                Your new key — copy it now
              </h2>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              This is the only time it is shown. We store only a scrambled
              fingerprint, so it can never be recovered — if you lose it, revoke
              it and make a new one.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-xl bg-black/40 border border-emerald-500/25 text-xs font-mono text-emerald-200 break-all">
                {showKey ? freshKey : `${freshKey.slice(0, 12)}${"•".repeat(24)}`}
              </code>
              <button
                onClick={() => setShowKey((value) => !value)}
                className="p-2.5 rounded-xl border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                onClick={copyKey}
                className="p-2.5 rounded-xl border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                title="Copy"
              >
                {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <button
              onClick={() => setFreshKey(null)}
              className="text-[10px] font-black uppercase tracking-wider text-emerald-300/70 hover:text-emerald-200"
            >
              I have saved it — hide this
            </button>
          </div>
        )}

        {/* Create */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-black text-fg">Create a key</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">
                Label
              </label>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. MyShop website"
                maxLength={60}
                className="w-full px-3 py-2.5 rounded-xl bg-elevated border border-border text-sm text-fg outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">
                  Daily cap (₱)
                </label>
                <input
                  value={dailyLimit}
                  onChange={(event) => setDailyLimit(event.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="No limit"
                  inputMode="decimal"
                  className="w-full px-3 py-2.5 rounded-xl bg-elevated border border-border text-sm text-fg outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">
                  Monthly cap (₱)
                </label>
                <input
                  value={monthlyLimit}
                  onChange={(event) => setMonthlyLimit(event.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="No limit"
                  inputMode="decimal"
                  className="w-full px-3 py-2.5 rounded-xl bg-elevated border border-border text-sm text-fg outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <p className="text-[10px] text-muted leading-relaxed">
              Caps stop a runaway script from draining your wallet. Leave them
              empty for no cap.
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !available}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider transition-opacity disabled:opacity-40"
          >
            {creating ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
            Create Key
          </button>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-black text-fg mb-4">Your keys</h2>

          {keys.length === 0 ? (
            <p className="text-xs text-muted">No keys yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => {
                const revoked = !key.is_active || Boolean(key.revoked_at);
                return (
                  <div
                    key={key.id}
                    className={`p-4 rounded-xl border ${
                      revoked
                        ? "bg-elevated/40 border-border/60 opacity-60"
                        : "bg-elevated border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-fg truncate">
                          {key.label}
                        </p>
                        <p className="text-[10px] font-mono text-muted mt-0.5">
                          {key.key_prefix}…
                        </p>
                      </div>
                      {revoked ? (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-border text-muted shrink-0">
                          Revoked
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRevoke(key.id)}
                          disabled={revokingId === key.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/25 text-red-400 text-[10px] font-black uppercase tracking-wider hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
                        >
                          {revokingId === key.id ? (
                            <Loader2 className="animate-spin" size={11} />
                          ) : (
                            <Trash2 size={11} />
                          )}
                          Revoke
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/60">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                          Spent today
                        </p>
                        <p className="text-xs font-bold text-fg">
                          {money(key.spent_day)}
                          {key.daily_limit ? ` / ${money(key.daily_limit)}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                          Spent this month
                        </p>
                        <p className="text-xs font-bold text-fg">
                          {money(key.spent_month)}
                          {key.monthly_limit ? ` / ${money(key.monthly_limit)}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                          Last used
                        </p>
                        <p className="text-xs font-bold text-fg">
                          {readableDate(key.last_used_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                          Created
                        </p>
                        <p className="text-xs font-bold text-fg">
                          {readableDate(key.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick start */}
        <div className="mt-6 p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={15} className="text-muted" />
            <h2 className="text-sm font-black text-fg">How it works</h2>
          </div>
          <ol className="space-y-2 text-xs text-muted leading-relaxed list-decimal list-inside">
            <li>Top up your wallet — API orders are paid from your balance.</li>
            <li>Create a key above and copy it somewhere safe.</li>
            <li>
              Send it with every request as{" "}
              <code className="px-1.5 py-0.5 rounded bg-elevated text-fg font-mono text-[10px]">
                Authorization: Bearer YOUR_KEY
              </code>
            </li>
            <li>
              Full endpoint list at{" "}
              <Link href="/api-docs" className="text-primary hover:underline">
                /api-docs
              </Link>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
