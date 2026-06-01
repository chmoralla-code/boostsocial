export type AnnouncementSettings = {
  enabled: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  version: string;
  updatedAt?: string;
};

export const ANNOUNCEMENT_SETTINGS_KEY = "client_announcement";

export const DEFAULT_ANNOUNCEMENT_SETTINGS: AnnouncementSettings = {
  enabled: false,
  title: "Important Announcement",
  message: "Please check this announcement before continuing.",
  actionLabel: "",
  actionHref: "",
  version: "default",
};

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanHref(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/") || trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed.slice(0, 300);
  }

  return "";
}

export function normalizeAnnouncementSettings(value: unknown): AnnouncementSettings {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    enabled: !!source.enabled,
    title: cleanText(source.title, DEFAULT_ANNOUNCEMENT_SETTINGS.title, 90),
    message: cleanText(source.message, DEFAULT_ANNOUNCEMENT_SETTINGS.message, 700),
    actionLabel: cleanOptionalText(source.actionLabel, 36),
    actionHref: cleanHref(source.actionHref),
    version: cleanText(source.version, DEFAULT_ANNOUNCEMENT_SETTINGS.version, 80),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
  };
}

export function makeAnnouncementVersion() {
  return new Date().toISOString();
}
