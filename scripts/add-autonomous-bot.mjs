import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function seedAutonomousBot() {
  console.log("Checking if AUTONOMOUS BOT service already exists...");
  const { data: existing } = await supabase
    .from('services')
    .select('id')
    .eq('title', 'AUTONOMOUS BOT')
    .maybeSingle();

  const description = JSON.stringify({
    description: "Fully automated posting for your products on Facebook Feed & MyDay Stories. Instantly shares to all joined Facebook Groups with zero effort.",
    subtitle: "Real-time Bot Automation",
    button_text: "Activate Bot",
    min_quantity: 1,
    free_trial_amount: 0,
    custom_fields: []
  });

  if (existing) {
    console.log("AUTONOMOUS BOT service already exists, updating...");
    const { error } = await supabase
      .from('services')
      .update({
        description,
        starting_price: 499.00,
        icon_type: 'reactions' // we can render ThumbsUp or another custom handling
      })
      .eq('id', existing.id);
    
    if (error) {
      console.error("Error updating AUTONOMOUS BOT:", error.message);
    } else {
      console.log("✅ AUTONOMOUS BOT service updated successfully.");
    }
  } else {
    console.log("Creating AUTONOMOUS BOT service...");
    const { data: inserted, error } = await supabase
      .from('services')
      .insert({
        title: 'AUTONOMOUS BOT',
        description,
        starting_price: 499.00,
        icon_type: 'reactions'
      })
      .select('id')
      .single();

    if (error) {
      console.error("Error creating AUTONOMOUS BOT:", error.message);
    } else {
      console.log("✅ AUTONOMOUS BOT service created successfully with ID:", inserted.id);
    }
  }
}

seedAutonomousBot();
