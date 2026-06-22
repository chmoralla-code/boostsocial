"use client";

import { Users, ThumbsUp, Play, ExternalLink, Wifi, Sparkles, AlertTriangle } from "lucide-react";
import { parseDescription } from "@/utils/serviceHelpers";

interface ServiceCardProps {
  id: string;
  title: string;
  description: any;
  startingPrice: number;
  iconType: string;
  vipDiscountPercent?: number;
  onOrder: (serviceId: string, serviceTitle: string, startingPrice: number) => void;
  /**
   * Set of SMM provider service IDs currently listed on rixeysmm.shop.
   * When provided, services whose `smm_service_id` is missing from this set
   * are rendered as Unavailable and their order button is disabled.
   * Services without an `smm_service_id` (manual fulfillment) are always available.
   */
  availableSmmIds?: Set<string>;
}

export function ServiceCard({ id, title, description, startingPrice, iconType, vipDiscountPercent = 0, onOrder, availableSmmIds }: ServiceCardProps) {
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
        return "hover:shadow-[0_0_40px_rgba(29,185,84,0.2)] hover:border-primary/40 hover:bg-primary/[0.02]";
      case "reactions":
        return "hover:shadow-[0_0_40px_rgba(24,119,242,0.25)] hover:border-[#1877F2]/40 hover:bg-[#1877F2]/[0.02]";
      case "views":
        return "hover:shadow-[0_0_40px_rgba(29,185,84,0.2)] hover:border-primary-dark/40 hover:bg-primary-dark/[0.02]";
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

  // A service is considered unavailable when it is mapped to an upstream SMM
  // provider service ID that is no longer listed on rixeysmm.shop. Services
  // without an SMM mapping (manual fulfillment: PisoWiFi, Gemini, EAP, custom
  // FB page, software licenses) are always considered available.
  const hasSmmMapping = Boolean(parsed.smm_service_id);
  const isAvailable = !hasSmmMapping || !availableSmmIds || availableSmmIds.has(String(parsed.smm_service_id));

  const handleOrderClick = () => {
    if (!isAvailable || parsed.redirect_url) {
      return;
    }
    onOrder(id, title, startingPrice);
  };

  return (
    <div className={`bg-elevated/50 hover:bg-card/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-border/40 shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group ${getGlowClass()} ${!isAvailable ? "opacity-60 grayscale-[0.4]" : ""}`}>
      <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
        {getIcon()}
      </div>
      
      <h3 className="uppercase text-xs font-black tracking-widest text-muted mb-2">{title}</h3>
      <h4 className="text-xl font-bold text-fg mb-1 group-hover:text-primary transition-colors">{parsed.subtitle}</h4>

      {!isAvailable && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/25 text-[9px] font-black uppercase tracking-wider mb-4 select-none">
          <AlertTriangle size={11} />
          Unavailable from provider
        </span>
      )}

      {isAvailable && parsed.smm_average_time && parsed.smm_average_time !== "Not enough data" ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider mb-4 select-none">
          ⏱️ Avg Delivery: {parsed.smm_average_time}
        </span>
      ) : (
        isAvailable && iconType !== "pisowifi" && !parsed.redirect_url && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-dark/10 text-primary-dark border border-primary-dark/20 text-[9px] font-black uppercase tracking-wider mb-4 select-none">
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
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-elevated/80 text-fg border border-border text-[9px] font-black uppercase tracking-wider max-w-[220px] truncate" title={parsed.smm_original_name}>
              {parsed.smm_original_name}
            </span>
          )}
        </div>
      )}
      
      <p className="text-muted text-sm leading-relaxed mb-8 flex-grow whitespace-pre-line">
        {parsed.description}
      </p>
      
      {/* Price section */}
      <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-border/60">
        <div>
          {parsed.redirect_url ? (
            <>
              <span className="block text-muted text-[10px] font-bold uppercase tracking-wider mb-1">
                Pricing Info
              </span>
              <span className="text-xs font-black text-primary uppercase tracking-widest leading-relaxed block max-w-[240px]">
                PRICING IS DECLARED ON THE WEBSITE
              </span>
            </>
          ) : (
            <>
              <span className="block text-muted text-[10px] font-bold uppercase tracking-wider mb-1">
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
              <span className="text-3xl font-black text-fg">
                {hasVipPrice ? (
                  <span className="block leading-tight">
                    <span className="block text-[11px] text-muted line-through font-mono">Regular ₱{startingTotal.toFixed(2)}</span>
                    <span className="block text-3xl text-primary">VIP ₱{vipTotal.toFixed(2)}</span>
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
      ) : !isAvailable ? (
        <button
          type="button"
          disabled
          onClick={handleOrderClick}
          className="w-full font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-not-allowed bg-red-500/10 text-red-400 border border-red-500/25"
          title="This service is no longer available from our SMM provider. Please pick another service."
        >
          <AlertTriangle size={14} />
          Unavailable
        </button>
      ) : (
        <button 
          onClick={handleOrderClick}
          className={`w-full font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg cursor-pointer ${getButtonClass()}`}
        >
          {parsed.button_text}
        </button>
      )}
    </div>
  );
}
