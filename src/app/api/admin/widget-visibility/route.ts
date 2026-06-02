import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

const WIDGET_VISIBILITY_KEY = "widget_visibility";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function checkAdminAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false, supabase: null };
  }

  return { authenticated: true, supabase };
}

async function readExistingSettings(supabase: NonNullable<Awaited<ReturnType<typeof checkAdminAuth>>["supabase"]>) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", WIDGET_VISIBILITY_KEY)
    .single();

  const value = (data?.value as Record<string, boolean>) || {};
  return {
    featureBadges: value.featureBadges !== false,
    qualityFilter: value.qualityFilter !== false,
    chathead: value.chathead !== false,
    liveTicker: value.liveTicker !== false,
  };
}

export async function GET() {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await readExistingSettings(supabase);
    return NextResponse.json(settings);
  } catch (err: unknown) {
    console.error("GET widget-visibility error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const now = new Date().toISOString();

    const valueObj = {
      featureBadges: !!body.featureBadges,
      qualityFilter: !!body.qualityFilter,
      chathead: !!body.chathead,
      liveTicker: !!body.liveTicker,
      updatedAt: now,
    };

    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: WIDGET_VISIBILITY_KEY, value: valueObj, updated_at: now },
        { onConflict: "key" }
      );

    if (error) {
      throw error;
    }

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("settings")
        .upsert(
          { key: WIDGET_VISIBILITY_KEY, value: valueObj, updated_at: now },
          { onConflict: "key" }
        );
    }, "widget visibility upsert sync");

    return NextResponse.json({ success: true, ...valueObj });
  } catch (err: unknown) {
    console.error("POST widget-visibility error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
