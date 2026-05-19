"use client";

import { useState } from "react";
import { X, Loader2, Upload, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function TopUpModal({ isOpen, onClose, user, onTopUpSuccess }: { isOpen: boolean, onClose: () => void, user: any, onTopUpSuccess: () => void }) {
  const [amount, setAmount] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount to top up.");
      return;
    }
    if (!file) {
      setError("Please select a GCash receipt screenshot.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);
      formData.append("email", user.email);
      formData.append("amount", amount);

      const res = await fetch("/api/topup/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit top-up request.");
      }

      setSuccess(true);
      setTimeout(() => {
        onTopUpSuccess();
        onClose();
        setSuccess(false);
        setAmount("");
        setFile(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to submit top-up request.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121212] w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800/60 bg-[#181818]">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Wallet className="text-[#1DB954]" size={24} /> Top Up Wallet
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 p-1.5 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {success ? (
            <div className="bg-[#1DB954]/10 border border-[#1DB954]/20 p-6 rounded-xl text-center space-y-3">
              <div className="w-16 h-16 bg-[#1DB954]/20 text-[#1DB954] rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet size={32} />
              </div>
              <h3 className="text-lg font-bold text-[#1DB954]">Top-Up Submitted!</h3>
              <p className="text-sm text-slate-300 font-medium leading-relaxed">
                Your GCash receipt has been securely uploaded. An admin will verify the payment and credit ₱{Number(amount).toFixed(0)} to your wallet shortly.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm font-semibold text-center">
                  {error}
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount (PHP)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#282828] text-white border border-slate-700 rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-[#1DB954] font-semibold transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* QR Code section */}
              <div className="bg-[#181818] p-5 rounded-xl border border-slate-800 flex flex-col items-center gap-4">
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-slate-300">Scan to Pay via GCash</p>
                  <p className="text-xs text-slate-500">Send exactly the amount entered above</p>
                </div>
                <div className="w-48 h-48 bg-white p-2 rounded-xl flex items-center justify-center">
                  <img src="/gcash-qr.png" alt="GCash QR" className="w-full h-full object-contain" />
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload GCash Receipt</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-[#282828] hover:border-[#1DB954] transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-6 h-6 mb-2 text-slate-400 group-hover:text-[#1DB954] transition-colors" />
                    <p className="text-xs text-slate-400 font-medium group-hover:text-slate-300">
                      {file ? <span className="text-[#1DB954] font-bold">{file.name}</span> : "Click to select screenshot"}
                    </p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isUploading ? (
                  <><Loader2 className="animate-spin" size={18} /> Submitting...</>
                ) : (
                  "Submit Top-Up"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
