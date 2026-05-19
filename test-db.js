require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkDb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log("Missing credentials.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  try {
    // Check total auth users using the admin api
    const { data: users, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    console.log("Total Auth Users:", users?.users?.length || 0);
    
    // Check total profiles
    const { count: profileCount, error: profileErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log("Total Profiles:", profileCount);

  } catch (err) {
    console.error("Error:", err);
  }
}

checkDb();
