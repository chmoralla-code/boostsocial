import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

// Helper to check if the user is a logged-in administrator
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
      .eq("key", "hero_text")
      .single();

    if (error || !data) {
      // Return default values
      return NextResponse.json({
        badge: "⚡ Next-Gen Amplification Engine",
        title: "MAS BARATO PA SA \n[FACEBOOK] {BOOSTING} SERVICES !",
        description: "Don't worry about transparency—we deliver 50 free trial followers, reactions, or views so you can test our service before paying fully!"
      });
    }

    return NextResponse.json(data.value);
  } catch (err: any) {
    console.error("GET hero-text settings error:", err);
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
    const { badge, title, description } = body;

    const valueObj = {
      badge: badge || "⚡ Next-Gen Amplification Engine",
      title: title || "MAS BARATO PA SA \n[FACEBOOK] {BOOSTING} SERVICES !",
      description: description || "Don't worry about transparency—we deliver 50 free trial followers, reactions, or views so you can test our service before paying fully!"
    };

    // 1. Save to Primary Database
    const { error: primaryErr } = await supabase
      .from("settings")
      .upsert(
        { key: "hero_text", value: valueObj, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (primaryErr) throw primaryErr;

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("settings")
        .upsert(
          { key: "hero_text", value: valueObj, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
    }, "hero_text upsert sync");

    return NextResponse.json({ success: true, ...valueObj });
  } catch (err: any) {
    console.error("POST hero-text settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
