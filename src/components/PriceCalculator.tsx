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

  const targetPrice = selectedService
    ? (quantity * selectedService.starting_price) / 1000
    : 0;

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

  // Unpack advanced catalog min quantity if configured
  let minQty = 100;
  try {
    const parsed = JSON.parse(selectedService.description);
    if (parsed && typeof parsed === "object" && parsed.min_qty) {
      minQty = Number(parsed.min_qty);
    }
  } catch (e) {
    // Standard catalog row is not JSON
  }

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
        <div className="absolute -top-[30%] -right-[20%] w-[350px] h-[350px] bg-[#1DB954]/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-[#1DB954]/10 transition-all duration-700"></div>
        
        <div className="text-center mb-8">
          <span className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
            <Zap size={10} fill="currentColor" /> Interactive SMM Calculator
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Estimate Your <span className="text-[#1DB954]">Amplification Package</span>
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
                  return (
                    <button
                      key={srv.id}
                      onClick={() => {
                        setSelectedService(srv);
                        // Reset quantity if it violates new min quantity limits
                        try {
                          const parsed = JSON.parse(srv.description);
                          if (parsed && parsed.min_qty && quantity < Number(parsed.min_qty)) {
                            setQuantity(Number(parsed.min_qty));
                          }
                        } catch (e) {}
                      }}
                      className={`py-3 px-2 text-[11px] sm:text-xs font-black rounded-xl border transition-all duration-300 ${
                        isSelected
                          ? "bg-[#1DB954] text-black border-transparent shadow-lg shadow-green-500/20 scale-[1.02]"
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
                  {quantity.toLocaleString()} units
                </span>
              </div>
              <input
                type="range"
                min={minQty}
                max="10000"
                step={quantity < 1000 ? "50" : "100"}
                value={quantity}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="w-full h-2 bg-[#121212] rounded-lg appearance-none cursor-pointer accent-[#1DB954]"
                style={{
                  background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${((quantity - minQty) / (10000 - minQty)) * 100}%, #121212 ${((quantity - minQty) / (10000 - minQty)) * 100}%, #121212 100%)`
                }}
              />
              <div className="flex justify-between items-center mt-2.5 text-[10px] text-slate-500 font-bold uppercase">
                <span>Min: {minQty.toLocaleString()}</span>
                <span>Mid: 5,000</span>
                <span>Max: 10,000</span>
              </div>
            </div>
          </div>

          {/* Pricing Panel */}
          <div className="bg-[#121212] border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between h-full relative overflow-hidden group/price">
            <div className="text-left space-y-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Estimated Price</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight text-[#1DB954]">
                  ₱{animatedPrice.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-bold">PHP</span>
              </div>
              <p className="text-[10px] text-slate-500 font-semibold italic">
                *Computed rate: ₱{(selectedService.starting_price).toFixed(2)} per 1,000 units
              </p>
            </div>

            <div className="border-t border-slate-800/60 my-5 pt-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse"></span>
                <span>**Delivery:** Instant Start (15m - 2h)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse"></span>
                <span>**Retention:** 100% Lifetime Guarantee</span>
              </div>
            </div>

            <button
              onClick={handleBoostClick}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-4 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-[1.02] tracking-wider uppercase text-xs flex items-center justify-center gap-2"
            >
              🚀 Boost {quantity.toLocaleString()} Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
