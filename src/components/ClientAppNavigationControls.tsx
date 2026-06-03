"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

function isHiddenSurface(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-app" || pathname === "/app";
}

function detectClientApp() {
  const userAgent = window.navigator.userAgent;
  const capacitor = (window as CapacitorWindow).Capacitor;

  return userAgent.includes("PinoyBoostingClientApp") || Boolean(capacitor?.isNativePlatform?.());
}

export function ClientAppNavigationControls() {
  const pathname = usePathname();
  const [isClientApp, setIsClientApp] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsClientApp(detectClientApp());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  if (!isClientApp || isHiddenSurface(pathname)) {
    return null;
  }

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/app");
  };

  return (
    <div className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-950/90 p-1 shadow-2xl shadow-black/35 backdrop-blur-md">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition active:bg-white/10"
        aria-label="Go back"
        title="Back"
      >
        <ArrowLeft size={17} />
      </button>
      <button
        type="button"
        onClick={() => window.location.assign("/app")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-emerald-300 transition active:bg-white/10"
        aria-label="Go home"
        title="Home"
      >
        <Home size={17} />
      </button>
    </div>
  );
}
