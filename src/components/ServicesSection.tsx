"use client";

import { useState } from "react";
import { ServiceCard } from "./ServiceCard";
import { OrderModal } from "./OrderModal";
import { PriceCalculator } from "./PriceCalculator";
import { StatCounters } from "./StatCounters";
import { FaqSection } from "./FaqSection";
import { ReviewsSection } from "./ReviewsSection";

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
    setPresetQty(title.toLowerCase().includes("page") ? 1 : 1000);
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
          Choose Your <span className="text-[#1DB954]">Boost Tier</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service) => (
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
    </>
  );
}
