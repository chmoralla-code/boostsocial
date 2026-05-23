"use client";

import { useState, useEffect } from "react";
import { Zap, HelpCircle } from "lucide-react";

interface Service {
  id: string;
  title: string;
  description: string;
  starting_price: number;
  icon_type: string;
}

interface PriceCalculatorProps {
  services: Service[];
  onOrder: (service: Service, quantity: number) => void;
}

export function PriceCalculator({ services, onOrder }: PriceCalculatorProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [quantity, setQuantity] = useState(1000);
  const [animatedPrice, setAnimatedPrice] = useState(0);

  useEffect(() => {
    if (services.length > 0 && !selectedService) {
      setSelectedService(services[0]);
    }
  }, [services]);

  const parsedDetails = (() => {
    if (selectedService && selectedService.description) {
      try {
        if (selectedService.description.trim().startsWith("{")) {
          return JSON.parse(selectedService.description);
        }
      } catch (e) {}
    }
    return { min_quantity: 100 };
  })();

  const minQty = Number(parsedDetails.min_quantity) || 100;
  const isSingleItem = minQty === 1;

  const baseTotal = selectedService
    ? quantity * selectedService.starting_price
    : 0;

  // Fake Marketing Discount Engine (Visual-only discount to incentivize sales)
  const fakeDiscountPercent = isSingleItem
    ? (quantity >= 5 ? 20 : quantity >= 3 ? 15 : 10)
    : (quantity >= 10000 ? 25 : quantity >= 5000 ? 20 : quantity >= 3000 ? 15 : 10);

  const targetPrice = baseTotal; // Customer pays exactly x2 resellers price (no discount deduction!)
  const fakeOriginalPrice = targetPrice / (1 - fakeDiscountPercent / 105); // Derived original price for marketing cross-out

  // Smooth ticking price counter animation
  useEffect(() => {
    let start = animatedPrice;
    const end = targetPrice;
    if (start === end) return;

    const duration = 200; // ms
    const stepTime = 10;
    const steps = duration / stepTime;
    const increment = (end - start) / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      start += increment;
      if (currentStep >= steps) {
        setAnimatedPrice(end);
        clearInterval(timer);
      } else {
        setAnimatedPrice(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetPrice]);

  if (services.length === 0 || !selectedService) return null;

  const getBrandColor = (iconType: string) => {
    switch (iconType) {
      case 'followers': return '#1DB954'; // Spotify Green
      case 'reactions': return '#1877F2'; // Facebook Blue
      case 'views': return '#1ed760';     // Cyan/Green
      case 'pisowifi': return '#6366f1';  // Indigo
      default: return '#1877F2';
    }
  };

  const getBrandBg = (iconType: string) => {
    switch (iconType) {
      case 'followers': return 'bg-[#1DB954] shadow-emerald-500/25';
      case 'reactions': return 'bg-[#1877F2] shadow-blue-500/25';
      case 'views': return 'bg-[#1ed760] shadow-emerald-500/25';
      case 'pisowifi': return 'bg-[#6366f1] shadow-indigo-500/25';
      default: return 'bg-[#1877F2] shadow-blue-500/25';
    }
  };

  const getBrandText = (iconType: string) => {
    switch (iconType) {
      case 'followers': return 'text-[#1DB954]';
      case 'reactions': return 'text-[#1877F2]';
      case 'views': return 'text-[#1ed760]';
      case 'pisowifi': return 'text-[#6366f1]';
      default: return 'text-[#1877F2]';
    }
  };

  const getBrandBadge = (iconType: string) => {
    switch (iconType) {
      case 'followers': return 'bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20';
      case 'reactions': return 'bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/20';
      case 'views': return 'bg-[#1ed760]/10 text-[#1ed760] border-[#1ed760]/20';
      case 'pisowifi': return 'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20';
      default: return 'bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/20';
    }
  };

  const activeColor = getBrandColor(selectedService.icon_type);
  const activeBg = getBrandBg(selectedService.icon_type);
  const activeText = getBrandText(selectedService.icon_type);
  const activeBadge = getBrandBadge(selectedService.icon_type);

  const handleSliderChange = (val: number) => {
    // Align with dynamic min quantity constraints
    if (val < minQty) {
      setQuantity(minQty);
    } else {
      setQuantity(val);
    }
  };

  const handleBoostClick = () => {
    onOrder(selectedService, quantity);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-6 mb-16 relative z-10">
      <div className="bg-[#181818]/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden group">
        {/* Glow effect */}
        <div 
          style={{ backgroundColor: activeColor }}
          className="absolute -top-[30%] -right-[20%] w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none opacity-5 group-hover:opacity-10 transition-all duration-700"
        ></div>
        
        <div className="text-center mb-8">
          <span className={`border font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3 ${activeBadge}`}>
            <Zap size={10} fill="currentColor" /> Interactive SMM Calculator
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Estimate Your <span style={{ color: activeColor }}>Amplification Package</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">
            Drag the slider to customize quantities and view real-time estimates
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Service selector buttons */}
             <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-3 text-left">
                1. Select Service Type
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {services.map((srv) => {
                  const isSelected = selectedService.id === srv.id;
                  const srvActiveBg = getBrandBg(srv.icon_type);
                  return (
                    <button
                      key={srv.id}
                      onClick={() => {
                        setSelectedService(srv);
                        
                        // Parse next service min quantity
                        let nextMinQty = 100;
                        try {
                          if (srv.description && srv.description.trim().startsWith("{")) {
                            nextMinQty = Number(JSON.parse(srv.description).min_quantity) || 100;
                          }
                        } catch (e) {}
                        
                        setQuantity(nextMinQty === 1 ? 1 : 1000);
                      }}
                      className={`py-3 px-2 text-[11px] sm:text-xs font-black rounded-xl border transition-all duration-300 ${
                        isSelected
                          ? `text-white border-transparent shadow-lg scale-[1.02] ${srvActiveBg}`
                          : "bg-[#121212] text-slate-300 border-slate-800/80 hover:bg-[#222]/80 hover:text-white"
                      }`}
                    >
                      {srv.title.replace("Facebook ", "")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 text-left">
                  2. Select Quantity
                </label>
                <span className="text-sm font-black text-white font-mono bg-[#121212] px-3 py-1 rounded-lg border border-slate-800">
                  {quantity.toLocaleString()} {isSingleItem ? (quantity === 1 ? "item" : "items") : "units"}
                </span>
              </div>
              <input
                type="range"
                min={minQty}
                max={isSingleItem ? 10 : 10000}
                step={isSingleItem ? 1 : (quantity < 1000 ? 50 : 100)}
                value={quantity}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="w-full h-2 bg-[#121212] rounded-lg appearance-none cursor-pointer"
                style={{
                  accentColor: activeColor,
                  background: isSingleItem 
                    ? `linear-gradient(to right, ${activeColor} 0%, ${activeColor} ${((quantity - 1) / (10 - 1)) * 100}%, #121212 ${((quantity - 1) / (10 - 1)) * 100}%, #121212 100%)`
                    : `linear-gradient(to right, ${activeColor} 0%, ${activeColor} ${((quantity - minQty) / (10000 - minQty)) * 100}%, #121212 ${((quantity - minQty) / (10000 - minQty)) * 100}%, #121212 100%)`
                }}
              />
              <div className="flex justify-between items-center mt-2.5 text-[10px] text-slate-500 font-bold uppercase">
                <span>Min: {isSingleItem ? "1 item" : minQty.toLocaleString()}</span>
                <span>Mid: {isSingleItem ? "5 items" : "5,000"}</span>
                <span>Max: {isSingleItem ? "10 items" : "10,000"}</span>
              </div>
            </div>
          </div>

          {/* Pricing Panel */}
          <div className="bg-[#121212] border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between h-full relative overflow-hidden group/price">
            <div className="text-left space-y-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Estimated Price</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                {fakeDiscountPercent > 0 && (
                  <span className="text-sm text-slate-500 font-mono line-through mr-1 block">
                    ₱{fakeOriginalPrice.toFixed(0)}
                  </span>
                )}
                <span 
                  style={{ color: activeColor }}
                  className="text-4xl sm:text-5xl font-black font-mono tracking-tight"
                >
                  ₱{animatedPrice.toFixed(0)}
                </span>
                <span className="text-xs text-slate-400 font-bold">PHP</span>
              </div>
              {fakeDiscountPercent > 0 && (
                <div className={`text-[10px] font-black uppercase tracking-wider mt-1 animate-pulse ${activeText}`}>
                  🔥 {fakeDiscountPercent}% Special Discount Active!
                </div>
              )}
              <p className="text-[10px] text-slate-550 font-semibold italic mt-1 bg-[#121212] rounded-lg">
                *Computed rate: ₱{selectedService.starting_price < 1
                  ? selectedService.starting_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                  : selectedService.starting_price.toFixed(2)
                } per item
              </p>
            </div>

            <div className="border-t border-slate-800/60 my-5 pt-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <span 
                  style={{ backgroundColor: activeColor }}
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                ></span>
                <span>**Delivery:** Instant Start (15m - 2h)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <span 
                  style={{ backgroundColor: activeColor }}
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                ></span>
                <span>**Retention:** 100% Lifetime Guarantee</span>
              </div>
            </div>

            <button
              onClick={handleBoostClick}
              style={{ backgroundColor: activeColor }}
              className="w-full hover:brightness-110 text-white font-black py-4 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-[1.02] tracking-wider uppercase text-xs flex items-center justify-center gap-2 cursor-pointer shadow-black/10"
            >
              🚀 Boost {quantity.toLocaleString()} {isSingleItem ? (quantity === 1 ? "Item" : "Items") : "Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
