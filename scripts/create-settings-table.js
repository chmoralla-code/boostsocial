const { createClient } = require('@supabase/supabase-js');

async function createTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Use Supabase REST API to run raw SQL via the pg-meta endpoint  
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
        SELECT FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Service role full access'
      ) THEN
        CREATE POLICY "Service role full access" ON public.settings USING (true) WITH CHECK (true);
      END IF;
    END $$;
    INSERT INTO public.settings (key, value) 
    VALUES ('telegram_config', '{"bot_token": "", "chat_id": ""}')
    ON CONFLICT (key) DO NOTHING;
  `;

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
  
  if (!res.ok) {
    console.log("\nTrying alternative via supabase-js rpc...");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) console.error("RPC Error:", error.message);
    else console.log("✅ Table created via RPC!");
  }
}

createTable();
