import { NextResponse } from "next/server";
import {
  ANNOUNCEMENT_SETTINGS_KEY,
  normalizeAnnouncementSettings,
} from "@/lib/announcement";
import { fallbackRead } from "@/utils/supabase/dual-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await fallbackRead<{ value: unknown }>(async (client) =>
      await client
        .from("settings")
        .select("value")
        .eq("key", ANNOUNCEMENT_SETTINGS_KEY)
        .single()
    );

    if (error || !data) {
      return NextResponse.json(
        { enabled: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const settings = normalizeAnnouncementSettings(data.value);
    if (!settings.enabled || !settings.message) {
      return NextResponse.json(
        { enabled: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        enabled: true,
        title: settings.title,
        message: settings.message,
        actionLabel: settings.actionLabel,
        actionHref: settings.actionHref,
        version: settings.version,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET public announcement error:", err);
    return NextResponse.json(
      { enabled: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
