"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search, ArrowUpDown, Mail, ShoppingBag, DollarSign, Calendar } from "lucide-react";

interface Customer {
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastActive: string;
  statuses: {
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
}

export function CustomersList({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"spent" | "orders" | "active">("spent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  const toggleSort = (field: "spent" | "orders" | "active") => {
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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-900 font-medium"
          />
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
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm text-center">Orders Count</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Total Revenue</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Last Active</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Status Summary</th>
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
                  <td className="py-4 px-6 text-sm text-slate-600 text-center font-bold">
                    {customer.totalOrders}
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-green-600">
                    ${customer.totalSpent.toFixed(2)}
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
                </tr>
              ))}
              {sortedCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No customers found matching search criteria.
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
