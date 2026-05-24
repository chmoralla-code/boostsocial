"use client";

import { useState } from "react";
import { ServiceCard } from "./ServiceCard";
import { OrderModal } from "./OrderModal";
import { PriceCalculator } from "./PriceCalculator";
import { StatCounters } from "./StatCounters";
import { FaqSection } from "./FaqSection";
import { ReviewsSection } from "./ReviewsSection";
import { SmmCatalogModal } from "./SmmCatalogModal";
import { Layers, X } from "lucide-react";
import { parseDescription } from "@/utils/serviceHelpers";

interface Service {
  id: string;
  title: string;
  description: any;
  starting_price: number;
  icon_type: string;
}

interface ServicesSectionProps {
  services: Service[];
}

export function ServicesSection({ services }: ServicesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState("");
  const [selectedServicePrice, setSelectedServicePrice] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [presetQty, setPresetQty] = useState<number>(1000);

  // New state for "Other Services" visual selector modal
  const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);
  
  // New state for "RixeySMM Catalog" explorer modal
  const [isSmmCatalogModalOpen, setIsSmmCatalogModalOpen] = useState(false);

  const handleOrder = (id: string, title: string, price: number, description?: any) => {
    // Check if this service has a redirect URL
    try {
      const parsed = parseDescription(description);
      if (parsed && parsed.redirect_url) {
        window.open(parsed.redirect_url, "_blank", "noopener,noreferrer");
        return;
      }
    } catch (e) {}

    setSelectedServiceId(id);
    setSelectedServiceTitle(title);
    setSelectedServicePrice(price);
    const isSingleQty = 
      title.toLowerCase().includes("page") || 
      title.toLowerCase().includes("gemini") || 
      title.toLowerCase().includes("eap") || 
      title.toLowerCase().includes("tplink") || 
      title.toLowerCase().includes("software") || 
      title.toLowerCase().includes("architectural") ||
      title.toLowerCase().includes("license");
    setPresetQty(isSingleQty ? 1 : 1000);
    setIsModalOpen(true);
  };

  const handleCalculatorOrder = (service: Service, quantity: number) => {
    setSelectedService(service);
    setSelectedServiceId(service.id);
    setSelectedServiceTitle(service.title);
    setSelectedServicePrice(service.starting_price);
    setPresetQty(quantity);
    setIsModalOpen(true);
  };

  // Segment services: otherServices are Gemini, PisoWiFi, EAP TP-Link, and Architectural Software (Lifetime License)
  const otherServiceIds = [
    "530e797c-62d1-467a-bf23-310c169a7103", // Gemini Pro
    "bace2033-2a35-491f-ad83-ab5fccffb6eb", // PisoWiFi
    "8134f872-1738-44f1-adb0-bc341e64ace0", // EAP TP-Link
    "03185a81-49f3-4255-868e-9e9ec3189497"  // Architectural Software / Lifetime License
  ];

  const otherServices = services.filter((s) => {
    const t = s.title.toLowerCase();
    return (
      otherServiceIds.includes(s.id) ||
      t.includes("gemini") ||
      t.includes("pisowifi") ||
      t.includes("eap") ||
      t.includes("tplink") ||
      t.includes("architectural") ||
      t.includes("software") ||
      t.includes("license")
    );
  });

  const coreServices = services.filter((s) => {
    const t = s.title.toLowerCase();
    return !(
      otherServiceIds.includes(s.id) ||
      t.includes("gemini") ||
      t.includes("pisowifi") ||
      t.includes("eap") ||
      t.includes("tplink") ||
      t.includes("architectural") ||
      t.includes("software") ||
      t.includes("license")
    );
  });

  // Dynamically find the lowest price in the otherServices catalog (fallback to 250)
  const lowestOtherPrice = otherServices.reduce(
    (min, s) => (s.starting_price < min ? s.starting_price : min),
    250
  );

  return (
    <>
      {/* 1. SMM Price Calculator Widget */}
      <PriceCalculator 
        services={services} 
        onOrder={handleCalculatorOrder} 
      />

      {/* 2. Brand Stat Counters */}
      <StatCounters />

      {/* 3. Choose Your Boost Tier Grid */}
      <section id="services" className="w-full max-w-6xl mx-auto px-4 mt-12 mb-20 relative z-10">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-12 tracking-tight">
          Choose Your <span className="text-[#1877F2]">Boost Tier</span>
        </h2>
        
        {/* Adjusted grid classes to balance 5 columns on extra large viewports */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Render Core SMM services */}
          {coreServices.map((service) => (
            <ServiceCard 
              key={service.id}
              id={service.id}
              title={service.title}
              description={service.description}
              startingPrice={service.starting_price}
              iconType={service.icon_type}
              onOrder={(id, title, price) => {
                setSelectedService(service);
                handleOrder(id, title, price, service.description);
              }}
            />
          ))}

          {/* Render the Single Unified "OTHER SERVICES" Card */}
          {otherServices.length > 0 && (
            <div className="bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group hover:shadow-[0_0_35px_rgba(24,119,242,0.18)] hover:border-[#1877F2]/30">
              <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
                <Layers size={40} className="text-[#1877F2] drop-shadow-[0_0_15px_rgba(24,119,242,0.3)] mb-4" />
              </div>
              
              <h3 className="uppercase text-xs font-black tracking-widest text-[#1877F2] mb-2">OTHER SERVICES</h3>
              <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#1877F2] transition-colors">Specialty & Utilities</h4>
              
              <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">
                Premium digital memberships, PisoWiFi setups, network router optimizations, and professional modeling software.
              </p>
              
              {/* Caption section listing specialty services (Price removed as requested) */}
              <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
                <div className="w-full text-left">
                  <span className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider line-clamp-2 leading-tight">
                    Gemini, PisoWiFi, EAP TP-Link, Architectural Software
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOtherModalOpen(true)}
                className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg shadow-blue-500/5 cursor-pointer"
              >
                VIEW OTHER SERVICES
              </button>
            </div>
          )}

          {/* Render the Single Unified "SMM CATALOG EXPLORER" Card */}
          <div className="bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group hover:shadow-[0_0_35px_rgba(29,185,84,0.18)] hover:border-[#1DB954]/30">
            <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
              <Layers size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />
            </div>
            
            <h3 className="uppercase text-xs font-black tracking-widest text-[#1DB954] mb-2">1,100+ BOOSTS</h3>
            <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#1DB954] transition-colors">SMM Catalog Explorer</h4>
            
            <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">
              Instantly browse and order premium boosts for Instagram, TikTok, YouTube, Twitter, and other platforms at cheap direct reseller rates.
            </p>
            
            <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
              <div className="w-full text-left">
                <span className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider line-clamp-2 leading-tight">
                  Instagram, TikTok, YouTube, Telegram, Twitter, & More
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSmmCatalogModalOpen(true)}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg shadow-[#1DB954]/5 cursor-pointer"
            >
              EXPLORE SMM CATALOG
            </button>
          </div>
        </div>
      </section>

      {/* 4. Customer reviews Grid & Form */}
      <ReviewsSection />

      {/* 4.5 Comparison Grid - CYNETWORK vs Faceless SMM Panels */}
      <section className="w-full max-w-5xl mx-auto px-4 mt-24 mb-20 relative z-10">
        <div className="text-center mb-12">
          <span className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
            ⚖️ Strategic Advantage
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-center text-white tracking-tight">
            How <span className="text-[#1DB954]">CYNETWORK</span> Wins Against Wholesale Panels
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            Unlike sterile automated direct SMM panels (like RixeySMM), we offer premium curated layers of safety and trust
          </p>
        </div>

        <div className="bg-[#121212]/50 backdrop-blur-xl border border-white/[0.04] rounded-3xl overflow-hidden shadow-2xl">
          {/* Grid Header (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-3 border-b border-slate-800/80 bg-black/40 py-5 px-8 text-xs font-black uppercase tracking-wider text-slate-400 text-left">
            <div>Core Feature</div>
            <div className="text-[#1DB954] flex items-center gap-1.5">🟢 CYNETWORK Curation</div>
            <div className="text-slate-555 flex items-center gap-1.5">🔴 Faceless Wholesale SMM Panels</div>
          </div>

          {/* Feature 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Account Safety</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Compliance & page health protection.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                🛡️ 100% Adsense & Compliant
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Filters out toxic direct-bot server pools that trigger platform restrictions or monetization bans.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                ⚠️ Raw Unfiltered Delivery
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Direct raw bots easily flagged by platform algorithms, risking immediate page deletion or restrictions.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Profile Quality</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Retention rates and account realism.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                🇵🇭 Curated PH Base & Organic Realism
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Curates realistic local accounts with actual human avatars and activity histories for maximum retention.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                🤖 Sterile Foreign Bot Spams
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Uses massive foreign accounts (mixed Russian, Turkish, Vietnamese) with zero local relevance that drop rapidly.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Payment & Top-Ups</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Convenience and transaction speed.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                📲 Seamless GCash Direct QR
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Frictionless manual GCash payment scans with instant developer approval. No processing fee.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                💳 Crypto & High Deposits
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Requires crypto wallets, international credit cards, and steep minimum balances to perform single orders.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="grid grid-cols-1 md:grid-cols-3 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Client Assistance</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Direct human contact and guarantees.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                💬 24/7 Developer Handshake
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Direct client support backed by Cyrhiel Moralla. Real human answers in quick Taglish/English.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                🤖 Delayed Robotic Tickets
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Faceless ticket forms with 48h delay, often replying with generic technical errors that offer zero actual help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FAQs Section */}
      <FaqSection />

      {/* 6. Checkout Order Modal */}
      <OrderModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        serviceId={selectedServiceId}
        serviceTitle={selectedServiceTitle}
        serviceBasePrice={selectedServicePrice}
        presetQuantity={presetQty}
        service={selectedService}
      />

      {/* 7. Other Services Selection Sub-Modal */}
      {isOtherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-[#121212]/95 border border-slate-800/80 rounded-3xl w-full max-w-5xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setIsOtherModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-850 rounded-xl z-20 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
            
            <div className="p-8 sm:p-10 border-b border-slate-800/50">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Other <span className="text-[#1877F2]">Premium Services</span>
              </h2>
              <p className="text-slate-400 text-sm mt-1.5">Configure your custom activation or specialty utility subscriptions.</p>
            </div>
            
            <div className="overflow-y-auto p-8 sm:p-10 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {otherServices.map((service) => (
                  <ServiceCard 
                    key={service.id}
                    id={service.id}
                    title={service.title}
                    description={service.description}
                    startingPrice={service.starting_price}
                    iconType={service.icon_type}
                    onOrder={(id, title, price) => {
                      setIsOtherModalOpen(false); // Auto-close selector sub-modal
                      setSelectedService(service);
                      handleOrder(id, title, price, service.description); // Fire the core order/redirect process
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. SMM Panel Catalog Modal */}
      <SmmCatalogModal 
        isOpen={isSmmCatalogModalOpen}
        onClose={() => setIsSmmCatalogModalOpen(false)}
      />
    </>
  );
}
