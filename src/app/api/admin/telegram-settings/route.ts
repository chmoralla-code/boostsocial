import { NextRequest, NextResponse } from "next/server";
import { syncBackupAdminClients, fallbackRead } from "@/utils/supabase/dual-db";

// GET — read both configs from database settings table
export async function GET() {
  try {
    let bot_token = "";
    let chat_id = "";
    const { data: orderData } = await fallbackRead(async (db) => {
      return db.from("settings").select("value").eq("key", "telegram_order_config").single();
    });
    if (orderData?.value) {
      bot_token = orderData.value.bot_token || "";
      chat_id = orderData.value.chat_id || "";
    }

    let topup_bot_token = "";
    let topup_chat_id = "";
    const { data: topupData } = await fallbackRead(async (db) => {
      return db.from("settings").select("value").eq("key", "telegram_topup_config").single();
    });
    if (topupData?.value) {
      topup_bot_token = topupData.value.bot_token || "";
      topup_chat_id = topupData.value.chat_id || "";
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

// POST — save either or both configs to database settings table
export async function POST(req: NextRequest) {
  try {
    const { bot_token, chat_id, topup_bot_token, topup_chat_id } = await req.json();

    // Save standard order notifications config
    if (bot_token !== undefined && chat_id !== undefined) {
      await syncBackupAdminClients(async (db) => {
        return db.from("settings").upsert({
          key: "telegram_order_config",
          value: { bot_token, chat_id },
          updated_at: new Date().toISOString()
        });
      }, "telegram order config update");
    }

    // Save wallet top-ups approval config
    if (topup_bot_token !== undefined && topup_chat_id !== undefined) {
      await syncBackupAdminClients(async (db) => {
        return db.from("settings").upsert({
          key: "telegram_topup_config",
          value: { bot_token: topup_bot_token, chat_id: topup_chat_id },
          updated_at: new Date().toISOString()
        });
      }, "telegram topup config update");
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Save settings error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
