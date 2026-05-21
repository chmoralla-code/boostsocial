"use client";

import { useEffect, useRef } from "react";
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
  // Dynamic squish/oscillation fields
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false, targetX: 0, targetY: 0 });

  useEffect(() => {
    if (isExcluded) return;

    const isMobile = 
      typeof window !== "undefined" && (
        "ontouchstart" in window || 
        navigator.maxTouchPoints > 0 || 
        (window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
      );

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
      if (isMobile) return; // Completely disable cursor interactions on mobile!
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
      mouseRef.current.active = true;

      // Spawn dust trail particles on mouse move (optimized rate)
      if (Math.random() < 0.3 && particles.length < 40) {
        spawnDust(e.clientX, e.clientY);
      }
    };

    const handleMouseLeave = () => {
      if (isMobile) return;
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
      if (isMobile) return; // Completely disable click explosions on mobile!

      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 10,
        maxRadius: 220,
        alpha: 1,
        color: colorBase
      });

      // Spawn a colorful burst of sparkling dust particles expanding in 360 degrees (optimized count to 12)
      const particleCount = 12;
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3.5;
        particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5, // slightly upwards biased
          size: Math.random() * 3 + 1.5,
          color: colorBase,
          alpha: 1,
          decay: Math.random() * 0.035 + 0.02, // faster decay for crisp animation & low overhead
          glow: Math.random() * 15 + 5,
          type: "dust"
        });
      }

      // Spawn 3 dynamic Facebook reaction bubbles flying outward on clicks
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2.5;
        const reaction = fbReactions[Math.floor(Math.random() * fbReactions.length)];
        const size = Math.random() * 12 + 14;
        particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.0,
          size,
          color: reaction.color,
          alpha: 0.9,
          decay: Math.random() * 0.008 + 0.005, // slightly faster click-bubble decay
          glow: Math.random() * 20 + 10,
          type: "bubble",
          symbol: reaction.char,
          rotation: (Math.random() - 0.5) * 0.2, // subtle tilt
          rotSpeed: (Math.random() - 0.5) * 0.004, // slow rotate to keep readable
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.06 + 0.03,
          wobbleAmount: Math.random() * 0.15 + 0.05,
          sineOffset: Math.random() * Math.PI * 2,
          sineSpeed: Math.random() * 0.015 + 0.005,
          sineAmp: Math.random() * 0.3 + 0.1
        });
      }
    };

    // Track touch interactions for desktop touchscreens (only active if not mobile viewport)
    const handleTouchStart = (e: TouchEvent) => {
      if (isMobile || e.touches.length === 0) return;
      const touch = e.touches[0];
      mouseRef.current.targetX = touch.clientX;
      mouseRef.current.targetY = touch.clientY;
      mouseRef.current.active = true;

      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      shockwaves.push({
        x: touch.clientX,
        y: touch.clientY,
        radius: 10,
        maxRadius: 180,
        alpha: 1,
        color: colorBase
      });

      // Spawn colorful sparks on tap
      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2.5;
        particles.push({
          x: touch.clientX,
          y: touch.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.0,
          size: Math.random() * 2.5 + 1.2,
          color: colorBase,
          alpha: 1,
          decay: Math.random() * 0.035 + 0.02,
          glow: Math.random() * 15 + 5,
          type: "dust"
        });
      }

      // Spawn 2 dynamic reaction bubbles on touch
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 2.0;
        const reaction = fbReactions[Math.floor(Math.random() * fbReactions.length)];
        const size = Math.random() * 10 + 12;
        particles.push({
          x: touch.clientX,
          y: touch.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          size,
          color: reaction.color,
          alpha: 0.9,
          decay: Math.random() * 0.01 + 0.006,
          glow: Math.random() * 15 + 8,
          type: "bubble",
          symbol: reaction.char,
          rotation: (Math.random() - 0.5) * 0.2,
          rotSpeed: (Math.random() - 0.5) * 0.004,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.06 + 0.03,
          wobbleAmount: Math.random() * 0.15 + 0.05,
          sineOffset: Math.random() * Math.PI * 2,
          sineSpeed: Math.random() * 0.015 + 0.005,
          sineAmp: Math.random() * 0.3 + 0.1
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isMobile || e.touches.length === 0) return;
      const touch = e.touches[0];
      mouseRef.current.targetX = touch.clientX;
      mouseRef.current.targetY = touch.clientY;
      mouseRef.current.active = true;

      // Spawn dust trail on finger drag
      if (Math.random() < 0.3 && particles.length < 40) {
        spawnDust(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = () => {
      if (isMobile) return;
      mouseRef.current.active = false;
    };

    // Only hook up interactions if NOT on mobile view!
    if (!isMobile) {
      window.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseleave", handleMouseLeave);
      window.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("touchstart", handleTouchStart, { passive: true });
      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("touchend", handleTouchEnd, { passive: true });
    }

    // Spawn tiny trail dust
    const spawnDust = (x: number, y: number) => {
      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.8,
        vy: -Math.random() * 1.5 - 0.6, // Always float upwards
        size: Math.random() * 2.5 + 1.2,
        color: colorBase,
        alpha: 1,
        decay: Math.random() * 0.02 + 0.012,
        glow: Math.random() * 15 + 5,
        type: "dust"
      });
    };

    // Spawn larger floating interactive bubbles at the bottom
    const spawnFloatingBubble = () => {
      if (particles.filter(p => p.type === "bubble").length >= 18) return;

      const size = Math.random() * 28 + 14;
      const x = Math.random() * canvas.width;
      const y = canvas.height + size + 10;
      const reaction = fbReactions[Math.floor(Math.random() * fbReactions.length)];

      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(Math.random() * 1.2 + 0.6), // float UPWARDS
        size,
        color: reaction.color,
        alpha: 0.85,
        decay: Math.random() * 0.002 + 0.001,
        glow: Math.random() * 25 + 15,
        type: "bubble",
        symbol: reaction.char,
        rotation: (Math.random() - 0.5) * 0.2, // slight starting tilt
        rotSpeed: (Math.random() - 0.5) * 0.003, // slow down rotation so emojis are readable
        // Wobble physics
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.04 + 0.02,
        wobbleAmount: Math.random() * 0.12 + 0.04,
        sineOffset: Math.random() * Math.PI * 2,
        sineSpeed: Math.random() * 0.012 + 0.004,
        sineAmp: Math.random() * 0.4 + 0.15
      });
    };

    // Interpolated cursor coordinates for smooth LERP trailing bubble
    let lerpX = 0;
    let lerpY = 0;

    // Simulation loop
    let animationFrameId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mouseRef.current;
      const time = Date.now() * 0.0025;

      // Smoothly interpolate cursor bubble position (LERP)
      lerpX += (mouse.targetX - lerpX) * 0.15;
      lerpY += (mouse.targetY - lerpY) * 0.15;

      // Draw custom glowing cursor targeting portal if mouse active and not on mobile
      if (mouse.active && !isMobile) {
        // 1. Outer dashed energy ring (rotating counter-clockwise)
        ctx.save();
        ctx.translate(lerpX, lerpY);
        ctx.rotate(-time * 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(14, 165, 233, 0.45)"; // Cyan ring
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.restore();

        // 2. Inner segmented ring (rotating clockwise)
        ctx.save();
        ctx.translate(lerpX, lerpY);
        ctx.rotate(time * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(24, 119, 242, 0.55)"; // FB Blue ring
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 6]);
        ctx.stroke();
        ctx.restore();

        // 3. Central Core Plasma Spark (Optimized concentric glow circles)
        ctx.beginPath();
        ctx.arc(lerpX, lerpY, 9, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(29, 185, 84, 0.25)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lerpX, lerpY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#1DB954"; // Spotify Green core
        ctx.fill();

        // 4. Energy Beams / Tractor Beams connecting to nearby bubbles (Optimized line distance & glow)
        ctx.save();
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.type !== "bubble") continue;

          const dx = p.x - lerpX;
          const dy = p.y - lerpY;
          const distSq = dx * dx + dy * dy;

          if (distSq < 40000) { // 200px (200 * 200 = 40000)
            const dist = Math.sqrt(distSq);
            // Draw a faint electric arc / laser line connecting the cursor to the bubble
            const alpha = (1 - (dist / 200)) * 0.35 * p.alpha;
            
            // Draw a curved organic line that wiggles
            const midX = (lerpX + p.x) / 2;
            const midY = (lerpY + p.y) / 2;
            const perpX = -(p.y - lerpY) * 0.12 * Math.sin(time + (p.size || 0));
            const perpY = (p.x - lerpX) * 0.12 * Math.sin(time + (p.size || 0));
            
            // Outer glow line
            ctx.beginPath();
            ctx.moveTo(lerpX, lerpY);
            ctx.quadraticCurveTo(midX + perpX, midY + perpY, p.x, p.y);
            ctx.strokeStyle = p.color + `${alpha * 0.35})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner intense line
            ctx.beginPath();
            ctx.moveTo(lerpX, lerpY);
            ctx.quadraticCurveTo(midX + perpX, midY + perpY, p.x, p.y);
            ctx.strokeStyle = p.color + `${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Spontaneously spawn floating antigravity bubbles at bottom
      if (Math.random() < 0.035) {
        spawnFloatingBubble();
      }

      // Draw active shockwaves & push particles
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += (sw.maxRadius - sw.radius) * 0.09;
        sw.alpha = 1 - (sw.radius / sw.maxRadius);

        if (sw.alpha <= 0.01) {
          shockwaves.splice(s, 1);
          continue;
        }

        // Draw growing glowing ring (Optimized glow, no slow shadowBlur!)
        ctx.save();
        ctx.globalAlpha = sw.alpha;
        
        // Outer soft glow ring
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color + "0.22)";
        ctx.lineWidth = 9;
        ctx.stroke();

        // Inner intense ring
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color + "0.85)";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();

        // Apply physical impact from shockwave to all particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - sw.x;
          const dy = p.y - sw.y;
          const distSq = dx * dx + dy * dy;

          const lowerR = sw.radius - 25;
          const upperR = sw.radius + 35;
          if (distSq > lowerR * lowerR && distSq < upperR * upperR) {
            const dist = Math.sqrt(distSq);
            if (dist > 0) {
              const force = (1 - (dist / sw.maxRadius)) * 14;
              if (force > 0) {
                const pushX = (dx / dist) * force;
                const pushY = (dy / dist) * force - 1.5;

                p.vx += pushX;
                p.vy += pushY;
              }
            }
          }
        }
      }

      // Draw faint lines between nearby dust particles (constellation trail) - HIGHLY OPTIMIZED
      const dustParticles = particles.filter(p => p.type === "dust");
      if (dustParticles.length < 40) {
        ctx.save();
        for (let i = 0; i < dustParticles.length; i++) {
          const p1 = dustParticles[i];
          // Limit connection checks to subsequent 6 particles to avoid O(N^2) load
          const checkLimit = Math.min(dustParticles.length, i + 7);
          for (let j = i + 1; j < checkLimit; j++) {
            const p2 = dustParticles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 3600) { // 60px distance (60 * 60 = 3600)
              const dist = Math.sqrt(distSq);
              const alpha = (1 - (dist / 60)) * 0.16 * Math.min(p1.alpha, p2.alpha);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = p1.color + `${alpha})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // Cap maximum dust particles to prevent array bloat
      if (dustParticles.length > 35) {
        const firstDustIdx = particles.findIndex(p => p.type === "dust");
        if (firstDustIdx !== -1) {
          particles.splice(firstDustIdx, 1);
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply upwards drift
        p.y += p.vy;
        p.x += p.x < 0 || p.x > canvas.width ? -p.vx : p.vx; // simple boundary wall bounce
        
        // Custom state updates for bubbles
        if (p.type === "bubble") {
          if (p.rotation !== undefined && p.rotSpeed !== undefined) {
            p.rotation += p.rotSpeed;
          }
          if (p.wobble !== undefined && p.wobbleSpeed !== undefined) {
            p.wobble += p.wobbleSpeed;
          }
          if (p.sineOffset !== undefined && p.sineSpeed !== undefined && p.sineAmp !== undefined) {
            p.sineOffset += p.sineSpeed;
            p.vx += Math.sin(p.sineOffset) * p.sineAmp * 0.1;
          }
        }

        // Apply mouse repulsion force (antigravity field)
        if (mouse.active && !isMobile) {
          const dx = p.x - mouse.targetX;
          const dy = p.y - mouse.targetY;
          const distSq = dx * dx + dy * dy;
          const forceRadius = p.type === "bubble" ? 180 : 120;

          if (distSq < forceRadius * forceRadius) {
            const dist = Math.sqrt(distSq);
            if (dist > 0) {
              const force = (forceRadius - dist) / forceRadius;
              const pushX = (dx / dist) * force * (p.type === "bubble" ? 5 : 2.5);
              const pushY = (dy / dist) * force * (p.type === "bubble" ? 5 : 2.5);

              p.vx += pushX;
              p.vy += pushY;
            }
          }
        }

        // Apply drag/friction so velocities decay naturally
        p.vx *= 0.94;
        p.vy = p.vy * 0.98 - 0.025; // float upwards

        // Decelerate extreme velocities
        const maxSpeed = p.type === "bubble" ? 5.5 : 4.5;
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed && currentSpeed > 0) {
          p.vx = (p.vx / currentSpeed) * maxSpeed;
          p.vy = (p.vy / currentSpeed) * maxSpeed;
        }

        // Apply alpha decay
        p.alpha -= p.decay;

        // Remove dead particles
        if (p.alpha <= 0 || p.y < -p.size - 30) {
          particles.splice(i, 1);
          continue;
        }

        // RENDER PARTICLES
        ctx.save();
        ctx.globalAlpha = p.alpha;

        if (p.type === "dust") {
          // Spark glow (concentric circles, highly optimized, no slow shadowBlur!)
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = p.color + "0.22)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color + "0.95)";
          ctx.fill();
        } else if (p.type === "bubble") {
          // Localize coordinate system to bubble center for squish/rotation operations
          ctx.translate(p.x, p.y);
          
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > 0.15) {
            const stretchAngle = Math.atan2(p.vy, p.vx);
            ctx.rotate(stretchAngle);
          }
          
          let scaleX = 1;
          let scaleY = 1;
          if (p.wobble !== undefined && p.wobbleAmount !== undefined) {
            scaleX = 1 + Math.sin(p.wobble) * p.wobbleAmount;
            scaleY = 1 - Math.sin(p.wobble) * p.wobbleAmount;
          }
          
          // Apply speed stretch multiplier (looks squishy during acceleration)
          const stretch = Math.min(speed * 0.05, 0.22);
          const rx = p.size * (1 + stretch) * scaleX;
          const ry = p.size * (1 - stretch) * scaleY;

          // Radial gradient centered in localized bubble
          const gradient = ctx.createRadialGradient(
            -rx * 0.3,
            -ry * 0.3,
            2,
            0,
            0,
            Math.max(rx, ry)
          );
          
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.12)");
          gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.02)");
          gradient.addColorStop(1, p.color + "0.26)");

          // Outer ellipse glow (Double border, no shadowBlur!)
          ctx.beginPath();
          ctx.ellipse(0, 0, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + "0.15)";
          ctx.lineWidth = 4;
          ctx.stroke();

          // Draw outline border
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + "0.6)";
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Fill glass body
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          // Highlight reflection glint
          ctx.beginPath();
          ctx.ellipse(-rx * 0.35, -ry * 0.35, rx * 0.15, ry * 0.15, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
          ctx.fill();

          // Render symbol if present
          if (p.symbol) {
            // Undo velocity-stretch rotation to keep symbols upright (or slightly wobbling)
            if (speed > 0.15) {
              const stretchAngle = Math.atan2(p.vy, p.vx);
              ctx.rotate(-stretchAngle);
            }
            if (p.rotation !== undefined) {
              ctx.rotate(p.rotation);
            }
            ctx.font = `bold ${p.size * 0.72}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = p.color + "0.92)";
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
      if (!isMobile) {
        window.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseleave", handleMouseLeave);
        window.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("touchstart", handleTouchStart);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [isExcluded]);

  if (isExcluded) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
