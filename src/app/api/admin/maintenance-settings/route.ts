import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Helper to check if the user is a logged-in administrator
async function checkAdminAuth() {
  const supabase = await createClient();
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
      .eq("key", "maintenance_mode")
      .single();

    if (error || !data) {
      return NextResponse.json({ enabled: false });
    }

    const value = data.value as { enabled?: boolean };
    return NextResponse.json({ enabled: !!value?.enabled });
  } catch (err: any) {
    console.error("GET maintenance settings error:", err);
    return NextResponse.json({ enabled: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const enabled = !!body.enabled;

    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: "maintenance_mode", value: { enabled }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, enabled });
  } catch (err: any) {
    console.error("POST maintenance settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
