import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts";
const CONFIG_PATH = "admin-config/telegram.png";

export async function POST(req: NextRequest) {
  try {
    const { webhookUrl } = await req.json();

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
    }

    // Fetch telegram config from Supabase storage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(CONFIG_PATH);

    if (error || !data) {
      return NextResponse.json({ error: "Telegram bot not configured. Set bot token and chat ID in admin settings first." }, { status: 400 });
    }

    const text = await data.text();
    const config = JSON.parse(text);

    if (!config.bot_token) {
      return NextResponse.json({ error: "Bot token not found in settings." }, { status: 400 });
    }

    // Register the webhook URL with Telegram
    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["callback_query"],
        drop_pending_updates: true
      }),
    });

    const result = await res.json();

    if (!result.ok) {
      return NextResponse.json({ error: result.description || "Failed to set webhook" }, { status: 400 });
    }

    return NextResponse.json({ success: true, description: result.description });
  } catch (err: any) {
    console.error("Setup webhook error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}

// GET - Check current webhook status
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(CONFIG_PATH);

    if (error || !data) {
      return NextResponse.json({ error: "Telegram not configured" }, { status: 400 });
    }

    const text = await data.text();
    const config = JSON.parse(text);

    if (!config.bot_token) {
      return NextResponse.json({ error: "Bot token missing" }, { status: 400 });
    }

    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/getWebhookInfo`);
    const result = await res.json();

    return NextResponse.json(result.result || result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
