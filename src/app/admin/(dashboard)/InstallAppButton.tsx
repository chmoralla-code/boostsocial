'use client';

import React, { useEffect, useState } from 'react';
import { Download, Sparkles, AlertCircle, Smartphone, CheckCircle, ArrowRight } from 'lucide-react';

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showiOSInstructions, setShowiOSInstructions] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    // 2. Detect iOS environment
    const detectIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isAppleMobile = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isAppleMobile);
    };

    detectIOS();

    // 3. Listen for browser installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('CYNETWORK Admin PWA was successfully installed.');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // If already installed, show a sleek confirmation status card
  if (isInstalled) {
    return (
      <div className="bg-gradient-to-r from-[#181818] to-[#121212] border border-[#1DB954]/30 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#1DB954]/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="bg-[#1DB954]/10 text-[#1DB954] p-3 rounded-2xl border border-[#1DB954]/25 shadow-[0_0_15px_rgba(29,185,84,0.15)] flex-shrink-0 animate-pulse">
              <CheckCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">CYNETWORK Standalone Active</h4>
                <span className="bg-[#1DB954]/20 text-[#1DB954] text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-[#1DB954]/30">Auto-Update Enabled</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Running in dedicated shell. All layout tweaks and website updates sync dynamically.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If iOS, display Safari manual installation directions helper
  if (isIOS) {
    return (
      <div className="bg-[#181818]/90 border border-slate-800/80 hover:border-slate-700/60 rounded-2xl p-5 shadow-lg relative overflow-hidden group transition-all duration-300">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="bg-blue-500/10 text-blue-400 p-3 rounded-2xl border border-blue-500/25 flex-shrink-0">
              <Smartphone size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Download CYNETWORK Admin App
              </h4>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Install as a native application on your iPhone or iPad with automated background sync.
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowiOSInstructions(!showiOSInstructions)}
            className="w-full md:w-auto text-[10px] font-black text-white hover:text-white bg-[#1DB954] hover:bg-[#1ed760] transition-all border border-[#1DB954]/25 px-4 py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg hover:shadow-[#1DB954]/20 cursor-pointer"
          >
            {showiOSInstructions ? 'Close Guide' : 'Install Guide'} <ArrowRight size={12} />
          </button>
        </div>

        {showiOSInstructions && (
          <div className="mt-4 pt-4 border-t border-slate-800/60 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-[#121212]/80 border border-slate-850/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-slate-350">
                <span className="bg-[#1DB954] text-black w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] flex-shrink-0">1</span>
                <p className="font-semibold pt-0.5">Open this dashboard in the native <span className="text-white font-bold">Safari Browser</span>.</p>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-350">
                <span className="bg-[#1DB954] text-black w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] flex-shrink-0">2</span>
                <p className="font-semibold pt-0.5">Tap the browser's <span className="text-white font-bold">Share Button</span> (square with upward arrow) in the toolbar.</p>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-350">
                <span className="bg-[#1DB954] text-black w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] flex-shrink-0">3</span>
                <p className="font-semibold pt-0.5">Scroll down and select <span className="text-white font-bold">"Add to Home Screen"</span>.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If normal browser and PWA is installable (Chrome, Edge, Opera, Samsung Internet)
  if (isInstallable) {
    return (
      <div className="bg-[#181818]/90 border border-slate-800/80 hover:border-[#1DB954]/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#1DB954]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#1DB954]/10 transition-colors"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="bg-[#1DB954]/10 text-[#1DB954] p-3 rounded-2xl border border-[#1DB954]/25 shadow-[0_0_15px_rgba(29,185,84,0.05)] flex-shrink-0">
              <Download size={22} className="animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">CYNETWORK Admin Standalone Available</h4>
                <span className="bg-[#1DB954]/15 text-[#1DB954] text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-[#1DB954]/20">PWA Desktop App</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Install as a native desktop utility. Automatic updates configure and sync seamlessly from your Vercel edge.
              </p>
            </div>
          </div>

          <button 
            onClick={handleInstallClick}
            className="w-full md:w-auto text-[10px] font-black text-white hover:text-white bg-[#1DB954] hover:bg-[#1ed760] transition-all border border-[#1DB954]/25 px-4 py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg hover:shadow-[#1DB954]/20 cursor-pointer group-hover:scale-[1.02] duration-300"
          >
            <Sparkles size={11} className="animate-spin-[spin_3s_linear_infinite]" /> Download App
          </button>
        </div>
      </div>
    );
  }

  // Fallback: If not installable yet (still caching/initializing), show instructions on how to install or check system PWA
  return (
    <div className="bg-[#181818]/70 border border-slate-850/60 rounded-2xl p-5 shadow-md relative overflow-hidden group">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="bg-slate-800 text-slate-500 p-3 rounded-2xl border border-slate-700/60 flex-shrink-0">
            <Download size={22} className="opacity-60" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Desktop & Mobile PWA Active</h4>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              Launch directly from your browser's address bar menu or settings list to run in fullscreen.
            </p>
          </div>
        </div>
        <div className="text-[9px] text-slate-500 font-extrabold uppercase bg-slate-800/40 border border-slate-800 px-2.5 py-1.5 rounded-xl">
          Auto-Updates Online
        </div>
      </div>
    </div>
  );
}
