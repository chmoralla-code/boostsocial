"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/utils/imageCompressor";

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string | null;
  serviceTitle: string;
  serviceBasePrice: number;
  presetQuantity?: number;
  service?: {
    id: string;
    title: string;
    description: string;
    starting_price: number;
    icon_type: string;
  } | null;
}

const REACTION_OPTIONS = [
  { name: "Like", emoji: "👍", color: "#1877F2", glow: "rgba(24, 119, 242, 0.4)" },
  { name: "Love", emoji: "❤️", color: "#F33E58", glow: "rgba(243, 62, 88, 0.4)" },
  { name: "Care", emoji: "🥰", color: "#F7B125", glow: "rgba(247, 177, 37, 0.4)" },
  { name: "Haha", emoji: "😆", color: "#F7B125", glow: "rgba(247, 177, 37, 0.4)" },
  { name: "Wow", emoji: "😮", color: "#F7B125", glow: "rgba(247, 177, 37, 0.4)" },
  { name: "Sad", emoji: "😢", color: "#F7B125", glow: "rgba(247, 177, 37, 0.4)" },
  { name: "Angry", emoji: "😡", color: "#E96630", glow: "rgba(233, 102, 48, 0.4)" }
];

export function OrderModal({ isOpen, onClose, serviceId, serviceTitle, serviceBasePrice, presetQuantity, service }: OrderModalProps) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isWalletPayment, setIsWalletPayment] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedReactions, setSelectedReactions] = useState<string[]>(["Like"]);

  const toggleReaction = (name: string) => {
    if (selectedReactions.includes(name)) {
      if (selectedReactions.length > 1) {
        setSelectedReactions(selectedReactions.filter(r => r !== name));
      }
    } else {
      setSelectedReactions([...selectedReactions, name]);
    }
  };

  const toggleAllReactions = () => {
    if (selectedReactions.length === REACTION_OPTIONS.length) {
      setSelectedReactions(["Like"]);
    } else {
      setSelectedReactions(REACTION_OPTIONS.map(r => r.name));
    }
  };

  const compressAndUploadAsset = async (file: File, orderId: string, assetType: string): Promise<string> => {
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("orderId", orderId);
      formData.append("assetType", assetType);
      
      const uploadRes = await fetch("/api/upload-page-asset", {
        method: "POST",
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        return uploadData.url;
      }
    } catch (e) {
      console.error(`Upload of ${assetType} failed:`, e);
    }
    return "N/A";
  };

  // Pre-made Page Specifications States
  const [desiredName, setDesiredName] = useState("");
  const [pageCategory, setPageCategory] = useState("Business / Brand");
  const [demographics, setDemographics] = useState("Philippines (Local)");
  const [fbProfile, setFbProfile] = useState("");
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [coverPic, setCoverPic] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const isPageService = serviceTitle.toLowerCase().includes("page");
  const isReactionService = serviceTitle.toLowerCase().includes("reaction");
  const isFollowersService = serviceTitle.toLowerCase().includes("followers");
  const isViewsService = serviceTitle.toLowerCase().includes("views");
  const isGeminiService = serviceTitle.toLowerCase().includes("gemini");

  // Determine the active unit label & single unit term
  let unitLabel = "Units";
  let unitSingle = "unit";
  if (isFollowersService) {
    unitLabel = "Followers";
    unitSingle = "follower";
  } else if (isReactionService) {
    unitLabel = "Reactions";
    unitSingle = "reaction";
  } else if (isViewsService) {
    unitLabel = "Views";
    unitSingle = "view";
  } else if (isPageService) {
    unitLabel = "Pages";
    unitSingle = "page";
  } else if (isGeminiService) {
    unitLabel = "Accounts";
    unitSingle = "account";
  }

  // Dynamic min quantity and free trial amount based on JSON description pack
  const parsedDetails = (() => {
    const defaults = {
      min_quantity: isPageService ? 1 : 100,
      free_trial_amount: isPageService ? 0 : 50,
      custom_fields: [] as {id: string, label: string}[]
    };

    if (service && service.description) {
      try {
        if (service.description.trim().startsWith("{")) {
          const p = JSON.parse(service.description);
          return {
            min_quantity: isPageService ? 1 : (Number(p.min_quantity) || defaults.min_quantity),
            free_trial_amount: isPageService ? 0 : (Number(p.free_trial_amount) || defaults.free_trial_amount),
            custom_fields: p.custom_fields || []
          };
        }
      } catch (e) {}
    }
    return defaults;
  })();

  // Safe min quantity floor for per-1,000 services
  const minQty = (isPageService || isGeminiService)
    ? 1
    : Math.max(parsedDetails.min_quantity || 100, 100);

  useEffect(() => {
    if (minQty > 0 && quantity < minQty) {
      setQuantity(minQty);
    }
  }, [minQty]);

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const supabase = createClient();

  const handleCopy = () => {
    navigator.clipboard.writeText(`BS-${orderId.slice(0, 8).toUpperCase()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccess(false);
      
      setSelectedReactions(["Like"]);
      
      if (presetQuantity) {
        setQuantity(presetQuantity);
      } else {
        setQuantity(isPageService ? 1 : 1000);
      }
      
      setIsCheckingAuth(true);
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUser(data.user);
          setEmail(data.user.email || "");
          supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: pData }) => {
            if (pData) setProfile(pData);
            setIsCheckingAuth(false);
          });
        } else {
          setIsCheckingAuth(false);
        }
      });
    }
  }, [isOpen, presetQuantity, isPageService]);

  if (!isOpen) return null;

  const effectiveQuantity = Math.max(quantity, minQty);

  const baseTotal = minQty === 1 
    ? effectiveQuantity * serviceBasePrice 
    : (effectiveQuantity / 1000) * serviceBasePrice;

  // Volume Discount Engine (Up to 20% off for large volumes and single high-value purchases)
  const discountPercent = minQty === 1
    ? (effectiveQuantity >= 5 ? 10 : effectiveQuantity >= 3 ? 5 : 0)
    : (effectiveQuantity >= 10000 ? 20 : effectiveQuantity >= 5000 ? 15 : effectiveQuantity >= 3000 ? 10 : 0);

  const totalPrice = baseTotal * (1 - discountPercent / 100);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    if (quantity < minQty) {
      setError(`Minimum quantity is ${minQty}.`);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      let tempUrl = url.trim();
      if (parsedDetails.custom_fields && parsedDetails.custom_fields.length > 0) {
        tempUrl = "Custom Request: " + Object.entries(customFieldValues).map(([k, v]) => `[${k}: ${v}]`).join(" ");
      } else if (isPageService) {
        tempUrl = "Compiling page specifications...";
      } else if (isReactionService) {
        tempUrl = `Reactions: [${selectedReactions.join(", ")}] Link: ${url.trim()}`;
      }

      const { data: insertData, error: insertError } = await supabase
        .from('orders')
        .insert([
          {
            service_id: serviceId,
            customer_email: email.trim(),
            target_url: tempUrl,
            amount: totalPrice,
            status: 'Pending',
            quantity: quantity
          }
        ])
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Upload Profile/Cover pictures if page service
      let profileUrl = "N/A";
      let coverUrl = "N/A";

      if (isPageService) {
        if (profilePic) {
          profileUrl = await compressAndUploadAsset(profilePic, insertData.id, "profile");
        }
        if (coverPic) {
          coverUrl = await compressAndUploadAsset(coverPic, insertData.id, "cover");
        }

        // Compile final target_url
        const finalUrl = `Page Wants: [Name: ${desiredName.trim() || 'Any'}] [Category: ${pageCategory}] [Region: ${demographics}] [FB Admin: ${fbProfile.trim() || 'Any'}] [Profile Pic: ${profileUrl}] [Cover Pic: ${coverUrl}]${notes.trim() ? ` [Notes: ${notes.trim()}]` : ""}`;

        // Update with fully detailed spec string
        await supabase
          .from('orders')
          .update({ target_url: finalUrl })
          .eq('id', insertData.id);
      }

      setOrderId(insertData.id);
      setIsWalletPayment(false);
      setSuccess(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", insertData.id);
      }

      // Fire Telegram notification (non-blocking)
      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingId: `BS-${insertData.id.slice(0, 8).toUpperCase()}`,
          service: serviceTitle,
          email: email.trim(),
          quantity,
          amount: totalPrice,
          paymentMethod: "📱 GCash",
          details: tempUrl,
        }),
      }).catch(() => {});
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWalletCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !user) return;

    if (quantity < minQty) {
      setError(`Minimum quantity is ${minQty}.`);
      return;
    }

    if (Number(profile?.balance || 0) < totalPrice) {
      setError("Insufficient wallet balance. Please top up first.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      let tempUrl = url.trim();
      if (parsedDetails.custom_fields && parsedDetails.custom_fields.length > 0) {
        tempUrl = "Custom Request: " + Object.entries(customFieldValues).map(([k, v]) => `[${k}: ${v}]`).join(" ");
      } else if (isPageService) {
        tempUrl = "Compiling page specifications...";
      } else if (isReactionService) {
        tempUrl = `Reactions: [${selectedReactions.join(", ")}] Link: ${url.trim()}`;
      }

      const res = await fetch("/api/checkout-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          serviceId,
          serviceTitle,
          email: user.email,
          url: tempUrl,
          quantity,
          totalPrice
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Wallet checkout failed");
      }

      // Upload Profile/Cover pictures if page service
      let profileUrl = "N/A";
      let coverUrl = "N/A";

      if (isPageService) {
        if (profilePic) {
          profileUrl = await compressAndUploadAsset(profilePic, data.orderId, "profile");
        }
        if (coverPic) {
          coverUrl = await compressAndUploadAsset(coverPic, data.orderId, "cover");
        }

        // Compile final target_url
        const finalUrl = `Page Wants: [Name: ${desiredName.trim() || 'Any'}] [Category: ${pageCategory}] [Region: ${demographics}] [FB Admin: ${fbProfile.trim() || 'Any'}] [Profile Pic: ${profileUrl}] [Cover Pic: ${coverUrl}]${notes.trim() ? ` [Notes: ${notes.trim()}]` : ""}`;

        // Update with fully detailed spec string
        await supabase
          .from('orders')
          .update({ target_url: finalUrl })
          .eq('id', data.orderId);
      }

      setOrderId(data.orderId);
      setIsWalletPayment(true);
      setSuccess(true);
      // Automatically refresh the wallet balance in the header if possible 
      // (in a real app we'd use global state, but here we update local profile state to prevent double clicking)
      setProfile({ ...profile, balance: data.newBalance });
      
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#181818] border border-slate-800/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800/50 rounded-lg"
        >
          <X size={20} />
        </button>
        
        <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          <h2 className="text-2xl font-black text-white mb-1.5 tracking-tight flex items-center gap-2">
            Order <span className="text-[#1877F2]">{serviceTitle}</span>
          </h2>
          <p className="text-slate-400 text-sm mb-6">Process your amplification request securely.</p>

          {success ? (
            <div className="bg-[#121212] text-white p-5 rounded-xl border border-slate-800 text-center space-y-4 animate-in zoom-in duration-300 max-h-[72vh] overflow-y-auto">
              <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 text-[#1877F2] rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-base font-bold text-white">Order Registered!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Please copy your Tracking ID for real-time support tracking:</p>
              </div>
              
              <div className="space-y-3">
                {/* Tracking ID (User Friendly) */}
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block mb-1">Your Tracking ID</span>
                  <div className="flex gap-2 items-center w-full">
                    <div className="flex-grow bg-[#282828] border border-slate-700/80 p-2.5 rounded-xl font-mono text-xs sm:text-sm text-[#1877F2] font-black tracking-widest text-center select-all">
                      BS-{orderId.slice(0, 8).toUpperCase()}
                    </div>
                    <button
                      onClick={handleCopy}
                      type="button"
                      className="bg-[#282828] hover:bg-[#333] border border-slate-700/80 p-2.5 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                      title="Copy Tracking ID"
                    >
                      {copied ? <Check size={16} className="text-[#1877F2]" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* Technical Order ID */}
                <div className="space-y-1 text-left bg-[#121212] border border-slate-800/80 p-2.5 rounded-xl">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-0.5">Technical Order ID</span>
                  <span className="font-mono text-[10px] text-slate-400 select-all break-all block">{orderId}</span>
                </div>
              </div>

              {/* 🎁 Trial & Payment Instructions (Or Wallet Success verification) */}
              {isWalletPayment ? (
                <div className="text-left bg-[#1877F2]/10 border border-[#1877F2]/25 p-5 rounded-xl space-y-3.5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
                    🎉 Balance Payment Successful!
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    We deducted <strong className="text-white">₱{totalPrice.toFixed(0)} PHP</strong> directly from your account wallet balance. Your boost has been automatically approved and is already set to **Processing**!
                  </p>
                  <div className="bg-[#121212] border border-slate-800/80 p-3.5 rounded-lg text-xs space-y-1 text-center">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Amplification Flow Status</span>
                    <span className="text-[#1877F2] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                      ⚡ ACTIVE & PROCESSING
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-450 leading-relaxed font-bold">
                    No further actions or manual GCash receipt verification are required. Our system will deliver your complete boost package shortly!
                  </p>
                  {isPageService && (
                    <div className="bg-[#1877F2]/20 border border-[#1877F2]/40 p-4 rounded-xl mt-3 text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block mb-1">
                        ⏳ 24-Hour Delivery Notice
                      </span>
                      <p className="text-[10px] text-slate-200 leading-relaxed font-semibold">
                        Your custom Facebook Page will be fully created, boosted with 10k followers, and transferred to you **within 24 hours**. 
                        You will receive an email containing the Facebook page link and a direct message from **Cyrhiel Moralla (Admin)** as soon as the page is ready. You can track your progress live below!
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-left bg-[#181818] border border-slate-850 p-4 rounded-xl space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#1877F2]">💳 Payment Steps</h3>
                    
                    <div className="space-y-2.5 text-xs text-slate-300">
                      {parsedDetails.free_trial_amount > 0 && (
                        <div className="flex gap-2">
                          <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                          <p>
                            <strong>Get {parsedDetails.free_trial_amount} Free Trial:</strong> We will first deliver {parsedDetails.free_trial_amount} free followers, reactions, or views to your target link so you can verify our speed & authenticity!
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">{parsedDetails.free_trial_amount > 0 ? "2" : "1"}</span>
                        <p>
                          <strong>Pay via GCash:</strong> {parsedDetails.free_trial_amount > 0 ? `Once you see the free ${parsedDetails.free_trial_amount} delivered, scan` : "Scan"} the QR code below to pay the remaining balance: <strong className="text-[#1877F2]">₱{totalPrice.toFixed(0)}</strong>.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">{parsedDetails.free_trial_amount > 0 ? "3" : "2"}</span>
                        <p>
                          <strong>Confirm Order:</strong> Send your **Tracking ID** and GCash payment screenshot to our **Support Chatbot** (bottom right) to instantly start your full delivery!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 📷 GCash QR Code Image */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">GCash InstaPay QR Code</span>
                    <div className="bg-white p-2 rounded-xl inline-block shadow-md max-w-[200px] mx-auto overflow-hidden border border-slate-700/20">
                      <img 
                        src="/gcash-qr.png" 
                        alt="GCash QR Code" 
                        className="w-full h-auto rounded-lg object-contain mx-auto"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Transfer fees may apply • Account Name: HE***Y S.</p>
                  </div>

                  {isPageService && (
                    <div className="bg-[#1877F2]/20 border border-[#1877F2]/40 p-4 rounded-xl mt-3 text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block mb-1">
                        ⏳ 24-Hour Delivery Notice
                      </span>
                      <p className="text-[10px] text-slate-200 leading-relaxed font-semibold">
                        Your custom Facebook Page will be fully created, boosted with 10k followers, and transferred to you **within 24 hours**. 
                        You will receive an email containing the Facebook page link and a direct message from **Cyrhiel Moralla (Admin)** as soon as the page is ready. You can track your progress live below!
                      </p>
                    </div>
                  )}
                </>
              )}

              <button 
                onClick={onClose}
                className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-black font-extrabold py-3 rounded-full transition-all duration-300 uppercase text-xs tracking-wider mt-2"
              >
                Close & View Website
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isCheckingAuth ? (
                <div className="flex justify-center items-center py-4 bg-[#1e1e1e]/50 border border-slate-800/80 rounded-xl h-[86px]">
                  <Loader2 size={24} className="text-[#1877F2] animate-spin" />
                </div>
              ) : user ? (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                    <span>Email Address</span>
                    <span className="text-[#1877F2] text-[10px] font-black uppercase tracking-wider">✓ Active Profile</span>
                  </label>
                  <input 
                    type="email" 
                    required
                    disabled
                    value={email}
                    className="w-full px-4 py-3 rounded-xl bg-[#1e1e1e] border border-[#1877F2]/30 text-slate-400 cursor-not-allowed text-sm font-medium"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-sm font-medium"
                    placeholder="you@example.com"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed text-left">
                    💡 Want to track orders automatically? <a href="/login" className="text-[#1877F2] font-extrabold hover:underline">Sign In / Register</a> first!
                  </p>
                </div>
              )}
              
              {parsedDetails.custom_fields && parsedDetails.custom_fields.length > 0 ? (
                <div className="space-y-4 bg-[#121212] border border-slate-800/80 p-4 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block border-b border-slate-850 pb-2">
                    📋 Custom Request Specifications
                  </span>
                  {parsedDetails.custom_fields.map((field: {id: string, label: string}) => (
                    <div key={field.id}>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{field.label}</label>
                      <input 
                        type="text" 
                        required
                        value={customFieldValues[field.label] || ""}
                        onChange={(e) => setCustomFieldValues({...customFieldValues, [field.label]: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-sm font-medium"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    </div>
                  ))}

                  {serviceTitle.toLowerCase().includes("pro") && (
                    <div className="bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-xl mt-4 text-left animate-in slide-in-from-bottom-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">
                        📨 Email Invitation Protocol
                      </span>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                        After your payment is confirmed, you will receive an **invitation link** at the email address provided above. 
                        Simply click the link to join and instantly activate your Gemini Pro subscription!
                      </p>
                    </div>
                  )}
                </div>
              ) : !isPageService ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Link / URL</label>
                    <input 
                      type="url" 
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-sm font-medium"
                      placeholder="https://facebook.com/your-page"
                    />
                  </div>

                  {isReactionService && (
                    <div className="space-y-3 bg-[#121212] border border-slate-800/80 p-4 rounded-xl animate-in slide-in-from-bottom-2">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
                          🎭 Reaction Types Selection
                        </span>
                        <button
                          type="button"
                          onClick={toggleAllReactions}
                          className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1877F2] transition-colors"
                        >
                          {selectedReactions.length === REACTION_OPTIONS.length ? "Reset to Like" : "Select All"}
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {REACTION_OPTIONS.map((rx) => {
                          const isSelected = selectedReactions.includes(rx.name);
                          return (
                            <button
                              key={rx.name}
                              type="button"
                              onClick={() => toggleReaction(rx.name)}
                              style={{
                                borderColor: isSelected ? rx.color : "transparent",
                                boxShadow: isSelected ? `0 0 10px ${rx.glow}` : "none",
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-200 active:scale-95 ${
                                isSelected 
                                  ? "bg-[#181818] text-white" 
                                  : "bg-[#282828] border-slate-850 hover:border-slate-750 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <span className="text-2xl mb-1 select-none transform hover:scale-125 transition-transform duration-200">{rx.emoji}</span>
                              <span className="text-[10px] font-bold tracking-tight select-none">{rx.name}</span>
                              {isSelected && (
                                <span 
                                  style={{ backgroundColor: rx.color }}
                                  className="w-1.5 h-1.5 rounded-full mt-1.5"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[9px] text-slate-400 leading-relaxed font-semibold italic text-center">
                        Selected: {selectedReactions.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 bg-[#121212] border border-slate-800/80 p-4 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block border-b border-slate-850 pb-2">
                    📋 Pre-made Page Specifications
                  </span>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Desired Page Name</label>
                    <input 
                      type="text" 
                      required
                      value={desiredName}
                      onChange={(e) => setDesiredName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-xs font-semibold"
                      placeholder="e.g. Cyrhiel's Gaming Hub"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Niche/Category</label>
                      <select 
                        value={pageCategory}
                        onChange={(e) => setPageCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-xs font-semibold cursor-pointer"
                      >
                        <option value="eCommerce / Store">eCommerce / Store</option>
                        <option value="Gaming / Creator">Gaming / Creator</option>
                        <option value="Business / Brand">Business / Brand</option>
                        <option value="Entertainment / Media">Entertainment / Media</option>
                        <option value="Personal Blog / Community">Personal Blog / Community</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Demographics</label>
                      <select 
                        value={demographics}
                        onChange={(e) => setDemographics(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-xs font-semibold cursor-pointer"
                      >
                        <option value="Philippines (Local)">Philippines (Local)</option>
                        <option value="United States (US Tier)">United States (US Tier)</option>
                        <option value="Global (Mixed)">Global (Mixed)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex justify-between items-center">
                      <span>Personal FB Link or Name</span>
                      <span className="text-slate-500 text-[9px] font-bold lowercase tracking-wider">Required for Admin Migration</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={fbProfile}
                      onChange={(e) => setFbProfile(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-xs font-semibold"
                      placeholder="e.g. facebook.com/cyrhiel.moralla or Cyrhiel Moralla"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Profile Picture</label>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => setProfilePic(e.target.files?.[0] || null)}
                          className="hidden"
                          id="profile-pic-upload"
                        />
                        <label 
                          htmlFor="profile-pic-upload"
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#282828] border border-dashed border-slate-700 hover:border-[#1877F2] text-slate-300 hover:text-white cursor-pointer transition-all text-xs font-bold"
                        >
                          {profilePic ? "✓ Selected" : "📁 Choose Profile"}
                        </label>
                        {profilePic && (
                          <span className="block text-[9px] text-[#1877F2] mt-1 truncate text-center font-bold">
                            {profilePic.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Cover Photo</label>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => setCoverPic(e.target.files?.[0] || null)}
                          className="hidden"
                          id="cover-pic-upload"
                        />
                        <label 
                          htmlFor="cover-pic-upload"
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#282828] border border-dashed border-slate-700 hover:border-[#1877F2] text-slate-300 hover:text-white cursor-pointer transition-all text-xs font-bold"
                        >
                          {coverPic ? "✓ Selected" : "📁 Choose Cover"}
                        </label>
                        {coverPic && (
                          <span className="block text-[9px] text-[#1877F2] mt-1 truncate text-center font-bold">
                            {coverPic.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Additional Requirements / Notes
                    </label>
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-xs font-medium resize-none"
                      placeholder="e.g. Include custom logo request, theme colors, etc."
                    />
                  </div>

                  {/* Dynamic Handoff Information Banner */}
                  <div className="bg-[#1877F2]/10 border border-[#1877F2]/20 p-3.5 rounded-xl mt-1 text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block mb-1">
                      ⏳ Delivery & Transfer Protocol
                    </span>
                    <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                      Your custom Facebook Page will be fully created, boosted with 10k followers, and transferred securely to you **within 24 hours**. 
                      You will receive an email invitation containing the Facebook link and direct message from **Cyrhiel Moralla (Admin)** as soon as the page is ready. You can track your progress live anytime!
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Quantity
                  </label>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 shadow-[0_0_8px_rgba(24,119,242,0.15)] animate-pulse">
                    ⚡ {unitLabel}
                  </span>
                </div>
                
                <div className="relative rounded-xl shadow-sm">
                  <input 
                    type="number" 
                    required
                    min={minQty}
                    step={minQty === 1 ? "1" : "100"}
                    value={quantity || ""}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    onBlur={() => {
                      if (quantity < minQty) {
                        setQuantity(minQty);
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-xl bg-[#282828] text-white transition-all text-sm font-bold border ${
                      quantity < minQty 
                        ? "border-red-500/50 focus:ring-2 focus:ring-red-500 focus:outline-none" 
                        : "border-slate-700/60 focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2] focus:outline-none"
                    }`}
                    placeholder={String(minQty)}
                  />
                </div>

                {quantity < minQty ? (
                  <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-xl flex items-start gap-2 animate-in slide-in-from-top-2 duration-300">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <p className="text-[10px] text-red-400 leading-relaxed font-bold text-left">
                      Below Minimum Limit: The minimum order size for this service is <strong className="text-white">{minQty.toLocaleString()}</strong> {unitLabel.toLowerCase()}. Please enter at least {minQty.toLocaleString()} units to proceed.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#1877F2]/5 border border-[#1877F2]/10 p-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-300">
                    <span className="text-sm mt-0.5">💡</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold text-left">
                      1 unit = 1 {unitSingle}. To order 1,000 {unitLabel.toLowerCase()}, simply type <strong className="text-[#1877F2]">1000</strong>. 
                      <span className="block mt-1 text-[9px] text-[#1877F2] font-black uppercase tracking-wider">
                        🎯 Minimum Requirement: {minQty.toLocaleString()} {unitLabel.toLowerCase()}
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center mt-3 bg-[#121212] px-3.5 py-2.5 rounded-lg border border-slate-800">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated Total:</span>
                    {discountPercent > 0 && (
                      <span className="text-[10px] text-[#1877F2] font-black uppercase tracking-wider mt-0.5 animate-pulse">
                        🔥 {discountPercent}% Volume Discount Applied!
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {discountPercent > 0 && (
                      <span className="text-[11px] text-slate-500 font-mono line-through block leading-tight">
                        ₱{baseTotal.toFixed(0)}
                      </span>
                    )}
                    <span className="text-lg font-black text-white block">₱{totalPrice.toFixed(0)}</span>
                  </div>
                </div>

                {/* GCash Quick QR for high-value services (Facebook Page & Gemini Pro) */}
                {(isPageService || serviceTitle.toLowerCase().includes("gemini")) && (
                  <div className="bg-[#121212] border border-slate-800/80 p-4 rounded-xl space-y-3 mt-3 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
                        📱 Instant GCash Checkout QR
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold tracking-wider">Account: HE***Y S.</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed font-semibold text-left">
                      Pay <strong className="text-white">₱{totalPrice.toFixed(0)} PHP</strong> directly using the GCash QR code below. Once your order is placed, send your Tracking ID and payment receipt in our support chatbot for instant verification and activation!
                    </p>
                    <div className="text-center">
                      <div className="bg-white p-1.5 rounded-xl inline-block shadow-md max-w-[130px] mx-auto overflow-hidden border border-slate-700/20">
                        <img 
                          src="/gcash-qr.png" 
                          alt="GCash QR Code" 
                          className="w-full h-auto rounded-lg object-contain mx-auto"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {error && (
                <div className="text-red-500 text-xs font-semibold bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2 mt-4">
                {user && profile && Number(profile.balance) >= totalPrice && (
                  <button 
                    type="button" 
                    onClick={handleWalletCheckout}
                    disabled={isSubmitting}
                    className="w-full bg-[#1877F2]/20 hover:bg-[#1877F2]/30 border border-[#1877F2]/50 disabled:opacity-50 text-[#1877F2] font-extrabold py-3.5 rounded-full transition-all duration-300 flex justify-center items-center gap-2 tracking-wider uppercase text-xs"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin text-[#1877F2]" size={18} /> : `Pay with Wallet (₱${totalPrice.toFixed(0)})`}
                  </button>
                )}
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-[#1877F2] hover:bg-[#4e8df5] disabled:bg-slate-700 text-white font-extrabold py-3.5 rounded-full transition-all duration-300 flex justify-center items-center gap-2 tracking-wider uppercase text-xs shadow-[0_0_15px_rgba(24,119,242,0.35)]"
                >
                  {isSubmitting ? <Loader2 className="animate-spin text-black" size={18} /> : (user && profile && Number(profile.balance) >= totalPrice ? 'Pay via GCash Instead' : 'Place Order')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
