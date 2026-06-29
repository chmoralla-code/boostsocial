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

const PUSH_SUBSCRIPTIONS_SQL = `
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_email
ON public.push_subscriptions (lower(email));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER touch_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_push_subscriptions_updated_at();
`.trim();

const ADMIN_SECRETS_SQL = `
CREATE TABLE IF NOT EXISTS public.admin_secrets (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;

-- Intentionally NO policies: only the service role (which bypasses RLS) can
-- read or write this table. A 4-digit PIN hash stored here cannot be brute-forced
-- by anon / authenticated users, unlike the public settings table.
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

    const { error: pushCheckError } = await supabase
      .from("push_subscriptions")
      .select("id")
      .limit(1);

    if (pushCheckError) {
      missingSql.push(PUSH_SUBSCRIPTIONS_SQL);
    }

    // Check if admin_secrets table exists (used by adminPin.ts for the
    // 4-digit dashboard PIN). A missing table here makes every PIN op fail
    // with "Could not find the table 'public.admin_secrets' in the schema
    // cache" — so surface the CREATE TABLE SQL for the admin to run.
    const { error: adminSecretsCheckError } = await supabase
      .from("admin_secrets")
      .select("key")
      .limit(1);

    if (adminSecretsCheckError && /admin_secrets.*schema cache|could not find the table.*admin_secrets|relation.*admin_secrets.*does not exist/i.test(adminSecretsCheckError.message || "")) {
      missingSql.push(ADMIN_SECRETS_SQL);
    }

    // Check if orders table has service_title column (denormalized column
    // used by the dual-db SELECT translation layer)
    const { error: ordersColumnError } = await supabase
      .from("orders")
      .select("service_title")
      .limit(1);

    if (ordersColumnError && /column.*service_title.*does not exist/i.test(ordersColumnError.message)) {
      missingSql.push("ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_title TEXT;");
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
