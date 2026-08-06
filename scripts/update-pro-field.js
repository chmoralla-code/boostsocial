const { createClient } = require('@supabase/supabase-js');

async function updateService() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const { data: services } = await supabase.from('services').select('*').eq('title', 'GEMINI PRO');
    if (!services || services.length === 0) return;
    
    const service = services[0];
    let parsed = {};
    try {
      if (service.description.startsWith("{")) {
        parsed = JSON.parse(service.description);
      }
    } catch(e) {}

    parsed.custom_fields = [
      { id: 'custom-email-pro', label: 'Google Account Email' }
    ];
    
    const { error } = await supabase.from('services').update({
      description: JSON.stringify(parsed)
    }).eq('id', service.id);
    
    if (error) throw error;
    console.log("GEMINI PRO Service updated with Custom Field!");
  } catch (err) {
    console.error(err);
  }
}

updateService();
