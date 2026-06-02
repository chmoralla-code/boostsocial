import { NextResponse } from "next/server";
import { fallbackRead } from "@/utils/supabase/dual-db";

export const dynamic = "force-dynamic";

const WIDGET_VISIBILITY_KEY = "widget_visibility";

const DEFAULT_VISIBILITY = {
  featureBadges: true,
  qualityFilter: true,
  chathead: true,
  liveTicker: true,
};

export async function GET() {
  try {
    const { data, error } = await fallbackRead<{ value: unknown }>(async (client) =>
      await client
        .from("settings")
        .select("value")
        .eq("key", WIDGET_VISIBILITY_KEY)
        .single()
    );

    if (error || !data) {
      return NextResponse.json(
        DEFAULT_VISIBILITY,
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const value = (data.value as Record<string, boolean>) || {};
    return NextResponse.json(
      {
        featureBadges: value.featureBadges !== false,
        qualityFilter: value.qualityFilter !== false,
        chathead: value.chathead !== false,
        liveTicker: value.liveTicker !== false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET widget-visibility error:", err);
    return NextResponse.json(
      DEFAULT_VISIBILITY,
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
