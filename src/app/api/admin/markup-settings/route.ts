import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { resetMarkupCache } from "@/lib/markupConfig";

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false, supabase: null };
  }
  return { authenticated: true, supabase };
}

export async function GET() {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "markup_config")
      .single();

    if (error || !data) {
      return NextResponse.json({ markupMultiplier: 3.0 });
    }

    return NextResponse.json(data.value);
  } catch (err: any) {
    console.error("GET markup settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 550 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const markupMultiplier = Number(body.markupMultiplier);

    if (!isFinite(markupMultiplier) || markupMultiplier < 1 || markupMultiplier > 10) {
      return NextResponse.json({ error: "Multiplier must be between 1 and 10." }, { status: 400 });
    }

    const valueObj = { markupMultiplier };

    const { error: primaryErr } = await supabase
      .from("settings")
      .upsert(
        { key: "markup_config", value: valueObj, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (primaryErr) throw primaryErr;

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("settings")
        .upsert(
          { key: "markup_config", value: valueObj, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
    }, "markup_config upsert sync");

    // Clear in-memory cache so next request picks up the new value
    resetMarkupCache();

    return NextResponse.json({ success: true, markupMultiplier });
  } catch (err: any) {
    console.error("POST markup settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
