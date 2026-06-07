"use client";

import { useState, useEffect } from "react";
import { X, Search, Loader2, Globe, ArrowLeft, ShieldCheck, Check, Copy, AlertCircle, ShoppingBag, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";
import { LinkPreviewWindow } from "./LinkPreviewWindow";
import { isOrganic, formatSmmServiceName, matchesServiceQualityFilter } from "@/utils/serviceHelpers";
import { compressImage } from "@/utils/imageCompressor";
import { getVipDiscountSummary } from "@/utils/vip";


interface SmmService {
  id: string; // RixeySMM service ID (e.g. "2983")
  name: string;
  category: string;
  originalRate: number;
  ratePer1k: number;
  startingPrice: number; // per piece
  min: number;
  max: number;
  desc: string;
}

interface SmmCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledSearch?: string;
}

const PLATFORMS = [
  { id: "all", name: "All Platforms", icon: "🌐" },
  { id: "facebook", name: "Facebook", icon: "📘" },
  { id: "instagram", name: "Instagram", icon: "📸" },
  { id: "tiktok", name: "TikTok", icon: "🎵" },
  { id: "youtube", name: "YouTube", icon: "🎥" },
  { id: "twitter", name: "Twitter", icon: "🐦" },
  { id: "telegram", name: "Telegram", icon: "✈️" }
];

function parseServiceIndicators(name: string, desc: string = "") {
  const combined = `${name} ${desc}`.toLowerCase();
  
  // 1. Detect expected start time
  let start = "⚡ Instant";
  if (combined.includes("instant") || combined.includes("auto-start") || combined.includes("auto start")) {
    start = "⚡ Instant";
  } else if (combined.includes("0-1h") || combined.includes("0-1 hour") || combined.includes("within 1 hour")) {
    start = "⏱️ < 1 Hour";
  } else if (combined.includes("0-12h") || combined.includes("0-12 hour") || combined.includes("within 12 hours")) {
    start = "⏱️ < 12 Hours";
  } else if (combined.includes("0-24h") || combined.includes("within 24h") || combined.includes("24 hours")) {
    start = "⏱️ < 24 Hours";
  } else if (combined.includes("1-12h") || combined.includes("1-24h")) {
    start = "⏱️ 1-24 Hours";
  } else if (combined.includes("slow") || combined.includes("gradual")) {
    start = "⏱️ Gradual Start";
  }

  // 2. Detect delivery speed
  let speed = "⚡ Auto-Speed";
  const speedMatch = combined.match(/(\d+(?:k|m))\s*\/\s*day/i) || combined.match(/speed:\s*(\d+(?:k|m))\b/i) || combined.match(/(\d+(?:k|m))\s*speed/i);
  if (speedMatch && speedMatch[1]) {
    speed = `🚀 Speed: ${speedMatch[1].toUpperCase()}/day`;
  } else if (combined.includes("50k/day") || combined.includes("50k")) {
    speed = "🚀 Speed: 50K/day";
  } else if (combined.includes("10k/day") || combined.includes("10k")) {
    speed = "🚀 Speed: 10K/day";
  } else if (combined.includes("5k/day") || combined.includes("5k")) {
    speed = "🚀 Speed: 5K/day";
  } else if (combined.includes("1k/day") || combined.includes("1k")) {
    speed = "🚀 Speed: 1K/day";
  } else if (combined.includes("instant delivery") || combined.includes("super fast")) {
    speed = "🚀 Speed: Super Fast";
  }

  // 3. Detect refill / drop guarantee
  let refill = "🛡️ Stable";
  if (combined.includes("no refill") || combined.includes("no drop guarantee") || combined.includes("r0")) {
    refill = "⚠️ No Refill";
  } else if (combined.includes("30d refill") || combined.includes("30 days refill") || combined.includes("30 day refill") || combined.includes("r30")) {
    refill = "♻️ 30-Day Refill";
  } else if (combined.includes("60d refill") || combined.includes("60 days refill") || combined.includes("r60")) {
    refill = "♻️ 60-Day Refill";
  } else if (combined.includes("90d refill") || combined.includes("90 days refill") || combined.includes("r90")) {
    refill = "♻️ 90-Day Refill";
  } else if (combined.includes("lifetime refill") || combined.includes("lifetime drop guarantee") || combined.includes("auto-refill") || combined.includes("non drop") || combined.includes("non-drop")) {
    refill = "♾️ Lifetime Refill";
  } else if (combined.includes("refill")) {
    refill = "♻️ Refill Guaranteed";
  }

  return { start, speed, refill };
}

