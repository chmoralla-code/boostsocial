"use client";

import { useEffect, useRef } from "react";

export function HeroVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Ensure video plays on mount (handles autoplay policies)
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {
        // Autoplay was prevented, video will remain paused
        // This is fine — the dark overlay still looks good
      });
    }
  }, []);

  return (
    <div className="hero-video-wrapper">
      <video
        ref={videoRef}
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster=""
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>
      {/* Dark gradient overlay to keep text readable */}
      <div className="hero-video-overlay" />
    </div>
  );
}
