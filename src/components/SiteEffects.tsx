"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * SiteEffects — one client component powering every public-page micro-interaction
 * via event delegation, so individual cards/buttons stay server-rendered with
 * zero per-element React overhead:
 *
 *  1. Scroll reveal — IntersectionObserver over [data-reveal] elements,
 *     staggered via data-reveal-delay (ms) -> --reveal-delay.
 *  2. Spotlight cards — pointer position -> --mx/--my on .spotlight-card.
 *  3. 3D tilt — pointer position -> --tilt-x/--tilt-y on [data-tilt].
 *  4. Magnetic buttons — pointer pull -> --mag-x/--mag-y on .magnetic.
 *  5. Scroll progress bar — scaleX on .scroll-progress.
 *
 * Hover-driven effects (2-4) only bind on devices with a fine pointer.
 * All motion respects prefers-reduced-motion via globals.css overrides.
 * Skipped entirely on /admin routes.
 */
export function SiteEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    /* ---------- 1. Scroll reveal ---------- */
    let observer: IntersectionObserver | null = null;
    const revealed = new WeakSet<Element>();

    const scanReveals = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)").forEach((el) => {
        if (revealed.has(el)) return;
        const delay = el.dataset.revealDelay;
        if (delay) el.style.setProperty("--reveal-delay", `${delay}ms`);
        observer?.observe(el);
      });
    };

    if (!reducedMotion && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-visible");
            revealed.add(entry.target);
            observer?.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      scanReveals();

      // Safety net: catch [data-reveal] nodes rendered after mount
      // (late-hydrating client components, dynamically shown sections)
      let rescanFrame = 0;
      const mut = new MutationObserver(() => {
        if (rescanFrame) return;
        rescanFrame = requestAnimationFrame(() => {
          rescanFrame = 0;
          scanReveals();
        });
      });
      mut.observe(document.body, { childList: true, subtree: true });
    } else {
      // Reduced motion / old browsers: show everything immediately
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        el.classList.add("is-visible");
        revealed.add(el);
      });
    }

    /* ---------- 2-4. Pointer-driven effects (delegated, fine pointer only) ---------- */
    let frame = 0;
    let lastEvent: PointerEvent | null = null;

    const applyPointer = () => {
      frame = 0;
      const ev = lastEvent;
      if (!ev) return;
      const target = ev.target as HTMLElement | null;
      if (!target || !(target instanceof Element)) return;

      // Spotlight: position the glow under the cursor (walk up to the card)
      const card = target.closest<HTMLElement>(".spotlight-card");
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${ev.clientX - rect.left}px`);
        card.style.setProperty("--my", `${ev.clientY - rect.top}px`);
      }

      // 3D tilt: max ~6deg, eased toward the cursor
      const tilt = target.closest<HTMLElement>("[data-tilt]");
      if (tilt) {
        const rect = tilt.getBoundingClientRect();
        const px = (ev.clientX - rect.left) / rect.width - 0.5;
        const py = (ev.clientY - rect.top) / rect.height - 0.5;
        tilt.style.setProperty("--tilt-y", `${px * 8}deg`);
        tilt.style.setProperty("--tilt-x", `${-py * 6}deg`);
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!finePointer) return;
      lastEvent = ev;

      // Magnetic: pull nearby .magnetic elements toward the cursor
      document.querySelectorAll<HTMLElement>(".magnetic").forEach((btn) => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = ev.clientX - cx;
        const dy = ev.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const radius = Math.max(rect.width, 120);
        if (dist < radius) {
          const pull = 0.22 * (1 - dist / radius);
          btn.style.setProperty("--mag-x", `${dx * pull}px`);
          btn.style.setProperty("--mag-y", `${dy * pull}px`);
        } else {
          btn.style.setProperty("--mag-x", "0px");
          btn.style.setProperty("--mag-y", "0px");
        }
      });

      if (!frame) frame = requestAnimationFrame(applyPointer);
    };

    const onPointerLeave = () => {
      // Reset tilt/magnetics when the cursor leaves the window
      document.querySelectorAll<HTMLElement>("[data-tilt], .magnetic").forEach((el) => {
        el.style.setProperty("--tilt-x", "0deg");
        el.style.setProperty("--tilt-y", "0deg");
        el.style.setProperty("--mag-x", "0px");
        el.style.setProperty("--mag-y", "0px");
      });
    };

    if (finePointer && !reducedMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
    }

    /* ---------- 5. Scroll progress ---------- */
    const progress = document.querySelector<HTMLElement>(".scroll-progress");
    let scrollFrame = 0;
    const updateProgress = () => {
      scrollFrame = 0;
      if (!progress) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      progress.style.setProperty("--scroll-progress", `${ratio}`);
    };
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
    };
    if (progress && !reducedMotion) {
      window.addEventListener("scroll", onScroll, { passive: true });
      updateProgress();
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
    };
  }, [pathname]);

  // Render the progress bar itself so it exists on every public page
  if (pathname?.startsWith("/admin")) return null;
  return <div className="scroll-progress" aria-hidden="true" />;
}
