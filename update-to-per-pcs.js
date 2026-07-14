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
  console.log('Migrating FB FOLLOWERS, FB REACTIONS, and FB VIEWS pricing from per-1k to per-piece (PCS)...');

  const updates = [
    { id: '6ef1e136-c2c8-4719-8c12-b0f20504d15e', name: 'FB FOLLOWERS', price: 0.249 },
    { id: '37b37203-2c37-4fd3-a0bb-0f5393f49c1c', name: 'FB REACTIONS', price: 0.399 },
    { id: '5a383d04-281e-4d46-8366-799a0053a67c', name: 'FB VIEWS', price: 0.249 }
  ];

  for (const item of updates) {
    const { data, error } = await supabase
      .from('services')
      .update({ starting_price: item.price })
      .eq('id', item.id)
      .select();

    if (error) {
      console.error(`❌ Failed to migrate ${item.name}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`✅ Successfully migrated ${item.name} starting_price to ${item.price} per pc!`);
    } else {
      console.log(`⚠️ Warning: Service ${item.name} not found by ID ${item.id}.`);
    }
  }

  console.log('\nFetching updated services to verify...');
  const { data: services, error: fetchError } = await supabase
    .from('services')
    .select('id, title, starting_price')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to fetch services:', fetchError.message);
  } else {
    console.log(services);
  }
}

main();
