"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { format } from "date-fns";

export function OrdersTable({ initialOrders }: { initialOrders: any[] }) {
  const [orders, setOrders] = useState(initialOrders);
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Date</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Customer</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Service</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Quantity</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Target URL</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Amount</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">
                  {format(new Date(order.created_at), 'MMM d, yyyy')}
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
                <td colSpan={7} className="py-8 text-center text-slate-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
