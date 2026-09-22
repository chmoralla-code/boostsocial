'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Check if service worker is already registered
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) {
          navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
              console.log('PinoyBoosting PWA Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
              console.error('PinoyBoosting PWA Service Worker registration failed:', error);
            });
        }
      });
    }
  }, []);

  return null;
}
