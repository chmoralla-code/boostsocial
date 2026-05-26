import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts";

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
      .eq("key", "services_bg_settings")
      .single();

    if (error || !data) {
      return NextResponse.json({ videoUrl: "", opacity: 0.15 });
    }

    return NextResponse.json(data.value);
  } catch (err: any) {
    console.error("GET services bg settings error:", err);
    return NextResponse.json({ videoUrl: "", opacity: 0.15 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try parsing as JSON first (for save/finalize), then fallback to FormData for uploads
    let body: any = {};
    let isFormData = false;
    
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      isFormData = true;
      const formData = await req.formData();
      body = {
        action: formData.get("action") as string | null,
        reset: formData.get("reset") === "true",
        fileName: formData.get("fileName") as string | null,
        fileType: formData.get("fileType") as string | null,
        videoUrl: formData.get("videoUrl") as string | null,
        opacity: formData.get("opacity") as string | null,
      };
    }

    const backupUrl = process.env.BACKUP_SUPABASE_URL;
    const backupKey = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;
    const backupSupabase = backupUrl && backupKey
      ? createClient(backupUrl, backupKey, { auth: { persistSession: false } })
      : null;

    // 1. Reset Action
    if (body.reset || body.action === "reset") {
      const resetObj = { videoUrl: "", opacity: 0.15 };
      
      const { error } = await supabase
        .from("settings")
        .upsert(
          { key: "services_bg_settings", value: resetObj, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      if (error) throw error;

      if (backupSupabase) {
        try {
          await backupSupabase
            .from("settings")
            .upsert(
              { key: "services_bg_settings", value: resetObj, updated_at: new Date().toISOString() },
              { onConflict: "key" }
            );
        } catch (backupErr) {
          console.error("Backup DB services bg reset failed:", backupErr);
        }
      }

      return NextResponse.json({ success: true, ...resetObj });
    }

    // 2. Get Signed Upload URL Action (direct upload path)
    if (body.action === "get_upload_url") {
      if (!body.fileName || !body.fileType) {
        return NextResponse.json({ error: "Missing fileName or fileType" }, { status: 400 });
      }

      if (!body.fileType.startsWith("video/") && !body.fileType.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type. Video or image required." }, { status: 400 });
      }

      const fileExt = body.fileName.split('.').pop() || 'mp4';
      const storagePath = `admin-config/services-bg-custom.${fileExt}`;

      // Generate signed upload URL from primary client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const primaryClient = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false } });

      const { data, error } = await primaryClient.storage
        .from(CONFIG_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });

      if (error || !data) {
        throw error || new Error("Failed to generate signed upload URL");
      }

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${CONFIG_BUCKET}/${storagePath}?v=${Date.now()}`;

      return NextResponse.json({
        success: true,
        signedUrl: data.signedUrl,
        publicUrl
      });
    }

    // 3. Save or Finalize Action
    if (body.action === "finalize" || body.action === "save") {
      const finalVideoUrl = body.videoUrl !== null ? body.videoUrl : "";
      const opacity = body.opacity !== null ? parseFloat(body.opacity) : 0.15;
      const saveObj = { videoUrl: finalVideoUrl, opacity };

      const { error } = await supabase
        .from("settings")
        .upsert(
          { key: "services_bg_settings", value: saveObj, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      if (error) throw error;

      if (backupSupabase) {
        try {
          await backupSupabase
            .from("settings")
            .upsert(
              { key: "services_bg_settings", value: saveObj, updated_at: new Date().toISOString() },
              { onConflict: "key" }
            );
        } catch (backupErr) {
          console.error("Backup DB services bg save failed:", backupErr);
        }
      }

      return NextResponse.json({ success: true, ...saveObj });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST services bg settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 550 });
  }
}
