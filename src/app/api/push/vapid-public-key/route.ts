import { NextResponse } from "next/server";
import { getPrimaryAdminClient } from "@/utils/supabase/dual-db";
import { getVapidPublicKey } from "@/lib/webPush";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKey = await getVapidPublicKey(getPrimaryAdminClient());
    return NextResponse.json({
      enabled: Boolean(publicKey),
      publicKey,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Push public key lookup failed:", error);
    return NextResponse.json({
      enabled: false,
      publicKey: "",
      error: "Push notifications are not configured yet.",
    }, { status: 503 });
  }
}
