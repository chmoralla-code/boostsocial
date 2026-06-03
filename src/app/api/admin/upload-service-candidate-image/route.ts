import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getEnv } from "@/utils/env";
import { isAdminEmail } from "@/utils/security/admin";

const CONFIG_BUCKET = "receipts";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Unknown upload error";
}

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return isAdminEmail(user?.email) ? { authenticated: true } : { authenticated: false };
}

function sanitizeCandidateId(value: string | null) {
  return (value || "candidate")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "candidate";
}

function getSafeExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  const fromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  if (file.type && fromType[file.type.toLowerCase()]) {
    return fromType[file.type.toLowerCase()];
  }

  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  return "png";
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
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    const contentType = file.type.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Invalid image type. Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large. Maximum size is 8MB." }, { status: 400 });
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
    const storagePath = `admin-config/service-candidates/${safeCandidateId}-${Date.now()}.${fileExt}`;

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
    console.error("Service candidate image upload failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
