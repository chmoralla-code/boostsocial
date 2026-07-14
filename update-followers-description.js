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
  console.log('Fetching FB FOLLOWERS service details...');
  const { data: service, error: fetchError } = await supabase
    .from('services')
    .select('*')
    .eq('id', '6ef1e136-c2c8-4719-8c12-b0f20504d15e')
    .single();

  if (fetchError || !service) {
    console.error('❌ Failed to fetch service:', fetchError?.message || 'Not found');
    return;
  }

  console.log('Current description JSON:', service.description);
  
  // Parse description and update custom_caption
  let parsedDesc = {};
  try {
    parsedDesc = JSON.parse(service.description);
  } catch (e) {
    console.error('❌ Failed to parse description JSON:', e);
    return;
  }

  parsedDesc.custom_caption = 'FOR ONLY 5.38PHP - 100 followers';
  const updatedDescription = JSON.stringify(parsedDesc);

  console.log('Updating description JSON to:', updatedDescription);

  const { data: updatedService, error: updateError } = await supabase
    .from('services')
    .update({ description: updatedDescription })
    .eq('id', '6ef1e136-c2c8-4719-8c12-b0f20504d15e')
    .select()
    .single();

  if (updateError) {
    console.error('❌ Failed to update description:', updateError.message);
  } else if (updatedService) {
    console.log('✅ Successfully updated description in database!');
    console.log(updatedService);
  }
}

main();
