const { createClient } = require('@supabase/supabase-js');

async function addPisoWifi() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const description = JSON.stringify({
    description: "Affordable PisoWiFi solution for your community, store, or rental space. Automated time-based internet access with easy management.",
    subtitle: "PisoWiFi Setup & Portal",
    button_text: "View PisoWiFi Plans",
    redirect_url: "https://cynetworkpisowifi.vercel.app",
    min_quantity: 1000,
  });

  const { data, error } = await supabase.from('services').insert({
    title: 'PISOWIFI',
    description,
    starting_price: 0,
    icon_type: 'pisowifi',
  }).select().single();

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("PisoWiFi service created:", data.id);
  }
}

addPisoWifi();
