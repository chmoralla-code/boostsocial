"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { Chathead } from "@/components/Chathead";
import { LiveOrderTicker } from "@/components/LiveOrderTicker";
import { AnnouncementModal } from "@/components/AnnouncementModal";

function isAdminSurface(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-app";
}

export function FloatingSiteWidgets() {
  const pathname = usePathname();
  const hideChathead = isAdminSurface(pathname);

  return (
    <>
      {!hideChathead && (
        <>
          <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
          <Chathead />
        </>
      )}
      <AnnouncementModal />
      <LiveOrderTicker />
    </>
  );
}
