"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MonitorUp,
  RefreshCw,
} from "lucide-react";

type LinkPreview = {
  url: string;
  finalUrl: string;
  reachable: boolean;
  status: number;
  contentType: string;
  title: string;
  description: string;
  image: string;
  embeddable: boolean;
  reason: string | null;
  checkedAt: string;
};

type LinkPreviewWindowProps = {
  targetUrl?: string | null;
  orderStatus?: string | null;
  serviceTitle?: string | null;
};

const URL_PATTERN = /(https?:\/\/[^\s\]\)]+)/i;
const REFRESH_INTERVAL_MS = 45000;

function cleanCandidate(value: string) {
  return value.trim().replace(/[),.;]+$/g, "");
}

function normalizePreviewUrl(value: string) {
  const candidate = cleanCandidate(value);
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function extractPreviewUrl(targetUrl?: string | null) {
  if (!targetUrl) return "";

  const reactionLink = targetUrl.match(/Link:\s*(https?:\/\/[^\s\]]+)/i)?.[1];
  if (reactionLink) return normalizePreviewUrl(reactionLink);

  const fbAdmin = targetUrl.match(/\[FB Admin:\s*([^\]]+)\]/i)?.[1];
  if (fbAdmin && URL_PATTERN.test(fbAdmin)) {
    return normalizePreviewUrl(fbAdmin);
  }

  const firstUrl = targetUrl.match(URL_PATTERN)?.[1];
  if (firstUrl) return normalizePreviewUrl(firstUrl);

  return "";
}

function formatCheckedAt(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function LinkPreviewWindow({ targetUrl, orderStatus, serviceTitle }: LinkPreviewWindowProps) {
  const previewUrl = useMemo(() => extractPreviewUrl(targetUrl), [targetUrl]);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [frameTimedOut, setFrameTimedOut] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  const loadPreview = useCallback(async () => {
    if (!previewUrl) return;

    setLoading(true);
    setFrameReady(false);
    setFrameTimedOut(false);
    setFrameKey((key) => key + 1);

    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(previewUrl)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as LinkPreview | { error?: string };

      if (!response.ok) {
        throw new Error("Preview check failed.");
      }

      setPreview(data as LinkPreview);
    } catch {
      setPreview({
        url: previewUrl,
        finalUrl: previewUrl,
        reachable: false,
        status: 0,
        contentType: "",
        title: new URL(previewUrl).hostname,
        description: "",
        image: "",
        embeddable: false,
        reason: "Preview check failed.",
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!previewUrl) return;

    const timeout = window.setTimeout(() => {
      loadPreview();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadPreview, previewUrl, orderStatus]);

  useEffect(() => {
    if (!previewUrl) return;

    const interval = window.setInterval(() => {
      loadPreview();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [loadPreview, previewUrl]);

  useEffect(() => {
    if (!preview?.embeddable || !preview.reachable) return;

    const timeout = window.setTimeout(() => {
      if (!frameReady) setFrameTimedOut(true);
    }, 9000);

    return () => window.clearTimeout(timeout);
  }, [frameReady, preview?.embeddable, preview?.reachable, frameKey]);

  if (!previewUrl) {
    return null;
  }

  // 1. Sleek, pulsating loading state placeholder
  if (loading) {
    return (
      <div className="w-full h-[140px] sm:h-[180px] rounded-2xl border border-slate-800/60 bg-[#161616]/40 flex flex-col items-center justify-center gap-2.5 animate-pulse select-none max-w-lg mx-auto">
        <Loader2 className="animate-spin text-[#1877F2] drop-shadow-[0_0_8px_rgba(24,119,242,0.3)]" size={20} />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Checking live preview...</span>
      </div>
    );
  }

  // 2. Premium Open-Graph Image Preview (The requested clean live picture card!)
  if (preview?.image) {
    return (
      <div className="relative group overflow-hidden rounded-2xl border border-slate-800/85 hover:border-[#1877F2]/30 transition-all duration-300 shadow-xl max-w-lg mx-auto bg-black/40">
        <img
          src={preview.image}
          alt="Target Page Preview"
          className="w-full h-auto max-h-[220px] object-cover transition-transform duration-500 group-hover:scale-102 select-none"
        />
        
        {/* Sleek verification bar overlay */}
        <div className="absolute bottom-3 left-3 right-3 px-3.5 py-2.5 rounded-xl bg-[#090909]/80 backdrop-blur-md border border-white/[0.04] flex items-center justify-between text-left shadow-lg">
          <div className="truncate pr-2 select-all">
            <span className="block text-[8px] font-black uppercase text-[#1877F2] tracking-widest">Verified Target Link</span>
            <span className="block text-[10px] font-bold text-white truncate leading-tight mt-0.5">{preview.title || "Live Target"}</span>
          </div>
          <span className="flex-shrink-0 text-[8px] font-black uppercase bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/25 px-2.5 py-1 rounded-full select-none flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>
      </div>
    );
  }

  // 3. Fallback 1: Link Verified checkmark card (if reachable but no image)
  if (preview?.reachable) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 max-w-lg mx-auto text-left shadow-md select-none animate-in fade-in duration-300">
        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
          <span className="text-xs">✔</span>
        </div>
        <div className="truncate">
          <span className="block text-[9px] font-black uppercase tracking-wider text-emerald-400">Target Link Verified</span>
          <span className="block text-[10px] font-bold text-slate-300 truncate mt-0.5 leading-snug">{previewUrl}</span>
        </div>
      </div>
    );
  }

  // 4. Fallback 2: Link Unreachable warning card
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/15 bg-red-500/5 max-w-lg mx-auto text-left shadow-md select-none animate-in fade-in duration-300">
      <div className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
        <span className="text-xs font-bold">!</span>
      </div>
      <div>
        <span className="block text-[9px] font-black uppercase tracking-wider text-red-450">Link Unreachable / Private</span>
        <span className="block text-[10px] font-bold text-slate-400 mt-0.5 leading-tight">Please check your profile link or set it to Public.</span>
      </div>
    </div>
  );
}
