"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Key, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

type ResellerKey = {
  id: string;
  user_id: string;
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
  email?: string | null;
  orders: number;
  volume: number;
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

export function ResellerApiPanel() {
  const [keys, setKeys] = useState<ResellerKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reseller-keys", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load reseller keys.");
      setKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load reseller keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeKeys = keys.filter((key) => key.is_active && !key.revoked_at);
  const totalVolume = keys.reduce((sum, key) => sum + Number(key.volume || 0), 0);

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 relative overflow-hidden text-white shadow-md">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-slate-850/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
            <Key size={20} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight">Reseller API</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Keys, spend caps and API orders
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-6">
          <Loader2 className="animate-spin text-purple-400" size={18} />
          <span className="text-xs text-slate-400 font-semibold">
            Loading reseller keys…
          </span>
        </div>
      ) : keys.length === 0 ? (
        <div className="flex items-start gap-3 py-4">
          <ShieldAlert size={16} className="text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 font-semibold">
              No reseller keys yet.
            </p>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              When a reseller creates one from their account, it appears here with
              its spend caps and order volume.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-black/30 border border-slate-850">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                Active keys
              </p>
              <p className="text-lg font-black text-white">{activeKeys.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-slate-850">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                Total keys
              </p>
              <p className="text-lg font-black text-white">{keys.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-slate-850">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                API orders
              </p>
              <p className="text-lg font-black text-white">
                {keys.reduce((sum, key) => sum + Number(key.orders || 0), 0)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-slate-850">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                API volume
              </p>
              <p className="text-lg font-black text-[#1DB954]">
                {money(totalVolume)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {keys.map((key) => {
              const revoked = !key.is_active || Boolean(key.revoked_at);
              return (
                <div
                  key={key.id}
                  className={`p-4 rounded-xl border ${
                    revoked
                      ? "bg-black/20 border-slate-850/60 opacity-60"
                      : "bg-black/30 border-slate-850"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {key.label}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {key.key_prefix}… · {key.email || key.user_id.slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${
                        revoked
                          ? "bg-slate-850 text-slate-500"
                          : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {revoked ? "Revoked" : "Active"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-850/60">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        Orders
                      </p>
                      <p className="text-xs font-bold text-white">{key.orders}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        Volume
                      </p>
                      <p className="text-xs font-bold text-white">
                        {money(key.volume)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        Spent today
                      </p>
                      <p className="text-xs font-bold text-white">
                        {money(key.spent_day)}
                        {key.daily_limit ? ` / ${money(key.daily_limit)}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        Last used
                      </p>
                      <p className="text-xs font-bold text-white">
                        {readableDate(key.last_used_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
