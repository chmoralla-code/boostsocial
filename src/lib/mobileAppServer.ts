import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MOBILE_APP_SETTINGS_KEY,
  MobileAppSettings,
  nextMajorVersion,
  normalizeMobileAppSettings,
} from "@/lib/mobileApp";
import { fallbackRead, syncBackupAdminClients } from "@/utils/supabase/dual-db";

export async function readMobileAppSettingsFromAnyDatabase() {
  const { data } = await fallbackRead<{ value: unknown }>(async (client) =>
    await client
      .from("settings")
      .select("value")
      .eq("key", MOBILE_APP_SETTINGS_KEY)
      .single()
  );

  return normalizeMobileAppSettings(data?.value);
}

export async function readMobileAppSettings(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", MOBILE_APP_SETTINGS_KEY)
    .single();

  return normalizeMobileAppSettings(data?.value);
}

export async function writeMobileAppSettings(
  supabase: SupabaseClient,
  settings: MobileAppSettings
) {
  const now = new Date().toISOString();
  const valueObj = {
    ...settings,
    updatedAt: now,
  };

  const { error } = await supabase
    .from("settings")
    .upsert(
      { key: MOBILE_APP_SETTINGS_KEY, value: valueObj, updated_at: now },
      { onConflict: "key" }
    );

  if (error) throw error;

  await syncBackupAdminClients(async (backupClient) => {
    await backupClient
      .from("settings")
      .upsert(
        { key: MOBILE_APP_SETTINGS_KEY, value: valueObj, updated_at: now },
        { onConflict: "key" }
      );
  }, "mobile app settings upsert sync");

  return valueObj;
}

export async function publishMobileAppUpdate(
  supabase: SupabaseClient,
  reason = "Website or app content changed.",
  forceIncrement = false
) {
  const existing = await readMobileAppSettings(supabase);
  const now = new Date().toISOString();
  const shouldIncrement = forceIncrement || !existing.updateAvailable;
  const nextVersion = shouldIncrement
    ? nextMajorVersion(existing.latestVersion || existing.appVersion)
    : existing.latestVersion;

  return writeMobileAppSettings(supabase, {
    ...existing,
    latestVersion: nextVersion,
    updateAvailable: true,
    updateMessage: reason || existing.updateMessage,
    updatedAt: now,
    lastPublishedAt: now,
  });
}
