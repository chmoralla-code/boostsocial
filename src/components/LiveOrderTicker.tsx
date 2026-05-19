"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Rocket, X, TrendingUp } from "lucide-react";

interface LiveOrderNotification {
  id: string;
  serviceName: string;
  quantity: number;
  location: string;
  timestamp: string;
}

const PH_LOCATIONS = [
  "Manila", "Quezon City", "Davao City", "Cebu City", "Zamboanga City", 
  "Taguig", "Pasig", "Cagayan de Oro", "Parañaque", "Kalookan", 
  "Valenzuela", "Las Piñas", "Makati", "Bacolod", "Iloilo City",
  "Pasay", "Angeles City", "General Santos", "Imus", "Cabuyao"
];

const MOCK_QUANTITIES = [500, 1000, 2000, 5000, 10000];

export function LiveOrderTicker() {
  const [notification, setNotification] = useState<LiveOrderNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [servicesMap, setServicesMap] = useState<Record<string, string>>({});
  const supabase = createClient();

  // 1. Fetch services list to map service_id -> service_title
  useEffect(() => {
    const fetchServices = async () => {
      const { data, error } = await supabase.from("services").select("id, title");
      if (!error && data) {
        const dict: Record<string, string> = {};
        data.forEach((s) => {
          dict[s.id] = s.title;
        });
        setServicesMap(dict);
      }
    };
    fetchServices();
  }, []);

  const triggerNotification = (newNotif: LiveOrderNotification) => {
    setIsVisible(false);
    setTimeout(() => {
      setNotification(newNotif);
      setIsVisible(true);
    }, 300);

    // Auto-hide after 8 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 8000);

    return () => clearTimeout(timer);
  };

  // 2. Subscribe to real-time INSERT events on orders table
  useEffect(() => {
    const channel = supabase
      .channel("live-smm-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          console.log("Real-time order placed by customer:", payload.new);
          const newOrder = payload.new;
          
          // Get service title
          let serviceName = servicesMap[newOrder.service_id] || "SMM Boost";
          if (!servicesMap[newOrder.service_id]) {
            // Fallback fetch in case cache isn't fully loaded
            const { data } = await supabase
              .from("services")
              .select("title")
              .eq("id", newOrder.service_id)
              .single();
            if (data?.title) {
              serviceName = data.title;
            }
          }

          const randomPH = PH_LOCATIONS[Math.floor(Math.random() * PH_LOCATIONS.length)];
          const newNotif: LiveOrderNotification = {
            id: newOrder.id,
            serviceName,
            quantity: Number(newOrder.quantity) || 1000,
            location: randomPH,
            timestamp: "Just now"
          };
          
          triggerNotification(newNotif);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [servicesMap]);

  // 3. Simulated platform activity fallback (simulates orders every 40-70 seconds)
  useEffect(() => {
    const generateSimulatedOrder = () => {
      const services = Object.values(servicesMap);
      if (services.length === 0) return;

      const randomService = services[Math.floor(Math.random() * services.length)];
      const randomQty = MOCK_QUANTITIES[Math.floor(Math.random() * MOCK_QUANTITIES.length)];
      const randomPH = PH_LOCATIONS[Math.floor(Math.random() * PH_LOCATIONS.length)];

      const simulatedNotif: LiveOrderNotification = {
        id: `sim-${Math.random().toString(36).substr(2, 9)}`,
        serviceName: randomService,
        quantity: randomService.toLowerCase().includes("page") ? 1 : randomQty,
        location: randomPH,
        timestamp: "Just now"
      };

      triggerNotification(simulatedNotif);
    };

    // First simulated order after 15 seconds
    const initialTimer = setTimeout(() => {
      generateSimulatedOrder();
    }, 15000);

    // Schedule subsequent simulated orders periodically
    const interval = setInterval(() => {
      // Add random delay to make it feel natural
      if (Math.random() > 0.3) {
        generateSimulatedOrder();
      }
    }, 45000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [servicesMap]);

  if (!notification) return null;

  return (
    <div
      className={`fixed bottom-6 left-6 z-[90] w-[320px] max-w-[calc(100vw-3rem)] bg-[#181818]/95 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-500 transform ${
        isVisible 
          ? "translate-x-0 opacity-100 scale-100" 
          : "-translate-x-12 opacity-0 scale-95 pointer-events-none"
      } flex items-start gap-3.5 group`}
    >
      {/* Icon Wrapper with glowing circle */}
      <div className="p-3 bg-[#1877F2]/10 rounded-xl text-[#1877F2] flex-shrink-0 relative">
        <span className="absolute inset-0 bg-[#1877F2]/5 rounded-xl animate-ping opacity-60"></span>
        <Rocket size={18} className="relative z-10 animate-bounce" />
      </div>

      {/* Content details */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/10 text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <TrendingUp size={8} /> LIVE BOOST
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">{notification.timestamp}</span>
        </div>
        <p className="text-xs font-bold text-white leading-relaxed">
          Someone in <span className="text-[#1877F2] font-extrabold">{notification.location}</span>
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
          ordered <span className="text-white font-extrabold">{notification.quantity.toLocaleString()}</span> units of{" "}
          <span className="text-white font-black">{notification.serviceName}</span>
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={() => setIsVisible(false)}
        className="text-slate-500 hover:text-white p-1 hover:bg-[#282828] rounded-lg transition-all flex-shrink-0 cursor-pointer"
        title="Dismiss alert"
      >
        <X size={14} />
      </button>
    </div>
  );
}
