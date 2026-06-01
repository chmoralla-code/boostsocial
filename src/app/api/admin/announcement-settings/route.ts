import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import {
  ANNOUNCEMENT_SETTINGS_KEY,
  makeAnnouncementVersion,
  normalizeAnnouncementSettings,
} from "@/lib/announcement";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function checkAdminAuth() {
  const supabase = await createServerClient();
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
    .eq("key", ANNOUNCEMENT_SETTINGS_KEY)
    .single();

  return normalizeAnnouncementSettings(data?.value);
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
    console.error("GET announcement settings error:", err);
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
    const existing = await readExistingSettings(supabase);
    const now = new Date().toISOString();

    const submitted = normalizeAnnouncementSettings({
      enabled: body.enabled,
      title: body.title,
      message: body.message,
      actionLabel: body.actionLabel,
      actionHref: body.actionHref,
      version: existing.version,
      updatedAt: now,
    });

    const contentChanged =
      submitted.title !== existing.title ||
      submitted.message !== existing.message ||
      submitted.actionLabel !== existing.actionLabel ||
      submitted.actionHref !== existing.actionHref;

    const valueObj = {
      ...submitted,
      version:
        submitted.enabled && (!existing.enabled || contentChanged || body.refreshVersion)
          ? makeAnnouncementVersion()
          : existing.version,
      updatedAt: now,
    };

    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: ANNOUNCEMENT_SETTINGS_KEY, value: valueObj, updated_at: now },
        { onConflict: "key" }
      );

    if (error) {
      throw error;
    }

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("settings")
        .upsert(
          { key: ANNOUNCEMENT_SETTINGS_KEY, value: valueObj, updated_at: now },
          { onConflict: "key" }
        );
    }, "client announcement upsert sync");

    return NextResponse.json({ success: true, ...valueObj });
  } catch (err: unknown) {
    console.error("POST announcement settings error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
