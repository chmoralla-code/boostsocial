"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ShieldCheck, Copy, Check, Download, Laptop, HelpCircle, Plus, Trash2, Terminal, CheckCircle2, Lock, User, Image, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { LinkPreviewWindow } from "./LinkPreviewWindow";
import { compressImage } from "@/utils/imageCompressor";
import { parseDescription } from "@/utils/serviceHelpers";
import { getFBReactionRetailPrice, getFBReactionsSMMDetails } from "@/utils/fbReactions";

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
    description: any;
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
  const [eapDeviceCount, setEapDeviceCount] = useState<number>(1);
  const [smmBalance, setSmmBalance] = useState<number>(100);
  const toggleReaction = (name: string) => {
    if (selectedReactions.includes(name)) {
      if (selectedReactions.length > 1) {
        setSelectedReactions(selectedReactions.filter(r => r !== name));
      }
    } else {
      setSelectedReactions([...selectedReactions, name]);
    }
  };

  const removeEapDevice = (indexToRemove: number) => {
    if (eapDeviceCount <= 1) return;
    const newValues = { ...customFieldValues };
    
    // Shift subsequent device specs upwards
    for (let d = indexToRemove + 1; d < eapDeviceCount; d++) {
      parsedDetails.custom_fields.forEach((field: { id: string; label: string }) => {
        const currentKey = `Device #${d + 1} - ${field.label}`;
        const previousKey = `Device #${d} - ${field.label}`;
        if (newValues[currentKey] !== undefined) {
          newValues[previousKey] = newValues[currentKey];
        } else {
          delete newValues[previousKey];
        }
      });
    }
    
    // Delete keys of the last device which got shifted out
    parsedDetails.custom_fields.forEach((field: { id: string; label: string }) => {
      const lastKey = `Device #${eapDeviceCount} - ${field.label}`;
      delete newValues[lastKey];
    });
    
    setCustomFieldValues(newValues);
    setEapDeviceCount(prev => prev - 1);
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

  const titleLower = serviceTitle.toLowerCase();
  const isInstagram = titleLower.includes("instagram") || titleLower.includes("ig ");
  const isTikTok = titleLower.includes("tiktok") || titleLower.includes("tt ");
  const isYouTube = titleLower.includes("youtube") || titleLower.includes("yt ");
  const isFacebook = titleLower.includes("facebook") || titleLower.includes("fb ");

  const isSubscribersService = titleLower.includes("subscribers") || titleLower.includes("subscriber") || titleLower.includes("sub");
  const isFollowersService = titleLower.includes("followers") || titleLower.includes("follower");
  const isLikesService = titleLower.includes("likes") || titleLower.includes("like") || titleLower.includes("heart") || titleLower.includes("hearts");
  const isViewsService = titleLower.includes("views") || titleLower.includes("view") || titleLower.includes("plays") || titleLower.includes("play");

  const isPageService = titleLower.includes("page");
  const isReactionService = titleLower.includes("reaction");
  const isGeminiService = titleLower.includes("gemini");
  const isEapService = titleLower.includes("eap") || titleLower.includes("tplink");
  const isSoftwareService = 
    titleLower.includes("software") || 
    titleLower.includes("architectural") ||
    titleLower.includes("license") ||
    serviceId === "03185a81-49f3-4255-868e-9e9ec3189497";

  const isPhBase = 
    titleLower.includes("ph base") || 
    titleLower.includes("ph-base") || 
    titleLower.includes("ph local") || 
    titleLower.includes("ph targeted") ||
    titleLower.includes("ph ") ||
    serviceTitle.toUpperCase().includes("PH BASE") ||
    serviceTitle.toUpperCase().includes("PH ");

  // Determine the active unit label & single unit term
  let unitLabel = "Units";
  let unitSingle = "unit";
  if (isFollowersService) {
    unitLabel = "Followers";
    unitSingle = "follower";
  } else if (isSubscribersService) {
    unitLabel = "Subscribers";
    unitSingle = "subscriber";
  } else if (isLikesService) {
    unitLabel = "Likes";
    unitSingle = "like";
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
  } else if (isEapService) {
    unitLabel = "Adaptations";
    unitSingle = "adaptation";
  } else if (isSoftwareService) {
    unitLabel = "Licenses";
    unitSingle = "license";
  }

  // Dynamic field requirements based on platform and service type
  let inputLabel = "Target Link / URL";
  let inputPlaceholder = "https://facebook.com/your-page";

  if (isFollowersService || isSubscribersService) {
    inputLabel = "Target Profile / Channel URL";
    if (isInstagram) {
      inputPlaceholder = "e.g. https://instagram.com/username";
    } else if (isTikTok) {
      inputPlaceholder = "e.g. https://tiktok.com/@username";
    } else if (isYouTube) {
      inputPlaceholder = "e.g. https://youtube.com/@channel";
    } else if (isFacebook) {
      inputPlaceholder = "e.g. https://facebook.com/your-profile";
    } else {
      inputPlaceholder = "e.g. https://instagram.com/username";
    }
  } else if (isLikesService || isViewsService || isReactionService) {
    inputLabel = "Target Post / Video URL";
    if (isInstagram) {
      inputPlaceholder = "e.g. https://instagram.com/p/post_id";
    } else if (isTikTok) {
      inputPlaceholder = "e.g. https://tiktok.com/@username/video/video_id";
    } else if (isYouTube) {
      inputPlaceholder = "e.g. https://youtube.com/watch?v=video_id";
    } else if (isFacebook) {
      inputPlaceholder = "e.g. https://facebook.com/your-post";
    } else {
      inputPlaceholder = "e.g. https://instagram.com/p/post_id";
    }
  }

  // Dynamic min quantity and free trial amount based on JSON description pack
  const parsedDetails = (() => {
    const defaults = {
      min_quantity: (isPageService || isEapService || isSoftwareService) ? 1 : 100,
      free_trial_amount: (isPageService || isEapService || isSoftwareService) ? 0 : 50,
      custom_fields: [] as {id: string, label: string, type?: string, options?: string[]}[],
      smm_service_id: null as number | null
    };

    if (service && service.description) {
      try {
        const p = parseDescription(service.description);
        if (p) {
          return {
            min_quantity: (isPageService || isEapService || isSoftwareService) ? 1 : (Number(p.min_quantity) || defaults.min_quantity),
            free_trial_amount: (isPageService || isEapService || isSoftwareService) ? 0 : (Number(p.free_trial_amount) || defaults.free_trial_amount),
            custom_fields: p.custom_fields || [],
            smm_service_id: p.smm_service_id ? Number(p.smm_service_id) : null
          };
        }
      } catch (e) {}
    }
    return defaults;
  })();

  // Safe min quantity floor for per-1,000 services
  const minQty = (isPageService || isGeminiService || isEapService || isSoftwareService)
    ? 1
    : Math.max(parsedDetails.min_quantity || 100, 1);

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
      setCustomFieldValues({});
      
      setSelectedReactions(["Like"]);
      setEapDeviceCount(1);
      
      if (isEapService || isSoftwareService || isPageService) {
        setQuantity(1);
      } else if (presetQuantity) {
        setQuantity(presetQuantity);
      } else {
        setQuantity(1000);
      }
      
      const checkAuth = async () => {
        setIsCheckingAuth(true);
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            setUser(data.user);
            setEmail(data.user.email || "");
            try {
              const { data: pData, error: pError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
              
              if (pError) {
                console.error("Error fetching user profile:", pError);
              }
              if (pData) {
                setProfile(pData);
              }
            } catch (profileErr) {
              console.error("Profile query rejected:", profileErr);
            }
          }
        } catch (authErr) {
          console.error("GetUser query rejected:", authErr);
        } finally {
          setIsCheckingAuth(false);
        }
      };

      checkAuth();
    }
  }, [isOpen, presetQuantity, isPageService, isEapService, isSoftwareService]);

  useEffect(() => {
    if (isEapService) {
      setQuantity(eapDeviceCount);
    }
  }, [eapDeviceCount, isEapService]);

  if (!isOpen) return null;

  const effectiveQuantity = Math.max(quantity, minQty);

  const dynamicReactionPrice = isReactionService ? getFBReactionRetailPrice(selectedReactions) : serviceBasePrice;
  const baseTotal = effectiveQuantity * dynamicReactionPrice;

  // Fake Marketing Discount Engine (Visual-only discount to incentivize sales)
  const fakeDiscountPercent = isEapService 
    ? 0 
    : (minQty === 1
      ? (effectiveQuantity >= 5 ? 20 : effectiveQuantity >= 3 ? 15 : 10)
      : (effectiveQuantity >= 10000 ? 25 : effectiveQuantity >= 5000 ? 20 : effectiveQuantity >= 3000 ? 15 : 10));

  const totalPrice = baseTotal > 0 ? Math.max(baseTotal, 5.00) : 0; // Enforce minimum order price of ₱5.00 to cover overhead
  const fakeOriginalPrice = totalPrice / (1 - fakeDiscountPercent / 105);
  const formatPrice = (amount: number) => amount.toFixed(2);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    const finalQuantity = Math.max(quantity, minQty);

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
            quantity: finalQuantity,
            smm_service_id: isReactionService ? getFBReactionsSMMDetails(selectedReactions).smmId : parsedDetails.smm_service_id
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
        localStorage.setItem("last_order_email", email.trim());
      }

      // Fire Telegram notification (non-blocking)
      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingId: `BS-${insertData.id.slice(0, 8).toUpperCase()}`,
          service: serviceTitle,
          email: email.trim(),
          quantity: finalQuantity,
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

    const finalQuantity = Math.max(quantity, minQty);

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
          quantity: finalQuantity,
          totalPrice,
          smmServiceId: isReactionService ? getFBReactionsSMMDetails(selectedReactions).smmId : parsedDetails.smm_service_id
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
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", data.orderId);
        localStorage.setItem("last_order_email", user.email || "");
      }
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
                isSoftwareService ? (
                  <div className="text-left bg-[#1877F2]/10 border border-[#1877F2]/25 p-5 rounded-xl space-y-3.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
                      🎉 Balance Payment Successful!
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      We deducted <strong className="text-white">₱{formatPrice(totalPrice)} PHP</strong> directly from your account wallet balance. Your order is registered!
                    </p>
                    <div className="bg-[#121212] border border-slate-800/80 p-3.5 rounded-lg text-xs space-y-1 text-center">
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Remote Setup Protocol</span>
                      <span className="text-green-400 font-black uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                        ⚡ PREPPED FOR INSTALLATION
                      </span>
                    </div>
                    
                    <div className="space-y-3 text-xs text-slate-350 bg-[#121212]/80 border border-slate-850 p-4 rounded-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block mb-1 font-extrabold">
                        📋 Next Steps
                      </span>
                      <div className="flex gap-2">
                        <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                        <p>
                          <strong>Keep PC & UltraViewer Running:</strong> Make sure you have downloaded and opened UltraViewer on your PC.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                        <p>
                          <strong>Wait for Facebook Chat:</strong> Our admin, <strong className="text-[#1877F2]">Cyrhiel Moralla</strong>, will message you directly on the Facebook account you provided during checkout.
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#1877F2]/20 border border-[#1877F2]/40 p-4 rounded-xl mt-3 text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block mb-1">
                        ⏳ Remote Setup Notice
                      </span>
                      <p className="text-[10px] text-slate-200 leading-relaxed font-semibold">
                        Please keep your PC awake. The remote installation takes approximately 10 to 15 minutes. Secure setup is performed entirely in real-time.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-left bg-[#1877F2]/10 border border-[#1877F2]/25 p-5 rounded-xl space-y-3.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
                      🎉 Balance Payment Successful!
                    </h3>
                    {smmBalance <= 0 ? (
                      <>
                        <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                          We deducted <strong className="text-white">₱{formatPrice(totalPrice)} PHP</strong> directly from your account wallet balance. Your boost has been securely registered and queued!
                        </p>
                        <div className="bg-[#121212] border border-slate-800/80 p-3.5 rounded-lg text-xs space-y-1 text-center">
                          <span className="text-[9px] text-slate-550 font-black uppercase tracking-widest block">Amplification Flow Status</span>
                          <span className="text-[#ff9800] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                            ⏳ IN QUEUE (HIGH VOLUME)
                          </span>
                        </div>
                        <p className="text-[10px] text-[#ff9800] leading-relaxed font-bold">
                          ⚠️ **Notice:** Due to a high volume of active campaigns, this order is securely queued and will be fully processed and completed within 24 hours.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                          We deducted <strong className="text-white">₱{formatPrice(totalPrice)} PHP</strong> directly from your account wallet balance. Your boost has been automatically approved and is already set to **Processing**!
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
                      </>
                    )}
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
                )
              ) : (
                isSoftwareService ? (
                  <>
                    <div className="text-left bg-[#181818] border border-slate-850 p-4 rounded-xl space-y-3.5">
                      <h3 className="text-xs font-black uppercase tracking-widest text-[#1877F2]">💳 Payment & Setup Steps</h3>
                      
                      <div className="space-y-3 text-xs text-slate-300">
                        <div className="flex gap-2">
                          <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                          <p>
                            <strong>Pay via GCash:</strong> Scan the Instapay QR code below and pay: <strong className="text-[#1877F2]">₱{formatPrice(totalPrice)}</strong>.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                          <p>
                            <strong>Confirm Receipt:</strong> Send your **Tracking ID** and payment screenshot to our **Support Chatbot** (bottom right) for instant verification.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                          <p>
                            <strong>Launch UltraViewer:</strong> Download and keep UltraViewer active on your PC.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <span className="bg-[#1877F2]/10 text-[#1877F2] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">4</span>
                          <p>
                            <strong>Admin Chat Handshake:</strong> Wait for <strong className="text-[#1877F2]">Cyrhiel Moralla (Admin)</strong> to contact you directly on the Facebook link you provided to securely install your software!
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

                    <div className="bg-[#1877F2]/20 border border-[#1877F2]/40 p-4 rounded-xl mt-3 text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block mb-1">
                        ⏳ Remote Setup Notice
                      </span>
                      <p className="text-[10px] text-slate-200 leading-relaxed font-semibold">
                        Please ensure UltraViewer remains open on your computer. Installation takes about 10-15 minutes once connection is established by the admin.
                      </p>
                    </div>
                  </>
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
                            <strong>Pay via GCash:</strong> {parsedDetails.free_trial_amount > 0 ? `Once you see the free ${parsedDetails.free_trial_amount} delivered, scan` : "Scan"} the QR code below to pay the remaining balance: <strong className="text-[#1877F2]">₱{formatPrice(totalPrice)}</strong>.
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
                )
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
                  {isEapService ? (
                    <>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block border-b border-slate-850 pb-2">
                        📋 EAP Adaptation Specifications ({eapDeviceCount} {eapDeviceCount === 1 ? 'item' : 'items'})
                      </span>
                      {Array.from({ length: eapDeviceCount }).map((_, index) => {
                        const itemNum = index + 1;
                        return (
                          <div key={index} className="space-y-4 bg-[#181818] border border-slate-800/80 p-4 rounded-xl mt-3 shadow-md animate-in fade-in duration-200">
                            <div className="flex justify-between items-center border-b border-slate-850/50 pb-1.5">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] font-extrabold">
                                ⚙️ EAP TP-Link Device #{itemNum}
                              </span>
                              {index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => removeEapDevice(index)}
                                  className="text-red-500 hover:text-red-400 transition-colors text-[9px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            {parsedDetails.custom_fields.map((field: {id: string, label: string, type?: string, options?: string[]}) => {
                              const uniqueKey = `Device #${itemNum} - ${field.label}`;
                              return (
                                <div key={field.id}>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                    {field.label}
                                  </label>
                                  <input 
                                    type={field.label.toLowerCase().includes("password") || field.id.toLowerCase().includes("password") ? "password" : "text"}
                                    required
                                    value={customFieldValues[uniqueKey] || ""}
                                    onChange={(e) => setCustomFieldValues({...customFieldValues, [uniqueKey]: e.target.value})}
                                    className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-xs font-semibold"
                                    placeholder={`Enter ${field.label.toLowerCase()} for device #${itemNum}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setEapDeviceCount(prev => prev + 1)}
                        className="flex items-center justify-center gap-2 w-full mt-4 py-3 px-4 rounded-xl border border-dashed border-slate-700 hover:border-[#1877F2] text-slate-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest bg-transparent hover:bg-[#1877F2]/5 active:scale-[0.98]"
                      >
                        ➕ ADD NEW TPLINK DEVICE
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] block border-b border-slate-850 pb-2">
                        📋 Custom Request Specifications
                      </span>
                      {parsedDetails.custom_fields.map((field: {id: string, label: string, type?: string, options?: string[]}) => (
                        <div key={field.id}>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{field.label}</label>
                          {field.type === 'select' && field.options ? (
                            <select
                              required
                              value={customFieldValues[field.label] || ""}
                              onChange={(e) => setCustomFieldValues({...customFieldValues, [field.label]: e.target.value})}
                              className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-sm font-medium cursor-pointer"
                            >
                              <option value="">-- Select {field.label} --</option>
                              {field.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input 
                              type={field.label.toLowerCase().includes("password") || field.id.toLowerCase().includes("password") ? "password" : "text"}
                              required={!(field.id.toLowerCase().includes("blank") || field.id.toLowerCase().includes("custom") || field.label.toLowerCase().includes("blank"))}
                              value={customFieldValues[field.label] || ""}
                              onChange={(e) => setCustomFieldValues({...customFieldValues, [field.label]: e.target.value})}
                              className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-sm font-medium"
                              placeholder={field.label.toLowerCase().includes("facebook") ? "e.g. https://facebook.com/username" : `Enter ${field.label.toLowerCase()}`}
                            />
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {isSoftwareService && (
                    <div className="bg-[#1e1e1e] border border-slate-800 p-4 rounded-xl space-y-4 mt-4 text-left shadow-lg">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <Laptop size={18} className="text-[#1877F2] shrink-0" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          🖥️ Remote Installation Setup
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-350 leading-relaxed font-semibold">
                        This software requires secure remote installation. Please download and install **UltraViewer** on your computer if you do not have it yet.
                      </p>

                      <a
                        href="https://ultraviewer.net/en/download.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/25 border border-[#1877F2]/30 hover:border-[#1877F2]/50 text-[#1877F2] font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_12px_rgba(24,119,242,0.1)] active:scale-95 text-center"
                      >
                        <Download size={14} />
                        Download UltraViewer
                      </a>

                      <div className="bg-[#121212] p-3 rounded-lg border border-slate-850 space-y-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            ⚡ Instant Handshake (Optional)
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 leading-normal">
                          If UltraViewer is already running, you can enter your details below so the admin can connect and set it up immediately without waiting!
                        </p>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest mb-1">
                              Partner ID
                            </label>
                            <input
                              type="text"
                              value={customFieldValues["UltraViewer Partner ID"] || ""}
                              onChange={(e) => setCustomFieldValues({
                                ...customFieldValues,
                                "UltraViewer Partner ID": e.target.value
                              })}
                              className="w-full px-3 py-2 rounded-lg bg-[#282828] border border-slate-750 focus:outline-none focus:ring-1 focus:ring-[#1877F2] text-white text-xs font-semibold"
                              placeholder="e.g. 12 345 678"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest mb-1">
                              Password
                            </label>
                            <input
                              type="text"
                              value={customFieldValues["UltraViewer Password"] || ""}
                              onChange={(e) => setCustomFieldValues({
                                ...customFieldValues,
                                "UltraViewer Password": e.target.value
                              })}
                              className="w-full px-3 py-2 rounded-lg bg-[#282828] border border-slate-750 focus:outline-none focus:ring-1 focus:ring-[#1877F2] text-white text-xs font-semibold"
                              placeholder="e.g. 1234"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#1877F2]/5 border border-[#1877F2]/10 p-3 rounded-lg">
                        <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                          💡 <strong className="text-white">Note:</strong> After placing your order, please wait for our admin (<strong className="text-[#1877F2]">Cyrhiel Moralla</strong>) to chat you on the Facebook link you provided above. Keep UltraViewer active on your PC.
                        </p>
                      </div>
                    </div>
                  )}

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
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{inputLabel}</label>
                    <input 
                      type="url" 
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-white transition-all text-sm font-medium"
                      placeholder={inputPlaceholder}
                    />

                    {url && /^https?:\/\//i.test(url) && (
                      <div className="mt-4 animate-in fade-in duration-300">
                        <LinkPreviewWindow 
                          targetUrl={url} 
                          serviceTitle={serviceTitle} 
                        />
                      </div>
                    )}
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
                
                {isEapService ? (
                  <div className="bg-[#1e1e1e] border border-slate-800/80 p-3.5 rounded-xl text-center text-xs font-semibold text-slate-400">
                    Quantity locked to device count: <strong className="text-[#1877F2] font-black">{eapDeviceCount}</strong>
                    <span className="block text-[10px] text-slate-500 mt-1">Managed dynamically via the device list above.</span>
                  </div>
                ) : (
                  <div className="relative rounded-xl shadow-sm">
                    <input 
                      type="number" 
                      required
                      min={minQty}
                      step="1"
                      value={quantity || ""}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      className={`w-full px-4 py-3 rounded-xl bg-[#282828] text-white transition-all text-sm font-bold border ${
                        (quantity > 0 && quantity < minQty)
                          ? "border-[#1877F2]/50 focus:ring-2 focus:ring-[#1877F2] focus:outline-none" 
                          : "border-slate-700/60 focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2] focus:outline-none"
                      }`}
                      placeholder={String(minQty)}
                    />
                  </div>
                )}

                {!isEapService && (
                  (quantity > 0 && quantity < minQty) ? (
                    <div className="bg-[#1877F2]/10 border border-[#1877F2]/25 p-3 rounded-xl flex items-start gap-2 animate-in slide-in-from-top-2 duration-300">
                      <span className="text-sm mt-0.5">💡</span>
                      <p className="text-[10px] text-[#1877F2] leading-relaxed font-bold text-left">
                        Below Minimum Limit: The minimum order size for this service is <strong className="text-white">{minQty.toLocaleString()}</strong>. Your order will be automatically upgraded to the minimum quantity of <strong className="text-white">{minQty.toLocaleString()}</strong> units at the standard minimum price.
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
                  )
                )}

                <div className="flex justify-between items-center mt-3 bg-[#121212] px-3.5 py-2.5 rounded-lg border border-slate-800">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated Total:</span>
                    {fakeDiscountPercent > 0 && (
                      <span className="text-[10px] text-[#1877F2] font-black uppercase tracking-wider mt-0.5 animate-pulse">
                        🔥 {fakeDiscountPercent}% Special Discount Applied!
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {fakeDiscountPercent > 0 && (
                      <span className="text-[11px] text-slate-500 font-mono line-through block leading-tight">
                        ₱{formatPrice(fakeOriginalPrice)}
                      </span>
                    )}
                    <span className="text-lg font-black text-white block">₱{formatPrice(totalPrice)}</span>
                  </div>
                </div>

                {isPhBase && (
                  <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-xl flex items-start gap-2.5 animate-in slide-in-from-bottom-2 duration-300 mt-3 text-left">
                    <span className="text-base leading-none">⏳</span>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-550 block">
                        🇵🇭 PH Base Delivery Protocol
                      </span>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                        Since organic targeted Philippine accounts require verified distribution and staggered delivery to ensure safety, this PH Base service will be securely queued, processed, and completed within **24 hours**. Thank you for your patience!
                      </p>
                    </div>
                  </div>
                )}

                {/* Safety Curation Layer Reassurance */}
                <div className="bg-[#1DB954]/5 border border-[#1DB954]/10 p-3.5 rounded-xl flex items-start gap-2 mt-3 animate-in fade-in duration-300">
                  <span className="text-sm mt-0.5">🛡️</span>
                  <p className="text-[10px] text-slate-355 leading-relaxed font-bold text-left">
                    <span className="text-[#1DB954] uppercase tracking-wider block mb-0.5">🔒 100% Monetization Safe Guarantee</span>
                    Your campaign passes through CYNETWORK's proprietary filters to exclude toxic bot pools that trigger restrictions. Safe for Facebook Adsense & organic page growth.
                  </p>
                </div>

                {/* GCash Quick QR for all manual checkouts to ensure the GCash payment flow is easily accessible */}
                {true && (
                  <div className="bg-[#121212] border border-slate-800/80 p-4 rounded-xl space-y-3 mt-3 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
                        📱 Instant GCash Checkout QR
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold tracking-wider">Account: HE***Y S.</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed font-semibold text-left">
                      {isSoftwareService ? (
                        <>
                          Pay <strong className="text-white">₱{formatPrice(totalPrice)} PHP</strong> directly using the GCash QR code below. Once your order is placed, send your Tracking ID to our support chatbot, download **UltraViewer**, and wait for remote setup!
                        </>
                      ) : (
                        <>
                          Pay <strong className="text-white">₱{formatPrice(totalPrice)} PHP</strong> directly using the GCash QR code below. Once your order is placed, send your Tracking ID and payment receipt in our support chatbot for instant verification and activation!
                        </>
                      )}
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
                    {isSubmitting ? <Loader2 className="animate-spin text-[#1877F2]" size={18} /> : `Pay with Wallet (₱${formatPrice(totalPrice)})`}
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
