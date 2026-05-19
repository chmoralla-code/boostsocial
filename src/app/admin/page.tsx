import { createClient } from "@/utils/supabase/server";
import { DollarSign, ShoppingCart, Activity } from "lucide-react";
import { StorageOptimizingPanel } from "./StorageOptimizingPanel";
import { TelegramSettingsPanel } from "./TelegramSettingsPanel";

export default async function AdminOverview() {
  const supabase = await createClient();

  // Fetch some stats
  const { data: orders } = await supabase.from('orders').select('amount, status');
  
  const totalRevenue = orders?.reduce((acc, order) => acc + Number(order.amount), 0) || 0;
  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'Pending').length || 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-blue-100 p-4 rounded-xl text-blue-600">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Revenue</div>
            <div className="text-2xl font-bold text-slate-900">₱{totalRevenue.toFixed(2)}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-purple-100 p-4 rounded-xl text-purple-600">
            <ShoppingCart size={24} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Orders</div>
            <div className="text-2xl font-bold text-slate-900">{totalOrders}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-orange-100 p-4 rounded-xl text-orange-600">
            <Activity size={24} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Pending Orders</div>
            <div className="text-2xl font-bold text-slate-900">{pendingOrders}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Welcome to BoostSocial Admin</h2>
        <p className="text-slate-600">
          Use the sidebar navigation to manage orders, update your service pricing, and view customer details.
        </p>
      </div>

      {/* Storage preservation widget */}
      <StorageOptimizingPanel />

      {/* Telegram Notification Settings */}
      <TelegramSettingsPanel />
    </div>
  );
}
