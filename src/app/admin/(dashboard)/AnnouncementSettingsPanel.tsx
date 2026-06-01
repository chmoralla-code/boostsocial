"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Megaphone, Power, Save, XCircle } from "lucide-react";

type AnnouncementSettings = {
  enabled: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  version: string;
};

export function AnnouncementSettingsPanel() {
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionHref, setActionHref] = useState("");
  const [version, setVersion] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const getErrorMessage = (err: unknown, fallback: string) => {
    return err instanceof Error ? err.message : fallback;
  };

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/announcement-settings");
        const data = (await res.json()) as AnnouncementSettings & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Failed to load announcement settings");
        }

        if (ignore) {
          return;
        }

        setEnabled(!!data.enabled);
        setTitle(data.title || "");
        setMessage(data.message || "");
        setActionLabel(data.actionLabel || "");
        setActionHref(data.actionHref || "");
        setVersion(data.version || "");
      } catch (err: unknown) {
        console.error(err);
        if (!ignore) {
          setResult({ success: false, message: "Failed to fetch announcement settings." });
        }
      } finally {
        if (!ignore) {
          setFetching(false);
        }
      }
    }

    void loadSettings();

    return () => {
      ignore = true;
    };
  }, []);

  const saveSettings = async (nextEnabled = enabled, refreshVersion = false) => {
    setSaving(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/announcement-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          title,
          message,
          actionLabel,
          actionHref,
          refreshVersion,
        }),
      });
      const data = (await res.json()) as AnnouncementSettings & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to save announcement settings");
      }

      setEnabled(!!data.enabled);
      setTitle(data.title || "");
      setMessage(data.message || "");
      setActionLabel(data.actionLabel || "");
      setActionHref(data.actionHref || "");
      setVersion(data.version || "");
      setResult({
        success: true,
        message: data.enabled
          ? "ANNOUNCE is live. Clients will see it once in the center of the website."
          : "ANNOUNCE is off. Clients will no longer see the announcement.",
      });
    } catch (err: unknown) {
      setResult({ success: false, message: getErrorMessage(err, "Failed to save announcement.") });
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-850/85 bg-[#181818] p-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs font-semibold text-slate-400">Loading ANNOUNCE settings...</span>
      </div>
    );
  }

  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-slate-850/80 bg-[#181818] p-6 text-white shadow-md">
      <div className={`absolute right-0 top-0 h-32 w-32 rounded-full blur-2xl ${enabled ? "bg-[#1DB954]/10" : "bg-slate-700/10"}`} />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 border-b border-slate-850/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/10 text-[#1DB954]">
              <Megaphone size={20} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white">Client Center Announcement</h2>
              <p className="mt-0.5 max-w-xl text-xs font-semibold leading-relaxed text-slate-400">
                Toggle ANNOUNCE to show a centered announcement one time per visitor across the client website.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => saveSettings(!enabled)}
            disabled={saving}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-60 ${
              enabled
                ? "bg-[#1DB954] text-black hover:bg-[#1ed760]"
                : "border border-slate-700 bg-slate-900 text-slate-200 hover:border-[#1DB954]/40 hover:text-white"
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
            ANNOUNCE {enabled ? "On" : "Off"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Announcement Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-850 bg-[#121212] px-4 py-3 text-xs font-bold text-white outline-none transition focus:border-[#1DB954]"
              placeholder="Important Announcement"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Announcement Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-850 bg-[#121212] px-4 py-3 text-xs font-bold leading-relaxed text-white outline-none transition focus:border-[#1DB954]"
              placeholder="Write the announcement clients should see."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Optional Button Text</label>
              <input
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                className="w-full rounded-xl border border-slate-850 bg-[#121212] px-4 py-3 text-xs font-bold text-white outline-none transition focus:border-[#1DB954]"
                placeholder="Order Now"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Optional Button Link</label>
              <input
                value={actionHref}
                onChange={(e) => setActionHref(e.target.value)}
                className="w-full rounded-xl border border-slate-850 bg-[#121212] px-4 py-3 text-xs font-bold text-white outline-none transition focus:border-[#1DB954]"
                placeholder="/#services"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => saveSettings(enabled, enabled)}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:bg-slate-850 disabled:text-slate-550"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Announcement
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Version: {version || "not published yet"}
          </span>
        </div>

        {result && (
          <div
            className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-left text-xs font-semibold leading-relaxed ${
              result.success
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {result.success ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
