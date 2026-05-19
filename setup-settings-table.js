const { createClient } = require('@supabase/supabase-js');

async function setupSettingsTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Attempt to insert — if table doesn't exist, it will error with a helpful message
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'telegram_config', value: { bot_token: '', chat_id: '' } }, { onConflict: 'key' });

  if (error) {
    console.error("Error:", error.message);
    console.log("\n⚠️  The 'settings' table may not exist yet.");
    console.log("Run this SQL in Supabase SQL Editor:\n");
    console.log(`CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.settings
  USING (true) WITH CHECK (true);`);
  } else {
    console.log("✅ Settings table ready!");
  }
}

setupSettingsTable();
