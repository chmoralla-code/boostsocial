"use client";

import { useState } from "react";
import { ServiceCard } from "./ServiceCard";
import { OrderModal } from "./OrderModal";

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

  const handleOrder = (id: string, title: string, price: number) => {
    setSelectedServiceId(id);
    setSelectedServiceTitle(title);
    setSelectedServicePrice(price);
    setIsModalOpen(true);
  };

  return (
    <>
      <section id="services" className="w-full max-w-6xl mx-auto px-4 mt-20 mb-20 relative z-10">
        <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-12 tracking-tight">
          Choose Your <span className="text-[#1DB954]">Boost Tier</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                handleOrder(id, title, price);
              }}
            />
          ))}
        </div>
      </section>

      <OrderModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        serviceId={selectedServiceId}
        serviceTitle={selectedServiceTitle}
        serviceBasePrice={selectedServicePrice}
        service={selectedService}
      />
    </>
  );
}
