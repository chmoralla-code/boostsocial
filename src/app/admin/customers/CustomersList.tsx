"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search, ArrowUpDown, Mail, ShoppingBag, DollarSign, Calendar, Landmark, Trash2 } from "lucide-react";

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

export function CustomersList({ initialCustomers }: { initialCustomers: Customer[] }) {
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
    <div className="space-y-6">
      {/* Controls Grid */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search & Bulk Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-900 font-medium"
            />
          </div>
          {initialCustomers.length > 0 && (
            <button
              onClick={handleDeleteAllAccounts}
              disabled={isDeletingAll}
              className="w-full sm:w-auto px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 disabled:opacity-50 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 flex-shrink-0 shadow-sm"
            >
              <Trash2 size={14} />
              {isDeletingAll ? "Deleting..." : "Delete All Accounts"}
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-sm font-semibold text-slate-500 whitespace-nowrap">Sort by:</span>
          <button
            onClick={() => toggleSort("spent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "spent" 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <DollarSign size={14} /> Revenue
            <ArrowUpDown size={12} />
          </button>
          <button
            onClick={() => toggleSort("balance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "balance" 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Landmark size={14} /> Wallet Balance
            <ArrowUpDown size={12} />
          </button>
          <button
            onClick={() => toggleSort("orders")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "orders" 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <ShoppingBag size={14} /> Orders count
            <ArrowUpDown size={12} />
          </button>
          <button
            onClick={() => toggleSort("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all
              ${sortBy === "active" 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Calendar size={14} /> Recency
            <ArrowUpDown size={12} />
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Customer Email</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Wallet Balance</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm text-center">Orders Count</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Total Revenue</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Last Active</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Status Summary</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedCustomers.map((customer) => (
                <tr key={customer.email} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 text-sm font-semibold text-slate-900 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                        <Mail size={16} />
                      </div>
                      {customer.email}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-slate-900 whitespace-nowrap">
                    {customer.hasProfile ? (
                      <span className="text-slate-900">₱{customer.balance.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">No Account</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600 text-center font-bold">
                    {customer.totalOrders}
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-green-600">
                    ₱{customer.totalSpent.toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">
                    {format(new Date(customer.lastActive), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      {customer.statuses.pending > 0 && (
                        <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full border border-orange-100">
                          {customer.statuses.pending} Pending
                        </span>
                      )}
                      {customer.statuses.processing > 0 && (
                        <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-100">
                          {customer.statuses.processing} Processing
                        </span>
                      )}
                      {customer.statuses.completed > 0 && (
                        <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full border border-green-100">
                          {customer.statuses.completed} Completed
                        </span>
                      )}
                      {customer.statuses.cancelled > 0 && (
                        <span className="bg-red-50 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full border border-red-100">
                          {customer.statuses.cancelled} Cancelled
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
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
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
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex text-xs font-bold"
                      title="Delete Customer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sortedCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 relative transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              Edit Wallet Balance
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Update the balance for <strong className="text-slate-800">{editingCustomer.email}</strong>.
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Wallet Balance (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={newBalanceValue}
                  onChange={(e) => setNewBalanceValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 font-bold transition-all text-sm"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  disabled={isUpdatingBalance}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingBalance}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5"
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

