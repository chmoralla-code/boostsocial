"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, CheckCircle, XCircle, Loader2, BellRing } from "lucide-react";

type AlertSettings = {
  lowBalanceThreshold: number;
  minDaysBetweenAlerts: number;
  enabled: boolean;
};

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

export function CustomerAlertsSettingsPanel() {
  const [settings, setSettings] = useState<AlertSettings>({
    lowBalanceThreshold: 100,
    minDaysBetweenAlerts: 7,
    enabled: true,
  });
  const [fetching, setFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/customer-alerts-settings");
      const data = await res.json();
      if (res.ok) {
        setSettings({
          lowBalanceThreshold: Number(data.lowBalanceThreshold ?? 100),
          minDaysBetweenAlerts: Number(data.minDaysBetweenAlerts ?? 7),
          enabled: data.enabled !== false,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/customer-alerts-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setResult({ success: true, message: "Customer alerts settings saved." });
    } catch (e) {
      setResult({ success: false, message: getErrorMessage(e, "Failed to save customer alerts settings.") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3">
        <span className="bg-[#1DB954]/10 text-[#1DB954] p-2.5 rounded-xl border border-[#1DB954]/25">
          <BellRing size={18} />
        </span>
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Customer Balance Alerts</h3>
          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
            Remind customers by chat + email when their wallet runs low.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Low balance threshold (₱)</span>
          <input
            type="number"
            min={0}
            value={settings.lowBalanceThreshold}
            disabled={fetching}
            onChange={(e) => setSettings({ ...settings, lowBalanceThreshold: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white disabled:opacity-50 focus:border-[#1DB954]/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min days between alerts</span>
          <input
            type="number"
            min={1}
            value={settings.minDaysBetweenAlerts}
            disabled={fetching}
            onChange={(e) => setSettings({ ...settings, minDaysBetweenAlerts: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white disabled:opacity-50 focus:border-[#1DB954]/50 focus:outline-none"
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          className="h-4 w-4 accent-[#1DB954]"
        />
        <span className="text-xs font-bold text-slate-400">Enable low-balance alerts</span>
      </label>

      {result && (
        <div className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${result.success ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-red-500/25 bg-red-500/10 text-red-400"}`}>
          {result.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {result.message}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving || fetching}
        className="mt-5 flex items-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:opacity-50"
      >
        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save
      </button>
    </div>
  );
}
