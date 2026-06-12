import Link from "next/link";
import { ArrowUpRight, Bot, ClipboardList, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { MobileAppSettingsPanel } from "./MobileAppSettingsPanel";

type RecentOrder = {
  amount: number | string | null;
};

function formatPhp(value: number) {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminMobileAppPage() {
  const supabase = await createClient();

  const [
    pendingOrdersResult,
    pendingTopupsResult,
    totalOrdersResult,
    totalTopupsResult,
    recentOrdersResult,
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "Pending"),
    supabase.from("topups").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("topups").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("amount").order("created_at", { ascending: false }).limit(25),
  ]);

  const recentSalesTotal = ((recentOrdersResult.data || []) as RecentOrder[]).reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  );

  return (
    <div className="space-y-6 pt-2 text-fg sm:pt-0">
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
          Mobile App Dashboard
        </h1>
        <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-muted">
          Edit the simplified APK experience, publish update notices, and control version status separately from the website homepage.
        </p>
      </div>

      <AppOperationsPanel
        pendingOrders={pendingOrdersResult.count || 0}
        pendingTopups={pendingTopupsResult.count || 0}
        totalOrders={totalOrdersResult.count || 0}
        totalTopups={totalTopupsResult.count || 0}
        recentSalesTotal={recentSalesTotal}
      />

      <MobileAppSettingsPanel />
    </div>
  );
}

function AppOperationsPanel({
  pendingOrders,
  pendingTopups,
  totalOrders,
  totalTopups,
  recentSalesTotal,
}: {
  pendingOrders: number;
  pendingTopups: number;
  totalOrders: number;
  totalTopups: number;
  recentSalesTotal: number;
}) {
  const cards = [
    {
      href: "/admin/orders",
      label: "App Order Management",
      value: `${pendingOrders} pending`,
      description: `${totalOrders} total orders use the same admin queue for app and website checkout.`,
      icon: ClipboardList,
      toneClass: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    },
    {
      href: "/admin/topups",
      label: "App Wallet Top-Ups",
      value: `${pendingTopups} pending`,
      description: `${totalTopups} total wallet deposits can be approved from admin or Telegram.`,
      icon: Wallet,
      toneClass: "border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954]",
    },
    {
      href: "/admin#telegram",
      label: "Telegram Sales Report",
      value: formatPhp(recentSalesTotal),
      description: "Order alerts, receipt approvals, completed sales, and admin order links use the Telegram order bot.",
      icon: TrendingUp,
      toneClass: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    },
    {
      href: "/admin#telegram",
      label: "Telegram Top-Up Bot",
      value: "Approve / Reject",
      description: "Top-up receipts send to Telegram with inline approval buttons after the webhook is registered.",
      icon: Bot,
      toneClass: "border-purple-500/25 bg-purple-500/10 text-purple-300",
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-md sm:p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">App operations center</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-fg">Orders, top-ups, and Telegram reports</h2>
          <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-muted">
            The app keeps a unique customer design, while admin work stays in the same order, wallet, and Telegram control center.
          </p>
        </div>
        <Link href="/admin" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-elevated px-4 text-xs font-black uppercase tracking-wider text-fg transition hover:border-[#1DB954]/40 hover:text-primary">
          Full Dashboard
          <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.label}
              href={card.href}
              className="group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-elevated p-4 transition hover:border-[#1DB954]/30 hover:bg-card"
            >
              <span className="flex items-start justify-between gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${card.toneClass}`}>
                  <Icon size={20} />
                </span>
                <ArrowUpRight size={15} className="text-muted transition group-hover:text-[#1DB954]" />
              </span>
              <span className="mt-4 block">
                <span className="block text-xs font-black uppercase tracking-wider text-muted">{card.label}</span>
                <span className="mt-1 block text-xl font-black text-fg">{card.value}</span>
                <span className="mt-2 block text-xs font-semibold leading-5 text-muted">{card.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
