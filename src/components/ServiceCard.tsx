"use client";

import { Users, ThumbsUp, Play, ExternalLink, Wifi } from "lucide-react";

interface ServiceCardProps {
  id: string;
  title: string;
  description: string;
  startingPrice: number;
  iconType: string;
  onOrder: (serviceId: string, serviceTitle: string, startingPrice: number) => void;
}

export function ServiceCard({ id, title, description, startingPrice, iconType, onOrder }: ServiceCardProps) {
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
      if (description && description.trim().startsWith("{")) {
        const p = JSON.parse(description);
        return {
          description: p.description || defaults.description,
          subtitle: p.subtitle || defaults.subtitle,
          button_text: p.button_text || defaults.button_text,
          min_quantity: Number(p.min_quantity) || 1000,
          redirect_url: p.redirect_url || null,
          custom_caption: p.custom_caption || null,
        };
      }
    } catch (e) {}
    return { ...defaults, min_quantity: 1000, redirect_url: null, custom_caption: null };
  })();

  const getGlowClass = () => {
    switch (iconType) {
      case "followers":
        return "hover:shadow-[0_0_35px_rgba(29,185,84,0.15)] hover:border-[#1DB954]/30";
      case "reactions":
        return "hover:shadow-[0_0_35px_rgba(24,119,242,0.18)] hover:border-[#1877F2]/30";
      case "views":
        return "hover:shadow-[0_0_35px_rgba(29,185,84,0.15)] hover:border-[#1ed760]/30";
      default:
        return "hover:shadow-[0_0_35px_rgba(99,102,241,0.15)] hover:border-indigo-500/30";
    }
  };

  return (
    <div className={`bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group ${getGlowClass()}`}>
      <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
        {getIcon()}
      </div>
      
      <h3 className="uppercase text-xs font-black tracking-widest text-slate-500 mb-2">{title}</h3>
      <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#1877F2] transition-colors">{parsed.subtitle}</h4>
      
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
                ₱{parsed.min_quantity === 1 
                  ? Number(startingPrice).toFixed(0) 
                  : ((parsed.min_quantity / 1000) * startingPrice).toFixed(0)
                }
              </span>
            </>
          )}
        </div>
      </div>
      
      {parsed.redirect_url ? (
        <button 
          onClick={() => onOrder(id, title, startingPrice)}
          className="w-full bg-transparent hover:bg-[#1877F2]/10 text-[#1877F2] font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] border-2 border-[#1877F2]/60 hover:border-[#1877F2] flex items-center justify-center gap-2 cursor-pointer"
        >
          <ExternalLink size={14} />
          {parsed.button_text || "Visit Site"}
        </button>
      ) : (
        <button 
          onClick={() => onOrder(id, title, startingPrice)}
          className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg shadow-blue-500/5 cursor-pointer"
        >
          {parsed.button_text}
        </button>
      )}
    </div>
  );
}
