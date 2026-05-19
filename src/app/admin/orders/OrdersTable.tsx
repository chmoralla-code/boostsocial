"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Trash2, Clock } from "lucide-react";

export function OrdersTable({ initialOrders, receiptFiles = [] }: { initialOrders: any[], receiptFiles?: string[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [selectedPageSpecs, setSelectedPageSpecs] = useState<any | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const supabase = createClient();

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
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setSelectedPageSpecs((prev: any) => {
        if (prev && prev.orderId === id) {
          return { ...prev, status: newStatus };
        }
        return prev;
      });
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) setOrders(orders.filter(o => o.id !== id));
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

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <span className="text-sm font-semibold text-slate-500">Total Orders: {orders.length}</span>
        {orders.length > 0 && (
          <button
            onClick={handleDeleteAllOrders}
            disabled={isDeletingAll}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 size={14} />
            {isDeletingAll ? "Deleting All..." : "Delete All Orders"}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest whitespace-nowrap">
                <span className="flex items-center gap-1.5"><Clock size={12} /> Date & Time (PHT)</span>
              </th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Tracking ID</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Customer</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Service</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Qty</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Details</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Amount</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Receipt</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Status</th>
              <th className="py-3.5 px-5 font-bold text-slate-600 text-[11px] uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              const phTime = formatPHTime(order.created_at);
              return (
              <tr key={order.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100 last:border-0">
                {/* Date + Time PHT */}
                <td className="py-3.5 px-5 whitespace-nowrap">
                  <div className="text-xs font-bold text-slate-800">{phTime.date}</div>
                  <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                    <Clock size={9} />{phTime.time} PHT
                  </div>
                </td>

                {/* Tracking ID */}
                <td className="py-3.5 px-5">
                  <span className="font-mono text-xs font-black text-slate-800 tracking-widest bg-slate-100 px-2 py-1 rounded-lg">
                    BS-{order.id.slice(0, 8).toUpperCase()}
                  </span>
                </td>

                {/* Customer */}
                <td className="py-3.5 px-5 text-xs font-medium text-slate-700 max-w-[160px] truncate">
                  {order.customer_email}
                </td>

                {/* Service */}
                <td className="py-3.5 px-5">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 px-2.5 py-1 rounded-full">
                    {order.services?.title}
                  </span>
                </td>

                {/* Quantity */}
                <td className="py-3.5 px-5 text-sm font-bold text-slate-700 text-center">
                  {order.quantity || 1000}
                </td>

                {/* Details / Target URL */}
                <td className="py-3.5 px-5 text-sm text-slate-600 max-w-xs">
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
                      className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-extrabold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-sm uppercase tracking-wide cursor-pointer"
                    >
                      🔑 View FB Specs
                    </button>
                  ) : order.target_url && order.target_url.includes("Custom Request:") ? (
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-700 whitespace-normal break-words max-w-xs shadow-sm">
                      {order.target_url.replace("Custom Request: ", "").split(/\]\s*\[/).map((chunk: string, i: number) => {
                        const cleaned = chunk.replace(/[\[\]]/g, '');
                        const [key, ...val] = cleaned.split(': ');
                        return (
                          <div key={i} className="mb-1 last:mb-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 block">{key}</span>
                            <span className="text-slate-700">{val.join(': ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <a href={order.target_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate block max-w-[160px]">
                      {order.target_url}
                    </a>
                  )}
                </td>

                {/* Amount */}
                <td className="py-3.5 px-5">
                  <div className="text-sm font-black text-slate-900">₱{Number(order.amount).toFixed(2)}</div>
                  <div className="mt-1">
                    {order.payment_method === 'Wallet' ? (
                      <span className="bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full text-[9px] border border-emerald-200 uppercase tracking-wider">
                        💳 Wallet
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded-full text-[9px] border border-blue-200 uppercase tracking-wider">
                        📱 GCash
                      </span>
                    )}
                  </div>
                </td>

                {/* Receipt */}
                <td className="py-3.5 px-5 text-sm">
                  {(() => {
                    const matchingFile = receiptFiles.find((f: string) => f.startsWith(order.id));
                    if (matchingFile) {
                      const receiptUrl = supabase.storage.from('receipts').getPublicUrl(matchingFile).data.publicUrl;
                      return (
                        <button 
                          onClick={() => setPreviewImageUrl(receiptUrl)}
                          className="inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          View Receipt
                        </button>
                      );
                    }
                    return <span className="text-xs text-slate-400 italic font-medium">No receipt</span>;
                  })()}
                </td>

                {/* Status */}
                <td className="py-3.5 px-5">
                  <select 
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className={`text-[10px] font-black rounded-full px-3 py-1.5 border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer uppercase tracking-wider
                      ${order.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 
                        order.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 
                        order.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                        'bg-red-100 text-red-700'}`}
                  >
                    <option value="Pending">⏳ Pending</option>
                    <option value="Processing">⚡ Processing</option>
                    <option value="Completed">✅ Completed</option>
                    <option value="Cancelled">❌ Cancelled</option>
                  </select>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-5">
                  <button
                    onClick={() => deleteOrder(order.id)}
                    title="Delete this order"
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Receipt Image Preview Modal */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full bg-[#121212] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl p-6 flex flex-col items-center animate-in zoom-in-95 duration-200 cursor-default"
          >
            <div className="w-full flex justify-between items-center mb-4 pb-2 border-b border-slate-800/60">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#1DB954]">
                GCash Proof of Payment
              </h3>
              <button 
                onClick={() => setPreviewImageUrl(null)}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 px-2.5 py-1 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
            
            <div className="w-full max-h-[70vh] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div 
            className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
              <div>
                <span className="bg-[#1DB954]/10 text-[#1DB954] font-black text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-md border border-[#1DB954]/20">
                  🔑 Facebook Page Specs Wants
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1.5">
                  Order BS-{selectedPageSpecs.orderId.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedPageSpecs(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-150 hover:bg-slate-200 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-6">
              {/* Specs Table */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Desired Page Name</span>
                    <span className="text-sm font-bold text-slate-900">{selectedPageSpecs.name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Category Selection</span>
                    <span className="text-sm font-bold text-slate-900">{selectedPageSpecs.category}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/50">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Demographics / Region</span>
                    <span className="text-sm font-bold text-slate-900">{selectedPageSpecs.region}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">FB Link for Admin Migration</span>
                    <a 
                      href={selectedPageSpecs.admin.startsWith("http") ? selectedPageSpecs.admin : `https://${selectedPageSpecs.admin}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline text-xs font-mono font-bold break-all block mt-0.5"
                    >
                      {selectedPageSpecs.admin}
                    </a>
                  </div>
                </div>

                {selectedPageSpecs.notes && selectedPageSpecs.notes !== "N/A" && (
                  <div className="pt-3 border-t border-slate-200/50">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Admin Notes / Custom Wants</span>
                    <p className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap mt-1">
                      {selectedPageSpecs.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Graphic Assets previews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200/60 rounded-2xl p-4 flex flex-col items-center bg-slate-50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Profile Picture Preview</span>
                  {selectedPageSpecs.profile && selectedPageSpecs.profile !== "N/A" && !selectedPageSpecs.profile.includes("Optimized") ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-md relative group">
                      <img 
                        src={selectedPageSpecs.profile} 
                        alt="Profile Pic" 
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewImageUrl(selectedPageSpecs.profile)}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic py-6">
                      {selectedPageSpecs.profile?.includes("Optimized") ? "Optimized / Deleted (Preserved)" : "No Profile Picture Attached"}
                    </span>
                  )}
                </div>

                <div className="border border-slate-200/60 rounded-2xl p-4 flex flex-col items-center bg-slate-50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Cover Photo Preview</span>
                  {selectedPageSpecs.cover && selectedPageSpecs.cover !== "N/A" && !selectedPageSpecs.cover.includes("Optimized") ? (
                    <div className="w-full h-24 rounded-xl overflow-hidden border border-white shadow-md relative group">
                      <img 
                        src={selectedPageSpecs.cover} 
                        alt="Cover Photo" 
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewImageUrl(selectedPageSpecs.cover)}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic py-6">
                      {selectedPageSpecs.cover?.includes("Optimized") ? "Optimized / Deleted (Preserved)" : "No Cover Photo Attached"}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Status Control panel */}
              <div className="bg-[#181818] rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Order Processing Controls</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-extrabold">Current Status:</span>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider
                      ${selectedPageSpecs.status === 'Pending' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/35' : 
                        selectedPageSpecs.status === 'Processing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/35' : 
                        selectedPageSpecs.status === 'Completed' ? 'bg-green-500/20 text-green-400 border border-green-500/35' : 
                        'bg-red-500/20 text-red-400 border border-red-500/35'}`}
                    >
                      {selectedPageSpecs.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-end">
                  {['Pending', 'Processing', 'Completed', 'Cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => updateStatus(selectedPageSpecs.orderId, st)}
                      disabled={selectedPageSpecs.status === st}
                      className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                        ${selectedPageSpecs.status === st 
                          ? 'bg-slate-800 text-slate-500 border border-slate-700' 
                          : 'bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold shadow-md hover:scale-[1.02]'}`}
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
    </div>
  );
}
