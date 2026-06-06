"use client";

import { usePathname } from "next/navigation";
import { Chathead } from "@/components/Chathead";
import { LiveOrderTicker } from "@/components/LiveOrderTicker";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";

function isAdminSurface(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-app" || pathname === "/app" || pathname.startsWith("/app/");
}

export function FloatingSiteWidgets() {
  const pathname = usePathname();
  const visibility = useWidgetVisibility();

  if (isAdminSurface(pathname)) {
    return null;
  }

  return (
    <>
      {visibility.chathead && <Chathead />}
      <AnnouncementModal />
      {visibility.liveTicker && <LiveOrderTicker />}
    </>
  );
}
