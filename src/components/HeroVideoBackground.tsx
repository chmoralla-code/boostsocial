"use client";

import { useEffect, useRef, useState } from "react";

interface HeroVideoBackgroundProps {
  videoUrl?: string;
  opacity?: number;
}

export function HeroVideoBackground({ videoUrl, opacity }: HeroVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [allowMotion, setAllowMotion] = useState(false);

  const activeOpacity = opacity !== undefined ? opacity : 0.45;

  // Check if the URL represents an image/GIF
  const isImage = (url?: string) => {
    if (!url) return false;
    const cleanUrl = url.split("?")[0].toLowerCase();
    return (
      cleanUrl.endsWith(".gif") ||
      cleanUrl.endsWith(".jpg") ||
      cleanUrl.endsWith(".jpeg") ||
      cleanUrl.endsWith(".png") ||
      cleanUrl.endsWith(".webp")
    );
  };

  const isImg = isImage(videoUrl);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px) and (prefers-reduced-motion: no-preference)");
    const update = () => setAllowMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!allowMotion) return;
    // Reload video source and autoplay when videoUrl changes and is not an image
    if (!isImg) {
      const video = videoRef.current;
      if (video) {
        video.load();
        video.play().catch(() => {
          // Autoplay was prevented, video will remain paused
          // This is fine — the dark overlay still looks good
        });
      }
    }
  }, [videoUrl, isImg, allowMotion]);

  return (
    <div className="hero-video-wrapper">
      {isImg && videoUrl ? (
        <img
          src={videoUrl}
          className="hero-video object-cover"
          alt="Hero background"
          style={{ opacity: activeOpacity }}
        />
      ) : allowMotion ? (
        <video
          ref={videoRef}
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster=""
          style={{ opacity: activeOpacity }}
        >
          <source src={videoUrl || "/hero-bg.mp4"} />
        </video>
      ) : (
        <div className="hero-video bg-[radial-gradient(circle_at_25%_20%,rgba(220,38,38,0.14),transparent_38%),radial-gradient(circle_at_60%_80%,rgba(139,0,0,0.10),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(180,30,50,0.08),transparent_50%),linear-gradient(135deg,#0d0505,#0a0000_55%,#0b0b0b)]" style={{ opacity: activeOpacity }} />
      )}
      {/* Dark gradient overlay to keep text readable */}
      <div className="hero-video-overlay" />
    </div>
  );
}

