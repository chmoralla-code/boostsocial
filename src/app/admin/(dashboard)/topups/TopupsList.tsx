"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, X, Eye, ExternalLink, Search, Filter, Wallet, Calendar, Mail, DollarSign } from "lucide-react";

export function TopupsList({ initialTopups }: { initialTopups: any[] }) {
  const [topups, setTopups] = useState(initialTopups);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const handleAction = async (id: string, action: 'approve' | 'reject', currentAmount?: number) => {
    let amountToSend = undefined;
    if (action === 'approve' && currentAmount !== undefined) {
      const userAmount = prompt(`Confirm or adjust the approved wallet top-up deposit amount (₱):`, currentAmount.toString());
      if (userAmount === null) return; // User cancelled
      
      const parsedAmount = parseFloat(userAmount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        alert("Please enter a valid non-negative number.");
        return;
      }
      amountToSend = parsedAmount;
    } else {
      if (!confirm(`Are you sure you want to reject this top-up request?`)) return;
    }
    
    setProcessingId(id);
    try {
      const res = await fetch("/api/admin/approve-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topupId: id, action, amount: amountToSend })
      });
      
      const data = await res.json();
      if (res.ok) {
        setTopups(topups.map(t => t.id === id ? { 
          ...t, 
          status: action === 'approve' ? 'approved' : 'rejected',
          amount: amountToSend !== undefined ? amountToSend : t.amount
        } : t));
        alert(`Top-up successfully ${action === 'approve' ? 'approved' : 'rejected'}!`);
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      alert("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  // Live filter logic
  const filteredTopups = topups.filter((topup) => {
    const matchesEmail = topup.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : topup.status === statusFilter;
    return matchesEmail && matchesStatus;
  });

  return (
    <div className="space-y-6 text-slate-300">
      {/* Search Engine & Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#181818] p-4 rounded-2xl border border-slate-800/80 shadow-md">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search by customer email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 transition-all text-slate-200 font-medium placeholder-slate-500"
          />
        </div>
        
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <Filter size={15} className="text-slate-500 flex-shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full sm:w-44 px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-extrabold cursor-pointer text-xs uppercase tracking-wider"
          >
            <option value="all">All Statuses</option>
            <option value="pending">⏳ Pending</option>
            <option value="approved">✅ Approved</option>
            <option value="rejected">❌ Rejected</option>
          </select>
        </div>
      </div>

      {/* Topups Audit Table */}
      <div className="bg-[#181818] rounded-2xl shadow-lg border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1c1c1c] border-b border-slate-850/60">
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider w-52">Date Submitted</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Customer Email</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider w-44">Deposit Amount</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider w-48">Receipt Proof</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider w-40">Top-Up Status</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {filteredTopups.map((topup) => (
                <tr key={topup.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-4 px-6 text-xs text-slate-450 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-550" />
                      <span>{format(new Date(topup.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-white tracking-tight">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-slate-800 p-1.5 rounded-lg text-slate-400 border border-slate-700/30 flex-shrink-0">
                        <Mail size={14} />
                      </div>
                      <span className="truncate max-w-[200px]" title={topup.email}>{topup.email}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-extrabold text-[#1DB954] whitespace-nowrap">
                    ₱{Number(topup.amount).toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-sm whitespace-nowrap">
                    {topup.receipt_url ? (
                      <a 
                        href={topup.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1.5 text-[#1DB954] hover:text-[#1ed760] font-extrabold bg-[#1DB954]/10 border border-[#1DB954]/20 hover:bg-[#1DB954]/25 px-2.5 py-1 rounded-lg text-xs uppercase tracking-wider transition-all relative inline-flex shadow-sm"
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
                        </span>
                        <ExternalLink size={12} strokeWidth={2.5} /> View Receipt
                      </a>
                    ) : (
                      <span className="text-slate-500 italic text-xs px-2.5 py-1 bg-slate-800/20 border border-slate-800/50 rounded-lg">No receipt</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-sm whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${
                      topup.status === 'pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      topup.status === 'approved' ? 'bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {topup.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-right whitespace-nowrap">
                    {topup.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(topup.id, 'approve', topup.amount)}
                          disabled={processingId === topup.id || !topup.receipt_url}
                          className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                          title={topup.receipt_url ? "Approve & Add Balance" : "Receipt required before approval"}
                        >
                          <Check size={16} strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => handleAction(topup.id, 'reject')}
                          disabled={processingId === topup.id}
                          className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                          title="Reject Top-up"
                        >
                          <X size={16} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTopups.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm font-semibold">
                    No top-up requests found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
