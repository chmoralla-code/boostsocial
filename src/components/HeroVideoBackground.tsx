"use client";

import { useEffect, useRef } from "react";
import { useSimpleMode } from "@/hooks/useSimpleMode";

interface HeroVideoBackgroundProps {
  videoUrl?: string;
  opacity?: number;
}

export function HeroVideoBackground({ videoUrl, opacity }: HeroVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { simpleMode } = useSimpleMode();

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
    if (simpleMode) {
      videoRef.current?.pause();
      return;
    }

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
  }, [videoUrl, isImg, simpleMode]);

  if (simpleMode) {
    return <div className="hero-video-wrapper simple-mode-static-hero" aria-hidden="true" />;
  }

  return (
    <div className="hero-video-wrapper">
      {isImg && videoUrl ? (
        <img
          src={videoUrl}
          className="hero-video object-cover"
          alt="Hero background"
          style={{ opacity: activeOpacity }}
        />
      ) : (
        <video
          ref={videoRef}
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster=""
          style={{ opacity: activeOpacity }}
        >
          <source src={videoUrl || "/hero-bg.mp4"} />
        </video>
      )}
      {/* Dark gradient overlay to keep text readable */}
      <div className="hero-video-overlay" />
    </div>
  );
}

