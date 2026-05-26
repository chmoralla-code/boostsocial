"use client";

import { useState, useEffect } from "react";
import { Sparkles, Save, CheckCircle, XCircle, Loader2 } from "lucide-react";

export function HeroTextSettingsPanel() {
  const [badge, setBadge] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fetching, setFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/hero-text-settings");
      const data = await res.json();
      if (res.ok) {
        setBadge(data.badge || "");
        setTitle(data.title || "");
        setDescription(data.description || "");
      } else {
        throw new Error(data.error || "Failed to load hero text settings");
      }
    } catch (e: any) {
      console.error(e);
      setResult({ success: false, message: "Failed to fetch active hero text configuration." });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/hero-text-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badge, title, description }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setResult({ success: true, message: "✅ Hero texts successfully saved and synchronized across all regions!" });
    } catch (err: any) {
      setResult({ success: false, message: `❌ ${err.message || "An error occurred while saving configuration."}` });
    } finally {
      setIsSaving(false);
    }
  };

  if (fetching) {
    return (
      <div className="bg-[#181818] rounded-2xl border border-slate-850/85 p-6 flex items-center gap-3 mt-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs text-slate-400 font-semibold">Loading Hero Text Settings...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 mt-6 relative overflow-hidden text-white shadow-md">
      {/* Backglow glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-850/60">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Sparkles size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Landing Hero Copywriting
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Dynamically update the header badge, primary H1 title, and description paragraph on your landing page.
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        
        {/* Help Tip Box */}
        <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 text-xs space-y-2 text-slate-400">
          <p className="font-black text-[#1DB954] uppercase tracking-wide text-[10px]">✨ Pro Shimmer Formatting Tips</p>
          <ul className="list-disc pl-4 space-y-1 leading-relaxed font-semibold">
            <li>Surround text with square brackets <code className="text-blue-400 font-mono">[word]</code> to apply the <strong className="text-blue-400">Facebook Neon Blue Shimmer</strong> style.</li>
            <li>Surround text with curly braces <code className="text-[#1DB954] font-mono">{"{word}"}</code> to apply the <strong className="text-[#1ed760]">Spotify Cyber Green Shimmer</strong> style.</li>
            <li>Use <code className="text-purple-400 font-mono">\n</code> or hit enter to insert a responsive break block in the heading.</li>
            <li>Default: <code className="text-slate-300 font-mono">MAS BARATO PA SA \n[FACEBOOK] {"{BOOSTING}"} SERVICES !</code></li>
          </ul>
        </div>

        {/* 1. Badge Text */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">⚡ Hero Badge Text</label>
          <input
            type="text"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="e.g. ⚡ Next-Gen Amplification Engine"
            className="w-full bg-[#121212] border border-slate-850 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder-slate-600 focus:outline-none focus:border-[#1DB954] transition-all"
          />
        </div>

        {/* 2. Hero Title */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">🎯 Hero Title (Heading 1)</label>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={2}
            placeholder="e.g. MAS BARATO PA SA \n[FACEBOOK] {BOOSTING} SERVICES !"
            className="w-full bg-[#121212] border border-slate-850 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder-slate-600 focus:outline-none focus:border-[#1DB954] transition-all"
          />
        </div>

        {/* 3. Hero Description */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">📝 Hero Description Paragraph</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Don't worry about transparency..."
            className="w-full bg-[#121212] border border-slate-850 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder-slate-600 focus:outline-none focus:border-[#1DB954] transition-all"
          />
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin text-black" /> : <Save size={14} />}
            {isSaving ? "Saving Configuration..." : "Save Copywriting Settings"}
          </button>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`mt-4 border p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200 ${
            result.success 
              ? "bg-green-500/10 border-green-500/20 text-emerald-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {result.success ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" /> : <XCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />}
            <span>{result.message}</span>
          </div>
        )}

      </div>
    </div>
  );
}
