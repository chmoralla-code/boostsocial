const { createClient } = require('@supabase/supabase-js');

async function inspectService() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: service, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', '03185a81-49f3-4255-868e-9e9ec3189497')
    .single();

  if (error) {
    console.error("Error fetching service:", error);
    // Try by title just in case the ID is different
    const { data: servicesByTitle } = await supabase
      .from('services')
      .select('*')
      .ilike('title', '%architectural%');
    console.log("Services matching architectural title:", servicesByTitle);
  } else {
    console.log("Found Service:", service);
  }
}
inspectService();
