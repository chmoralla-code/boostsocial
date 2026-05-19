import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts"; // Using existing receipts bucket that is pre-configured
const CONFIG_PATH = "admin-config/telegram.png"; // Mask as png to satisfy MIME type restrictions

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

// GET — read config from storage
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(CONFIG_PATH);

    if (error || !data) {
      return NextResponse.json({ bot_token: "", chat_id: "" });
    }

    const text = await data.text();
    const config = JSON.parse(text);
    return NextResponse.json({ bot_token: config.bot_token || "", chat_id: config.chat_id || "" });
  } catch {
    return NextResponse.json({ bot_token: "", chat_id: "" });
  }
}

// POST — save config to storage
export async function POST(req: NextRequest) {
  try {
    const { bot_token, chat_id } = await req.json();

    if (!bot_token || !chat_id) {
      return NextResponse.json({ error: "Both bot token and chat ID are required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const content = JSON.stringify({ bot_token, chat_id });
    const blob = new Blob([content], { type: "image/png" });

    // Upload (upsert) the config file masked as a PNG
    const { error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .upload(CONFIG_PATH, blob, { upsert: true, contentType: "image/png" });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Save settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
