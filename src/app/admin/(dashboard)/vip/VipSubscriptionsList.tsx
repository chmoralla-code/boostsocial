"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar, Check, Crown, DollarSign, Eye, Search, X, Mail, Clock } from "lucide-react";
import { getVipPlanById } from "@/utils/vip";

const statusClass = {
  pending: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  approved: "bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

type SubscriptionRecord = {
  id: string;
  created_at: string;
  email: string;
  plan_code: string;
  payment_method: string;
  amount: number;
  receipt_url?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at?: string | null;
};

type VipStatusFilter = "all" | "pending" | "approved" | "rejected";

export function VipSubscriptionsList({ initialVipSubscriptions }: { initialVipSubscriptions: SubscriptionRecord[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VipStatusFilter>("pending");
  const [subscriptions, setSubscriptions] = useState(initialVipSubscriptions);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return subscriptions.filter((item) => {
      const matchesEmail = item.email?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      return matchesEmail && matchesStatus;
    });
  }, [search, statusFilter, subscriptions]);

  const handleAction = async (subscriptionId: string, action: "approve" | "reject") => {
    if (action === "reject" && !confirm("Reject this VIP request?")) return;

    setProcessingId(subscriptionId);
    try {
      const res = await fetch("/api/admin/approve-vip-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscriptionId, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to process request.");
        return;
      }

      setSubscriptions((current) =>
        current.map((sub) =>
          sub.id === subscriptionId
            ? {
                ...sub,
                status: action === "approve" ? "approved" : "rejected",
              }
            : sub
        )
      );

      alert(`VIP request ${action}d.`);
    } catch (err) {
      alert("Request failed due to network/server issue.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search by customer email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-slate-200 font-medium placeholder-slate-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as VipStatusFilter)}
          className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-extrabold cursor-pointer text-xs uppercase tracking-wider"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-[#181818] rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1c1c1c] border-b border-slate-850/60">
                <th className="py-4 px-6 text-xs text-slate-400 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-xs text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="py-4 px-6 text-xs text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="py-4 px-6 text-xs text-slate-400 uppercase tracking-wider">Payment</th>
                <th className="py-4 px-6 text-xs text-slate-400 uppercase tracking-wider">Receipt</th>
                <th className="py-4 px-6 text-xs text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {filtered.map((sub) => {
                const vipPlan = getVipPlanById(sub.plan_code);
                return (
                  <tr key={sub.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6 text-xs text-slate-450">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-550" />
                        <span>{format(new Date(sub.created_at), "MMM d, yyyy h:mm a")}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-white">
                      <div className="flex items-center gap-2.5">
                        <Mail size={14} className="text-slate-550" />
                        <span className="truncate max-w-[220px]">{sub.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Crown size={14} className="text-[#1DB954]" />
                        <div>
                          <p className="font-black text-white">{vipPlan?.label || sub.plan_code}</p>
                          <p className="text-[10px] text-slate-500">PHP {Number(sub.amount || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-slate-550" />
                        <span>{sub.payment_method}</span>
                      </div>
                      {sub.reviewed_at && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Reviewed {format(new Date(sub.reviewed_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {sub.receipt_url ? (
                        <a
                          href={sub.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#1DB954]/20 bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 text-xs font-black uppercase tracking-wide"
                        >
                          <Eye size={12} />
                          View
                        </a>
                      ) : (
                        <span className="text-slate-500 text-xs">No proof attached</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass[sub.status]}`}>
                        <Clock size={10} />
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-right">
                      {sub.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleAction(sub.id, "approve")}
                            disabled={processingId === sub.id}
                            title={sub.receipt_url ? "Approve VIP" : "Receipt required"}
                            className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 p-2"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleAction(sub.id, "reject")}
                            disabled={processingId === sub.id}
                            title="Reject VIP"
                            className="rounded-lg border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/25 disabled:opacity-40 p-2"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-sm font-semibold">
                    No records found for selected filter.
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
