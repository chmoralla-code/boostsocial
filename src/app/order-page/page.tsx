"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  CreditCard,
  FileText,
  ImageIcon,
  Loader2,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TopUpModal } from "@/components/TopUpModal";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/utils/imageCompressor";
import { getVipDiscountSummary } from "@/utils/vip";

interface SmmService {
  id: string;
  name: string;
  category: string;
  startingPrice: number;
  min: number;
  max: number;
}

interface Profile {
  id: string;
  balance?: number | string | null;
  vip_plan?: string | null;
  vip_expires_at?: string | null;
}

const CUSTOM_PAGE_SERVICE_ID = "e6f61249-71fe-40df-84f3-96d03d3e8dcf";
const FACEBOOK_FOLLOWERS_SMM_ID = "1141";
const BASE_PAGE_PRICE = 1999;
const INCLUDED_FOLLOWERS = 10000;
const FALLBACK_FOLLOWER_PRICE = 0.02752;
const FALLBACK_MIN = 10;
const FALLBACK_MAX = 500000;

function formatPhp(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function cleanSpec(value: string) {
  return value.trim().replace(/[\[\]]/g, "").replace(/\s+/g, " ");
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as Record<string, unknown>).message || err);
  return String(err);
}

export default function OrderPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [pageName, setPageName] = useState("");
  const [fbBio, setFbBio] = useState("");
  const [facebookLink, setFacebookLink] = useState("");
  const [followersQuantity, setFollowersQuantity] = useState(INCLUDED_FOLLOWERS);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"GCash" | "Wallet">("GCash");
  const [facebookFollowerService, setFacebookFollowerService] = useState<SmmService | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);

  const followerUnitPrice = facebookFollowerService?.startingPrice || FALLBACK_FOLLOWER_PRICE;
  const minFollowers = facebookFollowerService?.min || FALLBACK_MIN;
  const maxFollowers = facebookFollowerService?.max || FALLBACK_MAX;
  const normalizedQuantity = Math.max(followersQuantity || 0, minFollowers);
  const extraFollowers = Math.max(normalizedQuantity - INCLUDED_FOLLOWERS, 0);
  const extraFollowerCost = extraFollowers * followerUnitPrice;
  const grandTotal = BASE_PAGE_PRICE + extraFollowerCost;
  const vipSummary = getVipDiscountSummary(profile, grandTotal);
  const payableTotal = vipSummary.discountPercent > 0 ? vipSummary.finalAmount : grandTotal;
  const hasVipDiscount = vipSummary.discountPercent > 0 && vipSummary.savingsAmount > 0;
  const walletBalance = Number(profile?.balance || 0);
  const canUseWallet = Boolean(user && walletBalance >= payableTotal);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.user ?? null);
      if (data.user?.email) setEmail(data.user.email);
      if (data.user?.id) {
        supabase
          .from("profiles")
          .select("id, balance, vip_plan, vip_expires_at")
          .eq("id", data.user.id)
          .single()
          .then(({ data: profileData }) => {
            if (isMounted && profileData) setProfile(profileData as Profile);
          });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadSmmPrice = async () => {
      setLoadingCatalog(true);
      try {
        const res = await fetch("/api/smm/services");
        if (!res.ok) throw new Error("Unable to load live SMM pricing.");
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid SMM catalog response.");
        const service = (data as SmmService[]).find((item) => String(item.id) === FACEBOOK_FOLLOWERS_SMM_ID);
        if (service && isMounted) setFacebookFollowerService(service);
      } catch (err) {
        console.warn("Falling back to cached SMM #1141 price:", err);
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    };

    void loadSmmPrice();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, balance, vip_plan, vip_expires_at")
        .eq("id", data.user.id)
        .single();
      if (profileData) setProfile(profileData as Profile);
    }
  };

  const uploadAsset = async (file: File, orderId: string, assetType: "profile" | "cover") => {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    formData.append("orderId", orderId);
    formData.append("assetType", assetType);

    const res = await fetch("/api/upload-page-asset", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to upload ${assetType} photo.`);
    return String(data.url || "N/A");
  };

  const uploadReceipt = async (file: File, orderId: string) => {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    formData.append("orderId", orderId);

    const res = await fetch("/api/upload-receipt", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to upload payment receipt.");
  };

  const buildSpecs = (profileUrl: string, coverUrl: string) => {
    return [
      "Page Wants:",
      `[Name: ${cleanSpec(pageName)}]`,
      "[Category: Custom Facebook Page]",
      "[Region: PH Base]",
      `[FB Admin: ${cleanSpec(facebookLink)}]`,
      `[Profile Pic: ${profileUrl}]`,
      `[Cover Pic: ${coverUrl}]`,
      `[Notes: Bio: ${cleanSpec(fbBio)} | Followers: ${normalizedQuantity.toLocaleString()} via SMM #${FACEBOOK_FOLLOWERS_SMM_ID} | Wait time: within 24 business hours]`
    ].join(" ");
  };

  const handleCopy = () => {
    if (!successOrderId) return;
    navigator.clipboard.writeText(`BS-${successOrderId.slice(0, 8).toUpperCase()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !pageName.trim() || !fbBio.trim() || !facebookLink.trim()) {
      setError("Please complete all required page details.");
      return;
    }

    if (!/^https?:\/\/(www\.)?facebook\.com\//i.test(facebookLink.trim())) {
      setError("Please enter a valid Facebook link starting with https://facebook.com/.");
      return;
    }

    if (!profilePhoto || !coverPhoto) {
      setError("Please upload both profile photo and cover photo.");
      return;
    }

    if (paymentMethod === "GCash" && !receiptFile) {
      setError("Please upload your GCash/top-up receipt before placing the order.");
      return;
    }

    if (normalizedQuantity > maxFollowers) {
      setError(`Followers quantity cannot exceed ${maxFollowers.toLocaleString()}.`);
      return;
    }

    if (paymentMethod === "Wallet") {
      if (!user) {
        setError("Please sign in before paying with wallet balance.");
        return;
      }
      if (!canUseWallet) {
        setError("Insufficient wallet balance. Please top up first or choose GCash.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (paymentMethod === "Wallet" && user) {
        const walletRes = await fetch("/api/checkout-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            serviceId: CUSTOM_PAGE_SERVICE_ID,
            serviceTitle: "Custom Facebook Page + SMM #1141 Followers",
            email: user.email,
            url: "Compiling custom Facebook page order assets...",
            quantity: normalizedQuantity,
            totalPrice: grandTotal,
            smmServiceId: FACEBOOK_FOLLOWERS_SMM_ID
          })
        });

        const walletData = await walletRes.json();
        if (!walletRes.ok) throw new Error(walletData.error || "Wallet payment failed.");

        const order = { id: walletData.orderId };
        if (!order.id) throw new Error("Order was created without a tracking ID.");

        const [profileUrl, coverUrl] = await Promise.all([
          uploadAsset(profilePhoto, order.id, "profile"),
          uploadAsset(coverPhoto, order.id, "cover")
        ]);
        const finalSpecs = buildSpecs(profileUrl, coverUrl);

        const targetRes = await fetch("/api/orders/update-target", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            targetUrl: finalSpecs,
            customerEmail: user.email
          })
        });
        if (!targetRes.ok) {
          const targetData = await targetRes.json();
          throw new Error(targetData.error || "Failed to save page order details.");
        }

        setProfile((current) => current ? { ...current, balance: walletData.newBalance } : current);
        window.dispatchEvent(new Event("balance-update"));
        setSuccessOrderId(order.id);
        setProfilePhoto(null);
        setCoverPhoto(null);
        setReceiptFile(null);

        if (typeof window !== "undefined") {
          localStorage.setItem("last_order_id", order.id);
          localStorage.setItem("last_order_email", user.email || "");
        }
        return;
      }

      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: CUSTOM_PAGE_SERVICE_ID,
          email: email.trim(),
          targetUrl: "Compiling custom Facebook page order assets...",
          amount: grandTotal,
          paymentMethod,
          quantity: normalizedQuantity,
          smmServiceId: FACEBOOK_FOLLOWERS_SMM_ID
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create page order.");

      const order = { id: createData.orderId || createData.data?.id };
      if (!order.id) throw new Error("Order was created without a tracking ID.");

      const [profileUrl, coverUrl] = await Promise.all([
        uploadAsset(profilePhoto, order.id, "profile"),
        uploadAsset(coverPhoto, order.id, "cover")
      ]);
      const finalSpecs = buildSpecs(profileUrl, coverUrl);

      const targetRes = await fetch("/api/orders/update-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          targetUrl: finalSpecs,
          customerEmail: email.trim()
        })
      });
      if (!targetRes.ok) {
        const targetData = await targetRes.json();
        throw new Error(targetData.error || "Failed to save page order details.");
      }

      if (receiptFile) await uploadReceipt(receiptFile, order.id);

      setSuccessOrderId(order.id);
      setProfilePhoto(null);
      setCoverPhoto(null);
      setReceiptFile(null);

      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", order.id);
        localStorage.setItem("last_order_email", email.trim());
      }

      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingId: `BS-${order.id.slice(0, 8).toUpperCase()}`,
          service: "Custom Facebook Page + Facebook Followers SMM #1141",
          email: email.trim(),
          quantity: normalizedQuantity,
          amount: payableTotal,
          paymentMethod,
          details: finalSpecs
        })
      }).catch(() => {});
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "Failed to submit custom page order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#0a0a0a] text-slate-200 relative overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#1877F2]/15 blur-[100px] pointer-events-none" />
        <div className="absolute top-64 right-0 h-80 w-80 rounded-full bg-[#1DB954]/10 blur-[100px] pointer-events-none" />

        <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="text-center">
            <span className="inline-flex rounded-full border border-[#1877F2]/25 bg-[#1877F2]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#4e8df5]">
              Order Page
            </span>
            <h1 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">
              Order a Custom <span className="text-[#1877F2]">Facebook Page</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-slate-400">
              Fill out the page details, upload profile and cover assets, choose your Facebook followers quantity, then pay through GCash or wallet balance.
            </p>
          </div>

          {successOrderId ? (
            <div className="mx-auto w-full max-w-xl rounded-3xl border border-[#1DB954]/25 bg-[#121212]/95 p-6 text-center shadow-2xl sm:p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954]">
                <ShieldCheck size={30} />
              </div>
              <h2 className="mt-5 text-2xl font-black text-white">Order submitted</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-400">
                Please wait within 24 business hours for the page to be done. Save your tracking ID so you can monitor it from the chatbot or Status Tracker.
              </p>
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-800 bg-black/40 p-3">
                <div className="flex-1 select-all font-mono text-lg font-black tracking-widest text-[#1DB954]">
                  BS-{successOrderId.slice(0, 8).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-xl border border-slate-800 bg-[#181818] p-3 text-slate-300 transition hover:text-white"
                  title="Copy tracking ID"
                >
                  {copied ? <Check size={16} className="text-[#1DB954]" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  href={`/?track=${successOrderId}`}
                  className="rounded-full bg-[#1DB954] px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760]"
                >
                  View Pending Order
                </Link>
                <Link
                  href={`/track?id=BS-${successOrderId.slice(0, 8).toUpperCase()}`}
                  className="rounded-full border border-slate-800 bg-[#181818] px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-800"
                >
                  Track Status
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
              <section className="rounded-3xl border border-slate-800/80 bg-[#121212]/95 p-5 shadow-2xl sm:p-7">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-5">
                  <div className="rounded-xl border border-[#1877F2]/20 bg-[#1877F2]/10 p-2 text-[#1877F2]">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Client Order Form</h2>
                    <p className="text-xs font-semibold text-slate-500">All fields are required for admin migration and page setup.</p>
                  </div>
                </div>

                {error && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-5">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Contact Email</label>
                    <input
                      type="email"
                      required
                      disabled={Boolean(user)}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-[#1877F2] disabled:cursor-not-allowed disabled:text-slate-500"
                      placeholder="client@email.com"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Name of the Page</label>
                    <input
                      type="text"
                      required
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-[#1877F2]"
                      placeholder="Example: Pinoy Boosting Services"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">FB Bio</label>
                    <textarea
                      required
                      value={fbBio}
                      onChange={(e) => setFbBio(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 text-sm font-bold leading-relaxed text-white outline-none transition focus:border-[#1877F2]"
                      placeholder="Short page bio or description for the Facebook page."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Facebook Link for Migration / Transfer</label>
                    <input
                      type="url"
                      required
                      value={facebookLink}
                      onChange={(e) => setFacebookLink(e.target.value)}
                      className="w-full rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-[#1877F2]"
                      placeholder="https://facebook.com/your-page-or-profile"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Followers Quantity</label>
                    <input
                      type="number"
                      required
                      min={minFollowers}
                      max={maxFollowers}
                      value={followersQuantity || ""}
                      onChange={(e) => setFollowersQuantity(Number(e.target.value) || 0)}
                      className="w-full rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none transition focus:border-[#1877F2]"
                    />
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      SMM #{FACEBOOK_FOLLOWERS_SMM_ID} live pricing: {formatPhp(followerUnitPrice)} per follower. First {INCLUDED_FOLLOWERS.toLocaleString()} followers are included in the base page package.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FileUpload id="profile-photo" title="Upload Profile Photo" file={profilePhoto} onChange={setProfilePhoto} />
                    <FileUpload id="cover-photo" title="Upload Cover Photo" file={coverPhoto} onChange={setCoverPhoto} />
                  </div>
                </div>
              </section>

              <aside className="space-y-5">
                <div className="rounded-3xl border border-slate-800/80 bg-[#121212]/95 p-5 shadow-2xl sm:p-6">
                  <h3 className="flex items-center gap-2 text-lg font-black text-white">
                    <CreditCard size={18} className="text-[#1877F2]" />
                    Order Summary
                  </h3>
                  <div className="mt-5 space-y-3 border-t border-slate-850 pt-5 text-sm font-semibold text-slate-400">
                    <SummaryRow label="Custom page setup" value={formatPhp(BASE_PAGE_PRICE)} />
                    <SummaryRow label={`Included followers (${INCLUDED_FOLLOWERS.toLocaleString()})`} value="Included" />
                    <SummaryRow label={`Extra followers (${extraFollowers.toLocaleString()})`} value={formatPhp(extraFollowerCost)} />
                    {hasVipDiscount && (
                      <>
                        <SummaryRow label="Regular total" value={formatPhp(grandTotal)} />
                        <SummaryRow label={`VIP discount (${vipSummary.discountPercent}%)`} value={`-${formatPhp(vipSummary.savingsAmount)}`} />
                      </>
                    )}
                    <SummaryRow label={hasVipDiscount ? "VIP payment total" : "Payment total"} value={formatPhp(payableTotal)} strong />
                  </div>
                  {loadingCatalog && (
                    <p className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Loader2 size={12} className="animate-spin" />
                      Loading live SMM #1141 pricing
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-800/80 bg-[#121212]/95 p-5 shadow-2xl sm:p-6">
                  <h3 className="text-lg font-black text-white">Payment</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("GCash")}
                      className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
                        paymentMethod === "GCash"
                          ? "border-[#1877F2] bg-[#1877F2]/15 text-[#4e8df5]"
                          : "border-slate-800 bg-black/30 text-slate-400 hover:text-white"
                      }`}
                    >
                      GCash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("Wallet")}
                      className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
                        paymentMethod === "Wallet"
                          ? "border-[#1DB954] bg-[#1DB954]/15 text-[#1DB954]"
                          : "border-slate-800 bg-black/30 text-slate-400 hover:text-white"
                      }`}
                    >
                      Wallet
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-800 bg-black/35 p-4 text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Scan GCash QR</p>
                    <div className="mx-auto mt-3 flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-2">
                      <Image src="/gcash-qr.png" alt="GCash QR code" width={192} height={192} className="h-full w-full object-contain" />
                    </div>
                    <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500">
                      Pay exactly {formatPhp(payableTotal)}, then upload the receipt below before submitting.
                    </p>
                    {hasVipDiscount && (
                      <p className="mt-2 rounded-xl border border-[#1DB954]/25 bg-[#1DB954]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#1DB954]">
                        Regular {formatPhp(grandTotal)} {"->"} VIP {formatPhp(payableTotal)}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-800 bg-black/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ewallet Balance</p>
                        <p className="mt-1 text-lg font-black text-white">{user ? formatPhp(walletBalance) : "Sign in required"}</p>
                      </div>
                      {user ? (
                        <button
                          type="button"
                          onClick={() => setShowTopUp(true)}
                          className="rounded-full border border-[#1877F2]/30 bg-[#1877F2]/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#4e8df5] transition hover:bg-[#1877F2]/20"
                        >
                          Top Up
                        </button>
                      ) : (
                        <Link
                          href="/login"
                          className="rounded-full border border-[#1877F2]/30 bg-[#1877F2]/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#4e8df5] transition hover:bg-[#1877F2]/20"
                        >
                          Sign In
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <FileUpload id="receipt-file" title="Upload Payment Receipt" file={receiptFile} onChange={setReceiptFile} compact />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1DB954] px-5 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-emerald-500/10 transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Submit Order Page
                  </button>
                  <p className="mt-3 text-center text-[11px] font-semibold leading-relaxed text-slate-500">
                    After ordering, wait within 24 business hours for the page to be done.
                  </p>
                </div>
              </aside>
            </form>
          )}
        </section>
      </main>
      <Footer />
      {user && (
        <TopUpModal
          isOpen={showTopUp}
          onClose={() => setShowTopUp(false)}
          user={user}
          onTopUpSuccess={refreshProfile}
        />
      )}
    </>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? "border-t border-slate-800 pt-4" : ""}`}>
      <span className={strong ? "font-black uppercase tracking-wider text-white" : ""}>{label}</span>
      <span className={strong ? "text-xl font-black text-[#1877F2]" : "font-mono text-white"}>{value}</span>
    </div>
  );
}

function FileUpload({
  id,
  title,
  file,
  onChange,
  compact = false
}: {
  id: string;
  title: string;
  file: File | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</label>
      <label
        htmlFor={id}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-black/35 px-4 text-center transition hover:border-[#1877F2]/60 hover:bg-[#1877F2]/5 ${
          compact ? "min-h-24 py-4" : "min-h-36 py-6"
        }`}
      >
        <div className="rounded-full border border-slate-800 bg-[#181818] p-3 text-[#1877F2]">
          {file ? <ImageIcon size={20} /> : <UploadCloud size={20} />}
        </div>
        <span className="mt-3 max-w-full truncate text-xs font-black uppercase tracking-wider text-white">
          {file ? file.name : "Click to upload"}
        </span>
        <span className="mt-1 text-[10px] font-semibold text-slate-500">PNG, JPG, or screenshot</span>
        <input
          id={id}
          type="file"
          accept="image/*"
          required
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
}
