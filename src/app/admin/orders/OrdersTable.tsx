"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

export function OrdersTable({ initialOrders, receiptFiles = [] }: { initialOrders: any[], receiptFiles?: string[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const supabase = createClient();

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
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
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Date</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Tracking ID</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Customer</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Service</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Quantity</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Target URL</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Amount</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Receipt</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">
                  {format(new Date(order.created_at), 'MMM d, yyyy')}
                </td>
                <td className="py-4 px-6 text-sm font-bold text-slate-800 font-mono tracking-widest whitespace-nowrap">
                  BS-{order.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="py-4 px-6 text-sm font-medium text-slate-900">
                  {order.customer_email}
                </td>
                <td className="py-4 px-6 text-sm text-slate-600">
                  {order.services?.title}
                </td>
                <td className="py-4 px-6 text-sm text-slate-600 font-medium">
                  {order.quantity || 1000}
                </td>
                <td className="py-4 px-6 text-sm text-slate-600 max-w-xs truncate">
                  <a href={order.target_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {order.target_url}
                  </a>
                </td>
                <td className="py-4 px-6 text-sm font-medium text-slate-900">
                  ₱{Number(order.amount).toFixed(2)}
                </td>
                <td className="py-4 px-6 text-sm">
                  {(() => {
                    const matchingFile = receiptFiles.find((f: string) => f.startsWith(order.id));
                    if (matchingFile) {
                      const receiptUrl = supabase.storage.from('receipts').getPublicUrl(matchingFile).data.publicUrl;
                      return (
                        <button 
                          onClick={() => setPreviewImageUrl(receiptUrl)}
                          className="inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-bold px-3 py-1 rounded-xl text-xs transition-colors shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          View Receipt
                        </button>
                      );
                    }
                    return (
                      <span className="text-xs text-slate-400 italic font-medium">No receipt</span>
                    );
                  })()}
                </td>
                <td className="py-4 px-6 text-sm">
                  <select 
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className={`text-xs font-semibold rounded-full px-3 py-1 border-0 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer
                      ${order.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 
                        order.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 
                        order.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                        'bg-red-100 text-red-700'}`}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
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
    </div>
    </div>
  );
}
