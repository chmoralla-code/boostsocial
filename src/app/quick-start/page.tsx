"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ArrowRight, Check, Eye, HelpCircle, AlertCircle, ShoppingBag, ShieldCheck, Mail, Lock, UserPlus, Image, PlusCircle, CheckCircle, Search, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatSmmServiceName } from "@/utils/serviceHelpers";
import { compressImage } from "@/utils/imageCompressor";

const PLATFORMS = [
  { id: "facebook", name: "Facebook", icon: "📘", color: "#1877F2", glow: "rgba(24, 119, 242, 0.45)" },
  { id: "instagram", name: "Instagram", icon: "📸", color: "#E1306C", glow: "rgba(225, 48, 108, 0.45)" },
  { id: "tiktok", name: "TikTok", icon: "🎵", color: "#00F2FE", glow: "rgba(0, 242, 254, 0.45)" },
  { id: "youtube", name: "YouTube", icon: "🎥", color: "#FF0000", glow: "rgba(255, 0, 0, 0.45)" }
];

export default function QuickStartPage() {
  const router = useRouter();
  const supabase = createClient();

  // Wizard Flow Step State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 states (Auth)
  const [authTab, setAuthTab] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // Step 2 states (Service Selection)
  const [selectedPlatform, setSelectedPlatform] = useState<string>("facebook");
  const [services, setServices] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Step 3 states (Order details & GCash receipt)
  const [targetUrl, setTargetUrl] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [orderId, setOrderId] = useState("");

  // Check auth session
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        setEmail(data.user.email || "");
        supabase.from("profiles").select("*").eq("id", data.user.id).single().then(({ data: pData }) => {
          if (pData) setProfile(pData);
        });
        // Auto advance to Step 2 if user already authenticated
        if (step === 1) {
          setStep(2);
        }
      }
    });
  }, []);

  // Fetch reseller services when selectedPlatform changes
  useEffect(() => {
    if (step === 2) {
      setCatalogLoading(true);
      setError("");
      fetch("/api/smm/services")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load catalog");
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            // Filter SMM reseller catalog matches selected platform
            const platFilter = selectedPlatform.toLowerCase();
            const filtered = data.filter((s: any) => {
              const nameLower = s.name.toLowerCase();
              const categoryLower = s.category.toLowerCase();
              return nameLower.includes(platFilter) || categoryLower.includes(platFilter);
            });
            setServices(filtered);
          } else {
            throw new Error("Invalid response format");
          }
        })
        .catch((err) => {
          setError("Failed to fetch available direct reseller services. Please try again.");
          console.error(err);
        })
        .finally(() => {
          setCatalogLoading(false);
        });
    }
  }, [step, selectedPlatform]);

  useEffect(() => {
    if (selectedService) {
      setQuantity(selectedService.min);
    }
  }, [selectedService]);

  // Auth Handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      if (authTab === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });
        if (signUpError) throw signUpError;
        if (data.user) {
          setUser(data.user);
          alert("Account created successfully! Check your email to verify if needed, or proceed to the next step.");
          // Fetch created profile
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (pData) setProfile(pData);
          setStep(2);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (signInError) throw signInError;
        if (data.user) {
          setUser(data.user);
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (pData) setProfile(pData);
          setStep(2);
        }
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  // Order placing submit
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !user) return;

    if (!receiptFile) {
      setError("Please attach your GCash transaction receipt screenshot first.");
      return;
    }

    if (quantity < selectedService.min) {
      setError(`Quantity cannot be less than minimum ${selectedService.min.toLocaleString()}.`);
      return;
    }
    if (quantity > selectedService.max) {
      setError(`Quantity cannot exceed maximum ${selectedService.max.toLocaleString()}.`);
      return;
    }
    if (!targetUrl.trim()) {
      setError("Please enter your target URL link.");
      return;
    }

    setLoading(true);
    setError("");

    const calculatedTotal = quantity * selectedService.startingPrice;
    const CUSTOM_SMM_SERVICE_ID = "e6f61249-71fe-40df-84f3-96d03d3e8dcf";

    try {
      // 1. Insert order
      const { data: insertData, error: insertError } = await supabase
        .from("orders")
        .insert([
          {
            service_id: CUSTOM_SMM_SERVICE_ID,
            customer_email: user.email,
            target_url: targetUrl.trim(),
            amount: calculatedTotal,
            status: "Pending",
            quantity: quantity,
            smm_service_id: selectedService.id
          }
        ])
        .select("id")
        .single();

      if (insertError) throw insertError;

      // 2. Compress and upload GCash receipt screenshot
      try {
        const compressed = await compressImage(receiptFile);
        const receiptFormData = new FormData();
        receiptFormData.append("file", compressed);
        receiptFormData.append("orderId", insertData.id);

        const uploadRes = await fetch("/api/upload-receipt", {
          method: "POST",
          body: receiptFormData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "Receipt upload request failed.");
        }
      } catch (uploadReceiptErr: any) {
        console.error("Receipt upload failed:", uploadReceiptErr);
        throw new Error(uploadReceiptErr.message || "Failed to upload payment receipt screenshot.");
      }

      setOrderId(insertData.id);

      // 3. Fire Telegram notification (non-blocking)
      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingId: `BS-${insertData.id.slice(0, 8).toUpperCase()}`,
          service: `[SMM #${selectedService.id}] ${selectedService.name}`,
          email: user.email,
          quantity: quantity,
          amount: calculatedTotal,
          paymentMethod: "📱 GCash",
          details: targetUrl.trim(),
        }),
      }).catch(() => {});

      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", insertData.id);
        localStorage.setItem("last_order_email", user.email || "");
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message || "Something went wrong while placing order.");
    } finally {
      setLoading(false);
    }
  };

  const calculatedCost = selectedService ? quantity * selectedService.startingPrice : 0;

  // SMM service lists matched search term
  const searchedServices = services.filter((s) => {
    const nameLower = s.name.toLowerCase();
    const idLower = s.id.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return nameLower.includes(searchLower) || idLower.includes(searchLower);
  });

  return (
    <main className="flex-grow flex flex-col items-center pt-10 sm:pt-20 bg-[#0a0a0a] min-h-screen text-slate-300 relative overflow-hidden">
      {/* Dynamic tech glow backdrops */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-30%] left-[10%] w-[500px] h-[500px] rounded-full fb-glow-blob opacity-30"></div>
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full spotify-glow-blob opacity-30"></div>
      </div>

      <div className="max-w-3xl w-full mx-auto px-4 z-10 space-y-8 pb-20">
        
        {/* Header Title */}
        <div className="text-center space-y-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 text-[10px] font-black uppercase tracking-widest animate-pulse">
            ✨ Quick Start Guide
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-tight">
            Launch Your <span className="text-[#1DB954]">Boost Campaign</span>
          </h1>
          <p className="text-slate-400 text-xs font-semibold max-w-md mx-auto leading-relaxed">
            Fast, secure direct reseller-rate boosting packages. Set up your campaign in 4 easy steps.
          </p>
        </div>

        {/* Dynamic Multi-Step Stepper Bar */}
        <div className="relative flex justify-between items-center max-w-lg mx-auto select-none bg-[#121212]/90 border border-slate-800/80 p-4.5 rounded-full shadow-lg">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[1px] bg-slate-800 z-0"></div>
          <div 
            className="absolute left-6 top-1/2 -translate-y-1/2 h-[1.5px] bg-[#1DB954] z-0 transition-all duration-300 ease-out"
            style={{ width: `${((step - 1) / 3) * 88}%` }}
          ></div>

          {[
            { num: 1, label: "Account Setup" },
            { num: 2, label: "Pick Boost" },
            { num: 3, label: "Checkout Details" },
            { num: 4, label: "Launch & Track" }
          ].map((st) => (
            <div key={st.num} className="relative z-10 flex flex-col items-center space-y-1.5">
              <div 
                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border transition-all duration-350 ${
                  step > st.num ? "bg-[#1DB954] border-[#1DB954] text-black" :
                  step === st.num ? "bg-[#0a0a0a] border-[#1DB954] text-[#1DB954] shadow-[0_0_12px_rgba(29,185,84,0.35)]" :
                  "bg-[#121212] border-slate-800 text-slate-500"
                }`}
              >
                {step > st.num ? <Check size={14} strokeWidth={3} /> : st.num}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider hidden sm:block ${step >= st.num ? 'text-white' : 'text-slate-500'}`}>
                {st.label}
              </span>
            </div>
          ))}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-xs font-bold text-red-400 uppercase tracking-wide max-w-xl mx-auto shadow-md">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* STEP 1: Strict User Setup / Register */}
        {step === 1 && (
          <div className="max-w-md mx-auto bg-[#121212]/95 border border-slate-800/85 p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/5 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="flex border-b border-slate-850/60 pb-1 mb-6 select-none">
              <button
                type="button"
                onClick={() => setAuthTab("register")}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-colors cursor-pointer ${
                  authTab === "register" ? "text-[#1DB954] border-b-2 border-[#1DB954]" : "text-slate-550 hover:text-slate-300"
                }`}
              >
                Register Account
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("login")}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-colors cursor-pointer ${
                  authTab === "login" ? "text-[#1DB954] border-b-2 border-[#1DB954]" : "text-slate-550 hover:text-slate-300"
                }`}
              >
                Sign In
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-550" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 text-xs font-semibold text-white placeholder-slate-650 transition-all"
                    placeholder="Enter your email address"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-550" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 text-xs font-semibold text-white placeholder-slate-650 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-600 text-black font-black py-3 rounded-xl transition-all duration-200 uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10 mt-2 active:scale-[0.98]"
              >
                {loading ? <Loader2 size={14} className="animate-spin text-black" /> : <UserPlus size={14} />}
                {authTab === "register" ? "Create Account & Proceed" : "Sign In & Proceed"}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Pick Platform and SMM Reseller Boost */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-6 duration-300">
            {/* Pick platform tab chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
              {PLATFORMS.map((plat) => {
                const isActive = selectedPlatform === plat.id;
                return (
                  <button
                    key={plat.id}
                    onClick={() => {
                      setSelectedPlatform(plat.id);
                      setSelectedService(null);
                    }}
                    type="button"
                    style={{
                      borderColor: isActive ? plat.color : "rgba(255,255,255,0.04)",
                      boxShadow: isActive ? `0 0 15px ${plat.glow}` : "none"
                    }}
                    className={`p-4 rounded-2xl border flex items-center gap-3 transition-all duration-300 transform active:scale-95 cursor-pointer text-left ${
                      isActive ? "bg-black text-white" : "bg-[#121212]/50 hover:bg-[#161616] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-2xl">{plat.icon}</span>
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Platform</span>
                      <span className="text-sm font-black tracking-tight block mt-0.5">{plat.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Catalog search bar and results listing container */}
            <div className="bg-[#121212]/95 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col space-y-6">
              
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="text-left">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Available {selectedPlatform} Services</h3>
                  <p className="text-slate-500 text-[10px] font-bold">Synchronized live at direct reseller prices.</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input
                    type="text"
                    placeholder="Search package (e.g. Followers)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] text-xs font-semibold text-white placeholder-slate-650"
                  />
                </div>
              </div>

              {catalogLoading ? (
                <div className="flex flex-col justify-center items-center py-16 gap-3">
                  <Loader2 size={32} className="text-[#1DB954] animate-spin" />
                  <span className="text-xs font-bold text-slate-550 uppercase tracking-widest animate-pulse">Syncing services...</span>
                </div>
              ) : searchedServices.length === 0 ? (
                <div className="text-center py-12 border border-slate-850 border-dashed rounded-2xl">
                  <p className="text-slate-500 font-extrabold uppercase tracking-wide text-xs">No available services found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 overflow-y-auto max-h-[36vh] pr-1 custom-scrollbar">
                  {searchedServices.map((srv) => {
                    const isSelected = selectedService?.id === srv.id;
                    return (
                      <div
                        key={srv.id}
                        onClick={() => setSelectedService(srv)}
                        className={`bg-[#181818]/50 hover:bg-[#1a1a1a] border p-4.5 rounded-2xl cursor-pointer text-left transition-all duration-300 flex flex-col justify-between group transform ${
                          isSelected 
                            ? "border-[#1DB954]/55 bg-[#1DB954]/5 shadow-[0_0_15px_rgba(29,185,84,0.06)]"
                            : "border-slate-850 hover:border-slate-700/60"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="text-[8px] bg-slate-850 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono">
                              ID: #{srv.id}
                            </span>
                            <span className="text-[9px] bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/15 px-2 py-0.5 rounded-full font-extrabold">
                              ₱{srv.startingPrice.toFixed(2)} / pc
                            </span>
                          </div>

                          <h4 className="text-xs font-extrabold text-white group-hover:text-[#1DB954] transition-colors leading-snug line-clamp-2">
                            {formatSmmServiceName(srv.name, srv.id, srv.desc)}
                          </h4>
                          {srv.desc && (
                            <p className="text-[9px] text-slate-400 mt-2 line-clamp-2 bg-black/20 p-2 rounded-lg leading-normal">
                              {srv.desc}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-850/50 pt-2.5 mt-3 text-[9px] text-slate-500 font-bold">
                          <span>Min: {srv.min.toLocaleString()} • Max: {srv.max.toLocaleString()}</span>
                          {isSelected && <span className="text-[#1DB954] font-black uppercase flex items-center gap-0.5">Selected ✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step Navigation */}
              <div className="flex justify-end pt-4 border-t border-slate-850/60 select-none">
                <button
                  type="button"
                  disabled={!selectedService}
                  onClick={() => setStep(3)}
                  className="bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-600 text-black font-black px-6 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  Configure Details <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* STEP 3: Order details & mandatory GCash receipt uploader */}
        {step === 3 && selectedService && (
          <div className="max-w-xl mx-auto bg-[#121212]/95 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in slide-in-from-right-6 duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#1ed760]/5 rounded-full blur-xl pointer-events-none"></div>

            <div className="flex items-center gap-3 border-b border-slate-850/60 pb-4 mb-6">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setError("");
                }}
                className="bg-[#181818] border border-slate-800/60 hover:bg-slate-800 text-slate-400 p-2 rounded-xl transition-all cursor-pointer flex-shrink-0"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="text-left min-w-0">
                <span className="text-[8px] bg-slate-850 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono">
                  SMM ID: #{selectedService.id}
                </span>
                <h3 className="text-sm font-black text-white mt-1 truncate" title={selectedService.name}>{selectedService.name}</h3>
              </div>
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4 text-left">
              
              {/* Account verified check */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Profile Email</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#181818] border border-slate-850 text-slate-500 cursor-not-allowed text-xs font-semibold"
                />
              </div>

              {/* Target Link Input */}
              <div>
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-widest mb-1.5">Target Channel / Post Link URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-xs font-semibold text-white transition-all placeholder-slate-600"
                  placeholder="https://facebook.com/your-target-url"
                />
                <p className="text-[9px] text-slate-500 mt-1 italic font-semibold">Verify page or post is set to Public.</p>
              </div>

              {/* Quantity Selector input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-450 uppercase tracking-widest mb-1.5">Quantity to Boost <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min={selectedService.min}
                    max={selectedService.max}
                    value={quantity || ""}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-xs font-black text-white transition-all placeholder-slate-700"
                    placeholder={`Min: ${selectedService.min}`}
                  />
                  <p className="text-[9px] text-slate-500 mt-1 font-semibold">
                    Min: {selectedService.min.toLocaleString()} • Max: {selectedService.max.toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="bg-[#0a0a0a]/90 px-4 py-2.5 rounded-xl border border-slate-850 flex justify-between items-center h-[38px]">
                    <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-wider">Estimated Price:</span>
                    <span className="text-xs font-black text-white">₱{calculatedCost.toFixed(2)} PHP</span>
                  </div>
                </div>
              </div>

              {/* GCash Payment Instructions & Scan QR */}
              <div className="bg-[#0a0a0a]/60 border border-slate-850 p-4 rounded-2xl text-left space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block mb-1">
                  📱 Step 1: Scan GCash QR Code to Pay ₱{calculatedCost.toFixed(2)}
                </span>
                
                <div className="text-center">
                  <div className="bg-white p-1 rounded-xl inline-block shadow-md max-w-[110px] mx-auto overflow-hidden border border-slate-700/20">
                    <img 
                      src="/gcash-qr.png" 
                      alt="GCash QR Code" 
                      className="w-full h-auto rounded-lg object-contain mx-auto"
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold mt-1.5">Account Curation Name: HE***Y S.</p>
                </div>
              </div>

              {/* Strict Payment Receipt Screenshot upload input */}
              <div className="space-y-2 bg-[#0a0a0a] border border-slate-850 p-4.5 rounded-2xl text-left">
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-widest flex justify-between items-center">
                  <span>📱 Step 2: Upload Payment Receipt <span className="text-red-500">*</span></span>
                  <span className="text-[8px] font-black uppercase text-red-500 animate-pulse">Strictly Required</span>
                </label>
                
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="funnel-receipt-upload"
                  />
                  <label
                    htmlFor="funnel-receipt-upload"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#121212] border border-dashed border-slate-700 hover:border-[#1DB954]/50 text-slate-350 hover:text-white cursor-pointer transition-all text-xs font-black uppercase tracking-wider active:scale-95 text-center"
                  >
                    <span>📁</span> {receiptFile ? `Receipt Attached: ${receiptFile.name}` : "Attach GCash Receipt Screenshot"}
                  </label>
                  {receiptFile && (
                    <div className="text-[9px] text-[#1DB954] font-black uppercase tracking-wider text-center mt-1.5 animate-pulse">
                      ✓ File loaded: {(receiptFile.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Checkout Trigger */}
              <button
                type="submit"
                disabled={loading || !receiptFile}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-600 text-black font-black py-3.5 rounded-xl transition-all duration-200 uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10 active:scale-[0.98] mt-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin text-black" /> : <ShieldCheck size={14} />}
                {loading ? "Registering order & uploading..." : "Submit Campaign Order"}
              </button>

            </form>
          </div>
        )}

        {/* STEP 4: Success & Live tracking guidelines */}
        {step === 4 && (
          <div className="max-w-md mx-auto bg-[#121212]/95 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300">
            <div className="w-14 h-14 bg-green-500/10 border border-green-500/25 text-[#1DB954] rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
              <ShieldCheck size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Campaign pre-queued!</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                Your order is registered successfully. Please copy your campaign Tracking ID:
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl font-mono text-sm sm:text-base text-[#1DB954] font-black tracking-widest text-center select-all">
              BS-{orderId.slice(0, 8).toUpperCase()}
            </div>

            <div className="bg-slate-900/60 border border-slate-850 p-4.5 rounded-2xl text-left space-y-2.5 text-xs text-slate-350 leading-relaxed font-semibold">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block mb-1">
                ⚙️ Real-time Order Tracking Guide
              </span>
              <p>
                1. You can track your pending campaign's status directly in the **Support Chatbot** located at the bottom-right corner of our site.
              </p>
              <p>
                2. Simply paste your **Tracking ID** into the chatbot to instantly query live delivery progress!
              </p>
              <p>
                3. You can also view and track all your pending and active orders by clicking the **Track Order** button in the top navigation bar.
              </p>
            </div>

            <button
              onClick={() => router.push("/")}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider cursor-pointer active:scale-95"
            >
              Return to Website homepage
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
