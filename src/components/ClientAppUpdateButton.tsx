"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

function isHiddenSurface(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-app" || pathname.startsWith("/app/");
}

export async function refreshClientAppContent() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName).catch(() => false)));
  }
}

export function ClientAppUpdateButton() {
  const pathname = usePathname();
  const [isClientApp, setIsClientApp] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const userAgent = window.navigator.userAgent;
      const capacitor = (window as CapacitorWindow).Capacitor;

      setIsClientApp(
        userAgent.includes("PinoyBoostingClientApp") ||
        Boolean(capacitor?.isNativePlatform?.())
      );
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  if (!isClientApp || isHiddenSurface(pathname) || pathname === "/app") {
    return null;
  }

  const handleUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      await refreshClientAppContent();
    } finally {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("app_update", String(Date.now()));
      window.location.replace(nextUrl.toString());
    }
  };

  return (
    <button
      type="button"
      onClick={handleUpdate}
      disabled={isUpdating}
      className="fixed left-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[70] inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111]/90 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white shadow-2xl shadow-black/40 backdrop-blur-md transition hover:border-[#1DB954]/40 hover:bg-[#151515] disabled:cursor-wait disabled:opacity-80 sm:left-5"
      aria-label="Update app content"
    >
      {isUpdating ? (
        <RefreshCw size={15} className="animate-spin text-[#1DB954]" />
      ) : (
        <Check size={15} className="text-[#1DB954]" />
      )}
      {isUpdating ? "Updating" : "Update App"}
    </button>
  );
}
