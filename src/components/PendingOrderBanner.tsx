"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Copy, MessageCircle, SearchCheck, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type PendingOrder = {
  id: string;
  amount: number | string | null;
  quantity: number | null;
  status: string | null;
  target_url?: string | null;
  services?: { title?: string | null } | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACK_REGEX = /^BS-([0-9a-f]{8})$/i;

function getDisplayId(orderId: string) {
  return `BS-${orderId.slice(0, 8).toUpperCase()}`;
}

function getStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  if (normalized === "processing") return "border-blue-400/25 bg-blue-400/10 text-blue-300";
  if (normalized === "cancelled") return "border-red-400/25 bg-red-400/10 text-red-300";
  return "border-orange-400/25 bg-orange-400/10 text-orange-300";
}

export function PendingOrderBanner() {
  const supabase = useMemo(() => createClient(), []);
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [trackingId, setTrackingId] = useState("");
  const [isDismissed, setIsDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusToast, setStatusToast] = useState<{ id: string; status: string; visible: boolean } | null>(null);

  // Web Audio API synthesized chimes for campaign status updates
  const playChime = (statusStr: string) => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (statusStr === "Completed") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
        gain2.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.15);
        gain2.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.5);
      } else if (statusStr === "Cancelled") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220.00, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(146.83, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440.00, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.03);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio Context failed:", e);
    }
  };

  const triggerBrowserNotification = (idStr: string, statusStr: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const trackingLabel = `BS-${idStr.slice(0, 8).toUpperCase()}`;
    const title = `⚡ Boost Status: ${statusStr}!`;
    const body = `Your campaign order ${trackingLabel} is now marked as ${statusStr}.`;

    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon.svg" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, { body, icon: "/icon.svg" });
        }
      });
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadOrder = async () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const requestedId =
        params.get("track") ||
        params.get("id") ||
        params.get("orderId") ||
        window.localStorage.getItem("last_order_id") ||
        "";
      const cleanId = requestedId.trim();

      if (!cleanId) return;

      try {
        let query = supabase.from("orders").select("*, services(title)");

        if (UUID_REGEX.test(cleanId)) {
          query = query.eq("id", cleanId);
        } else {
          const trackMatch = cleanId.match(TRACK_REGEX);
          const shortHex = trackMatch?.[1] || (/^[0-9a-f]{8}$/i.test(cleanId) ? cleanId : "");
          if (!shortHex) return;

          const lowerHex = shortHex.toLowerCase();
          query = query
            .gte("id", `${lowerHex}-0000-0000-0000-000000000000`)
            .lte("id", `${lowerHex}-ffff-ffff-ffff-ffffffffffff`);
        }

        const { data, error } = await query.single();
        if (!isMounted || error || !data) return;

        const displayId = getDisplayId(data.id);
        setOrder(data);
        setTrackingId(displayId);

        window.localStorage.setItem("last_order_id", data.id);
      } catch (err) {
        console.error("Failed to load pending order banner:", err);
      }
    };

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Subscribe to real-time status updates for the homepage banner order
  useEffect(() => {
    if (!order?.id) return;

    // Request desktop notification permission proactively
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const channel = supabase
      .channel(`order-banner-status-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          console.log("Real-time order banner update received:", payload.new);
          
          const newStatus = payload.new.status || "Pending";
          const prevStatus = order.status || "Pending";

          if (newStatus !== prevStatus) {
            playChime(newStatus);
            triggerBrowserNotification(order.id, newStatus);
            setStatusToast({ id: order.id, status: newStatus, visible: true });
            
            // Dismiss toast automatically after 6 seconds
            setTimeout(() => {
              setStatusToast(prev => prev && prev.id === order.id ? { ...prev, visible: false } : prev);
            }, 6000);
          }

          setOrder((prevOrder: any) => {
            if (!prevOrder) return null;
            return {
              ...prevOrder,
              ...payload.new,
              services: prevOrder.services // retain joined services relation metadata
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id, order?.status, supabase]);

  if (!order || isDismissed) return null;

  const status = order.status || "Pending";
  const serviceTitle = order.services?.title || "Boost campaign";

  const openChatbot = () => {
    window.dispatchEvent(new CustomEvent("open-support-chat", { detail: { message: trackingId } }));
  };

  const copyTrackingId = async () => {
    await navigator.clipboard.writeText(trackingId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      {/* Real-time Order Status Float Toast */}
      {statusToast && statusToast.visible && (
        <div className="fixed top-24 right-6 z-[99999] max-w-sm w-full bg-[#161616]/92 border border-slate-800/90 p-5 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in slide-in-from-right-5 duration-300 flex items-start gap-4 select-none">
          <div className={`p-2.5 rounded-xl flex-shrink-0 flex items-center justify-center border text-base ${
            statusToast.status === 'Pending' ? 'bg-[#ff9800]/10 border-[#ff9800]/25 text-[#ff9800]' :
            statusToast.status === 'Processing' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' :
            statusToast.status === 'Completed' ? 'bg-[#1DB954]/10 border-[#1DB954]/25 text-[#1DB954]' :
            'bg-red-500/10 border-red-500/25 text-red-400'
          }`}>
            {statusToast.status === 'Pending' ? '⏳' :
             statusToast.status === 'Processing' ? '⚡' :
             statusToast.status === 'Completed' ? '🎉' : '❌'}
          </div>
          <div className="space-y-1 text-left flex-grow">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954] block">Campaign Status Update</span>
            <h4 className="text-xs font-black text-white">Order {statusToast.status}!</h4>
            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
              Your boost order <strong className="font-mono text-[#1DB954]">BS-{statusToast.id.slice(0, 8).toUpperCase()}</strong> is now marked as <strong className="text-white">{statusToast.status}</strong>.
            </p>
          </div>
          <button 
            onClick={() => setStatusToast(prev => prev ? { ...prev, visible: false } : null)}
            className="text-slate-500 hover:text-white transition-colors text-xs font-bold font-sans cursor-pointer p-1 hover:bg-[#282828] rounded-md"
          >
            ✕
          </button>
        </div>
      )}

      <section className="relative z-10 w-full max-w-7xl px-4 sm:px-6 md:px-8 -mt-4 mb-10">
      <div className="overflow-hidden rounded-2xl border border-[#1DB954]/20 bg-[#101010]/92 shadow-2xl shadow-emerald-500/5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-3 text-left">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954]">
              <Clock3 size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
                  Pending order loaded
                </p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${getStatusClass(status)}`}>
                  {status}
                </span>
              </div>
              <h2 className="mt-1 text-base font-black tracking-tight text-white sm:text-lg">
                {trackingId} is ready to track
              </h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">
                {serviceTitle} | Qty {Number(order.quantity || 0).toLocaleString()} | PHP {Number(order.amount || 0).toFixed(2)}.
                Track this anytime in the Support Chatbot or the Status Tracker button above.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyTrackingId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-[#181818] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-200 transition-colors hover:border-slate-500"
            >
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy ID"}
            </button>
            <button
              type="button"
              onClick={openChatbot}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-blue-300 transition-colors hover:bg-blue-500/15"
            >
              <MessageCircle size={14} />
              Chatbot
            </button>
            <Link
              href={`/track?id=${trackingId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1DB954] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-black transition-colors hover:bg-[#1ed760]"
            >
              <SearchCheck size={14} />
              Status Tracker
            </Link>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/60 bg-[#181818] text-slate-400 transition-colors hover:text-white"
              aria-label="Hide pending order panel"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
