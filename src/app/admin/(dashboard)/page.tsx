import { fallbackRead } from "@/utils/supabase/dual-db";
import { DollarSign, ShoppingCart, Activity, Users, ArrowUpRight, TrendingUp, Sparkles, Clock, Globe, Wallet, Settings, FileText } from "lucide-react";
import { StorageOptimizingPanel } from "./StorageOptimizingPanel";
import { MaintenanceSettingsPanel } from "./MaintenanceSettingsPanel";
import { AnnouncementSettingsPanel } from "./AnnouncementSettingsPanel";
import { TelegramSettingsPanel } from "./TelegramSettingsPanel";
import { HeroVideoSettingsPanel } from "./HeroVideoSettingsPanel";
import { HeroTextSettingsPanel } from "./HeroTextSettingsPanel";
import { ServicesBgSettingsPanel } from "./ServicesBgSettingsPanel";
import { ServicesCandidatesPanel } from "./ServicesCandidatesPanel";
import { WidgetVisibilityPanel } from "./WidgetVisibilityPanel";
import { ShowcaseVideoSettingsPanel } from "./ShowcaseVideoSettingsPanel";
import { MarkupSettingsPanel } from "./MarkupSettingsPanel";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { InstallAppButton } from "./InstallAppButton";
import { enrichOrdersWithResolvedServiceTitles } from "@/lib/smmServiceResolver";

type ServiceJoin = {
  title: string | null;
};

type DashboardOrder = {
  id: string;
  amount: string | number | null;
  status: string | null;
  created_at: string | null;
  customer_email: string | null;
  target_url: string | null;
  quantity: string | number | null;
  smm_service_id: string | number | null;
  services?: ServiceJoin | ServiceJoin[] | null;
};

type EnrichedDashboardOrder = DashboardOrder & {
  resolved_service_title: string;
  estimated_provider_cost: number;
  estimated_profit: number;
};

