"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, TrendingUp, Users } from "lucide-react";

interface CounterProp {
  target: number;
  suffix?: string;
  decimals?: number;
  duration?: number; // ms
}

function AnimateNumber({ target, suffix = "", decimals = 0, duration = 1200 }: CounterProp) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Ease-out so the counter decelerates into its final value
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, target, duration]);

  return (
    <span ref={containerRef} className="font-mono">
      {count.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export function StatCounters() {
  const stats = [
    { icon: CheckCircle2, target: 15420, suffix: "+", decimals: 0, label: "Orders Completed" },
    { icon: TrendingUp, target: 8.9, suffix: "M+", decimals: 1, label: "Boosts Delivered" },
    { icon: Users, target: 99.8, suffix: "%", decimals: 1, label: "Satisfaction Rate" },
  ];

  return (
    <section className="w-full max-w-4xl mx-auto px-4 mt-4 mb-14 sm:mb-20 relative z-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            data-reveal
            data-reveal-delay={i * 100}
            className="robot-hud spotlight-card flex items-center gap-4 sm:flex-col sm:justify-center sm:text-center p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm light-mode:bg-slate-100/50 light-mode:border-slate-200/50"
          >
            <div className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-primary shrink-0 light-mode:bg-slate-200/60 light-mode:border-slate-300/40">
              <stat.icon size={22} />
            </div>
            <div className="text-left sm:text-center space-y-0.5">
              <div className="text-2xl sm:text-3xl font-black text-fg tracking-tight">
                <AnimateNumber target={stat.target} suffix={stat.suffix} decimals={stat.decimals} />
              </div>
              <p className="mono-label text-[10px] text-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
