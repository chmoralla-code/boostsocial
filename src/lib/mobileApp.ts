export const MOBILE_APP_SETTINGS_KEY = "mobile_app_settings";
export const MOBILE_APP_LOCAL_VERSION_KEY = "pinoyboosting:app-version";

export type MobileAppTheme = "light" | "dark";

export type MobileAppSettings = {
  appVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  appName: string;
  appSubtitle: string;
  heroTitle: string;
  heroDescription: string;
  updateMessage: string;
  defaultTheme: MobileAppTheme;
  updatedAt: string;
  lastPublishedAt: string;
};

export const DEFAULT_MOBILE_APP_SETTINGS: MobileAppSettings = {
  appVersion: "1.0",
  latestVersion: "1.0",
  updateAvailable: false,
  appName: "PinoyBoosting",
  appSubtitle: "Simple mobile app",
  heroTitle: "Choose a service",
  heroDescription: "Pick what you need, add your link, then track the order. No extra website effects inside the APK.",
  updateMessage: "New app content is ready. Tap Update to refresh your APK view.",
  defaultTheme: "light",
  updatedAt: "",
  lastPublishedAt: "",
};

function stringValue(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function themeValue(value: unknown): MobileAppTheme {
  return value === "dark" ? "dark" : "light";
}

export function nextMajorVersion(version: string) {
  const major = Number.parseInt(String(version || "1.0").split(".")[0], 10);
  const nextMajor = Number.isFinite(major) && major > 0 ? major + 1 : 2;
  return `${nextMajor}.0`;
}

export function normalizeMobileAppSettings(value: unknown): MobileAppSettings {
  const input = value && typeof value === "object" ? (value as Partial<MobileAppSettings>) : {};
  const appVersion = stringValue(input.appVersion, DEFAULT_MOBILE_APP_SETTINGS.appVersion);
  const latestVersion = stringValue(input.latestVersion, appVersion);

  return {
    appVersion,
    latestVersion,
    updateAvailable: booleanValue(input.updateAvailable, appVersion !== latestVersion),
    appName: stringValue(input.appName, DEFAULT_MOBILE_APP_SETTINGS.appName),
    appSubtitle: stringValue(input.appSubtitle, DEFAULT_MOBILE_APP_SETTINGS.appSubtitle),
    heroTitle: stringValue(input.heroTitle, DEFAULT_MOBILE_APP_SETTINGS.heroTitle),
    heroDescription: stringValue(input.heroDescription, DEFAULT_MOBILE_APP_SETTINGS.heroDescription),
    updateMessage: stringValue(input.updateMessage, DEFAULT_MOBILE_APP_SETTINGS.updateMessage),
    defaultTheme: themeValue(input.defaultTheme),
    updatedAt: stringValue(input.updatedAt, ""),
    lastPublishedAt: stringValue(input.lastPublishedAt, ""),
  };
}

export function didMobileAppContentChange(
  next: MobileAppSettings,
  previous: MobileAppSettings
) {
  return (
    next.appName !== previous.appName ||
    next.appSubtitle !== previous.appSubtitle ||
    next.heroTitle !== previous.heroTitle ||
    next.heroDescription !== previous.heroDescription ||
    next.updateMessage !== previous.updateMessage ||
    next.defaultTheme !== previous.defaultTheme
  );
}
