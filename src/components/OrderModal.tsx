"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Loader2, 
  ShieldCheck, 
  Copy, 
  Check, 
  Download, 
  Laptop, 
  Plus, 
  Trash2, 
  Lock, 
  User, 
  Image as ImageIcon, 
  AlertCircle, 
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  Sparkles,
  Smartphone,
  CreditCard,
  Wallet,
  CheckCircle2,
  ExternalLink,
  Info
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";
import { LinkPreviewWindow } from "./LinkPreviewWindow";
import { compressImage, compressImageWithStats, formatBytes, type CompressResult } from "@/utils/imageCompressor";
import { parseDescription } from "@/utils/serviceHelpers";
import { getFBReactionRetailPrice, getFBReactionsSMMDetails } from "@/utils/fbReactions";
import { getVipDiscountSummary } from "@/utils/vip";

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
  availableSmmIds?: Set<string>;
}

const REACTION_OPTIONS = [
  { name: "Like", emoji: "👍", color: "#1877F2", glow: "rgba(24, 119, 242, 0.35)" },
  { name: "Love", emoji: "❤️", color: "#F33E58", glow: "rgba(243, 62, 88, 0.35)" },
  { name: "Care", emoji: "🥰", color: "#F7B125", glow: "rgba(247, 177, 37, 0.35)" },
  { name: "Haha", emoji: "😆", color: "#F7B125", glow: "rgba(247, 177, 37, 0.35)" },
  { name: "Wow", emoji: "😮", color: "#F7B125", glow: "rgba(247, 177, 37, 0.35)" },
  { name: "Sad", emoji: "😢", color: "#F7B125", glow: "rgba(247, 177, 37, 0.35)" },
  { name: "Angry", emoji: "😡", color: "#E96630", glow: "rgba(233, 102, 48, 0.35)" }
];

