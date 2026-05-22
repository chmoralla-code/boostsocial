import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bhunvginzhgnwjkprnxc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function seedSmmService() {
  console.log("Checking if CUSTOM SMM SERVICE already exists...");
  const { data: existing } = await supabase
    .from('services')
    .select('id')
    .eq('title', 'CUSTOM SMM SERVICE')
    .maybeSingle();

  if (existing) {
    console.log("CUSTOM SMM SERVICE already exists with ID:", existing.id);
  } else {
    console.log("Creating CUSTOM SMM SERVICE...");
    const { data: inserted, error } = await supabase
      .from('services')
      .insert({
        title: 'CUSTOM SMM SERVICE',
        description: JSON.stringify({
          description: "Explore and order 1,100+ premium SMM panel services for Facebook, Instagram, TikTok, YouTube, and other platforms.",
          subtitle: "Explore 1,100+ SMM services",
          button_text: "Order Now",
          min_quantity: 100,
          free_trial_amount: 0,
          custom_fields: []
        }),
        starting_price: 0.0001, // placeholder fractional price
        icon_type: 'followers'
      })
      .select('id')
      .single();

    if (error) {
      console.error("Error creating CUSTOM SMM SERVICE:", error.message);
    } else {
      console.log("✅ CUSTOM SMM SERVICE created successfully with ID:", inserted.id);
    }
  }
}

seedSmmService();
