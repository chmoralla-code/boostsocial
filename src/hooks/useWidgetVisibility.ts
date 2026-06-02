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

export function useWidgetVisibility(): WidgetVisibilitySettings {
  const [settings, setSettings] = useState<WidgetVisibilitySettings>(cached || DEFAULTS);

  useEffect(() => {
    let mounted = true;
    if (cached) { setSettings(cached); return; }
    if (!fetching) {
      fetching = fetch("/api/widget-visibility")
        .then(r => r.json())
        .then((data: WidgetVisibilitySettings) => { cached = data; return data; })
        .catch(() => DEFAULTS);
    }
    fetching.then(s => { if (mounted) setSettings(s); });
    return () => { mounted = false; };
  }, []);

  return settings;
}