export function OrderModal({ 
  isOpen, 
  onClose, 
  serviceId, 
  serviceTitle, 
  serviceBasePrice, 
  presetQuantity, 
  service, 
  availableSmmIds 
}: OrderModalProps) {
  // Navigation step state
  const [currentStep, setCurrentStep] = useState<"details" | "payment">("details");
  
  const [email, setEmail] = useState("");
  const { featureBadges } = useWidgetVisibility();
  const [url, setUrl] = useState("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isWalletPayment, setIsWalletPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"GCash" | "BPI">("GCash");
  const [markupMultiplier, setMarkupMultiplier] = useState(3.0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedReactions, setSelectedReactions] = useState<string[]>(["Like"]);
  const [eapDeviceCount, setEapDeviceCount] = useState<number>(1);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptCompressState, setReceiptCompressState] = useState<CompressResult | null>(null);
  const [receiptCompressProgress, setReceiptCompressProgress] = useState(0);
  const [submitStage, setSubmitStage] = useState("");
  const [receiptUploadPending, setReceiptUploadPending] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState("");
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkResult, setBulkResult] = useState<Array<{ orderId: string; trackingId: string }>>([]);

  // Pre-made Page Specifications States
  const [desiredName, setDesiredName] = useState("");
  const [pageCategory, setPageCategory] = useState("Business / Brand");
  const [demographics, setDemographics] = useState("Philippines (Local)");
  const [fbProfile, setFbProfile] = useState("");
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [coverPic, setCoverPic] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const supabase = useMemo(() => createClient(), []);

  const titleLower = (serviceTitle || "").toLowerCase();
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
  const isPisoWifiService = titleLower.includes("pisowifi") || titleLower.includes("piso wifi");
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

  // Determine active unit labels
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
  } else if (isPisoWifiService) {
    unitLabel = "Packages";
    unitSingle = "package";
  } else if (isEapService) {
    unitLabel = "Adaptations";
    unitSingle = "adaptation";
  } else if (isSoftwareService) {
    unitLabel = "Licenses";
    unitSingle = "license";
  }

  // Dynamic field requirements
  let inputLabel = "Target Link / URL";
  let inputPlaceholder = "https://facebook.com/your-page";

  if (isFollowersService || isSubscribersService) {
    inputLabel = "Target Profile / Channel Link";
    if (isInstagram) inputPlaceholder = "https://instagram.com/username";
    else if (isTikTok) inputPlaceholder = "https://tiktok.com/@username";
    else if (isYouTube) inputPlaceholder = "https://youtube.com/@channel";
    else if (isFacebook) inputPlaceholder = "https://facebook.com/your-profile";
    else inputPlaceholder = "https://instagram.com/username";
  } else if (isLikesService || isViewsService || isReactionService) {
    inputLabel = "Target Post / Video Link";
    if (isInstagram) inputPlaceholder = "https://instagram.com/p/post_id";
    else if (isTikTok) inputPlaceholder = "https://tiktok.com/@username/video/video_id";
    else if (isYouTube) inputPlaceholder = "https://youtube.com/watch?v=video_id";
    else if (isFacebook) inputPlaceholder = "https://facebook.com/your-post";
    else inputPlaceholder = "https://instagram.com/p/post_id";
  }

  // Parse service details & custom fields
  const parsedDetails = (() => {
    const isSingleItemService = isPageService || isEapService || isSoftwareService || isPisoWifiService;
    const defaults = {
      min_quantity: isSingleItemService ? 1 : 100,
      free_trial_amount: isSingleItemService ? 0 : 50,
      custom_fields: [] as { id: string; label: string; type?: string; options?: string[]; required?: boolean }[],
      smm_service_id: null as string | null
    };

    if (service && service.description) {
      try {
        const p = parseDescription(service.description);
        if (p) {
          return {
            min_quantity: isSingleItemService ? 1 : (Number(p.min_quantity) || defaults.min_quantity),
            free_trial_amount: Number.isFinite(Number(p.free_trial_amount)) ? Number(p.free_trial_amount) : defaults.free_trial_amount,
            custom_fields: p.custom_fields || [],
            smm_service_id: p.smm_service_id ? String(p.smm_service_id) : null
          };
        }
      } catch (e) {}
    }
    return defaults;
  })();

  const minQty = (isPageService || isGeminiService || isEapService || isSoftwareService || isPisoWifiService)
    ? 1
    : Math.max(parsedDetails.min_quantity || 100, 1);

  const resolvedSmmIdForAvailability = isReactionService
    ? String(getFBReactionsSMMDetails(selectedReactions).smmId)
    : (parsedDetails.smm_service_id ? String(parsedDetails.smm_service_id) : null);

  const isServiceAvailable = (() => {
    if (!resolvedSmmIdForAvailability) return true;
    if (!availableSmmIds || availableSmmIds.size === 0) return true;
    return availableSmmIds.has(resolvedSmmIdForAvailability);
  })();

  useEffect(() => {
    if (minQty > 0 && quantity < minQty) {
      setQuantity(minQty);
    }
  }, [minQty]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep("details");
      setError("");
      setSuccess(false);
      setCustomFieldValues({});
      setReceiptFile(null);
      if (receiptPreviewUrl) {
        URL.revokeObjectURL(receiptPreviewUrl);
        setReceiptPreviewUrl(null);
      }
      setReceiptCompressState(null);
      setReceiptCompressProgress(0);
      setSelectedReactions(["Like"]);
      setEapDeviceCount(1);
      
      if (isEapService || isSoftwareService || isPageService || isPisoWifiService) {
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
              const { data: pData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
              if (pData) setProfile(pData);
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
      
      fetch("/api/admin/markup-settings")
        .then(r => r.json())
        .then(data => {
          if (data.markupMultiplier) setMarkupMultiplier(Number(data.markupMultiplier));
        })
        .catch(() => {});
    }
  }, [isOpen, presetQuantity, isPageService, isEapService, isSoftwareService, isPisoWifiService, supabase]);

  useEffect(() => {
    if (isEapService) {
      setQuantity(eapDeviceCount);
    }
  }, [eapDeviceCount, isEapService]);

  // Handle receipt selection with clean preview
  const handleReceiptChange = (file: File | null) => {
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptPreviewUrl(null);
    }
    setReceiptFile(file);
    if (file) {
      setReceiptPreviewUrl(URL.createObjectURL(file));
      setError("");
    }
  };

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(`BS-${orderId.slice(0, 8).toUpperCase()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAccountNum = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

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

  if (!isOpen) return null;

  const effectiveQuantity = Math.max(quantity, minQty);
  const dynamicReactionPrice = isReactionService ? getFBReactionRetailPrice(selectedReactions) : serviceBasePrice;
  const baseTotal = effectiveQuantity * dynamicReactionPrice;

  // Visual Marketing Discount
  const fakeDiscountPercent = (isEapService || isPisoWifiService)
    ? 0 
    : (minQty === 1
      ? (effectiveQuantity >= 5 ? 20 : effectiveQuantity >= 3 ? 15 : 10)
      : (effectiveQuantity >= 10000 ? 25 : effectiveQuantity >= 5000 ? 20 : effectiveQuantity >= 3000 ? 15 : 10));

  const totalPrice = baseTotal > 0 ? Math.max(baseTotal, 5.00) : 0;
  const fakeOriginalPrice = totalPrice / (1 - fakeDiscountPercent / 105);
  const vipSummary = getVipDiscountSummary(profile, totalPrice);
  const payableTotal = vipSummary.discountPercent > 0 ? vipSummary.finalAmount : totalPrice;
  const hasVipDiscount = vipSummary.discountPercent > 0 && vipSummary.savingsAmount > 0;
  const hasWalletBalanceForOrder = Boolean(!isPisoWifiService && user && profile && Number(profile.balance) >= payableTotal);
  const formatPrice = (amount: number) => amount.toFixed(2);

  const uploadReceiptForOrder = async (file: File, createdOrderId: string) => {
    setReceiptUploadPending(true);
    setReceiptUploadError("");
    setSubmitStage("Optimizing receipt...");
    setReceiptCompressState(null);
    setReceiptCompressProgress(0.1);

    try {
      const compressedReceiptResult = await compressImageWithStats(file, {
        onProgress: (p) => {
          setReceiptCompressProgress(
            p.stage === "loading" ? 0.2 : p.stage === "resizing" ? 0.45 : p.stage === "encoding" ? 0.7 : 0.95
          );
        },
      });
      setReceiptCompressState(compressedReceiptResult);
      setReceiptCompressProgress(1);
      setSubmitStage("Uploading receipt...");

      const receiptFormData = new FormData();
      receiptFormData.append("file", compressedReceiptResult.file);
      receiptFormData.append("orderId", createdOrderId);

      const uploadRes = await fetch("/api/upload-receipt", {
        method: "POST",
        body: receiptFormData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Failed to upload payment receipt.");
      }

      setPendingReceiptFile(null);
      setSubmitStage("");
    } catch (uploadReceiptErr: any) {
      console.error("Receipt upload failed:", uploadReceiptErr);
      setReceiptUploadError(uploadReceiptErr.message || "Failed to upload payment receipt screenshot.");
      setSubmitStage("");
      throw uploadReceiptErr;
    } finally {
      setReceiptUploadPending(false);
    }
  };

  const handleRetryReceiptUpload = async () => {
    if (!orderId || !pendingReceiptFile) return;
    try {
      await uploadReceiptForOrder(pendingReceiptFile, orderId);
    } catch {}
  };

  // Validate step 1 before proceeding to step 2
  const handleProceedToPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!user && (!email.trim() || !email.includes("@"))) {
      setError("Please provide a valid email address so we can send your order tracking details.");
      return;
    }

    if (!isServiceAvailable) {
      setError("This service is temporarily undergoing maintenance from our provider. Please choose another option.");
      return;
    }

    if (bulkMode) {
      const urls = bulkUrls.split("\n").map((l) => l.trim()).filter(Boolean);
      if (urls.length === 0) {
        setError("Please enter at least one target link for your bulk order.");
        return;
      }
      if (urls.length > 50) {
        setError("Maximum 50 links per bulk order.");
        return;
      }
    } else if (!isPageService && !parsedDetails.custom_fields?.length) {
      if (!url.trim()) {
        setError("Please enter your target profile or post link.");
        return;
      }
    } else if (isPageService) {
      if (!desiredName.trim() || !fbProfile.trim()) {
        setError("Please complete the required Page Name and FB Admin link.");
        return;
      }
    }

    setCurrentStep("payment");
  };

  const handleSubmitGcashOrBpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    if (!isServiceAvailable) {
      setError("This service is temporarily unavailable. Please choose another service.");
      return;
    }

    if (!receiptFile) {
      setError("Please attach your payment receipt screenshot before placing the order.");
      return;
    }

    const finalQuantity = Math.max(quantity, minQty);
    const receiptToUpload = receiptFile;

    setIsSubmitting(true);
    setError("");
    setReceiptUploadError("");
    setSubmitStage("Creating order...");

    const optimisticOrderId = crypto.randomUUID();
    setOrderId(optimisticOrderId);
    setIsWalletPayment(false);
    setSuccess(true);
    setPendingReceiptFile(receiptToUpload);
    setIsSubmitting(false);

    if (typeof window !== "undefined") {
      localStorage.setItem("last_order_id", optimisticOrderId);
      localStorage.setItem("last_order_email", email.trim());
    }

    try {
      let tempUrl = url.trim();
      if (parsedDetails.custom_fields && parsedDetails.custom_fields.length > 0) {
        tempUrl = "Custom Request: " + Object.entries(customFieldValues).map(([k, v]) => `[${k}: ${v}]`).join(" ");
      } else if (isPageService) {
        tempUrl = "Compiling page specifications...";
      } else if (isReactionService) {
        tempUrl = `Reactions: [${selectedReactions.join(", ")}] Link: ${url.trim()}`;
      }

      setSubmitStage("Saving order details...");
      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: optimisticOrderId,
          serviceId,
          email: email.trim(),
          targetUrl: tempUrl,
          amount: payableTotal,
          paymentMethod,
          quantity: finalQuantity,
          smmServiceId: isReactionService
            ? String(getFBReactionsSMMDetails(selectedReactions).smmId)
            : (parsedDetails.smm_service_id ? String(parsedDetails.smm_service_id) : null)
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to register order.");

      const insertData = { id: createData.orderId || createData.data?.id || optimisticOrderId };

      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingId: `BS-${insertData.id.slice(0, 8).toUpperCase()}`,
          service: serviceTitle,
          email: email.trim(),
          quantity: finalQuantity,
          amount: payableTotal,
          paymentMethod: paymentMethod === "BPI" ? "🏦 BPI Transfer" : "📱 GCash QR",
          details: tempUrl,
        }),
      }).catch(() => {});

      if (isPageService) {
        setSubmitStage("Uploading page assets...");
        const [uploadedProfile, uploadedCover] = await Promise.all([
          profilePic ? compressAndUploadAsset(profilePic, insertData.id, "profile") : Promise.resolve("N/A"),
          coverPic ? compressAndUploadAsset(coverPic, insertData.id, "cover") : Promise.resolve("N/A"),
        ]);

        const finalUrl = `Page Wants: [Name: ${desiredName.trim() || 'Any'}] [Category: ${pageCategory}] [Region: ${demographics}] [FB Admin: ${fbProfile.trim() || 'Any'}] [Profile Pic: ${uploadedProfile}] [Cover Pic: ${uploadedCover}]${notes.trim() ? ` [Notes: ${notes.trim()}]` : ""}`;

        const targetRes = await fetch("/api/orders/update-target", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: insertData.id,
            targetUrl: finalUrl,
            customerEmail: email.trim()
          })
        });
        if (!targetRes.ok) {
          const targetData = await targetRes.json();
          setReceiptUploadError(targetData.error || "Failed to save page specifications.");
        }
      }

      try {
        await uploadReceiptForOrder(receiptToUpload, insertData.id);
      } catch {}
    } catch (err: any) {
      setSuccess(false);
      setOrderId("");
      setPendingReceiptFile(null);
      setError(err.message || "An error occurred while creating your order.");
      setSubmitStage("");
      if (typeof window !== "undefined") {
        localStorage.removeItem("last_order_id");
      }
    }
  };

  const handleWalletCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!serviceId || !user) return;

    if (!isServiceAvailable) {
      setError("This service is temporarily unavailable. Please pick another service.");
      return;
    }

    const finalQuantity = Math.max(quantity, minQty);

    if (Number(profile?.balance || 0) < payableTotal) {
      setError("Insufficient wallet balance. Please top up your wallet or pay via GCash.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSubmitStage("Processing wallet deduction...");

    try {
      let tempUrl = url.trim();
      if (parsedDetails.custom_fields && parsedDetails.custom_fields.length > 0) {
        tempUrl = "Custom Request: " + Object.entries(customFieldValues).map(([k, v]) => `[${k}: ${v}]`).join(" ");
      } else if (isPageService) {
        tempUrl = "Compiling page specifications...";
      } else if (isReactionService) {
        tempUrl = `Reactions: [${selectedReactions.join(", ")}] Link: ${url.trim()}`;
      }

      const resolvedSmmServiceId = isReactionService
        ? String(getFBReactionsSMMDetails(selectedReactions).smmId)
        : (parsedDetails.smm_service_id ? String(parsedDetails.smm_service_id) : null);

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
          totalPrice: payableTotal,
          smmServiceId: resolvedSmmServiceId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Wallet payment failed.");
      }

      setOrderId(data.orderId);
      setIsWalletPayment(true);
      setSuccess(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", data.orderId);
        localStorage.setItem("last_order_email", user.email || "");
      }
      setProfile({ ...profile, balance: data.newBalance });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("balance-update"));
      }
      setIsSubmitting(false);

      if (isPageService) {
        setSubmitStage("Uploading page assets...");
        const [uploadedProfile, uploadedCover] = await Promise.all([
          profilePic ? compressAndUploadAsset(profilePic, data.orderId, "profile") : Promise.resolve("N/A"),
          coverPic ? compressAndUploadAsset(coverPic, data.orderId, "cover") : Promise.resolve("N/A"),
        ]);

        const finalUrl = `Page Wants: [Name: ${desiredName.trim() || 'Any'}] [Category: ${pageCategory}] [Region: ${demographics}] [FB Admin: ${fbProfile.trim() || 'Any'}] [Profile Pic: ${uploadedProfile}] [Cover Pic: ${uploadedCover}]${notes.trim() ? ` [Notes: ${notes.trim()}]` : ""}`;

        await fetch("/api/orders/update-target", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.orderId,
            targetUrl: finalUrl,
            customerEmail: user.email
          })
        });
        setSubmitStage("");
      }
    } catch (err: any) {
      setError(err.message || "Wallet transaction could not be completed.");
      setIsSubmitting(false);
      setSubmitStage("");
    }
  };

  const quickQuantityPills = isPageService || isPisoWifiService || isEapService || isSoftwareService
    ? [1, 2, 3, 5, 10]
    : [500, 1000, 2500, 5000, 10000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-white/10 flex items-center justify-between bg-[#181818]/60 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1877F2]/15 border border-[#1877F2]/30 flex items-center justify-center text-[#1877F2] font-black text-sm shrink-0">
              {isFacebook ? "FB" : isTikTok ? "TT" : isInstagram ? "IG" : isYouTube ? "YT" : "⚡"}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight">
                {serviceTitle}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-zinc-400 font-semibold">
                  ₱{formatPrice(dynamicReactionPrice)} / {minQty > 1 ? "1k" : unitSingle}
                </span>
                {isPhBase && (
                  <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    🇵🇭 PH Local
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            type="button"
            className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl shrink-0 cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2-Step Progress Indicator (Shown before success) */}
        {!success && (
          <div className="bg-[#151515] border-b border-white/5 px-6 py-2.5 flex items-center justify-between text-xs font-bold flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                currentStep === "details" ? "bg-[#1877F2] text-white" : "bg-emerald-600 text-white"
              }`}>
                {currentStep === "details" ? "1" : <Check size={12} />}
              </span>
              <span className={currentStep === "details" ? "text-white font-black" : "text-zinc-400"}>
                1. Order Details
              </span>
            </div>

            <div className="h-0.5 w-12 bg-white/10 mx-2" />

            <div className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                currentStep === "payment" ? "bg-[#1877F2] text-white" : "bg-white/10 text-zinc-400"
              }`}>
                2
              </span>
              <span className={currentStep === "payment" ? "text-white font-black" : "text-zinc-500"}>
                2. Payment & QR
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-grow space-y-5">

          {/* ========================================================================= */}
          {/* SUCCESS SCREEN */}
          {/* ========================================================================= */}
          {success ? (
            <div className="text-center space-y-5 py-2 animate-in zoom-in-95 duration-300">
              <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Order Registered!</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Your order has been queued. Please save your Tracking ID below to track progress or chat with support.
                </p>
              </div>

              {/* Prominent Tracking ID Card */}
              <div className="bg-[#181818] border border-white/15 rounded-2xl p-4 text-left space-y-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#1877F2] block">
                  Your Tracking ID
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-grow bg-black/60 border border-white/10 px-4 py-3 rounded-xl font-mono text-base sm:text-lg text-emerald-400 font-black tracking-widest text-center select-all shadow-inner">
                    BS-{orderId.slice(0, 8).toUpperCase()}
                  </div>
                  <button
                    onClick={handleCopyTracking}
                    type="button"
                    className="bg-[#1877F2] hover:bg-[#1877F2]/80 text-white p-3.5 rounded-xl font-bold transition flex items-center justify-center shrink-0 shadow-lg shadow-[#1877F2]/20 active:scale-95 cursor-pointer"
                    title="Copy Tracking ID"
                  >
                    {copied ? <Check size={18} className="text-white" /> : <Copy size={18} />}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 pt-1">
                  {copied ? (
                    <span className="text-emerald-400 font-bold">✓ Copied to clipboard!</span>
                  ) : (
                    "Tap copy button to save for reference."
                  )}
                </p>
              </div>

              {/* Receipt upload retry if needed */}
              {(receiptUploadPending || submitStage || receiptUploadError) && !isWalletPayment && (
                <div className={`text-left rounded-xl border p-3.5 space-y-2 ${
                  receiptUploadError ? "border-red-500/30 bg-red-500/10" : "border-[#1877F2]/25 bg-[#1877F2]/10"
                }`}>
                  {receiptUploadPending || submitStage ? (
                    <p className="text-xs font-bold text-white flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin text-[#1877F2]" />
                      {submitStage || "Finishing receipt upload..."}
                    </p>
                  ) : null}
                  {receiptUploadError && (
                    <>
                      <p className="text-xs font-semibold text-red-300">{receiptUploadError}</p>
                      {pendingReceiptFile && (
                        <button
                          type="button"
                          onClick={handleRetryReceiptUpload}
                          disabled={receiptUploadPending}
                          className="w-full rounded-xl bg-[#1877F2] px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50 cursor-pointer"
                        >
                          Retry Receipt Upload
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Next Steps Roadmap */}
              <div className="bg-[#161616] border border-white/10 rounded-2xl p-4 text-left space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 block">
                  📋 What Happens Next?
                </span>
                <div className="space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-black text-[10px] shrink-0 mt-0.5">1</span>
                    <p><strong className="text-white">Verification:</strong> Your payment receipt and URL format are confirmed (instant to 15 mins).</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2]/20 text-[#1877F2] font-black text-[10px] shrink-0 mt-0.5">2</span>
                    <p><strong className="text-white">Delivery:</strong> Boosters begin delivery gradually to maintain high-retention safety.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 font-black text-[10px] shrink-0 mt-0.5">3</span>
                    <p><strong className="text-white">Live Tracking:</strong> Track real-time progress on our website using your Tracking ID.</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <a
                  href={`/track-order?id=${orderId.slice(0, 8)}`}
                  className="flex-1 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider text-center transition flex items-center justify-center gap-1.5 shadow-lg shadow-[#1877F2]/25"
                >
                  <ExternalLink size={14} /> Track Order Status
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider text-center transition cursor-pointer"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : currentStep === "details" ? (
            /* ========================================================================= */
            /* STEP 1: ORDER DETAILS */
            /* ========================================================================= */
            <form onSubmit={handleProceedToPayment} className="space-y-4">
              
              {/* Guest Email Field */}
              {!user && (
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Your Email Address <span className="text-red-400">*</span></span>
                    <span className="text-[10px] text-zinc-500 normal-case font-medium">To receive tracking code</span>
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] text-white text-sm transition-all placeholder:text-zinc-600 font-medium outline-none"
                    placeholder="e.g. yourname@gmail.com"
                  />
                </div>
              )}

              {/* Authenticated user badge */}
              {user && (
                <div className="flex items-center justify-between bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[#1877F2]" />
                    <span className="text-zinc-300 font-medium">{user.email}</span>
                  </div>
                  {profile?.balance !== undefined && (
                    <span className="text-emerald-400 font-bold">
                      Wallet: ₱{formatPrice(Number(profile.balance || 0))}
                    </span>
                  )}
                </div>
              )}

              {/* Bulk Mode Toggle (If supported for simple boost services) */}
              {!isPageService && !isPisoWifiService && !isEapService && !isSoftwareService && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-xs font-bold text-white">Bulk Order Mode</p>
                    <p className="text-[10px] text-zinc-400">Order the same service for up to 50 links</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkMode(!bulkMode)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition cursor-pointer ${
                      bulkMode ? "bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/30" : "bg-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {bulkMode ? "ON" : "OFF"}
                  </button>
                </div>
              )}

              {/* Target Link Input or Bulk Links Textarea */}
              {bulkMode ? (
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex justify-between">
                    <span>Target Links (one per line)</span>
                    <span className="text-zinc-500 font-mono text-[10px]">
                      {bulkUrls.split("\n").filter((l) => l.trim()).length} / 50
                    </span>
                  </label>
                  <textarea
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    rows={4}
                    placeholder={"https://facebook.com/page1\nhttps://facebook.com/page2"}
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] text-white text-xs font-mono transition-all placeholder:text-zinc-600 outline-none"
                  />
                </div>
              ) : !isPageService && !parsedDetails.custom_fields?.length ? (
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>{inputLabel} <span className="text-red-400">*</span></span>
                    <span className="text-[10px] text-emerald-400 font-medium">Must be Public</span>
                  </label>
                  <input 
                    type="url" 
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] text-white text-sm transition-all placeholder:text-zinc-600 font-medium outline-none"
                    placeholder={inputPlaceholder}
                  />

                  {url && /^https?:\/\//i.test(url) && (
                    <div className="mt-3">
                      <LinkPreviewWindow targetUrl={url} serviceTitle={serviceTitle} />
                    </div>
                  )}
                </div>
              ) : null}

              {/* Reaction Picker for Facebook Reaction services */}
              {isReactionService && !bulkMode && (
                <div className="space-y-2.5 bg-[#181818] border border-white/10 p-3.5 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Choose Reactions
                    </span>
                    <button
                      type="button"
                      onClick={toggleAllReactions}
                      className="text-[11px] font-black text-[#1877F2] hover:underline cursor-pointer"
                    >
                      {selectedReactions.length === REACTION_OPTIONS.length ? "Reset to Like" : "Select All"}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {REACTION_OPTIONS.map((rx) => {
                      const isSelected = selectedReactions.includes(rx.name);
                      return (
                        <button
                          key={rx.name}
                          type="button"
                          onClick={() => toggleReaction(rx.name)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                            isSelected 
                              ? "bg-[#1877F2]/20 border-[#1877F2] text-white shadow-[0_0_12px_rgba(24,119,242,0.3)]" 
                              : "bg-black/40 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          <span className="text-2xl mb-0.5 transform hover:scale-110 transition-transform">{rx.emoji}</span>
                          <span className="text-[10px] font-bold">{rx.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-zinc-400 text-center font-medium">
                    Selected: <strong className="text-white">{selectedReactions.join(", ")}</strong>
                  </p>
                </div>
              )}

              {/* Custom fields (PisoWiFi, Custom requests, etc.) */}
              {parsedDetails.custom_fields && parsedDetails.custom_fields.length > 0 && !isPageService && (
                <div className="space-y-3 bg-[#181818] border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                    {isPisoWifiService ? "PisoWiFi Setup Information" : "Configuration Specifications"}
                  </span>
                  {parsedDetails.custom_fields.map((field: { id: string; label: string; type?: string; options?: string[]; required?: boolean }) => {
                    const fieldRequired = field.required !== false && !(field.id.toLowerCase().includes("blank") || field.id.toLowerCase().includes("custom"));
                    const fieldType = String(field.type || "").toLowerCase();
                    const fieldValue = customFieldValues[field.label] || "";
                    const updateField = (val: string) => setCustomFieldValues({ ...customFieldValues, [field.label]: val });

                    return (
                      <div key={field.id}>
                        <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                          {field.label} {fieldRequired && <span className="text-red-400">*</span>}
                        </label>
                        {fieldType === "select" && field.options ? (
                          <select
                            required={fieldRequired}
                            value={fieldValue}
                            onChange={(e) => updateField(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-medium outline-none cursor-pointer"
                          >
                            <option value="">-- Select {field.label} --</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt} className="bg-zinc-900 text-white">{opt}</option>
                            ))}
                          </select>
                        ) : fieldType === "textarea" ? (
                          <textarea
                            required={fieldRequired}
                            value={fieldValue}
                            onChange={(e) => updateField(e.target.value)}
                            rows={2}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-medium outline-none resize-none"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        ) : (
                          <input
                            type={field.label.toLowerCase().includes("password") ? "password" : "text"}
                            required={fieldRequired}
                            value={fieldValue}
                            onChange={(e) => updateField(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-medium outline-none"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pre-made Facebook Page Specifications */}
              {isPageService && (
                <div className="space-y-3 bg-[#181818] border border-white/10 p-4 rounded-2xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] block">
                    📋 Page Setup Specifications
                  </span>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Desired Page Name <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={desiredName}
                      onChange={(e) => setDesiredName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-medium outline-none"
                      placeholder="e.g. Cyrhiel's Gaming Hub"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">Category</label>
                      <select 
                        value={pageCategory}
                        onChange={(e) => setPageCategory(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs outline-none cursor-pointer"
                      >
                        <option value="Business / Brand" className="bg-zinc-900">Business / Brand</option>
                        <option value="eCommerce / Store" className="bg-zinc-900">eCommerce / Store</option>
                        <option value="Gaming / Creator" className="bg-zinc-900">Gaming / Creator</option>
                        <option value="Personal Blog" className="bg-zinc-900">Personal Blog</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">Target Audience</label>
                      <select 
                        value={demographics}
                        onChange={(e) => setDemographics(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs outline-none cursor-pointer"
                      >
                        <option value="Philippines (Local)" className="bg-zinc-900">Philippines (Local)</option>
                        <option value="Global (Mixed)" className="bg-zinc-900">Global (Mixed)</option>
                        <option value="United States (US Tier)" className="bg-zinc-900">United States</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Your Personal FB Profile Link <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={fbProfile}
                      onChange={(e) => setFbProfile(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-medium outline-none"
                      placeholder="facebook.com/your.profile (for admin transfer)"
                    />
                  </div>
                </div>
              )}

              {/* Software Remote Installation Setup Box */}
              {isSoftwareService && (
                <div className="bg-[#181818] border border-white/10 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <Laptop size={16} className="text-[#1877F2]" />
                    <span>Remote Installation Setup</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    This software includes live remote setup via <strong>UltraViewer</strong>.
                  </p>
                  <a
                    href="https://ultraviewer.net/en/download.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#1877F2]/15 border border-[#1877F2]/30 text-[#1877F2] font-bold text-xs uppercase tracking-wider hover:bg-[#1877F2]/25 transition"
                  >
                    <Download size={14} /> Download UltraViewer
                  </a>
                </div>
              )}

              {/* Quantity Selector with Quick-Add Pills */}
              {!isEapService && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Quantity ({unitLabel})
                    </label>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Min: <strong className="text-white">{minQty.toLocaleString()}</strong>
                    </span>
                  </div>

                  {/* Quantity Input */}
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      required
                      min={minQty}
                      step="1"
                      value={quantity || ""}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] text-white text-base font-black transition-all outline-none"
                      placeholder={String(minQty)}
                    />
                    <span className="absolute right-4 text-xs font-black uppercase tracking-wider text-zinc-500 pointer-events-none">
                      {unitLabel}
                    </span>
                  </div>

                  {/* Quick-select presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1">Presets:</span>
                    {quickQuantityPills.map((pill) => (
                      <button
                        key={pill}
                        type="button"
                        onClick={() => setQuantity(pill)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition active:scale-95 cursor-pointer ${
                          quantity === pill 
                            ? "bg-[#1877F2] text-white shadow-sm" 
                            : "bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {pill >= 1000 ? `${pill / 1000}k` : pill}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Price Summary Card */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>Price Rate</span>
                  <span className="font-semibold text-white">
                    ₱{formatPrice(dynamicReactionPrice)} / {minQty > 1 ? "1,000" : unitSingle}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>Selected Amount</span>
                  <span className="font-semibold text-white">
                    {effectiveQuantity.toLocaleString()} {unitLabel.toLowerCase()}
                  </span>
                </div>

                {hasVipDiscount ? (
                  <div className="flex justify-between items-center text-xs text-emerald-400">
                    <span>VIP Discount ({vipSummary.discountPercent}%)</span>
                    <span className="font-bold">-₱{formatPrice(vipSummary.savingsAmount)}</span>
                  </div>
                ) : fakeDiscountPercent > 0 ? (
                  <div className="flex justify-between items-center text-xs text-[#1877F2]">
                    <span>Promotional Discount ({fakeDiscountPercent}%)</span>
                    <span className="font-bold line-through text-zinc-500">₱{formatPrice(fakeOriginalPrice)}</span>
                  </div>
                ) : null}

                <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-white">Total Payable</span>
                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-black text-emerald-400">
                      ₱{formatPrice(payableTotal)} PHP
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {/* Instant Wallet Checkout shortcut if user has sufficient balance */}
                {hasWalletBalanceForOrder && !bulkMode && (
                  <button
                    type="button"
                    onClick={() => handleWalletCheckout()}
                    disabled={isSubmitting || !isServiceAvailable}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <Wallet size={15} />
                    <span>Instant Wallet Checkout (₱{formatPrice(payableTotal)})</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!isServiceAvailable}
                  className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-[#1877F2]/30 active:scale-[0.99] cursor-pointer"
                >
                  <span>Continue to Payment & QR</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          ) : (
            /* ========================================================================= */
            /* STEP 2: PAYMENT & RECEIPT UPLOAD */
            /* ========================================================================= */
            <form onSubmit={handleSubmitGcashOrBpi} className="space-y-4">
              
              {/* Back to details button & Mini Order Pill */}
              <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep("details");
                    setError("");
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 block font-medium">
                    {effectiveQuantity.toLocaleString()} {unitLabel}
                  </span>
                  <span className="text-xs font-black text-emerald-400 block">
                    ₱{formatPrice(payableTotal)} PHP
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("GCash")}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                      paymentMethod === "GCash"
                        ? "bg-[#1877F2]/20 border-[#1877F2] text-[#1877F2] shadow-md shadow-[#1877F2]/20"
                        : "bg-black/40 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Smartphone size={15} />
                    <span>GCash QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("BPI")}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                      paymentMethod === "BPI"
                        ? "bg-[#D42027]/20 border-[#D42027] text-[#D42027] shadow-md shadow-[#D42027]/20"
                        : "bg-black/40 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <CreditCard size={15} />
                    <span>BPI Bank</span>
                  </button>
                </div>
              </div>

              {/* GCash Details & QR Code */}
              {paymentMethod === "GCash" && (
                <div className="bg-[#181818] border border-white/10 rounded-2xl p-4 space-y-3.5 text-center">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2 text-left">
                    <div>
                      <span className="text-xs font-black text-white uppercase tracking-wider block">
                        GCash QR & Account
                      </span>
                      <span className="text-[10px] text-zinc-400">Account Name: Henry S.</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Amount to Send</span>
                      <span className="text-sm font-black text-emerald-400">₱{formatPrice(payableTotal)}</span>
                    </div>
                  </div>

                  {/* QR Image */}
                  <div className="bg-white p-2.5 rounded-2xl inline-block shadow-xl border border-zinc-200">
                    <img 
                      src="/gcash-qr.png" 
                      alt="GCash QR Code" 
                      className="w-36 h-36 object-contain rounded-xl"
                    />
                  </div>

                  {/* Phone number copy strip */}
                  <div className="flex items-center justify-center gap-2 bg-black/60 border border-white/10 py-2 px-3 rounded-xl max-w-xs mx-auto">
                    <span className="text-xs font-mono font-bold text-white select-all">
                      09505339963
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccountNum("09505339963")}
                      className="text-[10px] font-black uppercase tracking-wider bg-[#1877F2] hover:bg-[#1877F2]/80 text-white px-2.5 py-1 rounded-md transition cursor-pointer"
                    >
                      {copiedAccount ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {/* BPI Bank Transfer Details */}
              {paymentMethod === "BPI" && (
                <div className="bg-[#181818] border border-white/10 rounded-2xl p-4 space-y-3 text-center">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2 text-left">
                    <div>
                      <span className="text-xs font-black text-white uppercase tracking-wider block">
                        BPI Bank Transfer
                      </span>
                      <span className="text-[10px] text-zinc-400">Bank of the Philippine Islands</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Amount to Send</span>
                      <span className="text-sm font-black text-emerald-400">₱{formatPrice(payableTotal)}</span>
                    </div>
                  </div>

                  <div className="bg-black/60 border border-white/10 p-3.5 rounded-xl text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Account Number</span>
                    <p className="text-lg font-mono font-black text-[#D42027] tracking-wider select-all">
                      4059901356
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyAccountNum("4059901356")}
                      className="text-[10px] font-black uppercase tracking-wider bg-[#D42027] hover:bg-[#D42027]/80 text-white px-3 py-1 rounded-md transition mt-1 cursor-pointer"
                    >
                      {copiedAccount ? "Copied Account Number!" : "Copy Account Number"}
                    </button>
                  </div>

                  <p className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 p-2 rounded-lg text-left">
                    ⚠️ If sending from GCash to BPI, please include the ₱15 bank fee to ensure full payment.
                  </p>
                </div>
              )}

              {/* Payment Receipt Upload Container */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-4 space-y-3">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Attach Payment Screenshot <span className="text-red-400">*</span></span>
                  <span className="text-[10px] text-zinc-500 font-normal">PNG, JPG, or WEBP</span>
                </label>

                {receiptPreviewUrl ? (
                  /* Thumbnail preview when file selected */
                  <div className="flex items-center gap-3 bg-black/50 border border-white/10 p-3 rounded-xl">
                    <img 
                      src={receiptPreviewUrl} 
                      alt="Receipt preview" 
                      className="w-12 h-12 object-cover rounded-lg border border-white/10 shrink-0"
                    />
                    <div className="min-w-0 flex-grow">
                      <p className="text-xs font-bold text-white truncate">{receiptFile?.name}</p>
                      <p className="text-[10px] text-emerald-400 font-medium">
                        ✓ Ready ({((receiptFile?.size || 0) / 1024).toFixed(1)} KB)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReceiptChange(null)}
                      className="text-xs text-red-400 hover:text-red-300 font-bold p-2 hover:bg-white/5 rounded-lg shrink-0 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  /* File Upload Drop Area */
                  <div>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleReceiptChange(e.target.files?.[0] || null)}
                      className="hidden"
                      id="checkout-receipt-input"
                    />
                    <label 
                      htmlFor="checkout-receipt-input"
                      className="w-full flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl bg-black/40 border border-dashed border-white/20 hover:border-[#1877F2] text-zinc-400 hover:text-white cursor-pointer transition text-center group"
                    >
                      <UploadCloud size={24} className="text-zinc-500 group-hover:text-[#1877F2] transition" />
                      <span className="text-xs font-bold text-white">Tap to upload receipt screenshot</span>
                      <span className="text-[10px] text-zinc-500">Take a screenshot of your GCash/BPI success screen</span>
                    </label>
                  </div>
                )}

                {/* Compression Progress Feedback */}
                {isSubmitting && receiptFile && (
                  <div className="rounded-xl border border-[#1877F2]/25 bg-[#1877F2]/10 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-300">
                      <span className="flex items-center gap-1.5 text-[#1877F2]">
                        <Loader2 size={12} className="animate-spin" />
                        {submitStage || "Optimizing receipt image..."}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#1877F2] transition-all duration-300"
                        style={{ width: `${Math.round(receiptCompressProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Final Submit Button */}
              <button 
                type="submit" 
                disabled={isSubmitting || !isServiceAvailable || !receiptFile}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black py-4 px-4 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin text-white" size={16} />
                    <span>{submitStage || "Registering Order..."}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Place Order & Verify (₱{formatPrice(payableTotal)})</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
