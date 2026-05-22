"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  glow: number;
  type: "dust" | "bubble";
  symbol?: string;
  rotation?: number;
  rotSpeed?: number;
  wobble?: number;
  wobbleSpeed?: number;
  wobbleAmount?: number;
  sineOffset?: number;
  sineSpeed?: number;
  sineAmp?: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export function AntigravityCursor() {
  const pathname = usePathname();
  const isExcluded = pathname?.startsWith("/admin");

  const [disabled, setDisabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false, targetX: 0, targetY: 0 });

  useEffect(() => {
    if (isExcluded) return;

    // Detect touchscreens, narrow viewports or low-performance markers
    const isMobile = 
      typeof window !== "undefined" && (
        "ontouchstart" in window || 
        navigator.maxTouchPoints > 0 || 
        (window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
      );

    // If it is mobile, completely disable cursor animation loops to boost FPS on low-spec phones
    if (isMobile) {
      setDisabled(true);
      return;
    }

    setDisabled(false);
  }, [isExcluded]);

  useEffect(() => {
    if (disabled || isExcluded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Track mouse coordinates
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
      mouseRef.current.active = true;

      // Spawn dust trail particles on mouse move (optimized rate)
      if (Math.random() < 0.25 && particles.length < 30) {
        spawnDust(e.clientX, e.clientY);
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const particles: Particle[] = [];
    const shockwaves: Shockwave[] = [];
    
    const colors = [
      "rgba(24, 119, 242, ",  // Facebook Blue
      "rgba(29, 185, 84, ",   // Spotify Green
      "rgba(99, 102, 241, ",  // Indigo Glow
      "rgba(14, 165, 233, "   // Cyan Sparkle
    ];

    const fbReactions = [
      { char: "👍", color: "rgba(24, 119, 242, " },   // Like (Blue)
      { char: "❤️", color: "rgba(243, 62, 88, " },   // Love (Red)
      { char: "🥰", color: "rgba(247, 177, 37, " },   // Care (Yellow/Orange)
      { char: "😆", color: "rgba(247, 177, 37, " },   // Haha (Yellow)
      { char: "😮", color: "rgba(247, 177, 37, " },   // Wow (Yellow)
      { char: "😢", color: "rgba(90, 160, 235, " },   // Sad (Soft Blue-Grey)
      { char: "😡", color: "rgba(233, 113, 15, " }    // Angry (Orange/Red)
    ];

    // Track mouse click to spawn shockwaves and particle bursts
    const handleMouseDown = (e: MouseEvent) => {
      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 10,
        maxRadius: 200,
        alpha: 1,
        color: colorBase
      });

      // Spawn a colorful burst of sparkling dust particles expanding in 360 degrees (optimized count to 8)
      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 3.0;
        particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.0,
          size: Math.random() * 2.5 + 1.2,
          color: colorBase,
          alpha: 1,
          decay: Math.random() * 0.04 + 0.025, // faster decay for higher performance
          glow: Math.random() * 10 + 5,
          type: "dust"
        });
      }

      // Spawn 2 dynamic Facebook reaction bubbles flying outward on clicks
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 2.0;
        const reaction = fbReactions[Math.floor(Math.random() * fbReactions.length)];
        const size = Math.random() * 10 + 12;
        particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          size,
          color: reaction.color,
          alpha: 0.9,
          decay: Math.random() * 0.012 + 0.008,
          glow: Math.random() * 15 + 5,
          type: "bubble",
          symbol: reaction.char,
          rotation: (Math.random() - 0.5) * 0.2,
          rotSpeed: (Math.random() - 0.5) * 0.003,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.05 + 0.02,
          wobbleAmount: Math.random() * 0.12 + 0.04,
          sineOffset: Math.random() * Math.PI * 2,
          sineSpeed: Math.random() * 0.012 + 0.004,
          sineAmp: Math.random() * 0.25 + 0.1
        });
      }
    };

    // Spawn tiny trail dust
    const spawnDust = (x: number, y: number) => {
      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.2 - 0.5,
        size: Math.random() * 2.0 + 1.0,
        color: colorBase,
        alpha: 1,
        decay: Math.random() * 0.025 + 0.015,
        glow: Math.random() * 10 + 4,
        type: "dust"
      });
    };

    // Spawn larger floating interactive bubbles at the bottom (restricted max count to 8 for speed!)
    const spawnFloatingBubble = () => {
      if (particles.filter(p => p.type === "bubble").length >= 8) return;

      const size = Math.random() * 20 + 12;
      const x = Math.random() * canvas.width;
      const y = canvas.height + size + 10;
      const reaction = fbReactions[Math.floor(Math.random() * fbReactions.length)];

      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(Math.random() * 1.0 + 0.5),
        size,
        color: reaction.color,
        alpha: 0.85,
        decay: Math.random() * 0.003 + 0.0015,
        glow: Math.random() * 15 + 8,
        type: "bubble",
        symbol: reaction.char,
        rotation: (Math.random() - 0.5) * 0.15,
        rotSpeed: (Math.random() - 0.5) * 0.002,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.03 + 0.015,
        wobbleAmount: Math.random() * 0.1 + 0.03,
        sineOffset: Math.random() * Math.PI * 2,
        sineSpeed: Math.random() * 0.01 + 0.003,
        sineAmp: Math.random() * 0.3 + 0.1
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mousedown", handleMouseDown);

    let lerpX = 0;
    let lerpY = 0;
    let animationFrameId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mouseRef.current;
      const time = Date.now() * 0.0025;

      lerpX += (mouse.targetX - lerpX) * 0.15;
      lerpY += (mouse.targetY - lerpY) * 0.15;

      // Draw custom glowing cursor if mouse is active
      if (mouse.active) {
        // Dashed ring
        ctx.save();
        ctx.translate(lerpX, lerpY);
        ctx.rotate(-time * 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(14, 165, 233, 0.4)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();

        // Inner solid/segmented ring
        ctx.save();
        ctx.translate(lerpX, lerpY);
        ctx.rotate(time * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(24, 119, 242, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.restore();

        // Core
        ctx.beginPath();
        ctx.arc(lerpX, lerpY, 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(29, 185, 84, 0.2)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lerpX, lerpY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#1DB954";
        ctx.fill();

        // Energy beams (restricted search limit to keep it fast)
        ctx.save();
        let beamsDrawn = 0;
        for (let i = 0; i < particles.length && beamsDrawn < 3; i++) {
          const p = particles[i];
          if (p.type !== "bubble") continue;

          const dx = p.x - lerpX;
          const dy = p.y - lerpY;
          const distSq = dx * dx + dy * dy;

          if (distSq < 22500) { // 150px
            beamsDrawn++;
            const dist = Math.sqrt(distSq);
            const alpha = (1 - (dist / 150)) * 0.25 * p.alpha;
            
            const midX = (lerpX + p.x) / 2;
            const midY = (lerpY + p.y) / 2;
            const perpX = -(p.y - lerpY) * 0.08 * Math.sin(time + (p.size || 0));
            const perpY = (p.x - lerpX) * 0.08 * Math.sin(time + (p.size || 0));
            
            ctx.beginPath();
            ctx.moveTo(lerpX, lerpY);
            ctx.quadraticCurveTo(midX + perpX, midY + perpY, p.x, p.y);
            ctx.strokeStyle = p.color + `${alpha * 0.3})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(lerpX, lerpY);
            ctx.quadraticCurveTo(midX + perpX, midY + perpY, p.x, p.y);
            ctx.strokeStyle = p.color + `${alpha})`;
            ctx.lineWidth = 1.0;
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      if (Math.random() < 0.02) {
        spawnFloatingBubble();
      }

      // Draw shockwaves
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += (sw.maxRadius - sw.radius) * 0.1;
        sw.alpha = 1 - (sw.radius / sw.maxRadius);

        if (sw.alpha <= 0.02) {
          shockwaves.splice(s, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = sw.alpha;
        
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color + "0.15)";
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color + "0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        // Shockwave impact
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - sw.x;
          const dy = p.y - sw.y;
          const distSq = dx * dx + dy * dy;

          const lowerR = sw.radius - 20;
          const upperR = sw.radius + 30;
          if (distSq > lowerR * lowerR && distSq < upperR * upperR) {
            const dist = Math.sqrt(distSq);
            if (dist > 0) {
              const force = (1 - (dist / sw.maxRadius)) * 10;
              p.vx += (dx / dist) * force;
              p.vy += (dy / dist) * force - 1.0;
            }
          }
        }
      }

      // Constellation lines: COMPLETELY REMOVED to boost rendering FPS significantly!

      // Cap maximum dust particles
      const dustCount = particles.filter(p => p.type === "dust").length;
      if (dustCount > 25) {
        const firstDustIdx = particles.findIndex(p => p.type === "dust");
        if (firstDustIdx !== -1) {
          particles.splice(firstDustIdx, 1);
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.y += p.vy;
        p.x += p.x < 0 || p.x > canvas.width ? -p.vx : p.vx;
        
        if (p.type === "bubble") {
          if (p.rotation !== undefined && p.rotSpeed !== undefined) {
            p.rotation += p.rotSpeed;
          }
          if (p.wobble !== undefined && p.wobbleSpeed !== undefined) {
            p.wobble += p.wobbleSpeed;
          }
          if (p.sineOffset !== undefined && p.sineSpeed !== undefined && p.sineAmp !== undefined) {
            p.sineOffset += p.sineSpeed;
            p.vx += Math.sin(p.sineOffset) * p.sineAmp * 0.08;
          }
        }

        // Mouse repulsion
        if (mouse.active) {
          const dx = p.x - mouse.targetX;
          const dy = p.y - mouse.targetY;
          const distSq = dx * dx + dy * dy;
          const forceRadius = p.type === "bubble" ? 140 : 90;

          if (distSq < forceRadius * forceRadius) {
            const dist = Math.sqrt(distSq);
            if (dist > 0) {
              const force = (forceRadius - dist) / forceRadius;
              p.vx += (dx / dist) * force * (p.type === "bubble" ? 4 : 2);
              p.vy += (dy / dist) * force * (p.type === "bubble" ? 4 : 2);
            }
          }
        }

        p.vx *= 0.93;
        p.vy = p.vy * 0.97 - 0.02;

        const maxSpeed = p.type === "bubble" ? 4.5 : 3.5;
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed && currentSpeed > 0) {
          p.vx = (p.vx / currentSpeed) * maxSpeed;
          p.vy = (p.vy / currentSpeed) * maxSpeed;
        }

        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y < -p.size - 20) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;

        if (p.type === "dust") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = p.color + "0.15)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color + "0.9)";
          ctx.fill();
        } else if (p.type === "bubble") {
          ctx.translate(p.x, p.y);
          
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > 0.15) {
            ctx.rotate(Math.atan2(p.vy, p.vx));
          }
          
          let scaleX = 1;
          let scaleY = 1;
          if (p.wobble !== undefined && p.wobbleAmount !== undefined) {
            scaleX = 1 + Math.sin(p.wobble) * p.wobbleAmount;
            scaleY = 1 - Math.sin(p.wobble) * p.wobbleAmount;
          }
          
          const stretch = Math.min(speed * 0.04, 0.18);
          const rx = p.size * (1 + stretch) * scaleX;
          const ry = p.size * (1 - stretch) * scaleY;

          // Simple color fill with thin borders instead of heavy radial gradients
          // for maximum performance on older setups!
          ctx.beginPath();
          ctx.ellipse(0, 0, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + "0.1)";
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + "0.5)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = p.color + "0.12)";
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          // Highlight reflection
          ctx.beginPath();
          ctx.ellipse(-rx * 0.35, -ry * 0.35, rx * 0.15, ry * 0.15, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.fill();

          if (p.symbol) {
            if (speed > 0.15) {
              ctx.rotate(-Math.atan2(p.vy, p.vx));
            }
            if (p.rotation !== undefined) {
              ctx.rotate(p.rotation);
            }
            ctx.font = `bold ${p.size * 0.72}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = p.color + "0.9)";
            ctx.fillText(p.symbol, 0, 0);
          }
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mousedown", handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [disabled, isExcluded]);

  if (isExcluded || disabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
