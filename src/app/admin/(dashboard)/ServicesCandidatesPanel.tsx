"use client";

import { useState, useEffect } from "react";
import { Layers, Save, CheckCircle, XCircle, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface Candidate {
  id: string;
  emoji: string;
  tag: string;
  title: string;
  caption?: string;
  description: string;
  rate_prefix: string;
  rate_text: string;
  layout?: "standard" | "compact" | "wide";
  theme_color: string;
  btn_bg: string;
  glow_color: string;
}

export function ServicesCandidatesPanel() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [fetching, setFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>("facebook");

  useEffect(() => {
    fetchCandidates();
  }, []);

  const normalizeCandidates = (items: Candidate[]) =>
    items.map((item) => ({
      ...item,
      caption: item.caption || "",
      layout: item.layout || "standard"
    }));

  const fetchCandidates = async () => {
    try {
      const res = await fetch("/api/admin/services-candidates");
      const data = await res.json();
      if (res.ok) {
        setCandidates(normalizeCandidates(data));
      } else {
        throw new Error(data.error || "Failed to load candidates");
      }
    } catch (e: any) {
      console.error(e);
      setResult({ success: false, message: "Failed to fetch active services candidates settings." });
    } finally {
      setFetching(false);
    }
  };

  const handleFieldChange = (index: number, field: keyof Candidate, value: string) => {
    const updated = [...candidates];
    updated[index] = { ...updated[index], [field]: value };
    
    // Automatically adjust button backgrounds and glow color variables if theme_color changes to maintain styling
    if (field === "theme_color") {
      const hex = value.trim();
      updated[index].glow_color = hex.startsWith("#") 
        ? `rgba(${hexToRgb(hex)}, 0.45)` 
        : "rgba(29, 185, 84, 0.45)";
      
      // Auto assign button bg patterns
      if (updated[index].id === "tiktok") {
        updated[index].btn_bg = `bg-[${hex}] hover:opacity-90 text-black`;
      } else if (updated[index].id === "catalog") {
        updated[index].btn_bg = `bg-[${hex}] hover:opacity-90 text-black`;
      } else {
        updated[index].btn_bg = `bg-[${hex}] hover:opacity-90 text-white`;
      }
    }

    setCandidates(updated);
  };

  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
      : "29, 185, 84";
  };

  const handleSave = async () => {
    setIsSaving(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/services-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidates),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save services candidates");
      }

      setResult({ success: true, message: "✅ Services candidates updated and synchronized live across your domain!" });
    } catch (err: any) {
      setResult({ success: false, message: `❌ ${err.message || "An error occurred while saving."}` });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCard = (id: string) => {
    setOpenCardId(openCardId === id ? null : id);
  };

  if (fetching) {
    return (
      <div className="bg-[#181818] rounded-2xl border border-slate-850/85 p-6 flex items-center gap-3 mt-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs text-slate-400 font-semibold">Loading Services Candidates Configurations...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 mt-6 relative overflow-hidden text-white shadow-md">
      {/* Dynamic glow backgrop */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-850/60">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Layers size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Service Candidates Cards <Sparkles size={14} className="text-emerald-400" />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Customize the copywriting text, pricing starting rate, icons, and theme colors of the 6 main service tier cards shown on your homepage.
          </p>
        </div>
      </div>

      {/* Accordion List for each card */}
      <div className="space-y-3 mb-6">
        {candidates.map((card, idx) => {
          const isOpen = openCardId === card.id;
          return (
            <div key={card.id} className="border border-slate-850 rounded-xl overflow-hidden bg-[#121212]/30">
              {/* Card Header Accordion Trigger */}
              <button
                onClick={() => toggleCard(card.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#121212]/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{card.emoji}</span>
                  <div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">{card.tag}</span>
                    <span className="text-sm font-bold text-white block mt-0.5">{card.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span 
                    className="w-2.5 h-2.5 rounded-full border border-white/10" 
                    style={{ backgroundColor: card.theme_color }}
                  ></span>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {/* Accordion Content Form fields */}
              {isOpen && (
                <div className="p-5 border-t border-slate-850 bg-[#121212]/80 space-y-4 animate-in slide-in-from-top-1 duration-200">
                  
                  {/* Grid fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Emoji */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Emoji / Icon Code</label>
                      <input
                        type="text"
                        value={card.emoji}
                        onChange={(e) => handleFieldChange(idx, "emoji", e.target.value)}
                        placeholder="e.g. 📘"
                        className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                      />
                    </div>
                    {/* Tag label */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Tag Text (Caps)</label>
                      <input
                        type="text"
                        value={card.tag}
                        onChange={(e) => handleFieldChange(idx, "tag", e.target.value)}
                        placeholder="e.g. FACEBOOK BOOSTS"
                        className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                      />
                    </div>
                    {/* Title */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Header Title</label>
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) => handleFieldChange(idx, "title", e.target.value)}
                        placeholder="e.g. Page & Post Services"
                        className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Caption / Short Line</label>
                      <input
                        type="text"
                        value={card.caption || ""}
                        onChange={(e) => handleFieldChange(idx, "caption", e.target.value)}
                        placeholder="e.g. Local PH-base growth with fast review"
                        className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Homepage Card Layout</label>
                      <select
                        value={card.layout || "standard"}
                        onChange={(e) => handleFieldChange(idx, "layout", e.target.value)}
                        className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#1DB954]"
                      >
                        <option value="standard">Standard</option>
                        <option value="compact">Compact</option>
                        <option value="wide">Wide</option>
                      </select>
                    </div>
                  </div>

                  {/* Description field */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Card Paragraph Description</label>
                    <textarea
                      value={card.description}
                      onChange={(e) => handleFieldChange(idx, "description", e.target.value)}
                      rows={2}
                      placeholder="Enter description of what the service tier delivers..."
                      className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                    />
                  </div>

                  {/* Footer details Grid fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Starting price prefix label */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Starting Rate Prefix Label</label>
                      <input
                        type="text"
                        value={card.rate_prefix}
                        onChange={(e) => handleFieldChange(idx, "rate_prefix", e.target.value)}
                        placeholder="e.g. Starting Rate"
                        className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                      />
                    </div>
                    {/* Price details description text */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Starting Rate / Description Text</label>
                      <input
                        type="text"
                        value={card.rate_text}
                        onChange={(e) => handleFieldChange(idx, "rate_text", e.target.value)}
                        placeholder="e.g. ₱25.18 per 1k boosts"
                        className="w-full bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                      />
                    </div>
                    {/* Theme color input */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Theme Accent Color (Hex)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={card.theme_color}
                          onChange={(e) => handleFieldChange(idx, "theme_color", e.target.value)}
                          placeholder="e.g. #1DB954"
                          className="flex-grow bg-[#181818] border border-slate-850 rounded-xl px-4.5 py-2.5 text-xs font-bold text-white placeholder-slate-650 focus:outline-none focus:border-[#1DB954]"
                        />
                        <div 
                          className="w-10 rounded-xl border border-slate-850" 
                          style={{ backgroundColor: card.theme_color }}
                        ></div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action triggers */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin text-black" /> : <Save size={14} />}
          {isSaving ? "Saving Configuration..." : "Save Candidates Configuration"}
        </button>
      </div>

      {/* Return feedback message */}
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
  );
}
