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

  const liveUrl = preview?.finalUrl || previewUrl;
  const checkedAt = formatCheckedAt(preview?.checkedAt);
  const canEmbed = Boolean(preview?.reachable && preview.embeddable);
  const serviceLabel = serviceTitle || "Target";

  return (
    <section className="bg-[#181818]/60 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1877F2]/50 to-transparent" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#1877F2] flex items-center gap-1.5">
            <MonitorUp size={13} /> Live Target Preview
          </span>
          <h4 className="text-lg font-black text-white leading-tight">{serviceLabel}</h4>
          <p className="text-[11px] text-slate-450 font-mono break-all">{liveUrl}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${
              loading
                ? "bg-slate-800/80 text-slate-300 border-slate-700"
                : preview?.reachable
                  ? "bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/25"
                  : "bg-red-500/10 text-red-400 border-red-500/25"
            }`}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : preview?.reachable ? (
              <CheckCircle2 size={12} />
            ) : (
              <AlertCircle size={12} />
            )}
            {loading ? "Checking" : preview?.reachable ? "Live" : "Check"}
          </span>

          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="h-9 w-9 rounded-xl bg-[#121212] border border-slate-800/80 text-slate-300 hover:text-white hover:border-[#1877F2]/50 transition-all flex items-center justify-center disabled:opacity-50"
            title="Refresh preview"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 w-9 rounded-xl bg-[#1877F2] hover:bg-[#4e8df5] text-white transition-all flex items-center justify-center shadow-lg shadow-blue-500/20"
            title="Open target"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-[#0f0f0f] overflow-hidden min-h-[300px] relative">
        <div className="h-9 border-b border-slate-800/80 bg-[#151515] flex items-center justify-between px-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff9800]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2]/80" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {checkedAt ? `Checked ${checkedAt}` : "Target Window"}
          </span>
        </div>

        {canEmbed ? (
          <div className="relative h-[360px] bg-white">
            {!frameReady && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#121212] text-center px-6">
                <Loader2 className="animate-spin text-[#1877F2] mb-3" size={26} />
                <span className="text-xs font-black uppercase tracking-widest text-white">
                  Loading Preview
                </span>
              </div>
            )}

            {frameTimedOut && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#121212]/95 text-center px-6">
                <AlertCircle className="text-[#ff9800] mb-3" size={28} />
                <span className="text-xs font-black uppercase tracking-widest text-white">
                  Preview Delayed
                </span>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#4e8df5] text-white text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Open Target <ExternalLink size={12} />
                </a>
              </div>
            )}

            <iframe
              key={frameKey}
              src={liveUrl}
              title="Live target preview"
              className="w-full h-full bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setFrameReady(true)}
            />
          </div>
        ) : (
          <div className="min-h-[300px] flex flex-col justify-center p-5 sm:p-7 relative">
            {preview?.image && (
              <div
                className="absolute inset-0 opacity-20 bg-cover bg-center"
                style={{ backgroundImage: `url(${preview.image})` }}
              />
            )}
            <div className="relative z-10 max-w-lg">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest mb-4 ${
                  preview?.reachable
                    ? "bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/25"
                    : "bg-red-500/10 text-red-400 border-red-500/25"
                }`}
              >
                {preview?.reachable ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                {preview?.status ? `HTTP ${preview.status}` : "Unavailable"}
              </span>

              <h5 className="text-xl font-black text-white leading-tight mb-2">
                {preview?.title || new URL(previewUrl).hostname}
              </h5>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold mb-5">
                {preview?.description || preview?.reason || "Open the target link to view the live page."}
              </p>

              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1877F2] hover:bg-[#4e8df5] text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20"
              >
                Open Target <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
