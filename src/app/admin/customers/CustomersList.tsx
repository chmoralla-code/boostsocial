"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search, ArrowUpDown, Mail, ShoppingBag, DollarSign, Calendar, Landmark, Trash2, Users } from "lucide-react";

interface Customer {
  id?: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  balance: number;
  lastActive: string;
  hasProfile: boolean;
  statuses: {
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
}

export function CustomersList({ 
  initialCustomers, 
  metrics 
}: { 
  initialCustomers: Customer[]; 
  metrics: {
    totalCustomers: number;
    registeredCount: number;
    guestCount: number;
    totalSpent: number;
    totalCapital: number;
  };
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"spent" | "orders" | "active" | "balance">("spent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit Balance States
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newBalanceValue, setNewBalanceValue] = useState("");
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteAllAccounts = async () => {
    if (confirm("🚨 WARNING: Are you absolutely sure you want to DELETE ALL CUSTOMER ACCOUNTS? (The admin account admin@boostsocial.com will be spared, and orders will be anonymized). This action is permanent and CANNOT be undone!")) {
      setIsDeletingAll(true);
      try {
        const res = await fetch("/api/admin/delete-all-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });

        if (res.ok) {
          const data = await res.json();
          alert(`Successfully deleted ${data.count} customer accounts!`);
          window.location.reload();
        } else {
          const data = await res.json();
          alert(data.error || "Failed to delete customer accounts");
        }
      } catch (err) {
        alert("An error occurred during account deletion");
      } finally {
        setIsDeletingAll(false);
      }
    }
  };

  // Search Filter
  const filteredCustomers = initialCustomers.filter((c) =>
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let valA: any = 0;
    let valB: any = 0;

    if (sortBy === "spent") {
      valA = a.totalSpent;
      valB = b.totalSpent;
    } else if (sortBy === "orders") {
      valA = a.totalOrders;
      valB = b.totalOrders;
    } else if (sortBy === "balance") {
      valA = a.balance;
      valB = b.balance;
    } else if (sortBy === "active") {
      valA = new Date(a.lastActive).getTime();
      valB = new Date(b.lastActive).getTime();
    }

    if (sortOrder === "asc") {
      return valA > valB ? 1 : -1;
    } else {
      return valA < valB ? 1 : -1;
    }
  });

  const toggleSort = (field: "spent" | "orders" | "active" | "balance") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6 text-slate-300">
      {/* Telemetry Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/5 rounded-full pointer-events-none -mr-8 -mt-8 group-hover:bg-[#1DB954]/10 transition-colors duration-300"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Total Customers</span>
            <div className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 p-2 rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white tracking-tight">{metrics.totalCustomers}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Across lifetime directory</p>
          </div>
        </div>

        <div className="bg-[#181818] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full pointer-events-none -mr-8 -mt-8 group-hover:bg-blue-500/10 transition-colors duration-300"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Accounts vs Guests</span>
            <div className="bg-blue-500/10 text-blue-400 border border-blue-500/25 p-2 rounded-xl">
              <Mail size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white tracking-tight">
              {metrics.registeredCount} <span className="text-slate-550 text-sm font-bold">/</span> {metrics.guestCount}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Registered vs Guest shoppers</p>
          </div>
        </div>

        <div className="bg-[#181818] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/5 rounded-full pointer-events-none -mr-8 -mt-8 group-hover:bg-[#1DB954]/10 transition-colors duration-300"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Lifetime Revenue</span>
            <div className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 p-2 rounded-xl">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-[#1DB954] tracking-tight">₱{metrics.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Cumulative spent amount</p>
          </div>
        </div>

        <div className="bg-[#181818] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full pointer-events-none -mr-8 -mt-8 group-hover:bg-purple-500/10 transition-colors duration-300"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Wallet Capital</span>
            <div className="bg-purple-500/10 text-purple-400 border border-purple-500/25 p-2 rounded-xl">
              <Landmark size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-purple-400 tracking-tight">₱{metrics.totalCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Total user balance liabilities</p>
          </div>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#181818] p-4 rounded-2xl border border-slate-800/80 shadow-md">
        {/* Search & Bulk Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search customers by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 transition-all text-slate-200 font-medium placeholder-slate-500"
            />
          </div>
          {initialCustomers.length > 0 && (
            <button
              onClick={handleDeleteAllAccounts}
              disabled={isDeletingAll}
              className="w-full sm:w-auto px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 disabled:opacity-50 text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 flex-shrink-0 shadow-sm"
            >
              <Trash2 size={14} />
              {isDeletingAll ? "Deleting..." : "Delete All Accounts"}
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto justify-end py-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap">Sort by:</span>
          <button
            onClick={() => toggleSort("spent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "spent" 
                ? "bg-[#1DB954]/10 border-[#1DB954]/30 text-[#1DB954]" 
                : "border-slate-800 bg-[#121212] text-slate-400 hover:text-slate-200 hover:bg-slate-850"}`}
          >
            <DollarSign size={13} /> Spent
            <ArrowUpDown size={11} />
          </button>
          <button
            onClick={() => toggleSort("balance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "balance" 
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400" 
                : "border-slate-800 bg-[#121212] text-slate-400 hover:text-slate-200 hover:bg-slate-850"}`}
          >
            <Landmark size={13} /> Balance
            <ArrowUpDown size={11} />
          </button>
          <button
            onClick={() => toggleSort("orders")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "orders" 
                ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
                : "border-slate-800 bg-[#121212] text-slate-400 hover:text-slate-200 hover:bg-slate-850"}`}
          >
            <ShoppingBag size={13} /> Orders
            <ArrowUpDown size={11} />
          </button>
          <button
            onClick={() => toggleSort("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "active" 
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                : "border-slate-800 bg-[#121212] text-slate-400 hover:text-slate-200 hover:bg-slate-850"}`}
          >
            <Calendar size={13} /> Active
            <ArrowUpDown size={11} />
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-[#181818] rounded-2xl shadow-lg border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1c1c1c] border-b border-slate-850/60">
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Customer Email</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Wallet Balance</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider text-center">Orders Count</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Total Revenue</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Last Active</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Status Summary</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {sortedCustomers.map((customer) => (
                <tr key={customer.email} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-4 px-6 text-sm font-semibold text-slate-200 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-slate-800 p-2 rounded-lg text-slate-400 border border-slate-700/30">
                        <Mail size={16} />
                      </div>
                      <span className="tracking-tight">{customer.email}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-bold whitespace-nowrap">
                    {customer.hasProfile ? (
                      <span className="text-white bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">₱{customer.balance.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-500 italic text-xs px-2.5 py-1 bg-slate-800/20 border border-slate-800/50 rounded-lg">Guest shopper</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-300 text-center font-extrabold">
                    {customer.totalOrders}
                  </td>
                  <td className="py-4 px-6 text-sm font-extrabold text-[#1DB954]">
                    ₱{customer.totalSpent.toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-400 whitespace-nowrap">
                    {format(new Date(customer.lastActive), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      {customer.statuses.pending > 0 && (
                        <span className="bg-orange-500/10 text-orange-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-orange-500/20 uppercase tracking-wide">
                          {customer.statuses.pending} Pending
                        </span>
                      )}
                      {customer.statuses.processing > 0 && (
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-wide">
                          {customer.statuses.processing} Proc
                        </span>
                      )}
                      {customer.statuses.completed > 0 && (
                        <span className="bg-[#1DB954]/10 text-[#1DB954] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#1DB954]/20 uppercase tracking-wide">
                          {customer.statuses.completed} Done
                        </span>
                      )}
                      {customer.statuses.cancelled > 0 && (
                        <span className="bg-red-500/10 text-red-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-wide">
                          {customer.statuses.cancelled} Cancel
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-right whitespace-nowrap space-x-2">
                    {customer.hasProfile && (
                      <button
                        onClick={() => {
                          setEditingCustomer(customer);
                          setNewBalanceValue(customer.balance.toString());
                        }}
                        className="px-3 py-1.5 bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954] hover:bg-[#1DB954]/20 rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        Edit Balance
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete ${customer.email}? This action cannot be undone.`)) {
                          try {
                            const res = await fetch("/api/admin/delete-customer", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ email: customer.email })
                            });
                            if (res.ok) {
                              alert("Customer deleted successfully.");
                              window.location.reload();
                            } else {
                              const data = await res.json();
                              alert(data.error || "Failed to delete customer");
                            }
                          } catch (err) {
                            alert("An error occurred");
                          }
                        }
                      }}
                      className="px-2 py-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 rounded-lg transition-all text-xs font-extrabold uppercase tracking-wider"
                      title="Delete Customer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sortedCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-sm font-semibold">
                    No customers found matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Balance Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-slate-800/80 rounded-2xl w-full max-w-md shadow-2xl p-6 relative transform transition-all animate-in zoom-in-95 duration-200 text-slate-350">
            <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              Edit Wallet Balance
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Update the balance for <strong className="text-slate-200">{editingCustomer.email}</strong>.
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!editingCustomer.id) return;
              
              setIsUpdatingBalance(true);
              try {
                const res = await fetch("/api/admin/update-balance", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: editingCustomer.id, balance: parseFloat(newBalanceValue) })
                });

                if (res.ok) {
                  alert("Balance updated successfully!");
                  window.location.reload();
                } else {
                  const data = await res.json();
                  alert(data.error || "Failed to update balance");
                }
              } catch (err) {
                alert("An error occurred");
              } finally {
                setIsUpdatingBalance(false);
                setEditingCustomer(null);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  Wallet Balance (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={newBalanceValue}
                  onChange={(e) => setNewBalanceValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-black transition-all text-sm"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  disabled={isUpdatingBalance}
                  className="px-4 py-2 bg-transparent hover:bg-slate-800/40 border border-slate-800 rounded-xl text-slate-400 hover:text-white font-extrabold text-xs uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingBalance}
                  className="px-4 py-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  {isUpdatingBalance ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

