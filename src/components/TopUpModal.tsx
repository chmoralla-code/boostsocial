"use client";

import { useState, useRef } from "react";
import { X, Loader2, Upload, Wallet, CheckCircle, Clock, AlertTriangle, Ban } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { compressImageWithStats, formatBytes, type CompressResult } from "@/utils/imageCompressor";

const MAX_RECEIPT_DIMENSION = 1280;
const RECEIPT_QUALITY = 0.76;

export function TopUpModal({ isOpen, onClose, user, onTopUpSuccess }: { isOpen: boolean, onClose: () => void, user: any, onTopUpSuccess: () => void }) {
  const [amount, setAmount] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successAutoApproved, setSuccessAutoApproved] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"GCash" | "BPI">("GCash");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "compressing" | "submitting" | "reading" | "verifying">("idle");
  const [compressState, setCompressState] = useState<CompressResult | null>(null);
  const [compressProgress, setCompressProgress] = useState(0);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount to top up.");
      return;
    }
    if (!file) {
      setError("Please select a payment receipt screenshot.");
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadStatus("compressing");
    setCompressState(null);
    setCompressProgress(0.1);

    try {
      // Client-side compression shrinks the GCash receipt before upload,
      // showing a live "compressing" effect with a real before/after byte
      // readout. The server re-compresses as a safety net regardless.
      const result = await compressImageWithStats(file, {
        maxDimension: MAX_RECEIPT_DIMENSION,
        quality: RECEIPT_QUALITY,
        onProgress: (p) => {
          setCompressProgress(p.stage === "loading" ? 0.2 : p.stage === "resizing" ? 0.45 : p.stage === "encoding" ? 0.7 : 0.95);
        },
      });
      setCompressState(result);
      setCompressProgress(1);
      // Hold the "optimized" readout briefly so the user sees the savings.
      await new Promise((r) => setTimeout(r, 350));
      setUploadStatus("submitting");

      const formData = new FormData();
      formData.append("file", result.file);
      formData.append("userId", user.id);
      formData.append("email", user.email);
      formData.append("amount", amount);

      // Show reading status midway through upload
      setTimeout(() => setUploadStatus("reading"), 800);

      const res = await fetch("/api/topup/create", {
        method: "POST",
        body: formData,
      });

      setUploadStatus("verifying");

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit top-up request.");
      }

      if (data.rejectedAsFake) {
        setError("Suspicious receipt detected — the image appears to be AI-generated. Please upload a real payment screenshot.");
        setUploadStatus("idle");
        return;
      }

      if (data.rejectedAsDuplicate) {
        setError("Duplicate receipt detected — this receipt was already used for another transaction. Please upload a different one.");
        setUploadStatus("idle");
        return;
      }

      setSuccess(true);
      setSuccessAutoApproved(data.autoApproved === true);
      setTimeout(() => {
        onTopUpSuccess();
        onClose();
        setSuccess(false);
        setSuccessAutoApproved(false);
        setUploadStatus("idle");
        setCompressState(null);
        setCompressProgress(0);
        setAmount("");
        setFile(null);
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Failed to submit top-up request.");
      setUploadStatus("idle");
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
                  : `Your payment receipt has been securely uploaded. An admin will verify the payment and credit ₱${Number(amount).toFixed(0)} to your wallet shortly.`
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

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("GCash")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
                      paymentMethod === "GCash"
                        ? "border-[#1877F2] bg-[#1877F2]/15 text-[#1877F2]"
                        : "border-border bg-card text-muted hover:text-fg"
                    }`}
                  >
                    📱 GCash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("BPI")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
                      paymentMethod === "BPI"
                        ? "border-[#D42027] bg-[#D42027]/15 text-[#D42027]"
                        : "border-border bg-card text-muted hover:text-fg"
                    }`}
                  >
                    <img src="/bpi-logo.svg" alt="BPI" className="h-4 w-auto" />
                    BPI
                  </button>
                </div>
              </div>

              {/* GCash QR */}
              {paymentMethod === "GCash" && (
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
              )}

              {/* BPI Bank Transfer */}
              {paymentMethod === "BPI" && (
                <div className="bg-card p-5 rounded-xl border border-border flex flex-col items-center gap-4">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-fg">BPI Bank Transfer</p>
                    <p className="text-xs text-muted">Send exactly the amount entered above</p>
                  </div>
                  <div className="w-full bg-white p-4 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <img src="/bpi-logo.svg" alt="BPI" className="h-10 w-auto mx-auto mb-3" />
                      <div className="bg-[#D42027]/5 border border-[#D42027]/20 rounded-lg p-3">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted mb-1">Account Number</p>
                        <p className="text-xl font-black text-[#D42027] tracking-widest select-all">4059901356</p>
                      </div>
                      <button type="button" onClick={() => { navigator.clipboard.writeText('4059901356'); }} className="mt-2 text-[8px] bg-[#D42027]/10 hover:bg-[#D42027]/20 text-[#D42027] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95 w-full">Copy Account Number</button>
                    </div>
                  </div>
                  <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <p className="text-[9px] text-amber-400 font-bold leading-relaxed text-center">
                      ⚠️ If paying via GCash to BPI, add ₱15 transfer fee or order stays Pending.
                    </p>
                  </div>
                </div>
              )}

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Upload Payment Receipt</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-border border-dashed rounded-xl cursor-pointer hover:bg-card hover:border-[#1877F2] transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-6 h-6 mb-2 text-muted group-hover:text-[#1877F2] transition-colors" />
                    <p className="text-xs text-muted font-medium group-hover:text-fg">
                      {file ? <span className="text-[#1877F2] font-bold">{file.name}</span> : "Click to select screenshot"}
                    </p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>

                {/* Compressing effect — live size reduction readout for GCash receipts. */}
                {uploadStatus === "compressing" && file && (
                  <div className="rounded-xl border border-[#1877F2]/25 bg-[#1877F2]/8 p-3 space-y-2 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 text-[#1877F2]">
                        <Loader2 size={12} className="animate-spin" />
                        {compressState?.savedBytes ? "Receipt optimized" : "Compressing receipt..."}
                      </span>
                      <span className="tabular-nums">
                        {compressState?.savedBytes ? (
                          <span className="text-[#1DB954]">
                            {formatBytes(compressState.originalSize)} → {formatBytes(compressState.compressedSize)}
                          </span>
                        ) : (
                          <span className="text-muted">{formatBytes(file.size)}</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1877F2]/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1877F2] to-[#4e8df5] transition-[width] duration-300 ease-out"
                        style={{ width: `${Math.round(compressProgress * 100)}%` }}
                      />
                    </div>
                    {compressState?.savedBytes ? (
                      <p className="text-[9px] text-[#1DB954] font-bold">
                        Saved {formatBytes(compressState.savedBytes)} ({Math.round(compressState.ratio * 100)}% smaller) before upload.
                      </p>
                    ) : (
                      <p className="text-[9px] text-muted font-semibold">
                        Resizing & re-encoding to a compact JPEG before upload.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(24,119,242,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isUploading ? (
                  <><Loader2 className="animate-spin" size={18} /> {
                    uploadStatus === "compressing" ? "Compressing receipt..." :
                    uploadStatus === "submitting" ? "Submitting..." :
                    uploadStatus === "reading" ? "Reading receipt..." :
                    uploadStatus === "verifying" ? "Verifying amount..." :
                    "Submitting..."
                  }</>
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
