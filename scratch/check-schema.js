const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bhunvginzhgnwjkprnxc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodW52Z2luemhnbndqa3BybnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5NjYzMSwiZXhwIjoyMDk0NjcyNjMxfQ.7UBdq5wPsc5ViD9SeL7pPfYrEoE3rsXxU6jrykfDhco';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  const { data: services, error: sErr } = await supabase.from('services').select('*').limit(1);
  console.log('--- Services Schema Sample ---');
  if (sErr) console.error(sErr);
  else console.log(services);

  const { data: orders, error: oErr } = await supabase.from('orders').select('*').limit(1);
  console.log('--- Orders Schema Sample ---');
  if (oErr) console.error(oErr);
  else console.log(orders);
}

main();
