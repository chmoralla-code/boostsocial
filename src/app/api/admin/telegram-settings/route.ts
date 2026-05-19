import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// GET current settings
export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "telegram_config")
    .single();

  return NextResponse.json(data?.value || { bot_token: "", chat_id: "" });
}

// POST / update settings
export async function POST(req: NextRequest) {
  const { bot_token, chat_id } = await req.json();
  const supabase = getSupabase();

  const { error } = await supabase
    .from("settings")
    .upsert({ key: "telegram_config", value: { bot_token, chat_id } }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
