"use client";

import { useState } from "react";
import { X, Loader2, Upload, Wallet, CheckCircle, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const MAX_RECEIPT_DIMENSION = 1280;
const TARGET_RECEIPT_BYTES = 900 * 1024;

async function compressReceiptImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= TARGET_RECEIPT_BYTES) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });

    const scale = Math.min(1, MAX_RECEIPT_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.76);
    });

    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error("Receipt compression failed, using original image:", err);
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function TopUpModal({ isOpen, onClose, user, onTopUpSuccess }: { isOpen: boolean, onClose: () => void, user: any, onTopUpSuccess: () => void }) {
  const [amount, setAmount] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successAutoApproved, setSuccessAutoApproved] = useState(false);
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
      const uploadFile = await compressReceiptImage(file);
      const formData = new FormData();
      formData.append("file", uploadFile);
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
      setSuccessAutoApproved(data.autoApproved === true);
      setTimeout(() => {
        onTopUpSuccess();
        onClose();
        setSuccess(false);
        setSuccessAutoApproved(false);
        setAmount("");
        setFile(null);
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Failed to submit top-up request.");
    } finally {
      setIsUploading(false);
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
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors bg-elevated/50 hover:bg-elevated/50 p-1.5 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {success ? (
            <div className={`${successAutoApproved ? 'bg-[#1DB954]/10 border-[#1DB954]/20' : 'bg-[#1877F2]/10 border-[#1877F2]/20'} border p-6 rounded-xl text-center space-y-3`}>
              <div className={`w-16 h-16 ${successAutoApproved ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'bg-[#1877F2]/20 text-[#1877F2]'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {successAutoApproved ? <CheckCircle size={32} /> : <Clock size={32} />}
              </div>
              <h3 className={`text-lg font-bold ${successAutoApproved ? 'text-[#1DB954]' : 'text-[#1877F2]'}`}>
                {successAutoApproved ? 'Top-Up Approved! 🚀' : 'Top-Up Submitted!'}
              </h3>
              <p className="text-sm text-fg font-medium leading-relaxed">
                {successAutoApproved
                  ? `Your PHP ${Number(amount).toFixed(0)} has been AI-verified and instantly credited to your wallet!`
                  : `Your GCash receipt has been securely uploaded. An admin will verify the payment and credit ₱${Number(amount).toFixed(0)} to your wallet shortly.`
                }
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
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Amount (PHP)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">₱</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-card text-fg border border-border rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-[#1877F2] font-semibold transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* QR Code section */}
              <div className="bg-card p-5 rounded-xl border border-border flex flex-col items-center gap-4">
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-fg">Scan to Pay via GCash</p>
                  <p className="text-xs text-muted">Send exactly the amount entered above</p>
                </div>
                <div className="w-48 h-48 bg-white p-2 rounded-xl flex items-center justify-center">
                  <img src="/gcash-qr.png" alt="GCash QR" className="w-full h-full object-contain" />
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 bg-[#1877F2]/10 border border-[#1877F2]/20 px-3 py-1.5 rounded-lg">
                  <span className="text-[10px] font-black text-[#1877F2] tracking-wider">📞 09505339963 • Henry S.</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText('09505339963'); }} className="text-[8px] bg-[#1877F2]/20 hover:bg-[#1877F2]/40 text-[#1877F2] font-black uppercase tracking-wider px-2 py-0.5 rounded-md transition-all cursor-pointer active:scale-95">Copy</button>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Upload GCash Receipt</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-border border-dashed rounded-xl cursor-pointer hover:bg-card hover:border-[#1877F2] transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-6 h-6 mb-2 text-muted group-hover:text-[#1877F2] transition-colors" />
                    <p className="text-xs text-muted font-medium group-hover:text-fg">
                      {file ? <span className="text-[#1877F2] font-bold">{file.name}</span> : "Click to select screenshot"}
                    </p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(24,119,242,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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
