import { fallbackRead, ensureFeatureSchema } from "@/utils/supabase/dual-db";
import { enrichOrdersWithResolvedServiceTitles } from "@/lib/smmServiceResolver";
import { AnalyticsCharts } from "./AnalyticsCharts";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  amount: string | number | null;
  status: string | null;
  created_at: string | null;
  customer_email: string | null;
  quantity: string | number | null;
  smm_service_id: string | number | null;
  payment_method: string | null;
  services?: { title: string | null } | { title: string | null }[] | null;
};

export default async function AdminAnalyticsPage() {
  // Ensure feature tables exist on DO primary (idempotent).
  await ensureFeatureSchema();

  const [ordersRes, topupsRes] = await Promise.all([
    fallbackRead(async (db) => {
      return db
        .from("orders")
        .select(`
          id,
          amount,
          status,
          created_at,
          customer_email,
          quantity,
          smm_service_id,
          payment_method,
          services ( title )
        `)
        .order("created_at", { ascending: false });
    }),
    fallbackRead(async (db) => {
      return db
        .from("topups")
        .select("id, amount, status, created_at, email, payment_method")
        .order("created_at", { ascending: false });
    }),
  ]);

  const orders = (ordersRes.data || []) as OrderRow[];
  const topups = (topupsRes.data || []) as Array<{
    id: string;
    amount: string | number | null;
    status: string | null;
    created_at: string | null;
    email: string | null;
    payment_method: string | null;
  }>;

  const enriched = await enrichOrdersWithResolvedServiceTitles(orders);

  // Revenue = completed + processing orders (exclude Pending/Rejected/Cancelled).
  const revenueOrders = enriched.filter((o) =>
    ["Processing", "Completed", "Partial"].includes(String(o.status || ""))
  );
  const totalRevenue = revenueOrders.reduce((acc, o) => acc + Number(o.amount || 0), 0);
  const totalProviderCost = revenueOrders.reduce((acc, o) => acc + Number(o.estimated_provider_cost || 0), 0);
  const totalProfit = totalRevenue - totalProviderCost;

  // Top-up volume (approved only) — wallet load.
  const approvedTopups = topups.filter((t) => String(t.status || "").toLowerCase() === "approved");
  const totalTopupVolume = approvedTopups.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // Time-series bucketing by day (last 90 days).
  const dayBuckets = new Map<string, { date: string; revenue: number; cost: number; profit: number; orders: number }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayBuckets.set(key, { date: key, revenue: 0, cost: 0, profit: 0, orders: 0 });
  }

  for (const order of revenueOrders) {
    if (!order.created_at) continue;
    const key = new Date(order.created_at).toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(order.amount || 0);
    bucket.cost += Number(order.estimated_provider_cost || 0);
    bucket.profit += Number(order.estimated_profit || 0);
    bucket.orders += 1;
  }

  const timeSeries = Array.from(dayBuckets.values());

  // Revenue by service (top 10 by revenue).
  const serviceMap = new Map<string, { label: string; revenue: number; orders: number }>();
  for (const order of revenueOrders) {
    const label = order.resolved_service_title || "Unknown";
    const entry = serviceMap.get(label) || { label, revenue: 0, orders: 0 };
    entry.revenue += Number(order.amount || 0);
    entry.orders += 1;
    serviceMap.set(label, entry);
  }
  const topServices = Array.from(serviceMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Category breakdown (reuse the overview heuristic).
  let followers = 0, reactions = 0, views = 0, other = 0;
  for (const order of revenueOrders) {
    const title = order.resolved_service_title.toLowerCase();
    if (title.includes("follower") || title.includes("page")) followers += Number(order.amount || 0);
    else if (title.includes("like") || title.includes("reaction") || title.includes("react") || title.includes("love")) reactions += Number(order.amount || 0);
    else if (title.includes("view") || title.includes("watch") || title.includes("video")) views += Number(order.amount || 0);
    else other += Number(order.amount || 0);
  }
  const categories = [
    { label: "Followers & Pages", revenue: followers },
    { label: "Reactions & Likes", revenue: reactions },
    { label: "Views & Watchtime", revenue: views },
    { label: "Other", revenue: other },
  ];

  // Payment method split.
  const walletRevenue = revenueOrders.filter((o) => String(o.payment_method || "").toLowerCase() === "wallet")
    .reduce((acc, o) => acc + Number(o.amount || 0), 0);
  const gcashRevenue = revenueOrders.filter((o) => String(o.payment_method || "").toLowerCase() !== "wallet")
    .reduce((acc, o) => acc + Number(o.amount || 0), 0);

  // Top customers by spend.
  const customerMap = new Map<string, { email: string; spend: number; orders: number }>();
  for (const order of revenueOrders) {
    const email = String(order.customer_email || "Unknown").toLowerCase();
    const entry = customerMap.get(email) || { email, spend: 0, orders: 0 };
    entry.spend += Number(order.amount || 0);
    entry.orders += 1;
    customerMap.set(email, entry);
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  const summary = {
    totalRevenue,
    totalProviderCost,
    totalProfit,
    totalTopupVolume,
    totalOrders: revenueOrders.length,
    avgOrderValue: revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0,
    uniqueCustomers: customerMap.size,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-300">
      <div className="flex flex-col gap-2 border-b border-slate-850/60 pb-5">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">Business intelligence</span>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Revenue & Margin Analytics</h1>
        <p className="max-w-2xl text-xs font-semibold leading-relaxed text-slate-400">
          Time-series revenue/profit, top services and customers, and payment-method splits — computed from live orders + top-ups.
        </p>
      </div>

      <AnalyticsCharts
        summary={summary}
        timeSeries={timeSeries}
        topServices={topServices}
        categories={categories}
        walletRevenue={walletRevenue}
        gcashRevenue={gcashRevenue}
        topCustomers={topCustomers}
      />
    </div>
  );
}
