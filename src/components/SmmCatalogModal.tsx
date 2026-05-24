"use client";

import { useState, useEffect } from "react";
import { X, Search, Loader2, Globe, ArrowLeft, ShieldCheck, Check, Copy, AlertCircle, ShoppingBag, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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
}

export function SmmCatalogModal({ isOpen, onClose }: SmmCatalogModalProps) {
  const [services, setServices] = useState<SmmService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  
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

  // Filter logic
  const filteredServices = services.filter((s) => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
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
      const { data: insertData, error: insertError } = await supabase
        .from("orders")
        .insert([
          {
            service_id: CUSTOM_SMM_SERVICE_ID,
            customer_email: email.trim(),
            target_url: url.trim(),
            amount: calculatedTotal,
            status: "Pending",
            quantity: finalQuantity,
            smm_service_id: selectedService.id
          }
        ])
        .select("id")
        .single();

      if (insertError) throw insertError;

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
          amount: calculatedTotal,
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

  // Wallet deduction checkout
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

    if (Number(profile?.balance || 0) < calculatedTotal) {
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
          totalPrice: calculatedTotal,
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
                SMM <span className="text-[#1DB954]">Catalog Explorer</span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">Direct reseller pricing on 1,100+ services with a 60% ROI markup.</p>
            </div>
          </div>
        </div>

        {/* Modal Content container */}
        <div className="flex-grow overflow-y-auto p-6 sm:p-8">
          {checkoutStep === "catalog" && (
            <div className="space-y-6 h-full flex flex-col">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#181818]/60 p-4 rounded-2xl border border-slate-800/60 shadow-md">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search from 1,100+ services (e.g. Instagram, TikTok, Followers)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 transition-all text-slate-200 font-medium placeholder-slate-500 text-sm"
                  />
                </div>
                
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2 rounded-xl bg-[#090909] border border-slate-800 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-bold cursor-pointer text-sm"
                >
                  <option value="all">All SMM Platforms ({categories.length})</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-16 bg-[#161616]/30 border border-slate-800 border-dashed rounded-2xl flex-grow flex flex-col justify-center">
                  <p className="text-slate-500 font-extrabold uppercase tracking-wider text-sm">No matching SMM services found.</p>
                  <p className="text-xs text-slate-600 mt-1">Try relaxing your search terms or choosing another category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-y-auto max-h-[48vh] pr-1.5 custom-scrollbar">
                  {filteredServices.map((service) => (
                    <div 
                      key={service.id}
                      onClick={() => handleSelectService(service)}
                      className="bg-[#181818]/60 hover:bg-[#1f1f1f]/85 border border-slate-800/80 hover:border-[#1DB954]/30 p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group hover:shadow-[0_4px_20px_rgba(29,185,84,0.06)]"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-[9px] bg-slate-850 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono">
                            ID: #{service.id}
                          </span>
                          <span className="text-[9px] bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            ₱{service.startingPrice.toFixed(2)} / pc
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white group-hover:text-[#1DB954] transition-colors line-clamp-2 leading-snug">
                          {service.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide mt-1.5">
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
                  ))}
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
                    Service ID: #{selectedService.id}
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
                    <div className="bg-[#181818]/80 px-4 py-2.5 rounded-xl border border-slate-800 flex justify-between items-center h-[42px]">
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Estimator cost:</span>
                      <span className="text-sm font-black text-white">₱{formatPrice(calculatedTotal)} PHP</span>
                    </div>
                  </div>
                </div>

                {/* Direct payment GCash banner */}
                <div className="bg-[#121212]/90 border border-slate-800/80 p-4 rounded-xl space-y-3 mt-4 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block mb-1">
                    📱 GCash Checkout QR Code
                  </span>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                    Pay exactly <strong className="text-white">₱{formatPrice(calculatedTotal)} PHP</strong> using the GCash QR code. After placing your order, copy your **Tracking ID** and send it along with your transaction receipt to our Support Chatbot for instant approval.
                  </p>
                  
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
                  </div>
                </div>

                {/* Submitting Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-850">
                  {user && profile && Number(profile.balance) >= calculatedTotal && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleWalletCheckout}
                      className="flex-1 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 hover:border-[#1DB954]/50 disabled:opacity-50 text-[#1DB954] font-extrabold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                      <Wallet size={14} /> Pay with Wallet (₱{formatPrice(calculatedTotal)})
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
                <div className="bg-[#1DB954]/5 border border-[#1DB954]/20 p-4 rounded-xl text-left space-y-2 text-xs font-semibold text-slate-350">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block">
                    ✓ Balance Deducted Successful!
                  </span>
                  <p>
                    We have securely deducted <strong className="text-white">₱{formatPrice(calculatedTotal)} PHP</strong> from your internal wallet balance.
                  </p>
                  {smmBalance <= 0 ? (
                    <p className="text-[10px] text-[#ff9800] font-bold mt-1.5 leading-relaxed">
                      ⚠️ **Queue Notice:** Due to a high volume of active campaigns, this order is currently queued and will be fully processed and completed within 24 hours.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic mt-1.5">
                      Your order is queued in Pending status. Once the administrator reviews the order details, delivery will initiate automatically!
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-left space-y-2.5 text-xs font-semibold text-slate-350">
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
                <div className="bg-[#1DB954]/10 border border-[#1DB954]/25 p-4 rounded-xl text-left space-y-1.5 text-xs font-semibold text-slate-350 mt-3 animate-in slide-in-from-bottom-2">
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
