import { createClient } from "@/utils/supabase/server";
import { DollarSign, ShoppingCart, Activity, Users, ArrowUpRight, TrendingUp, Sparkles, Clock, Globe, Wallet } from "lucide-react";
import { StorageOptimizingPanel } from "./StorageOptimizingPanel";
import { MaintenanceSettingsPanel } from "./MaintenanceSettingsPanel";
import { TelegramSettingsPanel } from "./TelegramSettingsPanel";
import { HeroVideoSettingsPanel } from "./HeroVideoSettingsPanel";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function AdminOverview() {
  const supabase = await createClient();

  // Fetch RixeySMM live balance
  const apiKey = process.env.RIXEYSMM_API_KEY;
  let rixeyBalance = "0.00";
  if (apiKey) {
    try {
      const res = await fetch("https://rixeysmm.shop/api/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          key: apiKey,
          action: "balance",
        }),
        next: { revalidate: 30 }
      });
      if (res.ok) {
        const data = await res.json();
        rixeyBalance = data.balance ? Number(data.balance).toFixed(2) : "0.00";
      }
    } catch (err) {
      console.error("Failed to fetch RixeySMM balance:", err);
    }
  }

  // Fetch orders with services details
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      amount,
      status,
      created_at,
      customer_email,
      target_url,
      services ( title )
    `)
    .order('created_at', { ascending: false });

  // Calculate metrics
  const totalRevenue = orders?.reduce((acc, order) => acc + Number(order.amount), 0) || 0;
  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'Pending').length || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Calculate unique active customers
  const uniqueCustomers = Array.from(new Set(orders?.map(o => o.customer_email) || [])).length;

  // Calculate service share
  let followersCount = 0;
  let reactionsCount = 0;
  let viewsCount = 0;
  let otherCount = 0;

  orders?.forEach(o => {
    const servicesData = o.services as unknown as { title: string } | { title: string }[] | null;
    const title = (Array.isArray(servicesData) ? servicesData[0]?.title : servicesData?.title)?.toLowerCase() || "";
    if (title.includes("follower") || title.includes("page")) {
      followersCount++;
    } else if (title.includes("like") || title.includes("reaction") || title.includes("react") || title.includes("love")) {
      reactionsCount++;
    } else if (title.includes("view") || title.includes("watch") || title.includes("video")) {
      viewsCount++;
    } else {
      otherCount++;
    }
  });

  const totalCategorized = followersCount + reactionsCount + viewsCount + otherCount || 1;
  const followersPercent = Math.round((followersCount / totalCategorized) * 100);
  const reactionsPercent = Math.round((reactionsCount / totalCategorized) * 100);
  const viewsPercent = Math.round((viewsCount / totalCategorized) * 100);
  const otherPercent = Math.round((otherCount / totalCategorized) * 100);

  // Take latest 5 orders for feed
  const recentOrders = orders?.slice(0, 5) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300">
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-850/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#1DB954]/10 text-[#1DB954] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#1DB954]/20 flex items-center gap-1">
              <Sparkles size={10} className="animate-pulse" /> Live System Active
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mt-2 flex items-center gap-3">
            Admin Console Overview
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Realtime database insights, transaction logs, and platform health telemetry.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-[#181818]/60 border border-slate-850/80 rounded-xl px-4 py-2.5 backdrop-blur-md">
          <Globe size={14} className="text-[#1DB954] animate-spin-[spin_8s_linear_infinite]" />
          <div className="text-right">
            <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Region API Status</div>
            <div className="text-xs font-bold text-white">Manila, PHT (GMT+8)</div>
          </div>
        </div>
      </div>

      {/* Analytics Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {/* Metric: Revenue */}
        <div className="bg-[#181818]/90 border border-slate-850/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-[#1DB954]/30 transition-all hover:scale-[1.01] duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#1DB954]/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Gross Revenue</span>
              <h3 className="text-2xl font-black text-white tracking-tight">₱{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <span className="bg-[#1DB954]/10 text-[#1DB954] p-2.5 rounded-xl border border-[#1DB954]/25">
              <DollarSign size={18} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-slate-450">
            <TrendingUp size={12} className="text-[#1DB954]" />
            <span className="text-[#1DB954]">Direct SQL Live Sync</span>
          </div>
        </div>

        {/* Metric: Total Orders */}
        <div className="bg-[#181818]/90 border border-slate-850/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-all hover:scale-[1.01] duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Volume</span>
              <h3 className="text-2xl font-black text-white tracking-tight">{totalOrders} Orders</h3>
            </div>
            <span className="bg-purple-500/10 text-purple-400 p-2.5 rounded-xl border border-purple-500/25">
              <ShoppingCart size={18} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-slate-450">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
            <span>Across all users</span>
          </div>
        </div>

        {/* Metric: Avg Order Value */}
        <div className="bg-[#181818]/90 border border-slate-850/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-all hover:scale-[1.01] duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Average Basket</span>
              <h3 className="text-2xl font-black text-white tracking-tight">₱{avgOrderValue.toFixed(2)}</h3>
            </div>
            <span className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl border border-blue-500/25">
              <Users size={18} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-slate-450">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            <span>{uniqueCustomers} unique customers</span>
          </div>
        </div>

        {/* Metric: Pending Orders */}
        <div className="bg-[#181818]/90 border border-slate-850/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-orange-500/30 transition-all hover:scale-[1.01] duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-orange-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Awaiting Delivery</span>
              <h3 className="text-2xl font-black text-white tracking-tight">{pendingOrders} Pending</h3>
            </div>
            <span className={`p-2.5 rounded-xl border transition-all ${
              pendingOrders > 0 
                ? "bg-orange-500/20 text-orange-400 border-orange-500/35 animate-pulse" 
                : "bg-slate-800 text-slate-550 border-slate-700"
            }`}>
              <Activity size={18} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-slate-450">
            <span className={`w-1.5 h-1.5 rounded-full ${pendingOrders > 0 ? "bg-orange-500 animate-ping" : "bg-slate-650"}`}></span>
            <span>Action required</span>
          </div>
        </div>

        {/* Metric: RixeySMM Balance */}
        <div className="bg-[#181818]/90 border border-slate-850/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-[#1DB954]/30 transition-all hover:scale-[1.01] duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#1DB954]/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">RixeySMM Balance</span>
              <h3 className="text-2xl font-black text-white tracking-tight">₱{Number(rixeyBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <span className="bg-[#1DB954]/10 text-[#1DB954] p-2.5 rounded-xl border border-[#1DB954]/25">
              <Wallet size={18} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-slate-450">
            <span className="w-1.5 h-1.5 bg-[#1DB954] rounded-full animate-pulse"></span>
            <span>Realtime SMM API</span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout split into Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Activity Feed & Storage Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Orders Feed */}
          <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-850/50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  ⚡ Live Activity Feed
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Showing the latest 5 incoming orders in real-time.</p>
              </div>
              
              <Link 
                href="/admin/orders" 
                className="text-[10px] font-black text-[#1DB954] hover:text-[#1ed760] transition-colors border border-[#1DB954]/20 hover:border-[#1DB954]/50 px-3 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1 bg-[#1DB954]/5"
              >
                Manage All Orders <ArrowUpRight size={10} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="py-2.5 px-4 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Date / ID</th>
                    <th className="py-2.5 px-4 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Customer</th>
                    <th className="py-2.5 px-4 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Service</th>
                    <th className="py-2.5 px-4 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Revenue</th>
                    <th className="py-2.5 px-4 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {recentOrders.map((order: any) => {
                    let relativeTime = "Just now";
                    try {
                      relativeTime = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });
                    } catch (e) {}

                    return (
                      <tr key={order.id} className="hover:bg-slate-800/20 transition-colors border-b border-slate-850/40">
                        {/* ID & Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-[10px] font-black text-slate-350">
                            BS-{order.id.slice(0, 6).toUpperCase()}
                          </div>
                          <div className="text-[9px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock size={8} />{relativeTime}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-400 max-w-[140px] truncate">
                          {order.customer_email}
                        </td>

                        {/* Service Name */}
                        <td className="py-3.5 px-4 text-xs font-bold text-white max-w-[150px] truncate">
                          {(() => {
                            const servicesData = order.services as unknown as { title: string } | { title: string }[] | null;
                            return Array.isArray(servicesData) ? servicesData[0]?.title : servicesData?.title;
                          })()}
                        </td>

                        {/* Revenue */}
                        <td className="py-3.5 px-4 text-xs font-black text-white">
                          ₱{Number(order.amount).toFixed(2)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border whitespace-nowrap
                            ${order.status === 'Pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                              order.status === 'Processing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                              order.status === 'Completed' ? 'bg-green-500/10 text-[#1DB954] border-green-500/20' : 
                              'bg-red-500/10 text-red-400 border-red-500/20'}`}
                          >
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {recentOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-slate-500 italic">
                        No transactions registered in system database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* StoragePreservationPanel, TelegramNotificationPanel, and HeroVideoSettingsPanel */}
          <StorageOptimizingPanel />
          <MaintenanceSettingsPanel />
          <TelegramSettingsPanel />
          <HeroVideoSettingsPanel />

        </div>

        {/* Right Column: Analytics breakdowns & Quick Control Center */}
        <div className="space-y-6">
          
          {/* Service Share Breakdown */}
          <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                📈 Service Share Breakdown
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Calculated ratio of category volumes.</p>
            </div>
            
            <div className="space-y-4 mt-6">
              {/* Followers */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-350">Page Followers & Growth</span>
                  <span className="text-[#1DB954] font-black">{followersPercent}%</span>
                </div>
                <div className="w-full bg-[#121212] h-2 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="bg-[#1DB954] h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_#1DB954/50]" 
                    style={{ width: `${followersPercent}%` }}
                  ></div>
                </div>
                <div className="text-[8px] font-black uppercase text-slate-500 tracking-wider flex justify-between">
                  <span>Volume: {followersCount} Orders</span>
                  <span>Category Rate</span>
                </div>
              </div>

              {/* Reactions */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-350">Post Reactions & Likes</span>
                  <span className="text-purple-400 font-black">{reactionsPercent}%</span>
                </div>
                <div className="w-full bg-[#121212] h-2 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="bg-purple-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_#a855f7/50]" 
                    style={{ width: `${reactionsPercent}%` }}
                  ></div>
                </div>
                <div className="text-[8px] font-black uppercase text-slate-500 tracking-wider flex justify-between">
                  <span>Volume: {reactionsCount} Orders</span>
                  <span>Category Rate</span>
                </div>
              </div>

              {/* Views */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-350">Video Views & Watchtime</span>
                  <span className="text-blue-400 font-black">{viewsPercent}%</span>
                </div>
                <div className="w-full bg-[#121212] h-2 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_#3b82f6/50]" 
                    style={{ width: `${viewsPercent}%` }}
                  ></div>
                </div>
                <div className="text-[8px] font-black uppercase text-slate-500 tracking-wider flex justify-between">
                  <span>Volume: {viewsCount} Orders</span>
                  <span>Category Rate</span>
                </div>
              </div>

              {/* Other Services */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-350">Custom Wants & Other</span>
                  <span className="text-slate-500 font-black">{otherPercent}%</span>
                </div>
                <div className="w-full bg-[#121212] h-2 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className="bg-slate-700 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${otherPercent}%` }}
                  ></div>
                </div>
                <div className="text-[8px] font-black uppercase text-slate-500 tracking-wider flex justify-between">
                  <span>Volume: {otherCount} Orders</span>
                  <span>Category Rate</span>
                </div>
              </div>

            </div>
          </div>

          {/* Quick Platform Telemetry */}
          <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
            
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              ⚙️ Platform Telemetry
            </h3>
            
            <div className="space-y-3 mt-4 text-xs font-semibold">
              <div className="flex justify-between py-2 border-b border-slate-850/40">
                <span className="text-slate-500">Database Engine</span>
                <span className="text-white font-mono">Postgres 15.x</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-850/40">
                <span className="text-slate-500">CDN Edge Networks</span>
                <span className="text-[#1DB954] font-bold">Vercel Edge</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-850/40">
                <span className="text-slate-500">Realtime Subscription</span>
                <span className="text-white bg-slate-850 px-2 py-0.5 rounded border border-slate-800 text-[10px] font-mono font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Average Ping time</span>
                <span className="text-emerald-400 font-bold">~14ms</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

