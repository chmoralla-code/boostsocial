"use client";

import { useEffect, useRef } from "react";

interface HeroVideoBackgroundProps {
  videoUrl?: string;
}

export function HeroVideoBackground({ videoUrl }: HeroVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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
  }, [videoUrl, isImg]);

  return (
    <div className="hero-video-wrapper">
      {isImg && videoUrl ? (
        <img
          src={videoUrl}
          className="hero-video object-cover"
          alt="Hero background"
        />
      ) : (
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
          <source src={videoUrl || "/hero-bg.mp4"} />
        </video>
      )}
      {/* Dark gradient overlay to keep text readable */}
      <div className="hero-video-overlay" />
    </div>
  );
}

