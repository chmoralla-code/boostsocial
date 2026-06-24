"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const creepInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWidth = useRef(0);

  useEffect(() => {
    if (activeWidth.current > 0) {
      setWidth(100);
      activeWidth.current = 100;
      if (creepInterval.current) {
        clearInterval(creepInterval.current);
        creepInterval.current = null;
      }
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
        activeWidth.current = 0;
      }, 250);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return;
      }

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (creepInterval.current) {
        clearInterval(creepInterval.current);
        creepInterval.current = null;
      }
      setVisible(true);
      setWidth(18);
      activeWidth.current = 18;
      creepInterval.current = setInterval(() => {
        setWidth((prev) => {
          if (prev >= 85) return prev;
          const next = prev + Math.random() * 7;
          activeWidth.current = next;
          return next;
        });
      }, 140);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (creepInterval.current) clearInterval(creepInterval.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-[3px] pointer-events-none" role="progressbar" aria-label="Loading">
      <div
        className="h-full bg-[#1DB954] transition-all duration-300 ease-out shadow-[0_0_10px_rgba(29,185,84,0.7)]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
