// Mock global WebSocket to bypass Supabase Realtime check on Node 20
global.WebSocket = class {};

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bhunvginzhgnwjkprnxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log('Fetching all services from Supabase...');
  const { data: services, error: fetchError } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

  if (fetchError || !services) {
    console.error('❌ Failed to fetch services:', fetchError?.message || 'None found');
    return;
  }

  console.log(`Found ${services.length} services. Commencing convincing caption updates...`);

  for (const service of services) {
    let parsedDesc = {};
    try {
      if (service.description && service.description.trim().startsWith('{')) {
        parsedDesc = JSON.parse(service.description);
      } else {
        parsedDesc = { description: service.description || "" };
      }
    } catch (e) {
      parsedDesc = { description: service.description || "" };
    }

    const price = Number(service.starting_price);
    
    // Check if it's a redirect/specialty service (like Gemini, PisoWiFi, software licenses)
    const isSpecialty = 
      service.title.toLowerCase().includes("page") || 
      service.title.toLowerCase().includes("gemini") || 
      service.title.toLowerCase().includes("pisowifi") || 
      service.title.toLowerCase().includes("eap") || 
      service.title.toLowerCase().includes("tplink") || 
      service.title.toLowerCase().includes("software") || 
      service.title.toLowerCase().includes("architectural") || 
      service.title.toLowerCase().includes("license") ||
      parsedDesc.redirect_url ||
      Number(parsedDesc.min_quantity) === 1 ||
      service.id === "03185a81-49f3-4255-868e-9e9ec3189497";

    let convincingCaption = "";
    if (isSpecialty) {
      convincingCaption = `⚡ ONLY ₱${price.toFixed(2)} PER LIFETIME LICENSE !`;
    } else {
      const pricePer1k = price * 1000;
      convincingCaption = `🔥 ONLY ₱${pricePer1k.toFixed(2)} PER 1,000 ITEMS !`;
    }

    console.log(`Setting caption for "${service.title}" to: "${convincingCaption}"`);
    parsedDesc.custom_caption = convincingCaption;
    const updatedDescription = JSON.stringify(parsedDesc);

    const { data: updated, error: updateError } = await supabase
      .from('services')
      .update({ description: updatedDescription })
      .eq('id', service.id)
      .select()
      .single();

    if (updateError) {
      console.error(`❌ Failed to update "${service.title}":`, updateError.message);
    } else if (updated) {
      console.log(`✅ Successfully updated "${service.title}" in database!`);
    }
  }

  console.log('\nAll services successfully updated with convincing captions!');
}

main();
