import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SETTINGS_SQL = `
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

INSERT INTO public.settings (key, value)
VALUES ('client_announcement', '{"enabled": false, "title": "Important Announcement", "message": "Please check this announcement before continuing.", "actionLabel": "", "actionHref": "", "version": "default"}')
ON CONFLICT (key) DO NOTHING;
`.trim();

const CUSTOMER_MESSAGES_SQL = `
CREATE TABLE IF NOT EXISTS public.customer_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('admin', 'customer', 'system')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_messages_email
ON public.customer_messages(customer_email);

CREATE INDEX IF NOT EXISTS idx_customer_messages_unread
ON public.customer_messages(customer_email, sender, is_read);
`.trim();

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase credentials missing in env" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const missingSql: string[] = [];

    const { error: settingsCheckError } = await supabase
      .from("settings")
      .select("key")
      .limit(1);

    if (settingsCheckError) {
      missingSql.push(SETTINGS_SQL);
    }

    const { error: chatCheckError } = await supabase
      .from("customer_messages")
      .select("id")
      .limit(1);

    if (chatCheckError) {
      missingSql.push(CUSTOMER_MESSAGES_SQL);
    }

    if (missingSql.length === 0) {
      return NextResponse.json({ status: "Database support tables already exist" });
    }

    return NextResponse.json({
      status: "table_missing",
      message: "Run this SQL in your Supabase SQL Editor",
      sql: missingSql.join("\n\n"),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
