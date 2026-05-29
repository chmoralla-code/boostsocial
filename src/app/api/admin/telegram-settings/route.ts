import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts";
const CONFIG_PATH = "admin-config/telegram.png";
const TOPUP_CONFIG_PATH = "admin-config/telegram-topup.png";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

// GET — read both configs from storage
export async function GET() {
  try {
    const supabase = getSupabase();
    
    // Read standard config
    let bot_token = "";
    let chat_id = "";
    try {
      const { data, error } = await supabase.storage
        .from(CONFIG_BUCKET)
        .download(CONFIG_PATH);
      if (!error && data) {
        const text = await data.text();
        const config = JSON.parse(text);
        bot_token = config.bot_token || "";
        chat_id = config.chat_id || "";
      }
    } catch (e) {
      console.error("Error reading standard telegram config:", e);
    }

    // Read topup config
    let topup_bot_token = "";
    let topup_chat_id = "";
    try {
      const { data, error } = await supabase.storage
        .from(CONFIG_BUCKET)
        .download(TOPUP_CONFIG_PATH);
      if (!error && data) {
        const text = await data.text();
        const config = JSON.parse(text);
        topup_bot_token = config.bot_token || "";
        topup_chat_id = config.chat_id || "";
      }
    } catch (e) {
      console.error("Error reading topup telegram config:", e);
    }

    return NextResponse.json({
      bot_token,
      chat_id,
      topup_bot_token,
      topup_chat_id
    });
  } catch (err) {
    return NextResponse.json({ bot_token: "", chat_id: "", topup_bot_token: "", topup_chat_id: "" });
  }
}

// POST — save either or both configs to storage
export async function POST(req: NextRequest) {
  try {
    const { bot_token, chat_id, topup_bot_token, topup_chat_id } = await req.json();
    const supabase = getSupabase();

    // If standard keys are provided, save standard config
    if (bot_token !== undefined && chat_id !== undefined) {
      const content = JSON.stringify({ bot_token, chat_id });
      const blob = new Blob([content], { type: "image/png" });
      const { error } = await supabase.storage
        .from(CONFIG_BUCKET)
        .upload(CONFIG_PATH, blob, { upsert: true, contentType: "image/png" });
      if (error) throw error;
    }

    // If topup keys are provided, save topup config
    if (topup_bot_token !== undefined && topup_chat_id !== undefined) {
      const content = JSON.stringify({ bot_token: topup_bot_token, chat_id: topup_chat_id });
      const blob = new Blob([content], { type: "image/png" });
      const { error } = await supabase.storage
        .from(CONFIG_BUCKET)
        .upload(TOPUP_CONFIG_PATH, blob, { upsert: true, contentType: "image/png" });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Save settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
