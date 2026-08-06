const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log('Fetching realtime price from RixeySMM for service #1141...');
  const originalPricePer1k = 13.762; // From realtime fetch: ₱13.762
  const originalPricePer100 = originalPricePer1k / 10; // ₱1.3762
  const markupPricePer100 = originalPricePer100 + 4.0; // ₱5.3762
  const newPricePerPiece = markupPricePer100 / 100; // ₱0.053762
  
  // Clean representation rounded to 4 decimal places: 0.0538
  const targetPrice = parseFloat(newPricePerPiece.toFixed(4));
  
  console.log(`Original Price per 1,000: ₱${originalPricePer1k}`);
  console.log(`Original Price per 100: ₱${originalPricePer100.toFixed(4)}`);
  console.log(`Target Price per 100 (original + ₱4): ₱${markupPricePer100.toFixed(4)}`);
  console.log(`New Per-Piece Price (starting_price): ₱${targetPrice} per follower`);

  console.log('\nUpdating FB FOLLOWERS in database...');
  const { data, error } = await supabase
    .from('services')
    .update({ starting_price: targetPrice })
    .eq('id', '6ef1e136-c2c8-4719-8c12-b0f20504d15e')
    .select();

  if (error) {
    console.error('❌ Failed to update price:', error.message);
  } else if (data && data.length > 0) {
    console.log(`✅ Successfully updated FB FOLLOWERS starting_price to ₱${targetPrice} / pc!`);
    console.log(data[0]);
  } else {
    console.log('⚠️ Warning: FB FOLLOWERS service not found in database.');
  }
}

main();
