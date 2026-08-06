"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Copy, Home, Loader2, LogIn, RefreshCw, RotateCcw, Search, UserPlus, Wallet, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { formatSmmServiceName } from "@/utils/serviceHelpers";

type AppOrder = {
  id: string;
  created_at?: string | null;
  quantity?: number | null;
  amount?: number | string | null;
  status?: string | null;
  target_url?: string | null;
  smm_service_id?: string | number | null;
  services?: { title?: string | null } | null;
};

type TopupEntry = {
  id: string;
  created_at?: string | null;
  amount?: number | string | null;
  status?: string | null;
  payment_method?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

type TransactionEntry = {
  kind: "order" | "topup";
  id: string;
  created_at?: string | null;
  amount?: number | string | null;
  status?: string | null;
  order?: AppOrder;
  topup?: TopupEntry;
};

type SmmCatalogService = {
  id: string;
  name: string;
  category?: string;
  desc?: string;
};

type OrderEventRow = {
  id: string;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  detail?: string | null;
  created_at?: string | null;
};

const ORDER_EVENT_LABELS: Record<string, string> = {
  created: "Order registered",
  payment_pending: "Waiting for payment",
  payment_received: "Payment received",
  processing: "Processing started",
  provider_queued: "Queued for provider",
  provider_submitted: "Sent to provider",
  provider_completed: "Provider delivered",
  completed: "Order completed",
  cancelled: "Order cancelled",
  rejected: "Order rejected",
  refill_requested: "Refill requested",
};

function trackingId(id: string) {
  return `BS-${id.slice(0, 8).toUpperCase()}`;
}

function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `PHP ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function shortDate(value?: string | null) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function fullDate(value?: string | null) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusClass(status?: string | null) {
  const value = (status || "Pending").toLowerCase();
  if (value.includes("complete") || value.includes("approved")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (value.includes("cancel") || value.includes("reject")) return "bg-red-50 text-red-700 border-red-100";
  if (value.includes("process")) return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-amber-50 text-amber-700 border-amber-100";
}

function isGenericServiceTitle(title?: string | null) {
  return /^(all services|smm catalog explorer|smm service|boost campaign)$/i.test(String(title || "").trim());
}

function orderServiceTitle(order: AppOrder, smmServiceNames: Record<string, string>) {
  const joinedTitle = order.services?.title?.trim() || "";
  const smmServiceId = order.smm_service_id === undefined || order.smm_service_id === null
    ? ""
    : String(order.smm_service_id).trim();
  const resolvedSmmTitle = smmServiceId ? smmServiceNames[smmServiceId] : "";

  if (resolvedSmmTitle && (!joinedTitle || isGenericServiceTitle(joinedTitle))) {
    return resolvedSmmTitle;
  }

  if (joinedTitle && !isGenericServiceTitle(joinedTitle)) return joinedTitle;
  if (smmServiceId) return `SMM Service ID ${smmServiceId}`;
  return "PinoyBoosting Service";
}

export default function AppOrdersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [topups, setTopups] = useState<TopupEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionEntry | null>(null);
  const [orderEvents, setOrderEvents] = useState<OrderEventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [refillState, setRefillState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [refillMessage, setRefillMessage] = useState("");
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [smmServiceNames, setSmmServiceNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"all" | "orders" | "topups">("all");

  const loadData = useCallback(async (currentUser: User | null) => {
    if (!currentUser?.email) {
      setOrders([]);
      setTopups([]);
      setLoading(false);
      return;
    }

    setRefreshing(true);

    const [ordersRes, topupsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id,created_at,quantity,amount,status,target_url,smm_service_id,services(title)")
        .eq("customer_email", currentUser.email)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("topups")
        .select("id,created_at,amount,status,payment_method,reviewed_at,reviewed_by")
        .eq("email", currentUser.email)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    setOrders(Array.isArray(ordersRes.data) ? (ordersRes.data as unknown as AppOrder[]) : []);
    setTopups(Array.isArray(topupsRes.data) ? (topupsRes.data as unknown as TopupEntry[]) : []);
    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    const fallback = window.setTimeout(() => {
      if (!alive) return;
      setLoading(false);
      setRefreshing(false);
    }, 4500);

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const sessionUser = data.session?.user || null;
      setUser(sessionUser);
      void loadData(sessionUser).finally(() => window.clearTimeout(fallback));
    }).catch(() => {
      if (!alive) return;
      window.clearTimeout(fallback);
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      alive = false;
      window.clearTimeout(fallback);
    };
  }, [loadData, supabase.auth]);

  useEffect(() => {
    let alive = true;

    fetch("/api/smm/services", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (!alive || !Array.isArray(data)) return;
        const nextMap: Record<string, string> = {};
        for (const service of data as SmmCatalogService[]) {
          if (!service.id || !service.name) continue;
          nextMap[String(service.id)] = formatSmmServiceName(
            service.name,
            service.id,
            service.desc || service.category || ""
          );
        }
        setSmmServiceNames(nextMap);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const mergedTransactions = useMemo<TransactionEntry[]>(() => {
    const orderEntries: TransactionEntry[] = orders.map((order) => ({
      kind: "order" as const,
      id: order.id,
      created_at: order.created_at,
      amount: order.amount,
      status: order.status,
      order,
    }));

    const topupEntries: TransactionEntry[] = topups.map((topup) => ({
      kind: "topup" as const,
      id: topup.id,
      created_at: topup.created_at,
      amount: topup.amount,
      status: topup.status,
      topup,
    }));

    const combined = [...orderEntries, ...topupEntries];
    combined.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
    return combined;
  }, [orders, topups]);

  const tabTransactions = useMemo(() => {
    if (activeTab === "orders") return mergedTransactions.filter((t) => t.kind === "order");
    if (activeTab === "topups") return mergedTransactions.filter((t) => t.kind === "topup");
    return mergedTransactions;
  }, [mergedTransactions, activeTab]);

  const filteredTransactions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return tabTransactions;

    return tabTransactions.filter((entry) => {
      const haystackParts = [
        entry.id,
        trackingId(entry.id),
        String(entry.status ?? ""),
        entry.kind,
      ];

      if (entry.order) {
        const displayTitle = orderServiceTitle(entry.order, smmServiceNames);
        haystackParts.push(displayTitle, String(entry.order.smm_service_id ?? ""), entry.order.target_url ?? "");
      }

      if (entry.topup) {
        haystackParts.push("topup", "gcash", "wallet topup", "add funds", entry.topup.payment_method ?? "");
      }

      const haystack = haystackParts.join(" ").toLowerCase();
      return haystack.includes(cleanQuery);
    });
  }, [tabTransactions, query, smmServiceNames]);

  const copySelectedTracking = async () => {
    if (!selectedTransaction) return;
    await navigator.clipboard.writeText(trackingId(selectedTransaction.id));
    setCopiedTracking(true);
    window.setTimeout(() => setCopiedTracking(false), 1600);
  };

  const openDetails = async (entry: TransactionEntry) => {
    setCopiedTracking(false);
    setRefillState("idle");
    setRefillMessage("");
    setSelectedTransaction(entry);

    // Load the order timeline (order events) for order entries.
    if (entry.kind === "order") {
      setEventsLoading(true);
      setOrderEvents([]);
      try {
        const { data } = await supabase
          .from("order_events")
          .select("id,event_type,from_status,to_status,detail,created_at")
          .eq("order_id", entry.id)
          .order("created_at", { ascending: false })
          .limit(30);
        setOrderEvents(Array.isArray(data) ? (data as unknown as OrderEventRow[]) : []);
      } catch {
        setOrderEvents([]);
      } finally {
        setEventsLoading(false);
      }
    } else {
      setOrderEvents([]);
    }
  };

  const requestRefill = async () => {
    if (!selectedTransaction?.order || refillState === "submitting") return;
    setRefillState("submitting");
    setRefillMessage("");
    try {
      const res = await fetch("/api/orders/refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedTransaction.order.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refill failed");
      setRefillState("done");
      setRefillMessage(`Refill placed — new tracking ID ${data.trackingId || ""}`);
      await loadData(user);
    } catch (e) {
      setRefillState("error");
      setRefillMessage(e instanceof Error ? e.message : "Refill failed. Try again.");
    }
  };

  const orderCount = orders.length;
  const topupCount = topups.length;

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] text-zinc-950">
      <header className="mx-auto flex max-w-3xl items-center gap-2">
        <button type="button" onClick={() => router.back()} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm" aria-label="Go back">
          <ArrowLeft size={17} />
        </button>
        <Link href="/app" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-emerald-700 shadow-sm" aria-label="App home">
          <Home size={17} />
        </Link>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-base font-black">Orders &amp; Top-ups</p>
          <p className="truncate text-xs font-semibold text-zinc-500">Track purchases and wallet top-ups</p>
        </div>
        <button type="button" onClick={() => void loadData(user)} disabled={!user || refreshing} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm disabled:opacity-50" aria-label="Refresh">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {!user && !loading ? (
        <section className="mx-auto mt-6 max-w-md rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <ClipboardList size={22} />
          </span>
          <h1 className="mt-4 text-2xl font-black">Login to view orders</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
            Orders and top-ups are private to your app account. Login or register first, then return here.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href="/app/auth?mode=login&return=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white">
              <LogIn size={16} />
              Login
            </Link>
            <Link href="/app/auth?mode=register&return=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 text-sm font-black text-zinc-800">
              <UserPlus size={16} />
              Register
            </Link>
          </div>
        </section>
      ) : (
        <section className="mx-auto mt-5 max-w-3xl">
          {/* Search bar */}
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm">
            <Search size={18} className="text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by tracking ID, status, service, or payment method"
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="rounded-full p-1 text-zinc-400 hover:text-zinc-600">
                <X size={16} />
              </button>
            )}
          </label>

          {/* Tab toggles */}
          <div className="mt-4 flex gap-1 rounded-2xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-colors ${
                activeTab === "all" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"
              }`}
            >
              All ({mergedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-colors ${
                activeTab === "orders" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"
              }`}
            >
              Orders ({orderCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("topups")}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-colors ${
                activeTab === "topups" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"
              }`}
            >
              Top-ups ({topupCount})
            </button>
          </div>

          {loading ? (
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
              ))}
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="mt-5 space-y-3">
              {filteredTransactions.map((entry) => (
                <article key={`${entry.kind}-${entry.id}`} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {entry.kind === "topup" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                              <Wallet size={13} />
                            </span>
                            <p className="truncate text-sm font-black">Wallet Top-up</p>
                          </div>
                          <p className="mt-1 text-xs font-bold text-zinc-500">
                            {trackingId(entry.id)} &middot; {entry.topup?.payment_method || "GCash"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="truncate text-sm font-black">
                            {entry.order ? orderServiceTitle(entry.order, smmServiceNames) : "Order"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-zinc-500">
                            {trackingId(entry.id)} &middot; {shortDate(entry.created_at)}
                          </p>
                        </>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(entry.status)}`}>
                      {entry.status || "Pending"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-zinc-600">
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      {entry.kind === "topup" ? "Amount" : "Quantity"}
                      <span className="mt-1 block text-sm font-black text-zinc-950">
                        {entry.kind === "topup" ? money(entry.amount) : (entry.order?.quantity || 0)}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      {entry.kind === "topup" ? "Date" : "Amount"}
                      <span className="mt-1 block text-sm font-black text-zinc-950">
                        {entry.kind === "topup" ? shortDate(entry.created_at) : money(entry.amount)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void openDetails(entry); }}
                    className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-950 text-sm font-black text-white"
                  >
                    View details
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-zinc-300 bg-white p-6 text-center">
              <p className="text-sm font-black">
                {query ? "No results match your search" : activeTab === "topups" ? "No top-ups yet" : activeTab === "orders" ? "No orders yet" : "No transactions yet"}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">
                {query
                  ? "Try a different search term or clear the filter."
                  : activeTab === "topups"
                    ? "Add funds to your wallet from the Profile tab."
                    : "Buy from Services after logging in and your orders will appear here."}
              </p>
              {!query && (
                <Link href="/app" className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white">
                  Open services
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-1">
          <Link href="/app" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <Home size={18} />
            Services
          </Link>
          <Link href="/app/orders" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-emerald-700">
            <ClipboardList size={18} />
            Orders
          </Link>
          <Link href="/app/profile" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <UserPlus size={18} />
            Profile
          </Link>
        </div>
      </nav>

      {/* Detail modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] backdrop-blur-sm sm:items-center sm:justify-center">
          <button type="button" className="absolute inset-0" aria-label="Close details" onClick={() => setSelectedTransaction(null)} />
          <section className="relative mx-auto max-h-[86vh] w-full max-w-md overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white text-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${selectedTransaction.kind === "topup" ? "bg-violet-600" : "bg-emerald-600"}`}>
                  {selectedTransaction.kind === "topup" ? <Wallet size={21} /> : <ClipboardList size={21} />}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black">
                    {selectedTransaction.kind === "topup" ? "Top-up Details" : "Order Details"}
                  </h2>
                  <p className="truncate text-xs font-semibold text-zinc-500">{trackingId(selectedTransaction.id)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedTransaction(null)} className="rounded-full p-2 text-zinc-500" aria-label="Close details">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[72vh] space-y-4 overflow-y-auto p-4">
              {/* Order details */}
              {selectedTransaction.kind === "order" && selectedTransaction.order && (
                <>
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Service</p>
                        <h3 className="mt-1 line-clamp-2 text-base font-black">{orderServiceTitle(selectedTransaction.order, smmServiceNames)}</h3>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(selectedTransaction.status)}`}>
                        {selectedTransaction.status || "Pending"}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-black">{trackingId(selectedTransaction.id)}</span>
                      <button type="button" onClick={copySelectedTracking} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700">
                        <Copy size={13} />
                        {copiedTracking ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-zinc-600">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Quantity
                      <span className="mt-1 block text-sm font-black text-zinc-950">{selectedTransaction.order.quantity || 0}</span>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Amount
                      <span className="mt-1 block text-sm font-black text-zinc-950">{money(selectedTransaction.amount)}</span>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Ordered
                      <span className="mt-1 block text-sm font-black text-zinc-950">{shortDate(selectedTransaction.created_at)}</span>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Status
                      <span className="mt-1 block text-sm font-black text-zinc-950">{selectedTransaction.status || "Pending"}</span>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Target / Details</p>
                    <p className="mt-2 break-words text-sm font-semibold leading-6 text-zinc-700">
                      {selectedTransaction.order.target_url || "No target details were attached."}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Order Timeline</p>
                    {eventsLoading ? (
                      <p className="mt-3 text-xs font-semibold text-zinc-500">Loading timeline...</p>
                    ) : orderEvents.length === 0 ? (
                      <p className="mt-3 text-xs font-semibold leading-5 text-zinc-500">
                        No timeline events yet. Current status: {selectedTransaction.status || "Pending"}.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-0">
                        {[...orderEvents].reverse().map((event, index) => (
                          <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                            {index < orderEvents.length - 1 && (
                              <span className="absolute left-[7px] top-5 h-[calc(100%-1.25rem)] w-0.5 bg-zinc-200" />
                            )}
                            <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${index === 0 ? "border-emerald-500 bg-emerald-500" : "border-zinc-300 bg-white"}`} />
                            <div className="min-w-0">
                              <p className="text-xs font-black text-zinc-900">
                                {ORDER_EVENT_LABELS[event.event_type] || event.event_type}
                              </p>
                              {event.detail && (
                                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-zinc-500">{event.detail}</p>
                              )}
                              <p className="mt-0.5 text-[10px] font-bold text-zinc-400">{fullDate(event.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedTransaction.status === "Completed" && (
                    <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Need more of this boost?</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
                        Refill re-orders the same service, target link, and quantity — billed to your wallet at today&apos;s price.
                      </p>
                      {refillMessage && (
                        <p className={`mt-2 text-xs font-bold ${refillState === "error" ? "text-red-600" : "text-emerald-700"}`}>{refillMessage}</p>
                      )}
                      <button
                        type="button"
                        onClick={requestRefill}
                        disabled={refillState === "submitting" || refillState === "done"}
                        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-60 disabled:shadow-none"
                      >
                        {refillState === "submitting" ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                        {refillState === "submitting" ? "Placing refill..." : refillState === "done" ? "Refill placed" : "Refill this order"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Topup details */}
              {selectedTransaction.kind === "topup" && selectedTransaction.topup && (
                <>
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Wallet Top-up</p>
                        <h3 className="mt-1 text-base font-black">{money(selectedTransaction.topup.amount)}</h3>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(selectedTransaction.status)}`}>
                        {selectedTransaction.status || "Pending"}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-black">{trackingId(selectedTransaction.id)}</span>
                      <button type="button" onClick={copySelectedTracking} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-3 py-2 text-[11px] font-black text-violet-700">
                        <Copy size={13} />
                        {copiedTracking ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-zinc-600">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Amount
                      <span className="mt-1 block text-sm font-black text-zinc-950">{money(selectedTransaction.topup.amount)}</span>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Payment Method
                      <span className="mt-1 block text-sm font-black text-zinc-950">{selectedTransaction.topup.payment_method || "GCash"}</span>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Submitted
                      <span className="mt-1 block text-sm font-black text-zinc-950">{fullDate(selectedTransaction.topup.created_at)}</span>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      Status
                      <span className="mt-1 block text-sm font-black text-zinc-950">{selectedTransaction.status || "Pending"}</span>
                    </div>
                  </div>

                  {selectedTransaction.topup.reviewed_at && (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-xs font-bold text-zinc-600">
                      Reviewed
                      <span className="mt-1 block text-sm font-black text-zinc-950">
                        {fullDate(selectedTransaction.topup.reviewed_at)}
                        {selectedTransaction.topup.reviewed_by ? ` by ${selectedTransaction.topup.reviewed_by}` : ""}
                      </span>
                    </div>
                  )}

                  <div className="rounded-3xl border border-violet-100 bg-violet-50 p-4">
                    <p className="text-sm font-black text-violet-900">Top-up Tracking</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-violet-800">
                      {selectedTransaction.status === "approved"
                        ? "Your top-up has been approved and the funds have been added to your wallet balance."
                        : selectedTransaction.status === "pending"
                          ? "Your top-up is pending review. Admin will verify your payment receipt and approve it shortly."
                          : selectedTransaction.status === "rejected"
                            ? "Your top-up was rejected. Please check your receipt and try again, or contact support."
                            : "Track the status of your wallet top-up here. Approved funds appear in your wallet balance."}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
