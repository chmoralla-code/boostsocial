"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Trash2, Clock, Search, Filter, ExternalLink, Image, Key, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { formatSmmServiceName } from "@/utils/serviceHelpers";

export function OrdersTable({ initialOrders, receiptFiles = [] }: { initialOrders: any[], receiptFiles?: string[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [selectedPageSpecs, setSelectedPageSpecs] = useState<any | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [smmServiceLabels, setSmmServiceLabels] = useState<Record<string, string>>({});
  const [smmServiceRates, setSmmServiceRates] = useState<Record<string, number>>({});
  const supabase = createClient();

  useEffect(() => {
    // Run silent sync on mount
    syncExternalOrders(true);
    loadSmmServiceLabels();
  }, []);

  const loadSmmServiceLabels = async () => {
    try {
      const res = await fetch("/api/smm/services");
      if (!res.ok) return;

      const services = await res.json();
      if (!Array.isArray(services)) return;

      const labels = services.reduce((acc: Record<string, string>, service: any) => {
        if (service?.id) {
          acc[String(service.id)] = formatSmmServiceName(service.name || "SMM Service", service.id, service.desc || service.category || "");
        }
        return acc;
      }, {});
      const rates = services.reduce((acc: Record<string, number>, service: any) => {
        if (service?.id) {
          acc[String(service.id)] = Number(service.originalRate || 0);
        }
        return acc;
      }, {});

      setSmmServiceLabels(labels);
      setSmmServiceRates(rates);
    } catch (err) {
      console.error("Failed to load SMM service labels for admin orders:", err);
    }
  };

  const getOrderServiceTitle = (order: any) => {
    const smmServiceId = order.smm_service_id ? String(order.smm_service_id) : "";
    const joinedTitle = Array.isArray(order.services) ? order.services[0]?.title : order.services?.title;
    const cleanJoinedTitle = String(joinedTitle || "").trim();
    const isGenericTitle = /^(all services|smm catalog explorer|smm service|boost campaign)$/i.test(cleanJoinedTitle);

    if (smmServiceId && smmServiceLabels[smmServiceId]) return smmServiceLabels[smmServiceId];
    if (order.resolved_service_title) return order.resolved_service_title;
    if (smmServiceId) return isGenericTitle || !cleanJoinedTitle ? `SMM Service ID ${smmServiceId}` : `${cleanJoinedTitle} - SMM ID ${smmServiceId}`;
    return cleanJoinedTitle && !isGenericTitle ? cleanJoinedTitle : "Specific SMM Service";
  };

  const getOrderProfit = (order: any) => {
    const smmServiceId = order.smm_service_id ? String(order.smm_service_id) : "";
    const ratePer1k = smmServiceId ? Number(smmServiceRates[smmServiceId] || 0) : 0;
    const quantity = Number(order.quantity || 0);
    const providerCost = ratePer1k > 0 && quantity > 0
      ? Number(((quantity / 1000) * ratePer1k).toFixed(2))
      : Number(order.estimated_provider_cost || 0);
    const profit = Number((Number(order.amount || 0) - providerCost).toFixed(2));
    return { providerCost, profit };
  };

  const syncExternalOrders = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-external-orders", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.updatedCount > 0) {
          // Fetch refreshed list
          const { data: refreshedOrders, error } = await supabase
            .from("orders")
            .select(`
              *,
              services (
                title
              )
            `)
            .order("created_at", { ascending: false });

          if (!error && refreshedOrders) {
            setOrders(refreshedOrders);
          }
          if (!silent) {
            alert(`🔄 Successfully synced! ${data.updatedCount} orders updated to Completed/Cancelled.`);
          }
        } else {
          if (!silent) {
            alert("🔄 Sync complete. No status updates were required.");
          }
        }
      } else {
        const data = await res.json();
        if (!silent) alert(data.error || "Failed to sync external orders");
      }
    } catch (err: any) {
      if (!silent) alert("Failed to connect to sync endpoint");
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const parsePageSpecs = (text: string) => {
    const name = text.match(/\[Name:\s*([^\]]+)\]/)?.[1] || "N/A";
    const category = text.match(/\[Category:\s*([^\]]+)\]/)?.[1] || "N/A";
    const region = text.match(/\[Region:\s*([^\]]+)\]/)?.[1] || "N/A";
    const admin = text.match(/\[FB Admin:\s*([^\]]+)\]/)?.[1] || "N/A";
    const profile = text.match(/\[Profile Pic:\s*([^\]]+)\]/)?.[1] || "N/A";
    const cover = text.match(/\[Cover Pic:\s*([^\]]+)\]/)?.[1] || "N/A";
    const notes = text.match(/\[Notes:\s*([^\]]+)\]/)?.[1] || "N/A";
    return { name, category, region, admin, profile, cover, notes };
  };

  const formatPHTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const ph = toZonedTime(date, 'Asia/Manila');
    return {
      date: format(ph, 'MMM d, yyyy'),
      time: format(ph, 'h:mm a'),
    };
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/update-order-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderId: id, newStatus })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update order status");
      }

      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setSelectedPageSpecs((prev: any) => {
        if (prev && prev.orderId === id) {
          return { ...prev, status: newStatus };
        }
        return prev;
      });

      // Poll for external order placement details after a short delay (3 seconds)
      setTimeout(async () => {
        const { data, error } = await supabase
          .from("orders")
          .select("external_order_id, external_status")
          .eq("id", id)
          .single();

        if (!error && data) {
          setOrders(prevOrders =>
            prevOrders.map(o => o.id === id
              ? { ...o, external_order_id: data.external_order_id, external_status: data.external_status }
              : o
            )
          );
        }
      }, 3000);

    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    const res = await fetch("/api/admin/delete-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id })
    });

    if (res.ok) {
      setOrders(orders.filter(o => o.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete order");
    }
  };

  const handleDeleteAllOrders = async () => {
    if (confirm("🚨 WARNING: Are you absolutely sure you want to DELETE ALL ORDERS and their receipts? This action is permanent and CANNOT be undone!")) {
      setIsDeletingAll(true);
      try {
        const res = await fetch("/api/admin/delete-all-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });

        if (res.ok) {
          alert("All orders and receipts deleted successfully!");
          setOrders([]);
        } else {
          const data = await res.json();
          alert(data.error || "Failed to delete orders");
        }
      } catch (err) {
        alert("An error occurred during deletion");
      } finally {
        setIsDeletingAll(false);
      }
    }
  };

  // Filter logic
  const filteredOrders = orders.filter(order => {
    const trackingId = `BS-${order.id.slice(0, 8).toUpperCase()}`;
    const serviceTitle = getOrderServiceTitle(order).toLowerCase();
    const matchesSearch = 
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      serviceTitle.includes(searchTerm.toLowerCase()) ||
      order.target_url?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === "All" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Control & Search Toolbar */}
      <div className="bg-[#181818] border border-slate-850/80 p-5 rounded-2xl shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-white">
        
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row flex-1 gap-3 items-stretch sm:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Email, Track ID, Link..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/50 focus:border-[#1DB954] text-xs font-semibold text-white transition-all placeholder:text-slate-600"
            />
          </div>

          {/* Status filter dropdown */}
          <div className="relative min-w-[150px]">
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/50 focus:border-[#1DB954] text-xs font-bold text-slate-350 cursor-pointer transition-all appearance-none"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">⏳ Pending</option>
              <option value="Processing">⚡ Processing</option>
              <option value="Completed">✅ Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">❌ Cancelled</option>
            </select>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-4 justify-between md:justify-end">
          <span className="text-xs font-bold text-slate-400">
            Records: <strong className="text-white font-extrabold">{filteredOrders.length}</strong> / {orders.length}
          </span>
          
          <button
            onClick={() => syncExternalOrders(false)}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-[#1DB954]/10 hover:bg-[#1DB954]/25 border border-[#1DB954]/30 hover:border-[#1DB954]/60 disabled:opacity-50 text-[#1DB954] hover:text-[#1ed760] font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer border-0"
          >
            {isSyncing ? (
              <Loader2 size={13} className="animate-spin text-[#1DB954]" />
            ) : (
              <RefreshCw size={13} />
            )}
            {isSyncing ? "Syncing..." : "Sync SMM"}
          </button>

          {orders.length > 0 && (
            <button
              onClick={handleDeleteAllOrders}
              disabled={isDeletingAll}
              className="px-4 py-2.5 bg-red-650 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer border-0"
            >
              {isDeletingAll ? (
                <Loader2 size={13} className="animate-spin text-white" />
              ) : (
                <Trash2 size={13} />
              )}
              {isDeletingAll ? "Purging..." : "Delete All"}
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#181818]/60 border border-slate-850/80 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-slate-300">
            <thead>
              <tr className="bg-[#121212] border-b border-slate-800">
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  <span className="flex items-center gap-1.5"><Clock size={12} className="text-[#1DB954]" /> Date & Time (PHT)</span>
                </th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Tracking ID</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Customer</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Service</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider text-center">Qty</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Details</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Amount</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Profit</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Receipt</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Status</th>
                <th className="py-4 px-5 font-extrabold text-slate-400 text-[10px] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40">
              {filteredOrders.map((order) => {
                const phTime = formatPHTime(order.created_at);
                const serviceTitle = getOrderServiceTitle(order);
                const orderProfit = getOrderProfit(order);
                return (
                  <tr key={order.id} className="hover:bg-slate-800/20 transition-colors border-b border-slate-850/30 last:border-0">
                    {/* Date + Time PHT */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="text-xs font-bold text-white">{phTime.date}</div>
                      <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                        <Clock size={9} />{phTime.time} PHT
                      </div>
                    </td>

                    {/* Tracking ID */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className="font-mono text-[10px] font-black text-slate-300 tracking-wider bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                        BS-{order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-400 max-w-[160px] truncate">
                      {order.customer_email}
                    </td>

                    {/* Service */}
                    <td className="py-3.5 px-5">
                      <span
                        title={serviceTitle}
                        className="text-[9px] font-black uppercase tracking-wider bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 px-2.5 py-1 rounded-full whitespace-nowrap"
                      >
                        {serviceTitle}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-5 text-xs font-black text-white text-center">
                      {(order.quantity || 1000).toLocaleString()}
                    </td>

                    {/* Details / Target URL */}
                    <td className="py-3.5 px-5 text-xs text-slate-400 max-w-xs">
                      {order.target_url && order.target_url.includes("Page Wants:") ? (
                        <button
                          onClick={() => {
                            const specs = parsePageSpecs(order.target_url);
                            setSelectedPageSpecs({
                              ...specs,
                              orderId: order.id,
                              status: order.status,
                              amount: order.amount,
                              email: order.customer_email
                            });
                          }}
                          className="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-extrabold px-3 py-1.5 rounded-xl text-[10px] transition-colors shadow-sm uppercase tracking-wider cursor-pointer"
                        >
                          <Key size={10} /> View FB Specs
                        </button>
                      ) : order.target_url && order.target_url.includes("Custom Request:") ? (
                        <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl text-[10px] font-semibold text-slate-350 whitespace-normal break-words max-w-xs shadow-sm">
                          {order.target_url.replace("Custom Request: ", "").split(/\]\s*\[/).map((chunk: string, i: number) => {
                            const cleaned = chunk.replace(/[\[\]]/g, '');
                            const [key, ...val] = cleaned.split(': ');
                            return (
                              <div key={i} className="mb-1 last:mb-0">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#1DB954] block">{key}</span>
                                <span className="text-slate-300">{val.join(': ')}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <a 
                          href={order.target_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-450 hover:text-blue-400 transition-colors text-xs truncate max-w-[160px] inline-flex items-center gap-1 font-semibold"
                        >
                          {order.target_url} <ExternalLink size={10} />
                        </a>
                      )}

                      {order.external_order_id && (
                        <div className="mt-2 flex flex-col gap-0.5 bg-black/40 border border-slate-800/60 p-2 rounded-xl text-[10px] max-w-[180px] shadow-sm animate-in fade-in duration-200 text-left">
                          <span className="text-[8px] font-black uppercase tracking-widest text-[#1DB954] block mb-0.5">🔗 RixeySMM Order</span>
                          <span className="text-slate-350 font-mono text-[9px] block">ID: {order.external_order_id}</span>
                          <span className={`font-bold text-[9px] block ${order.external_status?.includes("Failed") ? "text-red-400" : "text-slate-400"}`}>
                            Status: {order.external_status}
                          </span>
                        </div>
                      )}
                      {order.external_status && !order.external_order_id && (
                        <div className="mt-2 bg-red-950/20 border border-red-900/40 p-2 rounded-xl text-[10px] max-w-[180px] shadow-sm animate-in fade-in duration-200 text-left">
                          <span className="text-[8px] font-black uppercase tracking-widest text-red-400 block mb-0.5">❌ Automation Fail</span>
                          <span className="text-red-300 block font-semibold leading-normal text-[9px]">{order.external_status}</span>
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-5">
                      <div className="text-xs font-black text-white">₱{Number(order.amount).toFixed(2)}</div>
                      <div className="mt-1">
                        {order.payment_method === 'Wallet' ? (
                          <span className="bg-emerald-500/10 text-[#1DB954] font-black px-2 py-0.5 rounded-full text-[8px] border border-emerald-500/20 uppercase tracking-widest">
                            💳 Wallet
                          </span>
                        ) : (
                          <span className="bg-blue-500/10 text-blue-400 font-black px-2 py-0.5 rounded-full text-[8px] border border-blue-500/20 uppercase tracking-widest">
                            📱 GCash
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Profit */}
                    <td className="py-3.5 px-5">
                      <div className={`text-xs font-black ${orderProfit.profit >= 0 ? "text-[#1DB954]" : "text-red-400"}`}>
                        â‚±{orderProfit.profit.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold mt-0.5">
                        Cost â‚±{orderProfit.providerCost.toFixed(2)}
                      </div>
                    </td>

                    {/* Receipt */}
                    <td className="py-3.5 px-5 text-xs">
                      {(() => {
                        const matchingFile = receiptFiles.find((f: string) => f.startsWith(order.id));
                        if (matchingFile) {
                          const receiptUrl = supabase.storage.from('receipts').getPublicUrl(matchingFile).data.publicUrl;
                          return (
                            <button 
                              onClick={() => setPreviewImageUrl(receiptUrl)}
                              className="inline-flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-[#1DB954] font-bold px-3 py-1.5 rounded-xl text-[10px] transition-colors shadow-sm cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 bg-[#1DB954] rounded-full animate-pulse"></span>
                              View Receipt
                            </button>
                          );
                        }
                        return <span className="text-[10px] text-slate-600 italic font-bold">No receipt</span>;
                      })()}
                    </td>

                    {/* Status Select dropdown */}
                    <td className="py-3.5 px-5">
                      <select 
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className={`text-[9px] font-black rounded-full px-3 py-1.5 border focus:ring-2 focus:outline-none cursor-pointer uppercase tracking-wider transition-all
                          ${order.status === 'Pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 focus:ring-orange-550/30' : 
                            order.status === 'Processing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 focus:ring-blue-550/30' : 
                            order.status === 'Completed' ? 'bg-green-500/10 text-[#1DB954] border-green-500/20 focus:ring-green-550/30' : 
                            'bg-red-500/10 text-red-400 border-red-500/20 focus:ring-red-550/30'}`}
                      >
                        <option value="Pending">⏳ Pending</option>
                        <option value="Processing">⚡ Processing</option>
                        <option value="Completed">✅ Completed</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Cancelled">❌ Cancelled</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => deleteOrder(order.id)}
                        title="Delete this order"
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer border-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-550 italic font-semibold">
                    No matching orders registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Image Preview Modal */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full bg-[#181818] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl p-6 flex flex-col items-center animate-in zoom-in-95 duration-200 cursor-default"
          >
            <div className="w-full flex justify-between items-center mb-4 pb-2 border-b border-slate-850/60">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#1DB954] flex items-center gap-1.5">
                <Image size={14} /> GCash Proof of Payment
              </h3>
              <button 
                onClick={() => setPreviewImageUrl(null)}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border-0"
              >
                Close
              </button>
            </div>
            
            <div className="w-full max-h-[70vh] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-850">
              <img 
                src={previewImageUrl} 
                alt="GCash Proof of Payment" 
                className="max-w-full max-h-[68vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Facebook Page Specs Details Modal */}
      {selectedPageSpecs && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div 
            className="relative max-w-2xl w-full bg-[#181818] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-slate-300"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-850/60">
              <div>
                <span className="bg-[#1DB954]/10 text-[#1DB954] font-black text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-md border border-[#1DB954]/20 flex items-center gap-1.5 w-fit">
                  <Key size={11} /> Facebook Page Specs Wants
                </span>
                <h3 className="text-base font-black text-white mt-2">
                  Order BS-{selectedPageSpecs.orderId.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedPageSpecs(null)}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border-0"
              >
                Close
              </button>
            </div>

            <div className="space-y-6">
              {/* Specs Table */}
              <div className="bg-[#121212]/80 rounded-2xl p-5 border border-slate-850 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Desired Page Name</span>
                    <span className="text-xs font-bold text-white">{selectedPageSpecs.name}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Category Selection</span>
                    <span className="text-xs font-bold text-white">{selectedPageSpecs.category}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-850/60">
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Demographics / Region</span>
                    <span className="text-xs font-bold text-white">{selectedPageSpecs.region}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">FB Link for Admin Migration</span>
                    <a 
                      href={selectedPageSpecs.admin.startsWith("http") ? selectedPageSpecs.admin : `https://${selectedPageSpecs.admin}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-400 hover:text-blue-300 transition-colors text-xs font-mono font-bold break-all block mt-0.5 inline-flex items-center gap-1"
                    >
                      {selectedPageSpecs.admin} <ExternalLink size={10} />
                    </a>
                  </div>
                </div>

                {selectedPageSpecs.notes && selectedPageSpecs.notes !== "N/A" && (
                  <div className="pt-3 border-t border-slate-850/60">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Admin Notes / Custom Wants</span>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed whitespace-pre-wrap mt-1">
                      {selectedPageSpecs.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Graphic Assets Previews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Profile Attachment */}
                <div className="border border-slate-850 rounded-2xl p-4 flex flex-col items-center bg-[#121212]/40">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-3">Profile Picture Attachment</span>
                  {selectedPageSpecs.profile && selectedPageSpecs.profile !== "N/A" && !selectedPageSpecs.profile.includes("Optimized") ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-850 shadow-md relative group">
                      <img 
                        src={selectedPageSpecs.profile} 
                        alt="Profile Pic" 
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewImageUrl(selectedPageSpecs.profile)}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-650 italic py-6 font-bold">
                      {selectedPageSpecs.profile?.includes("Optimized") ? "Optimized / Deleted (Preserved)" : "No Profile Picture Attached"}
                    </span>
                  )}
                </div>

                {/* Cover Attachment */}
                <div className="border border-slate-850 rounded-2xl p-4 flex flex-col items-center bg-[#121212]/40">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-3">Cover Photo Attachment</span>
                  {selectedPageSpecs.cover && selectedPageSpecs.cover !== "N/A" && !selectedPageSpecs.cover.includes("Optimized") ? (
                    <div className="w-full h-24 rounded-xl overflow-hidden border border-slate-850 shadow-md relative group">
                      <img 
                        src={selectedPageSpecs.cover} 
                        alt="Cover Photo" 
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewImageUrl(selectedPageSpecs.cover)}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-650 italic py-6 font-bold">
                      {selectedPageSpecs.cover?.includes("Optimized") ? "Optimized / Deleted (Preserved)" : "No Cover Photo Attached"}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Status Control Panel */}
              <div className="bg-[#121212] border border-slate-850 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Order Status Controls</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-slate-400">Current Status:</span>
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider border
                      ${selectedPageSpecs.status === 'Pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                        selectedPageSpecs.status === 'Processing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        selectedPageSpecs.status === 'Completed' ? 'bg-green-500/10 text-[#1DB954] border-green-500/20' : 
                        'bg-red-500/10 text-red-400 border-red-500/20'}`}
                    >
                      {selectedPageSpecs.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
                  {['Pending', 'Processing', 'Completed', 'Rejected', 'Cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => updateStatus(selectedPageSpecs.orderId, st)}
                      disabled={selectedPageSpecs.status === st}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-0 disabled:opacity-40 disabled:cursor-not-allowed
                        ${selectedPageSpecs.status === st 
                          ? 'bg-slate-800 text-slate-550 border border-slate-750' 
                          : 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-md hover:scale-[1.02]'}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
