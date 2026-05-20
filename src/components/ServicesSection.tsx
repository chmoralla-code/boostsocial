"use client";

import { useState } from "react";
import { ServiceCard } from "./ServiceCard";
import { OrderModal } from "./OrderModal";
import { PriceCalculator } from "./PriceCalculator";
import { StatCounters } from "./StatCounters";
import { FaqSection } from "./FaqSection";
import { ReviewsSection } from "./ReviewsSection";
import { Layers, X } from "lucide-react";

interface Service {
  id: string;
  title: string;
  description: string;
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

  const handleOrder = (id: string, title: string, price: number, description?: string) => {
    // Check if this service has a redirect URL
    try {
      if (description && description.trim().startsWith("{")) {
        const parsed = JSON.parse(description);
        if (parsed.redirect_url) {
          window.open(parsed.redirect_url, "_blank", "noopener,noreferrer");
          return;
        }
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
        </div>
      </section>

      {/* 4. Customer reviews Grid & Form */}
      <ReviewsSection />

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
    </>
  );
}
