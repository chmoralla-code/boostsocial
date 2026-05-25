"use client";

import { useState } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { OrderModal } from "./OrderModal";
import { SmmCatalogModal } from "./SmmCatalogModal";

interface Service {
  id: string;
  title: string;
  description: any;
  starting_price: number;
  icon_type: string;
}

interface HeroSearchProps {
  services: Service[];
}

export function HeroSearch({ services }: HeroSearchProps) {
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecommend, setAiRecommend] = useState<any>(null);
  const [catalogPrefill, setCatalogPrefill] = useState("");

  // Modals inside HeroSearch
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState("");
  const [selectedServicePrice, setSelectedServicePrice] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [presetQty, setPresetQty] = useState<number>(1000);

  const [isSmmCatalogModalOpen, setIsSmmCatalogModalOpen] = useState(false);

  const handleOrder = (id: string, title: string, price: number, description?: any) => {
    setSelectedServiceId(id);
    setSelectedServiceTitle(title);
    setSelectedServicePrice(price);
    
    // Find the correct service object
    const matched = services.find(s => s.id === id);
    if (matched) {
      setSelectedService(matched);
    }

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

  const handleAiSearch = async () => {
    if (!sectionSearchQuery.trim()) return;
    setIsAiLoading(true);
    setAiRecommend(null);

    try {
      const systemPrompt = `You are the CYNETWORK Senior Digital Services Consultant & Intelligent Search Assistant.
Your task is to analyze the user's search query for digital services and ACCURATELY map it to one of these specific service categories:
- "smm": Social Media Boosts (followers, likes, views, shares on Facebook, Instagram, TikTok, YouTube, Twitter/X, Telegram).
- "gemini": Gemini Pro Premium AI Subscription.
- "pisowifi": PisoWiFi Cloud Admin / Network Portal Setup.
- "eap": EAP TP-Link Cloud Controller network setup.
- "software": Pre-activated Lifetime Architectural Software (Lumion, Sketchup, AutoCAD, D5 Render, V-Ray, Revit).

You must write a rich, highly informative, professional, and maximized response in colloquial Taglish (Tagalog-English blend) or English that speaks directly to their search query. Do NOT give lazy or brief answers. Maximize your explanation to detail EXACTLY how CYNETWORK can solve their problem, emphasizing safety, organic delivery pools, zero monetization risks, direct GCash convenience, and 24/7 developer-direct handshake support.

INSTRUCTIONS FOR MAPPING:
1. If the user query is about social media growth or boosting (e.g. followers, reactions, views, likes, retweets, subs, members) for ANY platform (Facebook, Instagram, TikTok, YouTube, Twitter/X, Telegram):
   - Mapped service: "smm".
   - "search_keyword" MUST be the exact specific platform service term (e.g. "Facebook Page Likes", "Instagram Followers", "TikTok Video Views", "YouTube Subscribers", "Telegram Group Members", "Twitter Retweets").
   - In your "explanation", give a highly comprehensive, custom response analyzing their goal. If they mention a business or content style, relate it! Explain that our SMM catalog contains 1,100+ reseller-rate packages with 100% Adsense compliance and realistic organic-looking profiles (such as curated PH base pools) that protect their page from flagging.
2. If the user query is about AI, premium intelligence, or Gemini:
   - Mapped service: "gemini".
   - "search_keyword": "Gemini Pro Premium Subscription".
   - In your "explanation", explain how they can unlock unlimited tokens, multi-modal capabilities, and high-speed developer workflows with our fully-managed private Gemini Pro subscriptions, complete with instant invite link delivery.
3. If the user query is about PisoWiFi, captive portal design, or admin setups:
   - Mapped service: "pisowifi".
   - "search_keyword": "PisoWiFi Cloud Portal Custom Setup".
   - In your "explanation", explain how our custom-designed captive portals can double their hotspot revenue and streamline voucher generation through secure remote management panels.
4. If the user query is about TP-Link, network controllers, Omada, or access points:
   - Mapped service: "eap".
   - "search_keyword": "EAP TP-Link Cloud Integration".
   - In your "explanation", detail how we specialize in setting up centralized TP-Link Omada Cloud controllers, providing remote multi-AP monitoring, and maximizing local business network stability.
5. If the user query is about 3D rendering, drawing, licenses, AutoCAD, SketchUp, Lumion, Revit, or D5:
   - Mapped service: "software".
   - "search_keyword": "Architectural Design Software Bundle".
   - In your "explanation", detail that we provide pre-activated lifetime licenses and easy-to-install bundles for premium tools like AutoCAD, Lumion, SketchUp Pro (with V-Ray or D5 plugins), and Revit, saving them thousands of pesos in monthly subscriptions.

OUTPUT FORMAT:
You MUST respond strictly in the following JSON format:
{
  "service": "smm" | "gemini" | "pisowifi" | "eap" | "software" | "none",
  "search_keyword": "the most accurate exact keyword to search",
  "explanation": "Write a highly detailed, professional, and maximized explanation here (at least 3-4 rich sentences) blending Taglish and tech-savvy advice tailored directly to their search intent."
}

No other text, markdown formatting, or symbols around the JSON. Just the raw JSON object. Make the explanation feel extremely premium, comforting, and authoritative.`;

      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `User Query: "${sectionSearchQuery}"` }
          ],
          model: "openai",
          jsonMode: true
        })
      });

      if (!response.ok) {
        throw new Error(`Pollinations API error: ${response.status}`);
      }

      const responseText = await response.text();
      const cleanText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const result = JSON.parse(cleanText);
      setAiRecommend(result);

      // Auto-triggering modal opening to provide the service automatically and accurately!
      if (result.service === "smm") {
        setCatalogPrefill(result.search_keyword || sectionSearchQuery);
        setIsSmmCatalogModalOpen(true);
      } else if (result.service === "gemini") {
        const s = services.find(s => s.title.toLowerCase().includes("gemini"));
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      } else if (result.service === "pisowifi") {
        const s = services.find(s => s.title.toLowerCase().includes("pisowifi") || s.title.toLowerCase().includes("wifi"));
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      } else if (result.service === "eap") {
        const s = services.find(s => s.title.toLowerCase().includes("eap") || s.title.toLowerCase().includes("tplink"));
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      } else if (result.service === "software") {
        const s = services.find(s => s.title.toLowerCase().includes("software") || s.title.toLowerCase().includes("architectural") || s.id === "03185a81-49f3-4255-868e-9e9ec3189497");
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      }
    } catch (err: any) {
      console.error("AI Search failed:", err);
      
      // Local keywords fallback if Pollinations AI fails
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

      // Auto-triggering modal opening for fallback path
      if (fallbackService === "smm") {
        setCatalogPrefill(keyword || sectionSearchQuery);
        setIsSmmCatalogModalOpen(true);
      } else if (fallbackService === "gemini") {
        const s = services.find(s => s.title.toLowerCase().includes("gemini"));
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      } else if (fallbackService === "pisowifi") {
        const s = services.find(s => s.title.toLowerCase().includes("pisowifi") || s.title.toLowerCase().includes("wifi"));
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      } else if (fallbackService === "eap") {
        const s = services.find(s => s.title.toLowerCase().includes("eap") || s.title.toLowerCase().includes("tplink"));
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      } else if (fallbackService === "software") {
        const s = services.find(s => s.title.toLowerCase().includes("software") || s.title.toLowerCase().includes("architectural") || s.id === "03185a81-49f3-4255-868e-9e9ec3189497");
        if (s) handleOrder(s.id, s.title, s.starting_price, s.description);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const isSearchActive = sectionSearchQuery.trim().length > 0;

  return (
    <div className="w-full max-w-xl mx-auto z-20 flex flex-col items-center px-4 relative mt-2 mb-10">
      {/* 1. Improved Question Prompt */}
      <span className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 font-black text-[9px] sm:text-[10px] tracking-widest uppercase px-4.5 py-2 rounded-full inline-flex items-center gap-1.5 mb-5 shadow-sm select-none animate-pulse">
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
            placeholder="Ask AI or search: e.g. grow my Instagram, SketchUp license, TikTok views..."
            value={sectionSearchQuery}
            onChange={(e) => {
              setSectionSearchQuery(e.target.value);
              if (e.target.value === "") setAiRecommend(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAiSearch();
            }}
            className="w-full pl-10 pr-16 py-3.5 rounded-full bg-[#121212]/95 border border-slate-800 hover:border-[#1DB954]/40 focus:outline-none focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/15 transition-all text-slate-200 font-extrabold placeholder-slate-600 text-xs sm:text-sm tracking-wide shadow-2xl"
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
