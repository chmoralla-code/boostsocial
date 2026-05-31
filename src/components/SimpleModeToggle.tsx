"use client";

import { Zap } from "lucide-react";
import { useSimpleMode } from "@/hooks/useSimpleMode";

interface SimpleModeToggleProps {
  className?: string;
}

export function SimpleModeToggle({ className = "" }: SimpleModeToggleProps) {
  const { simpleMode, toggleSimpleMode } = useSimpleMode();

  return (
    <button
      type="button"
      aria-pressed={simpleMode}
      aria-label={simpleMode ? "Simple mode on" : "Turn simple mode on"}
      onClick={toggleSimpleMode}
      className={`simple-mode-toggle flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all md:h-auto md:px-4 md:py-2 md:text-xs ${
        simpleMode
          ? "border-[#1DB954]/40 bg-[#1DB954] text-black"
          : "border-slate-800/80 bg-[#282828] text-slate-300 hover:bg-[#333] hover:text-white"
      } ${className}`}
    >
      <Zap size={14} />
      <span className="sm:hidden">{simpleMode ? "Simple On" : "Simple"}</span>
      <span className="hidden sm:inline">{simpleMode ? "Simple Mode On" : "Simple Mode Off"}</span>
      <span
        className={`relative h-4 w-7 rounded-full border transition-colors ${
          simpleMode ? "border-black/20 bg-black/15" : "border-slate-700 bg-slate-950"
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition-transform ${
            simpleMode ? "left-3.5 bg-black" : "left-0.5 bg-slate-400"
          }`}
        />
      </span>
    </button>
  );
}
