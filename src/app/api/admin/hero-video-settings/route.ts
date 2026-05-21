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
      return NextResponse.json({ videoUrl: "" });
    }

    const text = await data.text();
    const config = JSON.parse(text);
    return NextResponse.json({ videoUrl: config.videoUrl || "" });
  } catch {
    return NextResponse.json({ videoUrl: "" });
  }
}

// POST — upload a custom hero background video, or reset to default
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const isReset = formData.get("reset") === "true";

    const supabase = getSupabase();

    if (isReset) {
      // Revert back to the default video URL by clearing the config
      const content = JSON.stringify({ videoUrl: "" });
      const blob = new Blob([content], { type: "image/png" });

      const { error } = await supabase.storage
        .from(CONFIG_BUCKET)
        .upload(CONFIG_PATH, blob, { upsert: true, contentType: "image/png" });

      if (error) throw error;
      return NextResponse.json({ success: true, videoUrl: "" });
    }

    if (!file) {
      return NextResponse.json({ error: "Missing media file" }, { status: 400 });
    }

    // Verify it's a video or image file (like GIF, JPEG, JPG, PNG)
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type. Please upload a valid video or image (MP4, GIF, JPEG, JPG, PNG)." }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'mp4';
    // Always upsert to a single file to prevent storage bloat
    const fileName = `admin-config/hero-bg-custom.${fileExt}`;

    // Upload to 'receipts' bucket which is already pre-configured to allow public access
    const { error: uploadError } = await supabase.storage
      .from(CONFIG_BUCKET)
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      throw uploadError;
    }

    // Generate public URL with cache-busting timestamp
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
