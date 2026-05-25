"use client";

import { useState, useEffect } from "react";
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

  // Puter AI Search States
  const [puterLoaded, setPuterLoaded] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecommend, setAiRecommend] = useState<any>(null);
  const [catalogPrefill, setCatalogPrefill] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ((window as any).puter) {
        setPuterLoaded(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      script.onload = () => {
        setPuterLoaded(true);
        console.log("Puter.js loaded successfully!");
      };
      document.body.appendChild(script);
      return () => {
        const scriptElement = document.querySelector('script[src="https://js.puter.com/v2/"]');
        if (scriptElement && scriptElement.parentNode) {
          scriptElement.parentNode.removeChild(scriptElement);
        }
      };
    }
  }, []);

  const handleAiSearch = async () => {
    if (!sectionSearchQuery.trim()) return;
    setIsAiLoading(true);
    setAiRecommend(null);

    try {
      const puter = (window as any).puter;
      if (!puter) {
        throw new Error("Puter.js is not loaded yet. Please try again in a second!");
      }

      const systemPrompt = `You are the CYNETWORK Smart Search AI Assistant.
Analyze the user's search query for digital services and map it to one of these services:
- "smm": Social Media Boosts (followers, likes, views, shares on Facebook, Instagram, TikTok, YouTube, Twitter, Telegram).
- "gemini": Gemini Pro Premium Subscription.
- "pisowifi": PisoWiFi Cloud Admin / Network Portal Setup.
- "eap": EAP TP-Link Cloud Controller network setup.
- "software": Pre-activated Architectural Software (Lumion, Sketchup, AutoCAD, D5 Render, V-Ray).

You MUST respond ONLY in the following JSON format:
{
  "service": "smm" | "gemini" | "pisowifi" | "eap" | "software" | "none",
  "search_keyword": "keyword to search in catalog if service is smm",
  "explanation": "Brief, ultra-friendly, professional response in Taglish/English explaining how we can fulfill their request and presenting the matched service."
}

No other text, markdown formatting or symbols around the JSON. Just the raw JSON object.`;

      const responseText = await puter.ai.chat(
        `${systemPrompt}\n\nUser Query: "${sectionSearchQuery}"`
      );

      // Clean response text to ensure safe JSON parsing
      const cleanText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const result = JSON.parse(cleanText);
      setAiRecommend(result);
    } catch (err: any) {
      console.error("AI Search failed:", err);
      
      // Local keywords fallback if Puter AI fails
      const q = sectionSearchQuery.toLowerCase();
      let fallbackService = "none";
      let keyword = "";
      let explanation = "Napansin ko na naghahanap ka ng digital boosts! We have exactly what you need.";

      if (q.includes("gemini") || q.includes("pro") || q.includes("ai")) {
        fallbackService = "gemini";
        explanation = "I found Gemini Pro Premium subscriptions in our services! Instantly activate your AI workflow.";
      } else if (q.includes("wifi") || q.includes("piso") || q.includes("portal")) {
        fallbackService = "pisowifi";
        explanation = "Naghahanap ka ba ng PisoWiFi portal? Check out our customized PisoWiFi setups!";
      } else if (q.includes("eap") || q.includes("tplink") || q.includes("controller")) {
        fallbackService = "eap";
        explanation = "I found TP-Link EAP Cloud Controller integration configurations in our network catalog!";
      } else if (q.includes("software") || q.includes("sketchup") || q.includes("lumion") || q.includes("autocad") || q.includes("d5")) {
        fallbackService = "software";
        explanation = "Naghahanap ka ba ng premium architectural rendering software? I found lifetime activations for Lumion, SketchUp, and more!";
      } else {
        fallbackService = "smm";
        keyword = sectionSearchQuery;
        explanation = "Tumingin ako sa database at nahanap ko ang perfect SMM platform boost na akma para sa iyong search!";
      }

      setAiRecommend({
        service: fallbackService,
        search_keyword: keyword,
        explanation: explanation
      });
    } finally {
      setIsAiLoading(false);
    }
  };

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
      title.toLowerCase().includes("license") ||
      title.toLowerCase().includes("autonomous") ||
      title.toLowerCase().includes("bot");
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

  // Core services are those that are not classified as other services
  const coreServices = services.filter((s) => !otherServices.some((o) => o.id === s.id));

  // Local state for searching services directly inside the services section
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");

  // Determine if a search is active to dynamically display specific cards
  const isSearchActive = sectionSearchQuery.trim().length > 0;

  // Filtered lists based on the header search box
  const searchedCoreServices = coreServices.filter(s => 
    s.title.toLowerCase().includes(sectionSearchQuery.toLowerCase())
  );
  
  const searchedOtherServices = otherServices.filter(s => 
    s.title.toLowerCase().includes(sectionSearchQuery.toLowerCase())
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
        <div className="flex flex-col items-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-center text-white tracking-tight">
            Choose Your <span className="text-[#1877F2]">Boost Tier</span>
          </h2>
          <p className="text-slate-400 text-xs mt-2 text-center max-w-md">
            Premium growth bundles, high-speed reseller SMM boosts, and smart local hardware integration setups.
          </p>

          {/* Search Button/Input with Puter AI Smart Search Integration */}
          <div className="mt-8 w-full max-w-xl flex flex-col sm:flex-row gap-3 items-center px-2">
            <div className="relative flex-grow w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 flex items-center">
                <span className="text-base">🔍</span>
              </div>
              <input
                type="text"
                placeholder="Ask AI or Search services (e.g. grow my TikTok, need SketchUp)..."
                value={sectionSearchQuery}
                onChange={(e) => {
                  setSectionSearchQuery(e.target.value);
                  if (e.target.value === "") setAiRecommend(null);
                }}
                className="w-full pl-10 pr-16 py-3 rounded-full bg-[#121212]/90 border border-slate-800 hover:border-[#1DB954]/40 focus:outline-none focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/15 transition-all text-slate-200 font-extrabold placeholder-slate-600 text-xs sm:text-sm tracking-wide shadow-2xl"
              />
              {isSearchActive && (
                <button
                  onClick={() => {
                    setSectionSearchQuery("");
                    setAiRecommend(null);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors text-xs font-black bg-transparent border-0 cursor-pointer"
                >
                  CLEAR
                </button>
              )}
            </div>
            
            <button
              onClick={handleAiSearch}
              disabled={!sectionSearchQuery.trim() || isAiLoading}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-500 disabled:border-slate-800 disabled:shadow-none text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#1DB954]/10 active:scale-95 transition-all"
            >
              {isAiLoading ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>AI Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Puter AI Glowing Smart Recommendation Box */}
        {aiRecommend && (
          <div className="mb-12 max-w-xl mx-auto bg-[#121212]/95 border border-[#1DB954]/30 rounded-3xl p-6 sm:p-7 shadow-[0_15px_40px_rgba(29,185,84,0.12)] backdrop-blur-md animate-in slide-in-from-top-4 duration-300 text-left relative overflow-hidden group">
            <div className="absolute -right-16 -top-16 w-32 h-32 bg-[#1DB954]/5 rounded-full blur-2xl group-hover:bg-[#1DB954]/10 transition-all duration-500" />
            
            <button
              onClick={() => setAiRecommend(null)}
              className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors p-1 hover:bg-slate-850 rounded-lg cursor-pointer"
              title="Close recommendation"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-base animate-bounce">🤖</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] flex items-center gap-1">
                Puter AI Curation Recommendation
              </span>
            </div>

            <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed font-semibold mb-6 bg-black/45 p-4 rounded-2xl border border-slate-850">
              {aiRecommend.explanation}
            </p>

            {/* Render dynamically matched Service recommendation card */}
            {aiRecommend.service === "smm" && (
              <div className="bg-[#161616] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#1DB954]/30 transition-all">
                <div className="text-left">
                  <h4 className="text-xs font-black text-[#1DB954] uppercase tracking-wider">Social Media Platform Boost</h4>
                  <h5 className="text-sm font-bold text-white mt-0.5">SMM CATALOG RESELLER EXPLORER</h5>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Reseller API access to 1,100+ bulk boosts for Facebook, Instagram, TikTok, YouTube, & more.</p>
                </div>
                <button
                  onClick={() => {
                    setCatalogPrefill(aiRecommend.search_keyword || sectionSearchQuery);
                    setIsSmmCatalogModalOpen(true);
                  }}
                  className="w-full sm:w-auto bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center shadow-md shadow-[#1DB954]/10"
                >
                  Open SMM Catalog
                </button>
              </div>
            )}

            {aiRecommend.service === "gemini" && (
              <div className="bg-[#161616] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-500/30 transition-all">
                <div className="text-left">
                  <h4 className="text-xs font-black text-[#1877F2] uppercase tracking-wider">Premium AI Subscription</h4>
                  <h5 className="text-sm font-bold text-white mt-0.5">GEMINI PRO PREMIUM PLAN</h5>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Enterprise-grade multi-modal artificial intelligence with instant invite link delivery.</p>
                </div>
                <button
                  onClick={() => {
                    const s = services.find(s => s.title.toLowerCase().includes("gemini"));
                    if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
                  }}
                  className="w-full sm:w-auto bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center shadow-md shadow-blue-500/10"
                >
                  Configure & Order
                </button>
              </div>
            )}

            {aiRecommend.service === "pisowifi" && (
              <div className="bg-[#161616] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-500/30 transition-all">
                <div className="text-left">
                  <h4 className="text-xs font-black text-[#1877F2] uppercase tracking-wider">Smart Hardware Integration</h4>
                  <h5 className="text-sm font-bold text-white mt-0.5">PISOWIFI CLOUD CUSTOM SETUP</h5>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Pre-configured local PisoWiFi captive portals and remote administration controller setups.</p>
                </div>
                <button
                  onClick={() => {
                    const s = services.find(s => s.title.toLowerCase().includes("pisowifi") || s.title.toLowerCase().includes("wifi"));
                    if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
                  }}
                  className="w-full sm:w-auto bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center shadow-md"
                >
                  Configure & Order
                </button>
              </div>
            )}

            {aiRecommend.service === "eap" && (
              <div className="bg-[#161616] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-500/30 transition-all">
                <div className="text-left">
                  <h4 className="text-xs font-black text-[#1877F2] uppercase tracking-wider">Enterprise Controller Setups</h4>
                  <h5 className="text-sm font-bold text-white mt-0.5">EAP TP-LINK CLOUD INTEGRATION</h5>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Omada EAP cloud controller setups, remote hotspot design, and client network setups.</p>
                </div>
                <button
                  onClick={() => {
                    const s = services.find(s => s.title.toLowerCase().includes("eap") || s.title.toLowerCase().includes("tplink"));
                    if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
                  }}
                  className="w-full sm:w-auto bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center shadow-md"
                >
                  Configure & Order
                </button>
              </div>
            )}

            {aiRecommend.service === "software" && (
              <div className="bg-[#161616] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-500/30 transition-all">
                <div className="text-left">
                  <h4 className="text-xs font-black text-[#1877F2] uppercase tracking-wider">Lifetime Active License</h4>
                  <h5 className="text-sm font-bold text-white mt-0.5">ARCHITECTURAL DESIGN SOFTWARE</h5>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Pre-activated license bundles for AutoCAD, Lumion, SketchUp, D5 Render, and V-Ray plugins.</p>
                </div>
                <button
                  onClick={() => {
                    const s = services.find(s => s.title.toLowerCase().includes("software") || s.title.toLowerCase().includes("architectural") || s.id === "03185a81-49f3-4255-868e-9e9ec3189497");
                    if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
                  }}
                  className="w-full sm:w-auto bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center shadow-md"
                >
                  Configure & Order
                </button>
              </div>
            )}

            {aiRecommend.service === "none" && (
              <div className="bg-[#161616] border border-slate-800 p-4 rounded-xl text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">⚠️ No Direct Match Found</p>
                <p className="text-[11px] text-slate-400 mt-1">Try using other general keywords like 'followers', 'gemini pro', 'sketchup software', or 'wifi setup'.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Dynamic Grid Layout showing consolidated cards OR filtered results */}
        {isSearchActive ? (
          /* Search results layout */
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-left border-b border-slate-850 pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2]">
                Search Results ({searchedCoreServices.length + searchedOtherServices.length} items found)
              </span>
            </div>
            
            {searchedCoreServices.length === 0 && searchedOtherServices.length === 0 ? (
              <div className="text-center py-16 bg-[#121212]/35 border border-slate-850 border-dashed rounded-3xl">
                <p className="text-slate-550 font-black uppercase text-sm">No matching services found</p>
                <p className="text-xs text-slate-600 mt-1">Try searching another term like followers, likes, sketchup or d5.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Render found core services */}
                {searchedCoreServices.map((service) => (
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

                {/* Render found other specialty services */}
                {searchedOtherServices.map((service) => (
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
            )}
          </div>
        ) : (
          /* Premium Consolidated Homepage Grid (Mobile-First responsive grids) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center max-w-4xl mx-auto">
            {/* 1. Unified "SOCIAL MEDIA BOOST" Card */}
            <div className="bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group hover:shadow-[0_0_35px_rgba(29,185,84,0.18)] hover:border-[#1DB954]/30">
              <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
                <Layers size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />
              </div>
              
              <h3 className="uppercase text-xs font-black tracking-widest text-[#1DB954] mb-2">Platform Boost</h3>
              <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#1DB954] transition-colors">SOCIAL MEDIA BOOST</h4>
              
              <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">
                Instantly amplify your social media channels with high-fidelity, high-retention boosts. Curated SMM plans for Facebook likes, views, organic targeted profile growth, and more!
              </p>
              
              <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
                <div className="w-full text-left">
                  <span className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider line-clamp-2 leading-tight">
                    Facebook Likes & Page Growth, organic targeted campaigns, custom reaction bundles
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsSmmCatalogModalOpen(true)}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg shadow-[#1DB954]/5 cursor-pointer text-center"
              >
                VIEW
              </button>
            </div>

            {/* 2. Single Unified "OTHER SERVICES" Card */}
            {otherServices.length > 0 && (
              <div className="bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group hover:shadow-[0_0_35px_rgba(24,119,242,0.18)] hover:border-[#1877F2]/30">
                <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
                  <Layers size={40} className="text-[#1877F2] drop-shadow-[0_0_15px_rgba(24,119,242,0.3)] mb-4" />
                </div>
                
                <h3 className="uppercase text-xs font-black tracking-widest text-[#1877F2] mb-2">OTHER SERVICES</h3>
                <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#1877F2] transition-colors">Specialty & Utilities</h4>
                
                <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">
                  Premium digital memberships, PisoWiFi setups, network router optimizations, and pre-activated professional architectural design tools.
                </p>
                
                <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
                  <div className="w-full text-left">
                    <span className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider line-clamp-2 leading-tight">
                      Gemini Subscriptions, PisoWiFi setups, EAP TP-Link routers, and Architectural Software
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setIsOtherModalOpen(true)}
                  className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg shadow-blue-500/5 cursor-pointer text-center"
                >
                  VIEW
                </button>
              </div>
            )}

            {/* 3. Single Unified "SMM CATALOG EXPLORER" Card */}
            <div className="bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl p-8 flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group hover:shadow-[0_0_35px_rgba(29,185,84,0.18)] hover:border-[#1DB954]/30">
              <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
                <Layers size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />
              </div>
              
              <h3 className="uppercase text-xs font-black tracking-widest text-[#1DB954] mb-2">1,100+ BOOSTS</h3>
              <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#1DB954] transition-colors">SMM Catalog Explorer</h4>
              
              <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">
                Instantly search and order premium boosts for Instagram, TikTok, YouTube, Twitter, and other platforms at direct reseller pricing.
              </p>
              
              <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
                <div className="w-full text-left">
                  <span className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider line-clamp-2 leading-tight">
                    Instagram followers, TikTok hearts, YouTube sub packs, Telegram, Twitter, & More
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsSmmCatalogModalOpen(true)}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg shadow-[#1DB954]/5 cursor-pointer text-center"
              >
                VIEW
              </button>
            </div>
          </div>
        )}
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
        onClose={() => {
          setIsSmmCatalogModalOpen(false);
          setCatalogPrefill("");
        }}
        prefilledSearch={catalogPrefill}
      />
    </>
  );
}
