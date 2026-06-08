"use client";

import { Users, ThumbsUp, Play, ExternalLink, Wifi, Sparkles } from "lucide-react";
import { parseDescription } from "@/utils/serviceHelpers";

interface ServiceCardProps {
  id: string;
  title: string;
  description: any;
  startingPrice: number;
  iconType: string;
  vipDiscountPercent?: number;
  onOrder: (serviceId: string, serviceTitle: string, startingPrice: number) => void;
}

export function ServiceCard({ id, title, description, startingPrice, iconType, vipDiscountPercent = 0, onOrder }: ServiceCardProps) {
  const getIcon = () => {
    if (iconType && (iconType.startsWith("http") || iconType.startsWith("data:image"))) {
      return (
        <img 
          src={iconType} 
          alt="Service Icon" 
          className="w-10 h-10 object-contain mb-4 filter drop-shadow-[0_0_12px_rgba(29,185,84,0.45)]" 
        />
      );
    }
    switch (iconType) {
      case 'followers':
        return <Users size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
      case 'reactions':
        return <ThumbsUp size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
      case 'views':
        return <Play size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
      case 'pisowifi':
        return <Wifi size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
      default:
        return <Users size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
    }
  };

  const parsed = (() => {
    const defaults = {
      description: description,
      subtitle: "",
      button_text: "",
    };

    switch (iconType) {
      case 'followers':
        defaults.subtitle = 'Build Your Audience';
        defaults.button_text = 'Boost Followers';
        break;
      case 'reactions':
        defaults.subtitle = 'Increase Engagement';
        defaults.button_text = 'Boost Reacts';
        break;
      case 'views':
        defaults.subtitle = 'Maximize Exposure';
        defaults.button_text = 'Boost Views';
        break;
      default:
        defaults.subtitle = 'Instant Amplification';
        defaults.button_text = 'Order Now';
        break;
    }

    try {
      const p = parseDescription(description);
      if (p) {
        return {
          description: p.description || defaults.description,
          subtitle: p.subtitle || defaults.subtitle,
          button_text: p.button_text || defaults.button_text,
          min_quantity: Number(p.min_quantity) || 1000,
          redirect_url: p.redirect_url || null,
          custom_caption: p.custom_caption || null,
          smm_average_time: p.smm_average_time || null,
          smm_service_id: p.smm_service_id ?? null,
          smm_original_name: p.smm_original_name || "",
        };
      }
    } catch (e) {}
    return {
      ...defaults,
      min_quantity: 1000,
      redirect_url: null,
      custom_caption: null,
      smm_average_time: null,
      smm_service_id: null,
      smm_original_name: "",
    };
  })();

  const getGlowClass = () => {
    switch (iconType) {
      case "followers":
        return "hover:shadow-[0_0_40px_rgba(29,185,84,0.2)] hover:border-[#1DB954]/40 hover:bg-[#1DB954]/[0.02]";
      case "reactions":
        return "hover:shadow-[0_0_40px_rgba(24,119,242,0.25)] hover:border-[#1877F2]/40 hover:bg-[#1877F2]/[0.02]";
      case "views":
        return "hover:shadow-[0_0_40px_rgba(29,185,84,0.2)] hover:border-[#1ed760]/40 hover:bg-[#1ed760]/[0.02]";
      default:
        return "hover:shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:border-indigo-500/40 hover:bg-indigo-500/[0.02]";
    }
  };

  const getButtonClass = () => {
    switch (iconType) {
      case "followers":
        return "bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-emerald-500/10";
      case "reactions":
        return "bg-[#1877F2] hover:bg-[#4e8df5] text-white shadow-blue-500/10";
      case "views":
        return "bg-gradient-to-r from-[#1DB954] to-[#1ed760] hover:brightness-110 text-black shadow-emerald-500/10";
      default:
        return "bg-gradient-to-r from-[#1877F2] to-[#1DB954] hover:brightness-110 text-white shadow-blue-500/10";
    }
  };

  const getOutlineButtonClass = () => {
    switch (iconType) {
      case "followers":
        return "border-[#1DB954]/60 hover:border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10";
      case "reactions":
        return "border-[#1877F2]/60 hover:border-[#1877F2] text-[#1877F2] hover:bg-[#1877F2]/10";
      case "views":
        return "border-[#1ed760]/60 hover:border-[#1ed760] text-[#1ed760] hover:bg-[#1ed760]/10";
      default:
        return "border-indigo-500/60 hover:border-indigo-500 text-indigo-400 hover:bg-indigo-500/10";
    }
  };

  const startingTotal = parsed.min_quantity * startingPrice;
  const vipTotal = vipDiscountPercent > 0
    ? Number((startingTotal * (100 - vipDiscountPercent) / 100).toFixed(2))
    : startingTotal;
  const hasVipPrice = vipDiscountPercent > 0 && vipTotal < startingTotal;

  return (
    <div className={`bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group ${getGlowClass()}`}>
      <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
        {getIcon()}
      </div>
      
      <h3 className="uppercase text-xs font-black tracking-widest text-slate-500 mb-2">{title}</h3>
      <h4 className="text-xl font-bold text-white mb-1 group-hover:text-[#1877F2] transition-colors">{parsed.subtitle}</h4>
      
      {parsed.smm_average_time && parsed.smm_average_time !== "Not enough data" ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider mb-4 select-none">
          ⏱️ Avg Delivery: {parsed.smm_average_time}
        </span>
      ) : (
        iconType !== "pisowifi" && !parsed.redirect_url && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/20 text-[9px] font-black uppercase tracking-wider mb-4 select-none">
            ⚡ Instant start queue
          </span>
        )
      )}

      {(parsed.smm_service_id || parsed.smm_original_name) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {parsed.smm_service_id && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 text-[9px] font-black uppercase tracking-wider">
              SMM ID: {parsed.smm_service_id}
            </span>
          )}
          {parsed.smm_original_name && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 text-[9px] font-black uppercase tracking-wider max-w-[220px] truncate" title={parsed.smm_original_name}>
              {parsed.smm_original_name}
            </span>
          )}
        </div>
      )}
      
      <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow whitespace-pre-line">
        {parsed.description}
      </p>
      
      {/* Price section */}
      <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
        <div>
          {parsed.redirect_url ? (
            <>
              <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                Pricing Info
              </span>
              <span className="text-xs font-black text-[#1877F2] uppercase tracking-widest leading-relaxed block max-w-[240px]">
                PRICING IS DECLARED ON THE WEBSITE
              </span>
            </>
          ) : (
            <>
              <span className="block text-slate-550 text-[10px] font-bold uppercase tracking-wider mb-1">
                {parsed.custom_caption 
                  ? parsed.custom_caption.replace("{min_quantity}", String(parsed.min_quantity))
                  : parsed.min_quantity === 1 
                    ? "Starts (per 1 PCS)" 
                    : title.toLowerCase().includes("follower")
                      ? `For as low as ${parsed.min_quantity} quantity followers`
                      : title.toLowerCase().includes("reaction") || title.toLowerCase().includes("react")
                        ? `For as low as ${parsed.min_quantity} quantity reactions`
                        : title.toLowerCase().includes("view")
                          ? `For as low as ${parsed.min_quantity} quantity views`
                          : `For as low as ${parsed.min_quantity} quantity units`
                }
              </span>
              <span className="text-3xl font-black text-white">
                {hasVipPrice ? (
                  <span className="block leading-tight">
                    <span className="block text-[11px] text-slate-500 line-through font-mono">Regular ₱{startingTotal.toFixed(2)}</span>
                    <span className="block text-3xl text-[#1DB954]">VIP ₱{vipTotal.toFixed(2)}</span>
                  </span>
                ) : (
                  <>₱{startingTotal.toFixed(2)}</>
                )}
              </span>
            </>
          )}
        </div>
      </div>
      
      {parsed.redirect_url ? (
        <button 
          onClick={() => onOrder(id, title, startingPrice)}
          className={`w-full bg-transparent font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] border-2 flex items-center justify-center gap-2 cursor-pointer ${getOutlineButtonClass()}`}
        >
          <ExternalLink size={14} />
          {parsed.button_text || "Visit Site"}
        </button>
      ) : (
        <button 
          onClick={() => onOrder(id, title, startingPrice)}
          className={`w-full font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg cursor-pointer ${getButtonClass()}`}
        >
          {parsed.button_text}
        </button>
      )}
    </div>
  );
}
