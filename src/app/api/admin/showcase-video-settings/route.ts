import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

const CONFIG_BUCKET = "receipts";
const SETTING_KEY = "service_showcase";

const DEFAULT_CONFIG = {
  videoUrl: "/hero-bg.mp4",
  posterUrl: "",
  title: "Real Service Delivery Samples",
  badge: "Legit & Fast"
};

type ShowcaseConfig = {
  videoUrl?: string | null;
  posterUrl?: string | null;
  title?: string | null;
  badge?: string | null;
};

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false, supabase: null };
  }

  return { authenticated: true, supabase };
}

const getEnv = (key: string) => {
  const value = process.env[key]?.trim();
  return value && value !== "\"\"" ? value : undefined;
};

const getStorageSupabase = (fallbackSupabase: any) => {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  }

  return fallbackSupabase;
};

const normalizeConfig = (config?: ShowcaseConfig | null) => ({
  videoUrl: config?.videoUrl?.trim() || DEFAULT_CONFIG.videoUrl,
  posterUrl: config?.posterUrl?.trim() || "",
  title: config?.title?.trim() || DEFAULT_CONFIG.title,
  badge: config?.badge?.trim() || DEFAULT_CONFIG.badge
});

async function saveShowcaseConfig(supabase: any, config: ReturnType<typeof normalizeConfig>) {
  const payload = {
    key: SETTING_KEY,
    value: config,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("settings")
    .upsert(payload, { onConflict: "key" });

  if (error) throw error;

  await syncBackupAdminClients(async (backupClient) => {
    await backupClient
      .from("settings")
      .upsert(payload, { onConflict: "key" });
  }, "service_showcase upsert sync");
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
      .eq("key", SETTING_KEY)
      .single();

    if (error || !data) {
      return NextResponse.json(DEFAULT_CONFIG);
    }

    return NextResponse.json(normalizeConfig(data.value));
  } catch (err: any) {
    console.error("GET showcase video settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const action = formData.get("action") as string | null;
    const isReset = formData.get("reset") === "true";

    if (isReset || action === "reset") {
      const resetConfig = normalizeConfig(DEFAULT_CONFIG);
      await saveShowcaseConfig(supabase, resetConfig);
      return NextResponse.json({ success: true, ...resetConfig });
    }

    if (action === "get_upload_url") {
      const clientFileName = formData.get("fileName") as string | null;
      const clientFileType = formData.get("fileType") as string | null;

      if (!clientFileName || !clientFileType) {
        return NextResponse.json({ error: "Missing fileName or fileType" }, { status: 400 });
      }

      if (!clientFileType.startsWith("video/")) {
        return NextResponse.json({ error: "Invalid file type. Please upload an MP4 or other browser-playable video." }, { status: 400 });
      }

      const fileExt = clientFileName.split(".").pop()?.toLowerCase() || "mp4";
      const storagePath = `admin-config/service-showcase-${Date.now()}.${fileExt}`;
      const storageSupabase = getStorageSupabase(supabase);

      const { data, error } = await storageSupabase.storage
        .from(CONFIG_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });

      if (error || !data) {
        throw error || new Error("Failed to generate signed upload URL");
      }

      const publicUrl = `${getEnv("NEXT_PUBLIC_SUPABASE_URL")}/storage/v1/object/public/${CONFIG_BUCKET}/${storagePath}`;

      return NextResponse.json({
        success: true,
        signedUrl: data.signedUrl,
        path: data.path,
        token: data.token,
        publicUrl
      });
    }

    if (action === "finalize" || action === "save") {
      const finalConfig = normalizeConfig({
        videoUrl: formData.get("videoUrl") as string | null,
        posterUrl: formData.get("posterUrl") as string | null,
        title: formData.get("title") as string | null,
        badge: formData.get("badge") as string | null
      });

      await saveShowcaseConfig(supabase, finalConfig);
      return NextResponse.json({ success: true, ...finalConfig });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST showcase video settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
