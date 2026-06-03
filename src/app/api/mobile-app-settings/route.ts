import { NextResponse } from "next/server";
import { DEFAULT_MOBILE_APP_SETTINGS } from "@/lib/mobileApp";
import { readMobileAppSettingsFromAnyDatabase } from "@/lib/mobileAppServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await readMobileAppSettingsFromAnyDatabase();
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("GET mobile app settings error:", err);
    return NextResponse.json(
      DEFAULT_MOBILE_APP_SETTINGS,
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
