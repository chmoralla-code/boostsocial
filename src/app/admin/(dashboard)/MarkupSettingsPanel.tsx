"use client";

import { useState, useEffect } from "react";
import { Percent, Save, CheckCircle, XCircle, Loader2 } from "lucide-react";

const PRESETS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];

export function MarkupSettingsPanel() {
  const [markupMultiplier, setMarkupMultiplier] = useState(3.0);
  const [fetching, setFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/markup-settings");
      const data = await res.json();
      if (res.ok && data.markupMultiplier) {
        setMarkupMultiplier(Number(data.markupMultiplier));
      }
    } catch (e: any) {
      console.error(e);
      setResult({ success: false, message: "Failed to load markup settings." });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/markup-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markupMultiplier }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setResult({ success: true, message: `✅ Price multiplier set to ${markupMultiplier}x. All SMM prices updated instantly!` });
    } catch (err: any) {
      setResult({ success: false, message: `❌ ${err.message || "Failed to save markup configuration."}` });
    } finally {
      setIsSaving(false);
    }
  };

  if (fetching) {
    return (
      <div className="bg-[#181818] rounded-2xl border border-slate-850/85 p-6 flex items-center gap-3 mt-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs text-slate-400 font-semibold">Loading Price Multiplier Settings...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 mt-6 relative overflow-hidden text-white shadow-md">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-850/60">
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
          <Percent size={20} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight flex items-center gap-2">
            Price Multiplier
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            Adjust all SMM service prices at once
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            Current Multiplier: <span className="text-blue-400 text-sm">{markupMultiplier}x</span>
          </label>

          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setMarkupMultiplier(preset)}
                className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                  Math.abs(markupMultiplier - preset) < 0.01
                    ? "border-blue-500 bg-blue-500/15 text-blue-400"
                    : "border-slate-800 bg-black/30 text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                {preset}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custom:</span>
            <input
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={markupMultiplier}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 1 && v <= 10) setMarkupMultiplier(v);
              }}
              className="w-24 px-3 py-2 rounded-xl bg-black/40 border border-slate-800 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">(1.0 — 10.0)</span>
          </div>

          <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
            Current rate: provider price × <strong className="text-blue-400">{markupMultiplier}</strong>. 
            Changes apply to the SMM catalog instantly. Existing orders keep their original price.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save Multiplier
        </button>

        {result && (
          <div className={`flex items-center gap-2 text-xs font-bold p-3 rounded-xl border ${
            result.success
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {result.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
