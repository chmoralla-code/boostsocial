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
}

export function OrderModal({ isOpen, onClose, serviceId, serviceTitle, serviceBasePrice }: OrderModalProps) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPrice = (quantity / 1000) * serviceBasePrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    if (quantity < 100) {
      setError("Minimum quantity is 100.");
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

              {/* 🎁 Trial & Payment Instructions */}
              <div className="text-left bg-[#181818] border border-slate-850 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#1DB954]">💳 Trial & GCash Payment Steps</h3>
                
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex gap-2">
                    <span className="bg-[#1DB954]/10 text-[#1DB954] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                    <p>
                      <strong>Get 50 Free Trial:</strong> We will first deliver 50 free followers, reactions, or views to your target link so you can verify our speed & authenticity!
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className="bg-[#1DB954]/10 text-[#1DB954] font-bold w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                    <p>
                      <strong>Pay via GCash:</strong> Once you see the free 50 delivered, scan the QR code below to pay the remaining balance: <strong className="text-[#1DB954]">₱{totalPrice.toFixed(2)}</strong>.
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

              <button 
                onClick={onClose}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3 rounded-full transition-all duration-300 uppercase text-xs tracking-wider mt-2"
              >
                Close & View Website
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              </div>
              
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quantity (per 1,000)</label>
                <input 
                  type="number" 
                  required
                  min="100"
                  step="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl bg-[#282828] border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-[#1DB954] text-white transition-all text-sm font-bold"
                  placeholder="1000"
                />
                <div className="flex justify-between items-center mt-2 bg-[#121212] px-3.5 py-2.5 rounded-lg border border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated Total:</span>
                  <span className="text-lg font-black text-white">₱{totalPrice.toFixed(2)}</span>
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

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-700 text-black font-extrabold py-3.5 rounded-full transition-all duration-300 flex justify-center items-center gap-2 mt-4 tracking-wider uppercase text-xs"
              >
                {isSubmitting ? <Loader2 className="animate-spin text-black" size={18} /> : 'Place Order'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
