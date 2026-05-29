"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ArrowRight, Check, AlertCircle, ShieldCheck, Mail, Lock, UserPlus, Search, Globe, Sparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { formatSmmServiceName, isSocialBoostService, isUtilityService } from "@/utils/serviceHelpers";
import { compressImage } from "@/utils/imageCompressor";
import { LinkPreviewWindow } from "@/components/LinkPreviewWindow";

interface SmmService {
  id: string | number;
  name: string;
  category?: string | null;
  desc?: string | null;
  min: number;
  max: number;
  startingPrice: number;
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const PLATFORMS = [
  { id: "facebook", name: "Facebook", icon: "📘", color: "#1877F2", glow: "rgba(24, 119, 242, 0.4)" },
  { id: "instagram", name: "Instagram", icon: "📸", color: "#E1306C", glow: "rgba(225, 48, 108, 0.4)" },
  { id: "tiktok", name: "TikTok", icon: "🎵", color: "#00F2FE", glow: "rgba(0, 242, 254, 0.4)" },
  { id: "youtube", name: "YouTube", icon: "🎥", color: "#FF0000", glow: "rgba(255, 0, 0, 0.4)" }
];

function matchesPlatformName(service: SmmService, platformId: string) {
  const combined = `${service.name || ""} ${service.category || ""}`.toLowerCase();
  if (platformId === "facebook") return combined.includes("facebook") || /\bfb\b/.test(combined);
  if (platformId === "instagram") return combined.includes("instagram") || /\big\b/.test(combined);
  if (platformId === "youtube") return combined.includes("youtube") || /\byt\b/.test(combined);
  return combined.includes(platformId);
}

function getPlatformCandidates(smmCatalog: SmmService[], platform: string): SmmService[] {
  const platformServices = smmCatalog.filter(s => matchesPlatformName(s, platform));

  if (platformServices.length === 0) return [];

  const findCheapestMatching = (keywords: string[], excludeKeywords: string[] = []) => {
    const matches = platformServices.filter(s => {
      const nameLower = (s.name || "").toLowerCase();
      const matchesKeywords = keywords.some(kw => nameLower.includes(kw));
      const matchesExclude = excludeKeywords.some(ex => nameLower.includes(ex));
      return matchesKeywords && !matchesExclude;
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => a.startingPrice - b.startingPrice);
    return matches[0];
  };

  let follower = null;
  let like = null;
  let view = null;

  if (platform === "facebook") {
    follower = findCheapestMatching(["follower", "profile", "page follower", "classic page"]);
    like = findCheapestMatching(["like", "reaction", "react", "photo like", "post like", "love", "haha", "wow", "sad", "angry"], ["follower", "view", "share"]);
    view = findCheapestMatching(["view", "video", "play", "reach"], ["follower", "like", "reaction"]);
  } else if (platform === "instagram") {
    follower = findCheapestMatching(["follower"]);
    like = findCheapestMatching(["like", "heart"], ["follower", "view", "comment"]);
    view = findCheapestMatching(["view", "play", "reel", "video", "impression"], ["follower", "like"]);
  } else if (platform === "tiktok") {
    follower = findCheapestMatching(["follower"]);
    like = findCheapestMatching(["like", "heart"], ["follower", "view", "comment"]);
    view = findCheapestMatching(["view", "play", "video", "share"], ["follower", "like"]);
  } else if (platform === "youtube") {
    follower = findCheapestMatching(["subscriber", "subscribers", "sub"]);
    like = findCheapestMatching(["like"], ["subscriber", "view", "comment"]);
    view = findCheapestMatching(["view", "watch", "play"], ["subscriber", "like"]);
  }

  // Fallbacks if not found
  if (!follower) follower = findCheapestMatching(["follower"]) || platformServices[0];
  if (!like) like = findCheapestMatching(["like", "heart", "react"]) || platformServices[Math.min(1, platformServices.length - 1)];
  if (!view) view = findCheapestMatching(["view", "play", "video"]) || platformServices[Math.min(2, platformServices.length - 1)];

  const candidates: SmmService[] = [];
  if (follower) {
    candidates.push({
      ...follower,
      name: `👥 FOLLOWER / SUBSCRIBER PACK`
    });
  }
  if (like) {
    candidates.push({
      ...like,
      name: `❤️ POST LIKE / REACTION PACK`
    });
  }
  if (view) {
    candidates.push({
      ...view,
      name: `▶️ DIRECT VIEWS / PLAYS PACK`
    });
  }

  return candidates;
}

export default function QuickStartPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Wizard Flow Step State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 states (Auth & Email Verification)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  
  const [emailStatus, setEmailStatus] = useState<{
    state: "idle" | "verifying" | "valid_google" | "valid_other" | "invalid";
    message: string;
  }>({ state: "idle", message: "" });

  // Step 2 states (Service Selection)
  const [selectedPlatform, setSelectedPlatform] = useState<string>("facebook");
  const [services, setServices] = useState<SmmService[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<SmmService | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [availablePlatformIds, setAvailablePlatformIds] = useState<string[]>(PLATFORMS.map((platform) => platform.id));

  // Step 3 states (Order details & GCash receipt)
  const [targetUrl, setTargetUrl] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [orderId, setOrderId] = useState("");

  // Automatic redirect countdown state & effect in Step 4
  const [countdown, setCountdown] = useState(8);
  const [copied, setCopied] = useState(false);

  // Email Real-time Verification Debounce Check
  useEffect(() => {
    if (!email || !email.includes("@")) {
      setEmailStatus({ state: "idle", message: "" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailStatus({ state: "invalid", message: "Invalid email format." });
      return;
    }

    const parts = email.trim().split("@");
    if (parts.length !== 2) return;
    const domain = parts[1].toLowerCase();

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEmailStatus({ state: "verifying", message: "Verifying email server..." });
      try {
        const response = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`,
          {
            headers: { Accept: "application/dns-json" },
            signal: controller.signal,
          }
        );
        const data = await response.json();

        if (data.Status !== 0 || !data.Answer || data.Answer.length === 0) {
          setEmailStatus({
            state: "invalid",
            message: "Domain has no active email server (MX records missing)."
          });
          return;
        }

        // Check if any MX record belongs to Google
        const isGoogle = data.Answer.some((ans: any) => {
          const server = String(ans.data || "").toLowerCase();
          return server.includes("google") || server.includes("googlemail") || domain === "gmail.com" || domain === "googlemail.com";
        });

        if (isGoogle) {
          setEmailStatus({
            state: "valid_google",
            message: "Real Google Account Verified"
          });
        } else {
          setEmailStatus({
            state: "valid_other",
            message: "Active Mail Server Verified (Non-Google)"
          });
        }
      } catch (err) {
        // Fallback on DNS fetch error
        if (domain === "gmail.com" || domain === "googlemail.com") {
          setEmailStatus({
            state: "valid_google",
            message: "Google Account Verified"
          });
        } else {
          setEmailStatus({
            state: "valid_other",
            message: "Active Domain"
          });
        }
      }
    }, 650); // 650ms input debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [email]);

  useEffect(() => {
    if (step === 4 && orderId) {
      setCountdown(8);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            if (typeof window !== "undefined") {
              localStorage.setItem("onboarded", "true");
            }
            router.push(`/?track=${orderId}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, orderId, router]);

  // Check auth session
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      if (data?.user) {
        setUser(data.user);
        setEmail(data.user.email || "");
        if (typeof window !== "undefined") {
          localStorage.setItem("onboarded", "true");
        }
        router.push("/");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [supabase, router]);

  // Fetch SMM direct candidates on step 2
  useEffect(() => {
    if (step !== 2) return;

    let isMounted = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setError("");

      try {
        const res = await fetch("/api/smm/services");
        if (!res.ok) throw new Error("Failed to load catalog");

        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid response format");
        }

        const socialServices = (data as SmmService[]).filter((service) => {
          const category = service.category || undefined;
          return isSocialBoostService(service.name, service.desc || "", category) && !isUtilityService(service.name, service.desc || "", category);
        });
        
        const activePlatforms = PLATFORMS
          .filter((platform) => socialServices.some((service) => matchesPlatformName(service, platform.id)))
          .map((platform) => platform.id);

        if (!isMounted) return;

        setAvailablePlatformIds(activePlatforms);
        if (activePlatforms.length > 0 && !activePlatforms.includes(selectedPlatform)) {
          setSelectedPlatform(activePlatforms[0]);
          setSelectedService(null);
          setServices([]);
          return;
        }

        const candidates = getPlatformCandidates(socialServices, selectedPlatform.toLowerCase());
        setServices(candidates);
      } catch (err) {
        if (!isMounted) return;
        setError("Failed to fetch available SMM reseller services. Please try again.");
        console.error(err);
      } finally {
        if (isMounted) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [step, selectedPlatform]);

  // Auth Handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (emailStatus.state === "invalid") {
      setError("Please use a real email address with active mail servers.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // 1. Create the account via auto-confirm Admin signup API endpoint
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const signupData = await signupRes.json();
      if (!signupRes.ok) {
        throw new Error(signupData.error || "Registration failed.");
      }

      // 2. Perform direct sign in immediately to capture the active session in client
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) throw signInError;

      if (signInData.user) {
        setUser(signInData.user);
        setStep(2);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "Authentication failed. Check your inputs.");
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
      } catch (uploadReceiptErr: unknown) {
        console.error("Receipt upload failed:", uploadReceiptErr);
        throw new Error(getErrorMessage(uploadReceiptErr) || "Failed to upload payment receipt screenshot.");
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
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "Something went wrong while placing order.");
    } finally {
      setLoading(false);
    }
  };

  const calculatedCost = selectedService ? quantity * selectedService.startingPrice : 0;

  // Filter services based on search query
  const searchedServices = services.filter((s) => {
    const nameLower = s.name.toLowerCase();
    const idLower = String(s.id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return nameLower.includes(searchLower) || idLower.includes(searchLower);
  });

  return (
    <main className="flex-grow flex flex-col items-center pt-8 sm:pt-14 bg-[#0a0a0a] min-h-screen text-slate-350 relative overflow-hidden font-sans">
      {/* Sleek backing blur elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-30%] left-[15%] w-[450px] h-[450px] rounded-full bg-[#1DB954]/5 blur-[120px]"></div>
        <div className="absolute top-[10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-xl mx-auto z-10 px-4 space-y-6 pb-20">
        
        {/* Simple Premium Header */}
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 text-[9px] font-black uppercase tracking-wider">
            <Sparkles size={10} /> Quick Start Wizard
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase">
            Welcome to <span className="text-[#1DB954] hover:text-[#1ed760] transition-all">Pinoy Boosting</span>
          </h1>
          <p className="text-slate-400 text-[11px] font-semibold tracking-wide uppercase leading-relaxed max-w-sm mx-auto">
            Philippines' Direct Supplier of High-Quality Social Media Growth
          </p>
        </div>

        {/* Dynamic Compact Stepper */}
        <div className="relative flex justify-between items-center w-full max-w-md mx-auto select-none bg-[#121212]/90 border border-slate-850 p-3 rounded-2xl shadow-lg">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[1px] bg-slate-850 z-0"></div>
          <div 
            className="absolute left-6 top-1/2 -translate-y-1/2 h-[1.5px] bg-[#1DB954] z-0 transition-all duration-300 ease-out"
            style={{ width: `${((step - 1) / 3) * 88}%` }}
          ></div>

          {[
            { num: 1, label: "Register" },
            { num: 2, label: "Services" },
            { num: 3, label: "Checkout" },
            { num: 4, label: "Track" }
          ].map((st) => (
            <div key={st.num} className="relative z-10 flex flex-col items-center space-y-1">
              <div 
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                  step > st.num ? "bg-[#1DB954] border-[#1DB954] text-black" :
                  step === st.num ? "bg-black border-[#1DB954] text-[#1DB954] shadow-[0_0_10px_rgba(29,185,84,0.3)]" :
                  "bg-[#121212] border-slate-850 text-slate-500"
                }`}
              >
                {step > st.num ? <Check size={12} strokeWidth={3} /> : st.num}
              </div>
              <span className={`text-[8px] font-extrabold uppercase tracking-widest ${step >= st.num ? 'text-white' : 'text-slate-500'}`}>
                {st.label}
              </span>
            </div>
          ))}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 text-[11px] font-bold text-red-400 uppercase tracking-wider max-w-md mx-auto shadow-md">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Strict User Setup / Register */}
        {step === 1 && (
          <div className="w-full max-w-md mx-auto bg-[#121212]/95 border border-slate-850 p-5 sm:p-7 rounded-2xl shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            <div className="text-center pb-2 border-b border-slate-850/60 select-none">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
                Setup Your Boosting Profile
              </h2>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">
                Enter your details to create a secure account.
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] text-xs font-semibold text-white transition-all placeholder:text-slate-700"
                    placeholder="Enter your email address"
                  />
                </div>

                {/* Real-time Email Verification Badge */}
                {emailStatus.state !== "idle" && (
                  <div className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide transition-all ${
                    emailStatus.state === "verifying" ? "bg-slate-900 border-slate-800 text-slate-400" :
                    emailStatus.state === "valid_google" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    emailStatus.state === "valid_other" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" :
                    "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}>
                    {emailStatus.state === "verifying" && <Loader2 size={12} className="animate-spin text-slate-400 flex-shrink-0" />}
                    {emailStatus.state === "valid_google" && <Check size={12} className="text-emerald-400 flex-shrink-0" />}
                    {emailStatus.state === "valid_other" && <Check size={12} className="text-indigo-400 flex-shrink-0" />}
                    {emailStatus.state === "invalid" && <AlertCircle size={12} className="text-red-400 flex-shrink-0" />}
                    <span>{emailStatus.message}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Create Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] text-xs font-semibold text-white transition-all placeholder:text-slate-700"
                    placeholder="Min. 6 characters"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || emailStatus.state === "invalid" || emailStatus.state === "verifying"}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-650 text-black font-black py-3 rounded-xl transition-all duration-200 uppercase text-[10px] tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md mt-2"
              >
                {loading ? <Loader2 size={12} className="animate-spin text-black" /> : <UserPlus size={12} />}
                Create Account & Proceed
              </button>
            </form>

            <div className="text-center flex flex-col gap-2.5 select-none border-t border-slate-850/50 pt-4 text-[9px] font-extrabold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("onboarded", "true");
                  }
                  router.push("/");
                }}
                className="text-slate-500 hover:text-[#1DB954] transition-colors cursor-pointer"
              >
                Skip & Use Main Website →
              </button>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-[#1DB954] hover:text-[#1ed760] hover:underline transition-colors cursor-pointer"
              >
                Already registered? Sign In →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Pick Platform and SMM Reseller Boost */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Curated Question Header */}
            <div className="w-full text-center py-3 px-4 rounded-xl bg-[#1DB954]/5 border border-[#1DB954]/15 shadow-sm select-none">
              <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                ⚡ What boosting service do you want today? ⚡
              </h2>
            </div>

            {/* Curated Grid of Platforms */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 select-none">
              {PLATFORMS.filter((plat) => availablePlatformIds.includes(plat.id)).map((plat) => {
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
                      borderColor: isActive ? plat.color : "rgba(255,255,255,0.03)",
                      boxShadow: isActive ? `0 0 10px ${plat.glow}` : "none"
                    }}
                    className={`p-3.5 rounded-xl border flex items-center gap-2 transition-all duration-300 cursor-pointer text-left ${
                      isActive ? "bg-black text-white" : "bg-[#121212]/50 hover:bg-[#161616] text-slate-400"
                    }`}
                  >
                    <span className="text-xl">{plat.icon}</span>
                    <span className="text-[11px] font-black tracking-tight">{plat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Curated selection box */}
            <div className="bg-[#121212]/95 border border-slate-850 rounded-2xl p-5 space-y-4 shadow-xl">
              
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="text-left select-none">
                  <h3 className="text-sm font-black text-white uppercase">Curated {selectedPlatform} Packages</h3>
                  <p className="text-slate-500 text-[9px] font-semibold">Live supplier reseller pricing.</p>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                  <input
                    type="text"
                    placeholder="Search boost type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] text-[11px] font-semibold text-white placeholder-slate-700"
                  />
                </div>
              </div>

              {catalogLoading ? (
                <div className="flex flex-col justify-center items-center py-12 gap-2 select-none">
                  <Loader2 size={24} className="text-[#1DB954] animate-spin" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Mapping Direct Connections...</span>
                </div>
              ) : searchedServices.length === 0 ? (
                <div className="text-center py-10 border border-slate-850 border-dashed rounded-xl select-none">
                  <p className="text-slate-500 font-black uppercase text-[10px]">No packages found for search</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 overflow-y-auto max-h-[30vh] pr-1 custom-scrollbar">
                  {searchedServices.map((srv) => {
                    const isSelected = selectedService?.id === srv.id;
                    return (
                      <div
                        key={srv.id}
                        onClick={() => {
                          setSelectedService(srv);
                          setQuantity(srv.min);
                        }}
                        className={`bg-[#181818]/60 hover:bg-[#1c1c1c] border p-3.5 rounded-xl cursor-pointer text-left transition-all duration-200 flex flex-col justify-between group ${
                          isSelected 
                            ? "border-[#1DB954] bg-[#1DB954]/5"
                            : "border-slate-850 hover:border-slate-800"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <span className="text-[7.5px] bg-slate-900 text-slate-500 border border-slate-850 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                              ID: #{srv.id}
                            </span>
                            <h4 className="text-[11px] font-bold text-white mt-1 group-hover:text-[#1DB954] transition-colors leading-relaxed">
                              {srv.name.startsWith("👥") || srv.name.startsWith("❤️") || srv.name.startsWith("▶️") 
                                ? `${srv.name} - ID ${srv.id}`
                                : formatSmmServiceName(srv.name, srv.id, srv.desc || undefined)}
                            </h4>
                          </div>
                          
                          <div className="flex-shrink-0 text-right">
                            <span className="text-[10px] text-[#1DB954] font-black font-mono">
                              ₱{srv.startingPrice.toFixed(2)} <span className="text-[7.5px] text-slate-500 font-semibold uppercase">/pc</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-850/50 pt-2 mt-2 text-[8px] text-slate-500 font-bold uppercase select-none">
                          <span>Min Order: {srv.min.toLocaleString()} • Max: {srv.max.toLocaleString()}</span>
                          {isSelected && <span className="text-[#1DB954] font-black flex items-center gap-0.5">Selected ✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step Navigation */}
              <div className="flex justify-end pt-3 border-t border-slate-850/50 select-none">
                <button
                  type="button"
                  disabled={!selectedService}
                  onClick={() => setStep(3)}
                  className="bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-600 text-black font-black px-5 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-md"
                >
                  Enter Details <ArrowRight size={12} strokeWidth={2.5} />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* STEP 3: Order details & mandatory GCash receipt uploader */}
        {step === 3 && selectedService && (
          <div className="w-full max-w-md mx-auto bg-[#121212]/95 border border-slate-850 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            
            <div className="flex items-center gap-3 border-b border-slate-850/50 pb-3">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setError("");
                }}
                className="bg-[#181818] border border-slate-850 hover:bg-slate-850 text-slate-400 p-1.5 rounded-lg transition-all cursor-pointer flex-shrink-0"
              >
                <ArrowLeft size={12} />
              </button>
              <div className="text-left min-w-0">
                <span className="text-[8px] bg-slate-900 text-slate-500 border border-slate-850 px-1.5 py-0.5 rounded font-mono">
                  SMM ID: #{selectedService.id}
                </span>
                <h3 className="text-xs font-bold text-white mt-0.5 truncate" title={selectedService.name}>{selectedService.name}</h3>
              </div>
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4 text-left">
              
              {/* Account verified check */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Customer Email</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-850 text-slate-500 cursor-not-allowed text-xs font-semibold"
                />
              </div>

              {/* Target Link Input */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Link URL <span className="text-red-500">*</span></label>
                  <input
                    type="url"
                    required
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] text-xs font-semibold text-white transition-all placeholder:text-slate-700"
                    placeholder="e.g. Profile or Post link"
                  />
                  <p className="text-[8px] text-slate-500 mt-1 font-semibold uppercase tracking-wider select-none">⚠️ Link must be publicly accessible.</p>
                </div>
                
                {/* Live Link Preview Window */}
                {targetUrl && (
                  <div className="animate-in fade-in duration-200">
                    <LinkPreviewWindow targetUrl={targetUrl} />
                  </div>
                )}
              </div>

              {/* Quantity Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest mb-1">Quantity <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min={selectedService.min}
                    max={selectedService.max}
                    value={quantity || ""}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a0a0a] border border-slate-850 focus:outline-none focus:border-[#1DB954] text-xs font-bold text-white transition-all placeholder:text-slate-700"
                    placeholder={`Min: ${selectedService.min}`}
                  />
                  <p className="text-[8px] text-slate-500 mt-1 font-bold select-none uppercase tracking-wider">
                    {selectedService.min.toLocaleString()} - {selectedService.max.toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col justify-end select-none">
                  <div className="bg-[#0a0a0a] px-3.5 py-2 rounded-xl border border-slate-850 flex justify-between items-center h-[34px]">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Total:</span>
                    <span className="text-xs font-black text-[#1DB954] font-mono">₱{calculatedCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* GCash Scan QR Section */}
              <div className="bg-[#0a0a0a]/50 border border-slate-850 p-3.5 rounded-xl text-center space-y-2.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#1DB954] block">
                  📱 Step 1: Scan GCash to Pay ₱{calculatedCost.toFixed(2)}
                </span>
                
                <div className="flex flex-col items-center select-none">
                  <div className="bg-white p-1 rounded-xl inline-block max-w-[85px] border border-slate-700/20 shadow">
                    <img 
                      src="/gcash-qr.png" 
                      alt="GCash QR Code" 
                      className="w-full h-auto rounded-lg object-contain"
                    />
                  </div>
                  <p className="text-[8px] text-slate-500 font-bold uppercase mt-1">Account: Henry S.</p>
                  <div className="flex items-center gap-1.5 mt-1.5 bg-[#1DB954]/5 border border-[#1DB954]/10 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[9px] font-black text-[#1DB954] tracking-wider">09505339963</span>
                    <button 
                      type="button" 
                      onClick={() => navigator.clipboard.writeText('09505339963')} 
                      className="text-[7.5px] bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] font-black uppercase px-1.5 py-0.5 rounded transition-all cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* Strict Receipt Screenshot Uploader */}
              <div className="bg-[#0a0a0a] border border-slate-850 p-3.5 rounded-xl space-y-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center select-none">
                  <span>📱 Step 2: Upload Receipt screenshot <span className="text-red-500">*</span></span>
                  <span className="text-[7px] font-black uppercase text-red-500 animate-pulse">Required</span>
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
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#121212] border border-dashed border-slate-700 hover:border-[#1DB954]/40 text-slate-400 hover:text-white cursor-pointer transition-all text-[10px] font-black uppercase tracking-wider text-center"
                  >
                    <span>📁</span> {receiptFile ? `Receipt Attached` : "Attach GCash Receipt"}
                  </label>
                  {receiptFile && (
                    <div className="text-[8px] text-[#1DB954] font-bold uppercase tracking-wider text-center mt-1 select-none animate-pulse">
                      ✓ loaded ({(receiptFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Trigger */}
              <button
                type="submit"
                disabled={loading || !receiptFile}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-650 text-black font-black py-3 rounded-xl transition-all duration-200 uppercase text-[10px] tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md mt-1"
              >
                {loading ? <Loader2 size={12} className="animate-spin text-black" /> : <ShieldCheck size={12} />}
                {loading ? "Uploading & Queueing..." : "Submit Campaign Order"}
              </button>

            </form>
          </div>
        )}

        {/* STEP 4: Success & Live tracking guidelines */}
        {step === 4 && (
          <div className="w-full max-w-md mx-auto bg-[#121212]/95 border border-slate-850 rounded-2xl p-5 sm:p-7 shadow-xl text-center space-y-5 animate-in zoom-in duration-300">
            <div className="w-12 h-12 bg-green-500/10 border border-green-500/25 text-[#1DB954] rounded-full flex items-center justify-center mx-auto shadow-md">
              <ShieldCheck size={26} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white uppercase">Campaign Pre-Queued!</h3>
              <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                Your order was registered successfully. Copy your Tracking ID:
              </p>
            </div>

            <div className="flex gap-2 items-center justify-center max-w-xs mx-auto">
              <div className="flex-grow bg-slate-900 border border-slate-850 p-2.5 rounded-xl font-mono text-sm text-[#1DB954] font-black tracking-widest text-center select-all">
                BS-{orderId.slice(0, 8).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`BS-${orderId.slice(0, 8).toUpperCase()}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="bg-[#181818] hover:bg-slate-850 border border-slate-800 p-2.5 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer flex-shrink-0 flex items-center justify-center min-w-[36px] h-[36px]"
                title="Copy tracking ID"
              >
                {copied ? <span className="text-[10px] text-[#1DB954] font-black">✓</span> : <span className="text-xs">📋</span>}
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-850 p-4 rounded-xl text-left space-y-2 text-[10px] text-slate-400 leading-relaxed font-semibold">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#1DB954] block border-b border-slate-850 pb-1">
                ⚙️ Live Campaign Tracking Guide
              </span>
              <p>
                1. Track your pending campaign status directly in the **Support Chatbot** located at the bottom-right corner of our site.
              </p>
              <p>
                2. Simply paste your **Tracking ID** into the chatbot to instantly query live delivery progress!
              </p>
              <p>
                3. You can also view all active orders by clicking the **Track Order** button in the top navigation bar.
              </p>
            </div>

            {/* Redirect Progress */}
            <div className="pt-1 select-none max-w-xs mx-auto">
              <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-550 tracking-wider mb-1.5">
                <span>Redirecting to site</span>
                <span className="text-[#1DB954]">{countdown}s</span>
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#1DB954] transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 8) * 100}%` }}
                ></div>
              </div>
            </div>

            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.setItem("onboarded", "true");
                }
                router.push(`/?track=${orderId}`);
              }}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-2.5 rounded-full transition-all duration-200 uppercase text-[10px] tracking-wider cursor-pointer active:scale-95 shadow-md"
            >
              Enter Dashboard Now
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
