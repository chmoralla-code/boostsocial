"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { Chathead } from "@/components/Chathead";
import { LiveOrderTicker } from "@/components/LiveOrderTicker";
import { SimpleModeToggle } from "@/components/SimpleModeToggle";
import { useSimpleMode } from "@/hooks/useSimpleMode";

function isAdminSurface(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-app";
}

export function FloatingSiteWidgets() {
  const pathname = usePathname();
  const hideChathead = isAdminSurface(pathname);
  const { simpleMode } = useSimpleMode();

  return (
    <>
      {!hideChathead && (
        <>
          <Script src="https://js.puter.com/v2/" strategy={simpleMode ? "lazyOnload" : "afterInteractive"} />
          <Chathead />
          <div className="fixed right-3 top-[76px] z-[95] sm:right-5 sm:top-24">
            <SimpleModeToggle className="w-auto bg-[#181818]/95 shadow-lg shadow-black/20" />
          </div>
        </>
      )}
      {!simpleMode && <LiveOrderTicker />}
    </>
  );
}
