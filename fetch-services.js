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
  const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error(error);
  } else {
    data.forEach(s => {
      let desc = {};
      try { desc = JSON.parse(s.description); } catch(e) { desc = s.description || {}; }
      console.log(`- ${s.title}: ${desc.custom_caption || ('₱' + (s.starting_price * 1000).toFixed(2) + ' per 1k')}`);
    });
  }
}

main();
