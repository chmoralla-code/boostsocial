const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const coreIds = [
    "6ef1e136-c2c8-4719-8c12-b0f20504d15e", // followers
    "37b37203-2c37-4fd3-a0bb-0f5393f49c1c", // reactions
    "5a383d04-281e-4d46-8366-799a0053a67c"  // views
  ];

  for (const id of coreIds) {
    const { data: service, error } = await supabase
      .from('services')
      .select('title, starting_price, description')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching ${id}:`, error);
    } else {
      console.log(`\n========================================`);
      console.log(`Service: ${service.title}`);
      console.log(`Starting Price per Piece: ₱${service.starting_price}`);
      console.log(`Description payload:`);
      try {
        const parsedDesc = JSON.parse(service.description);
        console.log(JSON.stringify(parsedDesc, null, 2));
      } catch (e) {
        console.log(service.description);
      }
    }
  }
}

main();
