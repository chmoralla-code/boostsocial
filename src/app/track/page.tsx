"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Search, Loader2, ShieldCheck, CheckCircle2, AlertCircle, Copy, Check, UploadCloud, Image, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { format } from "date-fns";
import { compressImage } from "@/utils/imageCompressor";

export default function TrackPage() {
  const [trackingInput, setTrackingInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  
  // File upload state for Pending orders
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const supabase = createClient();

  // Parse order ID from URL query if present (e.g. /track?id=BS-D5D1D849)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("id") || params.get("orderId") || "";
      if (queryId) {
        setTrackingInput(queryId);
        handleTrackOrder(queryId);
      }
    }
  }, []);

  // Subscribe to real-time status updates for the tracked order
  useEffect(() => {
    if (!order?.id) return;

    const channel = supabase
      .channel(`order-status-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          console.log("Real-time order update received:", payload.new);
          setOrder((prevOrder: any) => {
            if (!prevOrder) return null;
            return {
              ...prevOrder,
              ...payload.new,
              services: prevOrder.services // retain joined services relation metadata
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id]);


  const handleCopy = (idStr: string) => {
    const displayId = `BS-${idStr.slice(0, 8).toUpperCase()}`;
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrackOrder = async (searchId: string) => {
    const cleanId = searchId.trim();
    if (!cleanId) return;

    setLoading(false);
    setError("");
    setOrder(null);
    setUploadSuccess(false);
    setSelectedFile(null);
    setLoading(true);

    try {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const trackRegex = /BS-([0-9a-f]{8})/i;
      
      const uuidMatch = cleanId.match(uuidRegex);
      const trackMatch = cleanId.match(trackRegex);
      
      let query = supabase.from('orders').select('*, services(title)');
      
      if (uuidMatch) {
        query = query.eq('id', uuidMatch[0]);
      } else if (trackMatch) {
        const lowerHex = trackMatch[1].toLowerCase();
        query = query
          .gte('id', `${lowerHex}-0000-0000-0000-000000000000`)
          .lte('id', `${lowerHex}-ffff-ffff-ffff-ffffffffffff`);
      } else if (cleanId.length === 8) {
        // Plain 8 character hex
        const lowerHex = cleanId.toLowerCase();
        query = query
          .gte('id', `${lowerHex}-0000-0000-0000-000000000000`)
          .lte('id', `${lowerHex}-ffff-ffff-ffff-ffffffffffff`);
      } else {
        throw new Error("Invalid Tracking ID format. It should look like BS-D5D1D849.");
      }

      const { data, error: fetchErr } = await query.single();

      if (fetchErr || !data) {
        throw new Error("Order not found. Please double check your Tracking ID.");
      }

      setOrder(data);
    } catch (err: any) {
      setError(err.message || "Failed to find order status.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadSuccess(false);
    }
  };

  const handleUploadReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !order) return;

    setUploading(true);
    setUploadSuccess(false);

    try {
      const compressed = await compressImage(selectedFile);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("orderId", order.id);

      const res = await fetch("/api/upload-receipt", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload receipt failed");
      }

      setUploadSuccess(true);
      setSelectedFile(null);
      
      // Refresh order details to show pending payment verification is set up
      handleTrackOrder(order.id);
    } catch (err: any) {
      alert(`❌ Error uploading screenshot: ${err.message || err.toString()}`);
    } finally {
      setUploading(false);
    }
  };

  const getStepStatus = (stepName: string, orderStatus: string) => {
    if (orderStatus === "Cancelled") return "cancelled";
    
    if (stepName === "placed") return "completed";
    
    if (stepName === "payment") {
      return orderStatus === "Pending" ? "current" : "completed";
    }
    
    if (stepName === "processing") {
      if (orderStatus === "Pending") return "upcoming";
      return orderStatus === "Processing" ? "current" : "completed";
    }
    
    if (stepName === "completed") {
      return orderStatus === "Completed" ? "completed" : "upcoming";
    }
    
    return "upcoming";
  };

  return (
    <>
      <Header />

      <main className="flex-grow flex flex-col items-center pt-24 pb-20 relative overflow-hidden bg-[#121212] min-h-screen">
        {/* Facebook Blue glow backdrop */}
        <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full fb-glow-blob"></div>
          <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full fb-glow-blob"></div>
        </div>

        <div className="w-full max-w-2xl mx-auto px-4 z-10 text-center">
          <span className="bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
            <ShieldCheck size={10} /> SMM Status Terminal
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
            Track Your <span className="text-[#1877F2]">Boost Order</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-10 font-semibold">
            Enter your unique Tracking ID received at checkout to inspect real-time progress.
          </p>

          {/* Search bar */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleTrackOrder(trackingInput);
            }}
            className="flex gap-2.5 bg-[#181818]/60 border border-slate-800/80 p-2.5 rounded-2xl shadow-xl w-full"
          >
            <div className="flex-1 flex items-center gap-3 px-3.5 bg-[#121212] rounded-xl border border-slate-800">
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                required
                placeholder="Enter Tracking ID (e.g. BS-D5D1D849)"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                className="w-full py-3 bg-transparent text-white font-mono text-sm font-semibold focus:outline-none placeholder-slate-600 uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !trackingInput.trim()}
              className="bg-[#1877F2] hover:bg-[#4e8df5] disabled:bg-slate-800 text-white font-black px-6 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider flex-shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Track"}
            </button>
          </form>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="animate-spin text-[#1877F2]" size={32} />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Accessing ledger...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-8 bg-red-500/10 border border-red-500/20 text-red-500 p-5 rounded-2xl flex items-start gap-3.5 text-left">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase tracking-wider">Tracking Failed</h4>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Order Details Panel */}
          {order && (
            <div className="mt-8 space-y-6 text-left animate-in slide-in-from-bottom-4 duration-300">
              {/* Dynamic Page Delivery & Transfer Active Warning Notice */}
              {(order.services?.title?.toLowerCase()?.includes("page") || order.target_url?.toLowerCase()?.includes("page wants")) && (
                <div className="bg-[#1877F2]/10 border border-[#1877F2]/25 p-5 rounded-3xl text-left space-y-2.5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#1877F2]/5 rounded-full blur-xl pointer-events-none"></div>
                  <span className="text-xs font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
                    ⏳ Page Creation & Handoff Active
                  </span>
                  <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                    Your customized pre-made Facebook Page will be fully created, boosted with 10k followers, and transferred to you **within 24 hours**. 
                    You will receive an email containing the Facebook page link or a direct message from **Cyrhiel Moralla (Admin)** as soon as the page is ready. You can track your page creation status in real-time below!
                  </p>
                </div>
              )}

              {/* Receipt card info */}
              <div className="bg-[#181818]/60 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
                <div className="flex justify-between items-start gap-4 pb-5 border-b border-slate-800/60">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-[#1877F2] tracking-widest">
                        BS-{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <button 
                        onClick={() => handleCopy(order.id)}
                        className="text-slate-500 hover:text-white p-1 hover:bg-[#282828] rounded transition-all cursor-pointer"
                        title="Copy tracking ID"
                      >
                        {copied ? <Check size={13} className="text-[#1877F2]" /> : <Copy size={13} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                      Ordered: {format(new Date(order.created_at), 'MMMM d, yyyy @ h:mm a')}
                    </p>
                  </div>

                  <span className={`text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full ${
                    order.status === 'Pending' ? 'bg-[#ff9800]/10 text-[#ff9800] border border-[#ff9800]/20' :
                    order.status === 'Processing' ? 'bg-[#2196f3]/10 text-[#2196f3] border border-[#2196f3]/20' :
                    order.status === 'Completed' ? 'bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20' :
                    'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {order.status}
                  </span>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 py-5 border-b border-slate-800/60 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-0.5">Service Purchased</span>
                    <span className="text-white font-bold">{order.services?.title}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-0.5">Quantity Size</span>
                    <span className="text-white font-bold">
                      {(order.services?.title?.toLowerCase()?.includes("page") || order.target_url?.toLowerCase()?.includes("page wants"))
                        ? `${order.quantity} Page`
                        : `${order.quantity.toLocaleString()} units`
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-0.5">Total Paid</span>
                    <span className="text-[#1877F2] font-black">₱{Number(order.amount).toFixed(0)} PHP</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-0.5">Customer contact</span>
                    <span className="text-white font-semibold truncate block max-w-[160px]">{order.customer_email}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-0.5">Target Destination Link</span>
                    {order.target_url && order.target_url.includes("Page Wants:") ? (
                      <div className="bg-[#121212] p-4 rounded-xl border border-slate-800/80 text-xs space-y-2 mt-2">
                        {order.target_url.replace("Page Wants: ", "").split("] [").map((part: string, idx: number) => {
                          const clean = part.replace(/[\[\]]/g, "");
                          const colonIdx = clean.indexOf(":");
                          if (colonIdx > -1) {
                            const label = clean.substring(0, colonIdx);
                            const value = clean.substring(colonIdx + 1);
                            const isUrl = value.trim().startsWith("http");
                            return (
                              <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center py-1 border-b border-slate-850/50 last:border-b-0 gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500">{label.trim()}</span>
                                {isUrl ? (
                                  <a href={value.trim()} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline font-semibold font-mono truncate max-w-[280px]">
                                    View Attached Image 🔗
                                  </a>
                                ) : (
                                  <span className="text-white font-bold font-mono">{value.trim()}</span>
                                )}
                              </div>
                            );
                          }
                          return <div key={idx} className="text-slate-350 font-semibold">{clean}</div>;
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-350 font-mono select-all truncate block max-w-full hover:text-white transition-all cursor-pointer">
                        🔗 {order.target_url}
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual Status Progress timeline */}
                <div className="pt-6">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-6">
                    🛠️ Amplification Flow Progress
                  </h4>
                  
                  <div className="space-y-6 pl-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800/80">
                    {/* Placed */}
                    <div className="flex items-start gap-4 relative">
                      <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center text-white flex-shrink-0 z-10 shadow-lg shadow-blue-500/20">
                        <CheckCircle2 size={13} fill="currentColor" />
                      </div>
                      <div className="space-y-0.5 text-xs">
                        <h5 className="font-black text-white">Order Submitted</h5>
                        <p className="text-slate-400 font-semibold">Your boost specifications have been securely logged in our system.</p>
                      </div>
                    </div>

                    {/* Payment verification */}
                    <div className="flex items-start gap-4 relative">
                      {getStepStatus("payment", order.status) === "completed" ? (
                        <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center text-white flex-shrink-0 z-10 shadow-lg shadow-blue-500/20">
                          <CheckCircle2 size={13} fill="currentColor" />
                        </div>
                      ) : getStepStatus("payment", order.status) === "current" ? (
                        <div className="w-6 h-6 rounded-full bg-[#ff9800] flex items-center justify-center text-black flex-shrink-0 z-10 animate-pulse">
                          <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#282828] border border-slate-750 flex items-center justify-center text-slate-500 flex-shrink-0 z-10">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        </div>
                      )}
                      <div className="space-y-0.5 text-xs">
                        <h5 className={`font-black ${getStepStatus("payment", order.status) === "upcoming" ? 'text-slate-500' : 'text-white'}`}>
                          Payment Verification
                        </h5>
                        <p className="text-slate-450 font-semibold leading-relaxed">
                          {order.status === "Pending" 
                            ? "Waiting for GCash screenshot upload. Once uploaded, admin verification takes 5-15 mins." 
                            : "GCash payment verified successfully! Balance processed."
                          }
                        </p>
                      </div>
                    </div>

                    {/* Processing */}
                    <div className="flex items-start gap-4 relative">
                      {getStepStatus("processing", order.status) === "completed" ? (
                        <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center text-white flex-shrink-0 z-10 shadow-lg shadow-blue-500/20">
                          <CheckCircle2 size={13} fill="currentColor" />
                        </div>
                      ) : getStepStatus("processing", order.status) === "current" ? (
                        <div className="w-6 h-6 rounded-full bg-[#2196f3] flex items-center justify-center text-black flex-shrink-0 z-10 animate-pulse">
                          <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#282828] border border-slate-750 flex items-center justify-center text-slate-500 flex-shrink-0 z-10">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        </div>
                      )}
                      <div className="space-y-0.5 text-xs">
                        <h5 className={`font-black ${getStepStatus("processing", order.status) === "upcoming" ? 'text-slate-500' : 'text-white'}`}>
                          { (order.services?.title?.toLowerCase()?.includes("page") || order.target_url?.toLowerCase()?.includes("page wants"))
                            ? "Page Creation & Boosting"
                            : "Amplification Active"
                          }
                        </h5>
                        <p className="text-slate-450 font-semibold">
                          {order.status === "Pending" ? "Awaiting payment verification to trigger deployment." :
                           order.status === "Processing" ? (
                             (order.services?.title?.toLowerCase()?.includes("page") || order.target_url?.toLowerCase()?.includes("page wants"))
                               ? "Admin Cyrhiel Moralla is currently creating your branded page and delivering 10k default followers!"
                               : "Followers/Likes/Views are now being dynamically added to your destination URL!"
                           ) :
                           "Boost successfully executed."}
                        </p>
                      </div>
                    </div>

                    {/* Completed */}
                    <div className="flex items-start gap-4 relative">
                      {getStepStatus("completed", order.status) === "completed" ? (
                        <div className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center text-white flex-shrink-0 z-10 shadow-lg shadow-blue-500/20">
                          <CheckCircle2 size={13} fill="currentColor" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#282828] border border-slate-750 flex items-center justify-center text-slate-500 flex-shrink-0 z-10">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        </div>
                      )}
                      <div className="space-y-0.5 text-xs">
                        <h5 className={`font-black ${getStepStatus("completed", order.status) === "completed" ? 'text-white' : 'text-slate-500'}`}>
                          { (order.services?.title?.toLowerCase()?.includes("page") || order.target_url?.toLowerCase()?.includes("page wants"))
                            ? "Page Ownership Transferred"
                            : "Boost Package Complete"
                          }
                        </h5>
                        <p className="text-slate-450 font-semibold">
                          { (order.services?.title?.toLowerCase()?.includes("page") || order.target_url?.toLowerCase()?.includes("page wants"))
                            ? "All custom branding assets have been applied, 10k followers delivered, and admin ownership transferred securely!"
                            : "All purchased quantities have been successfully delivered to your Facebook target page."
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uploader section (ONLY displays if status is Pending) */}
              {order.status === "Pending" && (
                <div className="bg-[#181818]/60 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <UploadCloud size={16} className="text-[#1877F2]" /> Upload GCash Receipt Screenshot
                  </h4>
                  <p className="text-xs text-slate-450 font-semibold mb-6 leading-relaxed">
                    If you did not upload your GCash payment receipt screenshot at checkout, you can upload it here to link it directly to your order and initiate processing immediately!
                  </p>

                  {uploadSuccess ? (
                    <div className="flex flex-col items-center justify-center py-6 bg-[#121212]/50 border border-slate-850 p-6 rounded-2xl gap-2 text-center">
                      <div className="text-[#1877F2] animate-bounce">
                        <CheckCircle2 size={36} />
                      </div>
                      <h5 className="text-sm font-black text-white">Receipt Linked Successfully!</h5>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Our administrative operations team will verify your GCash receipt shortly. Enjoy the boost!
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleUploadReceipt} className="space-y-4">
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-2xl p-6 bg-[#121212]/50 hover:bg-[#121212]/80 transition-colors relative cursor-pointer group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Image size={32} className="text-[#1877F2] group-hover:scale-110 transition-transform mb-2" />
                        <span className="text-xs font-black text-white">
                          {selectedFile ? selectedFile.name : "Choose Payment Screenshot"}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                          PNG, JPG, or JPEG accepted
                        </span>
                      </div>

                      {selectedFile && (
                        <button
                          type="submit"
                          disabled={uploading}
                          className="w-full bg-[#1877F2] hover:bg-[#4e8df5] disabled:bg-slate-850 text-white font-black py-3 rounded-xl shadow-lg transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                        >
                          {uploading ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Uploading Receipt...
                            </>
                          ) : (
                            <>
                              Confirm Upload <ArrowRight size={14} />
                            </>
                          )}
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