export function SmmCatalogModal({ isOpen, onClose, prefilledSearch }: SmmCatalogModalProps) {
  const [services, setServices] = useState<SmmService[]>([]);
  const { qualityFilter } = useWidgetVisibility();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"cheapest" | "expensive" | "alpha" | "id">("cheapest");
  const [isOrganicFilter, setIsOrganicFilter] = useState(true);
  const [originFilter, setOriginFilter] = useState<"all" | "ph" | "foreigner">("all");

  
  // Checkout flow state
  const [selectedService, setSelectedService] = useState<SmmService | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"catalog" | "form" | "success">("catalog");
  
  // Order fields
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [isWalletPayment, setIsWalletPayment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [smmBalance, setSmmBalance] = useState<number>(100);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (checkoutStep === "success") {
      fetch("/api/smm/balance")
        .then((res) => res.json())
        .then((data) => setSmmBalance(data.balance))
        .catch(() => {});
    }
  }, [checkoutStep]);

  const supabase = createClient();
  const CUSTOM_SMM_SERVICE_ID = "e6f61249-71fe-40df-84f3-96d03d3e8dcf";

  useEffect(() => {
    if (isOpen) {
      // Fetch services catalog
      setLoading(true);
      setError("");
      setCheckoutStep("catalog");
      setSelectedService(null);
      setUrl("");
      setReceiptFile(null);
      
      // Auto-initialize search query and platform tab from Puter AI prefill
      if (prefilledSearch) {
        setSearchTerm(prefilledSearch);
        const psLower = prefilledSearch.toLowerCase();
        if (psLower.includes("facebook") || psLower.includes("fb")) setSelectedPlatform("facebook");
        else if (psLower.includes("instagram") || psLower.includes("ig")) setSelectedPlatform("instagram");
        else if (psLower.includes("tiktok") || psLower.includes("tt")) setSelectedPlatform("tiktok");
        else if (psLower.includes("youtube") || psLower.includes("yt")) setSelectedPlatform("youtube");
        else if (psLower.includes("twitter") || psLower.includes("x")) setSelectedPlatform("twitter");
        else if (psLower.includes("telegram")) setSelectedPlatform("telegram");
        else setSelectedPlatform("all");
      } else {
        setSearchTerm("");
        setSelectedPlatform("all");
      }
      
      fetch("/api/smm/services")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load SMM services catalog");
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setServices(data);
            
            // Extract categories
            const cats = Array.from(new Set(data.map((s: SmmService) => s.category))) as string[];
            cats.sort();
            setCategories(cats);

            // BEYOND EXPECTATIONS: If prefilledSearch is a direct numeric service ID, auto-open its checkout form!
            if (prefilledSearch && /^\d+$/.test(prefilledSearch)) {
              const matched = data.find((s: SmmService) => s.id === prefilledSearch);
              if (matched) {
                setSelectedService(matched);
                setCheckoutStep("form");
              }
            }
          } else {
            throw new Error("Invalid catalog response format");
          }
        })
        .catch((err) => {
          setError(err.message || "Could not retrieve services. Please try again.");
        })
        .finally(() => {
          setLoading(false);
        });

      // Get authenticated profile
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUser(data.user);
          setEmail(data.user.email || "");
          supabase.from("profiles").select("*").eq("id", data.user.id).single().then(({ data: pData }) => {
            if (pData) setProfile(pData);
          });
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedService) {
      setQuantity(selectedService.min);
    }
  }, [selectedService]);

  useEffect(() => {
    setSelectedCategory("all");
  }, [selectedPlatform]);

  const handleSelectService = (service: SmmService) => {
    setSelectedService(service);
    setCheckoutStep("form");
    setError("");
  };

  const handleBackToCatalog = () => {
    setCheckoutStep("catalog");
    setSelectedService(null);
    setError("");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`BS-${orderId.slice(0, 8).toUpperCase()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter categories based on selected platform
  const filteredCategories = categories.filter((cat) => {
    if (selectedPlatform === "all") return true;
    return cat.toLowerCase().includes(selectedPlatform);
  });

  // Filter logic for SMM Catalog services
  const filteredServices = services.filter((s) => {
    const nameLower = s.name.toLowerCase();
    const categoryLower = s.category.toLowerCase();
    const idLower = s.id.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = 
      nameLower.includes(searchLower) || 
      categoryLower.includes(searchLower) ||
      idLower.includes(searchLower);
      
    const matchesPlatform = selectedPlatform === "all" || 
      categoryLower.includes(selectedPlatform) || 
      nameLower.includes(selectedPlatform);

    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;

    const matchesQuality = matchesServiceQualityFilter(s.name, s.desc || "", s.category, isOrganicFilter);

    // Origin filtering
    const combined = `${s.name} ${s.category} ${s.desc || ""}`.toLowerCase();
    const isPh = combined.includes("ph base") || 
                 combined.includes("philippine") || 
                 combined.includes("phbase") ||
                 combined.includes("pilipino") ||
                 combined.includes("🇵🇭") ||
                 combined.includes("ph-base");

    const matchesOrigin = 
      originFilter === "all" ||
      (originFilter === "ph" && isPh) ||
      (originFilter === "foreigner" && !isPh);

    return matchesSearch && matchesPlatform && matchesCategory && matchesQuality && matchesOrigin;
  });


  // Dynamic sorting for catalog Explorer matching user demands (defaults to Cheapest First)
  const sortedServices = [...filteredServices].sort((a, b) => {
    if (sortBy === "cheapest") {
      return a.startingPrice - b.startingPrice;
    }
    if (sortBy === "expensive") {
      return b.startingPrice - a.startingPrice;
    }
    if (sortBy === "alpha") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "id") {
      return Number(a.id) - Number(b.id);
    }
    return 0;
  });

  const getTargetUrlLabel = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("view") || cat.includes("video") || cat.includes("play")) {
      return "Video URL / Link";
    }
    if (cat.includes("follower") || cat.includes("subscriber") || cat.includes("member") || cat.includes("like") || cat.includes("react")) {
      return "Profile or Page URL / Link";
    }
    return "Target URL / Link";
  };

  const getTargetUrlPlaceholder = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("instagram")) {
      return "https://instagram.com/username";
    }
    if (cat.includes("tiktok")) {
      return "https://tiktok.com/@username/video/123456789";
    }
    if (cat.includes("youtube")) {
      return "https://youtube.com/watch?v=123456";
    }
    return "https://facebook.com/your-target-url";
  };

  const formatPrice = (amount: number) => {
    return amount.toFixed(2);
  };

  const effectiveQuantity = selectedService ? Math.max(quantity, selectedService.min) : 0;
  const calculatedTotal = selectedService ? effectiveQuantity * selectedService.startingPrice : 0;
  const regularTotal = calculatedTotal > 0 ? Math.max(calculatedTotal, 5.00) : 0;
  const vipTotalSummary = getVipDiscountSummary(profile, regularTotal);
  const payableTotal = vipTotalSummary.discountPercent > 0 ? vipTotalSummary.finalAmount : regularTotal;
  const hasVipDiscount = vipTotalSummary.discountPercent > 0 && vipTotalSummary.savingsAmount > 0;
  const getVipPrice = (amount: number) => {
    const summary = getVipDiscountSummary(profile, amount);
    return summary.discountPercent > 0 ? summary.finalAmount : amount;
  };

  const isPhBase = selectedService
    ? (selectedService.name.toLowerCase().includes("ph base") || 
       selectedService.name.toLowerCase().includes("philippine") || 
       selectedService.category.toLowerCase().includes("ph base") || 
       selectedService.category.toLowerCase().includes("philippine"))
    : false;

  // Manual GCash submission
  const handleSubmitGcash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    if (!receiptFile) {
      setError("Please attach your GCash transaction receipt screenshot first.");
      return;
    }

    if (quantity > selectedService.max) {
      setError(`Quantity cannot exceed ${selectedService.max.toLocaleString()}.`);
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    const finalQuantity = Math.max(quantity, selectedService.min);

    setIsSubmitting(true);
    setError("");

    try {
      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: CUSTOM_SMM_SERVICE_ID,
          email: email.trim(),
          targetUrl: url.trim(),
          amount: regularTotal,
          paymentMethod: "GCash",
          quantity: finalQuantity,
          smmServiceId: selectedService.id
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create order.");

      const insertData = { id: createData.orderId || createData.data?.id };
      if (!insertData.id) throw new Error("Order was created without a tracking ID.");

      // Compress and upload receipt
      try {
        const compressedReceipt = await compressImage(receiptFile);
        const receiptFormData = new FormData();
        receiptFormData.append("file", compressedReceipt);
        receiptFormData.append("orderId", insertData.id);
        
        const uploadRes = await fetch("/api/upload-receipt", {
          method: "POST",
          body: receiptFormData
        });
        
        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "Failed to upload payment receipt screenshot.");
        }
      } catch (uploadReceiptErr: any) {
        console.error("Receipt upload failed:", uploadReceiptErr);
        throw new Error(uploadReceiptErr.message || "Failed to upload payment receipt file.");
      }

      setOrderId(insertData.id);
      setIsWalletPayment(false);
      setCheckoutStep("success");
      
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", insertData.id);
        localStorage.setItem("last_order_email", email.trim());
      }

      // Fire Telegram notification (non-blocking)
      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingId: `BS-${insertData.id.slice(0, 8).toUpperCase()}`,
          service: `[SMM #${selectedService.id}] ${selectedService.name}`,
          email: email.trim(),
          quantity: finalQuantity,
          amount: payableTotal,
          paymentMethod: "📱 GCash",
          details: url.trim(),
        }),
      }).catch(() => {});

    } catch (err: any) {
      setError(err.message || "Failed to place order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Wallet deduction checkout (Server-side insertion to bypass client RLS and remove receipt screenshot upload checks)
  const handleWalletCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !user) return;

    if (quantity > selectedService.max) {
      setError(`Quantity cannot exceed ${selectedService.max.toLocaleString()}.`);
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    const finalQuantity = Math.max(quantity, selectedService.min);

    if (Number(profile?.balance || 0) < payableTotal) {
      setError("Insufficient wallet balance. Please top up first.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/checkout-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          serviceId: CUSTOM_SMM_SERVICE_ID,
          serviceTitle: `[SMM #${selectedService.id}] ${selectedService.name}`,
          email: user.email,
          url: url.trim(),
          quantity: finalQuantity,
          totalPrice: regularTotal,
          smmServiceId: selectedService.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Wallet checkout failed");
      }

      setOrderId(data.orderId);
      setIsWalletPayment(true);
      setCheckoutStep("success");
      
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", data.orderId);
        localStorage.setItem("last_order_email", user.email || "");
      }
      
      setProfile({ ...profile, balance: data.newBalance });

    } catch (err: any) {
      setError(err.message || "Wallet payment transaction failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-[#121212]/95 border border-slate-800/80 rounded-3xl w-full max-w-4xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-850 rounded-xl z-20 cursor-pointer"
          title="Close Catalog"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="p-6 sm:p-8 border-b border-slate-850 bg-[#161616]/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 p-2 rounded-xl">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ALL <span className="text-[#1DB954]">SERVICES</span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">Direct reseller pricing on 1,100+ services with a 60% ROI markup.</p>
            </div>
          </div>
        </div>

        {/* Modal Content container */}
        <div className="flex-grow overflow-y-auto p-6 sm:p-8">
          {checkoutStep === "catalog" && (
            <div className="space-y-6 h-full flex flex-col">
              {/* Premium Quick Platform Filter Bar */}
              <div className="flex gap-2 overflow-x-auto pb-2.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory touch-pan-x select-none border-b border-slate-800/40 scroll-smooth">
                {PLATFORMS.map((platform) => {
                  const isActive = selectedPlatform === platform.id;
                  return (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPlatform(platform.id)}
                      type="button"
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 whitespace-nowrap snap-start cursor-pointer ${
                        isActive
                           ? "bg-[#1DB954] text-black border-[#1DB954] shadow-[0_0_15px_rgba(29,185,84,0.3)] font-black"
                          : "bg-[#161616]/60 text-slate-400 border-slate-800/85 hover:text-white hover:border-slate-700 hover:bg-[#1a1a1a]"
                      }`}
                    >
                      <span className="text-xs sm:text-sm">{platform.icon}</span>
                      <span>{platform.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Organic & Non-Organic Quality Filter Toggle */}
{qualityFilter && (

                <div className="flex justify-center select-none">
                  <div className="relative flex p-0.5 bg-[#0a0a0a] border border-slate-800/80 rounded-full w-full max-w-[280px] shadow-inner">
                    {/* Sliding indicator */}
                    <div
                      className={`absolute top-0.5 bottom-0.5 rounded-full bg-gradient-to-r transition-all duration-300 ease-out pointer-events-none ${
                        isOrganicFilter
                          ? "left-0.5 w-[48%] from-[#1DB954]/20 to-[#1ed760]/20 border border-[#1DB954]/30"
                          : "left-[51%] w-[48%] from-indigo-500/20 to-purple-500/20 border border-indigo-500/30"
                      }`}
                    ></div>
                    
                    <button
                      onClick={() => setIsOrganicFilter(true)}
                      type="button"
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-full transition-all duration-200 z-10 cursor-pointer flex items-center justify-center gap-1.5 ${
                        isOrganicFilter ? "text-[#1DB954]" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🌿 Organic
                    </button>
                    
                    <button
                      onClick={() => setIsOrganicFilter(false)}
                      type="button"
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-full transition-all duration-200 z-10 cursor-pointer flex items-center justify-center gap-1.5 ${
                        !isOrganicFilter ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🤖 Non-Organic
                    </button>
                  </div>
                </div>
)}


              {/* Premium Interactive New User Discovery Banner */}
              <div className="bg-[#1DB954]/5 border border-[#1DB954]/25 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🔥</span>
                    <span className="text-xs font-black uppercase tracking-wider text-[#1DB954]">New User Quick Guide</span>
                  </div>
                  <p className="text-slate-300 text-[11px] font-semibold leading-snug">
                    Looking for the cheapest options? Click any popular boost below to instantly view our absolute lowest direct reseller pricing:
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                  {[
                    { label: "📸 IG Followers", price: "₱24.98/1k", platform: "instagram", search: "follower" },
                    { label: "📘 FB Followers", price: "₱25.18/1k", platform: "facebook", search: "follower" },
                    { label: "🎵 TikTok Followers", price: "₱30.00/1k", platform: "tiktok", search: "follower" },
                    { label: "🎥 YT Subscribers", price: "₱132.21/1k", platform: "youtube", search: "subscriber" }
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedPlatform(chip.platform);
                        setSearchTerm(chip.search);
                        setSelectedCategory("all");
                        setSortBy("cheapest");
                      }}
                      type="button"
                      className="flex-1 sm:flex-initial flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-[#1DB954]/10 border border-slate-800 hover:border-[#1DB954]/30 text-[10px] font-bold text-white transition-all transform active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      <span>{chip.label}</span>
                      <span className="text-[#1DB954] font-mono">{chip.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col lg:flex-row gap-3 justify-between items-center bg-[#181818]/60 p-4 rounded-2xl border border-slate-800/60 shadow-md w-full">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                      type="text"
                      placeholder="Search from 1,100+ services (e.g. Followers, Views, Likes)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/25 transition-all text-slate-250 font-semibold placeholder-slate-500 text-xs sm:text-sm hover:border-slate-700"
                    />
                  </div>
                  
                  {/* Origin Toggle Segmented Control */}
                  <div className="relative flex p-0.5 bg-[#0a0a0a] border border-slate-800/80 rounded-full w-full sm:w-72 shadow-inner">
                    {/* Sliding indicator */}
                    <div
                      className={`absolute top-0.5 bottom-0.5 rounded-full bg-gradient-to-r transition-all duration-300 ease-out pointer-events-none ${
                        originFilter === "all"
                          ? "left-0.5 w-[32%] from-slate-700/20 to-slate-600/20 border border-slate-600/35"
                          : originFilter === "ph"
                          ? "left-[34%] w-[32%] from-[#1DB954]/20 to-[#1ed760]/20 border border-[#1DB954]/30"
                          : "left-[67.5%] w-[32%] from-indigo-500/20 to-purple-500/20 border border-indigo-500/30"
                      }`}
                    ></div>
                    
                    <button
                      onClick={() => setOriginFilter("all")}
                      type="button"
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-full transition-all duration-200 z-10 cursor-pointer flex items-center justify-center gap-1 ${
                        originFilter === "all" ? "text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🌐 All
                    </button>
                    
                    <button
                      onClick={() => setOriginFilter("ph")}
                      type="button"
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-full transition-all duration-200 z-10 cursor-pointer flex items-center justify-center gap-1 ${
                        originFilter === "ph" ? "text-[#1DB954]" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🇵🇭 PH Base
                    </button>
                    
                    <button
                      onClick={() => setOriginFilter("foreigner")}
                      type="button"
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-full transition-all duration-200 z-10 cursor-pointer flex items-center justify-center gap-1 ${
                        originFilter === "foreigner" ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      👽 Foreigner
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full sm:w-56 px-4 py-2 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/25 text-white font-extrabold cursor-pointer text-xs sm:text-sm transition-all hover:border-slate-700"
                  >
                    <option value="all">
                      {selectedPlatform === "all" ? "All Categories" : `All ${selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}`} ({filteredCategories.length})
                    </option>
                    {filteredCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full sm:w-48 px-4 py-2 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/25 text-[#1DB954] font-extrabold cursor-pointer text-xs sm:text-sm transition-all hover:border-slate-700"
                  >
                    <option value="cheapest">Cheapest First ₱</option>
                    <option value="expensive">Highest Price ₱</option>
                    <option value="alpha">Name (A-Z)</option>
                    <option value="id">Service ID</option>
                  </select>
                </div>
              </div>

              {/* Status alerts */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-xs font-bold uppercase tracking-wide">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* Catalog Body */}
              {loading ? (
                <div className="flex flex-col justify-center items-center py-20 gap-3 flex-grow">
                  <Loader2 size={36} className="text-[#1DB954] animate-spin" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing catalog direct from SMM API...</span>
                </div>
              ) : sortedServices.length === 0 ? (
                <div className="text-center py-16 bg-[#161616]/30 border border-slate-800 border-dashed rounded-2xl flex-grow flex flex-col justify-center">
                  <p className="text-slate-500 font-extrabold uppercase tracking-wider text-sm">No matching SMM services found.</p>
                  <p className="text-xs text-slate-600 mt-1">Try relaxing your search terms or choosing another category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-y-auto max-h-[35vh] sm:max-h-[48vh] pr-1.5 custom-scrollbar">
                  {sortedServices.map((service) => {
                    const vipUnitPrice = getVipPrice(service.startingPrice);
                    const hasServiceVip = vipUnitPrice < service.startingPrice;
                    return (
                    <div 
                      key={service.id}
                      onClick={() => handleSelectService(service)}
                      className="bg-[#181818]/60 hover:bg-[#1f1f1f]/85 border border-slate-800/80 hover:border-[#1DB954]/30 p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group hover:shadow-[0_4px_20px_rgba(29,185,84,0.06)]"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-[9px] bg-slate-850 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono">
                            SMM ID: #{service.id}
                          </span>
                          {hasServiceVip ? (
                            <span className="text-[9px] bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-right leading-tight">
                              <span className="block text-slate-500 line-through">₱{service.startingPrice.toFixed(2)}</span>
                              <span className="block">VIP ₱{vipUnitPrice.toFixed(2)} / pc</span>
                            </span>
                          ) : (
                            <span className="text-[9px] bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              ₱{service.startingPrice.toFixed(2)} / pc
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-white group-hover:text-[#1DB954] transition-colors line-clamp-2 leading-snug">
                          {formatSmmServiceName(service.name, service.id, service.desc)}
                        </h4>
                        
                        {/* Premium Glassmorphic Metadata Badges */}
                        {(() => {
                          const indicators = parseServiceIndicators(service.name, service.desc);
                          return (
                            <div className="flex flex-wrap gap-1.5 mt-2 select-none">
                              <span className="inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 backdrop-blur-sm">
                                {indicators.start}
                              </span>
                              <span className="inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15 backdrop-blur-sm">
                                {indicators.speed}
                              </span>
                              <span className={`inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-sm ${
                                indicators.refill.includes("No Refill")
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15"
                              }`}>
                                {indicators.refill}
                              </span>
                            </div>
                          );
                        })()}

                        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide mt-2.5">
                          Category: {service.category}
                        </p>
                        {service.desc && (
                          <p className="text-[10px] text-slate-400 mt-2 bg-black/20 p-2.5 rounded-xl border border-slate-900/60 line-clamp-2 leading-relaxed">
                            {service.desc}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-slate-850/60 pt-3 mt-4 text-[10px] font-bold text-slate-400">
                        <span>Min/Max: {service.min.toLocaleString()} - {service.max.toLocaleString()}</span>
                        <span className="text-[#1DB954] font-black uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          Order Boost →
                        </span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {checkoutStep === "form" && selectedService && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right-3 duration-300">
              {/* Back Button and Selection Detail */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToCatalog}
                  className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white p-2 rounded-xl transition-all cursor-pointer flex-shrink-0"
                  title="Back to Catalog"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <span className="text-[9px] bg-slate-850 text-slate-400 border border-slate-800 px-2.5 py-0.5 rounded-full font-mono">
                    SMM ID: #{selectedService.id}
                  </span>
                  <h3 className="text-base font-black text-white mt-1 leading-snug">{selectedService.name}</h3>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold uppercase tracking-wide">
                  {error}
                </div>
              )}

              {/* Order Placement Form */}
              <form onSubmit={handleSubmitGcash} className="space-y-4">
                {user ? (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between">
                      <span>Email Profile</span>
                      <span className="text-[#1DB954] text-[8px] font-black uppercase">Active session verified</span>
                    </label>
                    <input 
                      type="email" 
                      required
                      disabled
                      value={email}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#181818] border border-slate-800 text-slate-400 cursor-not-allowed text-xs font-semibold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-white transition-all text-xs font-semibold"
                      placeholder="Enter your email to receive tracking details"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    {getTargetUrlLabel(selectedService.category)}
                  </label>
                  <input 
                    type="url" 
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-white transition-all text-xs font-semibold"
                    placeholder={getTargetUrlPlaceholder(selectedService.category)}
                  />
                  <p className="text-[9px] text-slate-500 mt-1 italic">Please ensure your account/post privacy is set to Public.</p>

                  {url && /^https?:\/\//i.test(url) && (
                    <div className="mt-4 animate-in fade-in duration-300">
                      <LinkPreviewWindow
                        targetUrl={url}
                        serviceTitle={selectedService.name}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      Quantity to Boost
                    </label>
                    <input 
                      type="number" 
                      required
                      min={selectedService.min}
                      max={selectedService.max}
                      value={quantity || ""}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-white transition-all text-xs font-extrabold"
                      placeholder={`Min: ${selectedService.min}`}
                    />
                    <p className="text-[9px] text-slate-500 mt-1">
                      Min: {selectedService.min.toLocaleString()} • Max: {selectedService.max.toLocaleString()}
                    </p>
                    {quantity > 0 && quantity < selectedService.min && (
                      <p className="text-[9px] text-[#1DB954] mt-1 font-bold animate-pulse text-left">
                        💡 Note: Automatically upgraded to minimum {selectedService.min.toLocaleString()} quantity at the minimum rate!
                      </p>
                    )}
                    {isPhBase && (
                      <p className="text-[9px] text-slate-400 mt-1.5 font-semibold text-left">
                        🇵🇭 <strong className="text-white">PH Base Organic Notice:</strong> Sourced with high-retention local accounts. Delivery completes **within 24 hours**.
                      </p>
                    )}
                    <p className="text-[9px] text-[#1DB954] mt-1 font-bold text-left flex items-center gap-1">
                      <span>🔒</span> <span>100% Adsense & Monetization Compliant filtered pool.</span>
                    </p>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="bg-[#181818]/80 px-4 py-2.5 rounded-xl border border-slate-800 flex justify-between items-center min-h-[42px]">
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Estimator cost:</span>
                      {hasVipDiscount ? (
                        <span className="text-right leading-tight">
                          <span className="block text-[10px] font-mono text-slate-500 line-through">Regular ₱{formatPrice(regularTotal)}</span>
                          <span className="block text-sm font-black text-[#1DB954]">VIP ₱{formatPrice(payableTotal)}</span>
                        </span>
                      ) : (
                        <span className="text-sm font-black text-white">₱{formatPrice(regularTotal)} PHP</span>
                      )}
                    </div>
                    {hasVipDiscount && (
                      <p className="mt-1 text-right text-[9px] font-black uppercase tracking-wider text-[#1DB954]">
                        Save ₱{formatPrice(vipTotalSummary.savingsAmount)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mandated GCash Payment Receipt Upload */}
                <div className="space-y-2 bg-[#121212]/95 border border-slate-800/80 p-4 rounded-xl mt-3 text-left">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                    <span>GCash Payment Receipt Screenshot {!(user && profile && Number(profile.balance) >= payableTotal) && <span className="text-red-500">*</span>}</span>
                    <span className="text-[8px] font-black uppercase text-red-500">
                      {user && profile && Number(profile.balance) >= payableTotal ? "Optional for Wallet" : "Strictly Required"}
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="catalog-receipt-upload"
                    />
                    <label 
                      htmlFor="catalog-receipt-upload"
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#181818] border border-dashed border-slate-700 hover:border-[#1DB954]/50 text-slate-300 hover:text-white cursor-pointer transition-all text-xs font-black uppercase tracking-wider active:scale-95"
                    >
                      <span>📁</span> {receiptFile ? `Receipt: ${receiptFile.name}` : "Attach Payment Screenshot"}
                    </label>
                    {receiptFile && (
                      <div className="text-[9px] text-[#1DB954] font-black uppercase tracking-wider text-center mt-1.5 animate-pulse">
                        ✓ File loaded: {(receiptFile.size / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct payment GCash banner */}
                <div className="bg-[#121212]/90 border border-slate-800/80 p-4 rounded-xl space-y-3 mt-4 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block mb-1">
                    📱 GCash Checkout QR Code
                  </span>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                    Pay exactly <strong className="text-white">₱{formatPrice(payableTotal)} PHP</strong> using the GCash QR code. After placing your order, copy your **Tracking ID** and send it along with your transaction receipt to our Support Chatbot for instant approval.
                  </p>
                  {hasVipDiscount && (
                    <div className="rounded-xl border border-[#1DB954]/25 bg-[#1DB954]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#1DB954]">
                      Regular ₱{formatPrice(regularTotal)} {"->"} VIP ₱{formatPrice(payableTotal)}. You save ₱{formatPrice(vipTotalSummary.savingsAmount)}.
                    </div>
                  )}
                  
                  {/* Safety compliance notice under QR scan text to boost purchase intent */}
                  <div className="text-[9px] text-slate-500 font-bold border-t border-slate-850 pt-2 flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>CYNETWORK Curation guarantees 100% compliant, secure delivery matching Adsense criteria.</span>
                  </div>

                  <div className="text-center">
                    <div className="bg-white p-1 rounded-xl inline-block shadow-md max-w-[120px] mx-auto overflow-hidden border border-slate-700/20">
                      <img 
                        src="/gcash-qr.png" 
                        alt="GCash QR Code" 
                        className="w-full h-auto rounded-lg object-contain mx-auto"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2 bg-[#1DB954]/10 border border-[#1DB954]/20 px-3 py-1.5 rounded-lg">
                      <span className="text-[10px] font-black text-[#1DB954] tracking-wider">📞 09505339963 • Henry S.</span>
                      <button type="button" onClick={() => { navigator.clipboard.writeText('09505339963'); }} className="text-[8px] bg-[#1DB954]/20 hover:bg-[#1DB954]/40 text-[#1DB954] font-black uppercase tracking-wider px-2 py-0.5 rounded-md transition-all cursor-pointer active:scale-95">Copy</button>
                    </div>
                  </div>
                </div>

                {/* Submitting Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-850">
                  {user && profile && Number(profile.balance) >= payableTotal && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleWalletCheckout}
                      className="flex-1 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 hover:border-[#1DB954]/50 disabled:opacity-50 text-[#1DB954] font-extrabold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                      <Wallet size={14} /> Pay with Wallet (₱{formatPrice(payableTotal)})
                    </button>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-800 text-black font-extrabold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md"
                  >
                    {isSubmitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Place Boost Order"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {checkoutStep === "success" && (
            <div className="max-w-md mx-auto text-center space-y-5 py-6 animate-in zoom-in duration-300">
              <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 text-[#1DB954] rounded-full flex items-center justify-center mx-auto shadow-md">
                <ShieldCheck size={28} />
              </div>
              
              <div>
                <p className="text-lg font-black text-white">Order Registered Successfully!</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Your boost request has been pre-queued. Please save your Tracking ID:
                </p>
              </div>

              <div className="flex gap-2 items-center w-full">
                <div className="flex-grow bg-slate-900 border border-slate-800 p-3 rounded-xl font-mono text-sm text-[#1DB954] font-black tracking-widest text-center select-all">
                  BS-{orderId.slice(0, 8).toUpperCase()}
                </div>
                <button
                  onClick={handleCopy}
                  type="button"
                  className="bg-slate-850 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                  title="Copy Tracking ID"
                >
                  {copied ? <Check size={16} className="text-[#1DB954]" /> : <Copy size={16} />}
                </button>
              </div>

              {isWalletPayment ? (
                <div className="bg-[#1DB954]/5 border border-[#1DB954]/20 p-4 rounded-xl text-left space-y-2 text-xs font-semibold text-slate-300">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block">
                    ✓ Balance Deducted Successful!
                  </span>
                  <p>
                    We have securely deducted <strong className="text-white">₱{formatPrice(payableTotal)} PHP</strong> from your internal wallet balance.
                  </p>
                  {smmBalance <= 0 ? (
                    <p className="text-[10px] text-[#ff9800] font-bold mt-1.5 leading-relaxed">
                      ⚠️ **Queue Notice:** Due to a high volume of active campaigns, this order is currently queued and will be fully processed and completed within 24 hours.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic mt-1.5">
                      Your receipt is attached and the order is queued for verified processing. You can monitor it from the chatbot or Track Order button.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-left space-y-2.5 text-xs font-semibold text-slate-300">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block">
                    📋 Next Steps for Approval
                  </span>
                  <p>
                    1. Send your **Tracking ID** and **GCash transaction screenshot** to our support chat in the bottom right corner.
                  </p>
                  <p>
                    2. Once the admin confirms the receipt, your order will be approved instantly!
                  </p>
                </div>
              )}

              {isPhBase && (
                <div className="bg-[#1DB954]/10 border border-[#1DB954]/25 p-4 rounded-xl text-left space-y-1.5 text-xs font-semibold text-slate-300 mt-3 animate-in slide-in-from-bottom-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block">
                    🇵🇭 PH Base Organic Delivery Notice
                  </span>
                  <p>
                    This premium package uses authentic, organic local accounts to ensure maximum retention and natural reach. Finding real organic local followers takes time, so processing is scheduled and will be completed **within 24 hours**.
                  </p>
                </div>
              )}

              <button 
                onClick={onClose}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider mt-4 cursor-pointer"
              >
                Return to Website
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
