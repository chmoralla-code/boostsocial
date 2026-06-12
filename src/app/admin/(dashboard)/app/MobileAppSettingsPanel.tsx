"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  Loader2,
  Moon,
  Power,
  RefreshCw,
  Save,
  Smartphone,
  Sun,
  XCircle,
} from "lucide-react";
import type { MobileAppSettings, MobileAppTheme } from "@/lib/mobileApp";

type SaveResult = {
  success: boolean;
  message: string;
};

const EMPTY_SETTINGS: MobileAppSettings = {
  appVersion: "1.0",
  latestVersion: "1.0",
  updateAvailable: false,
  appName: "PinoyBoosting",
  appSubtitle: "Simple mobile app",
  heroTitle: "Choose a service",
  heroDescription: "Pick what you need, add your link, then track the order. No extra website effects inside the APK.",
  appBanner: "Fastest services are shown first. Login before buying so your orders stay saved.",
  updateMessage: "New app content is ready. Tap Update to refresh your APK view.",
  updateHistory: "1.0 - Initial APK app release with services, wallet, orders, dark mode, and AI help.",
  defaultTheme: "light",
  updatedAt: "",
  lastPublishedAt: "",
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function MobileAppSettingsPanel() {
  const [settings, setSettings] = useState<MobileAppSettings>(EMPTY_SETTINGS);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/mobile-app-settings", { cache: "no-store" });
        const data = (await res.json()) as MobileAppSettings & { error?: string };

        if (!res.ok) {
          throw new Error(data.error || "Failed to load mobile app settings");
        }

        if (!ignore) {
          setSettings(data);
        }
      } catch (err: unknown) {
        console.error(err);
        if (!ignore) {
          setResult({ success: false, message: "Failed to fetch mobile app settings." });
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

  const updateField = (key: keyof MobileAppSettings, value: string | boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const submitSettings = async (action: "save" | "publish_update" | "mark_up_to_date") => {
    setSaving(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/mobile-app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, action }),
      });
      const data = (await res.json()) as MobileAppSettings & { error?: string; contentChanged?: boolean };

      if (!res.ok) {
        throw new Error(data.error || "Failed to save mobile app settings");
      }

      setSettings(data);

      const message =
        action === "mark_up_to_date"
          ? `APK marked up to date at version ${data.appVersion}.`
          : action === "publish_update"
            ? `Update is now visible as version ${data.latestVersion}.`
            : data.contentChanged
              ? `App edits saved and update version ${data.latestVersion} is now visible.`
              : "App settings saved. No new update was needed.";

      setResult({ success: true, message });
    } catch (err: unknown) {
      setResult({ success: false, message: getErrorMessage(err, "Failed to save mobile app settings.") });
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs font-semibold text-muted">Loading mobile app dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <VersionCard label="Current APK" value={settings.appVersion} active={!settings.updateAvailable} />
        <VersionCard label="Latest Version" value={settings.latestVersion} active={settings.updateAvailable} />
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Update Status</p>
              <h2 className={`mt-2 text-xl font-black ${settings.updateAvailable ? "text-amber-300" : "text-[#1DB954]"}`}>
                {settings.updateAvailable ? "Update shown" : "Up to date"}
              </h2>
            </div>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
              settings.updateAvailable
                ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                : "border-[#1DB954]/20 bg-[#1DB954]/10 text-[#1DB954]"
            }`}>
              <Power size={20} />
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-muted">
            Saving changed app content automatically bumps 1.0 to 2.0, 2.0 to 3.0, and so on.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 text-fg shadow-md sm:p-5">
        <div className="mb-5 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/10 text-[#1DB954]">
              <Smartphone size={22} />
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight text-fg">APK App Editor</h2>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-muted">
                These fields control the simplified `/app` screen used by the APK. Services still come from the main services database.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => submitSettings("mark_up_to_date")}
            disabled={saving || !settings.updateAvailable}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-elevated px-5 py-3 text-xs font-black uppercase tracking-wider text-fg transition hover:border-[#1DB954]/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle size={14} />
            Mark Up To Date
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TextField label="App Name" value={settings.appName} onChange={(value) => updateField("appName", value)} />
          <TextField label="Subtitle" value={settings.appSubtitle} onChange={(value) => updateField("appSubtitle", value)} />
          <TextField label="Main Heading" value={settings.heroTitle} onChange={(value) => updateField("heroTitle", value)} />
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted">Default Theme</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-elevated p-1">
              {(["light", "dark"] as MobileAppTheme[]).map((theme) => {
                const Icon = theme === "light" ? Sun : Moon;
                const active = settings.defaultTheme === theme;

                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => updateField("defaultTheme", theme)}
                    className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                      active ? "bg-[#1DB954] text-black" : "text-muted hover:text-fg"
                    }`}
                  >
                    <Icon size={14} />
                    {theme}
                  </button>
                );
              })}
            </div>
          </div>

          <TextAreaField
            label="Intro Description"
            value={settings.heroDescription}
            onChange={(value) => updateField("heroDescription", value)}
          />
          <TextAreaField
            label="App Banner"
            value={settings.appBanner}
            onChange={(value) => updateField("appBanner", value)}
          />
          <TextAreaField
            label="Update Message"
            value={settings.updateMessage}
            onChange={(value) => updateField("updateMessage", value)}
          />
          <TextAreaField
            label="Version History"
            value={settings.updateHistory}
            onChange={(value) => updateField("updateHistory", value)}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => submitSettings("save")}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save App Settings
          </button>
          <button
            type="button"
            onClick={() => submitSettings("publish_update")}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-amber-600 transition hover:border-amber-500/50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} />
            Publish New Version
          </button>
        </div>

        {result && (
          <div
            className={`mt-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-left text-xs font-semibold leading-relaxed ${
              result.success
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                : "border-red-500/20 bg-red-500/10 text-red-500"
            }`}
          >
            {result.success ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function VersionCard({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${
      active ? "border-[#1DB954]/25 bg-[#1DB954]/10" : "border-border bg-card"
    }`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-black ${active ? "text-[#1DB954]" : "text-fg"}`}>v{value}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border bg-elevated px-4 py-3 text-xs font-bold text-fg outline-none transition focus:border-[#1DB954]"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-border bg-elevated px-4 py-3 text-xs font-bold leading-relaxed text-fg outline-none transition focus:border-[#1DB954]"
      />
    </div>
  );
}
