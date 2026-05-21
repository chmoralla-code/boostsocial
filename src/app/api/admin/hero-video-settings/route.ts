import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts";
const CONFIG_PATH = "admin-config/hero-video.png"; // Mask as png to satisfy MIME type restrictions if any

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

// GET — read current hero video settings from storage
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(CONFIG_PATH);

    if (error || !data) {
      return NextResponse.json({ videoUrl: "", opacity: 0.45 });
    }

    const text = await data.text();
    const config = JSON.parse(text);
    return NextResponse.json({
      videoUrl: config.videoUrl || "",
      opacity: config.opacity !== undefined ? Number(config.opacity) : 0.45
    });
  } catch {
    return NextResponse.json({ videoUrl: "", opacity: 0.45 });
  }
}

// POST — handles multiple actions: get_upload_url, finalize, save, standard upload, reset
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = formData.get("action") as string | null;
    const isReset = formData.get("reset") === "true";

    const supabase = getSupabase();

    // 1. Action: Reset
    if (isReset || action === "reset") {
      const content = JSON.stringify({ videoUrl: "", opacity: 0.45 });
      const blob = new Blob([content], { type: "image/png" });

      const { error } = await supabase.storage
        .from(CONFIG_BUCKET)
        .upload(CONFIG_PATH, blob, { upsert: true, contentType: "image/png" });

      if (error) throw error;
      return NextResponse.json({ success: true, videoUrl: "", opacity: 0.45 });
    }

    // 2. Action: Get Signed Upload URL (bypasses Vercel 4.5MB limit)
    if (action === "get_upload_url") {
      const clientFileName = formData.get("fileName") as string | null;
      const clientFileType = formData.get("fileType") as string | null;

      if (!clientFileName || !clientFileType) {
        return NextResponse.json({ error: "Missing fileName or fileType" }, { status: 400 });
      }

      // Verify it's a video or image file
      if (!clientFileType.startsWith("video/") && !clientFileType.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type. Please upload a valid video or image (MP4, GIF, JPEG, JPG, PNG)." }, { status: 400 });
      }

      const fileExt = clientFileName.split('.').pop() || 'mp4';
      const storagePath = `admin-config/hero-bg-custom.${fileExt}`;

      // Create signed upload URL
      const { data, error } = await supabase.storage
        .from(CONFIG_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });

      if (error || !data) {
        throw error || new Error("Failed to generate signed upload URL");
      }

      // Generate public URL with cache-busting timestamp
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${CONFIG_BUCKET}/${storagePath}?v=${Date.now()}`;

      return NextResponse.json({
        success: true,
        signedUrl: data.signedUrl,
        publicUrl
      });
    }

    // 3. Action: Finalize or Save Config
    if (action === "finalize" || action === "save") {
      const videoUrl = formData.get("videoUrl") as string | null;
      const opacityStr = formData.get("opacity") as string | null;
      const opacity = opacityStr !== null ? parseFloat(opacityStr) : 0.45;

      const finalVideoUrl = videoUrl !== null ? videoUrl : "";

      // Save configuration JSON masked as PNG
      const content = JSON.stringify({ videoUrl: finalVideoUrl, opacity });
      const blob = new Blob([content], { type: "image/png" });

      const { error: configError } = await supabase.storage
        .from(CONFIG_BUCKET)
        .upload(CONFIG_PATH, blob, { upsert: true, contentType: "image/png" });

      if (configError) {
        throw configError;
      }

      return NextResponse.json({ success: true, videoUrl: finalVideoUrl, opacity });
    }

    // 4. Fallback: Standard multipart form file upload (for backward compatibility / fallback)
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing media file" }, { status: 400 });
    }

    // Verify file type
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type. Please upload a valid video or image (MP4, GIF, JPEG, JPG, PNG)." }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'mp4';
    const fileName = `admin-config/hero-bg-custom.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(CONFIG_BUCKET)
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      throw uploadError;
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${CONFIG_BUCKET}/${fileName}?v=${Date.now()}`;

    // Save configuration JSON masked as PNG
    const content = JSON.stringify({ videoUrl: publicUrl });
    const blob = new Blob([content], { type: "image/png" });

    const { error: configError } = await supabase.storage
      .from(CONFIG_BUCKET)
      .upload(CONFIG_PATH, blob, { upsert: true, contentType: "image/png" });

    if (configError) {
      throw configError;
    }

    return NextResponse.json({ success: true, videoUrl: publicUrl });
  } catch (err: any) {
    console.error("Hero video settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
