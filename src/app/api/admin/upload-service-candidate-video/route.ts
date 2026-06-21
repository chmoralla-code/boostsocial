import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getEnv } from "@/utils/env";
import { isAdminEmail } from "@/utils/security/admin";

const CONFIG_BUCKET = "receipts";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/x-m4v",
  "video/mpeg",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "application/mp4",
]);

function getErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Unknown upload error";
}

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { authenticated: isAdminEmail(user?.email) };
}

function sanitizeCandidateId(value: string | null) {
  return (value || "candidate")
    .trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "candidate";
}

function getSafeExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  const fromType: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
  };
  if (file.type && fromType[file.type.toLowerCase()]) return fromType[file.type.toLowerCase()];
  if (fromName && ["mp4", "webm", "mov", "avi"].includes(fromName)) return fromName;
  return "mp4";
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated } = await checkAdminAuth();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const candidateId = formData.get("candidateId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Missing video file" }, { status: 400 });
    }

    const contentType = file.type.toLowerCase();
    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Invalid video type "${contentType}". Use MP4, WebM, or MOV.` }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: `Video is too large (${(file.size/1024/1024).toFixed(1)}MB). Maximum size is 50MB.` }, { status: 400 });
    }

    // Vercel serverless has a ~4.5MB body limit, so warn if approaching it
    const totalBodySize = Number(req.headers.get("content-length") || file.size);
    if (totalBodySize > 4.5 * 1024 * 1024) {
      console.warn(`Large video upload (${(totalBodySize/1024/1024).toFixed(1)}MB) — may hit Vercel body size limit.`);
    }

    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const safeCandidateId = sanitizeCandidateId(candidateId);
    const fileExt = getSafeExtension(file);
    const storagePath = `admin-config/service-candidates/videos/${safeCandidateId}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType,
        upsert: false,
      });

    if (error) throw error;

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${CONFIG_BUCKET}/${storagePath}`;

    return NextResponse.json({ success: true, url: publicUrl, path: storagePath });
  } catch (err) {
    console.error("Service candidate video upload failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