export default async function AdminOverview() {

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
  const { data: orders } = await fallbackRead(async (db) => {
    return db
      .from('orders')
      .select(`
        id,
        amount,
        status,
        created_at,
        customer_email,
        target_url,
        quantity,
        smm_service_id,
        services ( title )
      `)
      .order('created_at', { ascending: false });
  });

  const enrichedOrders = (await enrichOrdersWithResolvedServiceTitles(
    (orders || []) as DashboardOrder[]
  )) as EnrichedDashboardOrder[];

  // Calculate metrics
  const totalRevenue = enrichedOrders.reduce((acc, order) => acc + Number(order.amount), 0);
  const totalProviderCost = enrichedOrders.reduce((acc, order) => acc + Number(order.estimated_provider_cost || 0), 0);
  const totalEstimatedProfit = enrichedOrders.reduce((acc, order) => acc + Number(order.estimated_profit || 0), 0);
  const totalOrders = enrichedOrders.length;
  const pendingOrders = enrichedOrders.filter(o => o.status === 'Pending').length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Calculate unique active customers
  const uniqueCustomers = Array.from(new Set(enrichedOrders.map(o => o.customer_email) || [])).length;

  // Calculate service share
  let followersCount = 0;
  let reactionsCount = 0;
  let viewsCount = 0;
  let otherCount = 0;

  enrichedOrders.forEach(o => {
    const servicesData = o.services as unknown as { title: string } | { title: string }[] | null;
    const title = (o.resolved_service_title || (Array.isArray(servicesData) ? servicesData[0]?.title : servicesData?.title))?.toLowerCase() || "";
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
  const recentOrders = enrichedOrders.slice(0, 5);
  const quickActions = [
    {
      href: "/admin/orders",
      label: "Review orders",
      description: pendingOrders > 0 ? `${pendingOrders} pending orders need attention` : "All order queues are caught up",
      icon: ShoppingCart,
      toneClass: "border-orange-500/25 bg-orange-500/10 text-orange-400",
    },
    {
      href: "/admin/topups",
      label: "Approve top-ups",
      description: "Verify GCash receipts and wallet deposits",
      icon: Wallet,
      toneClass: "border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954]",
    },
    {
      href: "/admin/services",
      label: "Manage services",
      description: "Edit candidate services, prices, and SMM IDs",
      icon: Settings,
      toneClass: "border-blue-500/25 bg-blue-500/10 text-blue-400",
    },
    {
      href: "/admin/page-requests",
      label: "Page requests",
      description: "Handle custom Facebook page transfers",
      icon: FileText,
      toneClass: "border-purple-500/25 bg-purple-500/10 text-purple-400",
    },
  ];

  return (
    <div className="space-y-7 animate-in fade-in duration-300 text-slate-300">
      {/* Top Banner Greeting */}
      <div className="flex flex-col gap-4 border-b border-slate-850/60 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#1DB954]/10 text-[#1DB954] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#1DB954]/20 flex items-center gap-1">
              <Sparkles size={10} className="animate-pulse" /> Live System Active
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Admin Console Overview
          </h1>
          <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-slate-400">
            Daily operations, website controls, and system health are grouped so you can work faster on mobile or desktop.
          </p>
        </div>
        
        <div className="flex w-full items-center gap-3 rounded-xl border border-slate-850/80 bg-[#181818]/60 px-4 py-2.5 backdrop-blur-md md:w-auto">
          <Globe size={14} className="text-[#1DB954] animate-spin-[spin_8s_linear_infinite]" />
          <div className="min-w-0 md:text-right">
            <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Region API Status</div>
            <div className="text-xs font-bold text-white">Manila, PHT (GMT+8)</div>
          </div>
        </div>
      </div>

      {/* PWA App Downloader Widget */}
      <InstallAppButton />

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Daily operations"
          title="Start with the important queues"
          description="The buttons below are the fastest path to the admin work that usually needs attention first."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <QuickActionLink key={action.href} {...action} />
          ))}
        </div>
      </section>

      {/* Analytics Metric Cards Grid */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow="Business snapshot"
          title="Revenue and platform pulse"
          description="Compact metrics stay readable on phones and expand into a dense desktop grid."
        />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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

        {/* Metric: Estimated Profit */}
        <div className="bg-[#181818]/90 border border-slate-850/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all hover:scale-[1.01] duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Est. Profit</span>
              <h3 className="text-2xl font-black text-white tracking-tight">â‚±{totalEstimatedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/25">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-slate-450">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            <span>Cost est. â‚±{totalProviderCost.toFixed(2)}</span>
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
      </section>

      {/* Main Grid Layout split into Columns */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        
        {/* Primary Work Column */}
        <div className="space-y-6">
          
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

            <div className="space-y-3 md:hidden">
              {recentOrders.map((order) => {
                const relativeTime = formatOrderTime(order.created_at);

                return (
                  <div key={order.id} className="rounded-xl border border-slate-850 bg-[#121212]/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-black tracking-wider text-slate-300">
                          BS-{order.id.slice(0, 6).toUpperCase()}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                          <Clock size={10} /> {relativeTime}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider
                        ${order.status === 'Pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          order.status === 'Processing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          order.status === 'Completed' ? 'bg-green-500/10 text-[#1DB954] border-green-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Customer</p>
                        <p className="truncate text-xs font-semibold text-slate-300">{order.customer_email}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Service</p>
                        <p className="line-clamp-2 text-xs font-bold text-white">{order.resolved_service_title}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-850 pt-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue</span>
                      <span className="text-sm font-black text-white">PHP {Number(order.amount).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}

              {recentOrders.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs font-semibold italic text-slate-500">
                  No transactions registered in system database.
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
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
                  {recentOrders.map((order) => {
                    const relativeTime = formatOrderTime(order.created_at);

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
                          {order.resolved_service_title}
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

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Website controls"
              title="Content, homepage, and visible customer tools"
              description="These settings affect what customers see first: announcements, videos, service candidates, and floating widgets."
            />
            <div className="space-y-4">
              <AnnouncementSettingsPanel />
              <HeroVideoSettingsPanel />
              <ShowcaseVideoSettingsPanel />
              <HeroTextSettingsPanel />
              <ServicesBgSettingsPanel />
              <ServicesCandidatesPanel />
              <WidgetVisibilityPanel />
              <MarkupSettingsPanel />
            </div>
          </section>

        </div>

        {/* Secondary Work Column */}
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
                <span className="text-slate-500">Primary Database</span>
                <span className="text-[#1DB954] font-bold">DigitalOcean Managed</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-850/40">
                <span className="text-slate-500">Replica & Auth</span>
                <span className="text-white font-mono">Supabase</span>
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

          <section className="space-y-4">
            <SectionHeader
              eyebrow="System controls"
              title="Automation, storage, and maintenance"
              description="Keep these tools separate from customer-facing content so risky operations are easier to spot."
            />
            <div className="space-y-4">
              <TelegramSettingsPanel />
              <StorageOptimizingPanel />
              <MaintenanceSettingsPanel />
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
        {eyebrow}
      </span>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-base font-black tracking-tight text-white sm:text-lg">{title}</h2>
        <p className="max-w-2xl text-xs font-semibold leading-relaxed text-slate-500 sm:text-right">
          {description}
        </p>
      </div>
    </div>
  );
}

function formatOrderTime(createdAt: string | null) {
  if (!createdAt) return "Just now";

  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch {
    return "Just now";
  }
}

function QuickActionLink({
  href,
  label,
  description,
  icon: Icon,
  toneClass,
}: {
  href: string;
  label: string;
  description: string;
  icon: typeof ShoppingCart;
  toneClass: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 items-start gap-4 rounded-2xl border border-slate-850 bg-[#181818]/85 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1DB954]/30 hover:bg-[#1b1b1b]"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-sm font-black uppercase tracking-wider text-white">
          <span className="truncate">{label}</span>
          <ArrowUpRight size={15} className="shrink-0 text-slate-600 transition group-hover:text-[#1DB954]" />
        </span>
        <span className="mt-2 block text-xs font-semibold leading-relaxed text-slate-500">
          {description}
        </span>
      </span>
    </Link>
  );
}

