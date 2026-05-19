const { createClient } = require('@supabase/supabase-js');

async function createSettingsViaInsert() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Try to create table via Supabase SQL API (v2)
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  
  const sql = `
    CREATE TABLE IF NOT EXISTS public.settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Allow service role'
      ) THEN
        CREATE POLICY "Allow service role" ON public.settings FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;
    INSERT INTO public.settings (key, value) 
    VALUES ('telegram_config', '{"bot_token": "", "chat_id": ""}')
    ON CONFLICT (key) DO NOTHING;
  `;

  // Try the Supabase v2 query endpoint
  const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ sql }),
  });
  
  const text = await res.text();
  console.log("RPC exec response:", res.status, text.substring(0, 500));
  
  if (!res.ok) {
    // Try the pg-meta approach
    const res2 = await fetch(`https://${projectRef}.supabase.co/pg-meta/v0/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'x-connection-encrypted': serviceRoleKey,
      },
      body: JSON.stringify({ query: sql }),
    });
    
    const text2 = await res2.text();
    console.log("pg-meta response:", res2.status, text2.substring(0, 500));
  }
}

createSettingsViaInsert();
