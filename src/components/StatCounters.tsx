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
      
      const current = progress * target;
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
  return (
    <section className="w-full max-w-5xl mx-auto px-4 mt-6 mb-16 relative z-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-card/40 border border-border/80 rounded-2xl p-6 text-center hover:bg-elevated/30 transition-all duration-300 group flex items-center gap-5 sm:flex-col sm:justify-center">
          <div className="p-4 rounded-full bg-[#1877F2]/10 text-[#1877F2] shadow-md group-hover:scale-105 transition-transform duration-300">
            <CheckCircle2 size={24} />
          </div>
          <div className="text-left sm:text-center space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-fg font-mono tracking-tight">
              <AnimateNumber target={15420} suffix="+" />
            </div>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Orders Completed</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-card/40 border border-border/80 rounded-2xl p-6 text-center hover:bg-elevated/30 transition-all duration-300 group flex items-center gap-5 sm:flex-col sm:justify-center">
          <div className="p-4 rounded-full bg-[#1877F2]/10 text-[#1877F2] shadow-md group-hover:scale-105 transition-transform duration-300">
            <TrendingUp size={24} />
          </div>
          <div className="text-left sm:text-center space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-fg font-mono tracking-tight">
              <AnimateNumber target={8.9} suffix="M+" decimals={1} />
            </div>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Boosts Delivered</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-card/40 border border-border/80 rounded-2xl p-6 text-center hover:bg-elevated/30 transition-all duration-300 group flex items-center gap-5 sm:flex-col sm:justify-center">
          <div className="p-4 rounded-full bg-[#1877F2]/10 text-[#1877F2] shadow-md group-hover:scale-105 transition-transform duration-300">
            <Users size={24} />
          </div>
          <div className="text-left sm:text-center space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-fg font-mono tracking-tight">
              <AnimateNumber target={99.8} suffix="%" decimals={1} />
            </div>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Satisfaction Rate</p>
          </div>
        </div>
      </div>
    </section>
  );
}
