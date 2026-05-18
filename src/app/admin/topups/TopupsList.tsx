"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, X, Eye, ExternalLink } from "lucide-react";

export function TopupsList({ initialTopups }: { initialTopups: any[] }) {
  const [topups, setTopups] = useState(initialTopups);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this top-up?`)) return;
    
    setProcessingId(id);
    try {
      const res = await fetch("/api/admin/approve-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topupId: id, action })
      });
      
      const data = await res.json();
      if (res.ok) {
        setTopups(topups.map(t => t.id === id ? { ...t, status: action === 'approve' ? 'approved' : 'rejected' } : t));
        alert(`Top-up successfully ${action}d!`);
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      alert("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Date</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Customer Email</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Amount</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Receipt</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Status</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topups.map((topup) => (
              <tr key={topup.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">
                  {format(new Date(topup.created_at), 'MMM d, yyyy h:mm a')}
                </td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-900">
                  {topup.email}
                </td>
                <td className="py-4 px-6 text-sm font-bold text-green-600">
                  ₱{Number(topup.amount).toFixed(2)}
                </td>
                <td className="py-4 px-6 text-sm">
                  {topup.receipt_url ? (
                    <a href={topup.receipt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-md inline-flex">
                      <ExternalLink size={14} /> View
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">No receipt</span>
                  )}
                </td>
                <td className="py-4 px-6 text-sm">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    topup.status === 'pending' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    topup.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {topup.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm text-right">
                  {topup.status === 'pending' && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(topup.id, 'approve')}
                        disabled={processingId === topup.id}
                        className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                        title="Approve & Add Balance"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => handleAction(topup.id, 'reject')}
                        disabled={processingId === topup.id}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                        title="Reject Top-up"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {topups.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                  No top-up requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
