import { useState, useEffect } from "react";

export interface WidgetVisibilitySettings {
  featureBadges: boolean;
  qualityFilter: boolean;
  chathead: boolean;
  liveTicker: boolean;
}

const DEFAULTS: WidgetVisibilitySettings = {
  featureBadges: true,
  qualityFilter: true,
  chathead: true,
  liveTicker: true,
};

let cached: WidgetVisibilitySettings | null = null;
let fetching: Promise<WidgetVisibilitySettings> | null = null;
const WIDGET_VISIBILITY_EVENT = "widget-visibility-updated";

async function fetchWidgetVisibility() {
  const response = await fetch("/api/widget-visibility", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load widget visibility");
  }

  const data = await response.json();
  cached = {
    featureBadges: data.featureBadges !== false,
    qualityFilter: data.qualityFilter !== false,
    chathead: data.chathead !== false,
    liveTicker: data.liveTicker !== false,
  };
  return cached;
}

export function notifyWidgetVisibilityChanged() {
  cached = null;

  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(WIDGET_VISIBILITY_EVENT));
  try {
    window.localStorage.setItem(WIDGET_VISIBILITY_EVENT, String(Date.now()));
  } catch {
    // Ignore private browsing/storage-disabled environments.
  }
}

export function useWidgetVisibility(): WidgetVisibilitySettings {
  const [settings, setSettings] = useState<WidgetVisibilitySettings>(cached || DEFAULTS);

  useEffect(() => {
    let mounted = true;

    const load = () => {
      if (!fetching) {
        fetching = fetchWidgetVisibility()
          .catch(() => cached || DEFAULTS)
          .finally(() => {
            fetching = null;
          });
      }

      fetching.then((nextSettings) => {
        if (mounted) setSettings(nextSettings);
      });
    };

    load();
    const interval = window.setInterval(load, 30000);
    const handleVisibilityChange = () => load();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === WIDGET_VISIBILITY_EVENT) load();
    };

    window.addEventListener(WIDGET_VISIBILITY_EVENT, handleVisibilityChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener(WIDGET_VISIBILITY_EVENT, handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return settings;
}
