const { createClient } = require('@supabase/supabase-js');

async function listServices() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: services } = await supabase.from('services').select('title, id');
  console.log(services);
}
listServices();
