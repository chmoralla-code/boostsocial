"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Wallet, CheckCircle } from "lucide-react";

export function TopUpModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onTopUpSuccess: () => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // null = still checking, true = ready, false = gateway not configured.
  const [paymongoConfigured, setPaymongoConfigured] = useState<boolean | null>(null);

  // Only offer the gateway when the server says the keys are present, so a
  // half-configured deploy never shows a button that cannot work.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/paymongo/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setPaymongoConfigured(Boolean(d.enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const gatewayReady = paymongoConfigured !== false;

  const handlePaymongo = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount to top up.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const data = await res.json();

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Could not start the PayMongo checkout.");
      }

      // Hand off to PayMongo's own page. The wallet is credited by the
      // webhook, not by the return page, so nothing here decides money.
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err.message || "Could not start the PayMongo checkout.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-elevated w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-300">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border/60 bg-card">
          <h2 className="text-xl font-black text-fg tracking-tight flex items-center gap-2">
            <Wallet className="text-[#1877F2]" size={24} /> Top Up Wallet
          </h2>
          <button onClick={onClose} disabled={isSubmitting} className="text-muted hover:text-fg transition-colors bg-elevated/50 hover:bg-elevated/50 p-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm font-semibold text-center">
              {error}
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Amount (PHP)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">₱</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                className="w-full bg-card text-fg border border-border rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-[#1877F2] font-semibold transition-colors"
                placeholder="500.00"
                min="50"
              />
            </div>
            <p className="text-[10px] text-muted font-semibold">Minimum top-up is ₱50.</p>
          </div>

          {/* PayMongo checkout */}
          <div className="rounded-xl border border-[#0070E0]/25 bg-[#0070E0]/8 p-4 space-y-2">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[#1877F2]">
              <CheckCircle size={14} /> Secure checkout
            </p>
            <p className="text-[11px] text-muted font-semibold leading-relaxed">
              You'll be taken to PayMongo to pay with GCash, Maya, GrabPay or QR Ph.
              Your wallet is credited automatically the moment the payment is confirmed —
              no receipt upload needed.
            </p>
          </div>

          {!gatewayReady && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-lg text-xs font-semibold text-center">
              Online payment is temporarily unavailable. Please try again shortly.
            </div>
          )}

          <button
            onClick={handlePaymongo}
            disabled={isSubmitting || !gatewayReady}
            className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(24,119,242,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="animate-spin" size={18} /> Starting PayMongo...</>
            ) : (
              "Pay with PayMongo"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
