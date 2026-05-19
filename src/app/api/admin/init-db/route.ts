import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Try reading settings to see if table exists
    const { error: checkError } = await supabase
      .from("settings")
      .select("key")
      .limit(1);

    if (!checkError) {
      return NextResponse.json({ status: "Table already exists" });
    }

    // Table doesn't exist — return the SQL the user needs to run
    return NextResponse.json({
      status: "table_missing",
      message: "Run this SQL in your Supabase SQL Editor",
      sql: `
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role" ON public.settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.settings (key, value) 
VALUES ('telegram_config', '{"bot_token": "", "chat_id": ""}')
ON CONFLICT (key) DO NOTHING;
      `.trim()
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
