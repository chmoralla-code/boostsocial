"use client";

import { useState, useMemo } from "react";
import { TrendingUp, DollarSign, ShoppingCart, Wallet, Users, BarChart3 } from "lucide-react";

type Summary = {
  totalRevenue: number;
  totalProviderCost: number;
  totalProfit: number;
  totalTopupVolume: number;
  totalOrders: number;
  avgOrderValue: number;
  uniqueCustomers: number;
};

type TimeBucket = {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
};

type ServiceRow = {
  label: string;
  revenue: number;
  orders: number;
};

type CategoryRow = {
  label: string;
  revenue: number;
};

type CustomerRow = {
  email: string;
  spend: number;
  orders: number;
};

function money(value: number) {
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function AnalyticsCharts({
  summary,
  timeSeries,
  topServices,
  categories,
  walletRevenue,
  gcashRevenue,
  topCustomers,
}: {
  summary: Summary;
  timeSeries: TimeBucket[];
  topServices: ServiceRow[];
  categories: CategoryRow[];
  walletRevenue: number;
  gcashRevenue: number;
  topCustomers: CustomerRow[];
}) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const filteredSeries = useMemo(() => timeSeries.slice(-range), [timeSeries, range]);

  const maxRevenue = Math.max(...filteredSeries.map((b) => b.revenue), 1);
  const maxProfit = Math.max(...filteredSeries.map((b) => b.profit), 1);
  const maxCategory = Math.max(...categories.map((c) => c.revenue), 1);

  const cards = [
    { label: "Gross Revenue", value: money(summary.totalRevenue), icon: DollarSign, tone: "text-[#1DB954]" },
    { label: "Est. Profit", value: money(summary.totalProfit), icon: TrendingUp, tone: "text-emerald-400" },
    { label: "Top-Up Volume", value: money(summary.totalTopupVolume), icon: Wallet, tone: "text-blue-400" },
    { label: "Total Orders", value: String(summary.totalOrders), icon: ShoppingCart, tone: "text-purple-400" },
    { label: "Avg Order", value: money(summary.avgOrderValue), icon: BarChart3, tone: "text-amber-400" },
    { label: "Unique Customers", value: String(summary.uniqueCustomers), icon: Users, tone: "text-orange-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#181818]/90 border border-slate-850/80 rounded-2xl p-5 shadow-lg">
            <span className={`inline-flex p-2.5 rounded-xl border border-slate-700/60 bg-[#121212] ${card.tone}`}>
              <card.icon size={16} />
            </span>
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</p>
            <h3 className="mt-1 text-xl font-black text-white tracking-tight">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        {/* Time series */}
        <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Daily Revenue & Profit</h3>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Last {range} days</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-[#121212] p-1">
              {([7, 30, 90] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setRange(days)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${range === days ? "bg-[#1DB954] text-black" : "text-slate-400 hover:text-white"}`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {/* Revenue bars */}
          <div className="mt-6">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Revenue</p>
            <div className="mt-2 flex h-24 items-end gap-0.5">
              {filteredSeries.map((bucket) => (
                <div
                  key={bucket.date}
                  title={`${shortDate(bucket.date)}: ${money(bucket.revenue)}`}
                  className="flex-1 rounded-t bg-[#1DB954]/70 hover:bg-[#1DB954] transition-colors"
                  style={{ height: `${Math.max((bucket.revenue / maxRevenue) * 100, 2)}%` }}
                />
              ))}
            </div>
          </div>

          {/* Profit bars */}
          <div className="mt-5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Est. Profit</p>
            <div className="mt-2 flex h-24 items-end gap-0.5">
              {filteredSeries.map((bucket) => (
                <div
                  key={bucket.date}
                  title={`${shortDate(bucket.date)}: ${money(bucket.profit)}`}
                  className="flex-1 rounded-t bg-emerald-400/70 hover:bg-emerald-400 transition-colors"
                  style={{ height: `${Math.max((bucket.profit / maxProfit) * 100, 2)}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[8px] font-black uppercase text-slate-600">
              <span>{shortDate(filteredSeries[0]?.date || "")}</span>
              <span>{shortDate(filteredSeries[filteredSeries.length - 1]?.date || "")}</span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Payment split */}
          <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Payment Method Split</h3>
            <div className="mt-4 space-y-3">
              {[
                { label: "Wallet", value: walletRevenue },
                { label: "GCash / Receipt", value: gcashRevenue },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400">{row.label}</span>
                    <span className="text-white font-black">{money(row.value)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[#121212] border border-slate-850 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.label === "Wallet" ? "bg-[#1DB954]" : "bg-blue-500"}`}
                      style={{ width: `${Math.min((row.value / Math.max(walletRevenue + gcashRevenue, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Revenue by Category</h3>
            <div className="mt-4 space-y-3">
              {categories.map((cat) => (
                <div key={cat.label}>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400">{cat.label}</span>
                    <span className="text-white font-black">{money(cat.revenue)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[#121212] border border-slate-850 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${Math.min((cat.revenue / maxCategory) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top services + customers */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Top Services by Revenue</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-2.5 px-2 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Service</th>
                  <th className="py-2.5 px-2 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest text-right">Orders</th>
                  <th className="py-2.5 px-2 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50">
                {topServices.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-800/20">
                    <td className="py-2.5 px-2 text-xs font-bold text-white max-w-[220px] truncate">{row.label}</td>
                    <td className="py-2.5 px-2 text-xs font-bold text-slate-400 text-right">{row.orders}</td>
                    <td className="py-2.5 px-2 text-xs font-black text-[#1DB954] text-right">{money(row.revenue)}</td>
                  </tr>
                ))}
                {topServices.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-xs text-slate-500 italic">No revenue data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Top Customers by Spend</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-2.5 px-2 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Customer</th>
                  <th className="py-2.5 px-2 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest text-right">Orders</th>
                  <th className="py-2.5 px-2 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest text-right">Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50">
                {topCustomers.map((row) => (
                  <tr key={row.email} className="hover:bg-slate-800/20">
                    <td className="py-2.5 px-2 text-xs font-bold text-white max-w-[220px] truncate">{row.email}</td>
                    <td className="py-2.5 px-2 text-xs font-bold text-slate-400 text-right">{row.orders}</td>
                    <td className="py-2.5 px-2 text-xs font-black text-[#1DB954] text-right">{money(row.spend)}</td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-xs text-slate-500 italic">No customer data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
