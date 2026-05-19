"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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

  const isPageService = serviceTitle.toLowerCase().includes("page");

  // Dynamic min quantity and free trial amount based on JSON description pack
  const parsedDetails = (() => {
    const defaults = {
      min_quantity: isPageService ? 1 : 100,
      free_trial_amount: isPageService ? 0 : 50,
    };

    if (service && service.description) {
      try {
        if (service.description.trim().startsWith("{")) {
          const p = JSON.parse(service.description);
          return {
            min_quantity: isPageService ? 1 : (Number(p.min_quantity) || defaults.min_quantity),
            free_trial_amount: isPageService ? 0 : (Number(p.free_trial_amount) || defaults.free_trial_amount),
          };
        }
      } catch (e) {}
    }
    return defaults;
  })();

  useEffect(() => {
    if (parsedDetails.min_quantity > 0 && quantity < parsedDetails.min_quantity) {
      setQuantity(parsedDetails.min_quantity);
    }
  }, [parsedDetails.min_quantity]);

  // Anti-Spam Math Verification
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const supabase = createClient();

  const generateCaptcha = () => {
    setNum1(Math.floor(Math.random() * 8) + 2); // 2-9
    setNum2(Math.floor(Math.random() * 8) + 2); // 2-9
    setCaptchaAnswer("");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`BS-${orderId.slice(0, 8).toUpperCase()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      generateCaptcha();
      setError("");
      setSuccess(false);
      
      if (presetQuantity) {
        setQuantity(presetQuantity);
      } else {
        setQuantity(isPageService ? 1 : 1000);
      }
      
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUser(data.user);
          setEmail(data.user.email || "");
          supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: pData }) => {
            if (pData) setProfile(pData);
          });
        }
      });
    }
  }, [isOpen, presetQuantity, isPageService]);

  if (!isOpen) return null;

  const totalPrice = isPageService 
    ? quantity * serviceBasePrice 
    : (quantity / 1000) * serviceBasePrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    if (quantity < parsedDetails.min_quantity) {
      setError(`Minimum quantity is ${parsedDetails.min_quantity}.`);
      return;
    }

    // Validate CAPTCHA
    if (parseInt(captchaAnswer) !== num1 + num2) {
      setError(`Verification failed: ${num1} + ${num2} equals ${num1 + num2}. Prove you are human!`);
      generateCaptcha();
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const { data: insertData, error: insertError } = await supabase
        .from('orders')
        .insert([
          {
            service_id: serviceId,
            customer_email: email.trim(),
            target_url: url.trim(),
            amount: totalPrice,
            status: 'Pending',
            quantity: quantity
          }
        ])
        .select('id')
        .single();

      if (insertError) throw insertError;

      setOrderId(insertData.id);
      setIsWalletPayment(false);
      setSuccess(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", insertData.id);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      generateCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWalletCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !user) return;

    if (quantity < parsedDetails.min_quantity) {
      setError(`Minimum quantity is ${parsedDetails.min_quantity}.`);
      return;
    }

    if (Number(profile?.balance || 0) < totalPrice) {
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
          serviceId,
          email: user.email,
          url: url.trim(),
          quantity,
          totalPrice
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Wallet checkout failed");
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
        
        <div className="p-8">
          <h2 className="text-2xl font-black text-white mb-1.5 tracking-tight flex items-center gap-2">
            Order <span className="text-[#1DB954]">{serviceTitle}</span>
          </h2>
          <p className="text-slate-400 text-sm mb-6">Process your amplification request securely.</p>

          {success ? (
            <div className="bg-[#121212] text-white p-5 rounded-xl border border-slate-800 text-center space-y-4 animate-in zoom-in duration-300 max-h-[72vh] overflow-y-auto">
              <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 text-[#1DB954] rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-base font-bold text-white">Order Registered!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Please copy your Tracking ID for real-time support tracking:</p>
              </div>
              
              <div className="space-y-3">
                {/* Tracking ID (User Friendly) */}
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block mb-1">Your Tracking ID</span>
                  <div className="flex gap-2 items-center w-full">
                    <div className="flex-grow bg-[#282828] border border-slate-700/80 p-2.5 rounded-xl font-mono text-xs sm:text-sm text-[#1DB954] font-black tracking-widest text-center select-all">
                      BS-{orderId.slice(0, 8).toUpperCase()}
                    </div>
                    <button
                      onClick={handleCopy}
                      type="button"
                      className="bg-[#282828] hover:bg-[#333] border border-slate-700/80 p-2.5 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                      title="Copy Tracking ID"
                    >
                      {copied ? <Check size={16} className="text-[#1DB954]" /> : <Copy size={16} />}
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
                <div className="text-left bg-[#1DB954]/10 border border-[#1DB954]/25 p-5 rounded-xl space-y-3.5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1DB954] flex items-center gap-1.5">
                    🎉 Balance Payment Successful!
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    We deducted <strong className="text-white">₱{totalPrice.toFixed(0)} PHP</strong> directly from your account wallet balance. Your boost has been automatically approved and is already set to **Processing**!
                  </p>
                  <div className="bg-[#121212] border border-slate-800/80 p-3.5 rounded-lg text-xs space-y-1 text-center">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Amplification Flow Status</span>
                    <span className="text-[#1DB954] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                      ⚡ ACTIVE & PROCESSING
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-450 leading-relaxed font-bold">
                    No further actions or manual GCash receipt verification are required. Our system will deliver your complete boost package shortly!
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-left bg-[#181818] border border-slate-850 p-4 rounded-xl space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#1DB954]">💳 Trial & GCash Payment Steps</h3>
                    
                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="flex gap-2">
                        <span className="bg-[#1DB954]/10 text-[#1DB954] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                        <p>
                          <strong>Get {parsedDetails.free_trial_amount} Free Trial:</strong> We will first deliver {parsedDetails.free_trial_amount} free followers, reactions, or views to your target link so you can verify our speed & authenticity!
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <span className="bg-[#1DB954]/10 text-[#1DB954] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                        <p>
                          <strong>Pay via GCash:</strong> Once you see the free {parsedDetails.free_trial_amount} delivered, scan the QR code below to pay the remaining balance: <strong className="text-[#1DB954]">₱{totalPrice.toFixed(0)}</strong>.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <span className="bg-[#1DB954]/10 text-[#1DB954] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
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
                </>
              )}

              <button 
                onClick={onClose}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3 rounded-full transition-all duration-300 uppercase text-xs tracking-wider mt-2"
              >
                Close & View Website
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {user ? (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                    <span>Email Address</span>
                    <span className="text-[#1DB954] text-[10px] font-black uppercase tracking-wider">✓ Active Profile</span>
                  </label>
                  <input 
                    type="email" 
                    required
                    disabled
                    value={email}
                    className="w-full px-4 py-3 rounded-xl bg-[#1e1e1e] border border-[#1DB954]/30 text-slate-400 cursor-not-allowed text-sm font-medium"
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
                    className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1DB954] text-white transition-all text-sm font-medium"
                    placeholder="you@example.com"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed text-left">
                    💡 Want to track orders automatically? <a href="/login" className="text-[#1DB954] font-extrabold hover:underline">Sign In / Register</a> first!
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Link / URL</label>
                <input 
                  type="url" 
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1DB954] text-white transition-all text-sm font-medium"
                  placeholder="https://facebook.com/your-page"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  {isPageService ? "Number of Pages" : "Quantity (per 1,000)"}
                </label>
                <input 
                  type="number" 
                  required
                  min={parsedDetails.min_quantity}
                  step={isPageService ? "1" : "100"}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1DB954] text-white transition-all text-sm font-bold"
                  placeholder={String(parsedDetails.min_quantity)}
                />
                <div className="flex justify-between items-center mt-2 bg-[#121212] px-3.5 py-2.5 rounded-lg border border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated Total:</span>
                  <span className="text-lg font-black text-white">₱{totalPrice.toFixed(0)}</span>
                </div>
              </div>

              {/* Anti-Spam Human Verification Verification Check */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  🛡️ Human Verification
                </label>
                <div className="flex gap-3 items-center">
                  <div className="bg-[#121212] px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-black text-[#1DB954] tracking-wide whitespace-nowrap">
                    {num1} + {num2} = ?
                  </div>
                  <input 
                    type="number" 
                    required
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1DB954] text-white transition-all text-sm font-bold"
                    placeholder="Prove you are human"
                  />
                </div>
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
                    className="w-full bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/50 disabled:opacity-50 text-[#1DB954] font-extrabold py-3.5 rounded-full transition-all duration-300 flex justify-center items-center gap-2 tracking-wider uppercase text-xs"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin text-[#1DB954]" size={18} /> : `Pay with Wallet (₱${totalPrice.toFixed(0)})`}
                  </button>
                )}
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-700 text-black font-extrabold py-3.5 rounded-full transition-all duration-300 flex justify-center items-center gap-2 tracking-wider uppercase text-xs shadow-[0_0_15px_rgba(29,185,84,0.3)]"
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
