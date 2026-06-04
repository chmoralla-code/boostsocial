"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Home, LogIn, RefreshCw, Search, UserPlus } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type AppOrder = {
  id: string;
  created_at?: string | null;
  quantity?: number | null;
  amount?: number | string | null;
  status?: string | null;
  target_url?: string | null;
  services?: { title?: string | null } | null;
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

function statusClass(status?: string | null) {
  const value = (status || "Pending").toLowerCase();
  if (value.includes("complete")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (value.includes("cancel") || value.includes("reject")) return "bg-red-50 text-red-700 border-red-100";
  if (value.includes("process")) return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-amber-50 text-amber-700 border-amber-100";
}

export default function AppOrdersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async (currentUser: User | null) => {
    if (!currentUser?.email) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setRefreshing(true);
    const { data } = await supabase
      .from("orders")
      .select("id,created_at,quantity,amount,status,target_url,services(title)")
      .eq("customer_email", currentUser.email)
      .order("created_at", { ascending: false })
      .limit(40);

    setOrders(Array.isArray(data) ? (data as unknown as AppOrder[]) : []);
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
      void loadOrders(sessionUser).finally(() => window.clearTimeout(fallback));
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
  }, [loadOrders, supabase.auth]);

  const filteredOrders = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return orders;

    return orders.filter((order) => {
      const haystack = [
        order.id,
        trackingId(order.id),
        order.status,
        order.services?.title,
        order.target_url,
      ].join(" ").toLowerCase();
      return haystack.includes(cleanQuery);
    });
  }, [orders, query]);

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
          <p className="truncate text-base font-black">App Orders</p>
          <p className="truncate text-xs font-semibold text-zinc-500">Track purchases saved to your account</p>
        </div>
        <button type="button" onClick={() => void loadOrders(user)} disabled={!user || refreshing} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm disabled:opacity-50" aria-label="Refresh orders">
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
            Orders are private to your app account. Login or register first, then return here.
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
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm">
            <Search size={18} className="text-zinc-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Tracking ID or status" className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400" />
          </label>

          {loading ? (
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="mt-5 space-y-3">
              {filteredOrders.map((order) => (
                <article key={order.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{order.services?.title || "PinoyBoosting Service"}</p>
                      <p className="mt-1 text-xs font-bold text-zinc-500">{trackingId(order.id)} - {shortDate(order.created_at)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(order.status)}`}>
                      {order.status || "Pending"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-zinc-600">
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      Quantity
                      <span className="mt-1 block text-sm font-black text-zinc-950">{order.quantity || 0}</span>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      Amount
                      <span className="mt-1 block text-sm font-black text-zinc-950">{money(order.amount)}</span>
                    </div>
                  </div>
                  <Link href={`/track?order=${encodeURIComponent(trackingId(order.id))}`} className="mt-3 flex h-11 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-black text-white">
                    Full tracking details
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-zinc-300 bg-white p-6 text-center">
              <p className="text-sm font-black">No app orders found</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">Buy from SERVICES after logging in and your orders will appear here.</p>
              <Link href="/app" className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white">
                Open services
              </Link>
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
    </main>
  );
}
