import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  didMobileAppContentChange,
  nextMajorVersion,
  normalizeMobileAppSettings,
} from "@/lib/mobileApp";
import {
  readMobileAppSettings,
  writeMobileAppSettings,
} from "@/lib/mobileAppServer";

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

export async function GET() {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await readMobileAppSettings(supabase);
    return NextResponse.json(settings);
  } catch (err: unknown) {
    console.error("GET mobile app admin settings error:", err);
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
    const existing = await readMobileAppSettings(supabase);
    const now = new Date().toISOString();
    const action = typeof body.action === "string" ? body.action : "save";

    if (action === "mark_up_to_date") {
      const saved = await writeMobileAppSettings(supabase, {
        ...existing,
        appVersion: existing.latestVersion,
        updateAvailable: false,
        updatedAt: now,
      });
      return NextResponse.json({ success: true, ...saved });
    }

    if (action === "publish_update") {
      const nextVersion = nextMajorVersion(existing.latestVersion || existing.appVersion);
      const saved = await writeMobileAppSettings(supabase, {
        ...existing,
        latestVersion: nextVersion,
        updateAvailable: true,
        updateMessage: body.updateMessage || existing.updateMessage,
        updatedAt: now,
        lastPublishedAt: now,
      });
      return NextResponse.json({ success: true, ...saved });
    }

    const submitted = normalizeMobileAppSettings({
      ...existing,
      appName: body.appName,
      appSubtitle: body.appSubtitle,
      heroTitle: body.heroTitle,
      heroDescription: body.heroDescription,
      updateMessage: body.updateMessage,
      defaultTheme: body.defaultTheme,
      updatedAt: now,
    });

    const contentChanged = didMobileAppContentChange(submitted, existing);
    const nextVersion =
      contentChanged && !existing.updateAvailable
        ? nextMajorVersion(existing.latestVersion || existing.appVersion)
        : existing.latestVersion;

    const saved = await writeMobileAppSettings(supabase, {
      ...submitted,
      appVersion: existing.appVersion,
      latestVersion: nextVersion,
      updateAvailable: contentChanged ? true : existing.updateAvailable,
      lastPublishedAt: contentChanged ? now : existing.lastPublishedAt,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, contentChanged, ...saved });
  } catch (err: unknown) {
    console.error("POST mobile app admin settings error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
