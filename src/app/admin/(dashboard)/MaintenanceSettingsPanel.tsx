"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, AlertOctagon, Power, Loader2 } from "lucide-react";

export function MaintenanceSettingsPanel() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/maintenance-settings");
      const data = await res.json();
      if (res.ok) {
        setEnabled(!!data.enabled);
      } else {
        throw new Error(data.error || "Failed to load settings");
      }
    } catch (e: any) {
      console.error(e);
      setError("Failed to fetch maintenance mode status.");
    } finally {
      setFetching(false);
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    const targetState = !enabled;

    try {
      const res = await fetch("/api/admin/maintenance-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: targetState }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }

      setEnabled(data.enabled);
      setMessage(
        data.enabled
          ? "⚠️ Website is now in MAINTENANCE MODE. Clients are locked out."
          : "✅ Website is now LIVE. Clients can access the site normally."
      );
    } catch (err: any) {
      setError(err.message || "An error occurred while updating settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#181818] border border-slate-800 rounded-2xl p-6 shadow-md text-white mt-6 relative overflow-hidden">
      {/* Dynamic Backglow based on status */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-all duration-500 ${
          enabled ? "bg-red-500/10" : "bg-[#1DB954]/5"
        }`}
      ></div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`p-1.5 rounded-lg border transition-colors ${
                enabled
                  ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
                  : "bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20"
              }`}
            >
              <AlertOctagon size={18} />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Global Maintenance Lockout
            </h3>
          </div>
          <p className="text-xs text-slate-400 max-w-md font-semibold leading-relaxed">
            Instantly disable client access to all customer pages (Homepage, Order Tracking, Checkout). Clients will see a fullscreen notification while administrative tools remain accessible to you.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
              System State:
            </span>
            {fetching ? (
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Querying...
              </span>
            ) : enabled ? (
              <span className="text-xs font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-wide">
                Under Maintenance
              </span>
            ) : (
              <span className="text-xs font-black text-[#1DB954] bg-[#1DB954]/10 px-2 py-0.5 rounded border border-[#1DB954]/20 uppercase tracking-wide">
                Live & Active
              </span>
            )}
          </div>
        </div>

        {/* Beautiful Toggle Button Switch */}
        <button
          onClick={handleToggle}
          disabled={loading || fetching}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled ? "bg-red-500" : "bg-slate-700"
          }`}
          style={{ width: "3rem", height: "1.75rem" }}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out flex items-center justify-center ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin text-slate-900" />
            ) : (
              <Power size={12} className={enabled ? "text-red-600" : "text-slate-500"} />
            )}
          </span>
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 border p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200 ${
            enabled
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {enabled ? (
            <AlertOctagon size={16} className="flex-shrink-0 text-red-400 mt-0.5" />
          ) : (
            <CheckCircle size={16} className="flex-shrink-0 text-emerald-400 mt-0.5" />
          )}
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
          <ShieldAlert size={16} className="flex-shrink-0 text-red-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
