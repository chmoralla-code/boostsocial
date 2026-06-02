'use client';

import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";

export function FeatureBadgesGrid() {
  const { featureBadges } = useWidgetVisibility();
  if (!featureBadges) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-2xl w-full mt-2 animate-fade-in-up-3">
      <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1DB954]/25 transition-all duration-300 transform hover:scale-[1.02] cursor-default">
        <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">🛡️</span>
        <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">Monetization Safe</span>
        <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">Filtered Ad-compliant pools</span>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1877F2]/25 transition-all duration-300 transform hover:scale-[1.02] cursor-default">
        <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">🇵🇭</span>
        <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">PH Base Curation</span>
        <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">Organic local profiles</span>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1DB954]/25 transition-all duration-300 transform hover:scale-[1.02] cursor-default">
        <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">💬</span>
        <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">Taglish Handshake</span>
        <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">24h developer-direct assistance</span>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1877F2]/25 transition-all duration-300 transform hover:scale-[1.02] cursor-default">
        <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">📲</span>
        <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">GCash Auto-Verify</span>
        <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">No crypto payment hassle</span>
      </div>
    </div>
  );
}
