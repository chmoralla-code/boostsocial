"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Copy, Check, ClipboardList, LogIn, Search } from "lucide-react";
import { OrderModal } from "./OrderModal";
import { SmmCatalogModal } from "./SmmCatalogModal";

interface Service {
  id: string;
  title: string;
  description: unknown;
  starting_price: number;
  icon_type: string;
}

interface HeroSearchProps {
  services: Service[];
}

type AiSearchRecommendation = {
  kind: "smm" | "service" | "page" | "catalog";
  title: string;
  description: string;
  href: string;
  action: "open_catalog" | "open_order" | "open_page";
  serviceId?: string;
  smmServiceId?: string;
  searchKeyword?: string;
  priceLabel?: string;
  actionLabel?: string;
};

type AiSearchResult = {
  service: "smm" | "gemini" | "pisowifi" | "eap" | "software" | "none";
  search_keyword: string;
  explanation: string;
  recommendations?: AiSearchRecommendation[];
  confidence?: string;
};

function getErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "AI search temporarily unavailable.";
}

export function HeroSearch({ services }: HeroSearchProps) {
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecommend, setAiRecommend] = useState<AiSearchResult | null>(null);
  const [catalogPrefill, setCatalogPrefill] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Modals inside HeroSearch
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState("");
  const [selectedServicePrice, setSelectedServicePrice] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [presetQty, setPresetQty] = useState<number>(1000);

  const [isSmmCatalogModalOpen, setIsSmmCatalogModalOpen] = useState(false);

  const handleOrder = (id: string, title: string, price: number, description?: unknown) => {
    setSelectedServiceId(id);
    setSelectedServiceTitle(title);
    setSelectedServicePrice(price);
    
    // Find the correct service object
    const matched = services.find(s => s.id === id);
    if (matched) {
      setSelectedService(matched);
    } else {
      setSelectedService({
        id,
        title,
        description: description || "",
        starting_price: price,
        icon_type: "followers",
      });
    }

    const isSingleQty = 
      title.toLowerCase().includes("page") || 
      title.toLowerCase().includes("gemini") || 
      title.toLowerCase().includes("pisowifi") ||
      title.toLowerCase().includes("piso wifi") ||
      title.toLowerCase().includes("eap") || 
      title.toLowerCase().includes("tplink") || 
      title.toLowerCase().includes("software") || 
      title.toLowerCase().includes("architectural") ||
      title.toLowerCase().includes("license");
      
    setPresetQty(isSingleQty ? 1 : 1000);
    setIsModalOpen(true);
  };

  const getAbsoluteHref = (href: string) => {
    if (href.startsWith("http")) return href;
    if (typeof window === "undefined") return href;
    return `${window.location.origin}${href}`;
  };

  const copyServiceLink = async (href: string) => {
    const absoluteHref = getAbsoluteHref(href);
    try {
      await navigator.clipboard.writeText(absoluteHref);
      setCopiedLink(href);
      setTimeout(() => setCopiedLink(null), 1800);
    } catch {
      setCopiedLink(null);
    }
  };

  const openRecommendation = (recommendation: AiSearchRecommendation) => {
    if (recommendation.action === "open_catalog") {
      setCatalogPrefill(recommendation.smmServiceId || recommendation.searchKeyword || aiRecommend?.search_keyword || sectionSearchQuery);
      setIsSmmCatalogModalOpen(true);
      return;
    }

    if (recommendation.action === "open_page") {
      window.location.href = recommendation.href;
      return;
    }

    if (recommendation.action === "open_order" && recommendation.serviceId) {
      const service = services.find((item) => item.id === recommendation.serviceId);
      if (service) {
        handleOrder(service.id, service.title, service.starting_price, service.description);
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const smmServiceId = params.get("smm_service");
    const smmSearch = params.get("smm_search");
    const serviceId = params.get("service_id");

    if (smmServiceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCatalogPrefill(smmServiceId);
      setIsSmmCatalogModalOpen(true);
      return;
    }

    if (smmSearch) {
      setCatalogPrefill(smmSearch);
      setIsSmmCatalogModalOpen(true);
      return;
    }

    if (serviceId) {
      const service = services.find((item) => item.id === serviceId);
      if (service) {
        handleOrder(service.id, service.title, service.starting_price, service.description);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const handleAiSearch = async () => {
    if (!sectionSearchQuery.trim()) return;
    setIsAiLoading(true);
    setAiRecommend(null);

    try {
      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: sectionSearchQuery,
          services,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `AI search failed with status ${response.status}`);
      }

      const result = await response.json() as AiSearchResult;
      setAiRecommend(result);

      const topRecommendation = result.recommendations?.[0];
      if (topRecommendation && result.service !== "none") {
        openRecommendation(topRecommendation);
      }
    } catch (err) {
      console.error("AI Search failed:", err);
      setAiRecommend({
        service: "none",
        search_keyword: "",
        explanation: getErrorMessage(err),
        recommendations: [{
          kind: "catalog",
          title: "All Services Catalog",
          description: "Open the catalog and search manually while AI search recovers.",
          href: `/?smm_search=${encodeURIComponent(sectionSearchQuery)}`,
          action: "open_catalog",
          searchKeyword: sectionSearchQuery,
        }]
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const isSearchActive = sectionSearchQuery.trim().length > 0;

  return (
    <div className="w-full max-w-xl mx-auto z-20 flex flex-col items-center px-0 sm:px-4 relative mt-0 sm:mt-2 mb-8 sm:mb-10">
      {/* 1. Improved Question Prompt */}
      <span className="w-full justify-center text-center leading-relaxed bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 font-black text-[9px] sm:text-[10px] tracking-widest uppercase px-4 py-2 rounded-full inline-flex items-center gap-1.5 mb-4 sm:mb-5 shadow-sm select-none animate-pulse">
        ⚡ Which social media platform do you want to boost today?
      </span>

      {/* 2. Premium AI Search bar */}
      <div className="w-full flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-grow w-full">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 flex items-center">
            <span className="text-base">🔍</span>
          </div>
          <input
            type="text"
            placeholder="Ask AI or search services..."
            value={sectionSearchQuery}
            onChange={(e) => {
              setSectionSearchQuery(e.target.value);
              if (e.target.value === "") setAiRecommend(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAiSearch();
            }}
            className="w-full pl-10 pr-14 py-3.5 rounded-full bg-[#121212]/95 border border-slate-800 hover:border-[#1DB954]/40 focus:outline-none focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/15 transition-all text-slate-200 font-extrabold placeholder-slate-600 text-xs sm:text-sm tracking-wide shadow-2xl"
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
          className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-500 disabled:border-slate-800 disabled:shadow-none text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#1DB954]/15 active:scale-95 transition-all"
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

      {/* 3. CYNETWORK AI Smart Recommendation Box */}
      {aiRecommend && (
        <div className="mt-8 w-full bg-[#121212]/95 border border-[#1DB954]/30 rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(29,185,84,0.15)] backdrop-blur-md animate-in slide-in-from-top-4 duration-350 text-left relative overflow-hidden group">
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
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] flex items-center gap-1 font-mono">
              CYNETWORK AI Smart Recommendation
            </span>
          </div>

          <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed font-semibold mb-6 bg-black/45 p-4 rounded-2xl border border-slate-850">
            {aiRecommend.explanation}
          </p>

          {aiRecommend.recommendations && aiRecommend.recommendations.length > 0 && (
            <div className="mb-6 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
                  Matched service links
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {aiRecommend.confidence || "smart match"}
                </span>
              </div>

              {aiRecommend.recommendations.slice(0, 3).map((recommendation) => (
                <div
                  key={`${recommendation.kind}-${recommendation.href}-${recommendation.title}`}
                  className="bg-[#161616] border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 hover:border-[#1DB954]/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        {recommendation.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">
                        {recommendation.description}
                      </p>
                      {recommendation.priceLabel && (
                        <p className="text-[10px] text-[#1DB954] mt-1 font-black uppercase tracking-wider">
                          {recommendation.priceLabel}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openRecommendation(recommendation)}
                        className="inline-flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-4 py-2.5 rounded-full text-[10px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                      >
                        <ExternalLink size={13} />
                        {recommendation.actionLabel || "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyServiceLink(recommendation.href)}
                        className="inline-flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-extrabold px-4 py-2.5 rounded-full text-[10px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                      >
                        {copiedLink === recommendation.href ? <Check size={13} /> : <Copy size={13} />}
                        {copiedLink === recommendation.href ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <a
                    href={recommendation.href}
                    onClick={(event) => {
                      event.preventDefault();
                      openRecommendation(recommendation);
                    }}
                    className="block text-[10px] text-slate-500 hover:text-[#1DB954] font-mono truncate bg-black/35 border border-slate-900 rounded-xl px-3 py-2 transition-colors"
                    title={getAbsoluteHref(recommendation.href)}
                  >
                    {getAbsoluteHref(recommendation.href)}
                  </a>
                </div>
              ))}
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a href="/login" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-black/35 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-250 transition hover:border-[#1DB954]/35 hover:text-white">
              <LogIn size={14} />
              Login/Register
            </a>
            <a href="/track" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-black/35 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-250 transition hover:border-[#1DB954]/35 hover:text-white">
              <ClipboardList size={14} />
              Track Order
            </a>
            <button
              type="button"
              onClick={() => {
                setCatalogPrefill(aiRecommend.search_keyword || sectionSearchQuery);
                setIsSmmCatalogModalOpen(true);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#1DB954]/25 bg-[#1DB954]/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#1DB954] transition hover:bg-[#1DB954] hover:text-black"
            >
              <Search size={14} />
              Open Catalog
            </button>
          </div>

          {/* Render dynamically matched Service recommendation card */}
          {aiRecommend.service === "smm" && (
            <div className="bg-[#161616] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#1DB954]/30 transition-all">
              <div className="text-left">
                <h4 className="text-xs font-black text-[#1DB954] uppercase tracking-wider">Social Media Platform Boost</h4>
                <h5 className="text-sm font-bold text-white mt-0.5">ALL SERVICES</h5>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Reseller API access to 1,100+ bulk boosts for Facebook, Instagram, TikTok, YouTube, & more.</p>
              </div>
              <button
                onClick={() => {
                  setCatalogPrefill(aiRecommend.search_keyword || sectionSearchQuery);
                  setIsSmmCatalogModalOpen(true);
                }}
                className="w-full sm:w-auto bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center shadow-md shadow-[#1DB954]/10"
              >
                Open All Services
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
            <div className="bg-[#10131a] border border-[#3b82f6]/40 p-6 sm:p-7 rounded-3xl flex flex-col gap-3 relative overflow-hidden group shadow-[0_15px_40px_rgba(59,130,246,0.1)] transition-all">
              {/* Google Search Gradient glow backdrop */}
              <div className="absolute -right-20 -top-20 w-44 h-44 bg-[#3b82f6]/5 rounded-full blur-2xl group-hover:bg-[#3b82f6]/10 transition-all duration-500" />
              
              <div className="flex items-center gap-2 border-b border-slate-850/60 pb-3">
                <span className="text-sm">🌐</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#3b82f6] flex items-center gap-1 font-mono">
                  Google Search style AI Overview
                </span>
                <span className="text-[8px] bg-[#3b82f6]/15 text-[#3b82f6] px-2 py-0.5 rounded font-black tracking-widest uppercase ml-auto select-none font-mono">
                  ACCURATE
                </span>
              </div>
              
              <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed font-semibold whitespace-pre-wrap animate-in fade-in duration-300">
                {aiRecommend.explanation}
              </p>
              
              {/* SMM Platform Quick Suggestion CTA in case they want a boost as well */}
              <div className="border-t border-slate-850/50 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide leading-tight">
                  Looking for digital growth? You can also explore our 1,100+ services catalog:
                </span>
                <button
                  onClick={() => {
                    setCatalogPrefill("");
                    setIsSmmCatalogModalOpen(true);
                  }}
                  className="w-full sm:w-auto bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-extrabold px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center shadow-sm"
                >
                  Browse All Services

                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checky Modals */}
      <OrderModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        serviceId={selectedServiceId}
        serviceTitle={selectedServiceTitle}
        serviceBasePrice={selectedServicePrice}
        presetQuantity={presetQty}
        service={selectedService}
      />

      <SmmCatalogModal 
        isOpen={isSmmCatalogModalOpen}
        onClose={() => {
          setIsSmmCatalogModalOpen(false);
          setCatalogPrefill("");
        }}
        prefilledSearch={catalogPrefill}
      />
    </div>
  );
}
