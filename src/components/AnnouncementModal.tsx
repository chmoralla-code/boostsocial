"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, X } from "lucide-react";

type PublicAnnouncement = {
  enabled: boolean;
  title?: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  version?: string;
};

function isAdminSurface(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-app";
}

export function AnnouncementModal() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState<PublicAnnouncement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (isAdminSurface(pathname)) {
      return;
    }

    async function loadAnnouncement() {
      try {
        const res = await fetch("/api/announcement", { cache: "no-store" });
        const data = (await res.json()) as PublicAnnouncement;
        const version = data.version || "default";
        const storageKey = `pinoyboosting:announcement-seen:${version}`;

        if (
          !cancelled &&
          data.enabled &&
          data.message &&
          typeof window !== "undefined" &&
          localStorage.getItem(storageKey) !== "true"
        ) {
          setAnnouncement(data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Failed to load announcement:", err);
      }
    }

    loadAnnouncement();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const dismiss = () => {
    if (announcement?.version && typeof window !== "undefined") {
      localStorage.setItem(`pinoyboosting:announcement-seen:${announcement.version}`, "true");
    }
    setIsOpen(false);
  };

  if (isAdminSurface(pathname) || !isOpen || !announcement?.message) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-announcement-title"
        className="relative w-full max-w-md rounded-2xl border border-[#1DB954]/25 bg-[#121212] p-5 text-center text-white shadow-2xl shadow-black/50 sm:p-6"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close announcement"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-black/30 text-slate-400 transition hover:border-slate-600 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954]">
          <Megaphone size={22} />
        </div>

        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#1DB954]">
          Announcement
        </p>
        <h2 id="client-announcement-title" className="pr-8 text-xl font-black tracking-tight sm:text-2xl">
          {announcement.title || "Important Announcement"}
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-relaxed text-slate-300">
          {announcement.message}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {announcement.actionLabel && announcement.actionHref ? (
            <Link
              href={announcement.actionHref}
              onClick={dismiss}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1DB954] px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760]"
            >
              {announcement.actionLabel}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-700 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-slate-500 hover:bg-white/5"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
