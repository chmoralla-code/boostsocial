"use client";

import { useEffect, useRef } from "react";

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
}

export function AntigravityCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false, targetX: 0, targetY: 0 });

  useEffect(() => {
    // Disable on mobile/touch devices to optimize performance and prevent interface issues
    const isTouchDevice = 
      "ontouchstart" in window || 
      navigator.maxTouchPoints > 0 || 
      (window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
      
    if (isTouchDevice) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
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

      // Spawn dust trail particles on mouse move
      if (Math.random() < 0.4) {
        spawnDust(e.clientX, e.clientY);
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    const particles: Particle[] = [];
    const colors = [
      "rgba(24, 119, 242, ",  // Facebook Blue
      "rgba(29, 185, 84, ",   // Spotify Green
      "rgba(99, 102, 241, ",  // Indigo Glow
      "rgba(14, 165, 233, "   // Cyan Sparkle
    ];

    const symbols = ["👍", "👥", "▶", "⚡", "💙", "🔥"];

    // Spawn tiny trail dust
    const spawnDust = (x: number, y: number) => {
      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.5 - 0.5, // Always float upwards
        size: Math.random() * 3 + 1.5,
        color: colorBase,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        glow: Math.random() * 15 + 5,
        type: "dust"
      });
    };

    // Spawn larger floating interactive bubbles at the bottom
    const spawnFloatingBubble = () => {
      if (particles.filter(p => p.type === "bubble").length >= 15) return;

      const size = Math.random() * 30 + 15;
      const x = Math.random() * canvas.width;
      const y = canvas.height + size + 10;
      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      const hasSymbol = Math.random() < 0.6;

      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(Math.random() * 1.2 + 0.6), // Negative velocity to float UPWARDS (Antigravity!)
        size,
        color: colorBase,
        alpha: 0.85,
        decay: Math.random() * 0.002 + 0.001,
        glow: Math.random() * 25 + 15,
        type: "bubble",
        symbol: hasSymbol ? symbols[Math.floor(Math.random() * symbols.length)] : undefined,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02
      });
    };

    // Interpolated cursor coordinates for smooth LERP trailing bubble
    let lerpX = 0;
    let lerpY = 0;

    // Simulation loop
    let animationFrameId: number;
    
    const animate = () => {
      // Clear with very slight transparency to create trace motion paths
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mouseRef.current;

      // Smoothly interpolate cursor bubble position (LERP)
      lerpX += (mouse.targetX - lerpX) * 0.15;
      lerpY += (mouse.targetY - lerpY) * 0.15;

      // Draw custom glowing cursor ring if mouse active
      if (mouse.active) {
        // Outer interactive portal ring
        ctx.beginPath();
        ctx.arc(lerpX, lerpY, 20, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(24, 119, 242, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lerpX, lerpY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#1DB954";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#1ed760";
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow for next drawings
      }

      // Spontaneously spawn floating antigravity bubbles at bottom
      if (Math.random() < 0.03) {
        spawnFloatingBubble();
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply soft upwards drift (inverted gravity)
        p.y += p.vy;
        p.x += p.x < 0 || p.x > canvas.width ? -p.vx : p.vx; // simple boundary wall bounce
        
        if (p.type === "bubble" && p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed;
        }

        // Apply dynamic mouse repulsion bubble force (Antigravity lens)
        if (mouse.active) {
          const dx = p.x - mouse.targetX;
          const dy = p.y - mouse.targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const forceRadius = p.type === "bubble" ? 180 : 120;

          if (dist < forceRadius) {
            const force = (forceRadius - dist) / forceRadius;
            const pushX = (dx / dist) * force * (p.type === "bubble" ? 4.5 : 2.5);
            const pushY = (dy / dist) * force * (p.type === "bubble" ? 4.5 : 2.5);

            p.vx += pushX;
            p.vy += pushY;
          }
        }

        // Apply friction/drag so forces decay naturally
        p.vx *= 0.94;
        p.vy = p.vy * 0.98 - 0.02; // continuously pull upwards

        // Decelerate heavy acceleration spikes
        const maxSpeed = p.type === "bubble" ? 5 : 4;
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed) {
          p.vx = (p.vx / currentSpeed) * maxSpeed;
          p.vy = (p.vy / currentSpeed) * maxSpeed;
        }

        // Apply alpha decay
        p.alpha -= p.decay;

        // Remove dead particles
        if (p.alpha <= 0 || p.y < -p.size - 20) {
          particles.splice(i, 1);
          continue;
        }

        // RENDER PARTICLES
        ctx.save();
        ctx.globalAlpha = p.alpha;

        if (p.type === "dust") {
          // Glow effect for neon sparks
          ctx.shadowBlur = p.glow;
          ctx.shadowColor = p.color + "0.6)";

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color + "0.9)";
          ctx.fill();
        } else if (p.type === "bubble") {
          // Render gorgeous interactive glassmorphic orb with brand-colored glowing border
          const gradient = ctx.createRadialGradient(
            p.x - p.size * 0.3,
            p.y - p.size * 0.3,
            2,
            p.x,
            p.y,
            p.size
          );
          
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
          gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.02)");
          gradient.addColorStop(1, p.color + "0.25)");

          ctx.shadowBlur = p.glow;
          ctx.shadowColor = p.color + "0.45)";

          // Outline border
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + "0.55)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Fill glass body
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // Highlight reflection glint in the corner
          ctx.beginPath();
          ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
          ctx.fill();

          // Render symbol if present
          if (p.symbol) {
            ctx.shadowBlur = 0; // Disable shadow for text to prevent blur
            ctx.translate(p.x, p.y);
            if (p.rotation !== undefined) {
              ctx.rotate(p.rotation);
            }
            ctx.font = `bold ${p.size * 0.7}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = p.color + "0.95)";
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
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
