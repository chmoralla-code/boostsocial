"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
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

  const supabase = createClient();

  if (!isOpen) return null;

  const totalPrice = (quantity / 1000) * serviceBasePrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    if (quantity < 100) {
      setError("Minimum quantity is 100.");
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
            customer_email: email,
            target_url: url,
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
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setOrderId("");
        setEmail("");
        setUrl("");
        setQuantity(1000);
      }, 5000); // Wait longer so they can copy it
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Order {serviceTitle}</h2>
          <p className="text-slate-600 mb-6">Enter your details to process the order.</p>

          {success ? (
            <div className="bg-green-50 text-green-700 p-6 rounded-xl border border-green-200 text-center font-medium">
              <p className="text-lg font-bold mb-2">Order placed successfully!</p>
              <p className="text-sm">Your Order ID is:</p>
              <div className="bg-white border border-green-300 p-2 mt-2 rounded font-mono text-xs text-slate-800 break-all select-all">
                {orderId}
              </div>
              <p className="text-xs mt-3 opacity-80">You can use this ID in our support chat to track your order.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target URL</label>
                <input 
                  type="url" 
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  placeholder="https://facebook.com/your-page"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input 
                  type="number" 
                  required
                  min="100"
                  step="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  placeholder="1000"
                />
                <p className="text-sm text-slate-500 mt-1">Total Price: <span className="font-bold text-slate-900">${totalPrice.toFixed(2)}</span></p>
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-semibold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2 mt-4"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Complete Order'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
