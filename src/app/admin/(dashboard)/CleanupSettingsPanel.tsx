"use client";

import { useState, useEffect } from "react";
import { Trash2, CheckCircle, ShieldAlert, Loader2, Power, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type CleanupConfig = {
  auto_cleanup_enabled: boolean;
  order_retention_hours: number;
  topup_retention_hours: number;
};

type CleanupData = {
  config: CleanupConfig;
  counts: {
    completedOrders: number;
    approvedTopups: number;
    totalOrders: number;
    totalTopups: number;
  };
};

const RETENTION_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 6, label: "6 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "1 day" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
];

export function CleanupSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [data, setData] = useState<CleanupData | null>(null);
  const [config, setConfig] = useState<CleanupConfig>({
    auto_cleanup_enabled: false,
    order_retention_hours: 24,
    topup_retention_hours: 24,
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastCleanup, setLastCleanup] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/cleanup-settings");
      const result = await res.json();
      if (result.success) {
        setData(result);
        setConfig(result.config);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/cleanup-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Save failed");
      setData((prev) => (prev ? { ...prev, config: result.config } : null));
      setMessage({ type: "success", text: "Cleanup settings saved." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleCleanNow = async () => {
    setCleaning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/cleanup-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Cleanup failed");
      setMessage({ type: "success", text: result.message || `Cleaned up completed records.` });
      setLastCleanup(new Date());
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: msg });
    } finally {
      setCleaning(false);
    }
  };

  const candidatesExist = (data?.counts.completedOrders ?? 0) > 0 || (data?.counts.approvedTopups ?? 0) > 0;

  const toggleClass = (on: boolean) =>
    `relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      on ? "bg-[#1DB954]" : "bg-slate-700"
    }`;

  const knobClass = (on: boolean) =>
    `pointer-events-none inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
      on ? "translate-x-5" : "translate-x-0"
    }`;

  return (
    <div className="bg-[#181818] border border-slate-800 rounded-2xl p-6 shadow-md text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-orange-500/10 text-orange-400 p-1.5 rounded-lg border border-orange-500/20">
              <Trash2 size={18} />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">Database Auto-Cleanup</h3>
          </div>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed max-w-lg">
            Automatically remove completed orders and approved top-ups after a retention period to keep the database lean and fast.
          </p>
        </div>

        {data && (
          <div className="shrink-0 flex gap-3 text-[10px] font-bold">
            <div className="bg-slate-850 border border-slate-800 rounded-xl px-3 py-2 text-center">
              <span className="text-slate-400 block">Orders</span>
              <span className="text-white text-sm">{data.counts.totalOrders}</span>
            </div>
            <div className="bg-slate-850 border border-slate-800 rounded-xl px-3 py-2 text-center">
              <span className="text-slate-400 block">Top-Ups</span>
              <span className="text-white text-sm">{data.counts.totalTopups}</span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
          <Loader2 size={14} className="animate-spin" /> Loading settings...
        </div>
      ) : (
        <div className="space-y-5">
          {/* Auto Cleanup Toggle */}
          <div className="flex items-center justify-between bg-[#121212] border border-slate-850 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Power size={16} className={config.auto_cleanup_enabled ? "text-[#1DB954]" : "text-slate-500"} />
              <div>
                <p className="text-sm font-bold text-white">Enable Auto-Cleanup</p>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {config.auto_cleanup_enabled
                    ? "Old completed orders and top-ups will be deleted automatically"
                    : "Manual cleanup only"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, auto_cleanup_enabled: !c.auto_cleanup_enabled }))}
              className={toggleClass(config.auto_cleanup_enabled)}
            >
              <span className={knobClass(config.auto_cleanup_enabled)}>
                <Power size={8} className={config.auto_cleanup_enabled ? "text-[#1DB954]" : "text-slate-500"} />
              </span>
            </button>
          </div>

          {config.auto_cleanup_enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-[#1DB954]/30">
              {/* Order Retention */}
              <div className="bg-[#121212] border border-slate-850 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-orange-400" />
                  <span className="text-xs font-bold text-slate-300">Completed Orders</span>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold">
                  Delete completed orders older than:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, order_retention_hours: opt.value }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                        config.order_retention_hours === opt.value
                          ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                          : "bg-slate-850 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {data && data.counts.completedOrders > 0 && (
                  <p className="text-[10px] text-orange-400 font-semibold flex items-center gap-1 pt-1">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                    {data.counts.completedOrders} completed order{data.counts.completedOrders !== 1 ? "s" : ""} ready for cleanup
                  </p>
                )}
              </div>

              {/* Topup Retention */}
              <div className="bg-[#121212] border border-slate-850 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-blue-400" />
                  <span className="text-xs font-bold text-slate-300">Approved Top-Ups</span>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold">
                  Delete approved top-ups older than:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, topup_retention_hours: opt.value }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                        config.topup_retention_hours === opt.value
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                          : "bg-slate-850 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {data && data.counts.approvedTopups > 0 && (
                  <p className="text-[10px] text-blue-400 font-semibold flex items-center gap-1 pt-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    {data.counts.approvedTopups} approved top-up{data.counts.approvedTopups !== 1 ? "s" : ""} ready for cleanup
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-850">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-500 text-black font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer text-[11px] uppercase tracking-wider"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button
              onClick={handleCleanNow}
              disabled={cleaning || !candidatesExist}
              className="bg-orange-500/10 hover:bg-orange-500/20 disabled:bg-slate-850 disabled:text-slate-500 text-orange-400 font-extrabold px-5 py-2.5 rounded-xl transition-all border border-orange-500/20 hover:border-orange-500/40 disabled:border-slate-800 flex items-center gap-1.5 cursor-pointer text-[11px] uppercase tracking-wider"
            >
              {cleaning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {cleaning ? "Cleaning..." : "Clean Up Now"}
            </button>

            <div className="flex items-center gap-2 ml-auto text-[9px] text-slate-500 font-semibold">
              {lastCleanup && (
                <span>
                  Last cleanup: {formatDistanceToNow(lastCleanup, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200 ${
                message.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
