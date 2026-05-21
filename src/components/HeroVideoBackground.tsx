"use client";

import { useEffect, useRef } from "react";

interface HeroVideoBackgroundProps {
  videoUrl?: string;
}

export function HeroVideoBackground({ videoUrl }: HeroVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Reload video source and autoplay when videoUrl changes
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => {
        // Autoplay was prevented, video will remain paused
        // This is fine — the dark overlay still looks good
      });
    }
  }, [videoUrl]);

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
        <source src={videoUrl || "/hero-bg.mp4"} type="video/mp4" />
      </video>
      {/* Dark gradient overlay to keep text readable */}
      <div className="hero-video-overlay" />
    </div>
  );
}
